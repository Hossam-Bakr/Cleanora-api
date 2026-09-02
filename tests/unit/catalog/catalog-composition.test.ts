import {
  bindPrismaClient,
  resetPrismaClientForTests,
} from "#database/prisma";
import { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createRuntimeDependencies } from "../../../src/composition.js";
import { createCatalogDefinitionReader } from "../../../src/modules/catalog/catalog.public.js";
import { mountRoutes } from "../../../src/routes/index.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import type { Express } from "express";

/**
 * T134 — composition variants for CatalogDefinitionReader (always wired) and
 * staff Catalog router (Authentication-gated). No DB connect.
 */

function authMediaOverrides() {
  return {
    AUTH_ENABLED: true as const,
    EMAIL_AUTH_ENABLED: false as const,
    GOOGLE_AUTH_ENABLED: true as const,
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    MEDIA_STORAGE_PROVIDER: "cloudinary" as const,
    CLOUDINARY_CLOUD_NAME: "demo",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
    CLOUDINARY_PROFILE_IMAGE_FOLDER: "cleanora-providers",
    CLOUDINARY_SIGNED_URL_TTL_SECONDS: 300,
    MEDIA_IMAGE_MAX_BYTES: 5 * 1024 * 1024,
    PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: 30,
  };
}

describe("R1-P08 catalog composition", () => {
  afterEach(() => {
    resetPrismaClientForTests("test");
  });

  it("always wires CatalogDefinitionReader without connecting Prisma or requiring AUTH", () => {
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");
    const runtime = createRuntimeDependencies(createTestEnvironment());

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.catalogDefinitionReader).toBeDefined();
    expect(typeof runtime.catalogDefinitionReader.listSelectable).toBe(
      "function",
    );
    expect(
      typeof runtime.catalogDefinitionReader.getSnapshotReadyDefinition,
    ).toBe("function");
    expect(runtime.routes.staffCatalogRouter).toBeUndefined();
  });

  it("keeps CatalogDefinitionReader independent of staff HTTP Authentication", () => {
    const withoutAuth = createRuntimeDependencies(createTestEnvironment());
    const withAuth = createRuntimeDependencies(
      createTestEnvironment(authMediaOverrides()),
    );

    expect(withoutAuth.catalogDefinitionReader).toBeDefined();
    expect(withAuth.catalogDefinitionReader).toBeDefined();
    expect(withoutAuth.routes.staffCatalogRouter).toBeUndefined();
    expect(withAuth.routes.staffCatalogRouter).toBeDefined();

    const wrapped = createCatalogDefinitionReader(
      withoutAuth.catalogDefinitionReader,
    );
    expect(typeof wrapped.listSelectable).toBe("function");
    expect(typeof wrapped.getSnapshotReadyDefinition).toBe("function");

    vi.useFakeTimers();
    const stop = withAuth.startCustomersBackgroundTasks?.();
    expect(stop).toBeTypeOf("function");
    stop?.();
    vi.useRealTimers();

    const customersProbe = withAuth.routes.readinessProbes?.find(
      (probe) => probe.name === "customers-runtime-configuration",
    );
    expect(customersProbe?.check).toBeTypeOf("function");
  });

  it("mounts staff catalog under /staff/catalog only when the router is composed", () => {
    const uses: string[] = [];
    const app = {
      use: (path: string) => {
        uses.push(path);
      },
    } as unknown as Express;

    const authRuntime = createRuntimeDependencies(
      createTestEnvironment(authMediaOverrides()),
    );
    mountRoutes(app, authRuntime.routes);

    expect(uses).toContain("/api/v1/staff/catalog");
    expect(uses.some((path) => /\/api\/v1\/catalog(?:\/|$)/u.test(path))).toBe(
      false,
    );
  });

  it("omits staff catalog mount when AUTH is disabled", () => {
    bindPrismaClient({
      country: { findUnique: vi.fn() },
      mediaFile: { findUnique: vi.fn() },
    } as never);

    const uses: string[] = [];
    const app = {
      use: (path: string) => {
        uses.push(path);
      },
    } as unknown as Express;

    const runtime = createRuntimeDependencies(createTestEnvironment());
    mountRoutes(app, runtime.routes);

    expect(uses).not.toContain("/api/v1/staff/catalog");
    expect(runtime.catalogDefinitionReader).toBeDefined();
  });
});

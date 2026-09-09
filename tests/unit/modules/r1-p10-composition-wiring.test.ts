import type { Express } from "express";

import {
  bindPrismaClient,
  resetPrismaClientForTests,
} from "#database/prisma";
import { createTestEnvironment } from "../../helpers/test-environment.js";

/**
 * Bind Prisma before importing composition for tests that exercise auth-gated
 * R1-P10 wiring against a stub client without connecting.
 */
function bindTestPrismaClient(): void {
  bindPrismaClient({
    country: { findUnique: vi.fn(), findFirst: vi.fn() },
    currency: { findFirst: vi.fn() },
    mediaFile: { findUnique: vi.fn() },
    userRole: { findFirst: vi.fn() },
    appConfig: { findUnique: vi.fn() },
    countryConfig: { findUnique: vi.fn() },
  } as never);
}

bindTestPrismaClient();

type PrismaLifecycleModule = typeof import("../../../src/database/prisma-lifecycle.js");
type CompositionModule = typeof import("../../../src/composition.js");
type RoutesModule = typeof import("../../../src/routes/index.js");
type ProvidersPublicModule =
  typeof import("../../../src/modules/providers/providers.public.js");

let PrismaLifecycle: PrismaLifecycleModule["PrismaLifecycle"];
let createRuntimeDependencies: CompositionModule["createRuntimeDependencies"];
let mountRoutes: RoutesModule["mountRoutes"];
let createProviderOperationalAvailabilityReader: ProvidersPublicModule["createProviderOperationalAvailabilityReader"];

beforeAll(async () => {
  ({ PrismaLifecycle } = await import("../../../src/database/prisma-lifecycle.js"));
  ({ createRuntimeDependencies } = await import("../../../src/composition.js"));
  ({ mountRoutes } = await import("../../../src/routes/index.js"));
  ({ createProviderOperationalAvailabilityReader } = await import(
    "../../../src/modules/providers/providers.public.js"
  ));
});

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

describe("R1-P10 composition and route wiring", () => {
  afterEach(() => {
    resetPrismaClientForTests("test");
    bindTestPrismaClient();
  });

  it("omits locality and availability routers when AUTH is disabled", () => {
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");
    const runtime = createRuntimeDependencies(createTestEnvironment());

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.routes.staffConfigurationLocalityRouter).toBeUndefined();
    expect(runtime.routes.providerAvailabilityRouter).toBeUndefined();
    expect(runtime.providerOperationalAvailabilityReader).toBeUndefined();
  });

  it("wires locality/availability routers and operational reader when AUTH is enabled", () => {
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");
    const runtime = createRuntimeDependencies(
      createTestEnvironment(authMediaOverrides()),
    );

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.routes.staffConfigurationLocalityRouter).toBeDefined();
    expect(runtime.routes.providerAvailabilityRouter).toBeDefined();
    expect(runtime.providerOperationalAvailabilityReader).toBeDefined();

    const reader = createProviderOperationalAvailabilityReader(
      runtime.providerOperationalAvailabilityReader!,
    );
    expect(typeof reader.findCandidateProviderIdsForActiveTextualArea).toBe(
      "function",
    );
    expect(typeof reader.evaluateOneProviderOperationalAvailability).toBe(
      "function",
    );
  });

  it("mounts staff configuration and provider availability under sanctioned prefixes", () => {
    const uses: string[] = [];
    const app = {
      use: (path: string) => {
        uses.push(path);
      },
    } as unknown as Express;

    const runtime = createRuntimeDependencies(
      createTestEnvironment(authMediaOverrides()),
    );
    mountRoutes(app, runtime.routes);

    expect(uses).toContain("/api/v1/staff/configuration");
    expect(uses).toContain("/api/v1/providers");
    expect(uses).toContain("/api/v1/docs");
  });
});

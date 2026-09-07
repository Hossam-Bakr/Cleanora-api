import type { Express } from "express";

import {
  bindPrismaClient,
  resetPrismaClientForTests,
} from "#database/prisma";
import { createTestEnvironment } from "../../helpers/test-environment.js";

/**
 * Bind Prisma before importing composition for tests that exercise auth-gated
 * providers wiring against a stub client without connecting.
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
type ConfigurationPublicModule =
  typeof import("../../../src/modules/configuration/configuration.public.js");
type CatalogPublicModule =
  typeof import("../../../src/modules/catalog/catalog.public.js");
type AuthenticationPublicModule =
  typeof import("../../../src/modules/authentication/authentication.public.js");

let PrismaLifecycle: PrismaLifecycleModule["PrismaLifecycle"];
let createRuntimeDependencies: CompositionModule["createRuntimeDependencies"];
let mountRoutes: RoutesModule["mountRoutes"];
let createProviderServiceSnapshotReader: ProvidersPublicModule["createProviderServiceSnapshotReader"];
let createProviderServicesReadyFactsReader: ProvidersPublicModule["createProviderServicesReadyFactsReader"];
let createProviderServicePricingPolicyReader: ConfigurationPublicModule["createProviderServicePricingPolicyReader"];
let createTransactionalProviderServicePricingPolicyReader: ConfigurationPublicModule["createTransactionalProviderServicePricingPolicyReader"];
let createActiveCountryReader: ConfigurationPublicModule["createActiveCountryReader"];
let createTransactionalActiveCountryReader: ConfigurationPublicModule["createTransactionalActiveCountryReader"];
let toCategoryManagementDto: CatalogPublicModule["toCategoryManagementDto"];
let toServiceManagementDto: CatalogPublicModule["toServiceManagementDto"];
let AUTHENTICATION_PUBLIC_CONTRACT: AuthenticationPublicModule["AUTHENTICATION_PUBLIC_CONTRACT"];

beforeAll(async () => {
  ({ PrismaLifecycle } = await import("../../../src/database/prisma-lifecycle.js"));
  ({ createRuntimeDependencies } = await import("../../../src/composition.js"));
  ({ mountRoutes } = await import("../../../src/routes/index.js"));
  ({
    createProviderServiceSnapshotReader,
    createProviderServicesReadyFactsReader,
  } = await import("../../../src/modules/providers/providers.public.js"));
  ({
    createProviderServicePricingPolicyReader,
    createTransactionalProviderServicePricingPolicyReader,
    createActiveCountryReader,
    createTransactionalActiveCountryReader,
  } = await import(
    "../../../src/modules/configuration/configuration.public.js"
  ));
  ({ toCategoryManagementDto, toServiceManagementDto } = await import(
    "../../../src/modules/catalog/catalog.public.js"
  ));
  ({ AUTHENTICATION_PUBLIC_CONTRACT } = await import(
    "../../../src/modules/authentication/authentication.public.js"
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

describe("R1-P09 composition and route wiring", () => {
  afterEach(() => {
    resetPrismaClientForTests("test");
    bindTestPrismaClient();
  });

  it("omits Provider Service routers when AUTH is disabled", () => {
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");
    const runtime = createRuntimeDependencies(createTestEnvironment());

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.routes.providerServiceRouter).toBeUndefined();
    expect(runtime.routes.staffProviderServiceRouter).toBeUndefined();
    expect(runtime.providerServicesReadyFactsReader).toBeUndefined();
    expect(runtime.providerServiceSnapshotReader).toBeUndefined();
  });

  it("wires Provider Service routers and public readers when AUTH is enabled", () => {
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");
    const runtime = createRuntimeDependencies(
      createTestEnvironment(authMediaOverrides()),
    );

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.routes.providerServiceRouter).toBeDefined();
    expect(runtime.routes.staffProviderServiceRouter).toBeDefined();
    expect(runtime.providerServicesReadyFactsReader).toBeDefined();
    expect(runtime.providerServiceSnapshotReader).toBeDefined();

    const ready = createProviderServicesReadyFactsReader(
      runtime.providerServicesReadyFactsReader!,
    );
    expect(typeof ready.getServicesReady).toBe("function");

    const snapshots = createProviderServiceSnapshotReader(
      runtime.providerServiceSnapshotReader!,
    );
    expect(typeof snapshots.getSnapshotReadyFacts).toBe("function");

    vi.useFakeTimers();
    const stop = runtime.startCustomersBackgroundTasks?.();
    expect(stop).toBeTypeOf("function");
    stop?.();
    vi.useRealTimers();
  });

  it("mounts Provider Service routes under sanctioned prefixes when composed", () => {
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

    expect(uses).toContain("/api/v1/providers");
    expect(uses).toContain("/api/v1/staff/providers");
    expect(uses).toContain("/api/v1/docs");
    expect(uses).toContain("/api/v1/system");
  });

  it("mounts every optional route family when supplied and skips when absent", () => {
    const uses: string[] = [];
    const app = {
      use: (path: string) => {
        uses.push(path);
      },
    } as unknown as Express;

    mountRoutes(app, {
      environment: createTestEnvironment(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as never,
      rateLimiter: {
        consume: vi.fn(async () => ({ allowed: true, remaining: 1 })),
      },
      authenticationRouter: { stack: [] } as never,
      ownerInternalRouter: { stack: [] } as never,
      customersRouter: { stack: [] } as never,
      providersRouter: { stack: [] } as never,
      staffProvidersRouter: { stack: [] } as never,
      providerAdminInvitationRouter: { stack: [] } as never,
      providerWorkforceRouter: { stack: [] } as never,
      providerWorkerSelfRouter: { stack: [] } as never,
      providerWorkforceInvitationRouter: { stack: [] } as never,
      providerServiceRouter: { stack: [] } as never,
      staffProviderServiceRouter: { stack: [] } as never,
      staffCatalogRouter: { stack: [] } as never,
    });

    expect(uses).toEqual(
      expect.arrayContaining([
        "/api/v1/auth",
        "/api/v1/internal/owner",
        "/api/v1/customers",
        "/api/v1/providers",
        "/api/v1/workers",
        "/api/v1/worker-invitations",
        "/api/v1/provider-admin-invitations",
        "/api/v1/staff/providers",
        "/api/v1/staff/catalog",
      ]),
    );

    const minimalUses: string[] = [];
    mountRoutes(
      {
        use: (path: string) => {
          minimalUses.push(path);
        },
      } as unknown as Express,
      {
        environment: createTestEnvironment(),
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        } as never,
        rateLimiter: {
          consume: vi.fn(async () => ({ allowed: true, remaining: 1 })),
        },
      },
    );
    expect(minimalUses).toEqual(["/api/v1/docs", "/api/v1/system"]);
  });

  it("exposes Configuration, Catalog, and Authentication public seams", () => {
    expect(AUTHENTICATION_PUBLIC_CONTRACT).toBe("authentication.public");

    expect(typeof createActiveCountryReader().resolveActiveCountry).toBe(
      "function",
    );
    expect(
      typeof createTransactionalActiveCountryReader({
        country: { findFirst: vi.fn() },
      }).getActiveCountryById,
    ).toBe("function");

    const reader = createProviderServicePricingPolicyReader();
    expect(typeof reader.readForCountry).toBe("function");
    const transactional = createTransactionalProviderServicePricingPolicyReader({
      countryConfig: { findUnique: vi.fn() },
    });
    expect(typeof transactional.readForCountry).toBe("function");

    const now = new Date("2026-09-05T12:00:00.000Z");
    expect(
      toCategoryManagementDto({
        id: "cat-1",
        code: "CLEANING",
        nameAr: "تنظيف",
        nameEn: "Cleaning",
        descriptionAr: null,
        descriptionEn: null,
        displayOrder: 1,
        isActive: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }).code,
    ).toBe("CLEANING");

    expect(
      toServiceManagementDto({
        id: "svc-1",
        categoryId: "cat-1",
        code: "DEEP_CLEAN",
        displayOrder: 1,
        isActive: true,
        version: 2,
        createdAt: now,
        updatedAt: now,
        translations: [{ locale: "EN", name: "Deep clean", description: null }],
      }).priceUnits,
    ).toEqual([]);
  });
});

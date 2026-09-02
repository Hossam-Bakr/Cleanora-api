
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogRepository,
  CatalogServiceWithConfigurationRow,
  CatalogUnitOfWorkDependencies,
} from "../../../src/modules/catalog/catalog.repository.js";
import type { Logger } from "../../../src/shared/logger.js";

const principal: AuthenticationPrincipal = {
  userId: "user_staff_admin",
  sessionId: "session_1",
  accountCategories: [],
  verifiedCategories: [],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};

const bilingualTranslations = [
  {
    locale: "AR" as const,
    name: "تنظيف المنازل",
    description: "وصف الخدمة",
  },
  {
    locale: "EN" as const,
    name: "Home Cleaning",
    description: "Service description",
  },
];

function allowAllAuthorization() {
  return {
    authorizeProtectedOperation: vi.fn(async () => ({
      allowed: true as const,
    })),
  };
}

function denyAuthorization() {
  return {
    authorizeProtectedOperation: vi.fn(async () => ({
      allowed: false as const,
      denialCode: "PERMISSION_DENIED" as const,
    })),
  };
}

function serviceWithConfiguration(
  overrides: Partial<CatalogServiceWithConfigurationRow> = {},
): CatalogServiceWithConfigurationRow {
  return {
    id: "svc_1",
    categoryId: "cat_1",
    code: "HOME_CLEANING",
    displayOrder: 0,
    isActive: false,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    translations: bilingualTranslations,
    priceUnits: [],
    fields: [],
    ...overrides,
  };
}

function createConfigurationHarness(options: {
  readonly current: CatalogServiceWithConfigurationRow;
}) {
  const auditAppend = vi.fn(async () => ({
    id: "audit_1",
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
  const completeCommand = vi.fn(async () => ({
    id: "cmd_1",
    status: "COMPLETED" as const,
    targetType: "SERVICE",
    targetId: options.current.id,
    acceptedVersion: options.current.version + 1,
    replayed: false,
  }));
  const replaceServiceConfiguration = vi.fn(async (_tx: unknown, input: {
    readonly priceUnits: readonly { readonly isActive: boolean }[];
  }) =>
    serviceWithConfiguration({
      ...options.current,
      version: options.current.version + 1,
      priceUnits: input.priceUnits.map((unit, index) => ({
        id: `pu_${index}`,
        code: "PER_VISIT",
        labelAr: "لكل زيارة",
        labelEn: "Per visit",
        displayOrder: index,
        isActive: unit.isActive,
      })),
    }),
  );
  const findServiceWithConfiguration = vi.fn(async () => options.current);
  const findCategory = vi.fn(async () => ({
    id: options.current.categoryId,
    code: "HOME_CLEANING",
    nameAr: "تنظيف",
    nameEn: "Cleaning",
    descriptionAr: "وصف",
    descriptionEn: "Description",
    displayOrder: 0,
    isActive: true,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }));
  const reserveOrReplayCommand = vi.fn(async () => "proceed" as const);

  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {} as CatalogUnitOfWorkDependencies["tx"],
    activeCountryReader: {
      resolveActiveCountry: async () => ({
        id: "country_eg",
        code: "EG",
      }),
      getActiveCountryById: async () => null,
    },
    privilegedAuditWriter: { append: auditAppend },
    catalogServiceImageAuthorizer: {
      assertReadyCatalogServiceImage: async () => true,
    },
  };

  const repository = {
    unitOfWork: {
      runInTransaction: async <T>(
        work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
      ): Promise<T> => work(uowDeps),
    },
    reserveOrReplayCommand,
    completeCommand,
    findServiceWithConfiguration,
    findCategory,
    replaceServiceConfiguration,
  } as unknown as CatalogRepository;

  const service = new CatalogService({
    authorization: allowAllAuthorization(),
    repository,
    logger: noopLogger,
  });

  return {
    service,
    auditAppend,
    completeCommand,
    replaceServiceConfiguration,
    findServiceWithConfiguration,
    reserveOrReplayCommand,
  };
}

describe("catalog management service (US1)", () => {
  it("rejects management writes without the approved privileged reason", async () => {
    const service = new CatalogService({
      authorization: allowAllAuthorization(),
      repository: {} as CatalogRepository,
      logger: noopLogger,
    });
    await expect(
      service.assertManagementWrite(principal, "privacy_request_reassign"),
    ).rejects.toBeInstanceOf(CatalogError);
  });

  it("rejects management reads when authorization denies", async () => {
    const service = new CatalogService({
      authorization: denyAuthorization(),
      repository: {} as CatalogRepository,
      logger: noopLogger,
    });
    await expect(service.assertManagementRead(principal)).rejects.toBeInstanceOf(
      CatalogError,
    );
  });

  it("strips localized and secret-like keys from privileged audit context", () => {
    const service = new CatalogService({
      authorization: allowAllAuthorization(),
      repository: {} as CatalogRepository,
      logger: noopLogger,
    });
    expect(
      service.buildSafeAuditContext({
        code: "HOME_CLEANING",
        version: 2,
        nameAr: "should-drop",
        descriptionEn: "should-drop",
        signedUrl: "should-drop",
        idempotencyKey: "should-drop",
        categoryId: "cat_1",
        isActive: true,
      }),
    ).toEqual({
      code: "HOME_CLEANING",
      version: 2,
      categoryId: "cat_1",
      isActive: true,
    });
  });

  it("rejects stale expected versions", () => {
    const service = new CatalogService({
      authorization: allowAllAuthorization(),
      repository: {} as CatalogRepository,
      logger: noopLogger,
    });
    expect(() =>
      service.assertExpectedVersion({
        currentVersion: 3,
        expectedVersion: 2,
        targetType: "CATEGORY",
      }),
    ).toThrow(CatalogError);
  });
});

/**
 * US2: already-active services cannot drop to zero active price units (FR-014).
 */
describe("catalog service configuration active invariant (US2)", () => {
  const commandBase = {
    idempotencyKey: "00000000-0000-4000-8000-000000000201",
    reasonCode: "catalog_management_change" as const,
    expectedVersion: 1,
    translations: bilingualTranslations,
    fields: [],
  };

  it("rejects an active service with zero active price units before persistence", async () => {
    const harness = createConfigurationHarness({
      current: serviceWithConfiguration({ isActive: true }),
    });

    await expect(
      harness.service.replaceServiceConfiguration(
        { principal },
        "svc_1",
        {
          ...commandBase,
          priceUnits: [
            {
              code: "PER_VISIT",
              labelAr: null,
              labelEn: null,
              isActive: false,
            },
          ],
        },
      ),
    ).rejects.toMatchObject({
      code: "CATALOG_ACTIVATION_INCOMPLETE",
    });

    expect(harness.replaceServiceConfiguration).not.toHaveBeenCalled();
    expect(harness.auditAppend).not.toHaveBeenCalled();
    expect(harness.completeCommand).not.toHaveBeenCalled();
  });

  it("persists when an active service keeps one bilingual active price unit", async () => {
    const harness = createConfigurationHarness({
      current: serviceWithConfiguration({ isActive: true }),
    });

    const result = await harness.service.replaceServiceConfiguration(
      { principal },
      "svc_1",
      {
        ...commandBase,
        priceUnits: [
          {
            code: "PER_VISIT",
            labelAr: "لكل زيارة",
            labelEn: "Per visit",
            isActive: true,
          },
        ],
      },
    );

    expect(result.replayed).toBe(false);
    expect(harness.replaceServiceConfiguration).toHaveBeenCalledTimes(1);
    expect(harness.auditAppend).toHaveBeenCalledTimes(1);
    expect(harness.completeCommand).toHaveBeenCalledTimes(1);
  });

  it("allows an inactive draft to save with no active price units", async () => {
    const harness = createConfigurationHarness({
      current: serviceWithConfiguration({ isActive: false }),
    });

    const result = await harness.service.replaceServiceConfiguration(
      { principal },
      "svc_1",
      {
        ...commandBase,
        priceUnits: [],
      },
    );

    expect(result.replayed).toBe(false);
    expect(harness.replaceServiceConfiguration).toHaveBeenCalledTimes(1);
    expect(harness.auditAppend).toHaveBeenCalledTimes(1);
    expect(harness.completeCommand).toHaveBeenCalledTimes(1);
  });
});

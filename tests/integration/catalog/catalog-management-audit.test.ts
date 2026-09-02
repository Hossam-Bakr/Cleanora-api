
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import type { PrivilegedAuditWriter } from "../../../src/modules/admin/audit.public.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogCategoryRow,
  CatalogRepository,
  CatalogUnitOfWorkDependencies,
} from "../../../src/modules/catalog/catalog.repository.js";
import type { Logger } from "../../../src/shared/logger.js";
import { TestLogger } from "../../helpers/test-logger.js";

const principal: AuthenticationPrincipal = {
  userId: "user_staff_admin",
  sessionId: "session_1",
  accountCategories: [],
  verifiedCategories: [],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

const commandBase = {
  idempotencyKey: "00000000-0000-4000-8000-000000000101",
  reasonCode: "catalog_management_change" as const,
  code: "HOME_CLEANING",
  nameAr: "تنظيف المنازل",
  nameEn: "Home Cleaning",
  descriptionAr: "وصف",
  descriptionEn: "Desc",
};

function createNoopLogger(): Logger {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return this;
    },
  };
}

function categoryRow(overrides: Partial<CatalogCategoryRow> = {}): CatalogCategoryRow {
  return {
    id: "cat_1",
    code: "HOME_CLEANING",
    nameAr: "تنظيف المنازل",
    nameEn: "Home Cleaning",
    descriptionAr: "وصف",
    descriptionEn: "Desc",
    displayOrder: 0,
    isActive: false,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createMutationHarness(options?: {
  readonly authorizeSequence?: ReadonlyArray<{ allowed: true } | { allowed: false; denialCode: "PERMISSION_DENIED" }>;
  readonly auditAppend?: PrivilegedAuditWriter["append"];
  readonly logger?: Logger;
}) {
  const auditAppend =
    options?.auditAppend ??
    vi.fn(async () => ({
      id: "audit_1",
      createdAt: "2026-01-01T00:00:00.000Z",
    }));
  const completeCommand = vi.fn(async () => ({
    id: "cmd_1",
    status: "COMPLETED" as const,
    targetType: "CATEGORY",
    targetId: "cat_1",
    acceptedVersion: 1,
    replayed: false,
  }));
  const insertCategory = vi.fn(async () => categoryRow());
  const nextCategoryDisplayOrder = vi.fn(async () => 0);
  const reserveOrReplayCommand = vi.fn(async () => "proceed" as const);
  const authorizeSequence = [...(options?.authorizeSequence ?? [{ allowed: true as const }, { allowed: true as const }])];
  const authorizeProtectedOperation = vi.fn(async () => {
    const next = authorizeSequence.shift() ?? { allowed: true as const };
    return next;
  });

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
    nextCategoryDisplayOrder,
    insertCategory,
    findCategory: vi.fn(),
    lockCategory: vi.fn(),
    updateCategory: vi.fn(),
    lockChildServiceIds: vi.fn(async () => []),
    bumpServiceVersions: vi.fn(async () => 0),
  } as unknown as CatalogRepository;

  const service = new CatalogService({
    authorization: { authorizeProtectedOperation },
    repository,
    logger: options?.logger ?? createNoopLogger(),
  });

  return {
    service,
    auditAppend,
    completeCommand,
    insertCategory,
    nextCategoryDisplayOrder,
    reserveOrReplayCommand,
    authorizeProtectedOperation,
    repository,
  };
}

/**
 * Taxonomy management audit/authorization (FR-030–FR-035, SC-007).
 * Executable fakes prove atomic privileged-audit evidence without a database.
 */
describe("catalog management audit contract", () => {
  it("requires catalog_management_change for privileged writes", async () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: createNoopLogger(),
    });
    await expect(
      service.assertManagementWrite(principal, "catalog_management_change"),
    ).resolves.toBeUndefined();
    await expect(
      service.assertManagementWrite(principal, "wrong_reason"),
    ).rejects.toBeInstanceOf(CatalogError);
  });

  it("forbids localized text keys from privileged audit context allowlist", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: createNoopLogger(),
    });
    const safe = service.buildSafeAuditContext({
      nameAr: "x",
      descriptionEn: "y",
      requestBody: "z",
      signedUrl: "u",
      categoryId: "cat_1",
      version: 1,
      isActive: false,
      code: "HOME_CLEANING",
    });
    expect(safe).toEqual({
      categoryId: "cat_1",
      version: 1,
      isActive: false,
      code: "HOME_CLEANING",
    });
  });

  it("appends exactly one privileged audit row with actor, reason, requestId, before, and after", async () => {
    const harness = createMutationHarness();
    const result = await harness.service.createCategory(
      { principal, requestId: "req-audit-1" },
      commandBase,
    );

    expect(result.replayed).toBe(false);
    expect(harness.auditAppend).toHaveBeenCalledTimes(1);
    expect(harness.completeCommand).toHaveBeenCalledTimes(1);
    expect(harness.auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "USER",
        actorId: principal.userId,
        reason: "catalog_management_change",
        requestId: "req-audit-1",
        targetId: "cat_1",
        context: {
          before: { exists: false },
          after: {
            categoryId: "cat_1",
            code: "HOME_CLEANING",
            version: 1,
            isActive: false,
            displayOrder: 0,
          },
        },
      }),
    );
    const context = (harness.auditAppend as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0]?.context as Record<string, unknown>;
    expect(JSON.stringify(context)).not.toMatch(
      /nameAr|descriptionEn|idempotencyKey|signedUrl|storageKey|requestBody/iu,
    );
  });

  it("prevents mutation and audit when fresh transaction reauthorization denies", async () => {
    const harness = createMutationHarness({
      authorizeSequence: [
        { allowed: true },
        { allowed: false, denialCode: "PERMISSION_DENIED" },
      ],
    });

    await expect(
      harness.service.createCategory({ principal, requestId: "req-deny" }, commandBase),
    ).rejects.toBeInstanceOf(CatalogError);

    expect(harness.reserveOrReplayCommand).not.toHaveBeenCalled();
    expect(harness.insertCategory).not.toHaveBeenCalled();
    expect(harness.auditAppend).not.toHaveBeenCalled();
    expect(harness.completeCommand).not.toHaveBeenCalled();
  });

  it("prevents completeCommand when privileged audit append fails", async () => {
    const harness = createMutationHarness({
      auditAppend: vi.fn(async () => {
        throw new Error("audit unavailable");
      }),
    });

    await expect(
      harness.service.createCategory({ principal, requestId: "req-fail" }, commandBase),
    ).rejects.toThrow("audit unavailable");

    expect(harness.insertCategory).toHaveBeenCalledTimes(1);
    expect(harness.completeCommand).not.toHaveBeenCalled();
  });

  it("makes zero repository mutation calls for wrong reason before opening a unit of work", async () => {
    const runInTransaction = vi.fn();
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {
        unitOfWork: { runInTransaction },
      } as unknown as CatalogRepository,
      logger: createNoopLogger(),
    });

    await expect(
      service.createCategory(
        { principal },
        { ...commandBase, reasonCode: "privacy_request_reassign" as never },
      ),
    ).rejects.toBeInstanceOf(CatalogError);
    expect(runInTransaction).not.toHaveBeenCalled();
  });

  it("logs only safe request-scoped facts after an accepted create", async () => {
    const logger = new TestLogger();
    const harness = createMutationHarness({ logger });
    await harness.service.createCategory(
      { principal, requestId: "req-log-1" },
      commandBase,
    );

    expect(logger.infoCalls).toHaveLength(1);
    expect(logger.infoCalls[0]?.message).toBe("catalog.management.write.accepted");
    expect(logger.infoCalls[0]?.context).toEqual(
      expect.objectContaining({
        operation: "catalog.category.create",
        outcome: "CREATED",
        targetType: "CATEGORY",
        targetId: "cat_1",
        version: 1,
        actorUserId: principal.userId,
        requestId: "req-log-1",
        code: "HOME_CLEANING",
        displayOrder: 0,
        isActive: false,
      }),
    );
    const serialized = JSON.stringify(logger.infoCalls[0]?.context);
    expect(serialized).not.toMatch(
      /nameAr|description|translation|idempotencyKey|signedUrl|storageKey|body/iu,
    );
  });

  it("uses count-only configuration audit snapshots without localized graph text", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: createNoopLogger(),
    });
    const snapshot = service.configurationAuditSnapshot({
      id: "svc_1",
      categoryId: "cat_1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 0,
      isActive: false,
      version: 4,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      translations: [{ locale: "EN", name: "Secret", description: "Secret" }],
      priceUnits: [
        {
          id: "unit_1",
          code: "PER_VISIT",
          labelAr: "سر",
          labelEn: "Secret",
          displayOrder: 0,
          isActive: true,
        },
      ],
      fields: [],
    });
    expect(snapshot).toEqual({
      serviceId: "svc_1",
      code: "STANDARD_HOME_CLEANING",
      version: 4,
      priceUnitCount: 1,
      fieldCount: 0,
      activePriceUnitCount: 1,
      activeFieldCount: 0,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/secret|label|translation/iu);
  });
});

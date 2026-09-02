
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogCategoryRow,
  CatalogCommandReceipt,
  CatalogRepository,
  CatalogServiceRow,
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

const meta = { principal, requestId: "req-mgmt-1" };

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};

const stamp = new Date("2026-01-01T00:00:00.000Z");

const bilingualTranslations = [
  {
    locale: "AR" as const,
    name: "تنظيف منزلي قياسي",
    description: "تنظيف دوري للمنزل.",
  },
  {
    locale: "EN" as const,
    name: "Standard Home Cleaning",
    description: "Routine cleaning for a home.",
  },
];

const reason = "catalog_management_change" as const;

function idem(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function allowAllAuthorization() {
  return {
    authorizeProtectedOperation: vi.fn(async () => ({
      allowed: true as const,
    })),
  };
}

function categoryRow(overrides: Partial<CatalogCategoryRow> = {}): CatalogCategoryRow {
  return {
    id: "cat_1",
    code: "HOME_CLEANING",
    nameAr: "تنظيف المنازل",
    nameEn: "Home Cleaning",
    descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
    descriptionEn: "Home cleaning and housekeeping services.",
    displayOrder: 0,
    isActive: false,
    version: 1,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

function serviceRow(overrides: Partial<CatalogServiceRow> = {}): CatalogServiceRow {
  return {
    id: "svc_1",
    categoryId: "cat_1",
    code: "STANDARD_HOME_CLEANING",
    displayOrder: 0,
    isActive: false,
    version: 1,
    createdAt: stamp,
    updatedAt: stamp,
    translations: bilingualTranslations,
    ...overrides,
  };
}

function serviceConfigured(
  overrides: Partial<CatalogServiceWithConfigurationRow> = {},
): CatalogServiceWithConfigurationRow {
  return {
    ...serviceRow(),
    priceUnits: [
      {
        id: "pu_1",
        code: "PER_VISIT",
        labelAr: "لكل زيارة",
        labelEn: "Per visit",
        displayOrder: 0,
        isActive: true,
      },
    ],
    fields: [],
    ...overrides,
  };
}

function completedReceipt(
  overrides: Partial<CatalogCommandReceipt> = {},
): CatalogCommandReceipt {
  return {
    id: "cmd_1",
    status: "COMPLETED",
    targetType: "CATEGORY",
    targetId: "cat_1",
    acceptedVersion: 1,
    replayed: false,
    ...overrides,
  };
}

function replayReceipt(
  overrides: Partial<CatalogCommandReceipt> = {},
): CatalogCommandReceipt {
  return completedReceipt({
    status: "COMPLETED",
    replayed: true,
    ...overrides,
  });
}

type HarnessOverrides = {
  readonly reserveOrReplayCommand?: ReturnType<typeof vi.fn>;
  readonly findCategory?: ReturnType<typeof vi.fn>;
  readonly lockCategory?: ReturnType<typeof vi.fn>;
  readonly updateCategory?: ReturnType<typeof vi.fn>;
  readonly insertCategory?: ReturnType<typeof vi.fn>;
  readonly listCategories?: ReturnType<typeof vi.fn>;
  readonly lockAllCategories?: ReturnType<typeof vi.fn>;
  readonly replaceCategoryOrder?: ReturnType<typeof vi.fn>;
  readonly findService?: ReturnType<typeof vi.fn>;
  readonly findServiceWithConfiguration?: ReturnType<typeof vi.fn>;
  readonly lockService?: ReturnType<typeof vi.fn>;
  readonly updateService?: ReturnType<typeof vi.fn>;
  readonly insertService?: ReturnType<typeof vi.fn>;
  readonly listServices?: ReturnType<typeof vi.fn>;
  readonly lockServicesInCategory?: ReturnType<typeof vi.fn>;
  readonly replaceServiceOrder?: ReturnType<typeof vi.fn>;
  readonly nextCategoryDisplayOrder?: ReturnType<typeof vi.fn>;
  readonly nextServiceDisplayOrder?: ReturnType<typeof vi.fn>;
  readonly lockChildServiceIds?: ReturnType<typeof vi.fn>;
  readonly bumpServiceVersions?: ReturnType<typeof vi.fn>;
  readonly listServiceCountryAvailability?: ReturnType<typeof vi.fn>;
  readonly replaceServiceCountryAvailability?: ReturnType<typeof vi.fn>;
  readonly resolveActiveCountry?: (
    countryCode: string,
  ) => Promise<{ readonly id: string; readonly code: string }>;
};

function createHarness(overrides: HarnessOverrides = {}) {
  const auditAppend = vi.fn(async () => ({
    id: "audit_1",
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
  const completeCommand = vi.fn(async () => completedReceipt());
  const reserveOrReplayCommand =
    overrides.reserveOrReplayCommand ??
    vi.fn(async () => "proceed" as const);

  const resolveActiveCountryImpl = async (
    countryCode: string,
  ): Promise<{ readonly id: string; readonly code: string }> => {
    if (overrides.resolveActiveCountry !== undefined) {
      return overrides.resolveActiveCountry(countryCode);
    }
    return {
      id: `country_${countryCode.toLowerCase()}`,
      code: countryCode,
    };
  };

  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {} as CatalogUnitOfWorkDependencies["tx"],
    activeCountryReader: {
      resolveActiveCountry: resolveActiveCountryImpl,
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
      runInReadSnapshot: async <T>(
        work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
      ): Promise<T> => work(uowDeps),
    },
    reserveOrReplayCommand,
    completeCommand,
    nextCategoryDisplayOrder:
      overrides.nextCategoryDisplayOrder ?? vi.fn(async () => 0),
    nextServiceDisplayOrder:
      overrides.nextServiceDisplayOrder ?? vi.fn(async () => 0),
    insertCategory:
      overrides.insertCategory ?? vi.fn(async () => categoryRow()),
    findCategory: overrides.findCategory ?? vi.fn(async () => categoryRow()),
    lockCategory: overrides.lockCategory ?? vi.fn(async () => categoryRow()),
    updateCategory:
      overrides.updateCategory ??
      vi.fn(async (_tx: unknown, input: { readonly isActive?: boolean }) =>
        categoryRow({
          version: 2,
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        }),
      ),
    listCategories:
      overrides.listCategories ??
      vi.fn(async () => ({ items: [categoryRow()], nextCursor: null })),
    lockAllCategories:
      overrides.lockAllCategories ?? vi.fn(async () => [categoryRow()]),
    replaceCategoryOrder:
      overrides.replaceCategoryOrder ??
      vi.fn(async () => [categoryRow({ displayOrder: 0, version: 2 })]),
    lockChildServiceIds: overrides.lockChildServiceIds ?? vi.fn(async () => []),
    bumpServiceVersions: overrides.bumpServiceVersions ?? vi.fn(async () => 0),
    findService: overrides.findService ?? vi.fn(async () => serviceRow()),
    findServiceWithConfiguration:
      overrides.findServiceWithConfiguration ??
      vi.fn(async () => serviceConfigured()),
    lockService: overrides.lockService ?? vi.fn(async () => serviceRow()),
    updateService:
      overrides.updateService ??
      vi.fn(async (_tx: unknown, input: {
        readonly isActive?: boolean;
        readonly categoryId?: string;
        readonly displayOrder?: number;
      }) =>
        serviceRow({
          version: 2,
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          ...(input.categoryId === undefined
            ? {}
            : { categoryId: input.categoryId }),
          ...(input.displayOrder === undefined
            ? {}
            : { displayOrder: input.displayOrder }),
        }),
      ),
    insertService:
      overrides.insertService ?? vi.fn(async () => serviceConfigured()),
    listServices:
      overrides.listServices ??
      vi.fn(async () => ({ items: [serviceConfigured()], nextCursor: null })),
    lockServicesInCategory:
      overrides.lockServicesInCategory ?? vi.fn(async () => [serviceRow()]),
    replaceServiceOrder:
      overrides.replaceServiceOrder ??
      vi.fn(async () => [serviceConfigured({ displayOrder: 0, version: 2 })]),
    listServiceCountryAvailability:
      overrides.listServiceCountryAvailability ?? vi.fn(async () => []),
    replaceServiceCountryAvailability:
      overrides.replaceServiceCountryAvailability ??
      vi.fn(async () => serviceConfigured({ version: 2 })),
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
    reserveOrReplayCommand,
    repository,
    resolveActiveCountry: resolveActiveCountryImpl,
  };
}

describe("CatalogService management reads", () => {
  it("lists categories for management", async () => {
    const harness = createHarness();
    const page = await harness.service.listCategoriesForManagement(meta, {
      limit: 10,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe("cat_1");
    expect(page.nextCursor).toBeNull();
  });

  it("gets a category and rejects missing category", async () => {
    const ok = createHarness();
    await expect(
      ok.service.getCategoryForManagement(meta, "cat_1"),
    ).resolves.toMatchObject({ id: "cat_1", code: "HOME_CLEANING" });

    const missing = createHarness({
      findCategory: vi.fn(async () => null),
    });
    await expect(
      missing.service.getCategoryForManagement(meta, "missing"),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
  });

  it("lists services for management", async () => {
    const harness = createHarness();
    const page = await harness.service.listServicesForManagement(meta, {
      categoryId: "cat_1",
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe("svc_1");
  });

  it("gets a service and rejects missing service", async () => {
    const ok = createHarness();
    await expect(
      ok.service.getServiceForManagement(meta, "svc_1"),
    ).resolves.toMatchObject({ id: "svc_1", code: "STANDARD_HOME_CLEANING" });

    const missing = createHarness({
      findServiceWithConfiguration: vi.fn(async () => null),
    });
    await expect(
      missing.service.getServiceForManagement(meta, "missing"),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
  });
});

describe("CatalogService createCategory idempotency", () => {
  const body = {
    idempotencyKey: idem(301),
    reasonCode: reason,
    code: "HOME_CLEANING",
    nameAr: "تنظيف المنازل",
    nameEn: "Home Cleaning",
    descriptionAr: "وصف",
    descriptionEn: "Desc",
  };

  it("replays a completed create when the target still exists", async () => {
    const harness = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({ targetType: "CATEGORY", targetId: "cat_1" }),
      ),
      findCategory: vi.fn(async () => categoryRow()),
    });

    const result = await harness.service.createCategory(meta, body);
    expect(result.replayed).toBe(true);
    expect(result.category.id).toBe("cat_1");
    expect(harness.completeCommand).not.toHaveBeenCalled();
    expect(harness.auditAppend).not.toHaveBeenCalled();
  });

  it("fails replay when the target category is missing", async () => {
    const harness = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({ targetType: "CATEGORY", targetId: "cat_gone" }),
      ),
      findCategory: vi.fn(async () => null),
    });

    await expect(harness.service.createCategory(meta, body)).rejects.toMatchObject({
      code: "CATALOG_DEPENDENCY_FAILED",
    });
  });
});

describe("CatalogService replaceCategoryContent", () => {
  const content = {
    nameAr: "تنظيف المنازل",
    nameEn: "Home Cleaning",
    descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
    descriptionEn: "Home cleaning and housekeeping services.",
  };

  it("replaces inactive category content", async () => {
    const updateCategory = vi.fn(async () =>
      categoryRow({ ...content, version: 2 }),
    );
    const harness = createHarness({
      lockCategory: vi.fn(async () => categoryRow({ isActive: false })),
      updateCategory,
    });

    const result = await harness.service.replaceCategoryContent(meta, "cat_1", {
      idempotencyKey: idem(302),
      reasonCode: reason,
      expectedVersion: 1,
      ...content,
    });

    expect(result.replayed).toBe(false);
    expect(result.category.version).toBe(2);
    expect(updateCategory).toHaveBeenCalled();
    expect(harness.auditAppend).toHaveBeenCalledTimes(1);
    expect(harness.completeCommand).toHaveBeenCalledTimes(1);
  });

  it("rejects stale expected versions", async () => {
    const harness = createHarness({
      lockCategory: vi.fn(async () => categoryRow({ version: 3 })),
    });

    await expect(
      harness.service.replaceCategoryContent(meta, "cat_1", {
        idempotencyKey: idem(303),
        reasonCode: reason,
        expectedVersion: 1,
        ...content,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
  });

  it("rejects incomplete content while the category is active", async () => {
    const harness = createHarness({
      lockCategory: vi.fn(async () => categoryRow({ isActive: true })),
    });

    await expect(
      harness.service.replaceCategoryContent(meta, "cat_1", {
        idempotencyKey: idem(304),
        reasonCode: reason,
        expectedVersion: 1,
        nameAr: null,
        nameEn: "Home Cleaning",
        descriptionAr: "وصف",
        descriptionEn: "Desc",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_ACTIVATION_INCOMPLETE" });
  });

  it("replays a completed content replacement", async () => {
    const harness = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({ targetType: "CATEGORY", targetId: "cat_1" }),
      ),
      findCategory: vi.fn(async () => categoryRow({ version: 2 })),
    });

    const result = await harness.service.replaceCategoryContent(meta, "cat_1", {
      idempotencyKey: idem(305),
      reasonCode: reason,
      expectedVersion: 1,
      ...content,
    });
    expect(result).toEqual({
      category: expect.objectContaining({ id: "cat_1", version: 2 }),
      replayed: true,
    });
  });
});

describe("CatalogService changeCategoryLifecycle", () => {
  it("activates a bilingual category", async () => {
    const updateCategory = vi.fn(async () =>
      categoryRow({ isActive: true, version: 2 }),
    );
    const harness = createHarness({
      lockCategory: vi.fn(async () => categoryRow({ isActive: false })),
      updateCategory,
    });

    const result = await harness.service.changeCategoryLifecycle(meta, "cat_1", {
      idempotencyKey: idem(306),
      reasonCode: reason,
      expectedVersion: 1,
      action: "ACTIVATE",
    });

    expect(result.category.isActive).toBe(true);
    expect(updateCategory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isActive: true }),
    );
  });

  it("deactivates a category", async () => {
    const harness = createHarness({
      lockCategory: vi.fn(async () => categoryRow({ isActive: true })),
      updateCategory: vi.fn(async () =>
        categoryRow({ isActive: false, version: 2 }),
      ),
    });

    const result = await harness.service.changeCategoryLifecycle(meta, "cat_1", {
      idempotencyKey: idem(307),
      reasonCode: reason,
      expectedVersion: 1,
      action: "DEACTIVATE",
    });
    expect(result.category.isActive).toBe(false);
  });

  it("rejects missing category and incomplete activation content", async () => {
    const missing = createHarness({
      lockCategory: vi.fn(async () => null),
    });
    await expect(
      missing.service.changeCategoryLifecycle(meta, "gone", {
        idempotencyKey: idem(308),
        reasonCode: reason,
        expectedVersion: 1,
        action: "ACTIVATE",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });

    const incomplete = createHarness({
      lockCategory: vi.fn(async () =>
        categoryRow({ nameAr: null, isActive: false }),
      ),
    });
    await expect(
      incomplete.service.changeCategoryLifecycle(meta, "cat_1", {
        idempotencyKey: idem(309),
        reasonCode: reason,
        expectedVersion: 1,
        action: "ACTIVATE",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_ACTIVATION_INCOMPLETE" });
  });
});

describe("CatalogService createService", () => {
  const body = {
    idempotencyKey: idem(310),
    reasonCode: reason,
    categoryId: "cat_1",
    code: "STANDARD_HOME_CLEANING",
    translations: bilingualTranslations,
  };

  it("creates a service under an existing category", async () => {
    const insertService = vi.fn(async () => serviceConfigured());
    const harness = createHarness({
      findCategory: vi.fn(async () => categoryRow()),
      insertService,
    });

    const result = await harness.service.createService(meta, body);
    expect(result.replayed).toBe(false);
    expect(result.service.id).toBe("svc_1");
    expect(insertService).toHaveBeenCalled();
    expect(harness.completeCommand).toHaveBeenCalled();
  });

  it("rejects when the parent category is missing", async () => {
    const harness = createHarness({
      findCategory: vi.fn(async () => null),
    });
    await expect(harness.service.createService(meta, body)).rejects.toMatchObject({
      code: "CATALOG_NOT_FOUND",
    });
  });

  it("replays create and fails when the replay target is missing", async () => {
    const replayOk = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({ targetType: "SERVICE", targetId: "svc_1" }),
      ),
      findService: vi.fn(async () => serviceRow()),
    });
    await expect(replayOk.service.createService(meta, body)).resolves.toEqual({
      service: expect.objectContaining({ id: "svc_1" }),
      replayed: true,
    });

    const replayMissing = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({ targetType: "SERVICE", targetId: "svc_gone" }),
      ),
      findService: vi.fn(async () => null),
    });
    await expect(
      replayMissing.service.createService(meta, body),
    ).rejects.toMatchObject({ code: "CATALOG_DEPENDENCY_FAILED" });
  });
});

describe("CatalogService moveService", () => {
  it("moves a service into another category", async () => {
    const updateService = vi.fn(async () =>
      serviceRow({ categoryId: "cat_2", displayOrder: 0, version: 2 }),
    );
    const harness = createHarness({
      lockService: vi.fn(async () => serviceRow()),
      findCategory: vi.fn(async () => categoryRow({ id: "cat_2", code: "OTHER" })),
      nextServiceDisplayOrder: vi.fn(async () => 0),
      updateService,
    });

    const result = await harness.service.moveService(meta, "svc_1", {
      idempotencyKey: idem(311),
      reasonCode: reason,
      expectedVersion: 1,
      categoryId: "cat_2",
    });
    expect(result.service.categoryId).toBe("cat_2");
    expect(updateService).toHaveBeenCalled();
  });

  it("rejects missing service and missing destination category", async () => {
    const noService = createHarness({
      lockService: vi.fn(async () => null),
    });
    await expect(
      noService.service.moveService(meta, "gone", {
        idempotencyKey: idem(312),
        reasonCode: reason,
        expectedVersion: 1,
        categoryId: "cat_2",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });

    const noCategory = createHarness({
      lockService: vi.fn(async () => serviceRow()),
      findCategory: vi.fn(async () => null),
    });
    await expect(
      noCategory.service.moveService(meta, "svc_1", {
        idempotencyKey: idem(313),
        reasonCode: reason,
        expectedVersion: 1,
        categoryId: "missing",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
  });
});

describe("CatalogService changeServiceLifecycle", () => {
  it("activates a service with active category and valid bilingual config", async () => {
    const updateService = vi.fn(async () =>
      serviceRow({ isActive: true, version: 2 }),
    );
    const harness = createHarness({
      lockService: vi.fn(async () => serviceRow({ isActive: false })),
      findCategory: vi.fn(async () => categoryRow({ isActive: true })),
      findServiceWithConfiguration: vi.fn(async () => serviceConfigured()),
      updateService,
    });

    const result = await harness.service.changeServiceLifecycle(meta, "svc_1", {
      idempotencyKey: idem(314),
      reasonCode: reason,
      expectedVersion: 1,
      action: "ACTIVATE",
    });
    expect(result.service.isActive).toBe(true);
    expect(harness.completeCommand).toHaveBeenCalled();
  });

  it("deactivates a service without revalidating configuration", async () => {
    const harness = createHarness({
      lockService: vi.fn(async () => serviceRow({ isActive: true })),
      updateService: vi.fn(async () =>
        serviceRow({ isActive: false, version: 2 }),
      ),
    });

    const result = await harness.service.changeServiceLifecycle(meta, "svc_1", {
      idempotencyKey: idem(315),
      reasonCode: reason,
      expectedVersion: 1,
      action: "DEACTIVATE",
    });
    expect(result.service.isActive).toBe(false);
  });

  it("rejects activation when the category is inactive", async () => {
    const harness = createHarness({
      lockService: vi.fn(async () => serviceRow()),
      findCategory: vi.fn(async () => categoryRow({ isActive: false })),
    });

    await expect(
      harness.service.changeServiceLifecycle(meta, "svc_1", {
        idempotencyKey: idem(316),
        reasonCode: reason,
        expectedVersion: 1,
        action: "ACTIVATE",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_ACTIVATION_INCOMPLETE" });
  });

  it("rejects activation when configuration is incomplete", async () => {
    const harness = createHarness({
      lockService: vi.fn(async () => serviceRow()),
      findCategory: vi.fn(async () => categoryRow({ isActive: true })),
      findServiceWithConfiguration: vi.fn(async () =>
        serviceConfigured({ priceUnits: [] }),
      ),
    });

    await expect(
      harness.service.changeServiceLifecycle(meta, "svc_1", {
        idempotencyKey: idem(317),
        reasonCode: reason,
        expectedVersion: 1,
        action: "ACTIVATE",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_ACTIVATION_INCOMPLETE" });
  });
});

describe("CatalogService replaceCategoryOrder", () => {
  it("replaces the exact category order set", async () => {
    const cats = [
      categoryRow({ id: "cat_a", version: 1, displayOrder: 0 }),
      categoryRow({ id: "cat_b", version: 2, displayOrder: 1 }),
    ];
    const replaceCategoryOrder = vi.fn(async () => [
      categoryRow({ id: "cat_b", version: 3, displayOrder: 0 }),
      categoryRow({ id: "cat_a", version: 2, displayOrder: 1 }),
    ]);
    const harness = createHarness({
      lockAllCategories: vi.fn(async () => cats),
      replaceCategoryOrder,
    });

    const result = await harness.service.replaceCategoryOrder(meta, {
      idempotencyKey: idem(318),
      reasonCode: reason,
      items: [
        { id: "cat_b", expectedVersion: 2 },
        { id: "cat_a", expectedVersion: 1 },
      ],
    });

    expect(result.replayed).toBe(false);
    expect(result.categories.map((row) => row.id)).toEqual(["cat_b", "cat_a"]);
    expect(replaceCategoryOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderedIds: ["cat_b", "cat_a"],
        positions: [0, 1],
      }),
    );
  });

  it("replays category order replacement from the current list", async () => {
    const harness = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({
          targetType: "CATEGORY_ORDER",
          targetId: "CATEGORY_ORDER",
        }),
      ),
      listCategories: vi.fn(async () => ({
        items: [categoryRow({ id: "cat_a" })],
        nextCursor: null,
      })),
    });

    const result = await harness.service.replaceCategoryOrder(meta, {
      idempotencyKey: idem(319),
      reasonCode: reason,
      items: [{ id: "cat_a", expectedVersion: 1 }],
    });
    expect(result.replayed).toBe(true);
    expect(result.categories[0]?.id).toBe("cat_a");
  });
});

describe("CatalogService replaceServiceOrder", () => {
  it("replaces the exact service order set within a category", async () => {
    const services = [
      serviceRow({ id: "svc_a", version: 1 }),
      serviceRow({ id: "svc_b", version: 4 }),
    ];
    const replaceServiceOrder = vi.fn(async () => [
      serviceConfigured({ id: "svc_b", version: 5, displayOrder: 0 }),
      serviceConfigured({ id: "svc_a", version: 2, displayOrder: 1 }),
    ]);
    const harness = createHarness({
      findCategory: vi.fn(async () => categoryRow()),
      lockServicesInCategory: vi.fn(async () => services),
      replaceServiceOrder,
    });

    const result = await harness.service.replaceServiceOrder(meta, {
      idempotencyKey: idem(320),
      reasonCode: reason,
      categoryId: "cat_1",
      items: [
        { id: "svc_b", expectedVersion: 4 },
        { id: "svc_a", expectedVersion: 1 },
      ],
    });

    expect(result.replayed).toBe(false);
    expect(result.services.map((row) => row.id)).toEqual(["svc_b", "svc_a"]);
  });

  it("replays service order replacement", async () => {
    const harness = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({
          targetType: "SERVICE_ORDER",
          targetId: "cat_1",
        }),
      ),
      listServices: vi.fn(async () => ({
        items: [serviceConfigured({ id: "svc_a" })],
        nextCursor: null,
      })),
    });

    const result = await harness.service.replaceServiceOrder(meta, {
      idempotencyKey: idem(321),
      reasonCode: reason,
      categoryId: "cat_1",
      items: [{ id: "svc_a", expectedVersion: 1 }],
    });
    expect(result.replayed).toBe(true);
    expect(result.services[0]?.id).toBe("svc_a");
  });
});

describe("CatalogService replaceServiceAvailability", () => {
  it("writes available and unavailable country rows", async () => {
    const replaceServiceCountryAvailability = vi.fn(async () =>
      serviceConfigured({ version: 2 }),
    );
    const harness = createHarness({
      findServiceWithConfiguration: vi.fn(async () => serviceConfigured()),
      listServiceCountryAvailability: vi.fn(async () => []),
      replaceServiceCountryAvailability,
    });

    const result = await harness.service.replaceServiceAvailability(
      meta,
      "svc_1",
      {
        idempotencyKey: idem(322),
        reasonCode: reason,
        expectedVersion: 1,
        countries: [
          { countryCode: "EG", isAvailable: true },
          { countryCode: "SA", isAvailable: false },
        ],
      },
    );

    expect(result.replayed).toBe(false);
    expect(replaceServiceCountryAvailability).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        serviceId: "svc_1",
        countries: [
          { countryId: "country_eg", countryCode: "EG", isAvailable: true },
          { countryId: "country_sa", countryCode: "SA", isAvailable: false },
        ],
      }),
    );
  });

  it("replays availability replacement and rejects missing service", async () => {
    const replay = createHarness({
      reserveOrReplayCommand: vi.fn(async () =>
        replayReceipt({ targetType: "SERVICE", targetId: "svc_1" }),
      ),
      findServiceWithConfiguration: vi.fn(async () =>
        serviceConfigured({ version: 3 }),
      ),
    });
    await expect(
      replay.service.replaceServiceAvailability(meta, "svc_1", {
        idempotencyKey: idem(323),
        reasonCode: reason,
        expectedVersion: 1,
        countries: [{ countryCode: "EG", isAvailable: true }],
      }),
    ).resolves.toEqual({
      service: expect.objectContaining({ id: "svc_1", version: 3 }),
      replayed: true,
    });

    const missing = createHarness({
      findServiceWithConfiguration: vi.fn(async () => null),
    });
    await expect(
      missing.service.replaceServiceAvailability(meta, "gone", {
        idempotencyKey: idem(324),
        reasonCode: reason,
        expectedVersion: 1,
        countries: [{ countryCode: "EG", isAvailable: true }],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
  });
});

describe("CatalogService presentation helpers", () => {
  const service = new CatalogService({
    authorization: allowAllAuthorization(),
    repository: {} as CatalogRepository,
    logger: noopLogger,
  });

  it("builds allowlisted media audit snapshots", () => {
    expect(
      service.mediaAuditSnapshot({
        serviceId: "svc_1",
        code: "STANDARD_HOME_CLEANING",
        version: 2,
        associationCount: 3,
        storageKey: "drop-me",
        signedUrl: "drop-me",
      }),
    ).toEqual({
      serviceId: "svc_1",
      code: "STANDARD_HOME_CLEANING",
      version: 2,
      associationCount: 3,
    });
  });

  it("maps management media presentation from receipt + delivery", () => {
    expect(
      service.toManagementMediaPresentation({
        associationId: "assoc_1",
        displayOrder: 0,
        receipt: {
          mediaFileId: "media_1",
          ownerUserId: principal.userId,
          state: "READY",
          canonicalContentType: "image/jpeg",
          byteSize: 1024,
          width: 800,
          height: 600,
          safeReceiptId: "receipt_1",
        },
        delivery: {
          url: "https://example.test/img",
          expiresAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      }),
    ).toEqual({
      associationId: "assoc_1",
      mediaId: "media_1",
      displayOrder: 0,
      status: "READY",
      contentType: "image/jpeg",
      width: 800,
      height: 600,
      deliveryUrl: "https://example.test/img",
      deliveryExpiresAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("keeps only READY selectable media with valid type, dimensions, and association id", () => {
    expect(
      service.toSelectableMediaReferences([
        {
          associationId: "assoc_ok",
          mediaFileId: "media_ok",
          displayOrder: 0,
          status: "READY",
          contentType: "image/png",
          width: 100,
          height: 80,
        },
        {
          associationId: "assoc_pending",
          mediaFileId: "media_pending",
          displayOrder: 1,
          status: "PENDING",
          contentType: "image/png",
          width: 100,
          height: 80,
        },
        {
          associationId: "assoc_bad_type",
          mediaFileId: "media_bad_type",
          displayOrder: 2,
          status: "READY",
          contentType: "image/gif" as "image/jpeg",
          width: 100,
          height: 80,
        },
        {
          associationId: "assoc_bad_dims",
          mediaFileId: "media_bad_dims",
          displayOrder: 3,
          status: "READY",
          contentType: "image/jpeg",
          width: 0,
          height: 80,
        },
        {
          mediaFileId: "media_no_assoc",
          displayOrder: 4,
          status: "READY",
          contentType: "image/webp",
          width: 50,
          height: 50,
        },
        {
          id: "assoc_via_id",
          mediaFileId: "media_via_id",
          displayOrder: 5,
          status: "READY",
          contentType: "image/webp",
          width: 50,
          height: 50,
        },
      ]),
    ).toEqual([
      {
        associationId: "assoc_ok",
        mediaId: "media_ok",
        contentType: "image/png",
        width: 100,
        height: 80,
        displayOrder: 0,
      },
      {
        associationId: "assoc_via_id",
        mediaId: "media_via_id",
        contentType: "image/webp",
        width: 50,
        height: 50,
        displayOrder: 5,
      },
    ]);
  });
});

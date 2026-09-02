
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogRepository,
  CatalogUnitOfWorkDependencies,
  SelectableServiceCandidateRow,
} from "../../../src/modules/catalog/catalog.repository.js";
import type { Logger } from "../../../src/shared/logger.js";

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};

const completeTranslations = [
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

function selectableCandidate(
  fieldOverrides: SelectableServiceCandidateRow["service"]["fields"],
): SelectableServiceCandidateRow {
  return {
    category: {
      id: "cat_1",
      code: "HOME_CLEANING",
      nameAr: "تنظيف المنازل",
      nameEn: "Home Cleaning",
      descriptionAr: "وصف",
      descriptionEn: "Description",
      displayOrder: 0,
      isActive: true,
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    countryAvailabilityIsAvailable: true,
    service: {
      id: "svc_1",
      categoryId: "cat_1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 0,
      isActive: true,
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      translations: completeTranslations,
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
      fields: fieldOverrides,
    },
  };
}

function createListSelectableHarness(candidates: readonly SelectableServiceCandidateRow[]) {
  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {} as CatalogUnitOfWorkDependencies["tx"],
    activeCountryReader: {
      resolveActiveCountry: async () => ({
        id: "country_eg",
        code: "EG",
      }),
      getActiveCountryById: async () => null,
    },
    privilegedAuditWriter: {
      append: vi.fn(async () => ({
        id: "audit_1",
        createdAt: "2026-01-01T00:00:00.000Z",
      })),
    },
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
    listSelectableServiceCandidates: vi.fn(async () => ({
      items: candidates,
      nextCursor: null,
    })),
  } as unknown as CatalogRepository;

  const service = new CatalogService({
    authorization: {
      authorizeProtectedOperation: vi.fn(async () => ({ allowed: true as const })),
    },
    repository,
    logger: noopLogger,
  });

  return { service };
}

/**
 * US3 defensive selectability: label-only projection is insufficient when stored
 * active fields violate DEC-042 kind/constraint/options rules.
 */
describe("catalog selectability defensive stored configuration (US3)", () => {
  it("excludes candidates with invalid active persisted field graphs while keeping valid ones", async () => {
    const validField = {
      id: "field_valid",
      code: "BEDROOM_COUNT",
      kind: "NUMBER" as const,
      isRequired: false,
      isActive: true,
      labelAr: "عدد غرف النوم",
      labelEn: "Number of bedrooms",
      helpTextAr: null,
      helpTextEn: null,
      minLength: null,
      maxLength: null,
      numberMode: "INTEGER" as const,
      minValue: "0",
      maxValue: null,
      minSelections: null,
      maxSelections: null,
      displayOrder: 0,
      options: [],
    };
    const invalidField = {
      ...validField,
      id: "field_invalid",
      numberMode: null,
    };

    const validHarness = createListSelectableHarness([selectableCandidate([validField])]);
    const invalidHarness = createListSelectableHarness([
      selectableCandidate([invalidField]),
    ]);

    const validResult = await validHarness.service.listSelectable({
      countryCode: "EG",
      locale: "EN",
    });
    const invalidResult = await invalidHarness.service.listSelectable({
      countryCode: "EG",
      locale: "EN",
    });

    expect(validResult.items).toHaveLength(1);
    expect(validResult.items[0]?.serviceCode).toBe("STANDARD_HOME_CLEANING");
    expect(invalidResult.items).toHaveLength(0);
  });
});

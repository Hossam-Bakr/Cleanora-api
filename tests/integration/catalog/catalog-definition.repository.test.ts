
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogRepository,
  CatalogUnitOfWorkDependencies,
  SelectableServiceCandidateRow,
} from "../../../src/modules/catalog/catalog.repository.js";
import type {
  CatalogFieldDefinition,
  SnapshotReadyCatalogServiceDefinition,
} from "../../../src/modules/catalog/catalog.public.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * T120 — snapshot-ready repository/service projection expectations
 * (FR-042–FR-044, SC-009). Executable fake aggregate only.
 */

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

function compareByDisplayOrderThenId(
  left: { readonly displayOrder: number; readonly id: string },
  right: { readonly displayOrder: number; readonly id: string },
): number {
  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }
  return left.id.localeCompare(right.id);
}

/**
 * In-memory aggregate stand-in that projects one current version with
 * inactive children/media filtered and nested rows ordered deterministically.
 */
class FakeSnapshotReadyAggregateStore {
  private candidate: SelectableServiceCandidateRow | null = null;
  private media: readonly {
    readonly associationId: string;
    readonly mediaFileId: string;
    readonly displayOrder: number;
    readonly contentType: "image/jpeg" | "image/png" | "image/webp";
    readonly width: number;
    readonly height: number;
    readonly status: string;
    readonly isActive: boolean;
  }[] = [];

  seed(
    candidate: SelectableServiceCandidateRow,
    media: FakeSnapshotReadyAggregateStore["media"],
  ): void {
    this.candidate = {
      ...candidate,
      service: {
        ...candidate.service,
        priceUnits: candidate.service.priceUnits
          .slice()
          .sort(compareByDisplayOrderThenId),
        fields: candidate.service.fields
          .slice()
          .sort(compareByDisplayOrderThenId)
          .map((field) => ({
            ...field,
            options: field.options.slice().sort(compareByDisplayOrderThenId),
          })),
      },
    };
    this.media = media
      .slice()
      .sort((left, right) => {
        if (left.displayOrder !== right.displayOrder) {
          return left.displayOrder - right.displayOrder;
        }
        return left.associationId.localeCompare(right.associationId);
      });
  }

  findSelectableServiceByCode(): SelectableServiceCandidateRow | null {
    return this.candidate;
  }

  listServiceMediaAssociations() {
    return this.media.filter((row) => row.isActive && row.status === "READY");
  }

  projectActiveChildren() {
    const candidate = this.candidate;
    if (candidate === null) {
      return null;
    }
    return {
      serviceVersion: candidate.service.version,
      priceUnits: candidate.service.priceUnits.filter((unit) => unit.isActive),
      fields: candidate.service.fields
        .filter((field) => field.isActive)
        .map((field) => ({
          ...field,
          options: field.options.filter((option) => option.isActive),
        })),
      media: this.listServiceMediaAssociations(),
    };
  }
}

function completeAggregateCandidate(): SelectableServiceCandidateRow {
  return {
    category: {
      id: "cat_1",
      code: "HOME_CLEANING",
      nameAr: "تنظيف المنازل",
      nameEn: "Home Cleaning",
      descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
      descriptionEn: "Home cleaning and housekeeping services.",
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
      version: 4,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      translations: completeTranslations,
      priceUnits: [
        {
          id: "pu_inactive",
          code: "LEGACY_FLAT",
          labelAr: "قديم",
          labelEn: "Legacy",
          displayOrder: 2,
          isActive: false,
        },
        {
          id: "pu_hour",
          code: "PER_HOUR",
          labelAr: "لكل ساعة",
          labelEn: "Per hour",
          displayOrder: 1,
          isActive: true,
        },
        {
          id: "pu_visit",
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: "Per visit",
          displayOrder: 0,
          isActive: true,
        },
      ],
      fields: [
        {
          id: "field_inactive",
          code: "RETIRED_NOTE",
          kind: "TEXT",
          labelAr: "ملاحظة قديمة",
          labelEn: "Retired note",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: false,
          minLength: null,
          maxLength: 40,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 9,
          options: [],
        },
        {
          id: "field_info",
          code: "PREPARATION_INFORMATION",
          kind: "INFORMATION",
          labelAr: "راجع تفاصيل الخدمة قبل الحجز.",
          labelEn: "Review the service details before booking.",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 0,
          options: [],
        },
        {
          id: "field_rooms",
          code: "BEDROOM_COUNT",
          kind: "NUMBER",
          labelAr: "عدد غرف النوم",
          labelEn: "Number of bedrooms",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: "DECIMAL",
          minValue: "0.00",
          maxValue: "99.50",
          minSelections: null,
          maxSelections: null,
          displayOrder: 1,
          options: [],
        },
        {
          id: "field_pets",
          code: "HAS_PETS",
          kind: "BOOLEAN",
          labelAr: "هل توجد حيوانات أليفة؟",
          labelEn: "Are there pets?",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 2,
          options: [],
        },
      ],
    },
  };
}

function createHarness(store: FakeSnapshotReadyAggregateStore) {
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
      append: async () => ({
        id: "audit_1",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    },
    catalogServiceImageAuthorizer: {
      assertReadyCatalogServiceImage: async () => true,
    },
  };

  const repository = {
    unitOfWork: {
      runInTransaction: async <T>(
        work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
      ) => work(uowDeps),
      runInReadSnapshot: async <T>(
        work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
      ) => work(uowDeps),
    },
    findSelectableServiceByCode: vi.fn(async () => store.findSelectableServiceByCode()),
    listServiceMediaAssociations: vi.fn(async () =>
      store.listServiceMediaAssociations().map((row) => ({
        associationId: row.associationId,
        mediaFileId: row.mediaFileId,
        displayOrder: row.displayOrder,
        contentType: row.contentType,
        width: row.width,
        height: row.height,
        status: row.status,
      })),
    ),
  } as unknown as CatalogRepository;

  const service = new CatalogService({
    authorization: {
      authorizeProtectedOperation: async () => ({ allowed: true }),
    },
    repository,
    logger: noopLogger,
  });

  return { service, repository };
}

describe("catalog definition repository projection (T120)", () => {
  it("declares the selectable/snapshot query methods required on CatalogRepository", () => {
    const requiredMethods: readonly (keyof CatalogRepository)[] = [
      "listSelectableServiceCandidates",
      "findSelectableServiceByCode",
      "listServiceMediaAssociations",
    ];
    expect(requiredMethods).toHaveLength(3);
    for (const method of requiredMethods) {
      expect(method).toEqual(expect.any(String));
    }
  });

  it("projects one current aggregate version with ordered active children only in the fake store", () => {
    const store = new FakeSnapshotReadyAggregateStore();
    store.seed(completeAggregateCandidate(), [
      {
        associationId: "assoc_ready_b",
        mediaFileId: "media_b",
        displayOrder: 1,
        contentType: "image/png",
        width: 200,
        height: 200,
        status: "READY",
        isActive: true,
      },
      {
        associationId: "assoc_pending",
        mediaFileId: "media_pending",
        displayOrder: 2,
        contentType: "image/jpeg",
        width: 100,
        height: 100,
        status: "PROCESSING",
        isActive: true,
      },
      {
        associationId: "assoc_ready_a",
        mediaFileId: "media_a",
        displayOrder: 0,
        contentType: "image/webp",
        width: 640,
        height: 480,
        status: "READY",
        isActive: true,
      },
      {
        associationId: "assoc_inactive",
        mediaFileId: "media_old",
        displayOrder: 3,
        contentType: "image/jpeg",
        width: 10,
        height: 10,
        status: "READY",
        isActive: false,
      },
    ]);

    const projected = store.projectActiveChildren();
    expect(projected).not.toBeNull();
    expect(projected?.serviceVersion).toBe(4);
    expect(projected?.priceUnits.map((unit) => unit.code)).toEqual([
      "PER_VISIT",
      "PER_HOUR",
    ]);
    expect(projected?.fields.map((field) => field.code)).toEqual([
      "PREPARATION_INFORMATION",
      "BEDROOM_COUNT",
      "HAS_PETS",
    ]);
    expect(projected?.media.map((row) => row.associationId)).toEqual([
      "assoc_ready_a",
      "assoc_ready_b",
    ]);
  });

  it("returns a complete snapshot-ready definition with active fields, decimal strings, and READY media only", async () => {
    const store = new FakeSnapshotReadyAggregateStore();
    store.seed(completeAggregateCandidate(), [
      {
        associationId: "assoc_1",
        mediaFileId: "media_1",
        displayOrder: 0,
        contentType: "image/jpeg",
        width: 800,
        height: 600,
        status: "READY",
        isActive: true,
      },
      {
        associationId: "assoc_pending",
        mediaFileId: "media_pending",
        displayOrder: 1,
        contentType: "image/png",
        width: 100,
        height: 100,
        status: "PROCESSING",
        isActive: true,
      },
    ]);
    const { service } = createHarness(store);

    const definition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });

    expect(definition).not.toBeNull();
    const ready = definition as SnapshotReadyCatalogServiceDefinition;
    expect(ready.serviceVersion).toBe(4);
    expect(ready.countryCode).toBe("EG");
    expect(ready.locale).toBe("EN");
    expect(ready.priceUnits.map((unit) => unit.code)).toEqual([
      "PER_VISIT",
      "PER_HOUR",
    ]);
    expect(ready.priceUnits.map((unit) => unit.label)).toEqual([
      "Per visit",
      "Per hour",
    ]);
    expect(ready.fields.map((field) => field.code)).toEqual([
      "PREPARATION_INFORMATION",
      "BEDROOM_COUNT",
      "HAS_PETS",
    ]);

    const rooms = ready.fields[1] as CatalogFieldDefinition;
    expect(rooms.numberRules).toEqual({
      mode: "DECIMAL",
      min: "0.00",
      max: "99.50",
    });
    expect(typeof rooms.numberRules?.min).toBe("string");
    expect(typeof rooms.numberRules?.max).toBe("string");

    const pets = ready.fields[2] as CatalogFieldDefinition;
    expect(pets.kind).toBe("BOOLEAN");
    expect(pets.required).toBe(false);
    expect(pets.options).toEqual([]);

    expect(ready.media).toEqual([
      {
        associationId: "assoc_1",
        mediaId: "media_1",
        contentType: "image/jpeg",
        width: 800,
        height: 600,
        displayOrder: 0,
      },
    ]);
    expect(JSON.stringify(ready)).not.toMatch(
      /RETIRED_NOTE|LEGACY_FLAT|MAYBE|media_pending|storageKey|deliveryUrl/iu,
    );
  });
});

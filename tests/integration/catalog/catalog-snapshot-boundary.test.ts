
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogRepository,
  CatalogUnitOfWorkDependencies,
  SelectableServiceCandidateRow,
} from "../../../src/modules/catalog/catalog.repository.js";
import type { SnapshotReadyCatalogServiceDefinition } from "../../../src/modules/catalog/catalog.public.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * T123 — copied snapshot-ready fixture stability and no Booking/provider-price/
 * answer/historical-snapshot persistence (FR-006, FR-015, FR-021, FR-045,
 * FR-046, FR-050).
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

type LiveCatalogState = {
  candidate: SelectableServiceCandidateRow;
  media: {
    readonly associationId: string;
    readonly mediaFileId: string;
    readonly displayOrder: number;
    readonly contentType: "image/jpeg" | "image/png" | "image/webp";
    readonly width: number;
    readonly height: number;
    readonly status: string;
  }[];
};

const persistenceAttempts: string[] = [];

function createLiveState(): LiveCatalogState {
  return {
    candidate: {
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
        version: 5,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        translations: [
          {
            locale: "AR",
            name: "تنظيف منزلي قياسي",
            description: "تنظيف دوري للمنزل.",
          },
          {
            locale: "EN",
            name: "Standard Home Cleaning",
            description: "Routine cleaning for a home.",
          },
        ],
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
        fields: [
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
            numberMode: "INTEGER",
            minValue: "0",
            maxValue: null,
            minSelections: null,
            maxSelections: null,
            displayOrder: 0,
            options: [],
          },
        ],
      },
    },
    media: [
      {
        associationId: "assoc_1",
        mediaFileId: "media_1",
        displayOrder: 0,
        contentType: "image/jpeg",
        width: 800,
        height: 600,
        status: "READY",
      },
    ],
  };
}

function createHarness(live: LiveCatalogState) {
  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {
      booking: {
        create: async () => {
          persistenceAttempts.push("booking.create");
          throw new Error("Booking persistence must not be invoked by Catalog");
        },
      },
      providerPrice: {
        create: async () => {
          persistenceAttempts.push("providerPrice.create");
          throw new Error("Provider price persistence must not be invoked");
        },
      },
      customerAnswer: {
        create: async () => {
          persistenceAttempts.push("customerAnswer.create");
          throw new Error("Customer answer persistence must not be invoked");
        },
      },
      catalogHistoricalSnapshot: {
        create: async () => {
          persistenceAttempts.push("catalogHistoricalSnapshot.create");
          throw new Error("Historical snapshot persistence must not be invoked");
        },
      },
    } as unknown as CatalogUnitOfWorkDependencies["tx"],
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
    findSelectableServiceByCode: vi.fn(async () => live.candidate),
    listServiceMediaAssociations: vi.fn(async () => live.media),
  } as unknown as CatalogRepository;

  const service = new CatalogService({
    authorization: {
      authorizeProtectedOperation: async () => ({ allowed: true }),
    },
    repository,
    logger: noopLogger,
  });

  return { service, repository, uowDeps };
}

describe("catalog snapshot boundary (T123)", () => {
  it("preserves a copied plain definition after later live Catalog mutation", async () => {
    persistenceAttempts.length = 0;
    const live = createLiveState();
    const { service } = createHarness(live);

    const definition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });
    expect(definition).not.toBeNull();

    const copied: SnapshotReadyCatalogServiceDefinition = structuredClone(
      definition as SnapshotReadyCatalogServiceDefinition,
    );
    expect(copied.fields.length).toBeGreaterThan(0);
    expect(copied.fields[0]?.code).toBe("BEDROOM_COUNT");
    expect(copied.media[0]?.mediaId).toBe("media_1");

    live.candidate = {
      ...live.candidate,
      service: {
        ...live.candidate.service,
        version: 99,
        translations: [
          {
            locale: "AR",
            name: "اسم جديد",
            description: "وصف جديد",
          },
          {
            locale: "EN",
            name: "Renamed Live Service",
            description: "Live catalog changed after copy.",
          },
        ],
        fields: [],
        priceUnits: [
          {
            id: "pu_new",
            code: "PER_HOUR",
            labelAr: "لكل ساعة",
            labelEn: "Per hour",
            displayOrder: 0,
            isActive: true,
          },
        ],
      },
    };
    live.media = [];

    const later = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });

    expect(copied.serviceVersion).toBe(5);
    expect(copied.name).toBe("Standard Home Cleaning");
    expect(copied.fields.map((field) => field.code)).toEqual(["BEDROOM_COUNT"]);
    expect(copied.priceUnits.map((unit) => unit.code)).toEqual(["PER_VISIT"]);
    expect(copied.media.map((row) => row.mediaId)).toEqual(["media_1"]);

    expect(later?.serviceVersion).toBe(99);
    expect(later?.name).toBe("Renamed Live Service");
    expect(copied).not.toEqual(later);
  });

  it("creates no Booking, provider-price, customer-answer, or historical snapshot records", async () => {
    persistenceAttempts.length = 0;
    const live = createLiveState();
    const { service, uowDeps } = createHarness(live);

    await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });

    expect(persistenceAttempts).toEqual([]);
    expect(uowDeps.tx).toBeTruthy();
    expect(JSON.stringify(await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    }))).not.toMatch(/bookingId|providerPrice|customerAnswer|historicalSnapshot/iu);
  });
});

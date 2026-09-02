
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogRepository,
  CatalogUnitOfWorkDependencies,
  SelectableServiceCandidateRow,
} from "../../../src/modules/catalog/catalog.repository.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * T121 — snapshot-ready read consistency under concurrent mutation
 * (FR-034, FR-044, SC-009). Fake/transaction-seam only.
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

type MediaAssociation = {
  readonly associationId: string;
  readonly mediaFileId: string;
  readonly displayOrder: number;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly width: number;
  readonly height: number;
  readonly status: string;
};

/**
 * Transaction seam that can mutate child/media facts between aggregate and
 * association reads unless the reader loads one locked aggregate revision.
 */
class ConcurrentDefinitionSeam {
  private version = 1;
  private fields: SelectableServiceCandidateRow["service"]["fields"] = [
    {
      id: "field_v1",
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
  ];
  private media: MediaAssociation[] = [
    {
      associationId: "assoc_v1",
      mediaFileId: "media_v1",
      displayOrder: 0,
      contentType: "image/jpeg",
      width: 400,
      height: 300,
      status: "READY",
    },
  ];
  private mutateAfterAggregateRead = false;
  private snapshotFrozen = false;
  private snapshotVersion = 1;
  private snapshotFields: SelectableServiceCandidateRow["service"]["fields"] = [];
  private snapshotMedia: MediaAssociation[] = [];
  readonly readTrace: string[] = [];

  enableInterleavedMutation(): void {
    this.mutateAfterAggregateRead = true;
  }

  beginReadSnapshot(): void {
    this.snapshotFrozen = true;
    this.snapshotVersion = this.version;
    this.snapshotFields = this.fields.map((field) => ({
      ...field,
      options: field.options.slice(),
    }));
    this.snapshotMedia = this.media.slice();
  }

  private applyConcurrentMutation(): void {
    this.version = 2;
    this.fields = [
      ...this.fields,
      {
        id: "field_v2",
        code: "SPECIAL_INSTRUCTIONS",
        kind: "TEXT",
        labelAr: "تعليمات خاصة",
        labelEn: "Special instructions",
        helpTextAr: null,
        helpTextEn: null,
        isRequired: false,
        isActive: true,
        minLength: null,
        maxLength: 1000,
        numberMode: null,
        minValue: null,
        maxValue: null,
        minSelections: null,
        maxSelections: null,
        displayOrder: 1,
        options: [],
      },
    ];
    this.media = [
      ...this.media,
      {
        associationId: "assoc_v2",
        mediaFileId: "media_v2",
        displayOrder: 1,
        contentType: "image/png",
        width: 200,
        height: 200,
        status: "READY",
      },
    ];
  }

  findSelectableServiceByCode(): SelectableServiceCandidateRow {
    const version = this.snapshotFrozen ? this.snapshotVersion : this.version;
    const fields = this.snapshotFrozen
      ? this.snapshotFields
      : this.fields.map((field) => ({
          ...field,
          options: field.options.slice(),
        }));
    this.readTrace.push(`aggregate:v${version}`);
    if (!this.snapshotFrozen) {
      const snapshotFields = fields;
      if (this.mutateAfterAggregateRead) {
        this.applyConcurrentMutation();
      }
      return this.buildCandidate(version, snapshotFields);
    }
    if (this.mutateAfterAggregateRead) {
      this.applyConcurrentMutation();
    }
    return this.buildCandidate(version, fields);
  }

  listServiceMediaAssociations(): readonly MediaAssociation[] {
    const version = this.snapshotFrozen ? this.snapshotVersion : this.version;
    this.readTrace.push(`media:v${version}`);
    return this.snapshotFrozen ? this.snapshotMedia.slice() : this.media.slice();
  }

  private buildCandidate(
    version: number,
    fields: SelectableServiceCandidateRow["service"]["fields"],
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
        version,
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
        fields,
      },
    };
  }
}

function createHarness(seam: ConcurrentDefinitionSeam) {
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
      runInTransaction: vi.fn(
        async <T>(work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>) =>
          work(uowDeps),
      ),
      runInReadSnapshot: vi.fn(
        async <T>(work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>) => {
          seam.beginReadSnapshot();
          return work(uowDeps);
        },
      ),
    },
    findSelectableServiceByCode: vi.fn(async () =>
      seam.findSelectableServiceByCode(),
    ),
    listServiceMediaAssociations: vi.fn(async () =>
      seam.listServiceMediaAssociations(),
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

describe("catalog definition concurrency (T121)", () => {
  it("never combines an older aggregate version with newer child/association facts", async () => {
    const seam = new ConcurrentDefinitionSeam();
    seam.enableInterleavedMutation();
    const { service } = createHarness(seam);

    const definition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });

    expect(definition).not.toBeNull();
    expect(seam.readTrace.length).toBeGreaterThanOrEqual(1);

    const mediaIds = definition?.media.map((row: { mediaId: string }) => row.mediaId) ?? [];
    const fieldCodes =
      definition?.fields.map((field: { code: string }) => field.code) ?? [];
    const mixedOldAggregateNewChildren =
      definition?.serviceVersion === 1 &&
      (mediaIds.includes("media_v2") || fieldCodes.includes("SPECIAL_INSTRUCTIONS"));
    const mixedNewAggregateOldChildren =
      definition?.serviceVersion === 2 &&
      mediaIds.length === 1 &&
      mediaIds[0] === "media_v1" &&
      fieldCodes.length === 1 &&
      fieldCodes[0] === "BEDROOM_COUNT";

    expect(mixedOldAggregateNewChildren).toBe(false);
    expect(mixedNewAggregateOldChildren).toBe(false);

    if (definition?.serviceVersion === 1) {
      expect(fieldCodes).toEqual(["BEDROOM_COUNT"]);
      expect(mediaIds).toEqual(["media_v1"]);
    } else {
      expect(definition?.serviceVersion).toBe(2);
      expect(fieldCodes).toEqual(["BEDROOM_COUNT", "SPECIAL_INSTRUCTIONS"]);
      expect(mediaIds).toEqual(["media_v1", "media_v2"]);
    }
  });

  it("keeps definition reads inside one unit-of-work read snapshot seam", async () => {
    const seam = new ConcurrentDefinitionSeam();
    const { service, repository } = createHarness(seam);

    await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });

    expect(repository.unitOfWork.runInReadSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.findSelectableServiceByCode).toHaveBeenCalled();
    expect(repository.listServiceMediaAssociations).toHaveBeenCalled();
  });
});

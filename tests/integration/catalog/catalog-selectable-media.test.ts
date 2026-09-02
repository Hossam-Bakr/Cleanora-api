
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogRepository,
  CatalogUnitOfWorkDependencies,
  SelectableServiceCandidateRow,
} from "../../../src/modules/catalog/catalog.repository.js";
import type {
  CatalogMediaReference,
  SnapshotReadyCatalogServiceDefinition,
} from "../../../src/modules/catalog/catalog.public.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * T105 — internal selectable / snapshot-ready media references redact uploader,
 * storage key, provider payload, and private URL (FR-036, FR-039–FR-044).
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

type CatalogMediaReaderService = CatalogService & {
  toSelectableMediaReferences(
    rows: readonly {
      readonly associationId: string;
      readonly mediaFileId: string;
      readonly displayOrder: number;
      readonly contentType: "image/jpeg" | "image/png" | "image/webp";
      readonly width: number;
      readonly height: number;
      readonly status: string;
      readonly ownerUserId?: string;
      readonly storageKey?: string;
      readonly providerPayload?: unknown;
      readonly privateUrl?: string;
    }[],
  ): CatalogMediaReference[];
  getSnapshotReadyDefinition(input: {
    readonly serviceCode: string;
    readonly countryCode: string;
    readonly locale: "AR" | "EN";
  }): Promise<SnapshotReadyCatalogServiceDefinition | null>;
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

function selectableCandidate(): SelectableServiceCandidateRow {
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
      version: 2,
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
      fields: [],
    },
  };
}

describe("catalog selectable media references (T105)", () => {
  it("maps READY associations to stable CatalogMediaReference values without delivery URLs", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: noopLogger,
    }) as CatalogMediaReaderService;

    const references = service.toSelectableMediaReferences([
      {
        associationId: "assoc_1",
        mediaFileId: "media_1",
        displayOrder: 0,
        contentType: "image/webp",
        width: 640,
        height: 480,
        status: "READY",
        ownerUserId: "staff_uploader_secret",
        storageKey: "cloudinary/private/secret-key",
        providerPayload: { api_secret: "x", public_id: "secret" },
        privateUrl: "https://res.cloudinary.com/demo/private/secret",
      },
      {
        associationId: "assoc_pending",
        mediaFileId: "media_pending",
        displayOrder: 1,
        contentType: "image/png",
        width: 100,
        height: 100,
        status: "PROCESSING",
        ownerUserId: "staff_uploader_secret",
        storageKey: "cloudinary/private/pending-key",
      },
    ]);

    expect(references).toEqual<CatalogMediaReference[]>([
      {
        associationId: "assoc_1",
        mediaId: "media_1",
        contentType: "image/webp",
        width: 640,
        height: 480,
        displayOrder: 0,
      },
    ]);
    expect(JSON.stringify(references)).not.toMatch(
      /storageKey|ownerUserId|uploader|api_secret|privateUrl|https?:\/\/res\.cloudinary/iu,
    );
  });

  it("returns snapshot-ready media as stable references, never signed delivery URLs", async () => {
    const candidate = selectableCandidate();
    const listMedia = vi.fn(async () => [
      {
        associationId: "assoc_1",
        mediaFileId: "media_1",
        displayOrder: 0,
        contentType: "image/jpeg" as const,
        width: 800,
        height: 600,
        status: "READY" as const,
        ownerUserId: "staff_uploader_secret",
        storageKey: "should-not-leak",
      },
    ]);

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
      findSelectableServiceByCode: vi.fn(async () => candidate),
      listServiceMediaAssociations: listMedia,
    } as unknown as CatalogRepository;

    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository,
      logger: noopLogger,
    }) as CatalogMediaReaderService;

    const definition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });

    expect(definition).not.toBeNull();
    expect(definition?.media).toEqual([
      {
        associationId: "assoc_1",
        mediaId: "media_1",
        contentType: "image/jpeg",
        width: 800,
        height: 600,
        displayOrder: 0,
      },
    ]);
    expect(JSON.stringify(definition)).not.toMatch(
      /deliveryUrl|signed|storageKey|ownerUserId|uploader|should-not-leak/iu,
    );
  });
});

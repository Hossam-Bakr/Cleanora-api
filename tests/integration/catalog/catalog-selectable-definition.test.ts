import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { NextFunction, Request, Response } from "express";

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
import { createCatalogRouter } from "../../../src/modules/catalog/catalog.routes.js";
import { buildImplementedR1P08SwaggerFragments } from "../../../src/swagger/r1-p08-openapi.paths.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * T122 — exact-locale/country selectable and snapshot-ready internal reader
 * behavior (FR-008–FR-012, FR-022–FR-026, FR-042–FR-044). No HTTP requests.
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

function baseCandidate(
  overrides: {
    readonly countryAvailabilityIsAvailable?: boolean;
    readonly category?: Partial<SelectableServiceCandidateRow["category"]>;
    readonly service?: Partial<SelectableServiceCandidateRow["service"]>;
  } = {},
): SelectableServiceCandidateRow {
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
      ...overrides.category,
    },
    countryAvailabilityIsAvailable:
      overrides.countryAvailabilityIsAvailable ?? true,
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
          id: "pu_visit",
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: "Per visit",
          displayOrder: 0,
          isActive: true,
        },
        {
          id: "pu_hour",
          code: "PER_HOUR",
          labelAr: "لكل ساعة",
          labelEn: "Per hour",
          displayOrder: 1,
          isActive: true,
        },
      ],
      fields: [
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
          maxValue: "12.50",
          minSelections: null,
          maxSelections: null,
          displayOrder: 1,
          options: [],
        },
        {
          id: "field_inactive",
          code: "RETIRED",
          kind: "TEXT",
          labelAr: "قديم",
          labelEn: "Retired",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: false,
          minLength: null,
          maxLength: 10,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 8,
          options: [],
        },
      ],
      ...overrides.service,
    },
  };
}

function createHarness(options: {
  readonly candidates?: readonly SelectableServiceCandidateRow[];
  readonly findCandidate?: SelectableServiceCandidateRow | null;
  readonly media?: readonly {
    readonly associationId: string;
    readonly mediaFileId: string;
    readonly displayOrder: number;
    readonly contentType: "image/jpeg" | "image/png" | "image/webp";
    readonly width: number;
    readonly height: number;
    readonly status: string;
  }[];
  readonly listPage?: (input: {
    readonly cursor?: string | undefined;
    readonly limit?: number | undefined;
  }) => {
    readonly items: readonly SelectableServiceCandidateRow[];
    readonly nextCursor: string | null;
  };
  readonly countryCode?: string;
}) {
  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {} as CatalogUnitOfWorkDependencies["tx"],
    activeCountryReader: {
      resolveActiveCountry: async (code: string) => {
        if (code !== (options.countryCode ?? "EG")) {
          throw new Error(`inactive or unknown country: ${code}`);
        }
        return {
          id: "country_eg",
          code: options.countryCode ?? "EG",
        };
      },
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
    listSelectableServiceCandidates: vi.fn(
      async (
        _tx: unknown,
        input: {
          readonly cursor?: string | undefined;
          readonly limit?: number | undefined;
        },
      ) => {
        if (options.listPage !== undefined) {
          return options.listPage(input);
        }
        const items = options.candidates ?? [];
        const limit = input.limit ?? 50;
        return {
          items: items.slice(0, limit),
          nextCursor: items.length > limit ? items[limit - 1]?.service.id ?? null : null,
        };
      },
    ),
    findSelectableServiceByCode: vi.fn(async () => options.findCandidate ?? null),
    listServiceMediaAssociations: vi.fn(async () => options.media ?? []),
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

describe("catalog selectable definition reader (T122)", () => {
  it("returns exact AR and EN content without cross-locale or code fallback", async () => {
    const candidate = baseCandidate();
    const { service } = createHarness({
      candidates: [candidate],
      findCandidate: candidate,
      media: [],
    });

    const enList = await service.listSelectable({
      countryCode: "EG",
      locale: "EN",
    });
    const arList = await service.listSelectable({
      countryCode: "EG",
      locale: "AR",
    });
    expect(enList.items[0]?.name).toBe("Standard Home Cleaning");
    expect(arList.items[0]?.name).toBe("تنظيف منزلي قياسي");
    expect(enList.items[0]?.name).not.toBe(arList.items[0]?.name);

    const enDefinition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });
    expect(enDefinition).not.toBeNull();
    expect(enDefinition?.name).toBe("Standard Home Cleaning");
    expect(enDefinition?.category.name).toBe("Home Cleaning");
    for (const unit of enDefinition?.priceUnits ?? []) {
      expect(unit.label).not.toMatch(/لكل|PER_/u);
      expect(unit.label).toMatch(/Per /u);
    }
    expect(enDefinition?.priceUnits.map((unit) => unit.code)).toEqual([
      "PER_VISIT",
      "PER_HOUR",
    ]);

    const arDefinition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "AR",
    });
    expect(arDefinition?.name).toBe("تنظيف منزلي قياسي");
    expect(arDefinition?.category.name).toBe("تنظيف المنازل");
  });

  it("omits the entire service when any active price unit lacks bilingual labels (DEC-041)", async () => {
    const candidate = baseCandidate({
      service: {
        priceUnits: [
          {
            id: "pu_complete",
            code: "PER_VISIT",
            labelAr: "لكل زيارة",
            labelEn: "Per visit",
            displayOrder: 0,
            isActive: true,
          },
          {
            id: "pu_ar_only",
            code: "PER_HOUR",
            labelAr: "لكل ساعة",
            labelEn: null,
            displayOrder: 1,
            isActive: true,
          },
        ],
      },
    });
    const { service } = createHarness({
      candidates: [candidate],
      findCandidate: candidate,
      media: [],
    });

    const enList = await service.listSelectable({
      countryCode: "EG",
      locale: "EN",
    });
    const arList = await service.listSelectable({
      countryCode: "EG",
      locale: "AR",
    });
    expect(enList.items).toEqual([]);
    expect(arList.items).toEqual([]);

    const enDefinition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });
    const arDefinition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "AR",
    });
    expect(enDefinition).toBeNull();
    expect(arDefinition).toBeNull();
    expect(JSON.stringify(enDefinition)).not.toMatch(/لكل ساعة|PER_HOUR/u);
  });

  it("fails safely when an active category is missing the requested locale content", async () => {
    const missingEnCategory = baseCandidate({
      category: {
        nameEn: null,
        descriptionEn: null,
      },
    });
    const missingArCategory = baseCandidate({
      category: {
        id: "cat_missing_ar",
        code: "HOME_CLEANING_AR_GAP",
        nameAr: null,
        descriptionAr: null,
      },
      service: {
        id: "svc_missing_ar_category",
        code: "STANDARD_HOME_CLEANING_AR_GAP",
        categoryId: "cat_missing_ar",
      },
    });

    const { service: enGapService } = createHarness({
      candidates: [missingEnCategory],
      findCandidate: missingEnCategory,
      media: [],
    });
    const enList = await enGapService.listSelectable({
      countryCode: "EG",
      locale: "EN",
    });
    const enDefinition = await enGapService.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });
    expect(enList.items).toEqual([]);
    expect(enDefinition).toBeNull();
    expect(JSON.stringify(enList)).not.toMatch(/Home Cleaning|تنظيف المنازل/u);
    expect(JSON.stringify(enDefinition)).not.toMatch(/Home Cleaning|تنظيف المنازل/u);

    // AR request still succeeds when only EN category content is missing.
    const arListWithEnGap = await enGapService.listSelectable({
      countryCode: "EG",
      locale: "AR",
    });
    expect(arListWithEnGap.items).toHaveLength(1);
    expect(arListWithEnGap.items[0]?.categoryName).toBe("تنظيف المنازل");

    const { service: arGapService } = createHarness({
      candidates: [missingArCategory],
      findCandidate: missingArCategory,
      media: [],
    });
    const arList = await arGapService.listSelectable({
      countryCode: "EG",
      locale: "AR",
    });
    const arDefinition = await arGapService.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING_AR_GAP",
      countryCode: "EG",
      locale: "AR",
    });
    expect(arList.items).toEqual([]);
    expect(arDefinition).toBeNull();
    expect(JSON.stringify(arList)).not.toMatch(/Home Cleaning|تنظيف المنازل/u);
    expect(JSON.stringify(arDefinition)).not.toMatch(/Home Cleaning|تنظيف المنازل/u);
  });

  it("omits inactive, unavailable, and draft services for active EG only", async () => {
    const selectable = baseCandidate();
    const inactiveService = baseCandidate({
      service: { id: "svc_inactive", code: "INACTIVE_SERVICE", isActive: false },
    });
    const unavailable = baseCandidate({
      service: { id: "svc_unavail", code: "UNAVAILABLE_SERVICE" },
      countryAvailabilityIsAvailable: false,
    });
    const draftMissingEn = baseCandidate({
      service: {
        id: "svc_draft",
        code: "DRAFT_SERVICE",
        translations: [
          {
            locale: "AR",
            name: "مسودة",
            description: "وصف المسودة",
          },
          {
            locale: "EN",
            name: null,
            description: null,
          },
        ],
      },
    });

    const { service } = createHarness({
      candidates: [selectable, inactiveService, unavailable, draftMissingEn],
      findCandidate: unavailable,
      media: [],
    });

    const listed = await service.listSelectable({
      countryCode: "EG",
      locale: "EN",
    });
    expect(listed.items.map((item) => item.serviceCode)).toEqual([
      "STANDARD_HOME_CLEANING",
    ]);

    const denied = await service.getSnapshotReadyDefinition({
      serviceCode: "UNAVAILABLE_SERVICE",
      countryCode: "EG",
      locale: "EN",
    });
    expect(denied).toBeNull();
  });

  it("applies stable deterministic ordering and bounded pagination without duplicates", async () => {
    const pageOne = [
      baseCandidate({
        service: { id: "svc_a", code: "SERVICE_A", displayOrder: 0 },
      }),
      baseCandidate({
        service: { id: "svc_b", code: "SERVICE_B", displayOrder: 1 },
      }),
    ];
    const pageTwo = [
      baseCandidate({
        service: { id: "svc_c", code: "SERVICE_C", displayOrder: 2 },
      }),
    ];

    const { service, repository } = createHarness({
      listPage: (input) => {
        if (input.cursor === "svc_b") {
          return { items: pageTwo, nextCursor: null };
        }
        const limit = input.limit ?? 50;
        expect(limit).toBeLessThanOrEqual(50);
        return { items: pageOne.slice(0, limit), nextCursor: "svc_b" };
      },
    });

    const first = await service.listSelectable({
      countryCode: "EG",
      locale: "EN",
      limit: 2,
    });
    const second = await service.listSelectable({
      countryCode: "EG",
      locale: "EN",
      ...(first.nextCursor === null ? {} : { cursor: first.nextCursor }),
      limit: 2,
    });

    const codes = [
      ...first.items.map((item) => item.serviceCode),
      ...second.items.map((item) => item.serviceCode),
    ];
    expect(codes).toEqual(["SERVICE_A", "SERVICE_B", "SERVICE_C"]);
    expect(new Set(codes).size).toBe(codes.length);
    expect(first.items.map((item) => item.displayOrder)).toEqual([0, 1]);
    expect(repository.listSelectableServiceCandidates).toHaveBeenCalled();
  });

  it("returns full active price-unit/field/option DTOs and READY Media references only", async () => {
    const candidate = baseCandidate();
    const { service } = createHarness({
      findCandidate: candidate,
      media: [
        {
          associationId: "assoc_ready",
          mediaFileId: "media_ready",
          displayOrder: 0,
          contentType: "image/webp",
          width: 640,
          height: 480,
          status: "READY",
        },
        {
          associationId: "assoc_failed",
          mediaFileId: "media_failed",
          displayOrder: 1,
          contentType: "image/png",
          width: 10,
          height: 10,
          status: "FAILED",
        },
      ],
    });

    const definition = await service.getSnapshotReadyDefinition({
      serviceCode: "STANDARD_HOME_CLEANING",
      countryCode: "EG",
      locale: "EN",
    });

    expect(definition).not.toBeNull();
    const ready = definition as SnapshotReadyCatalogServiceDefinition;
    expect(ready.priceUnits).toEqual([
      {
        id: "pu_visit",
        code: "PER_VISIT",
        label: "Per visit",
        displayOrder: 0,
      },
      {
        id: "pu_hour",
        code: "PER_HOUR",
        label: "Per hour",
        displayOrder: 1,
      },
    ]);
    expect(ready.fields.map((field) => field.code)).toEqual([
      "PREPARATION_INFORMATION",
      "BEDROOM_COUNT",
    ]);
    const rooms = ready.fields[1] as CatalogFieldDefinition;
    expect(rooms.numberRules).toEqual({
      mode: "DECIMAL",
      min: "0.00",
      max: "12.50",
    });
    expect(ready.media).toEqual([
      {
        associationId: "assoc_ready",
        mediaId: "media_ready",
        contentType: "image/webp",
        width: 640,
        height: 480,
        displayOrder: 0,
      },
    ]);
    expect(JSON.stringify(ready)).not.toMatch(
      /RETIRED|media_failed|deliveryUrl|storageKey|uploader/iu,
    );
  });

  it("does not mount or document an anonymous/customer /api/v1/catalog/services Browse surface", () => {
    const authenticateAccess = (
      _req: Request,
      _res: Response,
      next: NextFunction,
    ): void => {
      next();
    };
    const router = createCatalogRouter({
      authenticateAccess,
      catalogService: {
        listSelectable: vi.fn(),
        getSnapshotReadyDefinition: vi.fn(),
      } as unknown as CatalogService,
    });
    const stack = (
      router as unknown as {
        readonly stack: readonly {
          readonly route?: { readonly path: string };
        }[];
      }
    ).stack;
    const paths = stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => typeof path === "string");
    expect(paths.some((path) => path.startsWith("/services"))).toBe(true);

    const routesSource = readFileSync(
      join(process.cwd(), "src", "routes", "index.ts"),
      "utf8",
    );
    expect(routesSource).toMatch(/\$\{apiPrefix\}\/staff\/catalog/u);
    expect(routesSource).not.toMatch(/\$\{apiPrefix\}\/catalog(?:\/|"|'|`)/u);

    const openapi = buildImplementedR1P08SwaggerFragments();
    expect(Object.keys(openapi.paths)).not.toContain("/api/v1/catalog/services");
    expect(Object.keys(openapi.paths)).not.toContain("/catalog/services");
    expect(
      Object.keys(openapi.paths).every((path) => path.startsWith("/staff/catalog")),
    ).toBe(true);
  });
});

import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { createCatalogRouter } from "../../../src/modules/catalog/catalog.routes.js";
import type { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import {
  R1_P08_OPENAPI_OPERATIONS,
  R1_P08_RUNTIME_HAS_NO_ANONYMOUS_BROWSE,
} from "../../../src/swagger/r1-p08-openapi.paths.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

vi.setConfig({ testTimeout: 180_000 });

const liveUrl = process.env["CLEANORA_R1_P08_DATABASE_URL"];
const hasApprovedLiveTarget =
  typeof liveUrl === "string" &&
  liveUrl.length > 0 &&
  /\/cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)(?:\?|$)/u.test(liveUrl);

const commandBase = {
  idempotencyKey: "00000000-0000-4000-8000-000000000301",
  reasonCode: "catalog_management_change" as const,
};

const category = {
  id: "cat_active_1",
  code: "HOME_CLEANING",
  nameAr: "تنظيف المنازل",
  nameEn: "Home Cleaning",
  descriptionAr: "وصف",
  descriptionEn: "Description",
  displayOrder: 0,
  isActive: true,
  version: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const service = {
  id: "svc_active_1",
  categoryId: "cat_active_1",
  code: "STANDARD_HOME_CLEANING",
  displayOrder: 0,
  isActive: true,
  version: 3,
  translations: [
    { locale: "EN" as const, name: "Standard Home Cleaning", description: "Routine." },
    { locale: "AR" as const, name: "تنظيف", description: "وصف." },
  ],
  priceUnits: [],
  fields: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createHarness(overrides?: Partial<CatalogService>) {
  const catalogService = {
    replaceCategoryOrder: vi.fn(async () => ({
      categories: [category],
      replayed: false,
    })),
    replaceServiceOrder: vi.fn(async () => ({
      services: [service],
      replayed: false,
    })),
    replaceServiceAvailability: vi.fn(async () => ({
      service,
      replayed: false,
    })),
    changeCategoryLifecycle: vi.fn(async () => ({
      category: { ...category, isActive: false },
      replayed: false,
    })),
    changeServiceLifecycle: vi.fn(async () => ({
      service: { ...service, isActive: false },
      replayed: false,
    })),
    listSelectable: vi.fn(async () => ({ items: [], nextCursor: null })),
    ...overrides,
  } as unknown as CatalogService;

  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = {
      userId: "staff_admin_1",
      sessionId: "session_1",
      status: "ACTIVE",
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: ["INDIVIDUAL"],
      pendingCategories: [],
      verificationOnly: false,
    };
    next();
  };

  const router = createCatalogRouter({
    authenticateAccess,
    catalogService,
  });
  const app = createTestApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
    mountTestRoutes(application) {
      application.use("/api/v1/staff/catalog", router);
    },
  });

  return { app, catalogService };
}

/**
 * US3 protected lifecycle/order/availability HTTP contracts (FR-022–FR-029,
 * FR-036–FR-037, FR-050, SC-001, SC-004).
 */
describe("catalog availability lifecycle HTTP contracts", () => {
  it("documents US3 operations without anonymous Browse parity", () => {
    expect(R1_P08_RUNTIME_HAS_NO_ANONYMOUS_BROWSE).toBe(true);
    expect(R1_P08_OPENAPI_OPERATIONS).toEqual(
      expect.arrayContaining([
        "replaceCatalogCategoryOrder",
        "replaceCatalogServiceOrder",
        "replaceCatalogServiceAvailability",
      ]),
    );
    expect(R1_P08_OPENAPI_OPERATIONS).not.toContain("browseCatalogServices");
  });

  it("mounts protected category/service order and availability routes", async () => {
    const { app, catalogService } = createHarness();

    const categoryOrder = await request(app)
      .put("/api/v1/staff/catalog/categories/order")
      .send({
        ...commandBase,
        items: [{ id: "cat_active_1", expectedVersion: 2 }],
      });
    const serviceOrder = await request(app)
      .put("/api/v1/staff/catalog/services/order")
      .send({
        ...commandBase,
        idempotencyKey: "00000000-0000-4000-8000-000000000302",
        categoryId: "cat_active_1",
        items: [{ id: "svc_active_1", expectedVersion: 3 }],
      });
    const availability = await request(app)
      .put("/api/v1/staff/catalog/services/svc_active_1/availability")
      .send({
        ...commandBase,
        idempotencyKey: "00000000-0000-4000-8000-000000000303",
        expectedVersion: 3,
        countries: [{ countryCode: "EG", isAvailable: true }],
      });

    expect(categoryOrder.status).toBe(200);
    expect(serviceOrder.status).toBe(200);
    expect(availability.status).toBe(200);
    expect(catalogService.replaceCategoryOrder).toHaveBeenCalled();
    expect(catalogService.replaceServiceOrder).toHaveBeenCalled();
    expect(catalogService.replaceServiceAvailability).toHaveBeenCalled();
  });

  it("returns standard success envelopes for lifecycle and order commands", async () => {
    const { app } = createHarness();

    const categoryLifecycle = await request(app)
      .post("/api/v1/staff/catalog/categories/cat_active_1/lifecycle")
      .send({
        ...commandBase,
        idempotencyKey: "00000000-0000-4000-8000-000000000304",
        expectedVersion: 2,
        action: "DEACTIVATE",
      });
    const serviceLifecycle = await request(app)
      .post("/api/v1/staff/catalog/services/svc_active_1/lifecycle")
      .send({
        ...commandBase,
        idempotencyKey: "00000000-0000-4000-8000-000000000305",
        expectedVersion: 3,
        action: "DEACTIVATE",
      });

    expect(categoryLifecycle.status).toBe(200);
    expect(categoryLifecycle.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: "cat_active_1", isActive: false }),
        requestId: expect.any(String),
      }),
    );
    expect(serviceLifecycle.status).toBe(200);
    expect(serviceLifecycle.body.success).toBe(true);
  });

  it("maps availability country validation failures into safe envelopes", async () => {
    const { app } = createHarness({
      replaceServiceAvailability: vi.fn(async () => {
        throw new CatalogError(
          "CATALOG_COUNTRY_UNAVAILABLE",
          "Catalog country is unavailable for availability operations",
        );
      }),
    } as Partial<CatalogService>);

    const response = await request(app)
      .put("/api/v1/staff/catalog/services/svc_active_1/availability")
      .send({
        ...commandBase,
        expectedVersion: 3,
        countries: [{ countryCode: "ZZ", isAvailable: true }],
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body.success).toBe(false);
    expect(JSON.stringify(response.body)).not.toMatch(/stack|prisma|SELECT/iu);
  });

  it("rejects duplicate country codes at the schema boundary before replaceServiceAvailability", async () => {
    const { app, catalogService } = createHarness();

    const response = await request(app)
      .put("/api/v1/staff/catalog/services/svc_active_1/availability")
      .send({
        ...commandBase,
        expectedVersion: 3,
        countries: [
          { countryCode: "EG", isAvailable: true },
          { countryCode: "EG", isAvailable: false },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(catalogService.replaceServiceAvailability).not.toHaveBeenCalled();
  });

  it("does not expose anonymous or customer Browse catalog routes", async () => {
    const { app } = createHarness();
    const browse = await request(app).get("/api/v1/catalog/services");
    expect(browse.status).toBe(404);
    const anonymousCategories = await request(app).get("/api/v1/catalog/categories");
    expect(anonymousCategories.status).toBe(404);
  });

  it.skipIf(!hasApprovedLiveTarget)(
    "runs live staff lifecycle/order/availability journeys against approved disposable DB",
    async () => {
      const {
        cleanupCatalogTestRows,
        createConnectedMigrationProofCatalogClient,
        createLiveCatalogHttpApp,
        ensureR1P08CatalogSeeded,
        ensureR1P08CatalogDatabaseMigrated,
        LIVE_CATALOG_TRANSACTION_OPTIONS,
        requireR1P08CatalogDatabaseUrl,
      } = await import("../../helpers/r1-p08-catalog-live.js");
      const request = (await import("supertest")).default;
      const connectionString = requireR1P08CatalogDatabaseUrl();
      await ensureR1P08CatalogDatabaseMigrated(connectionString);
      const prisma = await createConnectedMigrationProofCatalogClient(connectionString);
      const prefix = `liveus3${process.pid}${Date.now()}`;
      const actorUserId = `${prefix}-staff`;
      const suffix = String(Date.now()).slice(-8);

      try {
        await ensureR1P08CatalogSeeded(prisma);
        const { category, service } = await prisma.$transaction(async (tx) => {
          const highestOrder = await tx.serviceCategory.aggregate({
            _max: { displayOrder: true },
          });
          const createdCategory = await tx.serviceCategory.create({
            data: {
              id: `${prefix}-category`,
              code: `LIVE_US3_CAT_${suffix}`,
              nameAr: "فئة دورة حياة",
              nameEn: "Lifecycle category",
              descriptionAr: "اختبار حي",
              descriptionEn: "Live test",
              displayOrder: (highestOrder._max.displayOrder ?? -1) + 1,
              isActive: true,
              version: 1,
            },
          });
          const createdService = await tx.service.create({
            data: {
              id: `${prefix}-service`,
              categoryId: createdCategory.id,
              code: `LIVE_US3_SVC_${suffix}`,
              displayOrder: 0,
              isActive: true,
              version: 1,
              translations: {
                create: [
                  { locale: "AR", name: "خدمة", description: "وصف" },
                  { locale: "EN", name: "Service", description: "Description" },
                ],
              },
            },
          });
          return { category: createdCategory, service: createdService };
        }, LIVE_CATALOG_TRANSACTION_OPTIONS);
        const app = createLiveCatalogHttpApp(prisma, actorUserId);

        const lifecycle = await request(app)
          .post(`/api/v1/staff/catalog/categories/${category.id}/lifecycle`)
          .send({
            idempotencyKey: randomUUID(),
            reasonCode: "catalog_management_change",
            expectedVersion: category.version,
            action: "DEACTIVATE",
          });
        expect(lifecycle.status).toBe(200);
        expect(lifecycle.body.data.isActive).toBe(false);

        const serviceAfterLifecycle = await prisma.service.findFirstOrThrow({
          where: { id: service.id },
          select: { version: true },
        });

        const availability = await request(app)
          .put(`/api/v1/staff/catalog/services/${service.id}/availability`)
          .send({
            idempotencyKey: randomUUID(),
            reasonCode: "catalog_management_change",
            expectedVersion: serviceAfterLifecycle.version,
            countries: [{ countryCode: "EG", isAvailable: true }],
          });
        expect(availability.status).toBe(200);
        expect(availability.body.success).toBe(true);
      } finally {
        try {
          await cleanupCatalogTestRows(prisma, {
            actorUserIdPrefix: "liveus3",
            recordIdPrefix: prefix,
            categoryCodePrefix: "LIVE_US3_CAT_",
            serviceCodePrefix: "LIVE_US3_SVC_",
          });
        } finally {
          await prisma.$disconnect();
        }
      }
    },
  );
});

import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { createCatalogRouter } from "../../../src/modules/catalog/catalog.routes.js";
import type { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
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

const draftCategory = {
  id: "cat_draft_1",
  code: "HOME_CLEANING",
  nameAr: null,
  nameEn: "Home Cleaning",
  descriptionAr: null,
  descriptionEn: "Draft description",
  displayOrder: 0,
  isActive: false,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const draftService = {
  id: "svc_draft_1",
  categoryId: "cat_draft_1",
  code: "STANDARD_HOME_CLEANING",
  displayOrder: 0,
  isActive: false,
  version: 1,
  translations: [{ locale: "EN" as const, name: "Draft", description: null }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const commandBase = {
  idempotencyKey: "00000000-0000-4000-8000-000000000201",
  reasonCode: "catalog_management_change" as const,
};

function createHarness(overrides?: Partial<CatalogService>) {
  const catalogService = {
    listCategoriesForManagement: vi.fn(async () => ({
      items: [draftCategory],
      nextCursor: null,
    })),
    getCategoryForManagement: vi.fn(async () => draftCategory),
    createCategory: vi.fn(async () => ({
      category: draftCategory,
      replayed: false,
    })),
    replaceCategoryContent: vi.fn(async () => ({
      category: { ...draftCategory, version: 2, nameEn: "Updated" },
      replayed: false,
    })),
    changeCategoryLifecycle: vi.fn(async () => ({
      category: { ...draftCategory, version: 2, isActive: true },
      replayed: false,
    })),
    listServicesForManagement: vi.fn(async () => ({
      items: [draftService],
      nextCursor: null,
    })),
    getServiceForManagement: vi.fn(async () => draftService),
    createService: vi.fn(async () => ({
      service: draftService,
      replayed: false,
    })),
    moveService: vi.fn(async () => ({
      service: { ...draftService, version: 2 },
      replayed: false,
    })),
    changeServiceLifecycle: vi.fn(async () => ({
      service: { ...draftService, version: 2, isActive: true },
      replayed: false,
    })),
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
 * Staff taxonomy HTTP surface (FR-031, FR-036, FR-037, SC-001).
 * Non-DB Supertest uses a stub CatalogService. Live staff journeys stay owner-gated.
 */
describe("catalog management taxonomy HTTP contracts", () => {
  it("mounts protected staff category and service routes under /api/v1/staff/catalog", async () => {
    const { app, catalogService } = createHarness();

    const listCategories = await request(app).get("/api/v1/staff/catalog/categories");
    const listServices = await request(app).get("/api/v1/staff/catalog/services");

    expect(listCategories.status).toBe(200);
    expect(listServices.status).toBe(200);
    expect(catalogService.listCategoriesForManagement).toHaveBeenCalled();
    expect(catalogService.listServicesForManagement).toHaveBeenCalled();
  });

  it("returns standard success envelopes for create/list/detail/update/lifecycle", async () => {
    const { app } = createHarness();

    const created = await request(app)
      .post("/api/v1/staff/catalog/categories")
      .send({
        ...commandBase,
        code: "HOME_CLEANING",
        nameAr: null,
        nameEn: "Home Cleaning",
        descriptionAr: null,
        descriptionEn: "Draft description",
      });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        success: true,
        data: draftCategory,
        requestId: expect.any(String),
        meta: expect.objectContaining({ replayed: false }),
      }),
    );

    const listed = await request(app).get("/api/v1/staff/catalog/categories");
    expect(listed.status).toBe(200);
    expect(listed.body.success).toBe(true);
    expect(listed.body.data).toEqual([draftCategory]);

    const detail = await request(app).get(
      "/api/v1/staff/catalog/categories/cat_draft_1",
    );
    expect(detail.status).toBe(200);
    expect(detail.body.data).toEqual(draftCategory);

    const replaced = await request(app)
      .put("/api/v1/staff/catalog/categories/cat_draft_1")
      .send({
        ...commandBase,
        idempotencyKey: "00000000-0000-4000-8000-000000000202",
        expectedVersion: 1,
        nameAr: null,
        nameEn: "Updated",
        descriptionAr: null,
        descriptionEn: "Draft description",
      });
    expect(replaced.status).toBe(200);
    expect(replaced.body.success).toBe(true);
    expect(replaced.body.data.version).toBe(2);

    const lifecycle = await request(app)
      .post("/api/v1/staff/catalog/categories/cat_draft_1/lifecycle")
      .send({
        ...commandBase,
        idempotencyKey: "00000000-0000-4000-8000-000000000203",
        expectedVersion: 1,
        action: "ACTIVATE",
      });
    expect(lifecycle.status).toBe(200);
    expect(lifecycle.body.success).toBe(true);
  });

  it("keeps inactive draft DTOs visible on the staff management surface", async () => {
    const { app } = createHarness();
    const response = await request(app).get("/api/v1/staff/catalog/services");
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        id: "svc_draft_1",
        isActive: false,
        translations: expect.any(Array),
      }),
    );
  });

  it("maps validation and Catalog domain errors into safe standard envelopes", async () => {
    const { app, catalogService } = createHarness({
      createCategory: vi.fn(async () => {
        throw new CatalogError(
          "CATALOG_VERSION_CONFLICT",
          "Catalog aggregate version is stale",
        );
      }),
      getCategoryForManagement: vi.fn(async () => {
        throw new CatalogError("CATALOG_FORBIDDEN", "Catalog management read denied", {
          httpStatus: 403,
        });
      }),
    } as Partial<CatalogService>);

    const validation = await request(app)
      .post("/api/v1/staff/catalog/categories")
      .send({ reasonCode: "catalog_management_change", code: "bad" });
    expect(validation.status).toBe(400);
    expect(validation.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "REQUEST_VALIDATION_FAILED",
          statusCode: 400,
        }),
        requestId: expect.any(String),
      }),
    );

    const conflict = await request(app)
      .post("/api/v1/staff/catalog/categories")
      .send({
        ...commandBase,
        code: "HOME_CLEANING",
        nameAr: null,
        nameEn: "Home Cleaning",
        descriptionAr: null,
        descriptionEn: "Draft description",
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("CATALOG_VERSION_CONFLICT");
    expect(JSON.stringify(conflict.body)).not.toMatch(/stack|prisma|SELECT/iu);

    const forbidden = await request(app).get(
      "/api/v1/staff/catalog/categories/cat_draft_1",
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("CATALOG_FORBIDDEN");
    expect(catalogService.createCategory).toHaveBeenCalled();
  });

  it("does not expose anonymous or customer Browse catalog routes", async () => {
    const { app } = createHarness();
    const browse = await request(app).get("/api/v1/catalog/services");
    expect(browse.status).toBe(404);
    const anonymousCategories = await request(app).get("/api/v1/catalog/categories");
    expect(anonymousCategories.status).toBe(404);
  });

  it.skipIf(!hasApprovedLiveTarget)(
    "runs live staff taxonomy Supertest journeys against an approved disposable DB",
    async () => {
      const {
        cleanupCatalogTestRows,
        createConnectedMigrationProofCatalogClient,
        createLiveCatalogHttpApp,
        ensureR1P08CatalogDatabaseMigrated,
        requireR1P08CatalogDatabaseUrl,
      } = await import("../../helpers/r1-p08-catalog-live.js");
      const request = (await import("supertest")).default;
      const connectionString = requireR1P08CatalogDatabaseUrl();
      await ensureR1P08CatalogDatabaseMigrated(connectionString);
      const prisma = await createConnectedMigrationProofCatalogClient(connectionString);
      const prefix = `livehttp${process.pid}${Date.now()}`;
      const actorUserId = `${prefix}-staff`;
      const app = createLiveCatalogHttpApp(prisma, actorUserId);
      const suffix = String(Date.now()).slice(-6);
      const idempotencyKey = randomUUID();

      try {
        const missingReason = await request(app)
          .post("/api/v1/staff/catalog/categories")
          .send({
            idempotencyKey,
            code: `LIVE_CAT_${suffix}`,
            nameAr: "فئة",
            nameEn: "Category",
            descriptionAr: null,
            descriptionEn: null,
          });
        expect(missingReason.status).toBe(400);
        expect(missingReason.body.success).toBe(false);

        const created = await request(app)
          .post("/api/v1/staff/catalog/categories")
          .send({
            idempotencyKey,
            reasonCode: "catalog_management_change",
            code: `LIVE_CAT_${suffix}`,
            nameAr: "فئة حية",
            nameEn: "Live Category",
            descriptionAr: "وصف",
            descriptionEn: "Description",
          });
        expect(created.status).toBe(201);
        expect(created.body.success).toBe(true);
        expect(created.body.data).toMatchObject({
          code: `LIVE_CAT_${suffix}`,
          nameAr: "فئة حية",
          nameEn: "Live Category",
          isActive: false,
        });

        const replay = await request(app)
          .post("/api/v1/staff/catalog/categories")
          .send({
            idempotencyKey,
            reasonCode: "catalog_management_change",
            code: `LIVE_CAT_${suffix}`,
            nameAr: "فئة حية",
            nameEn: "Live Category",
            descriptionAr: "وصف",
            descriptionEn: "Description",
          });
        expect(replay.status).toBe(200);
        expect(replay.body.meta.replayed).toBe(true);

        const listed = await request(app).get("/api/v1/staff/catalog/categories");
        expect(listed.status).toBe(200);
        expect(listed.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: `LIVE_CAT_${suffix}` }),
          ]),
        );
      } finally {
        try {
          await cleanupCatalogTestRows(prisma, {
            actorUserIdPrefix: "livehttp",
            recordIdPrefix: prefix,
            categoryCodePrefix: "LIVE_CAT_",
            serviceCodePrefix: "LIVE_SVC_",
          });
        } finally {
          await prisma.$disconnect();
        }
      }
    },
  );
});

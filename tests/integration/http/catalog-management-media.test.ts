import type { RequestHandler } from "express";

import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { createCatalogRouter } from "../../../src/modules/catalog/catalog.routes.js";
import type { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

/**
 * T104 — protected multipart add / reorder / remove HTTP contracts
 * (FR-036–FR-041). No anonymous Browse surface.
 */

const mediaServiceView = {
  id: "svc_1",
  categoryId: "cat_1",
  code: "STANDARD_HOME_CLEANING",
  displayOrder: 0,
  isActive: false,
  version: 2,
  translations: [],
  priceUnits: [],
  fields: [],
  countries: [],
  media: [
    {
      associationId: "assoc_1",
      mediaId: "media_1",
      displayOrder: 0,
      status: "READY",
      contentType: "image/webp",
      width: 640,
      height: 480,
      deliveryUrl: "https://example.invalid/signed",
      deliveryExpiresAt: "2026-08-31T12:05:00.000Z",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

type CatalogMediaHttpService = CatalogService & {
  uploadServiceMedia: ReturnType<typeof vi.fn>;
  reorderServiceMedia: ReturnType<typeof vi.fn>;
  removeServiceMedia: ReturnType<typeof vi.fn>;
};

function createHarness(overrides?: Partial<CatalogMediaHttpService>) {
  const catalogService = {
    uploadServiceMedia: vi.fn(async () => ({
      service: mediaServiceView,
      association: mediaServiceView.media[0],
      acceptedVersion: 2,
      replayed: false,
    })),
    reorderServiceMedia: vi.fn(async () => ({
      service: {
        ...mediaServiceView,
        media: [
          {
            ...mediaServiceView.media[0],
            associationId: "assoc_2",
            displayOrder: 0,
          },
          {
            ...mediaServiceView.media[0],
            associationId: "assoc_1",
            displayOrder: 1,
          },
        ],
        version: 3,
      },
      replayed: false,
    })),
    removeServiceMedia: vi.fn(async () => ({
      service: { ...mediaServiceView, media: [], version: 3 },
      replayed: false,
    })),
    ...overrides,
  } as unknown as CatalogMediaHttpService;

  const authenticateAccess: RequestHandler = (_req, response, next) => {
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

describe("catalog management media HTTP (T104)", () => {
  it("uploads a service image at the protected multipart staff route", async () => {
    const { app, catalogService } = createHarness();
    const response = await request(app)
      .post("/api/v1/staff/catalog/services/svc_1/media")
      .field("expectedVersion", "1")
      .field("idempotencyKey", "00000000-0000-4000-8000-000000000B01")
      .field("reasonCode", "catalog_management_change")
      .attach("file", Buffer.from("fake-image-bytes"), {
        filename: "service.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.media).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ associationId: "assoc_1", mediaId: "media_1" }),
      ]),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/storageKey|api_secret/iu);
    expect(catalogService.uploadServiceMedia).toHaveBeenCalledTimes(1);
  });

  it("reorders service media at the protected staff route", async () => {
    const { app, catalogService } = createHarness();
    const response = await request(app)
      .put("/api/v1/staff/catalog/services/svc_1/media/order")
      .send({
        expectedVersion: 2,
        idempotencyKey: "00000000-0000-4000-8000-000000000B02",
        reasonCode: "catalog_management_change",
        orderedAssociationIds: ["assoc_2", "assoc_1"],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(catalogService.reorderServiceMedia).toHaveBeenCalledTimes(1);
  });

  it("removes a service media association without claiming Media file deletion", async () => {
    const { app, catalogService } = createHarness();
    const response = await request(app)
      .post("/api/v1/staff/catalog/services/svc_1/media/assoc_1/remove")
      .send({
        expectedVersion: 2,
        idempotencyKey: "00000000-0000-4000-8000-000000000B03",
        reasonCode: "catalog_management_change",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.media).toEqual([]);
    expect(catalogService.removeServiceMedia).toHaveBeenCalledTimes(1);
  });

  it("returns a safe validation envelope for malformed multipart content", async () => {
    const { app, catalogService } = createHarness();
    const response = await request(app)
      .post("/api/v1/staff/catalog/services/svc_1/media")
      .field("expectedVersion", "not-a-number")
      .field("idempotencyKey", "short")
      .field("reasonCode", "wrong_reason")
      .attach("file", Buffer.from("x"), {
        filename: "bad.gif",
        contentType: "image/gif",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toMatch(/VALIDATION|CATALOG_MEDIA_INVALID|CATALOG_VALIDATION/u);
    expect(JSON.stringify(response.body)).not.toMatch(/stack|prisma|storageKey|secret/iu);
    expect(catalogService.uploadServiceMedia).not.toHaveBeenCalled();
  });

  it("returns forbidden when the media command rejects authorization", async () => {
    const { app } = createHarness({
      uploadServiceMedia: vi.fn(async () => {
        throw new CatalogError("CATALOG_FORBIDDEN", "Catalog management write denied", {
          httpStatus: 403,
        });
      }),
    });
    const response = await request(app)
      .post("/api/v1/staff/catalog/services/svc_1/media")
      .field("expectedVersion", "1")
      .field("idempotencyKey", "00000000-0000-4000-8000-000000000B04")
      .field("reasonCode", "catalog_management_change")
      .attach("file", Buffer.from("fake-image-bytes"), {
        filename: "service.png",
        contentType: "image/png",
      });
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("requires authentication for media mutations", async () => {
    const catalogService = {
      uploadServiceMedia: vi.fn(),
      reorderServiceMedia: vi.fn(),
      removeServiceMedia: vi.fn(),
    } as unknown as CatalogMediaHttpService;
    const router = createCatalogRouter({
      authenticateAccess: (_req, _res, next) => {
        next();
      },
      catalogService,
    });
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      mountTestRoutes(application) {
        application.use("/api/v1/staff/catalog", router);
      },
    });

    const response = await request(app)
      .post("/api/v1/staff/catalog/services/svc_1/media")
      .field("expectedVersion", "1")
      .field("idempotencyKey", "00000000-0000-4000-8000-000000000B05")
      .field("reasonCode", "catalog_management_change")
      .attach("file", Buffer.from("fake-image-bytes"), {
        filename: "service.png",
        contentType: "image/png",
      });
    expect(response.status).toBe(401);
    expect(catalogService.uploadServiceMedia).not.toHaveBeenCalled();
  });

  it("does not register an anonymous or customer Catalog Browse media route", async () => {
    const { app } = createHarness();
    const anonymous = await request(app).get("/api/v1/catalog/services/svc_1/media");
    expect(anonymous.status).toBe(404);

    const customerBrowse = await request(app).get(
      "/api/v1/catalog/services?countryCode=EG&locale=EN",
    );
    expect(customerBrowse.status).toBe(404);
  });
});

import type { RequestHandler } from "express";

import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { createCatalogRouter } from "../../../src/modules/catalog/catalog.routes.js";
import type { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

const configurationBody = {
  idempotencyKey: "00000000-0000-4000-8000-000000000401",
  reasonCode: "catalog_management_change" as const,
  expectedVersion: 1,
  translations: [{ locale: "EN" as const, name: "Draft", description: null }],
  priceUnits: [
    {
      code: "PER_VISIT",
      labelAr: null,
      labelEn: "Per visit",
      isActive: false,
    },
  ],
  fields: [
    {
      code: "PETS",
      kind: "BOOLEAN" as const,
      labelAr: null,
      labelEn: "Pets",
      helpTextAr: null,
      helpTextEn: null,
      isRequired: false,
      isActive: false,
      minLength: null,
      maxLength: null,
      numberMode: null,
      minValue: null,
      maxValue: null,
      minSelections: null,
      maxSelections: null,
      options: [],
    },
  ],
};

const configuredService = {
  id: "svc_draft_1",
  categoryId: "cat_draft_1",
  code: "STANDARD_HOME_CLEANING",
  displayOrder: 0,
  isActive: false,
  version: 2,
  translations: configurationBody.translations,
  priceUnits: [
    {
      id: "unit_1",
      code: "PER_VISIT",
      labelAr: null,
      labelEn: "Per visit",
      displayOrder: 0,
      isActive: false,
    },
  ],
  fields: [
    {
      id: "field_1",
      code: "PETS",
      kind: "BOOLEAN" as const,
      labelAr: null,
      labelEn: "Pets",
      helpTextAr: null,
      helpTextEn: null,
      isRequired: false,
      isActive: false,
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
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createHarness(overrides?: Partial<CatalogService>) {
  const catalogService = {
    replaceServiceConfiguration: vi.fn(async () => ({
      service: configuredService,
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
 * US2 configuration HTTP surface (FR-013–FR-021, FR-036–FR-037).
 */
describe("catalog management configuration HTTP", () => {
  it("replaces service configuration at the protected staff route", async () => {
    const { app, catalogService } = createHarness();
    const response = await request(app)
      .put("/api/v1/staff/catalog/services/svc_draft_1/configuration")
      .send(configurationBody);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.priceUnits).toHaveLength(1);
    expect(response.body.data.fields[0]?.kind).toBe("BOOLEAN");
    expect(catalogService.replaceServiceConfiguration).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed configuration payloads and countries input", async () => {
    const { app } = createHarness();
    const malformed = await request(app)
      .put("/api/v1/staff/catalog/services/svc_draft_1/configuration")
      .send({
        ...configurationBody,
        fields: [
          {
            ...configurationBody.fields[0],
            kind: "NUMBER",
            numberMode: null,
          },
        ],
      });
    expect(malformed.status).toBe(400);

    const withCountries = await request(app)
      .put("/api/v1/staff/catalog/services/svc_draft_1/configuration")
      .send({
        ...configurationBody,
        countries: [{ countryCode: "EG", isAvailable: true }],
      });
    expect(withCountries.status).toBe(400);
  });

  it("returns forbidden when the service command rejects authorization", async () => {
    const { app } = createHarness({
      replaceServiceConfiguration: vi.fn(async () => {
        throw new CatalogError("CATALOG_FORBIDDEN", "Catalog management write denied", {
          httpStatus: 403,
        });
      }),
    });
    const response = await request(app)
      .put("/api/v1/staff/catalog/services/svc_draft_1/configuration")
      .send(configurationBody);
    expect(response.status).toBe(403);
  });

  it("returns conflict for stale versions from the service layer", async () => {
    const { app } = createHarness({
      replaceServiceConfiguration: vi.fn(async () => {
        throw new CatalogError(
          "CATALOG_VERSION_CONFLICT",
          "Catalog aggregate version is stale",
          { httpStatus: 409 },
        );
      }),
    });
    const response = await request(app)
      .put("/api/v1/staff/catalog/services/svc_draft_1/configuration")
      .send(configurationBody);
    expect(response.status).toBe(409);
  });

  it("requires authentication", async () => {
    const catalogService = {
      replaceServiceConfiguration: vi.fn(),
    } as unknown as CatalogService;
    const router = createCatalogRouter({
      authenticateAccess: (_request, _response, next) => {
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
      .put("/api/v1/staff/catalog/services/svc_draft_1/configuration")
      .send(configurationBody);
    expect(response.status).toBe(401);
    expect(catalogService.replaceServiceConfiguration).not.toHaveBeenCalled();
  });
});

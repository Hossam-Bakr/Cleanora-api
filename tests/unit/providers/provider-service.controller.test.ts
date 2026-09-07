import express from "express";

import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import {
  createProviderServiceRouter,
  createStaffProviderServiceRouter,
} from "../../../src/modules/providers/provider-service.routes.js";
import { R1_P09_IDS, R1_P09_SENTINELS } from "../../helpers/r1-p09-provider-services-fixtures.js";

const request = require("supertest") as typeof import("supertest");

const offering = {
  id: R1_P09_IDS.providerServiceId,
  providerId: R1_P09_IDS.providerId,
  version: 1,
};

function principalMiddleware(
  _request: express.Request,
  response: express.Response,
  next: express.NextFunction,
): void {
  response.locals["authenticationPrincipal"] = {
    userId: R1_P09_IDS.ownerUserId,
  };
  next();
}

function attachRequestId(
  incoming: express.Request,
  _response: express.Response,
  next: express.NextFunction,
): void {
  incoming.requestId = R1_P09_IDS.requestId;
  next();
}

describe("provider-service controller and routes", () => {
  it("registers Provider Service routes and forwards happy-path responses", async () => {
    const service = {
      list: vi.fn(async () => ({ items: [offering], nextCursor: null })),
      get: vi.fn(async () => offering),
      createOffering: vi.fn(async () => ({ offering, replayed: false })),
      replaceConfiguration: vi.fn(async () => ({ offering, replayed: false })),
      proposePrice: vi.fn(async () => ({ offering, replayed: false })),
      applyLifecycle: vi.fn(async () => ({ offering, replayed: true })),
      listPriceHistory: vi.fn(async () => ({ items: [], nextCursor: "cursor-1" })),
      listStatusHistory: vi.fn(async () => ({ items: [], nextCursor: null })),
    };

    const app = express();
    app.use(express.json());
    app.use(attachRequestId);
    app.use(
      "/providers",
      createProviderServiceRouter({
        authenticateAccess: principalMiddleware,
        service: service as never,
      }),
    );
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const err = error as { code?: string; statusCode?: number; message?: string };
      res.status(err.statusCode ?? 500).json({
        success: false,
        error: { code: err.code ?? "UNEXPECTED", message: err.message ?? "fail" },
      });
    });

    await request(app)
      .get(`/providers/${R1_P09_IDS.providerId}/services`)
      .expect(200);
    await request(app)
      .get(`/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}`)
      .expect(200);
    await request(app)
      .post(`/providers/${R1_P09_IDS.providerId}/services`)
      .send({
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
        price: R1_P09_SENTINELS.providerPrice,
        minimumCharge: R1_P09_SENTINELS.minimumCharge,
        estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
        expectedVersion: 0,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
      })
      .expect(201);
    await request(app)
      .put(
        `/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}/configuration`,
      )
      .send({
        estimatedDurationMinutes: 60,
        noteAr: null,
        noteEn: null,
        expectedVersion: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000021",
      })
      .expect(200);
    await request(app)
      .post(
        `/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}/price-proposals`,
      )
      .send({
        catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
        price: "200.00",
        minimumCharge: "220.00",
        reason: R1_P09_SENTINELS.reasonText,
        expectedVersion: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000022",
      })
      .expect(201);
    await request(app)
      .post(
        `/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}/lifecycle`,
      )
      .send({
        action: "DISABLE",
        reason: R1_P09_SENTINELS.reasonText,
        expectedVersion: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000023",
      })
      .expect(200);
    await request(app)
      .get(
        `/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}/price-history?limit=10`,
      )
      .expect(200);
    await request(app)
      .get(
        `/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}/status-history`,
      )
      .expect(200);

    expect(service.list).toHaveBeenCalledOnce();
    expect(service.createOffering).toHaveBeenCalledOnce();
    expect(service.applyLifecycle).toHaveBeenCalledOnce();
  });

  it("maps ProviderServiceError through staff controllers and rejects missing principal", async () => {
    const service = {
      listStaffPendingPriceProposals: vi.fn(async () => ({
        items: [],
        nextCursor: null,
      })),
      getStaffPendingPriceDossier: vi.fn(async () => {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }),
      decidePriceProposal: vi.fn(async () => ({
        result: {
          decision: "APPROVE",
          providerId: R1_P09_IDS.providerId,
          providerServiceId: R1_P09_IDS.providerServiceId,
          providerServicePriceId: R1_P09_IDS.providerServicePriceId,
          priceStatus: "EFFECTIVE",
          version: 2,
          effectivePriceId: R1_P09_IDS.providerServicePriceId,
        },
        replayed: false,
      })),
    };

    const app = express();
    app.use(express.json());
    app.use(attachRequestId);
    app.use(
      "/staff/providers",
      createStaffProviderServiceRouter({
        authenticateAccess: principalMiddleware,
        service: service as never,
      }),
    );
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const err = error as { code?: string; statusCode?: number; message?: string };
      res.status(err.statusCode ?? 500).json({
        success: false,
        error: { code: err.code ?? "UNEXPECTED", message: err.message ?? "fail" },
      });
    });

    await request(app)
      .get("/staff/providers/service-price-proposals?countryCode=eg")
      .expect(200);
    await request(app)
      .get(
        `/staff/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}/price-proposals/${R1_P09_IDS.providerServicePriceId}`,
      )
      .expect(404);
    await request(app)
      .post(
        `/staff/providers/${R1_P09_IDS.providerId}/services/${R1_P09_IDS.providerServiceId}/price-proposals/${R1_P09_IDS.providerServicePriceId}/decisions`,
      )
      .send({
        decision: "APPROVE",
        reason: R1_P09_SENTINELS.reasonText,
        expectedVersion: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000024",
      })
      .expect(200);

    const unauth = express();
    unauth.use(express.json());
    unauth.use(attachRequestId);
    unauth.use(
      "/providers",
      createProviderServiceRouter({
        authenticateAccess: (_req, _res, next) => next(),
        service: {
          list: vi.fn(),
          get: vi.fn(),
          createOffering: vi.fn(),
          replaceConfiguration: vi.fn(),
          proposePrice: vi.fn(),
          applyLifecycle: vi.fn(),
          listPriceHistory: vi.fn(),
          listStatusHistory: vi.fn(),
        } as never,
      }),
    );
    unauth.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const err = error as { code?: string; statusCode?: number };
      res.status(err.statusCode ?? 500).json({ success: false, error: { code: err.code } });
    });

    await request(unauth)
      .get(`/providers/${R1_P09_IDS.providerId}/services`)
      .expect(401);
  });

  it("rejects unknown monetary fields at the Zod boundary", async () => {
    const app = express();
    app.use(express.json());
    app.use(attachRequestId);
    app.use(
      "/providers",
      createProviderServiceRouter({
        authenticateAccess: principalMiddleware,
        service: {
          list: vi.fn(),
          get: vi.fn(),
          createOffering: vi.fn(),
          replaceConfiguration: vi.fn(),
          proposePrice: vi.fn(),
          applyLifecycle: vi.fn(),
          listPriceHistory: vi.fn(),
          listStatusHistory: vi.fn(),
        } as never,
      }),
    );
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const err = error as { statusCode?: number; code?: string };
      res.status(err.statusCode ?? 400).json({ success: false, error: { code: err.code ?? "VALIDATION" } });
    });

    const response = await request(app)
      .post(`/providers/${R1_P09_IDS.providerId}/services`)
      .send({
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
        price: R1_P09_SENTINELS.providerPrice,
        minimumCharge: R1_P09_SENTINELS.minimumCharge,
        estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
        expectedVersion: 0,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        total: "999.00",
      })
      .expect(400);
    expect(response.body.success).toBe(false);
  });
});

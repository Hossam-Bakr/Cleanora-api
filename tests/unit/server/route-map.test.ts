import express, { Router } from "express";

import { mountRoutes } from "../../../src/routes/index.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

describe("public route map", () => {
  it("mounts docs, system, and authentication groups explicitly", async () => {
    const app = express();
    const authenticationRouter = Router();
    authenticationRouter.get("/route-probe", (_incoming, response) => {
      response.status(204).end();
    });
    const consume = vi.fn(async () => ({ allowed: true, remaining: 119 }));

    mountRoutes(app, {
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      rateLimiter: { consume },
      readinessProbes: [],
      authenticationRouter,
    });

    await request(app).get("/api/v1/docs/openapi.json").expect(200);
    await request(app).get("/api/v1/system/health/live").expect(200);
    await request(app).get("/api/v1/system/health/ready").expect(200);
    await request(app).get("/api/v1/auth/route-probe").expect(204);
    expect(consume).toHaveBeenCalledWith(
      { scope: "system-health-ready", subject: expect.any(String) },
      120,
      60,
    );
  });
});

import { z } from "zod";

import { createTestApp } from "../helpers/create-test-app.js";
import { createTestEnvironment } from "../helpers/test-environment.js";
import { TestLogger } from "../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

describe("system API", () => {
  it("returns the standard success envelope for liveness", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger()
    });

    const response = await request(app)
      .get("/api/v1/system/health/live")
      .set("origin", "http://localhost:5173")
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok" }
    });
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns the standard failure envelope for an unknown route", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger()
    });

    const response = await request(app)
      .get("/api/v1/unknown")
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "HTTP_ROUTE_NOT_FOUND"
      }
    });
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it("returns ready when every dependency probe succeeds", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      readinessProbes: [
        { name: "postgresql", check: async () => Promise.resolve() }
      ]
    });

    const response = await request(app)
      .get("/api/v1/system/health/ready")
      .expect(200);

    expect(response.body.data.status).toBe("ready");
  });

  it("returns database health without database implementation details", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      databaseProbe: { check: async () => Promise.resolve() }
    });

    const response = await request(app)
      .get("/api/v1/system/health/database")
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { status: "up" }
    });
  });

  it("maps a database probe failure to DATABASE_UNAVAILABLE", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      databaseProbe: {
        check: async () => Promise.reject(new Error("postgresql://private"))
      }
    });

    const response = await request(app)
      .get("/api/v1/system/health/database")
      .expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database is unavailable",
        details: {}
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("postgresql://private");
  });

  it("returns a safe dependency error when a readiness probe fails", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      readinessProbes: [
        {
          name: "postgresql",
          check: async () => Promise.reject(new Error("private DB detail"))
        }
      ]
    });

    const response = await request(app)
      .get("/api/v1/system/health/ready")
      .expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "DEPENDENCY_NOT_READY",
        details: { failed: ["postgresql"] }
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("private DB detail");
  });

  it("maps Zod errors to safe field issues", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      mountTestRoutes(expressApp) {
        expressApp.get("/api/v1/test/validation", () => {
          z.object({ email: z.email() }).parse({ email: "invalid" });
        });
      },
    });

    const response = await request(app)
      .get("/api/v1/test/validation")
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "REQUEST_VALIDATION_FAILED",
        details: {
          issues: [
            expect.objectContaining({
              path: "email"
            })
          ]
        }
      }
    });
  });

  it("hides unexpected error details", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      mountTestRoutes(expressApp) {
        expressApp.get("/api/v1/test/error", () => {
          throw new Error("private internal detail");
        });
      },
    });

    const response = await request(app)
      .get("/api/v1/test/error")
      .expect(500);

    expect(response.body.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      statusCode: 500,
      message: "Internal server error"
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "private internal detail"
    );
  });

  it("rejects a browser origin outside the configured allowlist", async () => {
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger()
    });

    const response = await request(app)
      .get("/api/v1/system/health/live")
      .set("origin", "https://untrusted.example")
      .expect(403);

    expect(response.body.error.code).toBe("CORS_ORIGIN_NOT_ALLOWED");
  });
});

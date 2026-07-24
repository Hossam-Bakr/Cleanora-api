import { z } from "zod";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { validateRequest } from "../../src/core/http/validate-request.js";
import { createTestEnvironment } from "../helpers/test-environment.js";
import { TestLogger } from "../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

describe("API response envelopes", () => {
  it("returns the validation failure envelope from validateRequest", async () => {
    const app = createApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      modules: [
        {
          name: "envelope-validation-test",
          register(expressApp) {
            expressApp.post(
              "/api/v1/test/validation",
              validateRequest({ body: z.object({ email: z.email() }) }),
              (_request, response) => response.status(204).end()
            );
          }
        }
      ]
    });

    const response = await request(app)
      .post("/api/v1/test/validation")
      .send({ email: "invalid" })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "REQUEST_VALIDATION_FAILED",
        message: "Request validation failed",
        details: {
          issues: [expect.objectContaining({ path: "email" })]
        }
      },
      requestId: expect.any(String)
    });
  });

  it("returns the unexpected-error envelope without private details", async () => {
    const app = createApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      modules: [
        {
          name: "envelope-error-test",
          register(expressApp) {
            expressApp.get("/api/v1/test/unexpected", () => {
              throw new Error("SELECT * FROM private_secrets");
            });
          }
        }
      ]
    });

    const response = await request(app)
      .get("/api/v1/test/unexpected")
      .expect(500);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      },
      requestId: expect.any(String)
    });
    expect(JSON.stringify(response.body)).not.toContain("private_secrets");
  });
});

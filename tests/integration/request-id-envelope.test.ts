import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createTestEnvironment } from "../helpers/test-environment.js";
import { TestLogger } from "../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

describe("request ID response envelopes", () => {
  it("returns an accepted request ID in successful envelopes and headers", async () => {
    const requestId = "2f9cb3a5-767e-4e48-bcc3-1d8354d71be7";
    const app = createApp({
      environment: createTestEnvironment(),
      logger: new TestLogger()
    });

    const response = await request(app)
      .get("/api/v1/system/health/live")
      .set("x-request-id", requestId)
      .expect(200);

    expect(response.body.requestId).toBe(requestId);
    expect(response.headers["x-request-id"]).toBe(requestId);
  });

  it("returns a minted request ID in error envelopes", async () => {
    const app = createApp({
      environment: createTestEnvironment(),
      logger: new TestLogger()
    });

    const response = await request(app).get("/api/v1/not-found").expect(404);

    expect(response.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
  });
});

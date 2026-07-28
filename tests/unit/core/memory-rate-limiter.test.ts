
import { createApp } from "../../../src/app.js";
import { MemoryRateLimiterAdapter } from "../../../src/integrations/security/memory-rate-limiter.adapter.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

describe("MemoryRateLimiterAdapter", () => {
  it("denies requests after an explicit policy is exhausted", async () => {
    const limiter = new MemoryRateLimiterAdapter();

    await expect(
      limiter.consume({ scope: "test", subject: "127.0.0.1" }, 1, 60)
    ).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(
      limiter.consume({ scope: "test", subject: "127.0.0.1" }, 1, 60)
    ).resolves.toMatchObject({ allowed: false, remaining: 0 });
  });

  it("propagates storage failures for fail-closed HTTP handling", async () => {
    const limiter = new MemoryRateLimiterAdapter(() => ({
      consume: async () => Promise.reject(new Error("storage unavailable"))
    }));

    await expect(
      limiter.consume({ scope: "test", subject: "127.0.0.1" }, 1, 60)
    ).rejects.toThrow("storage unavailable");
  });

  it("returns RATE_LIMITER_UNAVAILABLE when the mounted limiter fails", async () => {
    const app = createApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      rateLimiter: {
        consume: async () => Promise.reject(new Error("storage unavailable"))
      }
    });

    const response = await request(app)
      .get("/api/v1/system/health/ready")
      .expect(503);

    expect(response.body.error).toMatchObject({
      code: "RATE_LIMITER_UNAVAILABLE",
      message:
        "Request protection is temporarily unavailable. Please try again later."
    });
    expect(JSON.stringify(response.body)).not.toContain("storage unavailable");
  });
});

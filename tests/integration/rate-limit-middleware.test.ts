
import { requestIdMiddleware } from "../../src/core/http/request-id.middleware.js";
import { createRateLimitMiddleware } from "../../src/core/security/rate-limit.middleware.js";

const express = require("express") as typeof import("express");
const request = require("supertest") as typeof import("supertest");

describe("rate-limit middleware", () => {
  it("allows a request and exposes the remaining count", async () => {
    const consume = vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 4
    });
    const app = express();
    app.use(requestIdMiddleware);
    app.use(
      createRateLimitMiddleware({
        limiter: { consume },
        scope: "auth-login",
        limit: 5,
        windowSeconds: 60,
        subject: (requestIp) => requestIp ?? "unknown"
      })
    );
    app.get("/", (_request, response) => response.status(204).end());

    const response = await request(app).get("/").expect(204);

    expect(response.headers["ratelimit-remaining"]).toBe("4");
    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "auth-login" }),
      5,
      60
    );
  });

  it("returns the standard 429 envelope and retry metadata", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(
      createRateLimitMiddleware({
        limiter: {
          consume: vi.fn().mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 30
          })
        },
        scope: "auth-login",
        limit: 5,
        windowSeconds: 60,
        subject: () => "subject"
      })
    );

    const response = await request(app).get("/").expect(429);

    expect(response.headers["retry-after"]).toBe("30");
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "RATE_LIMIT_EXCEEDED" }
    });
  });

  it("fails closed with the standard unavailable envelope when limiter storage fails", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(
      createRateLimitMiddleware({
        limiter: { consume: vi.fn().mockRejectedValue(new Error("adapter failed")) },
        scope: "auth-login",
        limit: 5,
        windowSeconds: 60,
        subject: () => "subject"
      })
    );
    const response = await request(app).get("/").expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "RATE_LIMITER_UNAVAILABLE",
        message: "Rate limiter is unavailable"
      },
      requestId: expect.any(String)
    });
  });
});

import type { RequestHandler } from "express";

import { createAuthenticationRouter } from "../../../src/modules/authentication/http/authentication.routes.js";

const express = require("express") as typeof import("express");
const request = require("supertest") as typeof import("supertest");

describe("Google browser handoff surface", () => {
  it("does not expose the removed API-hosted HTML result page", async () => {
    const next: RequestHandler = (_request, _response, continueRequest) => {
      continueRequest();
    };
    const router = createAuthenticationRouter({
      service: {} as never,
      authenticateAccess: next,
      trustedOrigin: next,
      cookies: {
        name: "cleanora_refresh_token",
        path: "/api/v1/auth",
        secure: false,
        sameSite: "lax",
      },
      limiter: {
        consume: async () => ({ allowed: true, remaining: 10 }),
      },
      privacyHashSecret: "browser-handoff-privacy-secret",
      google: undefined,
      googleProviderCallbackUri: undefined,
      googleFrontendCallbackUri: undefined,
    });
    const application = express();
    application.use("/api/v1/auth", router);

    await request(application).get("/api/v1/auth/google/result").expect(404);
  });
});

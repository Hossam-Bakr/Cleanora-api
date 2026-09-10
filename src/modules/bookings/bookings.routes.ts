import { createHmac } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";

import { createBookingsBrowseController } from "./bookings.controller.js";
import type { BookingsBrowseReader } from "./bookings.public.js";

export interface BookingsBrowseRouterDependencies {
  readonly optionalAuthenticateAccess: RequestHandler;
  readonly rateLimiter: RateLimiterPort;
  readonly privacyHashSecret: string;
  readonly service: BookingsBrowseReader;
}

export const BROWSE_RATE_LIMITS = {
  providerList: { limit: 60, windowSeconds: 60 },
  providerDetail: { limit: 120, windowSeconds: 60 },
} as const;

/**
 * Guest-capable Browse marketplace router under `/api/v1/browse`.
 */
export function createBookingsBrowseRouter(
  dependencies: BookingsBrowseRouterDependencies,
): Router {
  const controller = createBookingsBrowseController({
    service: dependencies.service,
  });
  const router = Router();
  router.use(dependencies.optionalAuthenticateAccess);
  const rateLimit = (
    scope: string,
    policy: { readonly limit: number; readonly windowSeconds: number },
  ) =>
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: `browse-${scope}`,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      subject: (ip) =>
        createHmac("sha256", dependencies.privacyHashSecret)
          .update(ip ?? "missing")
          .digest("hex"),
    });

  router.get("/services", (req, res, next) => {
    void controller.listServices(req, res, next);
  });
  router.get("/services/:serviceId", (req, res, next) => {
    void controller.getService(req, res, next);
  });
  router.get("/countries/:countryCode/cities", (req, res, next) => {
    void controller.listCities(req, res, next);
  });
  router.get(
    "/countries/:countryCode/cities/:cityId/districts",
    (req, res, next) => {
      void controller.listDistricts(req, res, next);
    },
  );
  router.get(
    "/providers",
    rateLimit("providers", BROWSE_RATE_LIMITS.providerList),
    (req, res, next) => {
      void controller.listProviders(req, res, next);
    },
  );
  router.get(
    "/providers/:providerId/teams/:teamId",
    rateLimit("provider-detail", BROWSE_RATE_LIMITS.providerDetail),
    (req, res, next) => {
      void controller.getProviderDetail(req, res, next);
    },
  );

  return router;
}

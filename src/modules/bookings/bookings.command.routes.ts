import { createHmac } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { requireFullAuthentication } from "#modules/authentication/auth.middleware";
import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";

import { createBookingsCommandController } from "./bookings.command.controller.js";
import type { BookingsCommandService } from "./bookings.command.service.js";

export interface BookingsCommandRouterDependencies {
  readonly authenticateAccess: RequestHandler;
  readonly rateLimiter: RateLimiterPort;
  readonly privacyHashSecret: string;
  readonly service: BookingsCommandService;
}

export const BOOKING_COMMAND_RATE_LIMITS = {
  mutate: { limit: 30, windowSeconds: 60 },
} as const;

/**
 * Verified-customer booking command router under `/api/v1/bookings`.
 */
export function createBookingsCommandRouter(
  dependencies: BookingsCommandRouterDependencies,
): Router {
  const controller = createBookingsCommandController({
    service: dependencies.service,
  });
  const router = Router();
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  const rateLimit = (
    scope: string,
    policy: { readonly limit: number; readonly windowSeconds: number },
  ) =>
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: `bookings-${scope}`,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      subject: (ip) =>
        createHmac("sha256", dependencies.privacyHashSecret)
          .update(ip ?? "missing")
          .digest("hex"),
    });

  router.post("/", rateLimit("create", BOOKING_COMMAND_RATE_LIMITS.mutate), (req, res, next) => {
    void controller.create(req, res, next);
  });
  router.get("/", (req, res, next) => {
    void controller.list(req, res, next);
  });
  router.get("/:bookingId", (req, res, next) => {
    void controller.get(req, res, next);
  });
  router.patch("/:bookingId", (req, res, next) => {
    void controller.patch(req, res, next);
  });
  router.post(
    "/:bookingId/submit-for-deposit",
    rateLimit("submit", BOOKING_COMMAND_RATE_LIMITS.mutate),
    (req, res, next) => {
      void controller.submitForDeposit(req, res, next);
    },
  );
  router.post("/:bookingId/cancel", (req, res, next) => {
    void controller.cancel(req, res, next);
  });
  router.post("/:bookingId/media", (req, res, next) => {
    void controller.attachMedia(req, res, next);
  });
  return router;
}

import { createHmac } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { requireFullAuthentication } from "#modules/authentication/auth.middleware";
import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";

import { createBookingAssignmentController } from "./bookings.assignment.controller.js";
import type { BookingAssignmentService } from "./bookings.assignment.service.js";

export interface BookingAssignmentRouterDependencies {
  readonly authenticateAccess: RequestHandler;
  readonly rateLimiter: RateLimiterPort;
  readonly privacyHashSecret: string;
  readonly service: BookingAssignmentService;
}

const MUTATE = { limit: 30, windowSeconds: 60 } as const;

function hashedIpSubject(secret: string, ip: string | undefined): string {
  const material = ip === undefined ? "missing" : ip;
  return createHmac("sha256", secret).update(material).digest("hex");
}

/**
 * Provider-scoped booking assignment router under `/api/v1/providers`.
 */
export function createBookingAssignmentRouter(
  dependencies: BookingAssignmentRouterDependencies,
): Router {
  const controller = createBookingAssignmentController({
    service: dependencies.service,
  });
  const router = Router({ mergeParams: true });
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  const rateLimit = (scope: string) =>
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: `bookings-assignment-${scope}`,
      limit: MUTATE.limit,
      windowSeconds: MUTATE.windowSeconds,
      subject: (ip) => hashedIpSubject(dependencies.privacyHashSecret, ip),
    });

  router.post(
    "/:providerId/bookings/:bookingId/assignments/team",
    rateLimit("assign-team"),
    (req, res, next) => {
      void controller.assignTeam(req, res, next);
    },
  );
  router.post(
    "/:providerId/bookings/:bookingId/assignments/workers",
    rateLimit("assign-workers"),
    (req, res, next) => {
      void controller.assignWorkers(req, res, next);
    },
  );
  router.post(
    "/:providerId/bookings/:bookingId/assignments/team/replace",
    rateLimit("replace-team"),
    (req, res, next) => {
      void controller.replaceTeam(req, res, next);
    },
  );
  router.post(
    "/:providerId/bookings/:bookingId/assignments/workers/replace",
    rateLimit("replace-workers"),
    (req, res, next) => {
      void controller.replaceWorkers(req, res, next);
    },
  );
  router.get("/:providerId/bookings/:bookingId/assignments/current", (req, res, next) => {
    void controller.getCurrent(req, res, next);
  });
  router.get("/:providerId/bookings/:bookingId/assignments/history", (req, res, next) => {
    void controller.getHistory(req, res, next);
  });
  return router;
}

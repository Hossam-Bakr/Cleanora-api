import { createHmac } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { requireFullAuthentication } from "#modules/authentication/auth.middleware";
import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";

import { createBookingResponseController } from "./bookings.response.controller.js";
import type { BookingResponseService } from "./bookings.response.service.js";

export interface BookingResponseRouterDependencies {
  readonly authenticateAccess: RequestHandler;
  readonly rateLimiter: RateLimiterPort;
  readonly privacyHashSecret: string;
  readonly service: BookingResponseService;
}

const MUTATE = { limit: 30, windowSeconds: 60 } as const;

function hashedIpSubject(secret: string, ip: string | undefined): string {
  const material = ip === undefined ? "missing" : ip;
  return createHmac("sha256", secret).update(material).digest("hex");
}

/**
 * Provider-scoped booking response router under `/api/v1/providers`.
 */
export function createBookingProviderResponseRouter(
  dependencies: BookingResponseRouterDependencies,
): Router {
  const controller = createBookingResponseController({
    service: dependencies.service,
  });
  const router = Router({ mergeParams: true });
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  const rateLimit = (scope: string) =>
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: `bookings-response-${scope}`,
      limit: MUTATE.limit,
      windowSeconds: MUTATE.windowSeconds,
      subject: (ip) => hashedIpSubject(dependencies.privacyHashSecret, ip),
    });

  router.get("/:providerId/bookings/inbox", (req, res, next) => {
    void controller.inbox(req, res, next);
  });
  router.get("/:providerId/bookings/:bookingId", (req, res, next) => {
    void controller.providerGet(req, res, next);
  });
  router.post(
    "/:providerId/bookings/:bookingId/accept",
    rateLimit("accept"),
    (req, res, next) => {
      void controller.accept(req, res, next);
    },
  );
  router.post(
    "/:providerId/bookings/:bookingId/reject",
    rateLimit("reject"),
    (req, res, next) => {
      void controller.reject(req, res, next);
    },
  );
  router.post(
    "/:providerId/bookings/:bookingId/cancel",
    rateLimit("provider-cancel"),
    (req, res, next) => {
      void controller.providerCancel(req, res, next);
    },
  );
  return router;
}

/**
 * Customer cancellation-reason listing mounted on `/api/v1/bookings`.
 */
export function createBookingReasonsRouter(
  dependencies: BookingResponseRouterDependencies,
): Router {
  const controller = createBookingResponseController({
    service: dependencies.service,
  });
  const router = Router();
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  router.get("/cancellation-reasons", (req, res, next) => {
    void controller.reasons(req, res, next);
  });
  return router;
}

/**
 * Staff booking cancel/dossier under `/api/v1/staff/bookings`.
 */
export function createBookingStaffResponseRouter(
  dependencies: BookingResponseRouterDependencies,
): Router {
  const controller = createBookingResponseController({
    service: dependencies.service,
  });
  const router = Router();
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  const rateLimit = createRateLimitMiddleware({
    limiter: dependencies.rateLimiter,
    scope: "bookings-response-staff-cancel",
    limit: MUTATE.limit,
    windowSeconds: MUTATE.windowSeconds,
    subject: (ip) => hashedIpSubject(dependencies.privacyHashSecret, ip),
  });
  router.get("/:bookingId", (req, res, next) => {
    void controller.staffGet(req, res, next);
  });
  router.post("/:bookingId/cancel", rateLimit, (req, res, next) => {
    void controller.staffCancel(req, res, next);
  });
  return router;
}

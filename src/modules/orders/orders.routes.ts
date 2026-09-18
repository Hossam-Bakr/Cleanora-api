import { createHmac } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { requireFullAuthentication } from "#modules/authentication/auth.middleware";
import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";

import { createOrdersController } from "./orders.controller.js";
import type { OrdersService } from "./orders.service.js";

export interface OrdersRouterDependencies {
  readonly authenticateAccess: RequestHandler;
  readonly rateLimiter: RateLimiterPort;
  readonly privacyHashSecret: string;
  readonly service: OrdersService;
}

const MUTATE = { limit: 60, windowSeconds: 60 } as const;

function hashedIpSubject(secret: string, ip: string | undefined): string {
  const material = ip === undefined ? "missing" : ip;
  return createHmac("sha256", secret).update(material).digest("hex");
}

/**
 * Orders HTTP surface under `/api/v1/orders`.
 */
export function createOrdersRouter(
  dependencies: OrdersRouterDependencies,
): Router {
  const controller = createOrdersController({ service: dependencies.service });
  const router = Router({ mergeParams: true });
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  const rateLimit = (scope: string) =>
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: `orders-${scope}`,
      limit: MUTATE.limit,
      windowSeconds: MUTATE.windowSeconds,
      subject: (ip) => hashedIpSubject(dependencies.privacyHashSecret, ip),
    });

  router.get("/by-booking/:bookingId", (req, res, next) => {
    void controller.getByBooking(req, res, next);
  });
  router.get("/:orderId", (req, res, next) => {
    void controller.getOrder(req, res, next);
  });
  router.get("/:orderId/timeline", (req, res, next) => {
    void controller.getTimeline(req, res, next);
  });
  router.get("/:orderId/media", (req, res, next) => {
    void controller.listMedia(req, res, next);
  });
  router.post(
    "/:orderId/transitions/on-the-way",
    rateLimit("on-the-way"),
    (req, res, next) => {
      void controller.onTheWay(req, res, next);
    },
  );
  router.post(
    "/:orderId/transitions/in-progress",
    rateLimit("in-progress"),
    (req, res, next) => {
      void controller.inProgress(req, res, next);
    },
  );
  router.post(
    "/:orderId/transitions/ready-to-complete",
    rateLimit("ready-to-complete"),
    (req, res, next) => {
      void controller.readyToComplete(req, res, next);
    },
  );
  router.post("/:orderId/complete", rateLimit("complete"), (req, res, next) => {
    void controller.complete(req, res, next);
  });
  router.post(
    "/:orderId/completion-code/resend",
    rateLimit("resend"),
    (req, res, next) => {
      void controller.resendCode(req, res, next);
    },
  );
  router.post("/:orderId/media", rateLimit("media"), (req, res, next) => {
    void controller.attachMedia(req, res, next);
  });
  router.post("/:orderId/notes", rateLimit("notes"), (req, res, next) => {
    void controller.addNote(req, res, next);
  });
  return router;
}

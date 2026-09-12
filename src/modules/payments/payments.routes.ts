import { createHmac } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { requireFullAuthentication } from "#modules/authentication/auth.middleware";
import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";

import { createPaymentsController } from "./payments.controller.js";
import type { PaymentsApplicationService } from "./payments.public.js";

export interface PaymentsRouterDependencies {
  readonly authenticateAccess: RequestHandler;
  readonly optionalAuthenticateAccess?: RequestHandler;
  readonly rateLimiter: RateLimiterPort;
  readonly privacyHashSecret: string;
  readonly service: PaymentsApplicationService;
  readonly isStaffAdmin: (userId: string) => Promise<boolean>;
}

export const PAYMENT_RATE_LIMITS = {
  mutate: { limit: 30, windowSeconds: 60 },
  webhook: { limit: 120, windowSeconds: 60 },
} as const;

/**
 * Customer payment routes under `/api/v1/payments`.
 */
export function createPaymentsRouter(
  dependencies: PaymentsRouterDependencies,
): Router {
  const controller = createPaymentsController({
    service: dependencies.service,
    isStaffAdmin: dependencies.isStaffAdmin,
  });
  const router = Router();
  const rateLimit = (
    scope: string,
    policy: { readonly limit: number; readonly windowSeconds: number },
  ) =>
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: `payments-${scope}`,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      subject: (ip) =>
        createHmac("sha256", dependencies.privacyHashSecret)
          .update(ip ?? "missing")
          .digest("hex"),
    });

  router.get(
    "/methods",
    dependencies.authenticateAccess,
    requireFullAuthentication,
    (req, res, next) => {
      void controller.listMethods(req, res, next);
    },
  );
  router.post(
    "/deposits",
    dependencies.authenticateAccess,
    requireFullAuthentication,
    rateLimit("deposit", PAYMENT_RATE_LIMITS.mutate),
    (req, res, next) => {
      void controller.initiateDeposit(req, res, next);
    },
  );
  router.get(
    "/return",
    dependencies.optionalAuthenticateAccess ?? dependencies.authenticateAccess,
    (req, res, next) => {
      void controller.browserReturn(req, res, next);
    },
  );
  // Allow return with token only (optional auth): also register without auth via open path.
  router.get("/:paymentId", dependencies.authenticateAccess, requireFullAuthentication, (req, res, next) => {
    void controller.getPayment(req, res, next);
  });

  return router;
}

/**
 * Staff payment method admin under `/api/v1/staff/payments`.
 */
export function createStaffPaymentsRouter(
  dependencies: PaymentsRouterDependencies,
): Router {
  const controller = createPaymentsController({
    service: dependencies.service,
    isStaffAdmin: dependencies.isStaffAdmin,
  });
  const router = Router();
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  router.patch("/methods/:methodId", (req, res, next) => {
    void controller.setMethodEnabled(req, res, next);
  });
  router.put("/methods/:methodId", (req, res, next) => {
    void controller.setMethodEnabled(req, res, next);
  });
  return router;
}

/**
 * Paymob webhook under `/api/v1/webhooks/paymob`.
 */
export function createPaymobWebhookRouter(
  dependencies: Omit<
    PaymentsRouterDependencies,
    "authenticateAccess" | "privacyHashSecret"
  > & { readonly privacyHashSecret?: string },
): Router {
  const controller = createPaymentsController({
    service: dependencies.service,
    isStaffAdmin: dependencies.isStaffAdmin,
  });
  const router = Router();
  const rateLimit = createRateLimitMiddleware({
    limiter: dependencies.rateLimiter,
    scope: "payments-webhook",
    limit: PAYMENT_RATE_LIMITS.webhook.limit,
    windowSeconds: PAYMENT_RATE_LIMITS.webhook.windowSeconds,
    subject: (ip) =>
      createHmac("sha256", dependencies.privacyHashSecret ?? "payments-webhook")
        .update(ip ?? "missing")
        .digest("hex"),
  });
  router.post("/", rateLimit, (req, res, next) => {
    void controller.paymobWebhook(req, res, next);
  });
  return router;
}

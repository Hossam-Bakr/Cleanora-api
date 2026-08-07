import { createHmac } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";

import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";

import { createOwnerStaffAdminController } from "./owner-staff-admin.controller.js";
import type { OwnerStaffAdminProvisionService } from "./owner-staff-admin.service.js";

function rateLimitSubject(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "missing";
}

/**
 * Internal owner router. Mounted at `/api/v1/internal/owner`.
 * Disabled behavior is enforced inside the service (env gate + secret).
 */
export function createOwnerInternalRouter(input: {
  readonly service: OwnerStaffAdminProvisionService;
  readonly limiter: RateLimiterPort;
  readonly privacyHashSecret: string;
}): Router {
  const router = Router();
  const controller = createOwnerStaffAdminController(input.service);
  const hashSubject = (value: unknown) =>
    createHmac("sha256", input.privacyHashSecret)
      .update(rateLimitSubject(value))
      .digest("hex");

  const limit = (
    scope: string,
    values: readonly [number, number],
    subject: (request: Request) => unknown = (request) => request.ip,
  ): RequestHandler =>
    createRateLimitMiddleware({
      limiter: input.limiter,
      scope: `owner-${scope}`,
      limit: values[0],
      windowSeconds: values[1],
      subject: (_ip, request) =>
        hashSubject(request === undefined ? "unknown" : subject(request)),
    });

  router.post(
    "/staff-admins",
    limit("staff-admin-ip", [10, 60]),
    limit("staff-admin-secret", [5, 60], (request) =>
      request.header("x-owner-admin-secret") ?? "missing",
    ),
    controller.provision,
  );

  return router;
}

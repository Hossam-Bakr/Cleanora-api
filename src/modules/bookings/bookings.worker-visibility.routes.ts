import { Router, type RequestHandler } from "express";

import { requireFullAuthentication } from "#modules/authentication/auth.middleware";

import { createBookingAssignmentController } from "./bookings.assignment.controller.js";
import type { BookingAssignmentService } from "./bookings.assignment.service.js";

export interface BookingWorkerVisibilityRouterDependencies {
  readonly authenticateAccess: RequestHandler;
  readonly service: BookingAssignmentService;
}

/**
 * Worker order visibility under `/api/v1/workers`.
 */
export function createBookingWorkerVisibilityRouter(
  dependencies: BookingWorkerVisibilityRouterDependencies,
): Router {
  const controller = createBookingAssignmentController({
    service: dependencies.service,
  });
  const router = Router();
  router.use(dependencies.authenticateAccess);
  router.use(requireFullAuthentication);
  router.get("/me/assignments", (req, res, next) => {
    void controller.listMyAssignments(req, res, next);
  });
  return router;
}

import { Router, type RequestHandler } from "express";

import { createProviderAvailabilityController } from "./provider-availability.controller.js";
import type { ProviderCapacityService } from "./provider-capacity.service.js";
import type { ProviderAvailabilityService } from "./provider-availability.service.js";
import type { ProviderWorkerAvailabilityService } from "./provider-worker-availability.service.js";

/**
 * Protected Provider availability management router (R1-P10).
 * Exact paths per `contracts/http-api.md`.
 */
export function createProviderAvailabilityRouter(dependencies: {
  readonly authenticateAccess: RequestHandler;
  readonly service: ProviderAvailabilityService;
  readonly workerAvailabilityService: ProviderWorkerAvailabilityService;
  readonly capacityService: ProviderCapacityService;
}): Router {
  const controller = createProviderAvailabilityController(
    dependencies.service,
    dependencies.workerAvailabilityService,
    dependencies.capacityService,
  );
  const router = Router();
  router.use(dependencies.authenticateAccess);

  router.get("/:providerId/availability/coverage", (req, res, next) => {
    void controller.getCoverage(req, res, next);
  });
  router.put("/:providerId/availability/coverage", (req, res, next) => {
    void controller.replaceCoverage(req, res, next);
  });
  router.get("/:providerId/availability/calendar", (req, res, next) => {
    void controller.getCalendar(req, res, next);
  });
  router.put("/:providerId/availability/calendar", (req, res, next) => {
    void controller.replaceCalendar(req, res, next);
  });
  router.get("/:providerId/availability/workers/:workerId/calendar", (req, res, next) => {
    void controller.getWorkerCalendar(req, res, next);
  });
  router.put("/:providerId/availability/workers/:workerId/calendar", (req, res, next) => {
    void controller.replaceWorkerCalendar(req, res, next);
  });
  router.get("/:providerId/availability/capacity", (req, res, next) => {
    void controller.getCapacity(req, res, next);
  });
  router.put("/:providerId/availability/capacity", (req, res, next) => {
    void controller.replaceCapacity(req, res, next);
  });
  router.get("/:providerId/availability/pause", (req, res, next) => {
    void controller.getPause(req, res, next);
  });
  router.post("/:providerId/availability/pause", (req, res, next) => {
    void controller.startPause(req, res, next);
  });
  router.post("/:providerId/availability/pause/resume", (req, res, next) => {
    void controller.resumePause(req, res, next);
  });

  return router;
}

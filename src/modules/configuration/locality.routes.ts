import { Router, type RequestHandler } from "express";

import {
  createLocalityController,
  type LocalityControllerDependencies,
} from "./locality.controller.js";

/**
 * Protected staff Configuration locality/time-zone router (R1-P10).
 * Exact paths per `contracts/http-api.md`; no anonymous or Provider access.
 */
export function createLocalityRouter(
  dependencies: LocalityControllerDependencies & {
    readonly authenticateAccess: RequestHandler;
  },
): Router {
  const controller = createLocalityController(dependencies);
  const router = Router();
  router.use(dependencies.authenticateAccess);

  router.get("/countries/:countryId/cities", (req, res, next) => {
    void controller.listCities(req, res, next);
  });
  router.post("/countries/:countryId/cities", (req, res, next) => {
    void controller.createCity(req, res, next);
  });
  router.patch("/cities/:cityId", (req, res, next) => {
    void controller.patchCity(req, res, next);
  });
  router.get("/cities/:cityId/districts", (req, res, next) => {
    void controller.listDistricts(req, res, next);
  });
  router.post("/cities/:cityId/districts", (req, res, next) => {
    void controller.createDistrict(req, res, next);
  });
  router.patch("/districts/:districtId", (req, res, next) => {
    void controller.patchDistrict(req, res, next);
  });
  router.get("/countries/:countryId/time-zone", (req, res, next) => {
    void controller.getCountryTimeZone(req, res, next);
  });
  router.put("/countries/:countryId/time-zone", (req, res, next) => {
    void controller.putCountryTimeZone(req, res, next);
  });

  return router;
}

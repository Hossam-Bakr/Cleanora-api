import { Router, type RequestHandler } from "express";
import {
  createCatalogController,
  type CatalogControllerDependencies,
} from "./catalog.controller.js";
import {
  catalogServiceImageMulterErrorHandler,
  catalogServiceImageUpload,
  requireCatalogServiceImageFields,
} from "./catalog-media.multer.js";

/**
 * Protected staff Catalog management router.
 * No anonymous or customer Browse routes are registered in R1-P08.
 */
export function createCatalogRouter(
  dependencies: CatalogControllerDependencies & {
    readonly authenticateAccess: RequestHandler;
  },
): Router {
  const controller = createCatalogController(dependencies);
  const router = Router();
  router.use(dependencies.authenticateAccess);

  router.get("/categories", (req, res, next) => {
    void controller.listCategories(req, res, next);
  });
  router.post("/categories", (req, res, next) => {
    void controller.createCategory(req, res, next);
  });
  router.put("/categories/order", (req, res, next) => {
    void controller.replaceCategoryOrder(req, res, next);
  });
  router.get("/categories/:categoryId", (req, res, next) => {
    void controller.getCategory(req, res, next);
  });
  router.put("/categories/:categoryId", (req, res, next) => {
    void controller.replaceCategory(req, res, next);
  });
  router.post("/categories/:categoryId/lifecycle", (req, res, next) => {
    void controller.changeCategoryLifecycle(req, res, next);
  });

  router.get("/services", (req, res, next) => {
    void controller.listServices(req, res, next);
  });
  router.post("/services", (req, res, next) => {
    void controller.createService(req, res, next);
  });
  router.put("/services/order", (req, res, next) => {
    void controller.replaceServiceOrder(req, res, next);
  });
  router.get("/services/:serviceId", (req, res, next) => {
    void controller.getService(req, res, next);
  });
  router.put("/services/:serviceId", (req, res, next) => {
    void controller.moveService(req, res, next);
  });
  router.post("/services/:serviceId/lifecycle", (req, res, next) => {
    void controller.changeServiceLifecycle(req, res, next);
  });
  router.put("/services/:serviceId/configuration", (req, res, next) => {
    void controller.replaceServiceConfiguration(req, res, next);
  });
  router.put("/services/:serviceId/availability", (req, res, next) => {
    void controller.replaceServiceAvailability(req, res, next);
  });

  // Static media/order before parametric media/:associationId routes.
  router.put("/services/:serviceId/media/order", (req, res, next) => {
    void controller.reorderServiceMedia(req, res, next);
  });
  router.post(
    "/services/:serviceId/media/:associationId/remove",
    (req, res, next) => {
      void controller.removeServiceMedia(req, res, next);
    },
  );
  router.post(
    "/services/:serviceId/media",
    catalogServiceImageUpload,
    requireCatalogServiceImageFields,
    (req, res, next) => {
      void controller.uploadServiceMedia(req, res, next);
    },
  );
  router.use(catalogServiceImageMulterErrorHandler);

  return router;
}

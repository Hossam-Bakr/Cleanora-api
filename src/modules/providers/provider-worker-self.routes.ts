import { Router, type RequestHandler } from "express";

import { validateRequest } from "../../middlewares/validate-request.js";
import { createProviderWorkerSelfController } from "./provider-worker-self.controller.js";
import type { ProviderWorkerSelfService } from "./provider-worker-self.service.js";
import { workerLeaveCommandSchema } from "./provider-workforce.schema.js";

export function createProviderWorkerSelfRouter(dependencies: {
  readonly authenticateAccess: RequestHandler;
  readonly service: Pick<ProviderWorkerSelfService, "getCurrent" | "leave">;
}): Router {
  const router = Router();
  const controller = createProviderWorkerSelfController(dependencies.service);
  router.use(dependencies.authenticateAccess);
  router.get("/me", controller.getCurrent);
  router.post("/me/leave", validateRequest({ body: workerLeaveCommandSchema }), controller.leave);
  return router;
}

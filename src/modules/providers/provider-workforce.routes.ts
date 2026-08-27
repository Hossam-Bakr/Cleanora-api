import { Router, type RequestHandler } from "express";

import { validateRequest } from "../../middlewares/validate-request.js";
import { createProviderWorkforceController, type ProviderWorkforceCommandHttpService } from "./provider-workforce.controller.js";
import {
  providerWorkerAvatarMulterErrorHandler,
  providerWorkerAvatarUpload,
  requireProviderWorkerAvatarFields,
} from "./provider-workforce-avatar.multer.js";
import {
  createWorkerSchema,
  replaceWorkerProfileSchema,
  workerAvatarCommandSchema,
  workforceCursorQuerySchema,
  workforceProviderParamsSchema,
  workforceTeamParamsSchema,
  workforceWorkerParamsSchema,
  workerAdminMembershipCommandSchema,
  workerLifecycleCommandSchema,
  workerLoginAccessCommandSchema,
  replaceTeamNameSchema,
  teamDraftSchema,
  teamLifecycleCommandSchema,
  teamMembershipCommandSchema,
  teamSupervisorCommandSchema,
} from "./provider-workforce.schema.js";

export function createProviderWorkforceRouter(dependencies: {
  readonly authenticateAccess: RequestHandler;
  readonly service: ProviderWorkforceCommandHttpService;
}): Router {
  const router = Router();
  const controller = createProviderWorkforceController(dependencies.service);
  router.use(dependencies.authenticateAccess);
  router.get("/:providerId/workers", validateRequest({ params: workforceProviderParamsSchema, query: workforceCursorQuerySchema }), controller.listWorkers);
  router.post("/:providerId/workers", validateRequest({ params: workforceProviderParamsSchema, body: createWorkerSchema }), controller.createWorker);
  router.get("/:providerId/workers/:workerId", validateRequest({ params: workforceWorkerParamsSchema }), controller.getWorker);
  router.get("/:providerId/workers/:workerId/history", validateRequest({ params: workforceWorkerParamsSchema, query: workforceCursorQuerySchema }), controller.listWorkerHistory);
  router.put("/:providerId/workers/:workerId", validateRequest({ params: workforceWorkerParamsSchema, body: replaceWorkerProfileSchema }), controller.replaceWorker);
  router.post(
    "/:providerId/workers/:workerId/avatar",
    validateRequest({ params: workforceWorkerParamsSchema }),
    providerWorkerAvatarUpload,
    requireProviderWorkerAvatarFields,
    validateRequest({ body: workerAvatarCommandSchema }),
    controller.uploadAvatar,
    providerWorkerAvatarMulterErrorHandler,
  );
  router.delete(
    "/:providerId/workers/:workerId/avatar",
    validateRequest({ params: workforceWorkerParamsSchema, body: workerAvatarCommandSchema }),
    controller.removeAvatar,
  );
  router.post(
    "/:providerId/workers/:workerId/lifecycle-commands",
    validateRequest({ params: workforceWorkerParamsSchema, body: workerLifecycleCommandSchema }),
    controller.commandLifecycle,
  );
  router.post(
    "/:providerId/workers/:workerId/login-access-commands",
    validateRequest({ params: workforceWorkerParamsSchema, body: workerLoginAccessCommandSchema }),
    controller.commandLoginAccess,
  );
  router.post(
    "/:providerId/workers/:workerId/admin-membership-commands",
    validateRequest({ params: workforceWorkerParamsSchema, body: workerAdminMembershipCommandSchema }),
    controller.commandAdminMembership,
  );
  router.get("/:providerId/teams", validateRequest({ params: workforceProviderParamsSchema, query: workforceCursorQuerySchema }), controller.listTeams);
  router.post("/:providerId/teams", validateRequest({ params: workforceProviderParamsSchema, body: teamDraftSchema }), controller.createTeam);
  router.get("/:providerId/teams/:teamId", validateRequest({ params: workforceTeamParamsSchema }), controller.getTeam);
  router.put("/:providerId/teams/:teamId", validateRequest({ params: workforceTeamParamsSchema, body: replaceTeamNameSchema }), controller.replaceTeam);
  router.post("/:providerId/teams/:teamId/lifecycle-commands", validateRequest({ params: workforceTeamParamsSchema, body: teamLifecycleCommandSchema }), controller.commandTeamLifecycle);
  router.post("/:providerId/teams/:teamId/membership-commands", validateRequest({ params: workforceTeamParamsSchema, body: teamMembershipCommandSchema }), controller.commandTeamMembership);
  router.post("/:providerId/teams/:teamId/supervisor-commands", validateRequest({ params: workforceTeamParamsSchema, body: teamSupervisorCommandSchema }), controller.commandTeamSupervisor);
  router.get("/:providerId/teams/:teamId/history", validateRequest({ params: workforceTeamParamsSchema, query: workforceCursorQuerySchema }), controller.listTeamHistory);
  router.get("/:providerId/workforce-readiness", validateRequest({ params: workforceProviderParamsSchema }), controller.getWorkforceReadiness);
  return router;
}

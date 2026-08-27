import { Router, type RequestHandler } from "express";

import { validateRequest } from "../../middlewares/validate-request.js";
import {
  createProviderWorkforceInvitationController,
  type ProviderWorkforceInvitationHttpService,
} from "./provider-workforce-invitation.controller.js";
import {
  invitationAcceptSchema,
  invitationEmailVerificationSchema,
  invitationOnboardingStartSchema,
  invitationProofSchema,
} from "./provider-workforce.schema.js";

/** Mount this public/restricted family before ordinary /providers routes. */
export function createProviderWorkforceInvitationRouter(dependencies: {
  readonly authenticateAccess: RequestHandler;
  readonly service: ProviderWorkforceInvitationHttpService;
}): Router {
  const router = Router();
  const controller = createProviderWorkforceInvitationController(dependencies.service);
  router.post("/inspect", validateRequest({ body: invitationProofSchema }), controller.inspect);
  router.post(
    "/onboarding/start",
    validateRequest({ body: invitationOnboardingStartSchema }),
    controller.startOnboarding,
  );
  router.post(
    "/onboarding/verify-email",
    validateRequest({ body: invitationEmailVerificationSchema }),
    controller.verifyEmail,
  );
  router.post(
    "/accept",
    dependencies.authenticateAccess,
    validateRequest({ body: invitationAcceptSchema }),
    controller.accept,
  );
  return router;
}

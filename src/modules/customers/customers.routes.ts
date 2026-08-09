import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { validateRequest } from "#middlewares/validate-request";
import {
  companyProfileBody,
  addressIdParams,
  addressUpdateBody,
  addressWriteBody,
  engineerProfileBody,
  individualProfileBody,
  preferencesPutBody,
  privacyRequestIdParams,
  privacyRequestSubmitBody,
  profileImageDeleteBody,
  versionBody,
} from "./customers.schema.js";
import {
  createCustomersController,
  type CustomersControllerDependencies,
} from "./customers.controller.js";
import {
  mapMulterError,
  profileImageUpload,
  requireProfileImageMultipartFields,
} from "./profile-image.multer.js";

/**
 * Customer self-service routes for completed R1-P04 stories.
 * Multer is registered only on PUT /profile-image (DEC-033).
 */
export function createCustomersRouter(
  dependencies: CustomersControllerDependencies & {
    readonly authenticateAccess: RequestHandler;
  },
): Router {
  const controller = createCustomersController(dependencies);
  const router = Router();
  router.use(dependencies.authenticateAccess);
  router.get("/me/overview", controller.getOverview);
  router.get("/profiles/individual", controller.getIndividual);
  router.put(
    "/profiles/individual",
    validateRequest({ body: individualProfileBody }),
    controller.putIndividual,
  );
  router.get("/profiles/company", controller.getCompany);
  router.put(
    "/profiles/company",
    validateRequest({ body: companyProfileBody }),
    controller.putCompany,
  );
  router.get("/profiles/engineer", controller.getEngineer);
  router.put(
    "/profiles/engineer",
    validateRequest({ body: engineerProfileBody }),
    controller.putEngineer,
  );
  router.get("/profile-image", controller.getProfileImage);
  router.put(
    "/profile-image",
    (request, response, next) => {
      profileImageUpload(request, response, (error) => {
        if (error !== undefined) {
          next(mapMulterError(error) ?? error);
          return;
        }
        next();
      });
    },
    requireProfileImageMultipartFields,
    controller.putProfileImage,
  );
  router.delete(
    "/profile-image",
    validateRequest({ body: profileImageDeleteBody }),
    controller.deleteProfileImage,
  );
  router.get("/addresses", controller.listAddresses);
  router.post(
    "/addresses",
    validateRequest({ body: addressWriteBody }),
    controller.createAddress,
  );
  router.get(
    "/addresses/:addressId",
    validateRequest({ params: addressIdParams }),
    controller.getAddress,
  );
  router.put(
    "/addresses/:addressId",
    validateRequest({ params: addressIdParams, body: addressUpdateBody }),
    controller.updateAddress,
  );
  router.delete(
    "/addresses/:addressId",
    validateRequest({ params: addressIdParams, body: versionBody }),
    controller.deleteAddress,
  );
  router.get("/contact-state", controller.getContactState);
  router.get("/preferences", controller.getPreferences);
  router.put(
    "/preferences",
    validateRequest({ body: preferencesPutBody }),
    controller.putPreferences,
  );
  router.get("/privacy-requests", controller.listPrivacyRequests);
  router.post(
    "/privacy-requests",
    validateRequest({ body: privacyRequestSubmitBody }),
    controller.submitPrivacyRequest,
  );
  router.get(
    "/privacy-requests/:privacyRequestId",
    validateRequest({ params: privacyRequestIdParams }),
    controller.getPrivacyRequest,
  );
  router.post(
    "/privacy-requests/:privacyRequestId/cancel",
    validateRequest({ params: privacyRequestIdParams }),
    controller.cancelPrivacyRequest,
  );
  return router;
}

/** Exported for typed error-handler tests only. */
export type ProfileImageMulterErrorHandler = ErrorRequestHandler;

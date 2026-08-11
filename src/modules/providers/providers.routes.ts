import { createHmac } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";
import { validateRequest } from "#middlewares/validate-request";

import {
  createProviderAdminInvitationController,
  createProvidersController,
  createStaffProvidersController,
  type ProviderAdminInvitationControllerDependencies,
  type ProvidersControllerDependencies,
  type StaffProvidersControllerDependencies,
} from "./providers.controller.js";
import {
  providerImageUpload,
  providerMediaMulterErrorHandler,
  providerVideoUpload,
  requireProviderMediaMultipartFields,
} from "./provider-media.multer.js";
import {
  approveProviderApplicationBody,
  changeProviderKindBody,
  createInvitationBody,
  createProviderBody,
  invitationIdParams,
  invitationOnboardingStartBody,
  invitationTokenBody,
  invitationVerifyEmailBody,
  invitationVersionBody,
  listInvitationsQuery,
  listProvidersQuery,
  memberUserIdParams,
  providerGalleryItemParams,
  providerGalleryOrderBody,
  providerHistoryQuery,
  providerIdParams,
  providerMediaVersionBody,
  reasonedProviderVersionBody,
  replaceProviderContactsBody,
  replaceProviderProfileBody,
  staffApplicationsQuery,
  submitProviderApplicationBody,
} from "./providers.schema.js";

/** Bounded invitation token-route limits (FR-059, FR-086). */
export const PROVIDER_INVITATION_RATE_LIMITS = {
  inspect: { ip: [30, 900] as const },
  onboardingStart: { ip: [10, 900] as const },
  onboardingVerify: { ip: [20, 900] as const },
  accept: { ip: [20, 900] as const },
} as const;

/**
 * Provider-owned HTTP surface for R1-P05.
 * Staff and invitation token routers are mounted separately from composition.
 */
export function createProvidersRouter(
  dependencies: ProvidersControllerDependencies & {
    readonly authenticateAccess: RequestHandler;
  },
): Router {
  const controller = createProvidersController(dependencies);
  const router = Router();
  router.use(dependencies.authenticateAccess);

  router.post(
    "/",
    validateRequest({ body: createProviderBody }),
    controller.createProvider,
  );
  router.get(
    "/",
    validateRequest({ query: listProvidersQuery }),
    controller.listProviders,
  );
  router.get(
    "/:providerId/profile",
    validateRequest({ params: providerIdParams }),
    controller.getProfile,
  );
  router.put(
    "/:providerId/profile",
    validateRequest({ params: providerIdParams, body: replaceProviderProfileBody }),
    controller.replaceProfile,
  );
  router.get(
    "/:providerId/contacts",
    validateRequest({ params: providerIdParams }),
    controller.getContacts,
  );
  router.put(
    "/:providerId/contacts",
    validateRequest({ params: providerIdParams, body: replaceProviderContactsBody }),
    controller.replaceContacts,
  );
  router.get(
    "/:providerId/preview",
    validateRequest({ params: providerIdParams }),
    controller.getPreview,
  );
  router.get(
    "/:providerId/completion",
    validateRequest({ params: providerIdParams }),
    controller.getCompletion,
  );
  router.get(
    "/:providerId/readiness",
    validateRequest({ params: providerIdParams }),
    controller.getReadiness,
  );
  router.get(
    "/:providerId/history",
    validateRequest({ params: providerIdParams, query: providerHistoryQuery }),
    controller.listHistory,
  );
  router.get(
    "/:providerId/dashboard",
    validateRequest({ params: providerIdParams }),
    controller.getDashboard,
  );
  router.get(
    "/:providerId/settings",
    validateRequest({ params: providerIdParams }),
    controller.getSettings,
  );

  router.get(
    "/:providerId/media",
    validateRequest({ params: providerIdParams }),
    controller.listMedia,
  );
  router.put(
    "/:providerId/media/logo",
    validateRequest({ params: providerIdParams }),
    providerImageUpload,
    requireProviderMediaMultipartFields,
    controller.putLogo,
  );
  router.delete(
    "/:providerId/media/logo",
    validateRequest({ params: providerIdParams, body: providerMediaVersionBody }),
    controller.deleteLogo,
  );
  router.put(
    "/:providerId/media/cover",
    validateRequest({ params: providerIdParams }),
    providerImageUpload,
    requireProviderMediaMultipartFields,
    controller.putCover,
  );
  router.delete(
    "/:providerId/media/cover",
    validateRequest({ params: providerIdParams, body: providerMediaVersionBody }),
    controller.deleteCover,
  );
  router.post(
    "/:providerId/media/gallery-images",
    validateRequest({ params: providerIdParams }),
    providerImageUpload,
    requireProviderMediaMultipartFields,
    controller.addGalleryImage,
  );
  router.post(
    "/:providerId/media/gallery-videos",
    validateRequest({ params: providerIdParams }),
    providerVideoUpload,
    requireProviderMediaMultipartFields,
    controller.addGalleryVideo,
  );
  router.put(
    "/:providerId/media/gallery-order",
    validateRequest({
      params: providerIdParams,
      body: providerGalleryOrderBody,
    }),
    controller.reorderGallery,
  );
  router.delete(
    "/:providerId/media/gallery/:galleryItemId",
    validateRequest({
      params: providerGalleryItemParams,
      body: providerMediaVersionBody,
    }),
    controller.deleteGalleryItem,
  );

  router.get(
    "/:providerId/members",
    validateRequest({ params: providerIdParams }),
    controller.listMembers,
  );
  router.delete(
    "/:providerId/members/:userId",
    validateRequest({
      params: memberUserIdParams,
      body: invitationVersionBody,
    }),
    controller.disableMember,
  );
  router.get(
    "/:providerId/admin-invitations",
    validateRequest({
      params: providerIdParams,
      query: listInvitationsQuery,
    }),
    controller.listInvitations,
  );
  router.post(
    "/:providerId/admin-invitations",
    validateRequest({
      params: providerIdParams,
      body: createInvitationBody,
    }),
    controller.createInvitation,
  );
  router.post(
    "/:providerId/admin-invitations/:invitationId/resend",
    validateRequest({
      params: invitationIdParams,
      body: invitationVersionBody,
    }),
    controller.resendInvitation,
  );
  router.post(
    "/:providerId/admin-invitations/:invitationId/revoke",
    validateRequest({
      params: invitationIdParams,
      body: invitationVersionBody,
    }),
    controller.revokeInvitation,
  );

  router.get(
    "/:providerId",
    validateRequest({ params: providerIdParams }),
    controller.getProvider,
  );
  router.patch(
    "/:providerId/kind",
    validateRequest({ params: providerIdParams, body: changeProviderKindBody }),
    controller.changeKind,
  );
  router.post(
    "/:providerId/application/submit",
    validateRequest({
      params: providerIdParams,
      body: submitProviderApplicationBody,
    }),
    controller.submitApplication,
  );

  router.use(providerMediaMulterErrorHandler);

  return router;
}

/**
 * Staff Admin Provider review routes. Owned by providers, not admin.
 */
export function createStaffProvidersRouter(
  dependencies: StaffProvidersControllerDependencies & {
    readonly authenticateAccess: RequestHandler;
  },
): Router {
  const controller = createStaffProvidersController(dependencies);
  const router = Router();
  router.use(dependencies.authenticateAccess);

  router.get(
    "/applications",
    validateRequest({ query: staffApplicationsQuery }),
    controller.listApplications,
  );
  router.get(
    "/applications/:providerId",
    validateRequest({ params: providerIdParams }),
    controller.getDossier,
  );
  router.post(
    "/applications/:providerId/approve",
    validateRequest({
      params: providerIdParams,
      body: approveProviderApplicationBody,
    }),
    controller.approveApplication,
  );
  router.post(
    "/applications/:providerId/request-changes",
    validateRequest({
      params: providerIdParams,
      body: reasonedProviderVersionBody,
    }),
    controller.requestChanges,
  );
  router.post(
    "/applications/:providerId/reject",
    validateRequest({
      params: providerIdParams,
      body: reasonedProviderVersionBody,
    }),
    controller.rejectApplication,
  );
  router.post(
    "/:providerId/suspend",
    validateRequest({
      params: providerIdParams,
      body: reasonedProviderVersionBody,
    }),
    controller.suspendProvider,
  );
  router.post(
    "/:providerId/reinstate",
    validateRequest({
      params: providerIdParams,
      body: reasonedProviderVersionBody,
    }),
    controller.reinstateProvider,
  );

  return router;
}

/**
 * Body-token invitation flows that may run before full Provider authority.
 */
export function createProviderAdminInvitationRouter(
  dependencies: ProviderAdminInvitationControllerDependencies & {
    readonly authenticateAccess: RequestHandler;
    readonly rateLimiter: RateLimiterPort;
    readonly privacyHashSecret: string;
  },
): Router {
  const controller = createProviderAdminInvitationController(dependencies);
  const router = Router();
  const hashIp = (ip: string | undefined) =>
    createHmac("sha256", dependencies.privacyHashSecret)
      .update(ip ?? "missing")
      .digest("hex");

  router.post(
    "/inspect",
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: "providers.invitation.inspect",
      limit: PROVIDER_INVITATION_RATE_LIMITS.inspect.ip[0],
      windowSeconds: PROVIDER_INVITATION_RATE_LIMITS.inspect.ip[1],
      subject: (ip) => hashIp(ip),
    }),
    validateRequest({ body: invitationTokenBody }),
    controller.inspect,
  );
  router.post(
    "/onboarding/start",
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: "providers.invitation.onboarding.start",
      limit: PROVIDER_INVITATION_RATE_LIMITS.onboardingStart.ip[0],
      windowSeconds: PROVIDER_INVITATION_RATE_LIMITS.onboardingStart.ip[1],
      subject: (ip) => hashIp(ip),
    }),
    validateRequest({ body: invitationOnboardingStartBody }),
    controller.startOnboarding,
  );
  router.post(
    "/onboarding/verify-email",
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: "providers.invitation.onboarding.verify",
      limit: PROVIDER_INVITATION_RATE_LIMITS.onboardingVerify.ip[0],
      windowSeconds: PROVIDER_INVITATION_RATE_LIMITS.onboardingVerify.ip[1],
      subject: (ip) => hashIp(ip),
    }),
    validateRequest({ body: invitationVerifyEmailBody }),
    controller.verifyOnboardingEmail,
  );
  router.post(
    "/accept",
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter,
      scope: "providers.invitation.accept",
      limit: PROVIDER_INVITATION_RATE_LIMITS.accept.ip[0],
      windowSeconds: PROVIDER_INVITATION_RATE_LIMITS.accept.ip[1],
      subject: (ip) => hashIp(ip),
    }),
    dependencies.authenticateAccess,
    validateRequest({ body: invitationTokenBody }),
    controller.accept,
  );

  return router;
}

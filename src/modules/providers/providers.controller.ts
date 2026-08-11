import type { NextFunction, Request, Response } from "express";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { sendSuccess } from "#shared/http/api-response";
import { AppError } from "#shared/errors/app-error";
import type { ProviderApplicationService } from "./provider-application.service.js";
import type { ProviderInvitationAcceptanceService } from "./provider-invitation-acceptance.service.js";
import type { ProviderInvitationOnboardingService } from "./provider-invitation-onboarding.service.js";
import type { ProviderMediaService } from "./provider-media.service.js";
import type { ProviderMembershipService } from "./provider-membership.service.js";
import type { ProviderProfileService } from "./provider-profile.service.js";
import type { ProviderProjectionService } from "./provider-projection.service.js";
import type { ProviderKind } from "./domain/providers.types.js";
import { redactPrivateContactDetails } from "./provider.dto.js";

/**
 * Thin HTTP adapters for Provider routes.
 */
export interface ProvidersControllerDependencies {
  readonly applications: ProviderApplicationService;
  readonly profiles: ProviderProfileService;
  readonly media: ProviderMediaService;
  readonly projections: ProviderProjectionService;
  readonly membership?: ProviderMembershipService;
}

function requirePrincipal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (value === undefined) {
    throw new AppError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required",
      statusCode: 401,
    });
  }
  return value;
}

function providerIdParam(request: Request): string {
  const value = request.params["providerId"];
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      statusCode: 400,
      expose: true,
    });
  }
  return value;
}

function forwardError(error: unknown, next: NextFunction): void {
  if (error instanceof AppError && error.details !== undefined) {
    const redacted = redactPrivateContactDetails(
      error.details as Readonly<Record<string, unknown>>,
    );
    next(
      new AppError({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        expose: error.expose,
        ...(redacted === undefined ? {} : { details: redacted }),
      }),
    );
    return;
  }
  next(error);
}

/** Safe cross-provider denials are audited in services before reaching here. */

export function createProvidersController(
  dependencies: ProvidersControllerDependencies,
) {
  return {
    /**
     * @desc Create the caller's one Provider application draft.
     * @route POST /api/v1/providers
     * @access Authenticated eligible applicant
     */
    async createProvider(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { providerKind: ProviderKind };
        const result = await dependencies.applications.createApplication({
          principal,
          providerKind: body.providerKind,
          requestId: request.requestId,
        });
        sendSuccess(
          request,
          response,
          result.created ? 201 : 200,
          result.aggregate,
        );
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc List Providers visible to the authenticated actor.
     * @route GET /api/v1/providers
     * @access Authenticated applicant or member
     */
    async listProviders(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const query = request.query as { cursor?: string; limit?: number };
        const listed = await dependencies.applications.listOwnProviders({
          principal,
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined ? {} : { limit: query.limit }),
        });
        sendSuccess(request, response, 200, listed.items, {
          nextCursor: listed.nextCursor,
        });
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Get one authorized Provider private aggregate.
     * @route GET /api/v1/providers/{providerId}
     * @access Application Owner (membership/Staff in later stories)
     */
    async getProvider(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const aggregate = await dependencies.applications.getProvider({
          principal,
          providerId: providerIdParam(request),
        });
        sendSuccess(request, response, 200, aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Change Provider kind on a never-submitted draft.
     * @route PATCH /api/v1/providers/{providerId}/kind
     * @access Application Owner
     */
    async changeKind(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as {
          providerKind: ProviderKind;
          expectedVersion: number;
        };
        const aggregate = await dependencies.applications.changeKind({
          principal,
          providerId: providerIdParam(request),
          providerKind: body.providerKind,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Submit or resubmit a complete Provider application for review.
     * @route POST /api/v1/providers/{providerId}/application/submit
     * @access Application Owner
     */
    async submitApplication(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const result = await dependencies.applications.submitApplication({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result.aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Get editable Provider profile (no private contacts).
     * @route GET /api/v1/providers/{providerId}/profile
     * @access Application Owner / OWNER / ADMIN / Staff
     */
    async getProfile(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const profile = await dependencies.profiles.getProfile({
          principal,
          providerId: providerIdParam(request),
        });
        sendSuccess(request, response, 200, profile);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Full-replace editable Provider profile with CAS.
     * @route PUT /api/v1/providers/{providerId}/profile
     * @access Application Owner (editable) or OWNER/ADMIN (approved)
     */
    async replaceProfile(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as {
          displayNameAr: string;
          displayNameEn: string | null;
          descriptionAr: string;
          descriptionEn: string | null;
          countryCode: string;
          expectedVersion: number;
        };
        const profile = await dependencies.profiles.replaceProfile({
          principal,
          providerId: providerIdParam(request),
          ...body,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, profile);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Get private operational contacts.
     * @route GET /api/v1/providers/{providerId}/contacts
     * @access Application Owner / OWNER / ADMIN / Staff
     */
    async getContacts(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const contacts = await dependencies.profiles.getContacts({
          principal,
          providerId: providerIdParam(request),
        });
        sendSuccess(request, response, 200, contacts);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Full-replace private operational contacts with CAS.
     * @route PUT /api/v1/providers/{providerId}/contacts
     * @access Application Owner (editable) or OWNER/ADMIN (approved)
     */
    async replaceContacts(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as {
          operationalEmail: string;
          operationalPhone: string;
          channels: readonly {
            readonly type: "WHATSAPP" | "SOCIAL" | "WEBSITE" | "EXTERNAL_BOOKING";
            readonly value: string;
          }[];
          expectedVersion: number;
        };
        const contacts = await dependencies.profiles.replaceContacts({
          principal,
          providerId: providerIdParam(request),
          ...body,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, contacts);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Contact-free protected Provider preview.
     * @route GET /api/v1/providers/{providerId}/preview
     * @access Application Owner / OWNER / ADMIN / Staff
     */
    async getPreview(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const preview = await dependencies.profiles.getPreview({
          principal,
          providerId: providerIdParam(request),
        });
        sendSuccess(request, response, 200, preview);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Derived profile-completion projection (policy r1-p05-v1).
     * @route GET /api/v1/providers/{providerId}/completion
     */
    async getCompletion(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const completion = await dependencies.projections.getCompletion({
          principal,
          providerId: providerIdParam(request),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, completion);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Derived marketplace-readiness gates.
     * @route GET /api/v1/providers/{providerId}/readiness
     */
    async getReadiness(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const readiness = await dependencies.projections.getReadiness({
          principal,
          providerId: providerIdParam(request),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, readiness);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Bounded status-history page with cursor.
     * @route GET /api/v1/providers/{providerId}/history
     */
    async listHistory(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const query = request.query as {
          cursor?: string;
          limit?: number;
        };
        const page = await dependencies.projections.listHistory({
          principal,
          providerId: providerIdParam(request),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined ? {} : { limit: query.limit }),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, page.items, {
          nextCursor: page.nextCursor,
        });
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Bounded dashboard summary with next owner action.
     * @route GET /api/v1/providers/{providerId}/dashboard
     */
    async getDashboard(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const dashboard = await dependencies.projections.getDashboard({
          principal,
          providerId: providerIdParam(request),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, dashboard);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Capability-only settings projection (no settings store).
     * @route GET /api/v1/providers/{providerId}/settings
     */
    async getSettings(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const settings = await dependencies.projections.getSettings({
          principal,
          providerId: providerIdParam(request),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, settings);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc List Provider media slots and gallery with signed delivery.
     * @route GET /api/v1/providers/{providerId}/media
     */
    async listMedia(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const media = await dependencies.media.listMedia({
          principal,
          providerId: providerIdParam(request),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Replace Provider logo (multipart file + expectedVersion).
     * @route PUT /api/v1/providers/{providerId}/media/logo
     */
    async putLogo(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const file = request.file;
        if (file === undefined) {
          throw new AppError({
            code: "PROVIDER_MEDIA_INVALID",
            message: "Provider media is invalid",
            statusCode: 400,
            expose: true,
          });
        }
        const media = await dependencies.media.putLogo({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          bytes: file.buffer,
          contentType: file.mimetype,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Replace Provider cover (multipart file + expectedVersion).
     * @route PUT /api/v1/providers/{providerId}/media/cover
     */
    async putCover(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const file = request.file;
        if (file === undefined) {
          throw new AppError({
            code: "PROVIDER_MEDIA_INVALID",
            message: "Provider media is invalid",
            statusCode: 400,
            expose: true,
          });
        }
        const media = await dependencies.media.putCover({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          bytes: file.buffer,
          contentType: file.mimetype,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Add one gallery image.
     * @route POST /api/v1/providers/{providerId}/media/gallery-images
     */
    async addGalleryImage(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const file = request.file;
        if (file === undefined) {
          throw new AppError({
            code: "PROVIDER_MEDIA_INVALID",
            message: "Provider media is invalid",
            statusCode: 400,
            expose: true,
          });
        }
        const media = await dependencies.media.addGalleryImage({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          bytes: file.buffer,
          contentType: file.mimetype,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 201, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Add one gallery video.
     * @route POST /api/v1/providers/{providerId}/media/gallery-videos
     */
    async addGalleryVideo(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const file = request.file;
        if (file === undefined) {
          throw new AppError({
            code: "PROVIDER_MEDIA_INVALID",
            message: "Provider media is invalid",
            statusCode: 400,
            expose: true,
          });
        }
        const media = await dependencies.media.addGalleryVideo({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          bytes: file.buffer,
          contentType: file.mimetype,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 201, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Reorder gallery items (exact permutation).
     * @route PUT /api/v1/providers/{providerId}/media/gallery-order
     */
    async reorderGallery(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as {
          orderedGalleryItemIds: string[];
          expectedVersion: number;
        };
        const media = await dependencies.media.reorderGallery({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          orderedGalleryItemIds: body.orderedGalleryItemIds,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Clear logo slot.
     * @route DELETE /api/v1/providers/{providerId}/media/logo
     */
    async deleteLogo(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const media = await dependencies.media.deleteLogo({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Clear cover slot.
     * @route DELETE /api/v1/providers/{providerId}/media/cover
     */
    async deleteCover(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const media = await dependencies.media.deleteCover({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Delete one gallery item.
     * @route DELETE /api/v1/providers/{providerId}/media/gallery/{galleryItemId}
     */
    async deleteGalleryItem(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const galleryItemId = request.params["galleryItemId"];
        if (typeof galleryItemId !== "string" || galleryItemId.length === 0) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            statusCode: 400,
            expose: true,
          });
        }
        const media = await dependencies.media.deleteGalleryItem({
          principal,
          providerId: providerIdParam(request),
          galleryItemId,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, media);
      } catch (error) {
        forwardError(error, next);
      }
    },

    async listMembers(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const membership = requireMembership(dependencies);
        const members = await membership.listMembers({
          principal: requirePrincipal(response),
          providerId: providerIdParam(request),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, members);
      } catch (error) {
        forwardError(error, next);
      }
    },

    async disableMember(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const membership = requireMembership(dependencies);
        const body = request.body as { expectedVersion: number };
        const userId = request.params["userId"];
        if (typeof userId !== "string" || userId.length === 0) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            statusCode: 400,
            expose: true,
          });
        }
        const member = await membership.disableAdminMember({
          principal: requirePrincipal(response),
          providerId: providerIdParam(request),
          targetUserId: userId,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, { member });
      } catch (error) {
        forwardError(error, next);
      }
    },

    async listInvitations(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const membership = requireMembership(dependencies);
        const query = request.query as {
          cursor?: string;
          limit?: number;
          status?: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
        };
        const result = await membership.listInvitations({
          principal: requirePrincipal(response),
          providerId: providerIdParam(request),
          ...(query.status === undefined ? {} : { status: query.status }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined ? {} : { limit: query.limit }),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result.items, {
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        forwardError(error, next);
      }
    },

    async createInvitation(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const membership = requireMembership(dependencies);
        const body = request.body as {
          email: string;
          expectedVersion: number;
        };
        const result = await membership.createInvitation({
          principal: requirePrincipal(response),
          providerId: providerIdParam(request),
          email: body.email,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 202, result);
      } catch (error) {
        forwardError(error, next);
      }
    },

    async resendInvitation(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const membership = requireMembership(dependencies);
        const body = request.body as { expectedVersion: number };
        const invitationId = request.params["invitationId"];
        if (typeof invitationId !== "string" || invitationId.length === 0) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            statusCode: 400,
            expose: true,
          });
        }
        const result = await membership.resendInvitation({
          principal: requirePrincipal(response),
          providerId: providerIdParam(request),
          invitationId,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 202, result);
      } catch (error) {
        forwardError(error, next);
      }
    },

    async revokeInvitation(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const membership = requireMembership(dependencies);
        const body = request.body as { expectedVersion: number };
        const invitationId = request.params["invitationId"];
        if (typeof invitationId !== "string" || invitationId.length === 0) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            statusCode: 400,
            expose: true,
          });
        }
        const invitation = await membership.revokeInvitation({
          principal: requirePrincipal(response),
          providerId: providerIdParam(request),
          invitationId,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, { invitation });
      } catch (error) {
        forwardError(error, next);
      }
    },
  };
}

function requireMembership(
  dependencies: ProvidersControllerDependencies,
): ProviderMembershipService {
  if (dependencies.membership === undefined) {
    throw new AppError({
      code: "PROVIDER_DEPENDENCY_UNAVAILABLE",
      message: "A required Provider dependency is unavailable",
      statusCode: 503,
      expose: true,
    });
  }
  return dependencies.membership;
}

export interface ProviderAdminInvitationControllerDependencies {
  readonly acceptance: ProviderInvitationAcceptanceService;
  readonly onboarding: ProviderInvitationOnboardingService;
}

export function createProviderAdminInvitationController(
  dependencies: ProviderAdminInvitationControllerDependencies,
) {
  return {
    async inspect(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = request.body as { token: string };
        const inspection = await dependencies.acceptance.inspect({
          token: body.token,
        });
        sendSuccess(request, response, 200, inspection);
      } catch (error) {
        forwardError(error, next);
      }
    },

    async startOnboarding(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = request.body as {
          token: string;
          phone: string;
          password: string;
        };
        const challenge = await dependencies.onboarding.start(body);
        sendSuccess(request, response, 202, challenge);
      } catch (error) {
        forwardError(error, next);
      }
    },

    async verifyOnboardingEmail(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = request.body as {
          token: string;
          challengeId: string;
          code: string;
        };
        const principal = await dependencies.onboarding.verifyEmail(body);
        sendSuccess(request, response, 200, {
          userId: principal.userId,
          emailNormalized: principal.emailNormalized,
          capability: principal.capability,
          allowedActions: principal.allowedActions,
          accessToken: principal.accessToken,
          accessExpiresAt: principal.accessExpiresAt.toISOString(),
          refreshToken: principal.refreshToken,
          refreshExpiresAt: principal.refreshExpiresAt.toISOString(),
        });
      } catch (error) {
        forwardError(error, next);
      }
    },

    async accept(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = request.body as { token: string };
        const result = await dependencies.acceptance.accept({
          principal: requirePrincipal(response),
          token: body.token,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result);
      } catch (error) {
        forwardError(error, next);
      }
    },
  };
}

export interface StaffProvidersControllerDependencies {
  readonly reviewQuery: import("./provider-review-query.service.js").ProviderReviewQueryService;
  readonly approval: import("./provider-approval.service.js").ProviderApprovalService;
  readonly review: import("./provider-review.service.js").ProviderReviewService;
  readonly lifecycle: import("./provider-lifecycle.service.js").ProviderLifecycleService;
}

/**
 * Thin HTTP adapters for Staff Provider review routes.
 */
export function createStaffProvidersController(
  dependencies: StaffProvidersControllerDependencies,
) {
  return {
    /**
     * @desc Deterministic Staff application review queue.
     * @route GET /api/v1/staff/providers/applications
     * @access Staff Admin with providers.applications.review
     */
    async listApplications(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const query = request.query as {
          status?:
            | "DRAFT"
            | "PENDING_REVIEW"
            | "CHANGES_REQUESTED"
            | "APPROVED"
            | "REJECTED";
          providerKind?: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY";
          submittedFrom?: Date;
          submittedTo?: Date;
          cursor?: string;
          limit?: number;
        };
        const page = await dependencies.reviewQuery.listApplications({
          principal,
          ...(query.status === undefined ? {} : { status: query.status }),
          ...(query.providerKind === undefined
            ? {}
            : { providerKind: query.providerKind }),
          ...(query.submittedFrom === undefined
            ? {}
            : { submittedFrom: query.submittedFrom }),
          ...(query.submittedTo === undefined
            ? {}
            : { submittedTo: query.submittedTo }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined ? {} : { limit: query.limit }),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, page.items, {
          nextCursor: page.nextCursor,
        });
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Private Staff dossier for one application.
     * @route GET /api/v1/staff/providers/applications/{providerId}
     */
    async getDossier(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const dossier = await dependencies.reviewQuery.getDossier({
          principal,
          providerId: providerIdParam(request),
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, dossier);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Approve a pending Provider application atomically.
     * @route POST /api/v1/staff/providers/applications/{providerId}/approve
     */
    async approveApplication(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { expectedVersion: number };
        const result = await dependencies.approval.approveApplication({
          principal,
          providerId: providerIdParam(request),
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result.aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Request reasoned changes on a pending application.
     * @route POST /api/v1/staff/providers/applications/{providerId}/request-changes
     */
    async requestChanges(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { reason: string; expectedVersion: number };
        const result = await dependencies.review.requestChanges({
          principal,
          providerId: providerIdParam(request),
          reason: body.reason,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result.aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Terminal reject a pending application.
     * @route POST /api/v1/staff/providers/applications/{providerId}/reject
     */
    async rejectApplication(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { reason: string; expectedVersion: number };
        const result = await dependencies.review.rejectApplication({
          principal,
          providerId: providerIdParam(request),
          reason: body.reason,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result.aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Suspend an approved Provider (INACTIVE -> SUSPENDED).
     * @route POST /api/v1/staff/providers/{providerId}/suspend
     * @access Staff Admin with providers.lifecycle.manage
     * @explanation Blocks operate/public eligibility; OWNER/ADMIN may still remediate.
     */
    async suspendProvider(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { reason: string; expectedVersion: number };
        const result = await dependencies.lifecycle.suspendProvider({
          principal,
          providerId: providerIdParam(request),
          reason: body.reason,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result.aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },

    /**
     * @desc Reinstate a suspended Provider to INACTIVE only (never LIVE).
     * @route POST /api/v1/staff/providers/{providerId}/reinstate
     * @access Staff Admin with providers.lifecycle.manage
     * @explanation R1-P05 reinstatement never restores LIVE (SC-009).
     */
    async reinstateProvider(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const principal = requirePrincipal(response);
        const body = request.body as { reason: string; expectedVersion: number };
        const result = await dependencies.lifecycle.reinstateProvider({
          principal,
          providerId: providerIdParam(request),
          reason: body.reason,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
        });
        sendSuccess(request, response, 200, result.aggregate);
      } catch (error) {
        forwardError(error, next);
      }
    },
  };
}

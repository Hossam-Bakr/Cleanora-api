import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { AppError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";
import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import type { ProviderWorkforceInvitationAcceptanceService } from "./provider-workforce-invitation-acceptance.service.js";
import type { ProviderWorkforceInvitationQueryService } from "./provider-workforce-invitation-query.service.js";
import type { ProviderWorkforceOnboardingService } from "./provider-workforce-onboarding.service.js";
import type {
  invitationAcceptSchema,
  invitationEmailVerificationSchema,
  invitationOnboardingStartSchema,
  invitationProofSchema,
} from "./provider-workforce.schema.js";

export interface ProviderWorkforceInvitationHttpService {
  readonly query: Pick<ProviderWorkforceInvitationQueryService, "inspect">;
  readonly onboarding: Pick<ProviderWorkforceOnboardingService, "start" | "verifyEmail">;
  readonly acceptance: Pick<ProviderWorkforceInvitationAcceptanceService, "accept">;
}

type InspectBody = z.infer<typeof invitationProofSchema>;
type StartBody = z.infer<typeof invitationOnboardingStartSchema>;
type VerifyBody = z.infer<typeof invitationEmailVerificationSchema>;
type AcceptBody = z.infer<typeof invitationAcceptSchema>;

function principal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as AuthenticationPrincipal | undefined;
  if (value === undefined) throw new WorkforcePolicyError("AUTHENTICATION_REQUIRED");
  return value;
}

function workforceAppError(error: WorkforcePolicyError): AppError {
  const status: Readonly<Record<string, number>> = {
    WORKFORCE_VALIDATION_FAILED: 400,
    WORKER_INVITATION_INVALID: 400,
    AUTHENTICATION_REQUIRED: 401,
    WORKFORCE_PERMISSION_DENIED: 403,
    WORKFORCE_STATE_CONFLICT: 409,
    WORKFORCE_DEPENDENCY_NOT_READY: 503,
  };
  return new AppError({
    code: error.code,
    message: error.code,
    statusCode: status[error.code] ?? 409,
    expose: true,
    ...(error.safeDetails === undefined ? {} : { details: error.safeDetails }),
  });
}

function forwardSecretSafe(error: unknown, next: NextFunction): void {
  if (error instanceof WorkforcePolicyError) {
    next(workforceAppError(error));
    return;
  }
  if (error instanceof AppError && error.code === "AUTH_PROVIDER_UNAVAILABLE") {
    next(workforceAppError(new WorkforcePolicyError("WORKFORCE_DEPENDENCY_NOT_READY")));
    return;
  }
  if (error instanceof AppError && error.code.startsWith("AUTH_")) {
    next(workforceAppError(new WorkforcePolicyError("WORKER_INVITATION_INVALID")));
    return;
  }
  next(error);
}

function noStore(response: Response): void {
  response.setHeader("Cache-Control", "no-store, private");
  response.setHeader("Pragma", "no-cache");
}

export function createProviderWorkforceInvitationController(
  service: ProviderWorkforceInvitationHttpService,
) {
  return {
    async inspect(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const result = await service.query.inspect(request.body as InspectBody);
        noStore(response);
        sendSuccess(request, response, 200, result);
      } catch (error) { forwardSecretSafe(error, next); }
    },

    async startOnboarding(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const result = await service.onboarding.start(request.body as StartBody);
        noStore(response);
        sendSuccess(request, response, 200, {
          ...result,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (error) { forwardSecretSafe(error, next); }
    },

    async verifyEmail(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const result = await service.onboarding.verifyEmail(request.body as VerifyBody);
        noStore(response);
        sendSuccess(request, response, 200, {
          userId: result.principal.userId,
          emailNormalized: result.emailNormalized,
          capability: result.capability,
          allowedActions: result.allowedActions,
          accessToken: result.accessToken,
          accessExpiresAt: result.accessExpiresAt.toISOString(),
          refreshToken: result.refreshToken,
          refreshExpiresAt: result.refreshExpiresAt.toISOString(),
        });
      } catch (error) { forwardSecretSafe(error, next); }
    },

    async accept(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const result = await service.acceptance.accept({
          ...(request.body as AcceptBody),
          principal: principal(response),
          requestId: request.requestId,
        });
        noStore(response);
        sendSuccess(request, response, 200, result);
      } catch (error) { forwardSecretSafe(error, next); }
    },
  };
}

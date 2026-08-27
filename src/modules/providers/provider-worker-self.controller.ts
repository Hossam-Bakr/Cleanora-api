import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { AppError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";
import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import type { ProviderWorkerSelfService } from "./provider-worker-self.service.js";
import type { workerLeaveCommandSchema } from "./provider-workforce.schema.js";

type WorkerLeaveBody = z.infer<typeof workerLeaveCommandSchema>;

function principal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as AuthenticationPrincipal | undefined;
  if (value === undefined) throw new WorkforcePolicyError("AUTHENTICATION_REQUIRED");
  return value;
}

function forward(error: unknown, next: NextFunction): void {
  if (error instanceof WorkforcePolicyError) {
    const statusByCode: Readonly<Record<string, number>> = {
      AUTHENTICATION_REQUIRED: 401,
      WORKFORCE_RESOURCE_NOT_FOUND: 404,
      WORKFORCE_STATE_CONFLICT: 409,
      WORKFORCE_INVALID_WORKER_TRANSITION: 409,
    };
    next(new AppError({
      code: error.code,
      message: error.code,
      statusCode: statusByCode[error.code] ?? 409,
      expose: true,
      ...(error.safeDetails === undefined ? {} : { details: error.safeDetails }),
    }));
    return;
  }
  next(error);
}

export function createProviderWorkerSelfController(service: Pick<ProviderWorkerSelfService, "getCurrent" | "leave">) {
  return {
    async getCurrent(_request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const result = await service.getCurrent(actor.userId);
        response.setHeader("Cache-Control", "no-store");
        sendSuccess(_request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async leave(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as WorkerLeaveBody;
        const result = await service.leave({
          actorUserId: actor.userId,
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          ...(body.expectedTeamVersion === undefined ? {} : { expectedTeamVersion: body.expectedTeamVersion }),
          ...(body.expectedMembershipVersion === undefined ? {} : { expectedMembershipVersion: body.expectedMembershipVersion }),
          confirmTeamImpact: body.confirmTeamImpact ?? false,
          confirmReadinessImpact: body.confirmReadinessImpact ?? false,
        });
        response.setHeader("Cache-Control", "no-store");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },
  };
}

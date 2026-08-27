import type { NextFunction, Request, Response } from "express";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { AppError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";
import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import type { ProviderWorkforceService } from "./provider-workforce.service.js";
import type { ProviderWorkforceMediaService } from "./provider-workforce-media.service.js";
import type { ProviderWorkforceLifecycleService } from "./provider-workforce-lifecycle.service.js";
import type { ProviderWorkforceInvitationService } from "./provider-workforce-invitation.service.js";
import type { ProviderWorkforceAccessService } from "./provider-workforce-access.service.js";
import type { ProviderWorkforceAuthorityService } from "./provider-workforce-authority.service.js";
import type { ProviderTeamService } from "./provider-team.service.js";
import type { ProviderTeamMembershipService } from "./provider-team-membership.service.js";
import type { ProviderTeamSupervisorService } from "./provider-team-supervisor.service.js";
import type { ProviderTeamQueryService } from "./provider-team-query.service.js";
import type { ProviderWorkforceReadinessService } from "./provider-workforce-readiness.service.js";
import type { ProviderWorkforceQueryService } from "./provider-workforce-query.service.js";
import type {
  createWorkerSchema,
  workerAdminMembershipCommandSchema,
  workerAvatarCommandSchema,
  workerLifecycleCommandSchema,
  workerLoginAccessCommandSchema,
  replaceTeamNameSchema,
  teamDraftSchema,
  teamLifecycleCommandSchema,
  teamMembershipCommandSchema,
  teamSupervisorCommandSchema,
} from "./provider-workforce.schema.js";
import type { z } from "zod";

export type ProviderWorkforceHttpService = Pick<
  ProviderWorkforceService,
  "createWorkerDraft" | "replaceWorkerProfile"
> & Pick<ProviderWorkforceQueryService, "listWorkers" | "getWorker" | "listWorkerHistory">
  & Pick<ProviderWorkforceMediaService, "upload" | "remove">;
export type ProviderWorkforceCommandHttpService = ProviderWorkforceHttpService & {
  readonly transitionWorkerLifecycle: ProviderWorkforceLifecycleService["transition"];
  readonly issueWorkerInvitation: ProviderWorkforceInvitationService["issue"];
  readonly resendWorkerInvitation: ProviderWorkforceInvitationService["resend"];
  readonly resetWorkerAccess: ProviderWorkforceAccessService["reset"];
  readonly revokeWorkerAccess: ProviderWorkforceAccessService["revoke"];
  readonly changeWorkerAdminMembership: ProviderWorkforceAuthorityService["change"];
  readonly createTeamDraft: ProviderTeamService["createDraft"];
  readonly replaceTeamName: ProviderTeamService["replaceName"];
  readonly transitionTeamLifecycle: ProviderTeamService["transition"];
  readonly changeTeamMembership: ProviderTeamMembershipService["change"];
  readonly changeTeamSupervisor: ProviderTeamSupervisorService["change"];
  readonly listTeams: ProviderTeamQueryService["list"];
  readonly getTeam: ProviderTeamQueryService["get"];
  readonly listTeamHistory: ProviderTeamQueryService["history"];
  readonly getWorkforceReadiness: ProviderWorkforceReadinessService["getForActor"];
};

type WorkerProfileBody = z.infer<typeof createWorkerSchema>;
type WorkerAvatarCommandBody = z.infer<typeof workerAvatarCommandSchema>;
type WorkerLifecycleCommandBody = z.infer<typeof workerLifecycleCommandSchema>;
type WorkerLoginAccessCommandBody = z.infer<typeof workerLoginAccessCommandSchema>;
type WorkerAdminMembershipCommandBody = z.infer<typeof workerAdminMembershipCommandSchema>;
type TeamDraftBody = z.infer<typeof teamDraftSchema>;
type ReplaceTeamNameBody = z.infer<typeof replaceTeamNameSchema>;
type TeamLifecycleBody = z.infer<typeof teamLifecycleCommandSchema>;
type TeamMembershipBody = z.infer<typeof teamMembershipCommandSchema>;
type TeamSupervisorBody = z.infer<typeof teamSupervisorCommandSchema>;

const statusByCode: Readonly<Record<string, number>> = {
  WORKFORCE_VALIDATION_FAILED: 400,
  WORKER_INVITATION_INVALID: 400,
  AUTHENTICATION_REQUIRED: 401,
  WORKFORCE_PERMISSION_DENIED: 403,
  WORKFORCE_RESOURCE_NOT_FOUND: 404,
  WORKFORCE_STATE_CONFLICT: 409,
  WORKFORCE_INVALID_WORKER_TRANSITION: 409,
  WORKFORCE_INVALID_ACCESS_TRANSITION: 409,
  WORKFORCE_INVALID_TEAM_TRANSITION: 409,
  WORKFORCE_TEAM_ACTIVATION_INVALID: 409,
  WORKFORCE_ESCORT_CANNOT_CLEAN: 409,
  WORKFORCE_SUPERVISOR_INVALID: 409,
  WORKFORCE_FINAL_CLEANER_CONFLICT: 409,
  WORKFORCE_REAUTHENTICATION_REQUIRED: 409,
  WORKFORCE_DEPENDENCY_NOT_READY: 503,
  WORKER_AVATAR_INVALID: 400,
};

function principal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as AuthenticationPrincipal | undefined;
  if (value === undefined) throw new WorkforcePolicyError("AUTHENTICATION_REQUIRED");
  return value;
}

function param(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || value.length === 0) throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED");
  return value;
}

function forward(error: unknown, next: NextFunction): void {
  if (error instanceof WorkforcePolicyError) {
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

export function createProviderWorkforceController(service: ProviderWorkforceCommandHttpService) {
  return {
    async createWorker(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as WorkerProfileBody;
        const { expectedVersion, idempotencyKey } = body;
        const result = await service.createWorkerDraft({
          actorUserId: actor.userId,
          sessionId: actor.sessionId,
          providerId: param(request, "providerId"),
          requestId: request.requestId,
          expectedVersion,
          idempotencyKey,
          profile: {
            fullLegalName: body.fullLegalName,
            gender: body.gender,
            operationalPhoneE164: body.operationalPhoneE164,
            workerType: body.workerType,
            displayTitle: body.displayTitle ?? null,
            supervisorCapable: body.supervisorCapable ?? false,
            skillTags: body.skillTags ?? [],
          },
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 201, result);
      } catch (error) { forward(error, next); }
    },

    async listWorkers(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as { readonly cursor?: string; readonly limit?: string | number };
        const result = await service.listWorkers({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async replaceWorker(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as WorkerProfileBody;
        const { expectedVersion, idempotencyKey, ...profile } = body;
        const result = await service.replaceWorkerProfile({
          actorUserId: actor.userId,
          sessionId: actor.sessionId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
          requestId: request.requestId,
          expectedVersion,
          idempotencyKey,
          profile,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async getWorker(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const result = await service.getWorker({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async listWorkerHistory(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as { readonly cursor?: string; readonly limit?: string | number };
        const result = await service.listWorkerHistory({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async uploadAvatar(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const file = request.file;
        if (file === undefined || !Buffer.isBuffer(file.buffer)) {
          throw new WorkforcePolicyError("WORKER_AVATAR_INVALID");
        }
        const body = request.body as WorkerAvatarCommandBody;
        const result = await service.upload({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          declaredContentType: file.mimetype,
          bytes: file.buffer,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 202, result);
      } catch (error) { forward(error, next); }
    },

    async removeAvatar(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as WorkerAvatarCommandBody;
        const result = await service.remove({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async commandLifecycle(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as WorkerLifecycleCommandBody;
        const common = {
          actorUserId: actor.userId,
          sessionId: actor.sessionId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
        };
        const result = body.action === "ACTIVATE" || body.action === "REACTIVATE"
          ? await service.transitionWorkerLifecycle({ ...common, action: body.action })
          : body.action === "DEACTIVATE"
            ? await service.transitionWorkerLifecycle({
              ...common,
              action: body.action,
              reasonCode: body.reasonCode,
              ...(body.note === undefined ? {} : { note: body.note }),
              confirmTeamImpact: body.confirmTeamImpact ?? false,
              confirmReadinessImpact: body.confirmReadinessImpact ?? false,
              ...(body.expectedTeamVersion === undefined ? {} : { expectedTeamVersion: body.expectedTeamVersion }),
              ...(body.expectedMembershipVersion === undefined ? {} : { expectedMembershipVersion: body.expectedMembershipVersion }),
            })
            : await service.transitionWorkerLifecycle({
              ...common,
              action: body.action,
              reasonCode: body.reasonCode,
              note: body.note,
              recentAuthenticationProof: body.recentAuthenticationProof,
              confirmTeamImpact: body.confirmTeamImpact ?? false,
              confirmReadinessImpact: body.confirmReadinessImpact ?? false,
              ...(body.expectedTeamVersion === undefined ? {} : { expectedTeamVersion: body.expectedTeamVersion }),
              ...(body.expectedMembershipVersion === undefined ? {} : { expectedMembershipVersion: body.expectedMembershipVersion }),
            });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async commandLoginAccess(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as WorkerLoginAccessCommandBody;
        const common = {
          actorUserId: actor.userId,
          sessionId: actor.sessionId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          expectedAccessVersion: body.expectedAccessVersion,
        };
        let result;
        let status = 200;
        if (body.action === "ISSUE_INVITATION" || body.action === "RESEND_INVITATION") {
          const command = {
            ...common,
            opaqueRecentAuthenticationProof: body.recentAuthenticationProof,
            email: body.email,
            locale: body.locale,
          };
          result = body.action === "ISSUE_INVITATION"
            ? await service.issueWorkerInvitation(command)
            : await service.resendWorkerInvitation(command);
          status = 201;
        } else if (body.action === "RESET_ACCESS") {
          result = await service.resetWorkerAccess({
            ...common,
            expectedAccessVersion: body.expectedAccessVersion,
            recentAuthenticationProof: body.recentAuthenticationProof,
            email: body.email,
            locale: body.locale,
          });
          status = 201;
        } else if (body.action === "REVOKE_ACCESS") {
          result = await service.revokeWorkerAccess({
            actorUserId: common.actorUserId,
            sessionId: common.sessionId,
            providerId: common.providerId,
            workerId: common.workerId,
            requestId: common.requestId,
            idempotencyKey: common.idempotencyKey,
            expectedVersion: common.expectedVersion,
            expectedAccessVersion: body.expectedAccessVersion,
            recentAuthenticationProof: body.recentAuthenticationProof,
            reasonCode: body.reasonCode,
            ...(body.note === undefined ? {} : { note: body.note }),
          });
        } else {
          throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED");
        }
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, status, result);
      } catch (error) { forward(error, next); }
    },

    async commandAdminMembership(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as WorkerAdminMembershipCommandBody;
        const common = {
          actorUserId: actor.userId,
          sessionId: actor.sessionId,
          providerId: param(request, "providerId"),
          workerId: param(request, "workerId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          recentAuthenticationProof: body.recentAuthenticationProof,
        };
        const result = body.action === "GRANT"
          ? await service.changeWorkerAdminMembership({
            ...common,
            action: body.action,
            expectedMembershipVersion: body.expectedMembershipVersion,
            reasonCode: body.reasonCode,
            ...(body.note === undefined ? {} : { note: body.note }),
          })
          : await service.changeWorkerAdminMembership({
            ...common,
            action: body.action,
            expectedMembershipVersion: body.expectedMembershipVersion,
            reasonCode: body.reasonCode,
            ...(body.note === undefined ? {} : { note: body.note }),
          });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async listTeams(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as { readonly cursor?: string; readonly limit?: string | number };
        const result = await service.listTeams({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async createTeam(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as TeamDraftBody;
        const result = await service.createTeamDraft({
          actorUserId: actor.userId, providerId: param(request, "providerId"), requestId: request.requestId,
          expectedVersion: body.expectedVersion, idempotencyKey: body.idempotencyKey, name: body.name ?? null,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 201, result);
      } catch (error) { forward(error, next); }
    },

    async getTeam(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const result = await service.getTeam({ actorUserId: actor.userId, providerId: param(request, "providerId"), teamId: param(request, "teamId") });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async replaceTeam(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as ReplaceTeamNameBody;
        const result = await service.replaceTeamName({
          actorUserId: actor.userId, providerId: param(request, "providerId"), teamId: param(request, "teamId"),
          requestId: request.requestId, expectedVersion: body.expectedVersion, idempotencyKey: body.idempotencyKey, name: body.name,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async commandTeamLifecycle(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as TeamLifecycleBody;
        const result = await service.transitionTeamLifecycle({
          actorUserId: actor.userId, providerId: param(request, "providerId"), teamId: param(request, "teamId"),
          requestId: request.requestId, expectedVersion: body.expectedVersion, idempotencyKey: body.idempotencyKey, action: body.action,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async commandTeamMembership(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as TeamMembershipBody;
        const common = {
          actorUserId: actor.userId, providerId: param(request, "providerId"), teamId: param(request, "teamId"),
          requestId: request.requestId, expectedVersion: body.expectedVersion, expectedWorkerVersion: body.expectedWorkerVersion,
          idempotencyKey: body.idempotencyKey, workerId: body.workerId,
        };
        const result = body.action === "ADD"
          ? await service.changeTeamMembership({ ...common, action: body.action, cleans: body.cleans })
          : body.action === "UPDATE_CLEANS"
            ? await service.changeTeamMembership({ ...common, action: body.action, membershipId: body.membershipId, cleans: body.cleans, expectedMembershipVersion: body.expectedMembershipVersion, confirmLastCleanerImpact: body.confirmLastCleanerImpact ?? false })
            : body.action === "REMOVE"
              ? await service.changeTeamMembership({ ...common, action: body.action, membershipId: body.membershipId, expectedMembershipVersion: body.expectedMembershipVersion, confirmLastCleanerImpact: body.confirmLastCleanerImpact ?? false })
              : await service.changeTeamMembership({ ...common, action: body.action, membershipId: body.membershipId, targetTeamId: body.targetTeamId, cleans: body.cleans, expectedMembershipVersion: body.expectedMembershipVersion, expectedTargetTeamVersion: body.expectedTargetTeamVersion, confirmLastCleanerImpact: body.confirmLastCleanerImpact ?? false });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, body.action === "ADD" ? 201 : 200, result);
      } catch (error) { forward(error, next); }
    },

    async commandTeamSupervisor(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as TeamSupervisorBody;
        const common = { actorUserId: actor.userId, providerId: param(request, "providerId"), teamId: param(request, "teamId"), requestId: request.requestId, expectedVersion: body.expectedVersion, idempotencyKey: body.idempotencyKey };
        const result = body.action === "CLEAR"
          ? await service.changeTeamSupervisor({ ...common, action: body.action })
          : body.expectedWorkerVersion == null || body.expectedMembershipVersion == null
            ? (() => { throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED"); })()
            : await service.changeTeamSupervisor({ ...common, action: body.action, workerId: body.workerId, expectedWorkerVersion: body.expectedWorkerVersion, expectedMembershipVersion: body.expectedMembershipVersion });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async listTeamHistory(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as { readonly cursor?: string; readonly limit?: string | number };
        const result = await service.listTeamHistory({ actorUserId: actor.userId, providerId: param(request, "providerId"), teamId: param(request, "teamId"), ...(query.cursor === undefined ? {} : { cursor: query.cursor }), ...(query.limit === undefined ? {} : { limit: Number(query.limit) }) });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },

    async getWorkforceReadiness(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const actor = principal(response);
        const result = await service.getWorkforceReadiness({ actorUserId: actor.userId, providerId: param(request, "providerId") });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) { forward(error, next); }
    },
  };
}

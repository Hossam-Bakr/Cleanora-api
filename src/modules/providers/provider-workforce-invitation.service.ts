import { randomUUID } from "node:crypto";

import type { WorkerRecentAuthenticationProofVerifier } from "../authentication/authentication.public.js";
import type { DenialAuditWriter } from "../admin/audit.public.js";
import type { ProvidersWorkforceUnitOfWorkPort, WorkforceLocale } from "./domain/provider-workforce.types.js";
import { fingerprintWorkforceCommand, validateReason, WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import type { WorkerInvitationProofPort } from "./domain/worker-invitation-proof.policy.js";
import { WORKER_INVITATION_TTL_MILLISECONDS } from "./domain/worker-invitation-proof.policy.js";
import { runWithWorkforceDenialAudit } from "./provider-workforce-denial-audit.service.js";

export interface IssueWorkerInvitationCommand {
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly providerId: string;
  readonly workerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly expectedAccessVersion: number | null;
  readonly opaqueRecentAuthenticationProof: string;
  readonly email: string;
  readonly locale: WorkforceLocale;
}

export interface RevokeWorkerInvitationCommand {
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly providerId: string;
  readonly workerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly expectedAccessVersion: number;
  readonly opaqueRecentAuthenticationProof: string;
  readonly reasonCode: import("./domain/provider-workforce.types.js").WorkerAccessRevocationReason;
  readonly note?: string | null;
}

function normalizeInvitationEmail(value: string): string {
  const email = value.trim().toLocaleLowerCase("en-US");
  if (email.length === 0 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "email" });
  }
  return email;
}

function safeCommandResult(value: Readonly<Record<string, unknown>> | null) {
  if (value === null
    || typeof value["outcomeCode"] !== "string"
    || typeof value["targetId"] !== "string"
    || typeof value["version"] !== "number"
    || !Array.isArray(value["impacts"])) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return {
    outcomeCode: value["outcomeCode"],
    targetId: value["targetId"],
    version: value["version"],
    impacts: value["impacts"],
  };
}

export class ProviderWorkforceInvitationService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly recentProof: WorkerRecentAuthenticationProofVerifier;
    readonly invitationProof: WorkerInvitationProofPort;
    readonly denialAudit?: DenialAuditWriter;
    readonly now?: () => Date;
    readonly createId?: () => string;
  }) {}

  public async issue(command: IssueWorkerInvitationCommand) {
    return this.runAuditedInvitation(command, "ISSUE", () => this.issueVersion(command, "ISSUE"));
  }

  public async resend(command: IssueWorkerInvitationCommand) {
    return this.runAuditedInvitation(command, "RESEND", async () => {
      if (command.expectedAccessVersion === null) {
        throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
      }
      return this.issueVersion(command, "RESEND");
    });
  }

  private async issueVersion(command: IssueWorkerInvitationCommand, action: "ISSUE" | "RESEND") {
    const emailNormalized = normalizeInvitationEmail(command.email);
    const now = this.dependencies.now?.() ?? new Date();
    const requestFingerprint = fingerprintWorkforceCommand({
      operation: action === "ISSUE" ? "ISSUE_WORKER_INVITATION" : "RESEND_WORKER_INVITATION",
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      expectedAccessVersion: command.expectedAccessVersion,
      emailNormalized,
      locale: command.locale,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:login-access`;
    const verified = await this.verifyRecentProof(command, "WORKER_ACCESS_ISSUE");

    return this.dependencies.unitOfWork.run(async (context) => {
      const idempotency = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.actorUserId,
      });
      if (idempotency.replay) return safeCommandResult(idempotency.result);
      const provider = await context.workforce.lockProvider(command.providerId);
      if (provider === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const membership = await context.workforce.readActorMembership(command.providerId, command.actorUserId);
      if (membership === null || !membership.active || membership.level !== "OWNER") {
        throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
      }
      const worker = await context.workforce.lockWorker(command.providerId, command.workerId);
      if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const consumed = await context.proofUseAuthorizer.assertConsumed({
        proofId: verified.proofId,
        actorUserId: command.actorUserId,
        purpose: "WORKER_ACCESS_ISSUE",
        providerId: command.providerId,
        workerId: command.workerId,
        requestId: command.requestId,
        maximumAgeSeconds: 600,
        now,
      });
      if (!consumed) throw new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");

      const latest = await context.workforce.getLatestInvitation(command.workerId);
      if (worker.identityUserId !== null || worker.access?.status === "ACTIVE") {
        throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
      }
      if (action === "RESEND" && (latest === null
        || (latest.status !== "PENDING"
          && latest.status !== "EXPIRED"
          && latest.status !== "REVOKED"))) {
        throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
      }
      if (latest !== null && worker.access !== null
        && (worker.access.currentInvitationId !== latest.id
          || (latest.status === "PENDING" && worker.access.status !== "INVITED")
          || (latest.status === "EXPIRED" && worker.access.status !== "EXPIRED")
          || (latest.status === "REVOKED" && worker.access.status !== "REVOKED"))) {
        throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
      }
      const invitationId = this.dependencies.createId?.() ?? randomUUID();
      const invitationVersion = (latest?.invitationVersion ?? 0) + 1;
      const issued = await context.workforce.issueInvitation({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: command.workerId,
        expectedWorkerVersion: command.expectedVersion,
        expectedAccessVersion: command.expectedAccessVersion,
        invitationId,
        invitationVersion,
        emailNormalized,
        locale: command.locale,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + WORKER_INVITATION_TTL_MILLISECONDS),
      });
      if (action === "RESEND" && latest?.status === "PENDING") {
        await context.history.append({
          providerId: command.providerId,
          targetType: "INVITATION",
          targetId: latest.id,
          targetVersion: latest.version + 1,
          eventCode: "WORKER_INVITATION_SUPERSEDED",
          actorUserId: command.actorUserId,
          safeBefore: { status: latest.status, version: latest.version },
          safeAfter: { status: "SUPERSEDED", version: latest.version + 1 },
          requestId: command.requestId,
        });
      }
      // Generate once as a local invariant check; the value is intentionally not
      // returned or persisted. Delivery regenerates it from the invitation row.
      this.dependencies.invitationProof.issue({
        invitationId: issued.invitation.id,
        invitationVersion: issued.invitation.invitationVersion,
        emailNormalized: issued.invitation.emailNormalized,
        locale: issued.invitation.locale,
        expiresAt: issued.invitation.expiresAt,
      });
      const invitationHistory = await context.history.append({
        providerId: command.providerId,
        targetType: "INVITATION",
        targetId: issued.invitation.id,
        targetVersion: issued.invitation.version,
        eventCode: action === "ISSUE" ? "WORKER_INVITATION_ISSUED" : "WORKER_INVITATION_RESENT",
        actorUserId: command.actorUserId,
        safeAfter: { status: issued.invitation.status, version: issued.invitation.version, locale: issued.invitation.locale },
        requestId: command.requestId,
      });
      await context.history.append({
        providerId: command.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: command.workerId,
        targetVersion: issued.worker.access?.version ?? 1,
        eventCode: "WORKER_LOGIN_ACCESS_INVITED",
        actorUserId: command.actorUserId,
        safeAfter: { status: issued.worker.access?.status ?? "INVITED", version: issued.worker.access?.version ?? 1 },
        requestId: command.requestId,
      });
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: action === "ISSUE"
          ? "providers.workforce.invitation.issue"
          : "providers.workforce.invitation.resend",
        targetType: "provider_worker_invitation",
        targetId: issued.invitation.id,
        context: { outcome: "SUCCEEDED", targetVersion: issued.invitation.version, workerVersion: issued.worker.version },
        requestId: command.requestId,
      });
      await context.notifications.insert({
        providerId: command.providerId,
        template: "INVITATION_ISSUED",
        locale: issued.invitation.locale,
        recipientEmailNormalized: issued.invitation.emailNormalized,
        invitationId: issued.invitation.id,
        historyId: invitationHistory.id,
        safeVariables: { invitationVersion: issued.invitation.invitationVersion },
        idempotencyKey: `worker-invitation:${issued.invitation.id}:issued`,
      });
      const result = {
        outcomeCode: action === "ISSUE" ? "WORKER_INVITATION_ISSUED" : "WORKER_INVITATION_RESENT",
        targetId: issued.invitation.id,
        version: issued.invitation.version,
        impacts: [{
          targetType: "LOGIN_ACCESS",
          targetId: command.workerId,
          outcomeCode: "WORKER_LOGIN_ACCESS_INVITED",
          version: issued.worker.access?.version ?? 1,
        }],
      } as const;
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: result.outcomeCode,
        safeResult: result,
      });
      return result;
    });
  }

  public async revoke(command: RevokeWorkerInvitationCommand) {
    return this.runAuditedInvitation(command, "REVOKE", () => this.executeRevoke(command));
  }

  private async executeRevoke(command: RevokeWorkerInvitationCommand) {
    validateReason("ACCESS_REVOKE", command.reasonCode, command.note ?? undefined);
    const now = this.dependencies.now?.() ?? new Date();
    const requestFingerprint = fingerprintWorkforceCommand({
      operation: "REVOKE_WORKER_INVITATION",
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      expectedAccessVersion: command.expectedAccessVersion,
      reasonCode: command.reasonCode,
      note: command.note?.trim() ?? null,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:login-access`;
    const verified = await this.verifyRecentProof(command, "WORKER_ACCESS_REVOKE");
    return this.dependencies.unitOfWork.run(async (context) => {
      const idempotency = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.actorUserId,
      });
      if (idempotency.replay) return safeCommandResult(idempotency.result);
      if (await context.workforce.lockProvider(command.providerId) === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const membership = await context.workforce.readActorMembership(command.providerId, command.actorUserId);
      if (membership === null || !membership.active || membership.level !== "OWNER") {
        throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
      }
      const worker = await context.workforce.lockWorker(command.providerId, command.workerId);
      if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (worker.version !== command.expectedVersion) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const consumed = await context.proofUseAuthorizer.assertConsumed({
        proofId: verified.proofId,
        actorUserId: command.actorUserId,
        purpose: "WORKER_ACCESS_REVOKE",
        providerId: command.providerId,
        workerId: command.workerId,
        requestId: command.requestId,
        maximumAgeSeconds: 600,
        now,
      });
      if (!consumed) throw new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");
      const invitation = await context.workforce.getLatestInvitation(command.workerId);
      if (invitation === null
        || invitation.status !== "PENDING"
        || worker.access?.status !== "INVITED"
        || worker.access.currentInvitationId !== invitation.id
        || worker.access.version !== command.expectedAccessVersion) {
        throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
      }
      const transitioned = await context.workforce.transitionInvitation({
        providerId: command.providerId,
        workerId: command.workerId,
        invitationId: invitation.id,
        expectedInvitationVersion: invitation.version,
        expectedAccessVersion: command.expectedAccessVersion,
        status: "REVOKED",
        transitionedAt: now,
      });
      const invitationHistory = await context.history.append({
        providerId: command.providerId,
        targetType: "INVITATION",
        targetId: transitioned.invitation.id,
        targetVersion: transitioned.invitation.version,
        eventCode: "WORKER_INVITATION_REVOKED",
        actorUserId: command.actorUserId,
        reasonCode: command.reasonCode,
        ...(command.note == null ? {} : { note: command.note.trim() }),
        safeBefore: { status: invitation.status, version: invitation.version },
        safeAfter: { status: transitioned.invitation.status, version: transitioned.invitation.version },
        requestId: command.requestId,
      });
      await context.history.append({
        providerId: command.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: command.workerId,
        targetVersion: transitioned.worker.access?.version ?? command.expectedAccessVersion + 1,
        eventCode: "WORKER_LOGIN_ACCESS_REVOKED",
        actorUserId: command.actorUserId,
        reasonCode: command.reasonCode,
        safeBefore: { status: worker.access.status, version: worker.access.version },
        safeAfter: {
          status: transitioned.worker.access?.status ?? "REVOKED",
          version: transitioned.worker.access?.version ?? command.expectedAccessVersion + 1,
        },
        requestId: command.requestId,
      });
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.workforce.invitation.revoke",
        targetType: "provider_worker_invitation",
        targetId: transitioned.invitation.id,
        context: {
          outcome: "SUCCEEDED",
          targetVersion: transitioned.invitation.version,
          workerVersion: transitioned.worker.version,
        },
        requestId: command.requestId,
      });
      await context.notifications.insert({
        providerId: command.providerId,
        template: "LOGIN_ACCESS_REVOKED",
        locale: transitioned.invitation.locale,
        recipientEmailNormalized: transitioned.invitation.emailNormalized,
        invitationId: transitioned.invitation.id,
        historyId: invitationHistory.id,
        safeVariables: { reasonCode: command.reasonCode },
        idempotencyKey: `worker-invitation:${transitioned.invitation.id}:revoked`,
      });
      const result = {
        outcomeCode: "WORKER_INVITATION_REVOKED",
        targetId: transitioned.invitation.id,
        version: transitioned.invitation.version,
        impacts: [{
          targetType: "LOGIN_ACCESS",
          targetId: command.workerId,
          outcomeCode: "WORKER_LOGIN_ACCESS_REVOKED",
          version: transitioned.worker.access?.version ?? command.expectedAccessVersion + 1,
        }],
      } as const;
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: result.outcomeCode,
        safeResult: result,
      });
      return result;
    });
  }

  private async verifyRecentProof(
    command: IssueWorkerInvitationCommand | RevokeWorkerInvitationCommand,
    purpose: "WORKER_ACCESS_ISSUE" | "WORKER_ACCESS_REVOKE",
  ) {
    try {
      return await this.dependencies.recentProof.verify({
        principalUserId: command.actorUserId,
        sessionId: command.sessionId,
        opaqueProof: command.opaqueRecentAuthenticationProof,
        purpose,
        providerId: command.providerId,
        workerId: command.workerId,
        requestId: command.requestId,
        maximumAgeSeconds: 600,
      });
    } catch {
      throw new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");
    }
  }

  private runAuditedInvitation<T>(
    command: IssueWorkerInvitationCommand | RevokeWorkerInvitationCommand,
    action: "ISSUE" | "RESEND" | "REVOKE",
    work: () => Promise<T>,
  ): Promise<T> {
    return runWithWorkforceDenialAudit(this.dependencies.denialAudit, {
      actorUserId: command.actorUserId,
      providerId: command.providerId,
      targetType: "worker_invitation",
      targetId: command.workerId,
      expectedVersion: command.expectedVersion,
      requestId: command.requestId,
      action: `providers.workforce.invitation.${action.toLocaleLowerCase("en-US")}.denied`,
    }, work);
  }
}

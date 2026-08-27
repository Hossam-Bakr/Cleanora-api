import { randomUUID } from "node:crypto";

import type { WorkerRecentAuthenticationProofVerifier } from "../authentication/authentication.public.js";
import type { DenialAuditWriter } from "../admin/audit.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerAccessRevocationReason,
  WorkforceLocale,
} from "./domain/provider-workforce.types.js";
import {
  assertWorkerAccessTransition,
  fingerprintWorkforceCommand,
  validateReason,
  WorkforcePolicyError,
} from "./domain/provider-workforce.policy.js";
import { resolveWorkforceLocale } from "./domain/provider-workforce-notification.policy.js";
import type { WorkerInvitationProofPort } from "./domain/worker-invitation-proof.policy.js";
import { WORKER_INVITATION_TTL_MILLISECONDS } from "./domain/worker-invitation-proof.policy.js";
import { runWithWorkforceDenialAudit } from "./provider-workforce-denial-audit.service.js";

interface AccessBaseCommand {
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly providerId: string;
  readonly workerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly expectedAccessVersion: number;
  readonly recentAuthenticationProof: string;
}

export interface ResetWorkerAccessCommand extends AccessBaseCommand {
  readonly email: string;
  readonly locale: WorkforceLocale;
}

export interface RevokeWorkerAccessCommand extends AccessBaseCommand {
  readonly reasonCode: WorkerAccessRevocationReason;
  readonly note?: string | null;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (normalized.length === 0 || normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "email" });
  }
  return normalized;
}

function safeReplay(value: Readonly<Record<string, unknown>> | null) {
  if (value === null
    || typeof value["outcomeCode"] !== "string"
    || typeof value["targetId"] !== "string"
    || typeof value["version"] !== "number"
    || !Array.isArray(value["impacts"])) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  return {
    outcomeCode: value["outcomeCode"],
    targetId: value["targetId"],
    version: value["version"],
    impacts: value["impacts"] as readonly Readonly<Record<string, unknown>>[],
  } as const;
}

export class ProviderWorkforceAccessService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly recentProof: WorkerRecentAuthenticationProofVerifier;
    readonly invitationProof: WorkerInvitationProofPort;
    readonly denialAudit?: DenialAuditWriter;
    readonly now?: () => Date;
    readonly createId?: () => string;
  }) {}

  public async reset(command: ResetWorkerAccessCommand) {
    return runWithWorkforceDenialAudit(this.dependencies.denialAudit, {
      actorUserId: command.actorUserId,
      providerId: command.providerId,
      targetType: "provider_worker_access",
      targetId: command.workerId,
      expectedVersion: command.expectedVersion,
      requestId: command.requestId,
      action: "providers.workforce.worker.access_reset.denied",
    }, () => this.executeReset(command));
  }

  private async executeReset(command: ResetWorkerAccessCommand) {
    const emailNormalized = normalizeEmail(command.email);
    const now = this.dependencies.now?.() ?? new Date();
    const fingerprint = fingerprintWorkforceCommand({
      operation: "RESET_WORKER_ACCESS",
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      expectedAccessVersion: command.expectedAccessVersion,
      emailNormalized,
      locale: command.locale,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:login-access`;
    const verified = await this.verify(command, "WORKER_ACCESS_RESET");
    return this.dependencies.unitOfWork.run(async (context) => {
      const replay = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: command.actorUserId,
      });
      if (replay.replay) return safeReplay(replay.result);
      const worker = await this.authorizeOwnerAndLock(context, command);
      if (worker.access?.status !== "ACTIVE"
        || worker.access.version !== command.expectedAccessVersion
        || worker.identityUserId === null) throw new WorkforcePolicyError("WORKFORCE_INVALID_ACCESS_TRANSITION");
      const identity = await context.identityReader.getIdentity(worker.identityUserId);
      if (identity === null || !identity.isAccountActive || identity.emailNormalized !== emailNormalized) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      await this.assertProof(context, command, verified.proofId, "WORKER_ACCESS_RESET", now);
      const latest = await context.workforce.getLatestInvitation(worker.id);
      if (latest === null || worker.access.currentInvitationId !== latest.id) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      const invitationId = this.dependencies.createId?.() ?? randomUUID();
      const issued = await context.workforce.issueInvitation({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: worker.id,
        expectedWorkerVersion: command.expectedVersion,
        expectedAccessVersion: command.expectedAccessVersion,
        invitationId,
        invitationVersion: latest.invitationVersion + 1,
        emailNormalized,
        locale: command.locale,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + WORKER_INVITATION_TTL_MILLISECONDS),
      });
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
        eventCode: "WORKER_ACCESS_RESET_INVITATION_ISSUED",
        actorUserId: command.actorUserId,
        safeAfter: { status: issued.invitation.status, version: issued.invitation.version, locale: issued.invitation.locale },
        requestId: command.requestId,
      });
      const accessVersion = issued.worker.access?.version ?? command.expectedAccessVersion + 1;
      await context.history.append({
        providerId: command.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: worker.id,
        targetVersion: accessVersion,
        eventCode: "WORKER_LOGIN_ACCESS_RESET",
        actorUserId: command.actorUserId,
        safeBefore: { status: worker.access.status, version: worker.access.version },
        safeAfter: { status: "INVITED", version: accessVersion, locale: issued.invitation.locale },
        requestId: command.requestId,
      });
      const remaining = await context.workforce.countActiveAccessForIdentity(worker.identityUserId);
      await context.identityAuthority.reconcileWorkerRole({ userId: worker.identityUserId, shouldBeEnabled: remaining > 0 });
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.workforce.login_access.reset",
        targetType: "provider_worker_login_access",
        targetId: worker.id,
        context: { outcome: "SUCCEEDED", providerId: command.providerId, targetVersion: accessVersion },
        requestId: command.requestId,
      });
      await context.notifications.insert({
        providerId: command.providerId,
        template: "LOGIN_ACCESS_RESET",
        locale: issued.invitation.locale,
        recipientEmailNormalized: issued.invitation.emailNormalized,
        invitationId: issued.invitation.id,
        historyId: invitationHistory.id,
        safeVariables: { invitationVersion: issued.invitation.invitationVersion },
        idempotencyKey: `worker-access:${worker.id}:reset:${accessVersion}`,
      });
      const result = {
        outcomeCode: "WORKER_LOGIN_ACCESS_RESET",
        targetId: issued.invitation.id,
        version: issued.invitation.version,
        impacts: [{ targetType: "LOGIN_ACCESS", targetId: worker.id, outcomeCode: "WORKER_LOGIN_ACCESS_INVITED", version: accessVersion }],
      } as const;
      await context.commands.accept({ scopeKey, idempotencyKey: command.idempotencyKey, safeResultCode: result.outcomeCode, safeResult: result });
      return result;
    });
  }

  public async revoke(command: RevokeWorkerAccessCommand) {
    return runWithWorkforceDenialAudit(this.dependencies.denialAudit, {
      actorUserId: command.actorUserId,
      providerId: command.providerId,
      targetType: "provider_worker_access",
      targetId: command.workerId,
      expectedVersion: command.expectedVersion,
      requestId: command.requestId,
      action: "providers.workforce.worker.access_revoke.denied",
    }, () => this.executeRevoke(command));
  }

  private async executeRevoke(command: RevokeWorkerAccessCommand) {
    validateReason("ACCESS_REVOKE", command.reasonCode, command.note ?? undefined);
    const now = this.dependencies.now?.() ?? new Date();
    const fingerprint = fingerprintWorkforceCommand({
      operation: "REVOKE_WORKER_ACCESS",
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      expectedAccessVersion: command.expectedAccessVersion,
      reasonCode: command.reasonCode,
      note: command.note?.trim() ?? null,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:login-access`;
    const verified = await this.verify(command, "WORKER_ACCESS_REVOKE");
    return this.dependencies.unitOfWork.run(async (context) => {
      const replay = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: command.actorUserId,
      });
      if (replay.replay) return safeReplay(replay.result);
      const worker = await this.authorizeOwnerAndLock(context, command);
      if (worker.access === null || worker.access.version !== command.expectedAccessVersion) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      assertWorkerAccessTransition(worker.access.status, "REVOKED");
      await this.assertProof(context, command, verified.proofId, "WORKER_ACCESS_REVOKE", now);
      let changed = worker;
      let invitationHistoryId: string | undefined;
      let recipientEmailNormalized: string | undefined;
      let invitationId: string | undefined;
      let locale: WorkforceLocale;
      if (worker.access.status === "INVITED") {
        const invitation = await context.workforce.getLatestInvitation(worker.id);
        if (invitation === null || invitation.status !== "PENDING" || worker.access.currentInvitationId !== invitation.id) {
          throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
        }
        const transitioned = await context.workforce.transitionInvitation({
          providerId: command.providerId,
          workerId: worker.id,
          invitationId: invitation.id,
          expectedInvitationVersion: invitation.version,
          expectedAccessVersion: command.expectedAccessVersion,
          status: "REVOKED",
          transitionedAt: now,
        });
        changed = transitioned.worker;
        invitationId = invitation.id;
        recipientEmailNormalized = invitation.emailNormalized;
        locale = invitation.locale;
        const invitationHistory = await context.history.append({
          providerId: command.providerId,
          targetType: "INVITATION",
          targetId: invitation.id,
          targetVersion: transitioned.invitation.version,
          eventCode: "WORKER_INVITATION_REVOKED",
          actorUserId: command.actorUserId,
          reasonCode: command.reasonCode,
          ...(command.note == null ? {} : { note: command.note.trim() }),
          safeBefore: { status: invitation.status, version: invitation.version, locale: invitation.locale },
          safeAfter: { status: transitioned.invitation.status, version: transitioned.invitation.version, locale: transitioned.invitation.locale },
          requestId: command.requestId,
        });
        invitationHistoryId = invitationHistory.id;
      } else {
        changed = await context.workforce.setWorkerAccessStatus({
          actorUserId: command.actorUserId,
          providerId: command.providerId,
          requestId: command.requestId,
          idempotencyKey: command.idempotencyKey,
          workerId: worker.id,
          expectedAccessVersion: command.expectedAccessVersion,
          status: "REVOKED",
          transitionedAt: now,
        });
        const identity = worker.identityUserId === null ? null : await context.identityReader.getIdentity(worker.identityUserId);
        locale = resolveWorkforceLocale({
          preferredLanguage: identity?.preferredLanguage,
          acceptedInvitationLocale: worker.acceptedInvitationLocale,
        });
      }
      const accessVersion = changed.access?.version ?? command.expectedAccessVersion + 1;
      const accessHistory = await context.history.append({
        providerId: command.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: worker.id,
        targetVersion: accessVersion,
        eventCode: "WORKER_LOGIN_ACCESS_REVOKED",
        actorUserId: command.actorUserId,
        reasonCode: command.reasonCode,
        ...(command.note == null ? {} : { note: command.note.trim() }),
        safeBefore: { status: worker.access.status, version: worker.access.version },
        safeAfter: { status: "REVOKED", version: accessVersion },
        requestId: command.requestId,
      });
      if (worker.identityUserId !== null) {
        const remaining = await context.workforce.countActiveAccessForIdentity(worker.identityUserId);
        await context.identityAuthority.reconcileWorkerRole({ userId: worker.identityUserId, shouldBeEnabled: remaining > 0 });
      }
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.workforce.login_access.revoke",
        targetType: "provider_worker_login_access",
        targetId: worker.id,
        context: { outcome: "SUCCEEDED", providerId: command.providerId, targetVersion: accessVersion, reasonCode: command.reasonCode },
        requestId: command.requestId,
      });
      await context.notifications.insert({
        providerId: command.providerId,
        template: "LOGIN_ACCESS_REVOKED",
        locale,
        ...(worker.identityUserId !== null
          ? { recipientUserId: worker.identityUserId }
          : recipientEmailNormalized === undefined
            ? {}
            : { recipientEmailNormalized }),
        ...(invitationId === undefined ? {} : { invitationId }),
        historyId: invitationHistoryId ?? accessHistory.id,
        safeVariables: { reasonCode: command.reasonCode },
        idempotencyKey: `worker-access:${worker.id}:revoked:${accessVersion}`,
      });
      const result = { outcomeCode: "WORKER_LOGIN_ACCESS_REVOKED", targetId: worker.id, version: accessVersion, impacts: [] } as const;
      await context.commands.accept({ scopeKey, idempotencyKey: command.idempotencyKey, safeResultCode: result.outcomeCode, safeResult: result });
      return result;
    });
  }

  private async verify(command: AccessBaseCommand, purpose: "WORKER_ACCESS_RESET" | "WORKER_ACCESS_REVOKE") {
    try {
      return await this.dependencies.recentProof.verify({
        principalUserId: command.actorUserId,
        sessionId: command.sessionId,
        opaqueProof: command.recentAuthenticationProof,
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

  private async authorizeOwnerAndLock(context: ProvidersWorkforceTransactionContext, command: AccessBaseCommand) {
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
    return worker;
  }

  private async assertProof(
    context: ProvidersWorkforceTransactionContext,
    command: AccessBaseCommand,
    proofId: string,
    purpose: "WORKER_ACCESS_RESET" | "WORKER_ACCESS_REVOKE",
    now: Date,
  ) {
    if (!await context.proofUseAuthorizer.assertConsumed({
      proofId,
      actorUserId: command.actorUserId,
      purpose,
      providerId: command.providerId,
      workerId: command.workerId,
      requestId: command.requestId,
      maximumAgeSeconds: 600,
      now,
    })) throw new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");
  }
}

import type { WorkerRecentAuthenticationProofVerifier } from "../authentication/authentication.public.js";
import type { DenialAuditWriter } from "../admin/audit.public.js";
import type {
  ProviderAdminGrantReason,
  ProviderAdminRevocationReason,
  ProvidersWorkforceUnitOfWorkPort,
} from "./domain/provider-workforce.types.js";
import { fingerprintWorkforceCommand, validateReason, WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import { resolveWorkforceLocale } from "./domain/provider-workforce-notification.policy.js";
import { runWithWorkforceDenialAudit } from "./provider-workforce-denial-audit.service.js";

interface AuthorityBaseCommand {
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly providerId: string;
  readonly workerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly recentAuthenticationProof: string;
}

export type ProviderAdminAuthorityCommand =
  | (AuthorityBaseCommand & {
    readonly action: "GRANT";
    readonly expectedMembershipVersion: number | null;
    readonly reasonCode: ProviderAdminGrantReason;
    readonly note?: string | null;
  })
  | (AuthorityBaseCommand & {
    readonly action: "REVOKE";
    readonly expectedMembershipVersion: number;
    readonly reasonCode: ProviderAdminRevocationReason;
    readonly note?: string | null;
  });

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

export class ProviderWorkforceAuthorityService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly recentProof: WorkerRecentAuthenticationProofVerifier;
    readonly denialAudit?: DenialAuditWriter;
    readonly now?: () => Date;
  }) {}

  public async change(command: ProviderAdminAuthorityCommand) {
    return runWithWorkforceDenialAudit(this.dependencies.denialAudit, {
      actorUserId: command.actorUserId,
      providerId: command.providerId,
      targetType: "provider_admin_membership",
      targetId: command.workerId,
      expectedVersion: command.expectedVersion,
      requestId: command.requestId,
      action: command.action === "GRANT"
        ? "providers.workforce.admin.grant.denied"
        : "providers.workforce.admin.revoke.denied",
    }, () => this.executeChange(command));
  }

  private async executeChange(command: ProviderAdminAuthorityCommand) {
    validateReason(command.action === "GRANT" ? "ADMIN_GRANT" : "ADMIN_REVOKE", command.reasonCode, command.note ?? undefined);
    const now = this.dependencies.now?.() ?? new Date();
    const purpose = command.action === "GRANT" ? "PROVIDER_ADMIN_GRANT" as const : "PROVIDER_ADMIN_REVOKE" as const;
    const fingerprint = fingerprintWorkforceCommand({
      operation: `PROVIDER_ADMIN_${command.action}`,
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      expectedMembershipVersion: command.expectedMembershipVersion,
      reasonCode: command.reasonCode,
      note: command.note?.trim() ?? null,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:admin-membership`;
    let verified: Awaited<ReturnType<WorkerRecentAuthenticationProofVerifier["verify"]>>;
    try {
      verified = await this.dependencies.recentProof.verify({
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
    return this.dependencies.unitOfWork.run(async (context) => {
      const replay = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: command.actorUserId,
      });
      if (replay.replay) return safeReplay(replay.result);
      if (await context.workforce.lockProvider(command.providerId) === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const actorMembership = await context.workforce.readActorMembership(command.providerId, command.actorUserId);
      if (actorMembership === null || !actorMembership.active || actorMembership.level !== "OWNER") {
        throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
      }
      const worker = await context.workforce.lockWorker(command.providerId, command.workerId);
      if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (worker.version !== command.expectedVersion) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      if (worker.identityUserId === null || worker.status === "REMOVED") {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      const identity = await context.identityReader.getIdentity(worker.identityUserId);
      if (identity === null || !identity.isAccountActive) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const membership = await context.workforce.lockProviderMember(command.providerId, worker.identityUserId);
      if (membership?.level === "OWNER") throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
      if (command.action === "GRANT") {
        if ((membership === null && command.expectedMembershipVersion !== null)
          || (membership !== null && (membership.active || membership.version !== command.expectedMembershipVersion))) {
          throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
        }
      } else if (membership === null || !membership.active || membership.version !== command.expectedMembershipVersion) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      if (!await context.proofUseAuthorizer.assertConsumed({
        proofId: verified.proofId,
        actorUserId: command.actorUserId,
        purpose,
        providerId: command.providerId,
        workerId: command.workerId,
        requestId: command.requestId,
        maximumAgeSeconds: 600,
        now,
      })) throw new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");
      const changed = await context.workforce.setProviderAdminMembership({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        userId: worker.identityUserId,
        expectedMembershipVersion: command.expectedMembershipVersion,
        active: command.action === "GRANT",
        changedAt: now,
      });
      const remaining = await context.workforce.countActiveAdminMemberships(worker.identityUserId);
      await context.identityAuthority.reconcileProviderAdminRole({
        userId: worker.identityUserId,
        shouldBeEnabled: remaining > 0,
      });
      const outcomeCode = command.action === "GRANT" ? "PROVIDER_ADMIN_GRANTED" : "PROVIDER_ADMIN_REVOKED";
      const history = await context.history.append({
        providerId: command.providerId,
        targetType: "ADMIN_MEMBERSHIP",
        targetId: changed.id,
        targetVersion: changed.version,
        eventCode: outcomeCode,
        actorUserId: command.actorUserId,
        reasonCode: command.reasonCode,
        ...(command.note == null ? {} : { note: command.note.trim() }),
        safeBefore: { status: membership?.active === true ? "ACTIVE" : membership === null ? "NONE" : "DISABLED", version: membership?.version ?? 0 },
        safeAfter: { status: changed.active ? "ACTIVE" : "DISABLED", version: changed.version },
        requestId: command.requestId,
      });
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: command.action === "GRANT"
          ? "providers.workforce.admin_membership.grant"
          : "providers.workforce.admin_membership.revoke",
        targetType: "provider_member",
        targetId: changed.id,
        context: { outcome: "SUCCEEDED", providerId: command.providerId, targetVersion: changed.version, reasonCode: command.reasonCode },
        requestId: command.requestId,
      });
      await context.notifications.insert({
        providerId: command.providerId,
        template: outcomeCode,
        locale: resolveWorkforceLocale({
          preferredLanguage: identity.preferredLanguage,
          acceptedInvitationLocale: worker.acceptedInvitationLocale,
        }),
        recipientUserId: worker.identityUserId,
        historyId: history.id,
        safeVariables: { membershipVersion: changed.version, reasonCode: command.reasonCode },
        idempotencyKey: `provider-admin:${changed.id}:${changed.version}`,
      });
      const result = { outcomeCode, targetId: changed.id, version: changed.version, impacts: [] } as const;
      await context.commands.accept({ scopeKey, idempotencyKey: command.idempotencyKey, safeResultCode: outcomeCode, safeResult: result });
      return result;
    });
  }
}

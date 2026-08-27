import type { WorkerRecentAuthenticationProofVerifier } from "../authentication/authentication.public.js";
import type { DenialAuditWriter } from "../admin/audit.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerDeactivationReason,
  WorkerRemovalReason,
  WorkerSnapshot,
} from "./domain/provider-workforce.types.js";
import {
  assertWorkerTransition,
  fingerprintWorkforceCommand,
  isQualifyingWorker,
  validateReason,
  validateWorkerProfile,
  WorkforcePolicyError,
} from "./domain/provider-workforce.policy.js";
import { resolveWorkforceLocale } from "./domain/provider-workforce-notification.policy.js";
import { decideWorkforceAuthorization } from "./domain/provider-workforce-authorization.policy.js";
import {
  evaluateLockedTeamCleanerImpact,
  lockCurrentTeamMembership,
} from "./provider-workforce-impact.service.js";
import { runWithWorkforceDenialAudit } from "./provider-workforce-denial-audit.service.js";

interface LifecycleBaseCommand {
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly providerId: string;
  readonly workerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
}

export type WorkerLifecycleCommand =
  | (LifecycleBaseCommand & { readonly action: "ACTIVATE" | "REACTIVATE" })
  | (LifecycleBaseCommand & {
    readonly action: "DEACTIVATE";
    readonly reasonCode: WorkerDeactivationReason;
    readonly note?: string | null;
    readonly confirmTeamImpact: boolean;
    readonly confirmReadinessImpact: boolean;
    readonly expectedTeamVersion?: number | null;
    readonly expectedMembershipVersion?: number | null;
  })
  | (LifecycleBaseCommand & {
    readonly action: "REMOVE";
    readonly reasonCode: WorkerRemovalReason;
    readonly note: string;
    readonly recentAuthenticationProof: string;
    readonly confirmTeamImpact: boolean;
    readonly confirmReadinessImpact: boolean;
    readonly expectedTeamVersion?: number | null;
    readonly expectedMembershipVersion?: number | null;
  });

function replayTarget(result: Readonly<Record<string, unknown>> | null): string {
  const targetId = result?.["targetId"];
  if (typeof targetId !== "string") throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  return targetId;
}

function replayResult(result: Readonly<Record<string, unknown>> | null) {
  if (result === null
    || typeof result["outcomeCode"] !== "string"
    || typeof result["targetId"] !== "string"
    || typeof result["version"] !== "number"
    || !Array.isArray(result["impacts"])) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return {
    outcomeCode: result["outcomeCode"],
    targetId: result["targetId"],
    version: result["version"],
    impacts: result["impacts"] as readonly Readonly<Record<string, unknown>>[],
  } as const;
}

function safeResultFor(outcomeCode: string, worker: WorkerSnapshot, impacts: readonly Readonly<Record<string, unknown>>[] = []) {
  return { outcomeCode, targetId: worker.id, version: worker.version, impacts } as const;
}

export class ProviderWorkforceLifecycleService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly recentProof: WorkerRecentAuthenticationProofVerifier;
    readonly denialAudit?: DenialAuditWriter;
    readonly now?: () => Date;
  }) {}

  public async transition(command: WorkerLifecycleCommand) {
    if (command.action !== "REMOVE") return this.executeTransition(command);
    return runWithWorkforceDenialAudit(this.dependencies.denialAudit, {
      actorUserId: command.actorUserId,
      providerId: command.providerId,
      targetType: "provider_worker",
      targetId: command.workerId,
      expectedVersion: command.expectedVersion,
      requestId: command.requestId,
      action: "providers.workforce.worker.remove.denied",
    }, () => this.executeTransition(command));
  }

  private async executeTransition(command: WorkerLifecycleCommand) {
    const now = this.dependencies.now?.() ?? new Date();
    const targetStatus = command.action === "DEACTIVATE"
      ? "INACTIVE" as const
      : command.action === "REMOVE"
        ? "REMOVED" as const
        : "ACTIVE" as const;
    if (command.action === "DEACTIVATE") {
      validateReason("WORKER_DEACTIVATE", command.reasonCode, command.note ?? undefined);
    } else if (command.action === "REMOVE") {
      validateReason("WORKER_REMOVE", command.reasonCode, command.note);
    }
    const impactMeaning = command.action === "DEACTIVATE" || command.action === "REMOVE"
      ? {
        reasonCode: command.reasonCode,
        note: command.note?.trim() ?? null,
        confirmTeamImpact: command.confirmTeamImpact,
        confirmReadinessImpact: command.confirmReadinessImpact,
        expectedTeamVersion: command.expectedTeamVersion ?? null,
        expectedMembershipVersion: command.expectedMembershipVersion ?? null,
      }
      : {};
    const requestFingerprint = fingerprintWorkforceCommand({
      operation: `WORKER_${command.action}`,
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      ...impactMeaning,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:lifecycle`;
    const verified = command.action === "REMOVE"
      ? await this.verifyRemovalProof(command)
      : null;

    return this.dependencies.unitOfWork.run(async (context) => {
      const idempotency = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.actorUserId,
      });
      if (idempotency.replay) {
        replayTarget(idempotency.result);
        return replayResult(idempotency.result);
      }
      if (await context.workforce.lockProvider(command.providerId) === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const membership = await context.workforce.readActorMembership(command.providerId, command.actorUserId);
      const authorization = membership === null ? null : decideWorkforceAuthorization(
        command.action === "REMOVE" ? "REMOVE_WORKER" : "MANAGE_WORKER_LIFECYCLE",
        {
          managementLevel: membership.active ? membership.level : null,
          sameProvider: true,
          isSelf: false,
          isPrimarySupervisor: false,
          targetIsCurrentTeamMember: false,
        },
      );
      if (authorization?.allowed !== true) {
        throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
      }
      const worker = await context.workforce.lockWorker(command.providerId, command.workerId);
      if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (worker.version !== command.expectedVersion) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      assertWorkerTransition(worker.status, targetStatus);
      if (verified !== null) {
        const consumed = await context.proofUseAuthorizer.assertConsumed({
          proofId: verified.proofId,
          actorUserId: command.actorUserId,
          purpose: "WORKER_REMOVE",
          providerId: command.providerId,
          workerId: command.workerId,
          requestId: command.requestId,
          maximumAgeSeconds: 600,
          now,
        });
        if (!consumed) throw new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");
      }

      const impact = await this.resolveImpact(context, command, worker);
      const updated = await context.workforce.setWorkerStatus({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: command.workerId,
        expectedVersion: command.expectedVersion,
        status: targetStatus,
        ...(targetStatus === "REMOVED" ? { endedAt: now } : {}),
      });
      const impacts: Array<Readonly<Record<string, unknown>>> = [];
      if (impact.team !== null) {
        if (impact.membership !== null && command.action === "REMOVE") {
          const changedMembership = await context.workforce.updateMembership({
            actorUserId: command.actorUserId,
            providerId: command.providerId,
            requestId: command.requestId,
            idempotencyKey: command.idempotencyKey,
            teamId: impact.membership.teamId,
            expectedMembershipVersion: impact.membership.version,
            membershipId: impact.membership.id,
            endedAt: now,
          });
          await context.history.append({
            providerId: command.providerId,
            targetType: "TEAM_MEMBERSHIP",
            targetId: impact.membership.id,
            targetVersion: changedMembership.version,
            eventCode: "TEAM_MEMBERSHIP_ENDED_BY_WORKER_REMOVAL",
            actorUserId: command.actorUserId,
            reasonCode: command.reasonCode,
            safeBefore: {
              status: "CURRENT",
              version: impact.membership.version,
              teamId: impact.membership.teamId,
              cleans: impact.membership.cleans,
            },
            safeAfter: {
              status: "ENDED",
              version: changedMembership.version,
              teamId: changedMembership.teamId,
              cleans: changedMembership.cleans,
            },
            requestId: command.requestId,
          });
          impacts.push({
            targetType: "TEAM_MEMBERSHIP",
            targetId: changedMembership.id,
            outcomeCode: "TEAM_MEMBERSHIP_ENDED",
            version: changedMembership.version,
          });
        }
        if (impact.teamWillBecomeInactive || impact.team.primarySupervisorWorkerId === worker.id) {
          const changedTeam = await context.workforce.updateTeam({
            actorUserId: command.actorUserId,
            providerId: command.providerId,
            requestId: command.requestId,
            idempotencyKey: command.idempotencyKey,
            expectedVersion: impact.team.version,
            teamId: impact.team.id,
            ...(impact.teamWillBecomeInactive ? { status: "INACTIVE" as const } : {}),
            ...(impact.team.primarySupervisorWorkerId === worker.id
              ? { primarySupervisorWorkerId: null }
              : {}),
          });
          impacts.push({
            targetType: "TEAM",
            targetId: changedTeam.id,
            outcomeCode: impact.teamWillBecomeInactive ? "TEAM_INACTIVATED" : "PRIMARY_SUPERVISOR_CLEARED",
            version: changedTeam.version,
          });
          if (impact.teamWillBecomeInactive) {
            await context.history.append({
              providerId: command.providerId,
              targetType: "TEAM",
              targetId: changedTeam.id,
              targetVersion: changedTeam.version,
              eventCode: "TEAM_INACTIVATED_BY_WORKER_LIFECYCLE",
              actorUserId: command.actorUserId,
              safeBefore: { status: impact.team.status, version: impact.team.version },
              safeAfter: { status: changedTeam.status, version: changedTeam.version },
              requestId: command.requestId,
            });
          }
          if (impact.team.primarySupervisorWorkerId === worker.id) {
            await context.history.append({
              providerId: command.providerId,
              targetType: "PRIMARY_SUPERVISOR",
              targetId: changedTeam.id,
              targetVersion: changedTeam.version,
              eventCode: "PRIMARY_SUPERVISOR_CLEARED_BY_WORKER_LIFECYCLE",
              actorUserId: command.actorUserId,
              safeBefore: { status: "ASSIGNED", version: impact.team.version },
              safeAfter: { status: "UNASSIGNED", version: changedTeam.version },
              requestId: command.requestId,
            });
            if (worker.identityUserId !== null) {
              const remaining = await context.workforce.countPrimarySupervisorAssignments(worker.identityUserId);
              await context.identityAuthority.reconcileProviderSupervisorRole({
                userId: worker.identityUserId,
                shouldBeEnabled: remaining > 0,
              });
            }
          }
        }
      }
      if (command.action === "REMOVE") {
        await this.endAccess(context, command, worker, now, impacts);
      }

      const outcomeCode = command.action === "DEACTIVATE"
        ? "WORKER_DEACTIVATED"
        : command.action === "REMOVE"
          ? "WORKER_REMOVED"
          : command.action === "REACTIVATE"
            ? "WORKER_REACTIVATED"
            : "WORKER_ACTIVATED";
      const reasonFacts = command.action === "DEACTIVATE" || command.action === "REMOVE"
        ? {
          reasonCode: command.reasonCode,
          ...(command.note == null ? {} : { note: command.note.trim() }),
        }
        : {};
      const history = await context.history.append({
        providerId: command.providerId,
        targetType: "WORKER",
        targetId: worker.id,
        targetVersion: updated.version,
        eventCode: outcomeCode,
        actorUserId: command.actorUserId,
        ...reasonFacts,
        safeBefore: { status: worker.status, version: worker.version },
        safeAfter: { status: updated.status, version: updated.version },
        requestId: command.requestId,
      });
      if (impact.workersReadyWillBecomeFalse) {
        await context.history.append({
          providerId: command.providerId,
          targetType: "READINESS",
          targetId: command.providerId,
          targetVersion: updated.version,
          eventCode: "WORKERS_READY_LOST",
          actorUserId: command.actorUserId,
          safeBefore: { status: "READY", version: worker.version },
          safeAfter: { status: "NOT_READY", version: updated.version },
          requestId: command.requestId,
        });
        impacts.push({
          targetType: "READINESS",
          targetId: command.providerId,
          outcomeCode: "WORKERS_READY_LOST",
          version: updated.version,
        });
      }
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: `providers.workforce.worker.${command.action.toLocaleLowerCase("en-US")}`,
        targetType: "provider_worker",
        targetId: worker.id,
        context: {
          outcome: "SUCCEEDED",
          providerId: command.providerId,
          targetVersion: updated.version,
          impactCount: impacts.length,
        },
        requestId: command.requestId,
      });
      if (worker.identityUserId !== null) {
        const identity = await context.identityReader.getIdentity(worker.identityUserId);
        await context.notifications.insert({
          providerId: command.providerId,
          template: command.action === "REMOVE"
            ? "WORKER_REMOVED"
            : command.action === "DEACTIVATE"
              ? "WORKER_DEACTIVATED"
              : "WORKER_ACTIVATED",
          locale: resolveWorkforceLocale({
            preferredLanguage: identity?.preferredLanguage,
            acceptedInvitationLocale: worker.acceptedInvitationLocale,
          }),
          recipientUserId: worker.identityUserId,
          historyId: history.id,
          safeVariables: { workerVersion: updated.version },
          idempotencyKey: `worker:${worker.id}:lifecycle:${updated.version}`,
        });
      }
      const result = safeResultFor(outcomeCode, updated, impacts);
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: outcomeCode,
        safeResult: result,
      });
      return result;
    });
  }

  private async verifyRemovalProof(command: Extract<WorkerLifecycleCommand, { readonly action: "REMOVE" }>) {
    try {
      return await this.dependencies.recentProof.verify({
        principalUserId: command.actorUserId,
        sessionId: command.sessionId,
        opaqueProof: command.recentAuthenticationProof,
        purpose: "WORKER_REMOVE",
        providerId: command.providerId,
        workerId: command.workerId,
        requestId: command.requestId,
        maximumAgeSeconds: 600,
      });
    } catch {
      throw new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");
    }
  }

  private async resolveImpact(
    context: ProvidersWorkforceTransactionContext,
    command: WorkerLifecycleCommand,
    worker: WorkerSnapshot,
  ) {
    const lockedTeamMembership = command.action === "DEACTIVATE" || command.action === "REMOVE"
      ? await lockCurrentTeamMembership(context, worker.providerId, worker.id)
      : null;
    const membership = lockedTeamMembership?.membership ?? null;
    const team = lockedTeamMembership?.team ?? null;
    let teamWillBecomeInactive = false;
    let workersReadyWillBecomeFalse = false;
    if ((command.action === "DEACTIVATE" || command.action === "REMOVE")
      && membership !== null && team !== null) {
      teamWillBecomeInactive = (await evaluateLockedTeamCleanerImpact({
        context,
        team,
        membership,
        actorIsPrimarySupervisor: false,
        confirmed: command.confirmTeamImpact,
        ...(command.expectedTeamVersion === undefined ? {} : { expectedTeamVersion: command.expectedTeamVersion }),
        ...(command.expectedMembershipVersion === undefined ? {} : { expectedMembershipVersion: command.expectedMembershipVersion }),
      })).teamWillBecomeInactive;
    }
    if (command.action === "DEACTIVATE" || command.action === "REMOVE") {
      const candidates = await context.workforce.listReadinessCandidates(worker.providerId);
      let qualifying = 0;
      let targetQualifies = false;
      for (const candidate of candidates) {
        const identity = candidate.identityUserId === null
          ? null
          : await context.identityReader.getIdentity(candidate.identityUserId);
        let profileComplete = true;
        try { validateWorkerProfile(candidate.profile); } catch { profileComplete = false; }
        const qualifies = isQualifyingWorker({
          status: candidate.status,
          profileComplete,
          workerType: candidate.profile.workerType,
          identityActive: identity?.isAccountActive === true,
          workerRoleEnabled: identity?.workerRoleEnabled === true,
          loginAccessActive: candidate.access?.status === "ACTIVE",
        });
        if (qualifies) qualifying += 1;
        if (qualifies && candidate.id === worker.id) targetQualifies = true;
      }
      if (targetQualifies && qualifying === 1 && !command.confirmReadinessImpact) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT", { workersReadyWillBecomeFalse: true });
      }
      workersReadyWillBecomeFalse = targetQualifies && qualifying === 1;
    }
    return { membership, team, teamWillBecomeInactive, workersReadyWillBecomeFalse };
  }

  private async endAccess(
    context: ProvidersWorkforceTransactionContext,
    command: Extract<WorkerLifecycleCommand, { readonly action: "REMOVE" }>,
    worker: WorkerSnapshot,
    now: Date,
    impacts: Array<Readonly<Record<string, unknown>>>,
  ) {
    if (worker.access?.status === "INVITED") {
      const invitation = await context.workforce.getLatestInvitation(worker.id);
      if (invitation?.status !== "PENDING") throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const changed = await context.workforce.transitionInvitation({
        providerId: worker.providerId,
        workerId: worker.id,
        invitationId: invitation.id,
        expectedInvitationVersion: invitation.version,
        expectedAccessVersion: worker.access.version,
        status: "REVOKED",
        transitionedAt: now,
      });
      await context.history.append({
        providerId: command.providerId,
        targetType: "INVITATION",
        targetId: invitation.id,
        targetVersion: changed.invitation.version,
        eventCode: "WORKER_INVITATION_REVOKED_BY_REMOVAL",
        actorUserId: command.actorUserId,
        reasonCode: command.reasonCode,
        safeBefore: { status: invitation.status, version: invitation.version, locale: invitation.locale },
        safeAfter: { status: changed.invitation.status, version: changed.invitation.version, locale: changed.invitation.locale },
        requestId: command.requestId,
      });
      const accessVersion = changed.worker.access?.version ?? worker.access.version + 1;
      await context.history.append({
        providerId: command.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: worker.id,
        targetVersion: accessVersion,
        eventCode: "WORKER_LOGIN_ACCESS_REVOKED_BY_REMOVAL",
        actorUserId: command.actorUserId,
        reasonCode: command.reasonCode,
        safeBefore: { status: worker.access.status, version: worker.access.version },
        safeAfter: { status: "REVOKED", version: accessVersion },
        requestId: command.requestId,
      });
      impacts.push({ targetType: "LOGIN_ACCESS", targetId: worker.id, outcomeCode: "WORKER_LOGIN_ACCESS_REVOKED", version: accessVersion });
    } else if (worker.access?.status === "ACTIVE") {
      const changed = await context.workforce.setWorkerAccessStatus({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: worker.id,
        expectedAccessVersion: worker.access.version,
        status: "REVOKED",
        transitionedAt: now,
      });
      const accessVersion = changed.access?.version ?? worker.access.version + 1;
      await context.history.append({
        providerId: command.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: worker.id,
        targetVersion: accessVersion,
        eventCode: "WORKER_LOGIN_ACCESS_REVOKED_BY_REMOVAL",
        actorUserId: command.actorUserId,
        reasonCode: command.reasonCode,
        safeBefore: { status: worker.access.status, version: worker.access.version },
        safeAfter: { status: "REVOKED", version: accessVersion },
        requestId: command.requestId,
      });
      impacts.push({ targetType: "LOGIN_ACCESS", targetId: worker.id, outcomeCode: "WORKER_LOGIN_ACCESS_REVOKED", version: accessVersion });
    }
    if (worker.identityUserId !== null) {
      const remaining = await context.workforce.countActiveAccessForIdentity(worker.identityUserId);
      await context.identityAuthority.reconcileWorkerRole({
        userId: worker.identityUserId,
        shouldBeEnabled: remaining > 0,
      });
    }
  }
}

import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerSnapshot,
} from "./domain/provider-workforce.types.js";
import type { WorkerAvatarPort } from "../media/media.public.js";
import {
  assertWorkerTransition,
  fingerprintWorkforceCommand,
  isQualifyingWorker,
  validateWorkerProfile,
  WorkforcePolicyError,
} from "./domain/provider-workforce.policy.js";
import { resolveWorkforceLocale } from "./domain/provider-workforce-notification.policy.js";
import { mapWorkerSelfDto } from "./provider-workforce.dto.js";
import {
  evaluateLockedTeamCleanerImpact,
  lockCurrentTeamMembership,
} from "./provider-workforce-impact.service.js";

export interface LeaveCurrentProviderCommand {
  readonly actorUserId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly expectedTeamVersion?: number | null;
  readonly expectedMembershipVersion?: number | null;
  readonly confirmTeamImpact: boolean;
  readonly confirmReadinessImpact: boolean;
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

export class ProviderWorkerSelfService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly avatar: WorkerAvatarPort;
    readonly now?: () => Date;
  }) {}

  public async getCurrent(actorUserId: string) {
    return this.dependencies.unitOfWork.run(async (context) => {
      const worker = await context.workforce.getCurrentWorkerByIdentity(actorUserId);
      if (worker === null || worker.identityUserId !== actorUserId) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const mediaFileId = worker.profile.avatarMediaFileId;
      if (mediaFileId === null) return mapWorkerSelfDto(worker);
      const delivery = await this.dependencies.avatar.issuePrivateDelivery({
        mediaFileId,
        actorUserId,
        providerId: worker.providerId,
        workerId: worker.id,
        purpose: "WORKER_AVATAR_PRIVATE_READ",
      });
      return mapWorkerSelfDto(worker, {
        url: delivery.url,
        expiresAt: delivery.expiresAt.toISOString(),
      });
    });
  }

  public async leave(command: LeaveCurrentProviderCommand) {
    const now = this.dependencies.now?.() ?? new Date();
    return this.dependencies.unitOfWork.run(async (context) => {
      const currentWorker = await context.workforce.getCurrentWorkerByIdentity(command.actorUserId);
      const routedWorker = currentWorker
        ?? await context.workforce.getLatestWorkerByIdentity(command.actorUserId);
      if (routedWorker === null || routedWorker.identityUserId !== command.actorUserId) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const requestFingerprint = fingerprintWorkforceCommand({
        operation: "WORKER_SELF_LEAVE",
        providerId: routedWorker.providerId,
        workerId: routedWorker.id,
        expectedVersion: command.expectedVersion,
        expectedTeamVersion: command.expectedTeamVersion ?? null,
        expectedMembershipVersion: command.expectedMembershipVersion ?? null,
        confirmTeamImpact: command.confirmTeamImpact,
        confirmReadinessImpact: command.confirmReadinessImpact,
      });
      const scopeKey = `provider:${routedWorker.providerId}:worker:${routedWorker.id}:self-leave`;
      const idempotency = await context.commands.begin({
        providerId: routedWorker.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.actorUserId,
      });
      if (idempotency.replay) return replayResult(idempotency.result);

      if (await context.workforce.lockProvider(routedWorker.providerId) === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const worker = await context.workforce.lockWorker(routedWorker.providerId, routedWorker.id);
      if (worker === null || worker.identityUserId !== command.actorUserId) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      if (worker.version !== command.expectedVersion) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      assertWorkerTransition(worker.status, "REMOVED");

      const impact = await this.resolveImpact(context, command, worker);
      const updated = await context.workforce.setWorkerStatus({
        actorUserId: command.actorUserId,
        providerId: worker.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: worker.id,
        expectedVersion: worker.version,
        status: "REMOVED",
        endedAt: now,
      });
      const impacts: Array<Readonly<Record<string, unknown>>> = [];

      if (impact.membership !== null) {
        const changedMembership = await context.workforce.updateMembership({
          actorUserId: command.actorUserId,
          providerId: worker.providerId,
          requestId: command.requestId,
          idempotencyKey: command.idempotencyKey,
          teamId: impact.membership.teamId,
          membershipId: impact.membership.id,
          expectedMembershipVersion: impact.membership.version,
          endedAt: now,
        });
        await context.history.append({
          providerId: worker.providerId,
          targetType: "TEAM_MEMBERSHIP",
          targetId: changedMembership.id,
          targetVersion: changedMembership.version,
          eventCode: "TEAM_MEMBERSHIP_ENDED_BY_WORKER_DEPARTURE",
          actorUserId: command.actorUserId,
          safeBefore: { status: "CURRENT", version: impact.membership.version, teamId: impact.membership.teamId, cleans: impact.membership.cleans },
          safeAfter: { status: "ENDED", version: changedMembership.version, teamId: changedMembership.teamId, cleans: changedMembership.cleans },
          requestId: command.requestId,
        });
        impacts.push({ targetType: "TEAM_MEMBERSHIP", targetId: changedMembership.id, outcomeCode: "TEAM_MEMBERSHIP_ENDED", version: changedMembership.version });
      }

      if (impact.team !== null
        && (impact.teamWillBecomeInactive || impact.team.primarySupervisorWorkerId === worker.id)) {
        const changedTeam = await context.workforce.updateTeam({
          actorUserId: command.actorUserId,
          providerId: worker.providerId,
          requestId: command.requestId,
          idempotencyKey: command.idempotencyKey,
          teamId: impact.team.id,
          expectedVersion: impact.team.version,
          ...(impact.teamWillBecomeInactive ? { status: "INACTIVE" as const } : {}),
          ...(impact.team.primarySupervisorWorkerId === worker.id ? { primarySupervisorWorkerId: null } : {}),
        });
        if (impact.teamWillBecomeInactive) {
          await context.history.append({
            providerId: worker.providerId,
            targetType: "TEAM",
            targetId: changedTeam.id,
            targetVersion: changedTeam.version,
            eventCode: "TEAM_INACTIVATED_BY_WORKER_DEPARTURE",
            actorUserId: command.actorUserId,
            safeBefore: { status: impact.team.status, version: impact.team.version },
            safeAfter: { status: changedTeam.status, version: changedTeam.version },
            requestId: command.requestId,
          });
          impacts.push({ targetType: "TEAM", targetId: changedTeam.id, outcomeCode: "TEAM_INACTIVATED", version: changedTeam.version });
        }
        if (impact.team.primarySupervisorWorkerId === worker.id) {
          await context.history.append({
            providerId: worker.providerId,
            targetType: "PRIMARY_SUPERVISOR",
            targetId: changedTeam.id,
            targetVersion: changedTeam.version,
            eventCode: "PRIMARY_SUPERVISOR_CLEARED_BY_WORKER_DEPARTURE",
            actorUserId: command.actorUserId,
            safeBefore: { status: "ASSIGNED", version: impact.team.version },
            safeAfter: { status: "UNASSIGNED", version: changedTeam.version },
            requestId: command.requestId,
          });
          const remainingAssignments = await context.workforce.countPrimarySupervisorAssignments(command.actorUserId);
          await context.identityAuthority.reconcileProviderSupervisorRole({
            userId: command.actorUserId,
            shouldBeEnabled: remainingAssignments > 0,
          });
        }
      }

      await this.endAccess(context, command, worker, now, impacts);
      const history = await context.history.append({
        providerId: worker.providerId,
        targetType: "WORKER",
        targetId: worker.id,
        targetVersion: updated.version,
        eventCode: "WORKER_DEPARTED",
        actorUserId: command.actorUserId,
        safeBefore: { status: worker.status, version: worker.version },
        safeAfter: { status: updated.status, version: updated.version },
        requestId: command.requestId,
      });
      if (impact.workersReadyWillBecomeFalse) {
        await context.history.append({
          providerId: worker.providerId,
          targetType: "READINESS",
          targetId: worker.providerId,
          targetVersion: updated.version,
          eventCode: "WORKERS_READY_LOST",
          actorUserId: command.actorUserId,
          safeBefore: { status: "READY", version: worker.version },
          safeAfter: { status: "NOT_READY", version: updated.version },
          requestId: command.requestId,
        });
        impacts.push({ targetType: "READINESS", targetId: worker.providerId, outcomeCode: "WORKERS_READY_LOST", version: updated.version });
      }
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.workforce.worker.self_leave",
        targetType: "provider_worker",
        targetId: worker.id,
        context: { outcome: "SUCCEEDED", providerId: worker.providerId, targetVersion: updated.version, impactCount: impacts.length },
        requestId: command.requestId,
      });
      const ownerUserId = await context.workforce.getProviderOwnerUserId(worker.providerId);
      if (ownerUserId === null) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const ownerIdentity = await context.identityReader.getIdentity(ownerUserId);
      await context.notifications.insert({
        providerId: worker.providerId,
        template: "WORKER_DEPARTED",
        locale: resolveWorkforceLocale({ preferredLanguage: ownerIdentity?.preferredLanguage, acceptedInvitationLocale: null }),
        recipientUserId: ownerUserId,
        historyId: history.id,
        safeVariables: { workerVersion: updated.version },
        idempotencyKey: `worker:${worker.id}:departure:${updated.version}`,
      });
      const result = { outcomeCode: "WORKER_DEPARTED", targetId: updated.id, version: updated.version, impacts } as const;
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: result.outcomeCode,
        safeResult: result,
      });
      return result;
    });
  }

  private async resolveImpact(
    context: ProvidersWorkforceTransactionContext,
    command: LeaveCurrentProviderCommand,
    worker: WorkerSnapshot,
  ) {
    const lockedTeamMembership = await lockCurrentTeamMembership(context, worker.providerId, worker.id);
    const membership = lockedTeamMembership?.membership ?? null;
    const team = lockedTeamMembership?.team ?? null;
    let teamWillBecomeInactive = false;
    if (membership !== null && team !== null) {
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
    const candidates = await context.workforce.listReadinessCandidates(worker.providerId);
    let qualifying = 0;
    let targetQualifies = false;
    for (const candidate of candidates) {
      const identity = candidate.identityUserId === null ? null : await context.identityReader.getIdentity(candidate.identityUserId);
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
    const workersReadyWillBecomeFalse = targetQualifies && qualifying === 1;
    if (workersReadyWillBecomeFalse && !command.confirmReadinessImpact) {
      throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT", { workersReadyWillBecomeFalse: true });
    }
    return { membership, team, teamWillBecomeInactive, workersReadyWillBecomeFalse };
  }

  private async endAccess(
    context: ProvidersWorkforceTransactionContext,
    command: LeaveCurrentProviderCommand,
    worker: WorkerSnapshot,
    now: Date,
    impacts: Array<Readonly<Record<string, unknown>>>,
  ): Promise<void> {
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
        providerId: worker.providerId,
        targetType: "INVITATION",
        targetId: invitation.id,
        targetVersion: changed.invitation.version,
        eventCode: "WORKER_INVITATION_REVOKED_BY_DEPARTURE",
        actorUserId: command.actorUserId,
        safeBefore: { status: invitation.status, version: invitation.version, locale: invitation.locale },
        safeAfter: { status: changed.invitation.status, version: changed.invitation.version, locale: changed.invitation.locale },
        requestId: command.requestId,
      });
    } else if (worker.access?.status === "ACTIVE") {
      await context.workforce.setWorkerAccessStatus({
        actorUserId: command.actorUserId,
        providerId: worker.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: worker.id,
        expectedAccessVersion: worker.access.version,
        status: "REVOKED",
        transitionedAt: now,
      });
    }
    if (worker.access?.status === "ACTIVE" || worker.access?.status === "INVITED") {
      const accessVersion = worker.access.version + 1;
      await context.history.append({
        providerId: worker.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: worker.id,
        targetVersion: accessVersion,
        eventCode: "WORKER_LOGIN_ACCESS_REVOKED_BY_DEPARTURE",
        actorUserId: command.actorUserId,
        safeBefore: { status: worker.access.status, version: worker.access.version },
        safeAfter: { status: "REVOKED", version: accessVersion },
        requestId: command.requestId,
      });
      impacts.push({ targetType: "LOGIN_ACCESS", targetId: worker.id, outcomeCode: "WORKER_LOGIN_ACCESS_REVOKED", version: accessVersion });
    }
    const remaining = await context.workforce.countActiveAccessForIdentity(command.actorUserId);
    await context.identityAuthority.reconcileWorkerRole({
      userId: command.actorUserId,
      shouldBeEnabled: remaining > 0,
    });
  }
}

import { randomUUID } from "node:crypto";

import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkforceCommandMeta,
} from "./domain/provider-workforce.types.js";
import {
  assertEscortMembership,
  fingerprintWorkforceCommand,
  WorkforcePolicyError,
} from "./domain/provider-workforce.policy.js";
import { evaluateLockedTeamCleanerImpact } from "./provider-workforce-impact.service.js";

interface MembershipBaseCommand extends WorkforceCommandMeta {
  readonly teamId: string;
  readonly workerId: string;
  readonly expectedVersion: number;
  readonly expectedWorkerVersion: number;
}

export type TeamMembershipCommand =
  | (MembershipBaseCommand & {
    readonly action: "ADD";
    readonly cleans: boolean;
  })
  | (MembershipBaseCommand & {
    readonly action: "UPDATE_CLEANS";
    readonly membershipId: string;
    readonly cleans: boolean;
    readonly expectedMembershipVersion: number;
    readonly confirmLastCleanerImpact: boolean;
  })
  | (MembershipBaseCommand & {
    readonly action: "REMOVE";
    readonly membershipId: string;
    readonly expectedMembershipVersion: number;
    readonly confirmLastCleanerImpact: boolean;
  })
  | (MembershipBaseCommand & {
    readonly action: "MOVE";
    readonly membershipId: string;
    readonly targetTeamId: string;
    readonly cleans: boolean;
    readonly expectedMembershipVersion: number;
    readonly expectedTargetTeamVersion: number;
    readonly confirmLastCleanerImpact: boolean;
  });

function safeReplay(value: Readonly<Record<string, unknown>> | null) {
  if (value === null
    || typeof value["outcomeCode"] !== "string"
    || typeof value["targetId"] !== "string"
    || typeof value["version"] !== "number"
    || !Array.isArray(value["impacts"])) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  return {
    outcomeCode: value["outcomeCode"], targetId: value["targetId"], version: value["version"],
    impacts: value["impacts"] as readonly Readonly<Record<string, unknown>>[],
  } as const;
}

export class ProviderTeamMembershipService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly now?: () => Date;
    readonly createId?: () => string;
  }) {}

  public async change(command: TeamMembershipCommand) {
    if (command.action === "MOVE" && command.targetTeamId === command.teamId) {
      throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "targetTeamId" });
    }
    const now = this.dependencies.now?.() ?? new Date();
    const fingerprint = fingerprintWorkforceCommand({
      operation: `TEAM_MEMBERSHIP_${command.action}`,
      providerId: command.providerId,
      teamId: command.teamId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      expectedWorkerVersion: command.expectedWorkerVersion,
      ...(command.action === "ADD" ? { cleans: command.cleans } : {
        membershipId: command.membershipId,
        expectedMembershipVersion: command.expectedMembershipVersion,
        confirmLastCleanerImpact: command.confirmLastCleanerImpact,
        ...(command.action === "REMOVE" ? {} : { cleans: command.cleans }),
        ...(command.action === "MOVE"
          ? { targetTeamId: command.targetTeamId, expectedTargetTeamVersion: command.expectedTargetTeamVersion }
          : {}),
      }),
    });
    const scopeKey = `provider:${command.providerId}:team:${command.teamId}:memberships`;
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
      const worker = await context.workforce.lockWorker(command.providerId, command.workerId);
      if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (worker.version !== command.expectedWorkerVersion || worker.status === "REMOVED") {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      const teamIds = command.action === "MOVE"
        ? [...new Set([command.teamId, command.targetTeamId])].sort()
        : [command.teamId];
      const lockedTeams = new Map<string, TeamSnapshot>();
      for (const teamId of teamIds) {
        const locked = await context.workforce.lockTeam(command.providerId, teamId);
        if (locked === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
        lockedTeams.set(teamId, locked);
      }
      const team = lockedTeams.get(command.teamId)!;
      if (team.version !== command.expectedVersion || team.status === "ARCHIVED") {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      const moveTarget = command.action === "MOVE"
        ? lockedTeams.get(command.targetTeamId) ?? null
        : null;
      if (command.action === "MOVE"
        && (moveTarget === null
          || moveTarget.version !== command.expectedTargetTeamVersion
          || moveTarget.status === "ARCHIVED")) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      const actorMembership = await context.workforce.readActorMembership(command.providerId, command.actorUserId);
      const management = actorMembership !== null
        && actorMembership.active
        && (actorMembership.level === "OWNER" || actorMembership.level === "ADMIN");
      const supervisor = !management && await this.isPrimarySupervisor(context, team, command.actorUserId);
      if (!management && !supervisor) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (supervisor && command.action !== "UPDATE_CLEANS") {
        throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
      }

      let membership: TeamMemberSnapshot | null = null;
      if (command.action !== "ADD") {
        membership = await context.workforce.getMembership(command.teamId, command.membershipId);
        if (membership === null || membership.endedAt !== null || membership.workerId !== command.workerId
          || membership.version !== command.expectedMembershipVersion) {
          throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
        }
      }
      const impacts: Array<Readonly<Record<string, unknown>>> = [];
      if (command.action === "ADD") {
        if (await context.workforce.getCurrentMembershipForWorker(worker.id) !== null) {
          throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
        }
        assertEscortMembership(worker.profile.workerType, command.cleans);
        const added = await context.workforce.addMembership({
          actorUserId: command.actorUserId,
          providerId: command.providerId,
          requestId: command.requestId,
          idempotencyKey: command.idempotencyKey,
          expectedVersion: team.version,
          teamId: team.id,
          workerId: worker.id,
          membershipId: this.dependencies.createId?.() ?? randomUUID(),
          cleans: command.cleans,
        });
        await context.history.append({
          providerId: command.providerId,
          targetType: "TEAM_MEMBERSHIP",
          targetId: added.id,
          targetVersion: added.version,
          eventCode: "TEAM_MEMBERSHIP_ADDED",
          actorUserId: command.actorUserId,
          safeAfter: { status: "CURRENT", version: added.version, teamId: added.teamId, cleans: added.cleans },
          requestId: command.requestId,
        });
        return this.accept(context, command, scopeKey, "TEAM_MEMBERSHIP_ADDED", added.id, added.version, impacts);
      }

      const sourceMembership = membership!;
      if (command.action === "UPDATE_CLEANS") {
        assertEscortMembership(worker.profile.workerType, command.cleans);
        if (sourceMembership.cleans === command.cleans) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
        const finalCleaner = command.cleans === false && (await evaluateLockedTeamCleanerImpact({
          context,
          team,
          membership: sourceMembership,
          actorIsPrimarySupervisor: supervisor,
          confirmed: command.confirmLastCleanerImpact,
          expectedTeamVersion: command.expectedVersion,
          expectedMembershipVersion: command.expectedMembershipVersion,
        })).teamWillBecomeInactive;
        const changed = await context.workforce.updateMembership({
          actorUserId: command.actorUserId,
          providerId: command.providerId,
          requestId: command.requestId,
          idempotencyKey: command.idempotencyKey,
          teamId: team.id,
          membershipId: sourceMembership.id,
          expectedMembershipVersion: sourceMembership.version,
          expectedTeamVersion: team.version,
          cleans: command.cleans,
        });
        await this.membershipHistory(context, command, sourceMembership, changed, "TEAM_MEMBERSHIP_CLEANS_UPDATED");
        if (finalCleaner) {
          const changedTeam = await context.workforce.updateTeam({
            actorUserId: command.actorUserId,
            providerId: command.providerId,
            requestId: command.requestId,
            idempotencyKey: command.idempotencyKey,
            expectedVersion: team.version + 1,
            teamId: team.id,
            status: "INACTIVE",
          });
          await this.teamHistory(context, command, team, changedTeam, "TEAM_INACTIVATED_FINAL_CLEANER");
          impacts.push({ targetType: "TEAM", targetId: team.id, outcomeCode: "TEAM_INACTIVATED", version: changedTeam.version });
        }
        return this.accept(context, command, scopeKey, "TEAM_MEMBERSHIP_CLEANS_UPDATED", changed.id, changed.version, impacts);
      }

      const finalCleaner = (await evaluateLockedTeamCleanerImpact({
        context,
        team,
        membership: sourceMembership,
        actorIsPrimarySupervisor: false,
        confirmed: command.confirmLastCleanerImpact,
        expectedTeamVersion: command.expectedVersion,
        expectedMembershipVersion: command.expectedMembershipVersion,
      })).teamWillBecomeInactive;
      const ended = await context.workforce.updateMembership({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        teamId: team.id,
        membershipId: sourceMembership.id,
        expectedMembershipVersion: sourceMembership.version,
        expectedTeamVersion: team.version,
        endedAt: now,
      });
      await this.membershipHistory(context, command, sourceMembership, ended,
        command.action === "MOVE" ? "TEAM_MEMBERSHIP_MOVED_FROM" : "TEAM_MEMBERSHIP_REMOVED");
      let sourceTeamVersion = team.version + 1;
      if (finalCleaner || team.primarySupervisorWorkerId === worker.id) {
        const changedTeam = await context.workforce.updateTeam({
          actorUserId: command.actorUserId,
          providerId: command.providerId,
          requestId: command.requestId,
          idempotencyKey: command.idempotencyKey,
          expectedVersion: sourceTeamVersion,
          teamId: team.id,
          ...(finalCleaner ? { status: "INACTIVE" as const } : {}),
          ...(team.primarySupervisorWorkerId === worker.id ? { primarySupervisorWorkerId: null } : {}),
        });
        sourceTeamVersion = changedTeam.version;
        if (finalCleaner) {
          await this.teamHistory(context, command, team, changedTeam, "TEAM_INACTIVATED_FINAL_CLEANER");
          impacts.push({ targetType: "TEAM", targetId: team.id, outcomeCode: "TEAM_INACTIVATED", version: changedTeam.version });
        }
        if (team.primarySupervisorWorkerId === worker.id) {
          await context.history.append({
            providerId: command.providerId, targetType: "PRIMARY_SUPERVISOR", targetId: team.id,
            targetVersion: changedTeam.version, eventCode: "PRIMARY_SUPERVISOR_CLEARED_BY_MEMBERSHIP_CHANGE",
            actorUserId: command.actorUserId,
            safeBefore: { status: "ASSIGNED", version: team.version },
            safeAfter: { status: "UNASSIGNED", version: changedTeam.version },
            requestId: command.requestId,
          });
          if (worker.identityUserId !== null) {
            const remaining = await context.workforce.countPrimarySupervisorAssignments(worker.identityUserId);
            await context.identityAuthority.reconcileProviderSupervisorRole({ userId: worker.identityUserId, shouldBeEnabled: remaining > 0 });
          }
        }
      }
      if (command.action === "REMOVE") {
        return this.accept(context, command, scopeKey, "TEAM_MEMBERSHIP_REMOVED", ended.id, ended.version, impacts);
      }
      const target = moveTarget!;
      assertEscortMembership(worker.profile.workerType, command.cleans);
      const added = await context.workforce.addMembership({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        expectedVersion: target.version,
        teamId: target.id,
        workerId: worker.id,
        membershipId: this.dependencies.createId?.() ?? randomUUID(),
        cleans: command.cleans,
      });
      await context.history.append({
        providerId: command.providerId, targetType: "TEAM_MEMBERSHIP", targetId: added.id,
        targetVersion: added.version, eventCode: "TEAM_MEMBERSHIP_MOVED_TO", actorUserId: command.actorUserId,
        safeAfter: { status: "CURRENT", version: added.version, teamId: added.teamId, cleans: added.cleans },
        requestId: command.requestId,
      });
      impacts.push({ targetType: "TEAM_MEMBERSHIP", targetId: ended.id, outcomeCode: "TEAM_MEMBERSHIP_ENDED", version: ended.version });
      return this.accept(context, command, scopeKey, "TEAM_MEMBERSHIP_MOVED", added.id, added.version, impacts);
    });
  }

  private async isPrimarySupervisor(context: ProvidersWorkforceTransactionContext, team: TeamSnapshot, actorUserId: string) {
    if (team.primarySupervisorWorkerId === null) return false;
    const supervisor = await context.workforce.getWorker(team.providerId, team.primarySupervisorWorkerId);
    if (supervisor?.status !== "ACTIVE"
      || supervisor.identityUserId !== actorUserId
      || !supervisor.profile.supervisorCapable) return false;
    const membership = await context.workforce.getCurrentMembershipForWorker(supervisor.id);
    return membership?.teamId === team.id && membership.endedAt === null;
  }

  private membershipHistory(
    context: ProvidersWorkforceTransactionContext,
    command: TeamMembershipCommand,
    before: TeamMemberSnapshot,
    after: TeamMemberSnapshot,
    eventCode: string,
  ) {
    return context.history.append({
      providerId: command.providerId, targetType: "TEAM_MEMBERSHIP", targetId: after.id,
      targetVersion: after.version, eventCode, actorUserId: command.actorUserId,
      safeBefore: { status: before.endedAt === null ? "CURRENT" : "ENDED", version: before.version, teamId: before.teamId, cleans: before.cleans },
      safeAfter: { status: after.endedAt === null ? "CURRENT" : "ENDED", version: after.version, teamId: after.teamId, cleans: after.cleans },
      requestId: command.requestId,
    });
  }

  private teamHistory(
    context: ProvidersWorkforceTransactionContext,
    command: TeamMembershipCommand,
    before: TeamSnapshot,
    after: TeamSnapshot,
    eventCode: string,
  ) {
    return context.history.append({
      providerId: command.providerId, targetType: "TEAM", targetId: after.id,
      targetVersion: after.version, eventCode, actorUserId: command.actorUserId,
      safeBefore: { status: before.status, version: before.version },
      safeAfter: { status: after.status, version: after.version }, requestId: command.requestId,
    });
  }

  private async accept(
    context: ProvidersWorkforceTransactionContext,
    command: TeamMembershipCommand,
    scopeKey: string,
    outcomeCode: string,
    targetId: string,
    version: number,
    impacts: readonly Readonly<Record<string, unknown>>[],
  ) {
    await context.audit.append({
      actorType: "USER", actorId: command.actorUserId,
      action: `providers.workforce.team_membership.${command.action.toLocaleLowerCase("en-US")}`,
      targetType: "provider_team_membership", targetId,
      context: { outcome: "SUCCEEDED", providerId: command.providerId, teamId: command.teamId, targetVersion: version },
      requestId: command.requestId,
    });
    const result = { outcomeCode, targetId, version, impacts } as const;
    await context.commands.accept({ scopeKey, idempotencyKey: command.idempotencyKey, safeResultCode: outcomeCode, safeResult: result });
    return result;
  }
}

import type { ProvidersWorkforceTransactionContext, ProvidersWorkforceUnitOfWorkPort, WorkforceCommandMeta } from "./domain/provider-workforce.types.js";
import { fingerprintWorkforceCommand, WorkforcePolicyError } from "./domain/provider-workforce.policy.js";

interface SupervisorBaseCommand extends WorkforceCommandMeta {
  readonly teamId: string;
  readonly expectedVersion: number;
}

export type TeamSupervisorCommand =
  | (SupervisorBaseCommand & {
    readonly action: "ASSIGN";
    readonly workerId: string;
    readonly expectedWorkerVersion: number;
    readonly expectedMembershipVersion: number;
  })
  | (SupervisorBaseCommand & { readonly action: "CLEAR" });

function safeReplay(value: Readonly<Record<string, unknown>> | null) {
  if (value === null || typeof value["outcomeCode"] !== "string" || typeof value["targetId"] !== "string"
    || typeof value["version"] !== "number" || !Array.isArray(value["impacts"])) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return { outcomeCode: value["outcomeCode"], targetId: value["targetId"], version: value["version"], impacts: value["impacts"] as readonly Readonly<Record<string, unknown>>[] } as const;
}

export class ProviderTeamSupervisorService {
  public constructor(private readonly dependencies: { readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort }) {}

  public async change(command: TeamSupervisorCommand) {
    const fingerprint = fingerprintWorkforceCommand({
      operation: `TEAM_SUPERVISOR_${command.action}`,
      providerId: command.providerId,
      teamId: command.teamId,
      expectedVersion: command.expectedVersion,
      ...(command.action === "ASSIGN" ? {
        workerId: command.workerId,
        expectedWorkerVersion: command.expectedWorkerVersion,
        expectedMembershipVersion: command.expectedMembershipVersion,
      } : {}),
    });
    const scopeKey = `provider:${command.providerId}:team:${command.teamId}:primary-supervisor`;
    return this.dependencies.unitOfWork.run(async (context) => {
      const replay = await context.commands.begin({ providerId: command.providerId, scopeKey, idempotencyKey: command.idempotencyKey, requestFingerprint: fingerprint, actorUserId: command.actorUserId });
      if (replay.replay) return safeReplay(replay.result);
      if (await context.workforce.lockProvider(command.providerId) === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const actorMembership = await context.workforce.readActorMembership(command.providerId, command.actorUserId);
      if (actorMembership === null
        || !actorMembership.active
        || (actorMembership.level !== "OWNER" && actorMembership.level !== "ADMIN")) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const preview = await context.workforce.getTeam(command.providerId, command.teamId);
      if (preview === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const workerIds = [...new Set([
        ...(preview.primarySupervisorWorkerId === null ? [] : [preview.primarySupervisorWorkerId]),
        ...(command.action === "ASSIGN" ? [command.workerId] : []),
      ])].sort();
      const lockedWorkers = new Map<string, Awaited<ReturnType<ProvidersWorkforceTransactionContext["workforce"]["lockWorker"]>>>();
      for (const workerId of workerIds) {
        const locked = await context.workforce.lockWorker(command.providerId, workerId);
        if (locked === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
        lockedWorkers.set(workerId, locked);
      }
      const team = await context.workforce.lockTeam(command.providerId, command.teamId);
      if (team === null || team.version !== command.expectedVersion || team.status === "ARCHIVED"
        || team.primarySupervisorWorkerId !== preview.primarySupervisorWorkerId) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      if (command.action === "CLEAR" && team.primarySupervisorWorkerId === null) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      let candidateId: string | null = null;
      if (command.action === "ASSIGN") {
        const candidate = lockedWorkers.get(command.workerId);
        if (candidate === null || candidate === undefined
          || candidate.version !== command.expectedWorkerVersion
          || candidate.status !== "ACTIVE"
          || candidate.endedAt !== null
          || !candidate.profile.supervisorCapable) {
          throw new WorkforcePolicyError("WORKFORCE_SUPERVISOR_INVALID");
        }
        const current = await context.workforce.getCurrentMembershipForWorker(candidate.id);
        if (current === null || current.teamId !== team.id || current.version !== command.expectedMembershipVersion) {
          throw new WorkforcePolicyError("WORKFORCE_SUPERVISOR_INVALID");
        }
        const lockedMembership = await context.workforce.getMembership(team.id, current.id);
        if (lockedMembership === null
          || lockedMembership.workerId !== candidate.id
          || lockedMembership.endedAt !== null
          || lockedMembership.version !== command.expectedMembershipVersion) {
          throw new WorkforcePolicyError("WORKFORCE_SUPERVISOR_INVALID");
        }
        candidateId = candidate.id;
      }
      if (team.primarySupervisorWorkerId === candidateId) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const changed = await context.workforce.updateTeam({
        actorUserId: command.actorUserId, providerId: command.providerId, requestId: command.requestId,
        idempotencyKey: command.idempotencyKey, expectedVersion: team.version, teamId: team.id,
        primarySupervisorWorkerId: candidateId,
      });
      const eventCode = command.action === "ASSIGN" ? "PRIMARY_SUPERVISOR_ASSIGNED" : "PRIMARY_SUPERVISOR_CLEARED";
      await context.history.append({
        providerId: command.providerId, targetType: "PRIMARY_SUPERVISOR", targetId: team.id,
        targetVersion: changed.version, eventCode, actorUserId: command.actorUserId,
        safeBefore: { status: team.primarySupervisorWorkerId === null ? "UNASSIGNED" : "ASSIGNED", version: team.version },
        safeAfter: { status: candidateId === null ? "UNASSIGNED" : "ASSIGNED", version: changed.version },
        requestId: command.requestId,
      });
      const affectedIds = [...new Set([team.primarySupervisorWorkerId, candidateId].filter((value): value is string => value !== null))];
      for (const affectedWorkerId of affectedIds) {
        const affected = lockedWorkers.get(affectedWorkerId);
        if (affected?.identityUserId !== null && affected?.identityUserId !== undefined) {
          const remaining = await context.workforce.countPrimarySupervisorAssignments(affected.identityUserId);
          await context.identityAuthority.reconcileProviderSupervisorRole({ userId: affected.identityUserId, shouldBeEnabled: remaining > 0 });
        }
      }
      await context.audit.append({
        actorType: "USER", actorId: command.actorUserId,
        action: command.action === "ASSIGN" ? "providers.workforce.team.supervisor.assign" : "providers.workforce.team.supervisor.clear",
        targetType: "provider_team", targetId: team.id,
        context: { outcome: "SUCCEEDED", providerId: command.providerId, targetVersion: changed.version }, requestId: command.requestId,
      });
      const result = { outcomeCode: eventCode, targetId: team.id, version: changed.version, impacts: [] } as const;
      await context.commands.accept({ scopeKey, idempotencyKey: command.idempotencyKey, safeResultCode: eventCode, safeResult: result });
      return result;
    });
  }
}

import { randomUUID } from "node:crypto";

import type { ProvidersWorkforceTransactionContext, ProvidersWorkforceUnitOfWorkPort, ProviderTeamStatus, TeamSnapshot, WorkforceCommandMeta } from "./domain/provider-workforce.types.js";
import { assertTeamActivation, assertTeamTransition, fingerprintWorkforceCommand, normalizeDisplayLabel, normalizeWorkforceLabel, WorkforcePolicyError } from "./domain/provider-workforce.policy.js";

interface TeamBaseCommand extends WorkforceCommandMeta { readonly teamId: string; readonly expectedVersion: number }
export interface CreateTeamCommand extends WorkforceCommandMeta { readonly expectedVersion: number; readonly name: string | null }
export interface ReplaceTeamNameCommand extends TeamBaseCommand { readonly name: string }
export interface TeamLifecycleCommand extends TeamBaseCommand { readonly action: "ACTIVATE" | "DEACTIVATE" | "REACTIVATE" | "ARCHIVE" }

function safeReplay(value: Readonly<Record<string, unknown>> | null) {
  if (value === null || typeof value["outcomeCode"] !== "string" || typeof value["targetId"] !== "string" || typeof value["version"] !== "number" || !Array.isArray(value["impacts"])) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  return { outcomeCode: value["outcomeCode"], targetId: value["targetId"], version: value["version"], impacts: value["impacts"] as readonly Readonly<Record<string, unknown>>[] } as const;
}

export class ProviderTeamService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly now?: () => Date;
    readonly createId?: () => string;
  }) {}

  public createDraft(command: CreateTeamCommand) {
    const display = command.name === null ? null : normalizeDisplayLabel(command.name);
    if (display !== null && display.length === 0) throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "name" });
    const normalized = display === null ? null : normalizeWorkforceLabel(display);
    const fingerprint = fingerprintWorkforceCommand({ operation: "CREATE_TEAM", providerId: command.providerId, expectedVersion: command.expectedVersion, name: display });
    const scopeKey = `provider:${command.providerId}:teams:create`;
    return this.dependencies.unitOfWork.run(async (context) => {
      const replay = await context.commands.begin({ providerId: command.providerId, scopeKey, idempotencyKey: command.idempotencyKey, requestFingerprint: fingerprint, actorUserId: command.actorUserId });
      if (replay.replay) return safeReplay(replay.result);
      const provider = await context.workforce.lockProvider(command.providerId);
      if (provider === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      await this.assertManager(context, command.providerId, command.actorUserId);
      if (provider.workforceStateVersion !== command.expectedVersion) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const created = await context.workforce.createTeam({ ...command, teamId: this.dependencies.createId?.() ?? randomUUID(), expectedProviderVersion: command.expectedVersion, name: display, normalizedName: normalized });
      await this.teamHistory(context, command, null, created, "TEAM_DRAFT_CREATED");
      return this.accept(context, command, scopeKey, "TEAM_DRAFT_CREATED", created, []);
    });
  }

  public replaceName(command: ReplaceTeamNameCommand) {
    const display = normalizeDisplayLabel(command.name);
    if (display.length === 0) throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "name" });
    const normalized = normalizeWorkforceLabel(display);
    const fingerprint = fingerprintWorkforceCommand({ operation: "REPLACE_TEAM_NAME", providerId: command.providerId, teamId: command.teamId, expectedVersion: command.expectedVersion, name: display });
    const scopeKey = `provider:${command.providerId}:team:${command.teamId}:name`;
    return this.dependencies.unitOfWork.run(async (context) => {
      const replay = await context.commands.begin({ providerId: command.providerId, scopeKey, idempotencyKey: command.idempotencyKey, requestFingerprint: fingerprint, actorUserId: command.actorUserId });
      if (replay.replay) return safeReplay(replay.result);
      if (await context.workforce.lockProvider(command.providerId) === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      await this.assertManager(context, command.providerId, command.actorUserId);
      const team = await context.workforce.lockTeam(command.providerId, command.teamId);
      if (team === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (team.version !== command.expectedVersion || team.status === "ARCHIVED") throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const changed = await context.workforce.updateTeam({ ...command, name: display, normalizedName: normalized });
      await this.teamHistory(context, command, team, changed, "TEAM_NAME_REPLACED");
      return this.accept(context, command, scopeKey, "TEAM_NAME_REPLACED", changed, []);
    });
  }

  public transition(command: TeamLifecycleCommand) {
    const target: Readonly<Record<TeamLifecycleCommand["action"], ProviderTeamStatus>> = { ACTIVATE: "ACTIVE", DEACTIVATE: "INACTIVE", REACTIVATE: "ACTIVE", ARCHIVE: "ARCHIVED" };
    const fingerprint = fingerprintWorkforceCommand({ operation: `TEAM_${command.action}`, providerId: command.providerId, teamId: command.teamId, expectedVersion: command.expectedVersion });
    const scopeKey = `provider:${command.providerId}:team:${command.teamId}:lifecycle`;
    const now = this.dependencies.now?.() ?? new Date();
    return this.dependencies.unitOfWork.run(async (context) => {
      const replay = await context.commands.begin({ providerId: command.providerId, scopeKey, idempotencyKey: command.idempotencyKey, requestFingerprint: fingerprint, actorUserId: command.actorUserId });
      if (replay.replay) return safeReplay(replay.result);
      if (await context.workforce.lockProvider(command.providerId) === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      await this.assertManager(context, command.providerId, command.actorUserId);
      const preview = await context.workforce.getTeam(command.providerId, command.teamId);
      if (preview === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const supervisor = preview.primarySupervisorWorkerId === null
        ? null
        : await context.workforce.lockWorker(command.providerId, preview.primarySupervisorWorkerId);
      const team = await context.workforce.lockTeam(command.providerId, command.teamId);
      if (team === null || team.version !== command.expectedVersion || team.primarySupervisorWorkerId !== preview.primarySupervisorWorkerId) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const nextStatus = target[command.action];
      assertTeamTransition(team.status, nextStatus);
      const members = await context.workforce.listCurrentTeamMembers(team.id);
      if (command.action === "ACTIVATE" || command.action === "REACTIVATE") assertTeamActivation(team.name, members);
      const impacts: Array<Readonly<Record<string, unknown>>> = [];
      if (command.action === "ARCHIVE") {
        for (const member of [...members].sort((left, right) => left.id.localeCompare(right.id))) {
          const ended = await context.workforce.updateMembership({
            actorUserId: command.actorUserId, providerId: command.providerId, requestId: command.requestId,
            idempotencyKey: command.idempotencyKey, teamId: team.id, membershipId: member.id,
            expectedMembershipVersion: member.version, endedAt: now,
          });
          await context.history.append({
            providerId: command.providerId, targetType: "TEAM_MEMBERSHIP", targetId: member.id,
            targetVersion: ended.version, eventCode: "TEAM_MEMBERSHIP_ENDED_BY_ARCHIVE", actorUserId: command.actorUserId,
            safeBefore: { status: "CURRENT", version: member.version, teamId: team.id, cleans: member.cleans },
            safeAfter: { status: "ENDED", version: ended.version, teamId: team.id, cleans: ended.cleans }, requestId: command.requestId,
          });
          impacts.push({ targetType: "TEAM_MEMBERSHIP", targetId: member.id, outcomeCode: "TEAM_MEMBERSHIP_ENDED", version: ended.version });
        }
      }
      const changed = await context.workforce.updateTeam({
        ...command, status: nextStatus,
        ...(command.action === "ARCHIVE" && team.primarySupervisorWorkerId !== null ? { primarySupervisorWorkerId: null } : {}),
      });
      if (command.action === "ARCHIVE" && team.primarySupervisorWorkerId !== null) {
        await context.history.append({
          providerId: command.providerId, targetType: "PRIMARY_SUPERVISOR", targetId: team.id,
          targetVersion: changed.version, eventCode: "PRIMARY_SUPERVISOR_CLEARED_BY_TEAM_ARCHIVE", actorUserId: command.actorUserId,
          safeBefore: { status: "ASSIGNED", version: team.version }, safeAfter: { status: "UNASSIGNED", version: changed.version }, requestId: command.requestId,
        });
        if (supervisor?.identityUserId !== null && supervisor?.identityUserId !== undefined) {
          const remaining = await context.workforce.countPrimarySupervisorAssignments(supervisor.identityUserId);
          await context.identityAuthority.reconcileProviderSupervisorRole({ userId: supervisor.identityUserId, shouldBeEnabled: remaining > 0 });
        }
      }
      const outcomeCode = `TEAM_${command.action === "REACTIVATE" ? "REACTIVATED" : command.action === "DEACTIVATE" ? "DEACTIVATED" : command.action === "ACTIVATE" ? "ACTIVATED" : "ARCHIVED"}`;
      await this.teamHistory(context, command, team, changed, outcomeCode);
      return this.accept(context, command, scopeKey, outcomeCode, changed, impacts);
    });
  }

  private async assertManager(context: ProvidersWorkforceTransactionContext, providerId: string, actorUserId: string) {
    const membership = await context.workforce.readActorMembership(providerId, actorUserId);
    if (membership === null || !membership.active) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
  }

  private teamHistory(context: ProvidersWorkforceTransactionContext, command: WorkforceCommandMeta, before: TeamSnapshot | null, after: TeamSnapshot, eventCode: string) {
    return context.history.append({
      providerId: command.providerId, targetType: "TEAM", targetId: after.id, targetVersion: after.version,
      eventCode, actorUserId: command.actorUserId,
      ...(before === null ? {} : { safeBefore: { status: before.status, version: before.version } }),
      safeAfter: { status: after.status, version: after.version }, requestId: command.requestId,
    });
  }

  private async accept(context: ProvidersWorkforceTransactionContext, command: WorkforceCommandMeta, scopeKey: string, outcomeCode: string, team: TeamSnapshot, impacts: readonly Readonly<Record<string, unknown>>[]) {
    await context.audit.append({ actorType: "USER", actorId: command.actorUserId, action: `providers.workforce.team.${outcomeCode.toLocaleLowerCase("en-US")}`, targetType: "provider_team", targetId: team.id, context: { outcome: "SUCCEEDED", providerId: command.providerId, targetVersion: team.version }, requestId: command.requestId });
    const result = { outcomeCode, targetId: team.id, version: team.version, impacts } as const;
    await context.commands.accept({ scopeKey, idempotencyKey: command.idempotencyKey, safeResultCode: outcomeCode, safeResult: result });
    return result;
  }
}

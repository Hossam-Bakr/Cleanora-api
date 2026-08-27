import type { ProvidersWorkforceTransactionContext, ProvidersWorkforceUnitOfWorkPort, TeamMemberSnapshot, TeamSnapshot } from "./domain/provider-workforce.types.js";
import { isValidCleaningMember, WorkforcePolicyError } from "./domain/provider-workforce.policy.js";

function mapTeam(team: TeamSnapshot, members: readonly TeamMemberSnapshot[]) {
  return {
    teamId: team.id,
    providerId: team.providerId,
    name: team.name,
    status: team.status,
    primarySupervisorWorkerId: team.primarySupervisorWorkerId,
    currentMemberCount: members.length,
    validCleanerCount: members.filter(isValidCleaningMember).length,
    version: team.version,
  } as const;
}

function mapMember(member: TeamMemberSnapshot) {
  return {
    membershipId: member.id,
    workerId: member.workerId,
    fullLegalName: member.worker.profile.fullLegalName,
    gender: member.worker.profile.gender.toLocaleLowerCase("en-US") as "male" | "female",
    workerType: member.worker.profile.workerType,
    cleans: member.cleans,
    workerStatus: member.worker.status,
    membershipVersion: member.version,
  } as const;
}

export class ProviderTeamQueryService {
  public constructor(private readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort) {}

  public list(input: { readonly actorUserId: string; readonly providerId: string; readonly limit?: number; readonly cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    return this.unitOfWork.run(async (context) => {
      const managed = await this.isManager(context, input.providerId, input.actorUserId);
      let teams: readonly TeamSnapshot[];
      if (managed) {
        teams = await context.workforce.listTeams(input.providerId, limit + 1, input.cursor);
      } else {
        const scoped = await this.supervisorTeam(context, input.providerId, input.actorUserId);
        teams = scoped === null ? [] : [scoped];
      }
      if (!managed && teams.length === 0) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const page = teams.slice(0, limit);
      const items = [];
      for (const team of page) items.push(mapTeam(team, await context.workforce.listCurrentTeamMembers(team.id)));
      return { items, nextCursor: teams.length > limit ? teams[limit - 1]?.id ?? null : null } as const;
    });
  }

  public get(input: { readonly actorUserId: string; readonly providerId: string; readonly teamId: string }) {
    return this.unitOfWork.run(async (context) => {
      const managed = await this.isManager(context, input.providerId, input.actorUserId);
      const team = managed
        ? await context.workforce.getTeam(input.providerId, input.teamId)
        : await this.supervisorTeam(context, input.providerId, input.actorUserId);
      if (team === null || team.id !== input.teamId) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const members = await context.workforce.listCurrentTeamMembers(team.id);
      return { team: mapTeam(team, members), members: members.map(mapMember) } as const;
    });
  }

  public history(input: { readonly actorUserId: string; readonly providerId: string; readonly teamId: string; readonly limit?: number; readonly cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    return this.unitOfWork.run(async (context) => {
      if (!await this.isManager(context, input.providerId, input.actorUserId)) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      if (await context.workforce.getTeam(input.providerId, input.teamId) === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const rows = await context.history.list({
        providerId: input.providerId, targetType: "TEAM", targetId: input.teamId,
        limit: limit + 1, ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      return {
        items: rows.slice(0, limit).map((row) => ({
          historyId: row.id, targetType: row.targetType, targetId: row.targetId,
          targetVersion: row.targetVersion, eventCode: row.eventCode, actorUserId: row.actorUserId,
          reasonCode: row.reasonCode ?? null, note: row.note ?? null,
          safeBefore: row.safeBefore ?? null, safeAfter: row.safeAfter ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
        nextCursor: rows.length > limit ? rows[limit - 1]?.id ?? null : null,
      } as const;
    });
  }

  private async isManager(context: ProvidersWorkforceTransactionContext, providerId: string, actorUserId: string) {
    const membership = await context.workforce.readActorMembership(providerId, actorUserId);
    return membership !== null && membership.active;
  }

  private async supervisorTeam(context: ProvidersWorkforceTransactionContext, providerId: string, actorUserId: string) {
    const worker = await context.workforce.getCurrentWorkerByIdentity(actorUserId);
    if (worker === null || worker.providerId !== providerId || worker.status !== "ACTIVE") return null;
    const membership = await context.workforce.getCurrentMembershipForWorker(worker.id);
    if (membership === null) return null;
    const team = await context.workforce.getTeam(providerId, membership.teamId);
    return team?.primarySupervisorWorkerId === worker.id ? team : null;
  }
}

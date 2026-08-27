import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  WorkforceHistorySnapshot,
  WorkerSnapshot,
} from "./domain/provider-workforce.types.js";
import type { WorkerAvatarPort } from "../media/media.public.js";
import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import {
  decideWorkforceAuthorization,
  type WorkforceAuthorizationFacts,
} from "./domain/provider-workforce-authorization.policy.js";
import {
  mapWorkerListItem,
  mapWorkerPrivateDto,
  mapWorkerSelfDto,
  mapWorkerSupervisorDto,
} from "./provider-workforce.dto.js";

interface ActorScope {
  readonly facts: WorkforceAuthorizationFacts;
  readonly supervisorTeamId: string | null;
}

function mapHistory(row: WorkforceHistorySnapshot) {
  return {
    historyId: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    targetVersion: row.targetVersion,
    eventCode: row.eventCode,
    actorUserId: row.actorUserId,
    reasonCode: row.reasonCode ?? null,
    note: row.note ?? null,
    safeBefore: row.safeBefore ?? null,
    safeAfter: row.safeAfter ?? null,
    createdAt: row.createdAt.toISOString(),
  } as const;
}

export class ProviderWorkforceQueryService {
  public constructor(
    private readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort,
    private readonly avatar: WorkerAvatarPort,
  ) {}

  public list(input: { readonly actorUserId: string; readonly providerId: string; readonly limit?: number; readonly cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    return this.unitOfWork.run(async (context) => {
      const actor = await this.resolveActor(context, input.providerId, input.actorUserId);
      const decision = decideWorkforceAuthorization("LIST_WORKFORCE", actor.facts);
      if (!decision.allowed) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (decision.scope === "PROVIDER") {
        const rows = await context.workforce.listWorkers(input.providerId, limit + 1, input.cursor);
        const page = rows.slice(0, limit);
        return { items: page.map((worker) => mapWorkerListItem(worker)), nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null } as const;
      }
      if (actor.supervisorTeamId === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const members = await context.workforce.listCurrentTeamMembers(actor.supervisorTeamId);
      const sorted = [...members].sort((left, right) => left.workerId.localeCompare(right.workerId));
      const start = input.cursor === undefined ? 0 : Math.max(0, sorted.findIndex((member) => member.workerId === input.cursor) + 1);
      const rows = sorted.slice(start, start + limit + 1);
      const page = rows.slice(0, limit);
      return {
        items: page.map((member) => mapWorkerListItem(member.worker, member.teamId)),
        nextCursor: rows.length > limit ? page.at(-1)?.workerId ?? null : null,
      } as const;
    });
  }

  public listWorkers(input: { readonly actorUserId: string; readonly providerId: string; readonly limit?: number; readonly cursor?: string }) {
    return this.list(input);
  }

  public get(input: { readonly actorUserId: string; readonly providerId: string; readonly workerId: string }) {
    return this.unitOfWork.run(async (context) => {
      const worker = await context.workforce.getWorker(input.providerId, input.workerId);
      if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const actor = await this.resolveActor(context, input.providerId, input.actorUserId, worker);
      let targetMembership: TeamMemberSnapshot | null = null;
      if (actor.supervisorTeamId !== null) {
        const membership = await context.workforce.getCurrentMembershipForWorker(worker.id);
        if (membership?.teamId === actor.supervisorTeamId) targetMembership = membership;
      }
      const facts = { ...actor.facts, targetIsCurrentTeamMember: targetMembership !== null };
      const decision = decideWorkforceAuthorization("READ_WORKER", facts);
      if (!decision.allowed) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (decision.scope === "SELF") {
        return mapWorkerSelfDto(worker, await this.readPrivateAvatar(worker, input.actorUserId));
      }
      if (decision.scope === "CURRENT_TEAM" && targetMembership !== null) return mapWorkerSupervisorDto(worker, targetMembership);
      return mapWorkerPrivateDto(worker, await this.readPrivateAvatar(worker, input.actorUserId));
    });
  }

  public getWorker(input: { readonly actorUserId: string; readonly providerId: string; readonly workerId: string }) {
    return this.get(input);
  }

  public history(input: { readonly actorUserId: string; readonly providerId: string; readonly workerId: string; readonly limit?: number; readonly cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    return this.unitOfWork.run(async (context) => {
      if (await context.workforce.getWorker(input.providerId, input.workerId) === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const actor = await this.resolveActor(context, input.providerId, input.actorUserId);
      if (!decideWorkforceAuthorization("READ_HISTORY", actor.facts).allowed) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const rows = await context.history.listForWorker({
        providerId: input.providerId,
        workerId: input.workerId,
        limit: limit + 1,
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      return {
        items: rows.slice(0, limit).map(mapHistory),
        nextCursor: rows.length > limit ? rows[limit - 1]?.id ?? null : null,
      } as const;
    });
  }

  public listWorkerHistory(input: { readonly actorUserId: string; readonly providerId: string; readonly workerId: string; readonly limit?: number; readonly cursor?: string }) {
    return this.history(input);
  }

  private async resolveActor(
    context: ProvidersWorkforceTransactionContext,
    providerId: string,
    actorUserId: string,
    targetWorker?: WorkerSnapshot,
  ): Promise<ActorScope> {
    const membership = await context.workforce.readActorMembership(providerId, actorUserId);
    const managementLevel = membership?.active === true ? membership.level : null;
    const actorWorker = await context.workforce.getCurrentWorkerByIdentity(actorUserId);
    let supervisorTeamId: string | null = null;
    if (actorWorker?.providerId === providerId && actorWorker.status === "ACTIVE") {
      const actorTeamMembership = await context.workforce.getCurrentMembershipForWorker(actorWorker.id);
      if (actorTeamMembership !== null) {
        const team = await context.workforce.getTeam(providerId, actorTeamMembership.teamId);
        if (team?.primarySupervisorWorkerId === actorWorker.id) supervisorTeamId = team.id;
      }
    }
    return {
      supervisorTeamId,
      facts: {
        managementLevel,
        sameProvider: managementLevel !== null || actorWorker?.providerId === providerId,
        isSelf: targetWorker?.identityUserId === actorUserId,
        isPrimarySupervisor: supervisorTeamId !== null,
        targetIsCurrentTeamMember: false,
      },
    };
  }

  private async readPrivateAvatar(
    worker: WorkerSnapshot,
    actorUserId: string,
  ): Promise<{ readonly url: string; readonly expiresAt: string } | null> {
    const mediaFileId = worker.profile.avatarMediaFileId;
    if (mediaFileId === null) return null;
    const delivery = await this.avatar.issuePrivateDelivery({
      mediaFileId,
      actorUserId,
      providerId: worker.providerId,
      workerId: worker.id,
      purpose: "WORKER_AVATAR_PRIVATE_READ",
    });
    return { url: delivery.url, expiresAt: delivery.expiresAt.toISOString() };
  }
}

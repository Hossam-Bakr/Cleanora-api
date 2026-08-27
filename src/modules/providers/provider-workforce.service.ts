import { randomUUID } from "node:crypto";

import type { ProvidersWorkforceUnitOfWorkPort, WorkerProfileInput, WorkerSnapshot } from "./domain/provider-workforce.types.js";
import {
  fingerprintWorkforceCommand,
  assertCleanerToEscortAllowed,
  isValidCleaningMember,
  normalizeDisplayLabel,
  validateWorkerProfile,
  WorkforcePolicyError,
} from "./domain/provider-workforce.policy.js";
import { lockCurrentTeamMembership } from "./provider-workforce-impact.service.js";
import { mapWorkerListItem, mapWorkerPrivateDto } from "./provider-workforce.dto.js";

export interface CreateWorkerDraftCommand {
  readonly actorUserId: string;
  readonly sessionId?: string;
  readonly providerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  /** Provider workforce-state version because the Worker aggregate does not exist yet. */
  readonly expectedVersion: number;
  readonly profile: {
    readonly fullLegalName: string;
    readonly gender: "male" | "female";
    readonly operationalPhoneE164: string;
    readonly workerType: "CLEANING_STAFF" | "ESCORT" | "OTHER";
    readonly displayTitle: string | null;
    readonly supervisorCapable: boolean;
    readonly skillTags: readonly string[];
  };
}

export interface ReplaceWorkerProfileCommand extends Omit<CreateWorkerDraftCommand, "expectedVersion"> {
  readonly workerId: string;
  /** Exact profile version from the public contract. */
  readonly expectedVersion: number;
}

function toProfile(input: CreateWorkerDraftCommand["profile"]): WorkerProfileInput {
  return {
    fullLegalName: normalizeDisplayLabel(input.fullLegalName),
    gender: input.gender === "male" ? "MALE" : "FEMALE",
    operationalPhoneE164: input.operationalPhoneE164,
    workerType: input.workerType,
    displayTitle: input.displayTitle === null ? null : normalizeDisplayLabel(input.displayTitle),
    supervisorCapable: input.supervisorCapable,
    skills: input.skillTags,
  };
}

function assertManagementMembership(value: {
  readonly level: "OWNER" | "ADMIN";
  readonly active: boolean;
} | null): asserts value is { readonly level: "OWNER" | "ADMIN"; readonly active: true } {
  if (value === null || !value.active) throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
}

function replayTargetId(result: Readonly<Record<string, unknown>> | null): string {
  const targetId = result?.["targetId"];
  if (typeof targetId !== "string" || targetId.length === 0) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return targetId;
}

export class ProviderWorkforceService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly createId?: () => string;
  }) {}

  public async createWorkerDraft(command: CreateWorkerDraftCommand) {
    const profile = toProfile(command.profile);
    validateWorkerProfile(profile);
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion <= 0) {
      throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "expectedVersion" });
    }
    const requestFingerprint = fingerprintWorkforceCommand({
      operation: "CREATE_WORKER_DRAFT",
      providerId: command.providerId,
      expectedVersion: command.expectedVersion,
      profile,
    });
    const scopeKey = `provider:${command.providerId}:worker:create`;

    return this.dependencies.unitOfWork.run(async (context) => {
      const idempotency = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.actorUserId,
      });
      const provider = await context.workforce.lockProvider(command.providerId);
      if (provider === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      const membership = await context.workforce.readActorMembership(command.providerId, command.actorUserId);
      assertManagementMembership(membership);

      if (idempotency.replay) {
        const replayed = await context.workforce.getWorker(command.providerId, replayTargetId(idempotency.result));
        if (replayed === null) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
        return mapWorkerPrivateDto(replayed);
      }

      const workerId = this.dependencies.createId?.() ?? randomUUID();
      const worker = await context.workforce.createWorker({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        expectedProviderVersion: command.expectedVersion,
        workerId,
        profile,
      });
      await this.appendCreateEvidence(context, command, worker);
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: "WORKER_DRAFT_CREATED",
        safeResult: {
          targetId: worker.id,
          workerVersion: worker.version,
          profileVersion: worker.profile.version,
        },
      });
      return mapWorkerPrivateDto(worker);
    });
  }

  public async replaceWorkerProfile(command: ReplaceWorkerProfileCommand) {
    const profile = toProfile(command.profile);
    validateWorkerProfile(profile);
    const requestFingerprint = fingerprintWorkforceCommand({
      operation: "REPLACE_WORKER_PROFILE",
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      profile,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:profile`;
    return this.dependencies.unitOfWork.run(async (context) => {
      const idempotency = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.actorUserId,
      });
      if (await context.workforce.lockProvider(command.providerId) === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      assertManagementMembership(await context.workforce.readActorMembership(command.providerId, command.actorUserId));
      const current = await context.workforce.lockWorker(command.providerId, command.workerId);
      if (current === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      if (idempotency.replay) {
        const replayed = await context.workforce.getWorker(command.providerId, replayTargetId(idempotency.result));
        if (replayed === null) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
        return mapWorkerPrivateDto(replayed);
      }
      const lockedTeamMembership = await lockCurrentTeamMembership(
        context,
        command.providerId,
        command.workerId,
      );
      const membership = lockedTeamMembership?.membership ?? null;
      assertCleanerToEscortAllowed(profile.workerType, membership?.cleans ?? false);
      const team = lockedTeamMembership?.team ?? null;
      if (membership?.cleans === true
        && team?.status === "ACTIVE"
        && current.status === "ACTIVE"
        && current.profile.workerType === "CLEANING_STAFF"
        && profile.workerType !== "CLEANING_STAFF") {
        const members = await context.workforce.listCurrentTeamMembers(team.id);
        const hasOtherValidCleaner = members.some((member) => member.workerId !== current.id && isValidCleaningMember(member));
        if (!hasOtherValidCleaner) {
          throw new WorkforcePolicyError("WORKFORCE_FINAL_CLEANER_CONFLICT", {
            teamId: team.id,
            teamVersion: team.version,
          });
        }
      }
      const clearsPrimarySupervisor = team?.primarySupervisorWorkerId === current.id
        && current.profile.supervisorCapable
        && !profile.supervisorCapable;
      const changedTeam = clearsPrimarySupervisor && team !== null
        ? await context.workforce.updateTeam({
          actorUserId: command.actorUserId,
          providerId: command.providerId,
          requestId: command.requestId,
          idempotencyKey: command.idempotencyKey,
          teamId: team.id,
          expectedVersion: team.version,
          primarySupervisorWorkerId: null,
        })
        : null;
      const updated = await context.workforce.replaceWorkerProfile({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: command.workerId,
        expectedVersion: current.version,
        expectedProfileVersion: command.expectedVersion,
        profile,
      });
      if (changedTeam !== null && team !== null) {
        await context.history.append({
          providerId: command.providerId,
          targetType: "PRIMARY_SUPERVISOR",
          targetId: changedTeam.id,
          targetVersion: changedTeam.version,
          eventCode: "PRIMARY_SUPERVISOR_CLEARED_BY_CAPABILITY_LOSS",
          actorUserId: command.actorUserId,
          safeBefore: { status: "ASSIGNED", version: team.version },
          safeAfter: { status: "UNASSIGNED", version: changedTeam.version },
          requestId: command.requestId,
        });
        if (current.identityUserId !== null) {
          const remaining = await context.workforce.countPrimarySupervisorAssignments(current.identityUserId);
          await context.identityAuthority.reconcileProviderSupervisorRole({
            userId: current.identityUserId,
            shouldBeEnabled: remaining > 0,
          });
        }
      }
      await context.history.append({
        providerId: command.providerId,
        targetType: "WORKER_PROFILE",
        targetId: updated.id,
        targetVersion: updated.profile.version,
        eventCode: "WORKER_PROFILE_REPLACED",
        actorUserId: command.actorUserId,
        safeBefore: { workerType: current.profile.workerType, version: current.profile.version },
        safeAfter: { workerType: updated.profile.workerType, version: updated.profile.version },
        requestId: command.requestId,
      });
      await context.history.append({
        providerId: command.providerId,
        targetType: "WORKER",
        targetId: updated.id,
        targetVersion: updated.version,
        eventCode: "WORKER_PROFILE_VERSION_ADVANCED",
        actorUserId: command.actorUserId,
        safeBefore: { status: current.status, version: current.version },
        safeAfter: { status: updated.status, version: updated.version },
        requestId: command.requestId,
      });
      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.workforce.worker.profile.replace",
        targetType: "provider_worker",
        targetId: updated.id,
        context: { outcome: "SUCCEEDED", workerVersion: updated.version, relatedVersion: updated.profile.version },
        requestId: command.requestId,
      });
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: "WORKER_PROFILE_REPLACED",
        safeResult: { targetId: updated.id, workerVersion: updated.version, profileVersion: updated.profile.version },
      });
      return mapWorkerPrivateDto(updated);
    });
  }

  public async listWorkers(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly limit?: number;
    readonly cursor?: string;
  }) {
    return this.dependencies.unitOfWork.run(async (context) => {
      const provider = await context.workforce.lockProvider(input.providerId);
      if (provider === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      assertManagementMembership(await context.workforce.readActorMembership(input.providerId, input.actorUserId));
      const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
      const rows = await context.workforce.listWorkers(input.providerId, limit + 1, input.cursor);
      const page = rows.slice(0, limit);
      return {
        items: page.map((worker) => mapWorkerListItem(worker)),
        nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null,
      };
    });
  }

  public async getWorker(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly workerId: string;
  }) {
    return this.dependencies.unitOfWork.run(async (context) => {
      const provider = await context.workforce.lockProvider(input.providerId);
      if (provider === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      assertManagementMembership(await context.workforce.readActorMembership(input.providerId, input.actorUserId));
      const worker = await context.workforce.getWorker(input.providerId, input.workerId);
      if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      return mapWorkerPrivateDto(worker);
    });
  }

  private async appendCreateEvidence(
    context: Parameters<Parameters<ProvidersWorkforceUnitOfWorkPort["run"]>[0]>[0],
    command: CreateWorkerDraftCommand,
    worker: WorkerSnapshot,
  ): Promise<void> {
    await context.history.append({
      providerId: command.providerId,
      targetType: "WORKER",
      targetId: worker.id,
      targetVersion: worker.version,
      eventCode: "WORKER_DRAFT_CREATED",
      actorUserId: command.actorUserId,
      safeAfter: { status: worker.status, version: worker.version },
      requestId: command.requestId,
    });
    await context.history.append({
      providerId: command.providerId,
      targetType: "WORKER_PROFILE",
      targetId: worker.id,
      targetVersion: worker.profile.version,
      eventCode: "WORKER_PROFILE_CREATED",
      actorUserId: command.actorUserId,
      safeAfter: { workerType: worker.profile.workerType, version: worker.profile.version },
      requestId: command.requestId,
    });
    await context.audit.append({
      actorType: "USER",
      actorId: command.actorUserId,
      action: "providers.workforce.worker.create",
      targetType: "provider_worker",
      targetId: worker.id,
      context: {
        outcome: "SUCCEEDED",
        operationalStatus: worker.status,
        workerVersion: worker.version,
        relatedVersion: worker.profile.version,
      },
      requestId: command.requestId,
    });
  }
}

import { createHash } from "node:crypto";

import { MediaError, type WorkerAvatarPort, type WorkerAvatarReceipt } from "../media/media.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkforceSafeResult,
  WorkerSnapshot,
} from "./domain/provider-workforce.types.js";
import { fingerprintWorkforceCommand, WorkforcePolicyError } from "./domain/provider-workforce.policy.js";

interface WorkerAvatarCommandBase {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly workerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  /** Exact Worker-profile version. */
  readonly expectedVersion: number;
}

export interface UploadWorkerAvatarCommand extends WorkerAvatarCommandBase {
  readonly declaredContentType: string;
  readonly bytes: Buffer;
}

export type RemoveWorkerAvatarCommand = WorkerAvatarCommandBase;

interface SafeAvatarCommandResult extends Readonly<Record<string, unknown>> {
  readonly outcomeCode: string;
  readonly targetId: string;
  readonly version: number;
  readonly impacts: readonly Readonly<Record<string, unknown>>[];
}

function assertManagementMembership(value: {
  readonly level: "OWNER" | "ADMIN";
  readonly active: boolean;
} | null): void {
  if (value === null || !value.active) throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
}

function validateExpectedVersion(expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
    throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "expectedVersion" });
  }
}

function readSafeResult(value: WorkforceSafeResult | null): SafeAvatarCommandResult {
  const outcomeCode = value?.["outcomeCode"];
  const targetId = value?.["targetId"];
  const version = value?.["version"];
  const impacts = value?.["impacts"];
  if (typeof outcomeCode !== "string"
    || typeof targetId !== "string"
    || typeof version !== "number"
    || !Array.isArray(impacts)) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return { outcomeCode, targetId, version, impacts };
}

function resultFor(outcomeCode: "WORKER_AVATAR_ASSOCIATED" | "WORKER_AVATAR_REMOVED", worker: WorkerSnapshot): SafeAvatarCommandResult {
  return {
    outcomeCode,
    targetId: worker.id,
    version: worker.profile.version,
    impacts: [{
      targetType: "AVATAR",
      targetId: worker.id,
      outcomeCode,
      version: worker.profile.version,
    }],
  };
}

export class ProviderWorkforceMediaService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly avatar: WorkerAvatarPort;
  }) {}

  public async upload(command: UploadWorkerAvatarCommand): Promise<SafeAvatarCommandResult> {
    validateExpectedVersion(command.expectedVersion);
    let receipt: WorkerAvatarReceipt;
    try {
      receipt = await this.dependencies.avatar.ingest({
        ownerUserId: command.actorUserId,
        declaredContentType: command.declaredContentType,
        bytes: command.bytes,
      });
    } catch (error: unknown) {
      if (error instanceof MediaError) {
        if (error.code === "MEDIA_PROVIDER_FAILURE" || error.code === "MEDIA_PROVIDER_UNSUPPORTED") {
          throw new WorkforcePolicyError("WORKFORCE_DEPENDENCY_NOT_READY");
        }
        throw new WorkforcePolicyError("WORKER_AVATAR_INVALID");
      }
      throw error;
    }
    if (receipt.state !== "READY" || receipt.ownerUserId !== command.actorUserId) {
      await this.cleanupWithoutMasking(receipt.mediaFileId, "WORKER_AVATAR_ASSOCIATION_FAILED");
      throw new WorkforcePolicyError("WORKER_AVATAR_INVALID");
    }

    let committed: {
      readonly result: SafeAvatarCommandResult;
      readonly previousMediaFileId: string | null;
      readonly replay: boolean;
    };
    try {
      committed = await this.dependencies.unitOfWork.run((context) => this.associate(context, command, receipt));
    } catch (error: unknown) {
      await this.cleanupWithoutMasking(receipt.mediaFileId, "WORKER_AVATAR_ASSOCIATION_FAILED");
      throw error;
    }

    if (committed.replay) {
      await this.cleanupWithoutMasking(receipt.mediaFileId, "WORKER_AVATAR_UNBOUND_REPLAY");
    } else if (committed.previousMediaFileId !== null && committed.previousMediaFileId !== receipt.mediaFileId) {
      await this.cleanupWithoutMasking(committed.previousMediaFileId, "WORKER_AVATAR_REPLACED_OR_REMOVED");
    }
    return committed.result;
  }

  public async remove(command: RemoveWorkerAvatarCommand): Promise<SafeAvatarCommandResult> {
    validateExpectedVersion(command.expectedVersion);
    const requestFingerprint = fingerprintWorkforceCommand({
      operation: "REMOVE_WORKER_AVATAR",
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:avatar`;
    const committed = await this.dependencies.unitOfWork.run(async (context) => {
      const idempotency = await context.commands.begin({
        providerId: command.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.actorUserId,
      });
      const current = await this.authorizeAndLock(context, command);
      if (idempotency.replay) {
        return { result: readSafeResult(idempotency.result), previousMediaFileId: null, replay: true } as const;
      }
      const updated = await context.workforce.setWorkerAvatar({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        workerId: command.workerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        expectedProfileVersion: command.expectedVersion,
        mediaFileId: null,
      });
      const result = resultFor("WORKER_AVATAR_REMOVED", updated);
      await this.appendEvidence(context, command, current, updated, result.outcomeCode);
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: result.outcomeCode,
        safeResult: result,
      });
      return { result, previousMediaFileId: current.profile.avatarMediaFileId, replay: false } as const;
    });
    if (committed.previousMediaFileId !== null) {
      await this.cleanupWithoutMasking(committed.previousMediaFileId, "WORKER_AVATAR_REPLACED_OR_REMOVED");
    }
    return committed.result;
  }

  private async associate(
    context: ProvidersWorkforceTransactionContext,
    command: UploadWorkerAvatarCommand,
    receipt: WorkerAvatarReceipt,
  ) {
    const requestFingerprint = fingerprintWorkforceCommand({
      operation: "ASSOCIATE_WORKER_AVATAR",
      providerId: command.providerId,
      workerId: command.workerId,
      expectedVersion: command.expectedVersion,
      declaredContentType: command.declaredContentType,
      contentSha256: createHash("sha256").update(command.bytes).digest("hex"),
    });
    const scopeKey = `provider:${command.providerId}:worker:${command.workerId}:avatar`;
    const idempotency = await context.commands.begin({
      providerId: command.providerId,
      scopeKey,
      idempotencyKey: command.idempotencyKey,
      requestFingerprint,
      actorUserId: command.actorUserId,
    });
    const current = await this.authorizeAndLock(context, command);
    if (idempotency.replay) {
      return { result: readSafeResult(idempotency.result), previousMediaFileId: null, replay: true } as const;
    }
    const authorized = await context.avatarAuthorizer.assertReadyOwnedProfileImage({
      mediaFileId: receipt.mediaFileId,
      ownerUserId: command.actorUserId,
    });
    if (!authorized) throw new WorkforcePolicyError("WORKER_AVATAR_INVALID");
    const updated = await context.workforce.setWorkerAvatar({
      actorUserId: command.actorUserId,
      providerId: command.providerId,
      workerId: command.workerId,
      requestId: command.requestId,
      idempotencyKey: command.idempotencyKey,
      expectedProfileVersion: command.expectedVersion,
      mediaFileId: receipt.mediaFileId,
    });
    const result = resultFor("WORKER_AVATAR_ASSOCIATED", updated);
    await this.appendEvidence(context, command, current, updated, result.outcomeCode);
    await context.commands.accept({
      scopeKey,
      idempotencyKey: command.idempotencyKey,
      safeResultCode: result.outcomeCode,
      safeResult: result,
    });
    return { result, previousMediaFileId: current.profile.avatarMediaFileId, replay: false } as const;
  }

  private async authorizeAndLock(
    context: ProvidersWorkforceTransactionContext,
    command: WorkerAvatarCommandBase,
  ): Promise<WorkerSnapshot> {
    if (await context.workforce.lockProvider(command.providerId) === null) {
      throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    }
    assertManagementMembership(await context.workforce.readActorMembership(command.providerId, command.actorUserId));
    const current = await context.workforce.lockWorker(command.providerId, command.workerId);
    if (current === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return current;
  }

  private async appendEvidence(
    context: ProvidersWorkforceTransactionContext,
    command: WorkerAvatarCommandBase,
    current: WorkerSnapshot,
    updated: WorkerSnapshot,
    outcomeCode: string,
  ): Promise<void> {
    await context.history.append({
      providerId: command.providerId,
      targetType: "WORKER_PROFILE",
      targetId: updated.id,
      targetVersion: updated.profile.version,
      eventCode: outcomeCode,
      actorUserId: command.actorUserId,
      safeBefore: { version: current.profile.version },
      safeAfter: { version: updated.profile.version },
      requestId: command.requestId,
    });
    await context.audit.append({
      actorType: "USER",
      actorId: command.actorUserId,
      action: outcomeCode === "WORKER_AVATAR_REMOVED"
        ? "providers.workforce.worker.avatar.remove"
        : "providers.workforce.worker.avatar.associate",
      targetType: "provider_worker",
      targetId: updated.id,
      context: {
        outcome: "SUCCEEDED",
        workerVersion: updated.version,
        relatedVersion: updated.profile.version,
      },
      requestId: command.requestId,
    });
  }

  private async cleanupWithoutMasking(mediaFileId: string, safeReasonCode: string): Promise<void> {
    try {
      await this.dependencies.avatar.requestCleanup({ mediaFileId, safeReasonCode });
    } catch {
      // Cleanup is Media-owned and retryable; it must never turn an accepted
      // Providers command into a failed one or mask the original transaction error.
    }
  }
}

import type { Prisma, PrismaClient } from "#generated/prisma/client";

import type { WorkforceCommandRepositoryPort, WorkforceSafeResult } from "../domain/provider-workforce.types.js";
import { WorkforcePolicyError } from "../domain/provider-workforce.policy.js";

type DbClient = Prisma.TransactionClient | PrismaClient;

export class PrismaProviderWorkforceCommandRepository implements WorkforceCommandRepositoryPort {
  public constructor(private readonly db: DbClient) {}

  public async begin(input: Parameters<WorkforceCommandRepositoryPort["begin"]>[0]) {
    await this.db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.scopeKey}:${input.idempotencyKey}`}, 0))`;
    const existing = await this.db.providerWorkforceCommand.findUnique({ where: { scopeKey_idempotencyKey: { scopeKey: input.scopeKey, idempotencyKey: input.idempotencyKey } } });
    if (existing !== null) {
      if (existing.requestFingerprint !== input.requestFingerprint || existing.actorUserId !== input.actorUserId) {
        throw new WorkforcePolicyError("WORKFORCE_IDEMPOTENCY_KEY_CONFLICT");
      }
      if (existing.status !== "ACCEPTED") throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      return { replay: true, result: existing.safeResultJson as WorkforceSafeResult | null };
    }
    await this.db.providerWorkforceCommand.create({ data: { providerId: input.providerId, scopeKey: input.scopeKey, idempotencyKey: input.idempotencyKey, requestFingerprint: input.requestFingerprint, actorUserId: input.actorUserId } });
    return { replay: false, result: null };
  }

  public async accept(input: Parameters<WorkforceCommandRepositoryPort["accept"]>[0]): Promise<void> {
    const changed = await this.db.providerWorkforceCommand.updateMany({ where: { scopeKey: input.scopeKey, idempotencyKey: input.idempotencyKey, status: "IN_PROGRESS" }, data: { status: "ACCEPTED", safeResultCode: input.safeResultCode, safeResultJson: input.safeResult as Prisma.InputJsonValue, completedAt: new Date() } });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
}

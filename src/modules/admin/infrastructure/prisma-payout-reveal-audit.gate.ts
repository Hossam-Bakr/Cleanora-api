import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import type {
  PayoutRevealAuditGate,
  TransactionalAcceptedPayoutRevealAuthorizer,
} from "../audit.public.js";

const ACCEPTED_ACTION = "PROVIDER_PAYOUT_REVEAL_ACCEPTED";
const DENIED_ACTION = "PROVIDER_PAYOUT_REVEAL_DENIED";

export class PrismaAcceptedPayoutRevealAuthorizer
  implements TransactionalAcceptedPayoutRevealAuthorizer
{
  public constructor(private readonly db: Prisma.TransactionClient) {}

  public async authorize(
    input: Parameters<TransactionalAcceptedPayoutRevealAuthorizer["authorize"]>[0],
  ): Promise<boolean> {
    const accepted = await this.db.auditLog.findFirst({
      where: {
        id: input.attemptId,
        actorId: input.actorUserId,
        action: ACCEPTED_ACTION,
        targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION",
        targetId: input.destinationVersionId,
        AND: [
          { context: { path: ["providerId"], equals: input.providerId } },
          { context: { path: ["expectedVersion"], equals: input.expectedVersion } },
          { context: { path: ["purpose"], equals: input.purpose } },
          { context: { path: ["outcome"], equals: "ACCEPTED" } },
        ],
      },
      select: { id: true },
    });
    return accepted !== null;
  }
}

export class PrismaPayoutRevealAuditGate implements PayoutRevealAuditGate {
  public constructor(
    private readonly db: Prisma.TransactionClient | ReturnType<typeof getPrismaClient> = getPrismaClient(),
  ) {}
  public async commitAcceptedReveal(input: Parameters<PayoutRevealAuditGate["commitAcceptedReveal"]>[0]) {
    const execute = async (transaction: Prisma.TransactionClient) => {
      await transaction.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${`payout-reveal:${input.actorUserId}`}))
      `;
      const windowStart = new Date(input.now.getTime() - 10 * 60_000);
      const accepted = await transaction.auditLog.count({
        where: { actorId: input.actorUserId, action: ACCEPTED_ACTION, createdAt: { gt: windowStart } },
      });
      if (accepted >= 5) {
        await transaction.auditLog.create({
          data: {
            actorType: "USER", actorId: input.actorUserId, action: DENIED_ACTION,
            targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION", targetId: input.destinationVersionId,
            reason: "PAYOUT_REVEAL_RATE_LIMITED", requestId: input.requestId,
            context: {
              providerId: input.providerId,
              expectedVersion: input.expectedVersion,
              purpose: input.purpose,
              revealReason: input.reasonCode,
              encryptionKeyIds: [...input.encryptionKeyIds],
              lookupKeyIds: [...input.lookupKeyIds],
              outcome: "DENIED",
            },
          },
        });
        return { accepted: false as const, safeCode: "PAYOUT_REVEAL_RATE_LIMITED" as const };
      }
      const row = await transaction.auditLog.create({
        data: {
          actorType: "USER", actorId: input.actorUserId, action: ACCEPTED_ACTION,
          targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION", targetId: input.destinationVersionId,
          reason: input.reasonCode, requestId: input.requestId,
          context: {
            providerId: input.providerId,
            expectedVersion: input.expectedVersion,
            purpose: input.purpose,
            encryptionKeyIds: [...input.encryptionKeyIds],
            lookupKeyIds: [...input.lookupKeyIds],
            outcome: "ACCEPTED",
          },
        },
      });
      return { accepted: true as const, attemptId: row.id, acceptedAt: row.createdAt };
    };
    if ("$transaction" in this.db) return this.db.$transaction(execute);
    return execute(this.db as Prisma.TransactionClient);
  }
  public async appendDeniedReveal(input: Parameters<PayoutRevealAuditGate["appendDeniedReveal"]>[0]): Promise<void> {
    await this.db.auditLog.create({
      data: {
        actorType: input.actorUserId === null ? "UNKNOWN" : "USER",
        ...(input.actorUserId === null ? {} : { actorId: input.actorUserId }),
        action: DENIED_ACTION,
        targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION",
        targetId: input.destinationVersionId,
        reason: input.safeCode,
        requestId: input.requestId,
        context: {
          providerId: input.providerId,
          expectedVersion: input.expectedVersion,
          purpose: input.purpose,
          revealReason: input.safeReason,
          outcome: "DENIED",
          ...(input.encryptionKeyIds === undefined ? {} : { encryptionKeyIds: [...input.encryptionKeyIds] }),
          ...(input.lookupKeyIds === undefined ? {} : { lookupKeyIds: [...input.lookupKeyIds] }),
        },
      },
    });
  }
}

import { getPrismaClient } from "#integrations/database/index";
import { Prisma } from "#generated/prisma/client";

export class PasswordResetRepository {
  async create(data: {
    id: string;
    userId: string;
    channel: "SMS" | "EMAIL";
    destinationHash: string;
    verifier: string;
    expiresAt: Date;
    resendAt: Date;
    maxAttempts: number;
  }) {
    // Supersede every open reset before creating the next pending delivery.
    return getPrismaClient().$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: {
          userId: data.userId,
          status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
        },
        data: { status: "SUPERSEDED", supersededAt: new Date() },
      });
      return transaction.passwordResetToken.create({
        data: {
          id: data.id,
          userId: data.userId,
          channel: data.channel,
          destinationHash: data.destinationHash,
          tokenVerifier: data.verifier,
          expiresAt: data.expiresAt,
          resendAvailableAt: data.resendAt,
          maxAttempts: data.maxAttempts,
        },
      });
    });
  }
  activate(id: string) {
    return getPrismaClient().passwordResetToken.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "ACTIVE", deliveredAt: new Date() },
    });
  }
  failDelivery(id: string) {
    return getPrismaClient().passwordResetToken.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "DELIVERY_FAILED", deliveryFailedAt: new Date() },
    });
  }
  find(id: string) {
    return getPrismaClient().passwordResetToken.findUnique({ where: { id } });
  }
  async failAttempt(id: string): Promise<boolean> {
    // Increment and exhaust in one SQL statement so parallel failures cannot lose updates.
    const rows = await getPrismaClient().$queryRaw<
      Array<{ attempt_count: number }>
    >(Prisma.sql`
      UPDATE "password_reset_tokens"
      SET "attempt_count" = "attempt_count" + 1,
          "last_attempt_at" = NOW(),
          "status" = CASE
            WHEN "attempt_count" + 1 >= "max_attempts" THEN 'EXHAUSTED'::"AuthChallengeStatus"
            ELSE "status"
          END
      WHERE "id" = ${id}
        AND "status" = 'ACTIVE'::"AuthChallengeStatus"
        AND "expires_at" > NOW()
        AND "attempt_count" < "max_attempts"
      RETURNING "attempt_count"
    `);
    return rows.length === 1;
  }
  consume(id: string) {
    return getPrismaClient().passwordResetToken.updateMany({
      where: { id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
  }
}

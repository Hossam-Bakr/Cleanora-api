import type { Prisma, PrismaClient } from "#generated/prisma/client";

import type { WorkforceNotificationIntentInput, WorkforceNotificationRepositoryPort } from "../domain/provider-workforce.types.js";
import { assertSafeNotificationIntent } from "../domain/provider-workforce-notification.policy.js";

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface LeasedWorkforceNotification {
  readonly id: string;
  readonly template: WorkforceNotificationIntentInput["template"];
  readonly locale: "AR" | "EN";
  readonly recipientUserId: string | null;
  readonly recipientEmailNormalized: string | null;
  readonly invitationId: string | null;
  readonly historyId: string | null;
  readonly idempotencyKey: string;
  readonly safeVariables: Readonly<Record<string, string | number | boolean | null>>;
}

export class PrismaProviderWorkforceNotificationRepository implements WorkforceNotificationRepositoryPort {
  public constructor(private readonly db: DbClient) {}

  public async insert(input: WorkforceNotificationIntentInput): Promise<void> {
    assertSafeNotificationIntent(input);
    await this.db.providerWorkforceNotificationIntent.create({ data: { ...input, safeVariables: input.safeVariables as Prisma.InputJsonValue } });
  }

  public async lease(limit: number, now: Date, lockedUntil: Date): Promise<readonly LeasedWorkforceNotification[]> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "provider_workforce_notification_intents"
      WHERE "status" IN ('PENDING', 'FAILED')
        AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= ${now})
        AND ("locked_until" IS NULL OR "locked_until" < ${now})
      ORDER BY "created_at", "id" FOR UPDATE SKIP LOCKED LIMIT ${limit}
    `;
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    await this.db.providerWorkforceNotificationIntent.updateMany({ where: { id: { in: ids } }, data: { status: "SENDING", lockedUntil, attemptCount: { increment: 1 } } });
    const leased = await this.db.providerWorkforceNotificationIntent.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "asc" } });
    return leased.map((row) => ({
      id: row.id,
      template: row.template,
      locale: row.locale,
      recipientUserId: row.recipientUserId,
      recipientEmailNormalized: row.recipientEmailNormalized,
      invitationId: row.invitationId,
      historyId: row.historyId,
      idempotencyKey: row.idempotencyKey,
      safeVariables: row.safeVariables as LeasedWorkforceNotification["safeVariables"],
    }));
  }

  public async markSent(id: string, now: Date): Promise<void> {
    await this.db.providerWorkforceNotificationIntent.update({ where: { id }, data: { status: "SENT", sentAt: now, lockedUntil: null, lastSafeErrorCode: null } });
  }

  public async markFailed(id: string, safeErrorCode: string, nextAttemptAt: Date): Promise<void> {
    await this.db.providerWorkforceNotificationIntent.update({ where: { id }, data: { status: "FAILED", lockedUntil: null, lastSafeErrorCode: safeErrorCode, nextAttemptAt } });
  }
}

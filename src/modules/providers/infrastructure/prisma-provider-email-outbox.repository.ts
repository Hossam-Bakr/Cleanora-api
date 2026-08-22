import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { providersError } from "../domain/providers.errors.js";
import type {
  CreateEmailOutboxIntentInput,
  ProviderEmailOutboxRepositoryPort,
} from "../domain/providers.ports.js";
import type {
  ProviderEmailOutboxRecord,
  ProviderEmailOutboxStatus,
  ProviderEmailTemplate,
} from "../domain/providers.types.js";
import { PROVIDER_EMAIL_TEMPLATES } from "../domain/providers.types.js";

type DbClient = Prisma.TransactionClient | PrismaClient;

const OUTBOX_SELECT = {
  id: true,
  providerId: true,
  template: true,
  status: true,
  recipientUserId: true,
  reviewCycle: true,
  statusHistoryId: true,
  verificationHistoryId: true,
  payoutHistoryId: true,
  payoutHistory: {
    select: {
      event: true,
      toStatus: true,
      reasonCode: true,
      safeMask: true,
      destinationVersion: { select: { kind: true } },
    },
  },
  idempotencyKey: true,
  attemptCount: true,
  nextAttemptAt: true,
  lockedUntil: true,
  sentAt: true,
  lastSafeErrorCode: true,
  createdAt: true,
  updatedAt: true,
} as const;

function assertClosedTemplate(template: ProviderEmailTemplate): void {
  if (!(PROVIDER_EMAIL_TEMPLATES as readonly string[]).includes(template)) {
    throw providersError("VALIDATION_ERROR", { field: "template" });
  }
}

function mapOutbox(
  row: Prisma.ProviderEmailOutboxGetPayload<{ select: typeof OUTBOX_SELECT }>,
): ProviderEmailOutboxRecord {
  const { payoutHistory, ...record } = row;
  const destinationType = payoutHistory?.destinationVersion?.kind;
  const payoutNotification =
    payoutHistory === null ||
    destinationType === undefined ||
    payoutHistory.safeMask === null
      ? null
      : {
          destinationType,
          mask: payoutHistory.safeMask,
          status: payoutHistory.toStatus ?? payoutHistory.event,
          reason: payoutHistory.reasonCode ?? payoutHistory.event,
        };
  return { ...record, payoutNotification };
}

/**
 * Durable non-invitation Provider email intents.
 * Invitation delivery must never write here.
 */
export class PrismaProviderEmailOutboxRepository
  implements ProviderEmailOutboxRepositoryPort
{
  public constructor(private readonly db: DbClient) {}

  public async insertIntent(
    input: CreateEmailOutboxIntentInput,
  ): Promise<ProviderEmailOutboxRecord> {
    assertClosedTemplate(input.template);
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing !== null) {
      return existing;
    }
    const row = await this.db.providerEmailOutbox.create({
      data: {
        providerId: input.providerId,
        template: input.template,
        recipientUserId: input.recipientUserId,
        reviewCycle: input.reviewCycle ?? null,
        statusHistoryId: input.statusHistoryId ?? null,
        verificationHistoryId: input.verificationHistoryId ?? null,
        payoutHistoryId: input.payoutHistoryId ?? null,
        idempotencyKey: input.idempotencyKey,
        nextAttemptAt: input.nextAttemptAt ?? new Date(),
        status: "PENDING",
        attemptCount: 0,
      },
      select: OUTBOX_SELECT,
    });
    return mapOutbox(row);
  }

  public async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ProviderEmailOutboxRecord | null> {
    const row = await this.db.providerEmailOutbox.findUnique({
      where: { idempotencyKey },
      select: OUTBOX_SELECT,
    });
    return row === null ? null : mapOutbox(row);
  }

  public async claimBatch(input: {
    readonly now: Date;
    readonly batchSize: number;
    readonly leaseUntil: Date;
  }): Promise<readonly ProviderEmailOutboxRecord[]> {
    const batchSize = Math.max(1, Math.min(input.batchSize, 100));
    const candidates = await this.db.providerEmailOutbox.findMany({
      where: {
        status: { in: ["PENDING", "SENDING"] },
        template: { in: [...PROVIDER_EMAIL_TEMPLATES] },
        AND: [
          {
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: input.now } }],
          },
          {
            OR: [{ lockedUntil: null }, { lockedUntil: { lte: input.now } }],
          },
        ],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: batchSize,
      select: { id: true },
    });

    if (candidates.length === 0) {
      return [];
    }

    const claimed: ProviderEmailOutboxRecord[] = [];
    for (const candidate of candidates) {
      const updated = await this.db.providerEmailOutbox.updateMany({
        where: {
          id: candidate.id,
          status: { in: ["PENDING", "SENDING"] },
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: input.now } }],
        },
        data: {
          status: "SENDING",
          lockedUntil: input.leaseUntil,
        },
      });
      if (updated.count !== 1) {
        continue;
      }
      const row = await this.db.providerEmailOutbox.findUnique({
        where: { id: candidate.id },
        select: OUTBOX_SELECT,
      });
      if (row !== null) {
        claimed.push(mapOutbox(row));
      }
    }
    return claimed;
  }

  public async markSent(input: {
    readonly id: string;
    readonly sentAt: Date;
  }): Promise<ProviderEmailOutboxRecord> {
    const row = await this.db.providerEmailOutbox.update({
      where: { id: input.id },
      data: {
        status: "SENT",
        sentAt: input.sentAt,
        nextAttemptAt: null,
        lockedUntil: null,
        lastSafeErrorCode: null,
      },
      select: OUTBOX_SELECT,
    });
    return mapOutbox(row);
  }

  public async markRetryOrFailed(input: {
    readonly id: string;
    readonly attemptCount: number;
    readonly status: Extract<ProviderEmailOutboxStatus, "PENDING" | "FAILED">;
    readonly nextAttemptAt: Date | null;
    readonly lastSafeErrorCode: string;
    readonly lockedUntil: Date | null;
  }): Promise<ProviderEmailOutboxRecord> {
    const row = await this.db.providerEmailOutbox.update({
      where: { id: input.id },
      data: {
        attemptCount: input.attemptCount,
        status: input.status,
        nextAttemptAt: input.nextAttemptAt,
        lastSafeErrorCode: input.lastSafeErrorCode,
        lockedUntil: input.lockedUntil,
      },
      select: OUTBOX_SELECT,
    });
    return mapOutbox(row);
  }
}

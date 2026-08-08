import type { Prisma } from "#generated/prisma/client";

import type {
  PrivacyRequestOutcomeCode,
  PrivacyRequestPurpose,
  PrivacyRequestStatus,
  PrivacyRequestView,
} from "../domain/customers.types.js";

type Transaction = Prisma.TransactionClient;

export interface StoredPrivacyRequest extends PrivacyRequestView {
  readonly userId: string;
  readonly processorId: string | null;
  readonly purgeAfter: Date | null;
}

function map(record: {
  id: string; userId: string; purpose: PrivacyRequestPurpose; status: PrivacyRequestStatus;
  processorId: string | null; outcomeCode: PrivacyRequestOutcomeCode | null;
  requestedAt: Date; updatedAt: Date; cancelledAt: Date | null; processingAt: Date | null;
  terminalAt: Date | null; purgeAfter: Date | null;
}): StoredPrivacyRequest {
  return {
    id: record.id, userId: record.userId, purpose: record.purpose, status: record.status,
    processorId: record.processorId, outcomeCode: record.outcomeCode,
    requestedAt: record.requestedAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    processingAt: record.processingAt?.toISOString() ?? null,
    terminalAt: record.terminalAt?.toISOString() ?? null,
    purgeAfter: record.purgeAfter,
  };
}

/** Customers-owned persistence for the privacy lifecycle; processor IDs intentionally have no FK. */
export class PrismaPrivacyRequestRepository {
  public async find(transaction: Transaction, id: string): Promise<StoredPrivacyRequest | undefined> {
    const record = await transaction.privacyRequest.findUnique({ where: { id } });
    return record === null ? undefined : map(record);
  }

  public async findOwnedVisible(
    transaction: Transaction, id: string, userId: string, now: Date,
  ): Promise<StoredPrivacyRequest | undefined> {
    const record = await transaction.privacyRequest.findFirst({
      where: { id, userId, OR: [{ purgeAfter: null }, { purgeAfter: { gt: now } }] },
    });
    return record === null ? undefined : map(record);
  }

  public async listOwnedVisible(
    transaction: Transaction, userId: string, now: Date,
  ): Promise<PrivacyRequestView[]> {
    const records = await transaction.privacyRequest.findMany({
      where: { userId, OR: [{ purgeAfter: null }, { purgeAfter: { gt: now } }] },
      orderBy: { requestedAt: "asc" },
    });
    return records.map(map);
  }

  public async findActive(
    transaction: Transaction, userId: string, purpose: PrivacyRequestPurpose,
  ): Promise<StoredPrivacyRequest | undefined> {
    const record = await transaction.privacyRequest.findFirst({
      where: { userId, purpose, status: { in: ["PENDING", "PROCESSING"] } },
    });
    return record === null ? undefined : map(record);
  }

  public async createOrFindActive(
    transaction: Transaction, userId: string, purpose: PrivacyRequestPurpose,
  ): Promise<{ readonly request: StoredPrivacyRequest; readonly created: boolean }> {
    const active = await this.findActive(transaction, userId, purpose);
    if (active !== undefined) return { request: active, created: false };
    try {
      const created = await transaction.privacyRequest.create({ data: { userId, purpose, status: "PENDING" } });
      return { request: map(created), created: true };
    } catch (error) {
      // The phase-owned partial unique index is the concurrent writer authority.
      const winner = await this.findActive(transaction, userId, purpose);
      if (winner !== undefined) return { request: winner, created: false };
      throw error;
    }
  }

  public async cancel(
    transaction: Transaction, id: string, userId: string, now: Date, purgeAfter: Date,
  ): Promise<StoredPrivacyRequest | undefined> {
    const result = await transaction.privacyRequest.updateMany({
      where: { id, userId, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: now, terminalAt: now, purgeAfter },
    });
    if (result.count !== 1) return undefined;
    return this.find(transaction, id);
  }

  public async claim(
    transaction: Transaction, id: string, processorId: string, now: Date,
  ): Promise<StoredPrivacyRequest | undefined> {
    const result = await transaction.privacyRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "PROCESSING", processorId, processingAt: now },
    });
    if (result.count !== 1) return undefined;
    return this.find(transaction, id);
  }

  public async resolve(
    transaction: Transaction, id: string, processorId: string,
    status: "COMPLETED" | "REJECTED", outcomeCode: PrivacyRequestOutcomeCode,
    now: Date, purgeAfter: Date,
  ): Promise<StoredPrivacyRequest | undefined> {
    const result = await transaction.privacyRequest.updateMany({
      where: { id, status: "PROCESSING", processorId },
      data: { status, outcomeCode, terminalAt: now, purgeAfter },
    });
    if (result.count !== 1) return undefined;
    return this.find(transaction, id);
  }

  public async reassign(
    transaction: Transaction, id: string, processorId: string, now: Date,
  ): Promise<StoredPrivacyRequest | undefined> {
    const result = await transaction.privacyRequest.updateMany({
      where: { id, status: "PROCESSING" },
      data: { processorId, processingAt: now },
    });
    if (result.count !== 1) return undefined;
    return this.find(transaction, id);
  }

  public async purgeExpiredTerminal(transaction: Transaction, now: Date, limit: number): Promise<number> {
    const ids = await transaction.privacyRequest.findMany({
      where: { purgeAfter: { lte: now }, status: { in: ["COMPLETED", "REJECTED", "CANCELLED"] } },
      select: { id: true }, orderBy: { purgeAfter: "asc" }, take: limit,
    });
    if (ids.length === 0) return 0;
    return (await transaction.privacyRequest.deleteMany({ where: { id: { in: ids.map(({ id }) => id) } } })).count;
  }
}

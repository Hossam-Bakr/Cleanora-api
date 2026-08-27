import type { Prisma, PrismaClient } from "#generated/prisma/client";

import type { SafeHistoryFacts, WorkforceHistoryInput, WorkforceHistoryRepositoryPort, WorkforceHistorySnapshot } from "../domain/provider-workforce.types.js";
import { assertSafeWorkforceFacts } from "../provider-workforce.dto.js";
import { assertSafeWorkforceNote } from "../domain/provider-workforce.policy.js";

type DbClient = Prisma.TransactionClient | PrismaClient;

export class PrismaProviderWorkforceHistoryRepository implements WorkforceHistoryRepositoryPort {
  public constructor(private readonly db: DbClient) {}

  public async append(input: WorkforceHistoryInput): Promise<{ readonly id: string }> {
    assertSafeWorkforceFacts(input.safeBefore);
    assertSafeWorkforceFacts(input.safeAfter);
    if (input.note !== undefined) assertSafeWorkforceNote(input.note);
    return this.db.providerWorkforceHistory.create({
      data: {
        providerId: input.providerId, targetType: input.targetType, targetId: input.targetId,
        targetVersion: input.targetVersion, eventCode: input.eventCode,
        actorUserId: input.actorUserId, reasonCode: input.reasonCode ?? null, note: input.note ?? null,
        ...(input.safeBefore === undefined ? {} : { safeBefore: input.safeBefore as Prisma.InputJsonValue }),
        ...(input.safeAfter === undefined ? {} : { safeAfter: input.safeAfter as Prisma.InputJsonValue }),
        requestId: input.requestId,
      },
      select: { id: true },
    });
  }

  public async list(input: Parameters<WorkforceHistoryRepositoryPort["list"]>[0]): Promise<readonly WorkforceHistorySnapshot[]> {
    const rows = await this.db.providerWorkforceHistory.findMany({
      where: { providerId: input.providerId, targetType: input.targetType, targetId: input.targetId },
      take: input.limit,
      ...(input.cursor === undefined ? {} : { cursor: { id: input.cursor }, skip: 1 }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => this.mapRow(row));
  }

  public async listForWorker(input: Parameters<WorkforceHistoryRepositoryPort["listForWorker"]>[0]): Promise<readonly WorkforceHistorySnapshot[]> {
    const invitationIds = (await this.db.providerWorkerInvitation.findMany({
      where: { workerId: input.workerId },
      select: { id: true },
    })).map(({ id }) => id);
    const membershipIds = (await this.db.providerTeamMembership.findMany({
      where: { workerId: input.workerId },
      select: { id: true },
    })).map(({ id }) => id);
    const rows = await this.db.providerWorkforceHistory.findMany({
      where: {
        providerId: input.providerId,
        OR: [
          { targetType: { in: ["WORKER", "WORKER_PROFILE", "LOGIN_ACCESS"] }, targetId: input.workerId },
          ...(invitationIds.length === 0 ? [] : [{ targetType: "INVITATION" as const, targetId: { in: invitationIds } }]),
          ...(membershipIds.length === 0 ? [] : [{ targetType: "TEAM_MEMBERSHIP" as const, targetId: { in: membershipIds } }]),
        ],
      },
      take: input.limit,
      ...(input.cursor === undefined ? {} : { cursor: { id: input.cursor }, skip: 1 }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: {
    readonly id: string;
    readonly providerId: string;
    readonly targetType: WorkforceHistoryInput["targetType"];
    readonly targetId: string;
    readonly targetVersion: number;
    readonly eventCode: string;
    readonly actorUserId: string;
    readonly reasonCode: string | null;
    readonly note: string | null;
    readonly safeBefore: Prisma.JsonValue | null;
    readonly safeAfter: Prisma.JsonValue | null;
    readonly requestId: string;
    readonly createdAt: Date;
  }): WorkforceHistorySnapshot {
    return {
      id: row.id,
      providerId: row.providerId,
      targetType: row.targetType,
      targetId: row.targetId,
      targetVersion: row.targetVersion,
      eventCode: row.eventCode,
      actorUserId: row.actorUserId,
      ...(row.reasonCode === null ? {} : { reasonCode: row.reasonCode }),
      ...(row.note === null ? {} : { note: row.note }),
      ...(row.safeBefore === null ? {} : { safeBefore: row.safeBefore as SafeHistoryFacts }),
      ...(row.safeAfter === null ? {} : { safeAfter: row.safeAfter as SafeHistoryFacts }),
      requestId: row.requestId,
      createdAt: row.createdAt,
    };
  }
}

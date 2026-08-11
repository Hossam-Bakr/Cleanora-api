import { getPrismaClient } from "#database/prisma";
import type { Prisma, PrismaClient } from "#generated/prisma/client";

import type {
  ProviderReviewRepositoryPort,
  StaffApplicationQueueFilters,
  StaffApplicationQueueItem,
} from "../domain/providers.ports.js";
import type {
  ProviderApplicationStatus,
  ProviderKind,
  ProviderOperationalStatus,
} from "../domain/providers.types.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const QUEUE_SELECT = {
  id: true,
  kind: true,
  applicationStatus: true,
  operationalStatus: true,
  reviewCycle: true,
  version: true,
  lastSubmittedAt: true,
  profile: {
    select: {
      displayNameAr: true,
      displayNameEn: true,
    },
  },
} as const;

function mapQueueItem(
  row: Prisma.ProviderGetPayload<{ select: typeof QUEUE_SELECT }>,
): StaffApplicationQueueItem | null {
  if (row.lastSubmittedAt === null) {
    return null;
  }
  return {
    id: row.id,
    kind: row.kind as ProviderKind,
    applicationStatus: row.applicationStatus as ProviderApplicationStatus,
    operationalStatus: row.operationalStatus as ProviderOperationalStatus,
    reviewCycle: row.reviewCycle,
    version: row.version,
    lastSubmittedAt: row.lastSubmittedAt,
    displayNameAr: row.profile?.displayNameAr ?? null,
    displayNameEn: row.profile?.displayNameEn ?? null,
  };
}

/**
 * Deterministic Staff review queue reads.
 * Order: lastSubmittedAt ASC, id ASC. Default limit 20 / max 100 at service.
 */
export class PrismaProviderReviewRepository
  implements ProviderReviewRepositoryPort
{
  public constructor(private readonly db: DbClient = getPrismaClient()) {}

  public async listQueue(
    filters: StaffApplicationQueueFilters,
  ): Promise<readonly StaffApplicationQueueItem[]> {
    const where: Prisma.ProviderWhereInput = {
      lastSubmittedAt: { not: null },
    };

    if (filters.status !== undefined) {
      where.applicationStatus = filters.status;
    }
    if (filters.providerKind !== undefined) {
      where.kind = filters.providerKind;
    }
    if (
      filters.submittedFrom !== undefined ||
      filters.submittedTo !== undefined
    ) {
      where.lastSubmittedAt = {
        not: null,
        ...(filters.submittedFrom === undefined
          ? {}
          : { gte: filters.submittedFrom }),
        ...(filters.submittedTo === undefined
          ? {}
          : { lte: filters.submittedTo }),
      };
    }

    if (filters.cursor !== undefined) {
      where.OR = [
        { lastSubmittedAt: { gt: filters.cursor.lastSubmittedAt } },
        {
          lastSubmittedAt: filters.cursor.lastSubmittedAt,
          id: { gt: filters.cursor.id },
        },
      ];
    }

    const rows = await this.db.provider.findMany({
      where,
      orderBy: [{ lastSubmittedAt: "asc" }, { id: "asc" }],
      take: filters.limit,
      select: QUEUE_SELECT,
    });

    return rows
      .map(mapQueueItem)
      .filter((item): item is StaffApplicationQueueItem => item !== null);
  }
}

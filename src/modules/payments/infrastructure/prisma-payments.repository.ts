import { Prisma } from "#generated/prisma/client";

import type {
  IdempotencyRow,
  InsertAdjustmentInput,
  InsertJournalInput,
  InsertSnapshotInput,
  LedgerAccountRow,
  LedgerEntryRow,
  PaymentsRepository,
} from "../payments.repository.js";
import { PaymentsIdempotencyCollision } from "../payments.repository.js";
import type { LedgerAccountType } from "../payments.public.js";

type PaymentsClient = Prisma.TransactionClient;
/**
 * @desc Payments-owned Prisma repository.
 * @access Payments infrastructure
 */
export class PrismaPaymentsRepository implements PaymentsRepository {
  public constructor(private readonly client: PaymentsClient) {}

  public async findAccounts(
    countryId: string,
    currencyCode: string,
  ): Promise<readonly LedgerAccountRow[]> {
    const rows = await this.client.ledgerAccount.findMany({
      where: { countryId, currencyCode },
    });
    return rows.map((row) => ({
      id: row.id,
      countryId: row.countryId,
      currencyCode: row.currencyCode,
      currencyDecimalPlaces: row.currencyDecimalPlaces,
      accountType: row.accountType,
    }));
  }

  public async findIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: IdempotencyRow extends never ? never : string;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<IdempotencyRow | null> {
    const row = await this.client.financialIdempotencyKey.findUnique({
      where: {
        commandType_actorKind_actorId_idempotencyKey: {
          commandType: input.commandType,
          actorKind: input.actorKind as never,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      payloadHash: row.payloadHash,
      journalId: row.journalId,
      snapshotId: row.snapshotId,
      adjustmentId: row.adjustmentId,
    };
  }

  public async insertIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly journalId?: string;
    readonly snapshotId?: string;
    readonly adjustmentId?: string;
  }): Promise<void> {
    try {
      await this.client.financialIdempotencyKey.create({
        data: {
          commandType: input.commandType,
          actorKind: input.actorKind as never,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          journalId: input.journalId ?? null,
          snapshotId: input.snapshotId ?? null,
          adjustmentId: input.adjustmentId ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new PaymentsIdempotencyCollision();
      }
      throw error;
    }
  }

  public async insertJournal(input: InsertJournalInput): Promise<void> {
    await this.client.ledgerEntry.createMany({
      data: input.lines.map((line) => ({
        id: line.id,
        journalId: input.journalId,
        accountId: line.accountId,
        entryType: line.entryType,
        side: line.side,
        amountMinorUnits: new Prisma.Decimal(line.amountMinorUnits),
        currencyCode: line.currencyCode,
        currencyDecimalPlaces: line.currencyDecimalPlaces,
      })),
    });
    if (input.bookingId !== undefined) {
      await this.client.ledgerEntryLink.create({
        data: {
          journalId: input.journalId,
          kind: "BOOKING",
          bookingId: input.bookingId,
        },
      });
    }
  }

  public async findJournalEntries(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.listEntriesByJournal(journalId);
  }

  public async listEntriesByAccount(
    accountId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    const rows = await this.client.ledgerEntry.findMany({
      where: { accountId },
      include: { account: true, links: true },
      orderBy: { createdAt: "asc" },
    });
    const bookingByJournal = await this.bookingIdsByJournal(
      rows.map((row) => row.journalId),
    );
    return rows.map((row) =>
      mapEntry(row, bookingByJournal.get(row.journalId) ?? undefined),
    );
  }

  public async listEntriesByBooking(
    bookingId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    const links = await this.client.ledgerEntryLink.findMany({
      where: { bookingId, kind: "BOOKING" },
    });
    const journalIds = [...new Set(links.map((link) => link.journalId))];
    if (journalIds.length === 0) {
      return [];
    }
    const rows = await this.client.ledgerEntry.findMany({
      where: { journalId: { in: journalIds } },
      include: { account: true, links: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => mapEntry(row, bookingId));
  }

  public async listEntriesByJournal(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    const rows = await this.client.ledgerEntry.findMany({
      where: { journalId },
      include: { account: true, links: true },
      orderBy: { createdAt: "asc" },
    });
    const bookingByJournal = await this.bookingIdsByJournal([journalId]);
    return rows.map((row) =>
      mapEntry(row, bookingByJournal.get(journalId) ?? undefined),
    );
  }

  private async bookingIdsByJournal(
    journalIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const unique = [...new Set(journalIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const links = await this.client.ledgerEntryLink.findMany({
      where: { journalId: { in: unique }, kind: "BOOKING" },
    });
    const result = new Map<string, string>();
    for (const link of links) {
      if (link.bookingId !== null && !result.has(link.journalId)) {
        result.set(link.journalId, link.bookingId);
      }
    }
    return result;
  }

  public async insertAdjustment(input: InsertAdjustmentInput): Promise<void> {
    await this.client.financialAdjustment.create({
      data: {
        id: input.id,
        actorKind: input.actorKind,
        actorId: input.actorId,
        reason: input.reason,
        originalJournalId: input.originalJournalId,
        reversingJournalId: input.reversingJournalId,
      },
    });
  }

  public async insertSnapshot(input: InsertSnapshotInput): Promise<void> {
    await this.client.financialSnapshot.create({
      data: {
        id: input.id,
        subjectKind: input.subjectKind,
        accountId: input.accountId ?? null,
        bookingId: input.bookingId ?? null,
        currencyCode: input.currencyCode,
        currencyDecimalPlaces: input.currencyDecimalPlaces,
        debitMinorUnits: new Prisma.Decimal(input.debitMinorUnits),
        creditNetMinorUnits: new Prisma.Decimal(input.creditNetMinorUnits),
        derivedBalanceMinorUnits: new Prisma.Decimal(input.derivedBalanceMinorUnits),
        entryIdHash: input.entryIdHash,
      },
    });
  }
}

function mapEntry(
  row: {
    readonly id: string;
    readonly journalId: string;
    readonly accountId: string;
    readonly entryType: LedgerEntryRow["entryType"];
    readonly side: LedgerEntryRow["side"];
    readonly amountMinorUnits: Prisma.Decimal;
    readonly currencyCode: string;
    readonly account: { readonly countryId: string; readonly accountType: LedgerAccountType };
    readonly links: readonly { readonly bookingId: string | null }[];
  },
  bookingId?: string,
): LedgerEntryRow {
  return {
    id: row.id,
    journalId: row.journalId,
    accountId: row.accountId,
    countryId: row.account.countryId,
    accountType: row.account.accountType,
    entryType: row.entryType,
    side: row.side,
    amountMinorUnits: row.amountMinorUnits.toFixed(0),
    currencyCode: row.currencyCode,
    bookingId:
      bookingId ??
      row.links.find((link) => link.bookingId !== null)?.bookingId ??
      null,
  };
}

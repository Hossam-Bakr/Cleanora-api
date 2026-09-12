import type {
  IdempotencyRow,
  InsertAdjustmentInput,
  InsertJournalInput,
  InsertSnapshotInput,
  LedgerAccountRow,
  LedgerEntryRow,
  PaymentsRepository,
  PaymentsUnitOfWork,
} from "#modules/payments/payments.repository";
import { PaymentsIdempotencyCollision } from "#modules/payments/payments.repository";
import type { LedgerAccountType } from "#modules/payments/payments.public";

const ACCOUNT_TYPES: readonly LedgerAccountType[] = [
  "PLATFORM_CLEARING",
  "PLATFORM_REVENUE",
  "PROVIDER_PAYABLE",
  "CUSTOMER_DEPOSIT_LIABILITY",
  "COD_CLEARING",
  "PAYOUT_CLEARING",
  "REFUND_CLEARING",
  "ADJUSTMENT_CLEARING",
];

/**
 * @desc In-memory payments persistence for unit tests.
 * @access Test helper
 */
export class InMemoryPaymentsRepository implements PaymentsRepository {
  public readonly accounts: LedgerAccountRow[] = [];
  public readonly entries: LedgerEntryRow[] = [];
  public readonly idempotency = new Map<string, IdempotencyRow>();
  public readonly adjustments: InsertAdjustmentInput[] = [];
  public readonly snapshots: InsertSnapshotInput[] = [];

  public seedEgypt(countryId = "country-eg"): void {
    for (const accountType of ACCOUNT_TYPES) {
      this.accounts.push({
        id: `acc-${accountType}`,
        countryId,
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        accountType,
      });
    }
  }

  public async findAccounts(
    countryId: string,
    currencyCode: string,
  ): Promise<readonly LedgerAccountRow[]> {
    return this.accounts.filter(
      (account) =>
        account.countryId === countryId && account.currencyCode === currencyCode,
    );
  }

  public async findIdempotency(input: {
    readonly commandType: string;
    readonly actorKind: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<IdempotencyRow | null> {
    return this.idempotency.get(idempotencyKey(input)) ?? null;
  }

  public async insertIdempotency(input: {
    readonly commandType: string;
    readonly actorKind: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly journalId?: string;
    readonly snapshotId?: string;
    readonly adjustmentId?: string;
  }): Promise<void> {
    const key = idempotencyKey(input);
    if (this.idempotency.has(key)) {
      throw new PaymentsIdempotencyCollision();
    }
    this.idempotency.set(key, {
      payloadHash: input.payloadHash,
      journalId: input.journalId ?? null,
      snapshotId: input.snapshotId ?? null,
      adjustmentId: input.adjustmentId ?? null,
    });
  }

  public async insertJournal(input: InsertJournalInput): Promise<void> {
    for (const line of input.lines) {
      const account = this.accounts.find((row) => row.id === line.accountId);
      this.entries.push({
        id: line.id,
        journalId: input.journalId,
        accountId: line.accountId,
        countryId: account?.countryId ?? "",
        accountType: account?.accountType ?? "PLATFORM_CLEARING",
        entryType: line.entryType,
        side: line.side,
        amountMinorUnits: line.amountMinorUnits,
        currencyCode: line.currencyCode,
        bookingId: input.bookingId ?? null,
      });
    }
  }

  public async findJournalEntries(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.entries.filter((entry) => entry.journalId === journalId);
  }

  public async listEntriesByAccount(
    accountId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.entries.filter((entry) => entry.accountId === accountId);
  }

  public async listEntriesByBooking(
    bookingId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.entries.filter((entry) => entry.bookingId === bookingId);
  }

  public async listEntriesByJournal(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.findJournalEntries(journalId);
  }

  public async insertAdjustment(input: InsertAdjustmentInput): Promise<void> {
    this.adjustments.push(input);
  }

  public async insertSnapshot(input: InsertSnapshotInput): Promise<void> {
    this.snapshots.push(input);
  }
}

export function createInMemoryPaymentsUnitOfWork(
  repository = new InMemoryPaymentsRepository(),
): { readonly unitOfWork: PaymentsUnitOfWork; readonly repository: InMemoryPaymentsRepository } {
  return {
    repository,
    unitOfWork: {
      run: async (work) => work(repository),
    },
  };
}

function idempotencyKey(input: {
  readonly commandType: string;
  readonly actorKind: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
}): string {
  return `${input.commandType}:${input.actorKind}:${input.actorId}:${input.idempotencyKey}`;
}

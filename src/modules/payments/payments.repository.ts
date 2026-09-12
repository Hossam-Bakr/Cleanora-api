import type {
  LedgerAccountType,
  LedgerActorKind,
  LedgerEntrySide,
  LedgerEntryType,
  LedgerLinkKind,
} from "./payments.public.js";

export interface LedgerAccountRow {
  readonly id: string;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly accountType: LedgerAccountType;
}

export interface LedgerEntryRow {
  readonly id: string;
  readonly journalId: string;
  readonly accountId: string;
  readonly countryId: string;
  readonly accountType: LedgerAccountType;
  readonly entryType: LedgerEntryType;
  readonly side: LedgerEntrySide;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly bookingId: string | null;
}

export interface IdempotencyRow {
  readonly payloadHash: string;
  readonly journalId: string | null;
  readonly snapshotId: string | null;
  readonly adjustmentId: string | null;
}

export interface InsertJournalInput {
  readonly journalId: string;
  readonly lines: readonly {
    readonly id: string;
    readonly accountId: string;
    readonly entryType: LedgerEntryType;
    readonly side: LedgerEntrySide;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
  }[];
  readonly bookingId?: string;
}

export interface InsertAdjustmentInput {
  readonly id: string;
  readonly actorKind: LedgerActorKind;
  readonly actorId: string;
  readonly reason: string;
  readonly originalJournalId: string;
  readonly reversingJournalId: string;
}

export interface InsertSnapshotInput {
  readonly id: string;
  readonly subjectKind: "ACCOUNT" | "BOOKING";
  readonly accountId?: string;
  readonly bookingId?: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly debitMinorUnits: string;
  readonly creditNetMinorUnits: string;
  readonly derivedBalanceMinorUnits: string;
  readonly entryIdHash: string;
}

export interface PaymentsRepository {
  findAccounts(
    countryId: string,
    currencyCode: string,
  ): Promise<readonly LedgerAccountRow[]>;
  findIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: LedgerActorKind;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<IdempotencyRow | null>;
  insertIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: LedgerActorKind;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly journalId?: string;
    readonly snapshotId?: string;
    readonly adjustmentId?: string;
  }): Promise<void>;
  insertJournal(input: InsertJournalInput): Promise<void>;
  findJournalEntries(journalId: string): Promise<readonly LedgerEntryRow[]>;
  listEntriesByAccount(accountId: string): Promise<readonly LedgerEntryRow[]>;
  listEntriesByBooking(bookingId: string): Promise<readonly LedgerEntryRow[]>;
  listEntriesByJournal(journalId: string): Promise<readonly LedgerEntryRow[]>;
  insertAdjustment(input: InsertAdjustmentInput): Promise<void>;
  insertSnapshot(input: InsertSnapshotInput): Promise<void>;
}

export interface PaymentsUnitOfWork {
  run<T>(work: (repository: PaymentsRepository) => Promise<T>): Promise<T>;
}

/** Thrown when the idempotency unique key is already reserved in another write. */
export class PaymentsIdempotencyCollision extends Error {
  public constructor() {
    super("Payments idempotency key already reserved");
    this.name = "PaymentsIdempotencyCollision";
  }
}

export type { LedgerLinkKind };

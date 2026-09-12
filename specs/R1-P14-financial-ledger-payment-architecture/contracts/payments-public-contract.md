# Payments Public Contract (P14)

**Module entry**: `src/modules/payments/payments.public.ts`
**Transport**: in-process only. No HTTP adapters in P14.
**Authority**: spec Clarifications; DEC-003; DEC-093 pending PM acceptance.

## Trusted invocation

Composition constructs the payments application service with:

- Payments-owned unit of work
- Bookings `BookingFinancialSnapshotReader` (opaque; no Prisma leak)

Callers supply `actorKind`, `actorId`, and `idempotencyKey` on mutating
commands. Mutating commands claim the idempotency row before journal/snapshot
writes so concurrent collisions replay or conflict without orphan lines.
Role strings on the caller object are not authorization to create wallets.

## Closed types

```ts
export type LedgerAccountType =
  | "PLATFORM_CLEARING"
  | "PLATFORM_REVENUE"
  | "PROVIDER_PAYABLE"
  | "CUSTOMER_DEPOSIT_LIABILITY"
  | "COD_CLEARING"
  | "PAYOUT_CLEARING"
  | "REFUND_CLEARING"
  | "ADJUSTMENT_CLEARING";

export type LedgerEntryType =
  | "DEPOSIT"
  | "PLATFORM_FEE"
  | "PROVIDER_SHARE"
  | "MARKETER_COMMISSION"
  | "COD_REMAINING"
  | "PAYOUT"
  | "REFUND"
  | "ADJUSTMENT";

export type LedgerEntrySide = "DEBIT" | "CREDIT";
export type LedgerLinkKind = "BOOKING" | "ORDER";
export type LedgerActorKind = "SYSTEM" | "TEST" | "STAFF_FINANCE";

export interface JournalLineInput {
  readonly accountType: LedgerAccountType;
  readonly entryType: LedgerEntryType;
  readonly side: LedgerEntrySide;
  readonly amountMinorUnits: string;
}

export interface PostJournalInput {
  readonly actorKind: LedgerActorKind;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly lines: readonly JournalLineInput[];
  readonly bookingId?: string;
}

export interface PostAdjustmentInput {
  readonly actorKind: "STAFF_FINANCE";
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly originalJournalId: string;
  readonly lines: readonly JournalLineInput[];
}

export interface CreateSnapshotInput {
  readonly actorKind: LedgerActorKind;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly bookingId?: string;
  readonly accountType?: LedgerAccountType;
  readonly countryId: string;
  readonly currencyCode: string;
}

export interface DerivedBalance {
  readonly accountType: LedgerAccountType;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly debitMinorUnits: string;
  readonly creditMinorUnits: string;
  readonly balanceMinorUnits: string;
}

export type ReconcileStatus = "BALANCED" | "MISSING" | "MISMATCHED" | "NOT_READY";

export interface BookingReconcileResult {
  readonly bookingId: string;
  readonly status: ReconcileStatus;
  readonly requiredDepositMinorUnits: string | null;
  readonly postedDepositMinorUnits: string;
  readonly bookingStatus: string;
}

export interface LedgerEntryView {
  readonly journalId: string;
  readonly entryId: string;
  readonly accountType: LedgerAccountType;
  readonly entryType: LedgerEntryType;
  readonly side: LedgerEntrySide;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly bookingId: string | null;
}

export interface PaymentsApplicationService {
  postJournal(input: PostJournalInput): Promise<{ readonly journalId: string }>;
  postAdjustment(input: PostAdjustmentInput): Promise<{ readonly adjustmentId: string; readonly journalId: string }>;
  createSnapshot(input: CreateSnapshotInput): Promise<{ readonly snapshotId: string }>;
  getDerivedBalance(input: {
    readonly countryId: string;
    readonly currencyCode: string;
    readonly accountType: LedgerAccountType;
  }): Promise<DerivedBalance>;
  listEntries(input: {
    readonly journalId?: string;
    readonly bookingId?: string;
  }): Promise<readonly LedgerEntryView[]>;
  reconcileBooking(input: { readonly bookingId: string }): Promise<BookingReconcileResult>;
  /** Always rejects. Stored-value user accounts are prohibited (DEC-003). */
  createAccount(input: unknown): Promise<never>;
}

export const PAYMENTS_PUBLIC_CONTRACT = {
  contractVersion: "payments.public.v1",
  module: "payments",
} as const;
```

## Bookings reader (new public seam)

```ts
export interface BookingFinancialSnapshot {
  readonly bookingId: string;
  readonly status: "DRAFT" | "AWAITING_DEPOSIT" | "CONFIRMED" | "CANCELLED";
  readonly countryId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly providerId: string;
  readonly grossMinorUnits: string | null;
  readonly depositMinorUnits: string | null;
  readonly remainderMinorUnits: string | null;
}

export interface BookingFinancialSnapshotReader {
  readById(input: { readonly bookingId: string }): Promise<BookingFinancialSnapshot | null>;
}
```

## Error codes

`VALIDATION_FAILED` · `JOURNAL_UNBALANCED` · `CURRENCY_MISMATCH` ·
`ACCOUNT_NOT_SEEDED` · `ENTRY_TYPE_NOT_POSTABLE` · `LINK_KIND_NOT_AVAILABLE` ·
`IDEMPOTENCY_CONFLICT` · `DEPENDENCY_FAILURE` · `ADJUSTMENT_REASON_REQUIRED` ·
`WALLET_PROHIBITED` · `SNAPSHOT_HASH_MISMATCH`

## Forbidden

- HTTP controllers or routers under payments
- Import of bookings/configuration Prisma from payments
- Import of payments Prisma from bookings
- Wallet / top-up / transfer methods

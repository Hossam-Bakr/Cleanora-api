# Data Model — R1-P14 Financial Ledger

Prisma models are added only by this phase in `prisma/schema.prisma`.
Booking ids on links are logical references (application Restrict; no cascade
delete of money history; no live FK that rewrites financial rows when a
booking changes).

## Enums

```text
LedgerAccountType:
  PLATFORM_CLEARING
  | PLATFORM_REVENUE
  | PROVIDER_PAYABLE
  | CUSTOMER_DEPOSIT_LIABILITY
  | COD_CLEARING
  | PAYOUT_CLEARING
  | REFUND_CLEARING
  | ADJUSTMENT_CLEARING

LedgerEntryType:
  DEPOSIT
  | PLATFORM_FEE
  | PROVIDER_SHARE
  | MARKETER_COMMISSION
  | COD_REMAINING
  | PAYOUT
  | REFUND
  | ADJUSTMENT

LedgerEntrySide: DEBIT | CREDIT

LedgerLinkKind: BOOKING | ORDER

LedgerCommandType: POST_JOURNAL | POST_ADJUSTMENT | CREATE_SNAPSHOT

LedgerActorKind: SYSTEM | TEST | STAFF_FINANCE
```

## Tables

### ledger_accounts

- id (cuid)
- countryId (FK Country)
- currencyCode
- currencyDecimalPlaces
- accountType (LedgerAccountType)
- createdAt
- unique (countryId, currencyCode, accountType)
- index (countryId, accountType)

System classification only. No userId, providerId, or spendable balance
column.

### ledger_entries

- id (cuid)
- journalId (cuid, shared by lines in one post)
- accountId (FK ledger_accounts)
- entryType (LedgerEntryType)
- side (DEBIT | CREDIT)
- amountMinorUnits Decimal(65,0) — unsigned magnitude; side carries sign
- currencyCode
- currencyDecimalPlaces
- createdAt only (immutable)
- indexes: (journalId), (accountId, createdAt), (entryType, createdAt)

### ledger_entry_links

- id (cuid)
- journalId
- entryId nullable (journal-level link when null)
- kind (LedgerLinkKind)
- bookingId nullable logical
- createdAt only (immutable)
- check: kind BOOKING ⇒ bookingId present; kind ORDER ⇒ rejected in
  application (column reserved, unused)
- unique (journalId, kind, bookingId) where kind = BOOKING
- index (bookingId)

### financial_idempotency_keys

- id (cuid)
- commandType (LedgerCommandType)
- actorKind (LedgerActorKind)
- actorId (string; system/test/staff subject)
- idempotencyKey
- payloadHash
- journalId nullable
- snapshotId nullable
- adjustmentId nullable
- createdAt
- unique (commandType, actorKind, actorId, idempotencyKey)

### financial_snapshots

- id (cuid)
- subjectKind: ACCOUNT | BOOKING
- accountId nullable
- bookingId nullable logical
- currencyCode
- currencyDecimalPlaces
- debitMinorUnits, creditNetMinorUnits, derivedBalanceMinorUnits Decimal(65,0)
- entryIdHash
- createdAt only (immutable)
- check: exactly one of accountId / bookingId

### financial_adjustments

- id (cuid)
- actorKind, actorId
- reason (bounded text, required)
- originalJournalId
- reversingJournalId
- createdAt
- index (originalJournalId)

## Immutability

SQL triggers (same spirit as P13 snapshots) reject UPDATE/DELETE on
`ledger_entries`, `ledger_entry_links`, and `financial_snapshots`.

## Seed

For Egypt and its configured currency, insert one row per LedgerAccountType.
Seed is idempotent on the unique (country, currency, type) key.

## Prohibited

- user_wallets, stored balances, top-up tables
- payment_methods / payments / payment_attempts (P15)
- provider_dues / settlements / payouts (P21)
- orders FK (P18)

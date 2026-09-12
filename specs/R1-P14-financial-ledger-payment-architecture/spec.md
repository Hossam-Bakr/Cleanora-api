# Feature Specification: R1-P14 — Financial Ledger & Payment Architecture

**Feature Branch**: `codex/r1-p14-financial-ledger-payment-architecture`
**Created**: 2026-09-11
**Status**: Active — prepared for Codex PM acceptance; not Complete
**Input**: Roadmap §R1-P14; `/work-on-next-phase` activation DEC-093; vision §7;
DEC-003, DEC-006, DEC-007; OQ-001, OQ-008, OQ-009; architecture entity
ownership for `payments`.

## Clarifications

### Session 2026-09-11 (MVB — proposed for Codex PM acceptance)

These holdings are derived from canonical vision/roadmap/architecture and do
**not** invent payment capture, wallets, or fee rules. Codex PM must accept
or name exceptions before implementation.

- Q: Which module owns the ledger? → A: New `payments` module. It owns all six
  roadmap tables and the public in-process contract. No other module may
  import payments Prisma, repositories, or internal schemas. Bookings remains
  the commercial booking owner and does not post money in this phase.
- Q: HTTP surface? → A: **Zero** new HTTP operations (same pattern as P11).
  Roadmap lists no customer, provider, or staff finance endpoints. Existing
  OpenAPI and Postman artifacts must still validate. Do not invent Staff
  finance HTTP (later admin/finance phases consume the public contract).
- Q: What is the commercial subject before orders exist? → A: A **booking** is
  the commercial source of truth. `ledger_entry_links` support `BOOKING` now
  and may reference an existing booking id without a live FK that would rewrite
  history. `ORDER` is a reserved link kind with no table and no posting until
  P18. This satisfies roadmap “order-level financial entries” without creating
  the `orders` table.
- Q: Account model vs wallets? → A: `ledger_accounts` are **system** accounts
  only, unique per country + currency + closed system type. They classify
  money movement. They are not customer, provider, or marketer wallets.
  Derived totals come from summing signed entries, optionally filtered by a
  link target. No reusable stored balance, top-up, or transfer exists
  (DEC-003).
- Q: Closed system account types? → A:
  `PLATFORM_CLEARING`, `PLATFORM_REVENUE`, `PROVIDER_PAYABLE`,
  `CUSTOMER_DEPOSIT_LIABILITY`, `COD_CLEARING`, `PAYOUT_CLEARING`,
  `REFUND_CLEARING`, `ADJUSTMENT_CLEARING`. Seeded for Egypt and its
  configured currency. No other account types in this phase.
- Q: Entry types (vision §7.4)? → A: Closed catalog
  `DEPOSIT`, `PLATFORM_FEE`, `PROVIDER_SHARE`, `MARKETER_COMMISSION`,
  `COD_REMAINING`, `PAYOUT`, `REFUND`, `ADJUSTMENT`. Types are seedable now.
  Posting `MARKETER_COMMISSION` is rejected until Release 2 (DEC-007). Other
  types may be posted through the public contract for tests and later phases.
- Q: Journal shape? → A: Double-entry. A post is one journal of two or more
  lines. Sum of debit minor units equals sum of credit minor units in one
  currency. Lines are `ledger_entries`. Links attach the journal or a line to
  a booking (and later an order). Unbalanced journals fail closed with no
  write.
- Q: Immutability? → A: Entries, links, and snapshots have `created_at` only.
  SQL rejects UPDATE/DELETE of those rows. Corrections use
  `financial_adjustments` that post new compensating `ADJUSTMENT` lines.
  Original rows stay.
- Q: Money representation? → A: Decimal-safe minor-unit digit strings persisted
  as `DECIMAL(65,0)`, plus `currencyCode` and `decimalPlaces` from
  Configuration. Payments owns its own money helpers. It must not import
  `bookings.money`. No JavaScript `number` arithmetic for money.
- Q: Idempotency? → A: `financial_idempotency_keys` on post, adjust, and
  snapshot commands. Same caller scope + key + payload returns the original
  result. Same key with a different payload is a conflict. No HTTP header is
  required because there is no HTTP.
- Q: Snapshots? → A: `financial_snapshots` persist derived totals for a booking
  (or a system account) at a moment, including the hash of included entry ids.
  Recompute must match or the snapshot command fails closed. Snapshots are
  immutable.
- Q: Reconciliation interfaces? → A: In-process public methods:
  `postJournal`, `postAdjustment`, `createSnapshot`, `getDerivedBalance`,
  `listEntries`, `reconcileBooking`. `reconcileBooking` compares required
  booking quote amounts (read through a Bookings public snapshot reader) with
  posted entry totals and reports balanced / missing / mismatched. It does
  not collect money and does not change booking status.
- Q: Who may call the contract in this phase? → A: Composition-wired trusted
  callers with a typed actor (`SYSTEM`, `TEST`, or `STAFF_FINANCE`) plus
  reason on adjustments. Bookings command paths do **not** post journals in
  P14. Fixture/tests prove the API. P15+ will call the same contract.
- Q: Booking reader? → A: Payments reads a new Bookings public
  `BookingFinancialSnapshotReader` that returns booking id, status, currency,
  gross/deposit/remainder minor units, provider id, and country. Payments
  must not import bookings repositories or Prisma booking models.
- Q: Cancellation fees / coupons / InstaPay? → A: Do not calculate fees
  (OQ-001). Do not add coupon lines (OQ-008). Do not invent InstaPay or any
  gateway session (OQ-009 / P15).
- Q: Coverage? → A: Phase-owned executable files 80/75/80/80 (statements /
  branches / functions / lines). Include unimported P14 files.

Named exceptions to propose:

- **EX-01**: Zero new HTTP. Reconciliation and posting are in-process only.
- **EX-02**: No payment capture, webhook, receipt, or `CONFIRMED` transition.
  Deposit remains a booking requirement, not a collected amount, until P15.
- **EX-03**: `ORDER` link kind is reserved and unused; `MARKETER_COMMISSION`
  posting is rejected; no per-user accounts exist.

## Definition of Done (explicit)

1. The `payments` module exists with an explicit public contract and owns the
   six roadmap tables.
2. System accounts are seeded; append-only balanced journals persist with
   decimal-safe minor units.
3. Derived balances and booking reconciliation come from entries, not from a
   stored user wallet.
4. Corrections create new adjustment entries; original rows cannot be
   rewritten.
5. Idempotency and unbalanced/unknown-type/wallet-shaped requests fail closed.
6. Existing OpenAPI and Postman artifacts still validate; no invented payment
   HTTP.
7. Phase-owned migration `r1_p14_financial_ledger_payment_architecture` is
   reviewed and proven on an authorized disposable target when available.
8. No unresolved BLOCKER/MAJOR review findings. Phase is not marked Complete
   and nothing is committed/pushed by this workflow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Post a balanced deposit journal (Priority: P1)

A trusted caller posts a deposit-shaped journal for an existing awaiting-deposit
booking. The ledger records immutable debit/credit lines and a booking link.

**Why this priority**: Roadmap append-only ledger + deposit entry type.
**Independent Test**: In-process `postJournal` against fixtures; assert two
lines, balanced totals, booking link, and no HTTP.
**Acceptance Scenarios**:

1. **Given** an awaiting-deposit booking snapshot and a balanced DEPOSIT
   journal in that booking's currency, **When** `postJournal` runs with a new
   idempotency key, **Then** two or more `ledger_entries` exist, debits equal
   credits, and a `BOOKING` link points at that booking id.
2. **Given** an unbalanced journal, **When** post is attempted, **Then** the
   command fails closed and no entry, link, or idempotency row is committed.
3. **Given** the same caller scope, key, and payload, **When** post is retried,
   **Then** the original journal is returned and no second commercial journal
   is written.

### User Story 2 — Derived totals and reconciliation (Priority: P1)

Finance control can read a derived account balance and reconcile a booking's
required deposit/gross against posted entries.

**Why this priority**: Roadmap balance-from-entries + reconciliation interfaces.
**Independent Test**: Post known lines; `getDerivedBalance` equals the signed
sum; `reconcileBooking` reports balanced or mismatched without changing
booking status.
**Acceptance Scenarios**:

1. **Given** posted lines on `CUSTOMER_DEPOSIT_LIABILITY` for Egypt/EGP,
   **When** `getDerivedBalance` is called for that system account, **Then** the
   returned minor-unit string equals the signed sum of those entries.
2. **Given** a booking whose posted DEPOSIT total matches the booking deposit
   requirement, **When** `reconcileBooking` runs, **Then** the result is
   balanced and booking status is unchanged.
3. **Given** a booking with no posted deposit, **When** `reconcileBooking`
   runs, **Then** the result is missing/unbalanced and no wallet row exists.

### User Story 3 — Immutable correction through adjustment (Priority: P1)

A staff-finance actor corrects a posted journal by creating an adjustment that
posts compensating lines. The original entries stay.

**Why this priority**: Vision §7.4 and master ERD: never hard-delete money.
**Independent Test**: Post, adjust, assert original bytes unchanged and new
ADJUSTMENT lines exist.
**Acceptance Scenarios**:

1. **Given** a posted journal, **When** `postAdjustment` runs with actor
   `STAFF_FINANCE`, a reason, and a balanced compensating journal, **Then** a
   `financial_adjustments` row exists and new `ADJUSTMENT` entries reverse the
   intended amounts.
2. **Given** those original entry ids, **When** an UPDATE or DELETE is
   attempted at SQL level in tests, **Then** the database rejects the rewrite.
3. **Given** an adjustment without a reason or with actor `TEST` forging a
   customer wallet credit, **When** post is attempted, **Then** it fails closed.

### User Story 4 — Snapshots and later entry types stay typed (Priority: P2)

A snapshot freezes derived totals. Provider-share, COD remaining, payout, and
refund types exist for later phases. Marketer posting and order links do not
execute.

**Why this priority**: Roadmap entry-type catalog + snapshots; DEC-007 / P18.
**Independent Test**: Snapshot hash matches included ids; rejected types/kinds
return stable errors.
**Acceptance Scenarios**:

1. **Given** posted entries for a booking, **When** `createSnapshot` runs,
   **Then** an immutable `financial_snapshots` row stores derived totals and
   the entry-id hash; a later extra post does not change that snapshot.
2. **Given** a `MARKETER_COMMISSION` journal or an `ORDER` link, **When** post
   is attempted, **Then** the command is rejected and no row is written.
3. **Given** a PROVIDER_SHARE, COD_REMAINING, PAYOUT, or REFUND balanced
   journal in tests, **When** posted, **Then** it persists with the declared
   type and still creates no payout destination, gateway, or wallet.

### User Story 5 — Wallet-shaped requests are impossible (Priority: P1)

No API or table can hold a reusable customer, provider, or marketer balance.

**Why this priority**: DEC-003 and roadmap Done-When.
**Independent Test**: Public contract has no wallet method; schema has no
user-balance table; attempts to create a non-system account fail.
**Acceptance Scenarios**:

1. **Given** the public contract, **When** inspected, **Then** there is no
   top-up, transfer, or withdraw method.
2. **Given** a request to create an account for a user id, **When** the
   account API is invoked, **Then** it is rejected.
3. **Given** derived balances, **When** they are read twice after the same
   entries, **Then** both reads equal the sum of entries and no cached
   spendable wallet field exists.

## Edge Cases

- Unknown currency or country without seeded system accounts → fail closed.
- Journal mixing two currencies → fail closed.
- Duplicate idempotency key with different payload → conflict, no write.
- Booking snapshot reader hard-failure → typed dependency error, no partial
  journal.
- Reconcile of a DRAFT booking that has no frozen deposit → stable
  not-ready result, not a fake zero deposit.
- Concurrent posts with different keys → both persist if each is balanced;
  uniqueness is per idempotency key, not per booking, so P15 can add
  “one successful deposit journal” rules later.
- Negative or non-digit minor units → validation failure.
- Adjustment that does not balance → fail closed like any journal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST introduce a `payments` module that owns
  `ledger_accounts`, `ledger_entries`, `ledger_entry_links`,
  `financial_idempotency_keys`, `financial_snapshots`, and
  `financial_adjustments`.
- **FR-002**: System MUST expose those behaviors only through
  `payments.public.ts` (or the approved composition-named equivalent). Other
  modules MUST NOT import payments persistence.
- **FR-003**: System MUST persist only system ledger accounts, unique per
  country, currency, and closed system type, and MUST reject any
  user/provider/marketer stored-value account.
- **FR-004**: System MUST persist journals as append-only debit/credit lines
  whose debit sum equals credit sum in one currency using decimal-safe
  minor-unit arithmetic.
- **FR-005**: System MUST support closed entry types DEPOSIT, PLATFORM_FEE,
  PROVIDER_SHARE, MARKETER_COMMISSION, COD_REMAINING, PAYOUT, REFUND, and
  ADJUSTMENT, and MUST reject MARKETER_COMMISSION posting in this phase.
- **FR-006**: System MUST link journals to bookings via `BOOKING` links and
  MUST reject `ORDER` links until the orders table exists.
- **FR-007**: System MUST make post, adjust, and snapshot commands idempotent
  through `financial_idempotency_keys`.
- **FR-008**: System MUST correct money only by new adjustment journals; SQL
  MUST reject rewrite or delete of entries, links, and snapshots.
- **FR-009**: System MUST derive account and booking totals from entries and
  MUST persist optional immutable `financial_snapshots` whose hash matches the
  included entries.
- **FR-010**: System MUST provide in-process `reconcileBooking` that compares
  booking financial snapshot amounts with posted totals and MUST NOT change
  booking status or collect payment.
- **FR-011**: Payments MUST read booking financial facts only through a
  Bookings public reader and currency/country facts only through Configuration
  public contracts.
- **FR-012**: System MUST NOT add payment, ledger, wallet, or finance HTTP in
  this phase, and MUST keep existing OpenAPI and Postman validation green.
- **FR-013**: System MUST NOT implement stored-value wallets, top-up, transfer,
  gateway sessions, webhooks, receipts, InstaPay, coupons, or cancellation
  fees.
- **FR-014**: System MUST create phase-owned migration
  `r1_p14_financial_ledger_payment_architecture` and MUST NOT edit applied
  migrations.
- **FR-015**: Adjustments MUST record actor, reason, and timestamp; unreasoned
  privileged corrections MUST fail closed.

### Key Entities

- **LedgerAccount**: country + currency + closed system type; classification
  only; not a user wallet.
- **LedgerEntry**: one debit or credit line in a journal; entry type; minor
  units; immutable.
- **LedgerEntryLink**: associates a journal or line with a booking (later
  order); no live rewrite FK.
- **FinancialIdempotencyKey**: caller scope + key + payload hash + result
  reference.
- **FinancialSnapshot**: immutable derived totals + entry-id hash for a
  booking or system account.
- **FinancialAdjustment**: privileged correction header that posts
  compensating ADJUSTMENT entries.

## Success Criteria *(mandatory)*

- **SC-001**: Tests prove a balanced DEPOSIT journal persists and an
  unbalanced journal writes nothing.
- **SC-002**: Tests prove idempotent replay returns the original journal and a
  conflicting payload is rejected.
- **SC-003**: Tests prove derived balance equals the signed sum of entries.
- **SC-004**: Tests prove `reconcileBooking` reports balanced vs missing
  without changing booking status.
- **SC-005**: Tests prove original entries survive adjustment and SQL rewrite
  is rejected.
- **SC-006**: Tests prove MARKETER_COMMISSION posting, ORDER links, and
  user-account creation are rejected.
- **SC-007**: Tests prove no new HTTP path is registered for payments/ledger.
- **SC-008**: Phase coverage meets ≥80% statements / ≥75% branches / ≥80%
  functions / ≥80% lines on phase-owned executable files.
- **SC-009**: Module-boundary review finds no forbidden cross-module
  Prisma/repository imports and no bookings→payments persistence leak.
- **SC-010**: Clean install + populated P13→P14 upgrade proofs pass on an
  authorized disposable target, or the gate is recorded BLOCKED with the
  exact missing URL — never relabeled PASS.

## Out of Scope

- Payment methods, Paymob/webhooks, receipts, moving a booking to `CONFIRMED`
  (P15)
- Cancellation/reschedule fee matrix (OQ-001 / P16)
- Provider accept/reject, assignment, order execution
- Remaining/COD collection HTTP (P20)
- Provider dues/settlement/payout execution (P21)
- Staff finance control HTTP (later admin phase)
- Marketer commissions (DEC-007 / R2)
- Stored-value wallets, Docker, cloud
- Inventing InstaPay or coupon behavior

## Assumptions

- Egypt is the only seeded country; accounts use its configured currency.
- One journal currency per post; multi-currency booking is out of Release 1.
- Bookings already persist deposit/gross as requirements; P14 does not
  recalculate commercial price.
- Concurrent distinct deposit journals for one booking are allowed in P14;
  uniqueness of a successful collected deposit is a P15 concern.
- Shared generic money helpers are not extracted unless a second copy would
  otherwise appear; payments keeps module-owned helpers.

## Verbatim Constraints

- Tables: `ledger_accounts`, `ledger_entries`, `ledger_entry_links`,
  `financial_idempotency_keys`, `financial_snapshots`, `financial_adjustments`
- Migration name: `r1_p14_financial_ledger_payment_architecture`
- Module name: `payments`
- Public file: `src/modules/payments/payments.public.ts`
- Entry types: `DEPOSIT`, `PLATFORM_FEE`, `PROVIDER_SHARE`,
  `MARKETER_COMMISSION`, `COD_REMAINING`, `PAYOUT`, `REFUND`, `ADJUSTMENT`
- Link kinds: `BOOKING`, `ORDER`
- System account types: `PLATFORM_CLEARING`, `PLATFORM_REVENUE`,
  `PROVIDER_PAYABLE`, `CUSTOMER_DEPOSIT_LIABILITY`, `COD_CLEARING`,
  `PAYOUT_CLEARING`, `REFUND_CLEARING`, `ADJUSTMENT_CLEARING`

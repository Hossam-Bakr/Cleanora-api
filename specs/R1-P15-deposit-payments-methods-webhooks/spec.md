# Feature Specification: R1-P15 — Deposit Payments, Methods & Webhooks

**Feature Branch**: `codex/r1-p15-deposit-payments-methods-webhooks`
**Created**: 2026-09-12
**Status**: Active — prepared for Codex PM acceptance; not Complete
**Input**: Roadmap §R1-P15; `/work-on-next-phase` activation DEC-094; vision §7;
DEC-003, DEC-006; OQ-001, OQ-008, OQ-009; architecture entity ownership for
`payments` deposit tables; R1-P14 ledger public contract.

## Clarifications

### Session 2026-09-12 (MVB — locked holdings; do not re-ask owner)

These holdings are derived from canonical vision/roadmap/architecture and
owner-supplied MVB locks for this preparation pass. Codex PM must accept or
name exceptions before implementation; they are **not** open product questions.

- Q: Which module owns deposit capture? → A: **Extend** the existing
  `payments` module. It owns all six P15 roadmap tables **and** continues to
  own the P14 ledger tables. No other module may import payments Prisma,
  repositories, or internal schemas.
- Q: Tables and migration? → A: `payment_methods`, `payment_attempts`,
  `payments`, `payment_gateway_events`, `payment_receipts`,
  `refund_requests`. Migration name:
  `r1_p15_deposit_payments_methods_webhooks`.
- Q: Which rails for Egypt? → A: Egypt seed **enables** Paymob CARD and
  Paymob WALLET only. Any other rail may exist only as **disabled** config
  rows. Do **not** invent InstaPay behavior (OQ-009).
- Q: Required HTTP? → A:
  1. `GET` country-enabled payment methods (authenticated customer).
  2. `POST` initiate deposit for an `AWAITING_DEPOSIT` booking owned by the
     customer (idempotent).
  3. `GET` browser return handler that **never** marks paid (pending/status
     only).
  4. `POST` Paymob webhook with raw-body signature verification and
     idempotent processing.
  5. `GET` payment/receipt for owner customer (and `staff_admin` read).
  6. `staff_admin` `PUT`/`PATCH` enable/disable method for a country
     (minimal config).
- Q: Does browser redirect prove payment? → A: **No.** Browser redirect
  success alone never marks payment paid and never moves a booking to
  `CONFIRMED`.
- Q: What is the sole authority to mark paid / confirm? → A: A **verified
  webhook** (or equivalent verified gateway event) is the sole authority to
  mark payment `SUCCEEDED`, post a `DEPOSIT` ledger journal via existing
  payments `postJournal`, create a receipt, then call the Bookings public
  confirm-from-deposit seam to move `AWAITING_DEPOSIT` → `CONFIRMED`.
- Q: Duplicate webhooks? → A: Harmless idempotent replay; no second commercial
  payment, no second deposit journal, no second confirm.
- Q: Failed/retry? → A: While the booking remains `AWAITING_DEPOSIT`, the
  customer may start a **new** attempt. Prior attempts stay `FAILED` /
  `EXPIRED`. At most **one** `SUCCEEDED` payment per booking deposit purpose.
- Q: Refunds in this phase? → A: Foundation only — create `refund_requests`
  rows in `REQUESTED` status. No gateway refund execution. No `REFUND`
  ledger post in this phase.
- Q: Money? → A: Decimal-safe minor-unit digit strings; no JavaScript `number`
  money math; reuse existing payments money helpers from P14.
- Q: Gateway adapter? → A: `PaymentGatewayPort` with a Paymob adapter and a
  test fake. Secrets from environment. Fail closed if misconfigured when
  initiating a deposit.
- Q: Coverage? → A: Phase-owned executable files 80/75/80/80 (statements /
  branches / functions / lines). Include unimported P15 files.
- Q: Out of scope reminders? → A: Wallets, InstaPay invention, cancel fees
  (OQ-001), coupons (OQ-008), provider accept (P16), assignment, payout
  execution, remaining/COD collection, Docker/cloud.

Named exceptions to propose:

- **EX-01**: Refund foundation rows only; no gateway refund call and no
  REFUND journal in P15.
- **EX-02**: Non-Paymob Egypt rails appear only as disabled seed/config rows;
  no executable InstaPay (or other) workflow.
- **EX-03**: Browser return is status-display only; verification authority is
  webhook/gateway-event processing only.

## Definition of Done (explicit)

1. `payments` owns the six P15 tables plus the existing ledger; public
   contracts and HTTP are documented and tested.
2. Egypt enables only Paymob CARD and Paymob WALLET; other rails stay disabled.
3. Deposit initiation is idempotent; browser return never marks paid or
   confirms.
4. Verified webhook processing is the sole path to `SUCCEEDED` payment,
   deposit journal, receipt, and Bookings `confirmDepositPayment`.
5. Duplicate webhooks and retries behave as specified; at most one succeeded
   deposit payment per booking.
6. Refund requests can be recorded as `REQUESTED` only.
7. Phase-owned migration `r1_p15_deposit_payments_methods_webhooks` is
   reviewed and proven on an authorized disposable target when available.
8. OpenAPI + Postman for P15 endpoints validate; coverage ≥80/75/80/80.
9. No unresolved BLOCKER/MAJOR review findings. Phase is not marked Complete
   and nothing is committed/pushed by this workflow unless the owner later
   authorizes exact Git publication.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — List enabled deposit methods (Priority: P1)

An authenticated customer lists payment methods enabled for their country so
they can choose an approved rail before paying a deposit.

**Why this priority**: Roadmap payment-method configuration by country.
**Independent Test**: Seed Egypt methods; GET returns only enabled Paymob
CARD and WALLET; disabled rails omitted or flagged disabled per contract.
**Acceptance Scenarios**:

1. **Given** Egypt seeded with Paymob CARD and WALLET enabled, **When** a
   verified customer GETs country-enabled methods, **Then** both enabled
   methods are returned and no invented InstaPay executable rail appears.
2. **Given** a disabled config row for another rail, **When** the customer
   lists methods, **Then** that rail is not offered for initiation.
3. **Given** an unauthenticated caller, **When** GET methods is called,
   **Then** authentication is required.

### User Story 2 — Initiate deposit for awaiting booking (Priority: P1)

A customer starts a deposit payment for their own `AWAITING_DEPOSIT` booking
using an enabled method. The system creates an attempt and gateway session
reference without marking paid.

**Why this priority**: Roadmap deposit initiation + gateway session.
**Independent Test**: POST initiate with Idempotency-Key; assert attempt
created, redirect/session payload returned, booking still `AWAITING_DEPOSIT`,
payment not `SUCCEEDED`.
**Acceptance Scenarios**:

1. **Given** an owned `AWAITING_DEPOSIT` booking and an enabled Paymob method,
   **When** POST initiate runs with a new idempotency key, **Then** a
   `payment_attempts` row and pending payment context exist and the response
   includes gateway session/redirect data.
2. **Given** the same customer, booking, and idempotency key + payload,
   **When** initiate is retried, **Then** the original attempt/session is
   returned and no second commercial attempt is created.
3. **Given** gateway secrets are missing/misconfigured, **When** initiate is
   attempted, **Then** the command fails closed and no paid state is written.
4. **Given** a booking not owned by the caller or not `AWAITING_DEPOSIT`,
   **When** initiate is attempted, **Then** it is rejected
   (not-found/forbidden/transition).

### User Story 3 — Browser return is never proof of payment (Priority: P1)

After the gateway redirects the browser, the customer sees pending/status
only. The system does not mark payment succeeded or confirm the booking.

**Why this priority**: Roadmap Done-When — redirect success alone never marks
paid.
**Independent Test**: Simulate return URL with success-looking query params;
assert payment status unchanged from pending and booking still
`AWAITING_DEPOSIT`.
**Acceptance Scenarios**:

1. **Given** an in-flight deposit attempt, **When** GET browser return runs
   with gateway success-looking parameters, **Then** the response shows
   pending/status only and no `SUCCEEDED` payment, receipt, or confirm occurs.
2. **Given** a forged return without a matching attempt, **When** return is
   called, **Then** it fails closed without marking any payment paid.

### User Story 4 — Verified webhook confirms deposit (Priority: P1)

Paymob delivers a webhook. After raw-body signature verification, the system
idempotently records the gateway event, marks the payment `SUCCEEDED`, posts
a `DEPOSIT` journal through existing `postJournal`, creates a receipt, and
calls Bookings `confirmDepositPayment` so the booking becomes `CONFIRMED`.

**Why this priority**: Sole authority for paid + confirmed.
**Independent Test**: Signed webhook fixture → payment SUCCEEDED + journal +
receipt + booking CONFIRMED; replay is a no-op.
**Acceptance Scenarios**:

1. **Given** a pending attempt matching a verified Paymob success event,
   **When** the webhook is processed, **Then** payment is `SUCCEEDED`, a
   balanced DEPOSIT journal exists, a receipt exists, and the booking is
   `CONFIRMED`.
2. **Given** the same verified event delivered again, **When** processed,
   **Then** processing is idempotent: no second payment success, journal,
   receipt, or status transition side effect.
3. **Given** an invalid signature or tampered body, **When** webhook POST
   runs, **Then** it is rejected and no payment/ledger/booking mutation
   occurs.
4. **Given** a verified failure/expiry event, **When** processed, **Then** the
   attempt becomes `FAILED`/`EXPIRED`, booking stays `AWAITING_DEPOSIT`, and
   no SUCCEEDED payment exists.

### User Story 5 — Retry after failure (Priority: P1)

After a failed or expired attempt, the customer starts a new attempt while the
booking is still awaiting deposit. Only one succeeded deposit payment is
allowed.

**Why this priority**: Roadmap retry and failed payment.
**Independent Test**: Fail first attempt; initiate second; succeed second via
webhook; assert one SUCCEEDED payment and prior attempt remains FAILED.
**Acceptance Scenarios**:

1. **Given** a prior `FAILED`/`EXPIRED` attempt and booking still
   `AWAITING_DEPOSIT`, **When** the customer initiates again, **Then** a new
   attempt is created.
2. **Given** one `SUCCEEDED` deposit payment already exists for the booking,
   **When** another initiate or success webhook arrives, **Then** it is
   rejected or harmlessly ignored per idempotency rules without a second
   SUCCEEDED payment.

### User Story 6 — Receipt read and staff method toggle (Priority: P2)

The owning customer (and `staff_admin`) can read payment/receipt facts.
`staff_admin` can enable/disable a method for a country with minimal config.

**Why this priority**: Roadmap receipt + method configuration.
**Independent Test**: GET receipt authorized; staff PATCH disable removes
method from customer list; non-staff forbidden.
**Acceptance Scenarios**:

1. **Given** a SUCCEEDED payment with receipt, **When** the owner customer
   GETs payment/receipt, **Then** receipt facts are returned without raw
   gateway secrets.
2. **Given** `staff_admin`, **When** PATCH disables a method for Egypt,
   **Then** subsequent customer method lists omit it for initiation.
3. **Given** a non-owner customer, **When** GET receipt is called, **Then**
   access is denied without enumerating existence beyond policy.

### User Story 7 — Refund request foundation only (Priority: P2)

Operations may record a refund request in `REQUESTED` status. No money moves
through the gateway and no REFUND ledger entry is posted in this phase.

**Why this priority**: Roadmap refund record foundation.
**Independent Test**: Create `refund_requests` row; assert no gateway call and
no REFUND journal.
**Acceptance Scenarios**:

1. **Given** a SUCCEEDED payment, **When** a refund request foundation path
   creates a row, **Then** status is `REQUESTED` only.
2. **Given** that request, **When** inspected, **Then** no gateway refund
   execution and no REFUND ledger post occurred.

## Edge Cases

- Initiate for `DRAFT`, `CONFIRMED`, or `CANCELLED` booking → reject.
- Initiate for another customer's booking → non-enumerating not-found /
  forbidden per API policy.
- Disabled method id supplied on initiate → validation/business reject.
- Concurrent initiate with different idempotency keys before success → both
  may create attempts; only one may become SUCCEEDED.
- Concurrent duplicate webhooks → one wins; other replays harmlessly.
- Webhook for unknown merchant order / attempt → record or reject per fail-
  closed policy without confirming a booking.
- Amount mismatch vs booking deposit requirement → fail closed; do not
  confirm.
- Currency mismatch → fail closed.
- Bookings confirm seam rejects (status already changed) → payment pipeline
  must not leave unreconciled SUCCEEDED without recorded failure handling;
  tests document the fail-closed outcome.
- Misconfigured Paymob env on initiate → fail closed.
- Wallet-shaped APIs or stored balances → must not exist (DEC-003).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extend the existing `payments` module to own
  `payment_methods`, `payment_attempts`, `payments`,
  `payment_gateway_events`, `payment_receipts`, and `refund_requests`, and
  MUST continue to own the P14 ledger tables.
- **FR-002**: System MUST expose deposit/payment behaviors through
  `payments.public.ts` (extended) and HTTP adapters owned by `payments`;
  other modules MUST NOT import payments persistence.
- **FR-003**: System MUST seed Egypt with Paymob CARD and Paymob WALLET
  enabled, and MUST keep any other rail disabled by configuration without
  inventing InstaPay behavior (OQ-009).
- **FR-004**: System MUST provide authenticated customer GET of
  country-enabled payment methods.
- **FR-005**: System MUST provide idempotent authenticated customer POST to
  initiate a deposit for an owned `AWAITING_DEPOSIT` booking, creating a
  payment attempt and gateway session/reference without marking paid.
- **FR-006**: System MUST provide a GET browser return handler that returns
  pending/status only and MUST NEVER mark payment paid or booking confirmed
  from redirect alone.
- **FR-007**: System MUST provide POST Paymob webhook handling that verifies
  the raw body signature, records gateway events idempotently, and is the
  sole authority path to mark payment `SUCCEEDED`.
- **FR-008**: On verified deposit success, System MUST post a balanced
  `DEPOSIT` journal via existing `postJournal`, create a `payment_receipts`
  row, and call Bookings public `confirmDepositPayment` to move
  `AWAITING_DEPOSIT` → `CONFIRMED`.
- **FR-009**: System MUST treat duplicate verified gateway events as harmless
  idempotent replays.
- **FR-010**: System MUST allow a new attempt while booking remains
  `AWAITING_DEPOSIT` after `FAILED`/`EXPIRED` attempts, keep prior attempts
  terminal, and enforce at most one `SUCCEEDED` payment per booking deposit
  purpose.
- **FR-011**: System MUST allow owner-customer and `staff_admin` GET of
  payment/receipt facts, and MUST allow `staff_admin` PUT/PATCH to
  enable/disable a method for a country (minimal config).
- **FR-012**: System MUST support creating `refund_requests` in `REQUESTED`
  status only, and MUST NOT execute gateway refunds or post REFUND ledger
  journals in this phase.
- **FR-013**: System MUST use decimal-safe minor-unit arithmetic via existing
  payments money helpers and MUST NOT use JavaScript `number` for money.
- **FR-014**: System MUST implement `PaymentGatewayPort` with a Paymob
  adapter and a test fake; secrets MUST come from environment; initiate MUST
  fail closed when misconfigured.
- **FR-015**: System MUST create phase-owned migration
  `r1_p15_deposit_payments_methods_webhooks` and MUST NOT edit applied
  migrations.
- **FR-016**: System MUST NOT implement stored-value wallets, InstaPay
  invention, cancellation fees, coupons, provider accept, assignment, payout
  execution, remaining/COD collection, Docker, or cloud.
- **FR-017**: Bookings MUST expose a public `confirmDepositPayment` seam
  callable only from trusted composition/payments success processing; Payments
  MUST NOT import bookings repositories or Prisma booking models.
- **FR-018**: System MUST publish OpenAPI and Postman artifacts for the P15
  HTTP surface and keep validation green.

### Key Entities

- **PaymentMethod**: country-scoped rail config (provider, type, enabled).
- **PaymentAttempt**: one initiation/session toward a deposit; terminal
  FAILED/EXPIRED allowed; linked to booking and method.
- **Payment**: commercial payment record for a deposit purpose; at most one
  SUCCEEDED per booking deposit.
- **PaymentGatewayEvent**: verified inbound gateway event with idempotency
  key; append-oriented processing input.
- **PaymentReceipt**: customer-visible receipt facts after success.
- **RefundRequest**: foundation row (`REQUESTED` only in P15).
- **Ledger (existing)**: DEPOSIT journal posted only after verified success.

## Success Criteria *(mandatory)*

- **SC-001**: Tests prove initiate creates attempt/session and does not mark
  paid or confirm.
- **SC-002**: Tests prove browser return never marks paid or confirms.
- **SC-003**: Tests prove verified webhook marks SUCCEEDED, posts DEPOSIT
  journal, creates receipt, and confirms booking.
- **SC-004**: Tests prove invalid webhook signature writes no money/booking
  side effects.
- **SC-005**: Tests prove duplicate webhooks are harmless idempotent replays.
- **SC-006**: Tests prove retry after FAILED/EXPIRED creates a new attempt
  and at most one SUCCEEDED deposit payment exists per booking.
- **SC-007**: Tests prove Egypt customer method list offers only enabled
  Paymob CARD/WALLET and disabled rails are not initiatable.
- **SC-008**: Tests prove refund request foundation creates REQUESTED only
  with no gateway refund and no REFUND journal.
- **SC-009**: Phase coverage meets ≥80% statements / ≥75% branches / ≥80%
  functions / ≥80% lines on phase-owned executable files.
- **SC-010**: Module-boundary review finds no forbidden cross-module
  Prisma/repository imports.
- **SC-011**: OpenAPI and Postman validation pass for P15 endpoints.
- **SC-012**: Clean install + populated P14→P15 upgrade proofs pass on an
  authorized disposable target, or the gate is recorded BLOCKED with the
  exact missing URL — never relabeled PASS.

## Out of Scope

- Stored-value wallets / top-up / transfer (DEC-003)
- Invented InstaPay or other non-approved executable rails (OQ-009)
- Cancellation/reschedule fee matrix (OQ-001 / P16)
- Coupons (OQ-008)
- Provider accept/reject (P16), assignment (P17), order execution (P18+)
- Remaining/COD collection (P20), payout execution (P21)
- Gateway refund execution and REFUND ledger posting
- Staff finance full control UI beyond minimal method enable/disable
- Docker, cloud

## Assumptions

- Egypt is the only seeded country for method enablement in this phase.
- Booking deposit amount and currency come from Bookings public financial
  snapshot / frozen quote; Payments does not recalculate commercial price.
- P14 `postJournal` and system accounts already exist and remain the only
  ledger write path for deposit success.
- Paymob is the only executable gateway adapter in P15; the port allows a
  test fake.
- Webhook authenticity uses Paymob HMAC/signature over the raw body as
  configured by env; exact header names are recorded in plan/contracts from
  Paymob docs at implementation time without inventing InstaPay.

## Verbatim Constraints

- Tables: `payment_methods`, `payment_attempts`, `payments`,
  `payment_gateway_events`, `payment_receipts`, `refund_requests`
- Migration name: `r1_p15_deposit_payments_methods_webhooks`
- Module name: `payments` (extend existing)
- Public file: `src/modules/payments/payments.public.ts`
- Bookings seam: `confirmDepositPayment`
- Adapter: `PaymentGatewayPort` (Paymob + test fake)
- Coverage thresholds: 80 / 75 / 80 / 80
- Egypt enabled rails: Paymob CARD, Paymob WALLET only

# Feature Specification: R1-P13 — Booking Draft, Pricing Snapshot & Status Machine

**Feature Branch**: `codex/r1-p13-booking-draft-pricing-snapshot-status-machine`
**Created**: 2026-09-10
**Status**: **Complete** under DEC-093 (owner activated R1-P14)
**Input**: Roadmap §R1-P13; `/work-on-next-phase` activation DEC-090; vision §§3.1, 7.1, 8; OQ-001, OQ-010; architecture entity ownership for `bookings`.

## Clarifications

### Session 2026-09-10 (MVB — proposed for Codex PM acceptance)

These holdings are derived from canonical vision/roadmap and are **not**
invented fee or payment behavior. Codex PM must accept or name exceptions
before implementation.

- Q: Which module owns booking mutation? → A: Existing `bookings` module
  (already owns Browse HTTP). No new module. Orders tables stay future.
- Q: Booking path? → A: `browse` only. Recommended is out of Release 1 timing
  (DEC-007 / vision §3.2 later).
- Q: Who may create a booking? → A: Authenticated customer whose
  `verifiedCategories` includes at least one of `INDIVIDUAL`, `COMPANY`,
  `ENGINEER`. Guests and verification-only / invitation-onboarding principals
  are rejected. Identity comes from the access token, never the body.
- Q: OQ-010 booking enum names (frozen)? → A: Closed Prisma enum
  `BookingStatus`: `DRAFT`, `AWAITING_DEPOSIT`, `CONFIRMED`, `CANCELLED`.
  Executable in this phase: `DRAFT` and `AWAITING_DEPOSIT`, plus `CANCELLED`
  from those two. `CONFIRMED` is matrix-documented and rejected until P15
  (verified gateway event). No other booking statuses.
- Q: Order enum names (frozen labels, not tables)? → A: Closed conceptual
  order statuses for the matrix only: `PENDING_FULFILLMENT`, `ASSIGNED`,
  `ON_THE_WAY`, `IN_PROGRESS`, `COMPLETED`, `FAILED`. No `orders` table or
  order HTTP in this phase. Booking never jumps into those values.
- Q: Emergency modeling (OQ-010)? → A: Parallel boolean
  `emergencySignaled` default false on `bookings`. Not a status. No panic HTTP
  in this phase. Matrix records emergency as a parallel concern owned by later
  order/emergency work.
- Q: When do snapshots freeze? → A: Server recalculates on draft mutate.
  Transition `DRAFT` → `AWAITING_DEPOSIT` persists immutable
  `booking_snapshots` + `booking_price_breakdowns`. Those rows have no
  `updated_at` and must fail closed on rewrite attempts.
- Q: Price and deposit? → A: Server-authoritative. Gross = max(offering
  price, minimum charge) in offering currency using existing minor-unit
  helpers (no JS number). Deposit percent from Configuration country key
  `commercial.deposit_percent` (NUMBER 0–100, two decimal places max; Egypt
  seed 25 matching vision default). Deposit amount = round-half-up to currency
  decimal places of `gross * percent / 100`. Provider share remainder is
  recorded on the breakdown as informational; no ledger posting (P14) and no
  payment (P15). Client totals are ignored.
- Q: Eligibility at create/submit? → A: Bookings calls
  `evaluateEligibility` in `explicit` mode with the selected `providerId`
  (never Browse facade for mutation). The selected `teamId` must appear in
  `eligibleTeams`. Fail closed if catalog/offering/team ineligible. Do not
  leak excluded-candidate diagnostics to the customer.
- Q: Address? → A: Customer supplies an owned `userAddressId`. Bookings
  reads a new Customers public snapshot reader and copies fields into
  `booking_addresses` (no live FK that would rewrite history). City/district
  on the snapshot must match the booking locality ids used for eligibility.
- Q: Answers? → A: Required catalog fields from the snapshot-ready
  definition must be present and valid before `AWAITING_DEPOSIT`. Optional
  fields may be omitted. Answers store field id/code/kind plus canonical
  value JSON; they do not keep a live FK that would rewrite after freeze.
- Q: Notes and media? → A: Optional customer notes (bounded text). Permitted
  media: images only, via Media public contract with new owner type
  `BOOKING_ATTACHMENT`, max 5 READY files, linked in `booking_media`.
  Attachments allowed only while `DRAFT`.
- Q: Idempotency? → A: `Idempotency-Key` header required on create and on
  status-changing commands (submit-for-deposit, cancel). Replay of the same
  customer+key returns the original result. Different body for the same key
  → conflict.
- Q: Cancellation? → A: Customer may cancel `DRAFT` or `AWAITING_DEPOSIT`
  with a closed reason code (`CUSTOMER_CHANGED_MIND`, `CUSTOMER_WRONG_DETAILS`,
  `OTHER`). Persist status history. **Do not calculate or store fees**
  (OQ-001). P16 owns `booking_cancellations` fee tables — not created here.
- Q: Concurrency? → A: Bookings carry `version`. Stale writes and illegal
  transitions reject with unchanged state.
- Q: Browse contract change? → A: Update `bookingPrerequisites` so
  `bookingAvailable` is true for a verified customer principal and remains
  false for guests; `requiresVerifiedCustomer` stays true; `phase` becomes
  `R1-P13`.
- Q: HTTP prefix? → A: `/api/v1/bookings` for mutation/reads. Browse stays
  `/api/v1/browse`.
- Q: Coverage? → A: Phase-owned executable files 80/75/80/80 (statements /
  branches / functions / lines). Include unimported P13 files.

Named exceptions to propose:

- **EX-01**: `CONFIRMED` and all order statuses are frozen in
  `status_transition_rules` but not executable. Attempts return a stable
  `TRANSITION_NOT_AVAILABLE` (or equivalent) without partial writes.
- **EX-02**: No payment, webhook, or ledger row. Deposit is a calculated
  requirement on the booking, not a collected amount.
- **EX-03**: No Staff privileged override HTTP in this phase (matrix row
  exists as `PRIVILEGED_OVERRIDE` category, blocked).

## Definition of Done (explicit)

1. A verified customer can create an idempotent browse-path booking draft for
   an eligible Provider/Team/service/schedule/address.
2. Server-calculated price and deposit are persisted; client totals are not
   trusted.
3. `DRAFT` → `AWAITING_DEPOSIT` freezes immutable snapshots; later catalog or
   provider price changes do not rewrite them.
4. Actor × from × to matrix is persisted and enforced; illegal transitions
   fail closed; `CONFIRMED`/order/emergency-as-status are not executable.
5. Customer cancel from draft/awaiting-deposit writes history without fees.
6. OpenAPI + Postman cover every new HTTP operation; authorization, validation,
   idempotency, and snapshot-immutability tests pass.
7. Phase-owned migration `r1_p13_booking_draft_pricing_snapshot_status_machine`
   is reviewed and proven on an authorized disposable target when available.
8. No unresolved BLOCKER/MAJOR review findings. Phase is not marked Complete
   and nothing is committed/pushed by this workflow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Verified customer creates a booking draft (Priority: P1)

A verified customer who already found an eligible team on Browse submits
service, schedule, crew preference, address, and optional notes/answers and
receives a `DRAFT` booking with a server price quote.

**Why this priority**: Core commercial start; roadmap draft Done-When.
**Independent Test**: Authenticated HTTP create against fixtures; guest
rejected; ineligible team rejected; idempotent replay returns same id.
**Acceptance Scenarios**:

1. **Given** a verified customer and an eligible provider/team for the request,
   **When** `POST /api/v1/bookings` runs with a new Idempotency-Key, **Then** a
   `DRAFT` booking is created with copied address, server quote, and version 1.
2. **Given** no Bearer token or an unverified customer, **When** create is
   called, **Then** authorization fails and no row is written.
3. **Given** a team that Eligibility would exclude, **When** create is called,
   **Then** the command fails closed without leaking exclusion diagnostics.
4. **Given** the same customer, key, and body, **When** create is retried,
   **Then** the original booking is returned and no second commercial row is
   created.

### User Story 2 — Customer completes answers and submits for deposit (Priority: P1)

The customer fills required service answers while `DRAFT`, then submits. The
booking becomes `AWAITING_DEPOSIT` with frozen snapshots and a deposit amount.

**Why this priority**: Roadmap awaiting-deposit + snapshot Done-When.
**Independent Test**: Submit without required answers fails; submit with valid
answers freezes snapshot; changing live provider price afterward does not
change stored snapshot/breakdown.
**Acceptance Scenarios**:

1. **Given** a draft missing a required catalog field, **When** submit-for-deposit
   runs, **Then** validation fails and status stays `DRAFT`.
2. **Given** a complete draft, **When** submit-for-deposit runs, **Then** status
   is `AWAITING_DEPOSIT`, snapshots exist, and deposit/gross match server math.
3. **Given** an awaiting-deposit booking, **When** the live offering price
   changes, **Then** `GET` still returns the frozen snapshot amounts.
4. **Given** a client-supplied total that disagrees with the server, **When**
   create or submit runs, **Then** the client total is ignored (or rejected if
   sent as an authoritative field — plan forbids the field).

### User Story 3 — Status machine rejects illegal moves (Priority: P1)

The persisted matrix is the only authority for transitions. Customers cannot
confirm payment, start fulfillment, or set emergency-as-status.

**Why this priority**: OQ-010 freeze; roadmap matrix Done-When.
**Independent Test**: Seeded rules; illegal from/to rejected; stale version
rejected; confirmed transition blocked (EX-01).
**Acceptance Scenarios**:

1. **Given** `AWAITING_DEPOSIT`, **When** a client asks to move to `CONFIRMED`,
   **Then** the API rejects with `TRANSITION_NOT_AVAILABLE` and status is
   unchanged.
2. **Given** `CANCELLED`, **When** any further customer mutation is attempted,
   **Then** it is rejected.
3. **Given** a stale `version`, **When** submit or cancel runs, **Then** conflict
   is returned and no partial side effects persist.
4. **Given** seeded `status_transition_rules`, **When** inspected in tests,
   **Then** every executable P13 transition has actor, from, to, preconditions,
   side effects, audit, and failure outcome documented.

### User Story 4 — Customer cancels without invented fees (Priority: P2)

The customer cancels a draft or awaiting-deposit booking. History records the
event. No cancellation fee is calculated.

**Why this priority**: Roadmap cancellation-event foundation; OQ-001.
**Independent Test**: Cancel from both cancellable states; assert no fee
fields; cancelled booking cannot submit.
**Acceptance Scenarios**:

1. **Given** `DRAFT` or `AWAITING_DEPOSIT`, **When** the owning customer cancels
   with a closed reason, **Then** status is `CANCELLED` and history records
   actor, from, to, reason, and timestamp.
2. **Given** that cancel, **When** payloads and tables are inspected, **Then**
   no fee amount, percent, or deposit-forfeit figure exists.
3. **Given** another customer's booking, **When** cancel is attempted, **Then**
   authorization fails without enumerating the foreign booking beyond not-found
   policy in the plan.

### User Story 5 — Notes, media, and list/get (Priority: P2)

The customer attaches permitted images and notes on a draft, lists own
bookings, and reads one booking without seeing other customers' data.

**Why this priority**: Roadmap notes/media; needed operational reads.
**Independent Test**: Media over-limit rejected; list is self-only; get
authorization.
**Acceptance Scenarios**:

1. **Given** a draft, **When** up to five READY `BOOKING_ATTACHMENT` images are
   linked, **Then** they appear on GET with signed delivery URLs.
2. **Given** a sixth image or a non-image, **When** attach is called, **Then**
   validation fails.
3. **Given** two customers, **When** each lists bookings, **Then** neither sees
   the other's ids.

## Edge Cases

- Eligibility hard failure on create/submit → mapped technical error; no draft
  that pretends the team is eligible.
- Address city/district mismatch vs eligibility locality → validation failure.
- Inactive/unknown catalog field id in answers → validation failure.
- Submit after another process already submitted (idempotent key vs version)
  → original success or conflict, never a second freeze.
- Media signing failure for one attachment → omit that delivery URL (do not
  fail GET of the booking).
- Country without `commercial.deposit_percent` → fail closed, no invented 25%
  in code; Egypt seed supplies 25.
- Guest hitting `/bookings` → unauthenticated, not a fake customer.
- Browse still must not create bookings (P12 EX-02 remains true for `/browse`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow only verified customers to create browse-path
  bookings under `/api/v1/bookings`.
- **FR-002**: System MUST re-evaluate Eligibility in explicit mode and require
  the selected team to be eligible at create and at submit-for-deposit.
- **FR-003**: System MUST persist customer, provider, team, service, schedule,
  crew preference, address snapshot, answers, notes, and permitted media as
  specified.
- **FR-004**: System MUST calculate gross and deposit server-side with
  decimal-safe minor-unit arithmetic and configured deposit percent.
- **FR-005**: System MUST freeze provider/service/price snapshots at
  `AWAITING_DEPOSIT` so later live changes cannot silently rewrite them.
- **FR-006**: System MUST implement `DRAFT` and `AWAITING_DEPOSIT` including
  the submit transition, with optimistic `version`.
- **FR-007**: System MUST persist and enforce an actor × from × to matrix in
  `status_transition_rules` for frozen booking and documented order labels.
- **FR-008**: System MUST reject `CONFIRMED`, order-status, and emergency-as-status
  transitions in this phase (EX-01).
- **FR-009**: System MUST model emergency as `emergencySignaled` boolean, default
  false, with no panic HTTP in this phase.
- **FR-010**: System MUST support customer cancel from `DRAFT` and
  `AWAITING_DEPOSIT` with closed reasons and **without** fee calculation.
- **FR-011**: System MUST make create and status-changing commands idempotent
  via `Idempotency-Key`.
- **FR-012**: System MUST authorize self-only reads/writes; Staff override HTTP
  is out of phase (EX-03).
- **FR-013**: System MUST validate all booking HTTP inputs with Zod at the
  boundary and ignore client-authored totals.
- **FR-014**: Bookings MUST call other modules only through approved public
  contracts / composition (Customers address snapshot, Catalog definition,
  Providers snapshot, Eligibility evaluate, Configuration deposit percent,
  Media attachments, Authentication principal).
- **FR-015**: System MUST add Configuration country key
  `commercial.deposit_percent` (seed Egypt 25) readable through Configuration
  public contract.
- **FR-016**: System MUST update Browse `bookingPrerequisites` for verified
  customers without creating bookings from Browse routes.
- **FR-017**: OpenAPI and Postman MUST cover every new booking HTTP operation
  including auth, errors, examples, and idempotency headers.
- **FR-018**: System MUST create phase-owned migration
  `r1_p13_booking_draft_pricing_snapshot_status_machine` and not edit applied
  migrations.

### Key Entities

- **Booking**: customer-owned commercial header; status; schedule; crew;
  versions; emergency flag; deposit/gross requirement amounts; currency.
- **BookingItem**: selected provider/team/service identity at creation.
- **BookingAnswer**: captured catalog field values.
- **BookingAddress**: frozen textual address copy.
- **BookingMedia**: Media ids owned as booking attachments.
- **BookingSnapshot**: immutable catalog+provider+price JSON/hash at freeze.
- **BookingPriceBreakdown**: immutable gross, deposit, remainder, percent,
  currency, inputs hash.
- **BookingStatusHistory**: append-only transition records.
- **StatusTransitionRule**: seeded actor/from/to/precondition/side-effect/audit
  rows; executable flag.
- **BookingCommand**: idempotency ledger for create/submit/cancel.

## Success Criteria *(mandatory)*

- **SC-001**: Integration tests prove guests cannot create bookings and
  unverified customers cannot create bookings.
- **SC-002**: Integration tests prove ineligible teams cannot be booked.
- **SC-003**: Tests prove server deposit/gross math for 25% on a known price
  and that client totals cannot override.
- **SC-004**: Tests prove snapshot amounts stay unchanged after live price
  mutation.
- **SC-005**: Tests prove illegal transitions (`CONFIRMED`, cancelled→draft,
  stale version) leave state unchanged.
- **SC-006**: Tests prove cancel writes history and stores no fee amount.
- **SC-007**: OpenAPI validate + Postman validate pass for new operations.
- **SC-008**: Phase coverage meets ≥80% statements / ≥75% branches / ≥80%
  functions / ≥80% lines on phase-owned executable files.
- **SC-009**: Module-boundary review finds no forbidden cross-module
  Prisma/repository imports.
- **SC-010**: Clean install + populated P12→P13 (schema-from-P11+P13) upgrade
  proofs pass on an authorized disposable target, or the gate is recorded
  BLOCKED with the exact missing URL — never relabeled PASS.

## Out of Scope

- Ledger accounts and posting (P14)
- Payment methods, Paymob/webhooks, moving to `CONFIRMED` from money (P15)
- Cancellation/reschedule fee matrix (OQ-001 / P16)
- Assignment of workers (P17)
- Order execution, completion codes, panic HTTP
- Recommended path, premium, maps, sockets
- Stored-value wallets, Docker, cloud
- Inventing InstaPay or coupon behavior

## Assumptions

- One line-item booking in Release 1 (single service, single team).
- Schedule is the same UTC half-open interval shape as Eligibility.
- Locale for snapshot copy is `AR` or `EN` supplied by the customer.
- Egypt is seeded configuration, not hard-coded in booking math.
- Existing Browse routes remain guest-capable and do not create bookings.

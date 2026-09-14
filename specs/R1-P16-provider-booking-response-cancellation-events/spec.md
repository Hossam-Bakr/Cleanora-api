# Feature Specification: R1-P16 — Provider Booking Response & Cancellation Events

**Feature Branch**: `r1-p16-provider-booking-response-cancellation-events`
**Created**: 2026-09-13
**Status**: Active — prepared for Codex PM acceptance; not Complete
**Input**: Roadmap §R1-P16; `/work-on-next-phase` activation DEC-096; vision §8;
OQ-001; DEC-003; architecture entity ownership for `booking_responses`,
`booking_cancellations`, `cancellation_reasons`; R1-P13 status freeze
(DEC-091) and R1-P15 `confirmDepositPayment`.

## Clarifications

### Session 2026-09-13 (MVB — locked holdings; do not re-ask owner)

These holdings are derived from canonical vision/roadmap/architecture and
owner-supplied MVB locks for this preparation pass. Codex PM must accept or
name exceptions before implementation; they are **not** open product questions.

- Q: Which module owns response and cancellation? → A: **Extend** the existing
  `bookings` module. It owns `booking_responses`, `booking_cancellations`,
  `cancellation_reasons`, and booking-owned notification intents for this
  phase. No other module may import bookings Prisma, repositories, or
  internal schemas.
- Q: Tables and migration? → A: `booking_responses`, `booking_cancellations`,
  `cancellation_reasons`, plus `booking_notification_intents` (durable
  event rows for P16 notification events; not P23 delivery) and
  `booking_actor_commands` (provider/staff idempotency; existing
  `booking_commands` stays customer-scoped). Migration name:
  `r1_p16_provider_booking_response_cancellation_events`.
- Q: Statuses? → A: Extend BookingStatus with **`ACCEPTED`**. Executable set
  after P16: `DRAFT | AWAITING_DEPOSIT | CONFIRMED | ACCEPTED | CANCELLED`.
  Provider accept is `CONFIRMED → ACCEPTED`. Reject, response expiry, and
  post-confirm cancellations are `→ CANCELLED` with a cancellation record.
  Assignment remains P17; no `ASSIGNED` status in this phase.
- Q: When is the pending response created? → A: Atomically inside the existing
  Bookings public `confirmDepositPayment` seam when `AWAITING_DEPOSIT →
  CONFIRMED` succeeds (and on idempotent replay if the pending row is
  missing). One response row per booking. Status starts `PENDING`.
- Q: Response expiry? → A: Configuration owns
  `commercial.provider_response_hours` (Egypt seed **24**). Fail closed if
  missing when creating the pending response. `expiresAt = confirmedAt +
  hours`. **Lazy expiry**: any inbox/dossier/accept/reject/cancel command
  that sees `PENDING` past `expiresAt` marks the response `EXPIRED` and
  booking `CANCELLED` with reason `PROVIDER_RESPONSE_EXPIRED`. No background
  worker in this phase.
- Q: Who may respond? → A: Only an **active Provider OWNER or ADMIN** of the
  **selected** `booking.providerId`. Workers, other providers, and customers
  cannot accept or reject. Staff cannot accept/reject as the provider.
- Q: Required HTTP? → A:
  1. `GET` provider inbox of `CONFIRMED` bookings with `PENDING` (non-expired
     or lazily expired) responses for that provider.
  2. `GET` booking dossier for the selected provider (and customer owner +
     `staff_admin` read).
  3. `POST` accept (idempotent) for `CONFIRMED` + `PENDING` + not expired.
  4. `POST` reject with a seeded provider reason (idempotent).
  5. Extend customer `POST /bookings/:id/cancel` to `CONFIRMED` and
     `ACCEPTED` with a cancellation event (P13 draft/awaiting-deposit cancel
     unchanged in fee policy: still no fees).
  6. `POST` provider cancel for `ACCEPTED` only, with a seeded provider
     cancellation reason.
  7. `staff_admin` `POST` cancel hook for `CONFIRMED` or `ACCEPTED` with
     reason (privileged, audited).
  8. `GET` cancellation reasons filtered by actor.
- Q: Dossier contents? → A: Booking identity, status, schedule window,
  service/price snapshot facts already frozen, address text the selected
  provider is entitled to after confirm, response state/expiry, cancellation
  if any. Do not leak other providers' data or payment gateway secrets.
- Q: Money on reject/cancel/expiry? → A: Record the event and status only.
  **Do not** calculate cancellation fees, **do not** invent deposit fate,
  **do not** create refund_requests, **do not** post REFUND journals.
  Existing deposit payment/ledger rows stay as they are.
- Q: Notification events? → A: Insert durable `booking_notification_intents`
  in the same unit of work as the status change (template key, locale,
  recipient, idempotency key, safe variables). Do **not** deliver email,
  SMS, or push (P23). Delivery failure cannot exist because delivery is out
  of scope; intent insert failure rolls back the command.
- Q: Counteroffer? → A: Forbidden. No price mutation on accept/reject.
- Q: Coverage? → A: Phase-owned executable files 80/75/80/80 (statements /
  branches / functions / lines). Include unimported P16 files.
- Q: Out of scope reminders? → A: Wallets, InstaPay invention, cancel fees
  (OQ-001), coupons, assignment, orders, remaining/COD, payouts, P23
  delivery, Docker/cloud.

Named exceptions to propose:

- **EX-01**: No fee calculation, no automatic refund_request, no REFUND
  journal (OQ-001). Cancellation is an auditable event only.
- **EX-02**: Notification **intents** only; no FCM/SMS/email delivery (P23).
- **EX-03**: No background expiry job; lazy expiry on read/command using the
  composition clock.

## Definition of Done (explicit)

1. `bookings` owns the three roadmap tables plus booking notification
   intents; public contracts and HTTP are documented and tested.
2. Only the selected provider's active OWNER/ADMIN can accept or reject.
3. Expired or cancelled requests cannot be accepted; accept is
   `CONFIRMED → ACCEPTED` with a response record.
4. Customer, provider, and staff cancellations after confirm are recorded in
   `booking_cancellations` with seeded reasons, status history, and audit.
5. Financial side effects use approved rules only: no invented fees or
   deposit fate.
6. Phase-owned migration `r1_p16_provider_booking_response_cancellation_events`
   is reviewed and proven on an authorized disposable target when available.
7. OpenAPI + Postman for P16 endpoints validate; coverage ≥80/75/80/80.
8. No unresolved BLOCKER/MAJOR review findings. Phase is not marked Complete
   and nothing is committed/pushed by this workflow unless the owner later
   authorizes exact Git publication.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Provider booking inbox (Priority: P1)

An active Provider Owner or Admin lists confirmed bookings waiting for their
response so they can decide to accept or reject.

**Why this priority**: Roadmap provider booking inbox; without it the
selected provider cannot see work.
**Independent Test**: Seed a CONFIRMED booking for provider A and one for
provider B; A's inbox contains only A's pending booking.
**Acceptance Scenarios**:

1. **Given** a CONFIRMED booking whose `providerId` is P and response is
   PENDING and not expired, **When** an active OWNER/ADMIN of P lists the
   inbox, **Then** that booking appears with expiry time.
2. **Given** the same booking, **When** an OWNER/ADMIN of a different
   provider lists the inbox, **Then** the booking is absent.
3. **Given** an unauthenticated or non-member caller, **When** inbox is
   requested, **Then** authentication/authorization fails without leaking
   whether bookings exist.

---

### User Story 2 — View booking dossier (Priority: P1)

The selected provider, the owning customer, and staff admin can read the
confirmed booking dossier needed to respond or audit.

**Why this priority**: Roadmap view booking dossier.
**Independent Test**: Selected provider GET succeeds; other provider GET
does not enumerate the booking.
**Acceptance Scenarios**:

1. **Given** a CONFIRMED booking for provider P, **When** P's OWNER/ADMIN
   GETs the dossier, **Then** schedule, frozen service/price facts, address
   text, and response/expiry state are returned.
2. **Given** the owning customer, **When** they GET their booking, **Then**
   they see status and response/cancellation facts they are entitled to.
3. **Given** another provider, **When** they GET that booking, **Then** the
   API does not disclose it (non-enumerating 404/403 per existing bookings
   privacy pattern).

---

### User Story 3 — Accept confirmed request (Priority: P1)

The selected provider accepts a confirmed standard request before expiry.

**Why this priority**: Core Done When; P17 depends on an accepted booking.
**Independent Test**: Accept moves CONFIRMED → ACCEPTED; replay is
idempotent; wrong provider is denied.
**Acceptance Scenarios**:

1. **Given** CONFIRMED + PENDING + not expired, **When** the selected
   provider accepts with the expected version, **Then** booking is ACCEPTED,
   response is ACCEPTED, history records the transition, and a notification
   intent is stored for the customer.
2. **Given** the same accept command replayed with the same idempotency key
   and body, **When** it is submitted again, **Then** the original accepted
   result is returned and no second history row of the same transition is
   created.
3. **Given** a different provider or a worker, **When** accept is attempted,
   **Then** the booking stays CONFIRMED.

---

### User Story 4 — Reject with reason (Priority: P1)

The selected provider rejects a confirmed request with a seeded reason.

**Why this priority**: Roadmap reject with reason; customers must not wait
on a silent refusal.
**Independent Test**: Reject writes response + cancellation + CANCELLED;
reason required from seed; no fee fields.
**Acceptance Scenarios**:

1. **Given** CONFIRMED + PENDING + not expired, **When** the selected
   provider rejects with a valid provider reject reason, **Then** booking is
   CANCELLED, a `booking_cancellations` row exists, response is REJECTED,
   and no fee amount is stored.
2. **Given** a missing or unknown reason, **When** reject is submitted,
   **Then** validation fails and status is unchanged.
3. **Given** a CANCELLED booking, **When** reject is attempted, **Then** it
   is rejected and state is unchanged.

---

### User Story 5 — Status transition validation (Priority: P1)

Illegal status jumps after confirm are rejected with unchanged state.

**Why this priority**: Roadmap status transition validation; inherits P13
matrix discipline.
**Independent Test**: Seeded rules; illegal from/to rejected; stale version
rejected; expired cannot accept.
**Acceptance Scenarios**:

1. **Given** ACCEPTED, **When** a provider tries to accept or reject again,
   **Then** the API rejects with a stable conflict/transition code and
   status stays ACCEPTED.
2. **Given** CANCELLED, **When** any accept/reject is attempted, **Then** it
   is rejected.
3. **Given** a stale `version`, **When** accept/reject/cancel is attempted,
   **Then** the command fails with no partial writes.

---

### User Story 6 — Response expiry (Priority: P2)

A pending provider response that passes its configured deadline cannot be
accepted and is recorded as expired.

**Why this priority**: Roadmap response expiry; protects customers from
indefinite pending confirms.
**Independent Test**: Clock past `expiresAt`; inbox/accept lazily expires;
accept after expiry fails.
**Acceptance Scenarios**:

1. **Given** PENDING with `expiresAt` in the past, **When** the provider
   tries to accept, **Then** the booking becomes CANCELLED with reason
   `PROVIDER_RESPONSE_EXPIRED` and accept is denied.
2. **Given** the same expired pending row, **When** inbox is listed, **Then**
   the booking is not offered as actionable pending work (it is expired).
3. **Given** missing `commercial.provider_response_hours` for the country,
   **When** a booking would confirm, **Then** confirm fail-closes (no
   CONFIRMED without an expiry).

---

### User Story 7 — Customer cancellation event (Priority: P2)

The owning customer can cancel a CONFIRMED or ACCEPTED booking with a seeded
reason; the event is auditable and charges no invented fee.

**Why this priority**: Roadmap customer cancellation event; OQ-001.
**Independent Test**: Cancel from CONFIRMED writes cancellation + CANCELLED;
draft/awaiting-deposit path still works; no fee field.
**Acceptance Scenarios**:

1. **Given** CONFIRMED owned by the customer, **When** they cancel with a
   valid customer reason and version, **Then** status is CANCELLED, a
   cancellation row exists, and no fee amount is calculated.
2. **Given** ACCEPTED, **When** the owning customer cancels, **Then** the
   same recording rules apply.
3. **Given** another customer, **When** they cancel, **Then** they cannot
   affect the booking.

---

### User Story 8 — Provider cancellation event (Priority: P2)

After accepting, the selected provider can cancel with a seeded reason
before assignment (P17) exists.

**Why this priority**: Roadmap provider cancellation event.
**Independent Test**: Provider cancel from ACCEPTED succeeds; from CONFIRMED
is not this command (use reject); other providers denied.
**Acceptance Scenarios**:

1. **Given** ACCEPTED, **When** the selected provider cancels with a valid
   provider cancel reason, **Then** status is CANCELLED and the cancellation
   actor is the provider.
2. **Given** CONFIRMED (not yet accepted), **When** provider cancel is
   called, **Then** it is rejected (reject is the correct command).
3. **Given** CANCELLED, **When** provider cancel is replayed with the same
   idempotency key, **Then** the original cancellation result is returned.

---

### User Story 9 — Admin cancellation hook (Priority: P2)

A staff admin can cancel a CONFIRMED or ACCEPTED booking with a mandatory
reason; the privileged action is fully audited.

**Why this priority**: Roadmap admin cancellation hook.
**Independent Test**: staff_admin cancel writes privileged history +
cancellation; non-staff denied; reason required.
**Acceptance Scenarios**:

1. **Given** CONFIRMED or ACCEPTED, **When** an active `staff_admin` cancels
   with a staff reason and version, **Then** status is CANCELLED, actor is
   staff, and audit/history include reason.
2. **Given** a non-staff caller, **When** the staff hook is called, **Then**
   it is forbidden.
3. **Given** missing reason, **When** staff cancel is submitted, **Then**
   validation fails and status is unchanged.

---

### User Story 10 — Notification events (Priority: P2)

Each successful accept, reject, expiry, and cancellation stores a durable
notification intent for the counterparties.

**Why this priority**: Roadmap notification events; P23 will deliver later.
**Independent Test**: After accept, a customer-bound intent exists with
idempotency key; duplicate command does not duplicate the intent.
**Acceptance Scenarios**:

1. **Given** a successful accept, **When** the transaction commits, **Then**
   a notification intent exists for the customer with template
   `BOOKING_ACCEPTED` and no plaintext secrets.
2. **Given** reject, expiry, or cancel, **When** committed, **Then** the
   matching template intent exists (`BOOKING_REJECTED`,
   `BOOKING_RESPONSE_EXPIRED`, `BOOKING_CANCELLED`).
3. **Given** intent insert cannot complete, **When** the command runs,
   **Then** booking status is unchanged (same transaction).

### Edge Cases

- Concurrent accept and reject: exactly one terminal response; the other
  command fails with unchanged or already-terminal state, never two winners.
- Confirm replay: pending response row is created at most once per booking.
- Customer cancel after provider already accepted in a race: version/stale
  check prevents split brain; one terminal CANCELLED or ACCEPTED.
- Inbox must not show other providers' bookings or cancelled/expired as
  actionable pending.
- Reject/cancel reasons must be active seeded rows for that actor; inactive
  reasons are rejected.
- No price or deposit mutation on any P16 command.
- Staff cancel of DRAFT/AWAITING_DEPOSIT is out of this hook unless already
  allowed by P13 customer cancel; this hook is CONFIRMED/ACCEPTED only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist `booking_responses`,
  `booking_cancellations`, `cancellation_reasons`,
  `booking_notification_intents`, and `booking_actor_commands` owned
  exclusively by `bookings`.
- **FR-002**: System MUST extend BookingStatus with `ACCEPTED` and MUST
  persist executable transition rules for provider accept, reject-as-cancel,
  expiry-as-cancel, customer cancel from CONFIRMED/ACCEPTED, provider cancel
  from ACCEPTED, and staff cancel from CONFIRMED/ACCEPTED.
- **FR-003**: System MUST create exactly one `PENDING` booking response with
  `expiresAt` when a booking becomes CONFIRMED, using
  `commercial.provider_response_hours` (fail closed if missing).
- **FR-004**: System MUST allow only an active OWNER/ADMIN of
  `booking.providerId` to accept or reject a PENDING non-expired response.
- **FR-005**: System MUST transition `CONFIRMED → ACCEPTED` on accept,
  record the response ACCEPTED, write status history, and store a
  `BOOKING_ACCEPTED` notification intent.
- **FR-006**: System MUST require a seeded provider reject reason, transition
  to CANCELLED, record REJECTED response + cancellation row, and MUST NOT
  store a fee amount.
- **FR-007**: System MUST lazily expire PENDING responses past `expiresAt`
  to CANCELLED with `PROVIDER_RESPONSE_EXPIRED` and MUST deny subsequent
  accept.
- **FR-008**: System MUST record customer, provider, and staff cancellation
  events for the allowed from-statuses with actor, reason, timestamps, and
  history; replay with the same idempotency key MUST be harmless.
- **FR-009**: System MUST reject illegal transitions, unauthorized actors,
  stale versions, and expired/cancelled accepts with unchanged booking
  money fields.
- **FR-010**: System MUST NOT calculate cancellation fees, MUST NOT invent
  deposit fate, MUST NOT create refund_requests, and MUST NOT post REFUND
  journals in this phase (OQ-001).
- **FR-011**: System MUST NOT implement counteroffer or mutate frozen
  booking price on accept/reject/cancel.
- **FR-012**: System MUST write notification intents in the same unit of
  work as the triggering transition and MUST NOT deliver email, SMS, or
  push.
- **FR-013**: System MUST create phase-owned migration
  `r1_p16_provider_booking_response_cancellation_events` and MUST NOT edit
  applied migrations.
- **FR-014**: System MUST publish OpenAPI and Postman artifacts for the P16
  HTTP surface and keep validation green.
- **FR-015**: System MUST NOT implement stored-value wallets, InstaPay
  invention, assignment, order execution, remaining/COD, payouts, Docker, or
  cloud.
- **FR-016**: Bookings public contracts MUST remain the only cross-module
  access path; Payments MUST NOT import bookings repositories.

### Key Entities

- **BookingResponse**: one per booking; PENDING / ACCEPTED / REJECTED /
  EXPIRED; expiry timestamp; actor; idempotency.
- **BookingCancellation**: auditable cancel event with actor kind
  (CUSTOMER / PROVIDER / STAFF_ADMIN / SYSTEM), reason, optional notes
  bound to policy, no fee amount.
- **CancellationReason**: configurable seeded reasons per actor and
  purpose (reject vs cancel), active flag.
- **BookingNotificationIntent**: durable undelivered notice (template,
  locale, recipient, idempotency, safe variables).
- **Booking (existing)**: status extended with ACCEPTED; history reused.

## Success Criteria *(mandatory)*

- **SC-001**: Tests prove only the selected provider's OWNER/ADMIN sees the
  inbox item and can accept or reject.
- **SC-002**: Tests prove accept moves CONFIRMED → ACCEPTED and is
  idempotent.
- **SC-003**: Tests prove reject writes cancellation + CANCELLED with a
  reason and without a fee amount.
- **SC-004**: Tests prove expired pending responses cannot be accepted and
  become CANCELLED with `PROVIDER_RESPONSE_EXPIRED`.
- **SC-005**: Tests prove customer, provider, and staff cancellations from
  allowed statuses are recorded and unauthorized actors cannot cancel.
- **SC-006**: Tests prove illegal transitions and stale versions leave state
  unchanged.
- **SC-007**: Tests prove no fee calculation, refund_request, or REFUND
  journal on P16 commands.
- **SC-008**: Tests prove notification intents are inserted once per
  successful transition and not delivered.
- **SC-009**: Phase coverage meets ≥80% statements / ≥75% branches / ≥80%
  functions / ≥80% lines on phase-owned executable files.
- **SC-010**: Module-boundary review finds no forbidden cross-module
  Prisma/repository imports.
- **SC-011**: OpenAPI and Postman validation pass for P16 endpoints.
- **SC-012**: Clean install + populated P15→P16 upgrade proofs pass on an
  authorized disposable target, or the gate is recorded BLOCKED with the
  exact missing URL — never relabeled PASS.

## Out of Scope

- Stored-value wallets / top-up / transfer (DEC-003)
- Invented InstaPay (OQ-009)
- Cancellation/reschedule fee matrix and deposit fate (OQ-001)
- Coupons (OQ-008)
- Counteroffer or dynamic price
- Worker/team assignment (P17)
- Order execution and completion codes (P18)
- Remaining/COD (P20), payouts (P21)
- Email/SMS/push delivery and admin-editable templates (P23)
- Docker, cloud

## Assumptions

- Standard Browse bookings already have a single selected `providerId` and
  `teamId` from P13; P16 does not introduce multi-provider bidding.
- Vision counteroffer language applies to later marketplace modes, not this
  standard confirmed request.
- P13 customer cancel from DRAFT/AWAITING_DEPOSIT remains; P16 adds
  post-confirm cancellation events on the same customer cancel HTTP where
  practical.
- Egypt is the only seeded country for `commercial.provider_response_hours`
  in this phase (value 24). Business code reads configuration by country.
- `staff_admin` means the existing active Staff Admin principal used in
  prior phases.
- Composition supplies a clock for expiry; tests inject it.

## Verbatim Constraints

- Tables: `booking_responses`, `booking_cancellations`,
  `cancellation_reasons`, `booking_notification_intents`,
  `booking_actor_commands`
- Migration name: `r1_p16_provider_booking_response_cancellation_events`
- Module name: `bookings` (extend existing)
- Public file: `src/modules/bookings/bookings.public.ts`
- Confirm seam: extend `confirmDepositPayment` to create PENDING response
- Config key: `commercial.provider_response_hours` (Egypt 24)
- New status: `ACCEPTED`
- Coverage thresholds: 80 / 75 / 80 / 80
- No fee fields on cancellation rows

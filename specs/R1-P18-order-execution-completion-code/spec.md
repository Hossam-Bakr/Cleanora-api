# Feature Specification: R1-P18 — Order Execution & Client Completion Code

**Feature Branch**: `r1-p18-order-execution-completion-code`
**Created**: 2026-09-14
**Status**: Active — prepared for Codex PM acceptance; not Complete
**Input**: Roadmap §R1-P18; `/work-on-next-phase` activation DEC-100; vision
§8 / §8.2; entity ownership for `orders` tables; R1-P17 ASSIGNED bookings with
ACTIVE assignment; status-machine-draft completion category; OQ-010 order-side
enum freeze.

## Clarifications

### Session 2026-09-14 (MVB — locked holdings; do not re-ask owner)

These holdings are derived from canonical vision/roadmap/architecture and
owner-supplied MVB locks for this preparation pass. Codex PM must accept or
name exceptions before implementation; they are **not** open product questions.

- Q: Which module owns execution? → A: **New** `orders` module. It owns
  `orders`, `order_status_history`, `completion_codes`,
  `completion_code_attempts`, `order_media`, `order_notes`, `order_events`,
  and order-owned notification intents for this phase. No other module may
  import orders Prisma, repositories, or internal schemas. Bookings remains
  source of truth for booking commercial state and ACTIVE assignment; Orders
  reads booking/assignment facts only through named Bookings public
  contracts.
- Q: Tables and migration? → A: Exactly the seven roadmap tables. Migration
  name: `r1_p18_order_execution_completion_code`. Optional
  `order_actor_commands` (or equivalent idempotency table) for idempotent
  provider/worker writes — allowed if needed; not a separate roadmap family.
- Q: Booking vs order status? → A: Booking commercial statuses stay as frozen
  in P13/P17 (`DRAFT | AWAITING_DEPOSIT | CONFIRMED | ACCEPTED | ASSIGNED |
  CANCELLED`). **No** booking `ON_THE_WAY` / `IN_PROGRESS` / `COMPLETED`.
  Fulfillment statuses live only on the order. When an order reaches
  `COMPLETED`, booking status remains `ASSIGNED` in this phase (commercial
  closure / remaining payment is P20). Booking `CANCELLED` must cancel any
  non-terminal order in the same coordination path (Orders public cancel hook
  or Bookings→Orders named contract).
- Q: Order status enum (OQ-010 order-side freeze)? → A: Closed Prisma enum
  `OrderStatus`: `ASSIGNED | ON_THE_WAY | IN_PROGRESS | READY_TO_COMPLETE |
  COMPLETED | CANCELLED`. Executable forward path:
  `ASSIGNED → ON_THE_WAY → IN_PROGRESS → READY_TO_COMPLETE → COMPLETED`.
  Illegal jumps fail closed. `CANCELLED` only from non-terminal states when
  the linked booking cancels (or explicit coordinated cancel). No `FAILED`
  enum in this MVB (EX-01). No separate `PENDING_SCHEDULED` enum — roadmap
  “pending/scheduled” is covered by order `ASSIGNED` waiting for the first
  field transition (EX-02).
- Q: When is the order created? → A: Idempotent `ensureOrderForAssignedBooking`
  inside Orders: requires booking `ASSIGNED`, non-cancelled, exactly one
  ACTIVE assignment, selected provider present. Creates order in
  `OrderStatus.ASSIGNED` with `bookingId` unique (1:1). Called at the start of
  every execution write and on first authorized read that needs an order id.
  Does **not** require editing the P17 assign path (lazy create is enough).
- Q: Who may transition statuses? → A:
  1. **Field actor**: authenticated user who is an ACTIVE assignment member
     for the booking (worker/escort/cleaner on the snapshot) **or** an active
     Provider OWNER/ADMIN of `booking.providerId` (supervisor/admin proxy).
  2. Transitions `ASSIGNED→ON_THE_WAY`, `ON_THE_WAY→IN_PROGRESS`,
     `IN_PROGRESS→READY_TO_COMPLETE` require field actor.
  3. **Complete** (`READY_TO_COMPLETE→COMPLETED`) requires the same field
     actor **plus** a valid completion code (same proof for worker and
     supervisor proxy).
  4. Customers never enter the code to complete; they only receive the code
     delivery intent. Staff may read dossiers/timeline; staff cannot complete
     or force-jump statuses in this phase (EX-03).
- Q: Completion code? → A: On successful transition into `READY_TO_COMPLETE`,
  generate a cryptographically random **six-digit** numeric code, store only
  a one-way **hash** (plus salt/pepper pattern consistent with existing OTP
  hashing if present), set `expiresAt` from country-scoped config
  (`completion_code_ttl_seconds`, default **1800**), `maxAttempts` from
  config (default **5**), `attemptsUsed=0`. Plaintext may leave the process
  only into the notification intent payload for SMS delivery (P23 delivers
  later). Never return the plaintext code on GET APIs. On complete, compare
  using constant-time hash verify; record every attempt in
  `completion_code_attempts` (success/fail, actor, timestamp). Expired or
  exhausted codes reject completion without changing status; regenerating a
  code requires a dedicated resend command that supersedes the prior unused
  code (new hash/TTL/attempts) and emits a new delivery intent.
- Q: SMS? → A: Persist durable `order_notification_intents` (or reuse a shared
  notification-intent pattern owned by Orders) for
  `ORDER_ON_THE_WAY`, `ORDER_READY_TO_COMPLETE` (includes code delivery
  request), `ORDER_COMPLETED`. Recipients: customer (code + status), assigned
  provider OWNER/ADMIN summary as needed. **No** FCM/SMS/email adapter send
  in this phase (P23) — EX-04.
- Q: Media and notes? → A: Optional `order_media` rows reference `media`
  file ids with kind `COMPLETION` (and optionally `PROGRESS`). Visibility:
  uploader (field actor) and provider OWNER/ADMIN always; customer may read
  `COMPLETION` media only after order `COMPLETED`; staff with booking/order
  read permission always; never expose other customers. `order_notes` are
  completion/progress notes by field actors; customer does not write notes in
  this phase; staff read-only.
- Q: Timeline? → A: Append-only `order_status_history` + `order_events` for
  every transition, code issue/resend, code attempt, media attach, note add.
  Customer / provider / worker / staff GET timeline projections must show the
  same chronological facts with role-appropriate redaction (no code
  plaintext, no other users’ PII beyond display-safe names already entitled).
- Q: Required HTTP? → A:
  1. `POST` transition ON_THE_WAY (idempotent)
  2. `POST` transition IN_PROGRESS (idempotent)
  3. `POST` transition READY_TO_COMPLETE (issues code + intent)
  4. `POST` complete with code (idempotent)
  5. `POST` resend completion code (when READY_TO_COMPLETE)
  6. `POST` attach completion media / add note (optional paths)
  7. `GET` order dossier / timeline for customer owner, provider, assigned
     worker, staff
  Mount under `/api/v1/orders/...` (and thin provider/worker aliases only if
  existing routing conventions require — prefer single orders surface).
- Q: Coverage? → A: Phase-owned executable files 80/75/80/80 (statements /
  branches / functions / lines). Include unimported P18 files.
- Q: Out of scope reminders? → A: P19 panic, P20 remaining/COD, P21–P25
  extras, fee invention (OQ-001), wallets, InstaPay invention, coupons, live
  sockets/GPS, P23 delivery, Docker/cloud.

Named exceptions to propose:

- **EX-01**: No `FAILED` order status in this MVB (defer unrecoverable
  failure modeling).
- **EX-02**: No separate `PENDING_SCHEDULED` status; `ASSIGNED` covers
  waiting-for-field-start.
- **EX-03**: No staff privileged force-complete or force-jump in this phase
  (read-only staff timeline/dossier).
- **EX-04**: Notification **intents** only; no SMS/FCM/email delivery (P23).

## Definition of Done (explicit)

1. All in-scope FR/US/SC below are implemented with tests.
2. Illegal status jumps fail closed; valid path works end-to-end.
3. Order cannot reach `COMPLETED` without a valid unexpired code under
   attempt limits; worker and supervisor proxy share the same proof rules.
4. Completion media visibility matches the rules above.
5. Timeline is consistent across entitled actors (redacted, not divergent).
6. Migration `r1_p18_order_execution_completion_code` reviewed + live clean
   install and populated upgrade proofs on a disposable DB.
7. OpenAPI + Postman for new HTTP; phase + global gates pass.
8. Codex prep-accept + final review PASS (or owner substitution); no
   unresolved BLOCKER/MAJOR.
9. READY_FOR_OWNER_REVIEW recorded; no mark-complete / no git publish by this
   workflow.

## User Scenarios & Testing

### US1 — Create operational order from ASSIGNED booking

**Priority**: P1
A field actor (or authorized read) triggers ensure-order; system creates one
order in `ASSIGNED` linked 1:1 to the booking with ACTIVE assignment.

**Acceptance**:
1. Given booking ASSIGNED + ACTIVE assignment, when ensure-order runs, then
   exactly one order exists with status ASSIGNED.
2. Given booking not ASSIGNED or cancelled or missing ACTIVE assignment, when
   ensure-order runs, then reject without creating an order.
3. Given an order already exists, when ensure-order runs again, then return
   the same order (idempotent).

### US2 — Controlled forward transitions

**Priority**: P1
Field actors move ASSIGNED → ON_THE_WAY → IN_PROGRESS → READY_TO_COMPLETE.

**Acceptance**:
1. Each legal step succeeds once and writes status history + event.
2. Skipping a step (e.g. ASSIGNED → IN_PROGRESS) fails closed.
3. Unauthorized actors (other provider, non-member worker, customer write)
   receive 403/404 per policy.

### US3 — Completion code issue and SMS intent

**Priority**: P1
Entering READY_TO_COMPLETE issues a six-digit code (hashed) and an SMS
delivery intent to the customer.

**Acceptance**:
1. Plaintext never appears on GET responses.
2. Intent row exists with template key for completion-code delivery.
3. TTL and maxAttempts come from config defaults when unset.

### US4 — Complete only with valid code

**Priority**: P1
Worker or supervisor proxy submits the code to complete.

**Acceptance**:
1. Correct unexpired code → COMPLETED + history + ORDER_COMPLETED intent.
2. Wrong code → attempt recorded, status unchanged; after maxAttempts further
   tries rejected until resend.
3. Expired code → reject without COMPLETED.
4. Supervisor proxy uses the same verify path as worker (no bypass).

### US5 — Resend code

**Priority**: P2
While READY_TO_COMPLETE, field actor can resend; prior unused code is
superseded.

**Acceptance**:
1. New hash/TTL/attempts; new delivery intent.
2. Old code no longer verifies.

### US6 — Optional media and notes

**Priority**: P2
Field actor attaches completion media and notes.

**Acceptance**:
1. Customer cannot read COMPLETION media before COMPLETED.
2. After COMPLETED, customer can read COMPLETION media.
3. Staff/provider entitled reads succeed.

### US7 — Shared timeline

**Priority**: P1
All entitled actors see a consistent chronological timeline.

**Acceptance**:
1. Same event sequence for customer/provider/worker/staff projections.
2. Code plaintext absent from all projections.

### US8 — Booking cancel coordinates order cancel

**Priority**: P1
Cancelling the booking cancels a non-terminal order.

**Acceptance**:
1. Order becomes CANCELLED with history; no fee invention.
2. Terminal COMPLETED order is not rewritten by a late booking cancel attempt
   (booking cancel already blocked or order remains COMPLETED — fail closed
   consistently with Bookings cancel rules).

### US9 — Idempotent writes

**Priority**: P1
Retry of the same actor command with the same idempotency key returns the
original success without double-transition.

## Functional Requirements

- **FR-001**: System MUST introduce module `orders` owning the seven roadmap
  tables and phase notification intents.
- **FR-002**: System MUST freeze `OrderStatus` as listed in Clarifications.
- **FR-003**: System MUST create at most one order per booking (unique
  `bookingId`) via idempotent ensure-order from ASSIGNED + ACTIVE assignment.
- **FR-004**: System MUST enforce the executable transition matrix and reject
  illegal jumps.
- **FR-005**: System MUST authorize field transitions to ACTIVE assignment
  members or provider OWNER/ADMIN of the selected provider.
- **FR-006**: System MUST issue hashed six-digit completion codes with TTL and
  max attempts on READY_TO_COMPLETE.
- **FR-007**: System MUST require valid code proof for COMPLETED; record all
  attempts.
- **FR-008**: Supervisor proxy MUST use the same code proof rules as workers.
- **FR-009**: System MUST persist notification intents for on-the-way,
  ready-to-complete/code delivery, and completed (no delivery adapters).
- **FR-010**: System MUST support optional completion media with visibility
  rules and completion notes.
- **FR-011**: System MUST expose a consistent timeline projection.
- **FR-012**: System MUST cancel non-terminal orders when the linked booking
  is cancelled, without inventing fees.
- **FR-013**: Execution writes MUST be idempotent under actor command keys.
- **FR-014**: HTTP contracts MUST be documented in OpenAPI and Postman.
- **FR-015**: Migration `r1_p18_order_execution_completion_code` MUST be
  reviewed and proven on disposable DB (clean + upgrade).
- **FR-016**: Orders MUST NOT open Bookings/Providers/Payments Prisma; only
  named public contracts.
- **FR-017**: No live socket status push and no GPS/location fields.

## Success Criteria

- **SC-001**: Illegal status jump tests fail closed (100% of matrix negatives
  covered for the frozen enum).
- **SC-002**: Completion without valid code is impossible in automated tests.
- **SC-003**: Supervisor and worker completion both require code proof.
- **SC-004**: Media visibility tests cover pre/post COMPLETED customer access.
- **SC-005**: Timeline projections agree on event order for dual-actor reads.
- **SC-006**: Phase coverage ≥ 80/75/80/80 on phase-owned files.
- **SC-007**: OpenAPI + Postman validate for P18 endpoints.
- **SC-008**: Migration clean install + populated upgrade PASS.
- **SC-009**: Module-boundary tests prevent foreign Prisma imports.
- **SC-010**: Codex prep-accept + final review with no unresolved
  BLOCKER/MAJOR (or recorded owner substitution).

## Key Entities

- **Order**: 1:1 with booking; status; provider/customer refs as denormalized
  safe ids; timestamps.
- **OrderStatusHistory**: append-only transitions.
- **CompletionCode**: hash, salt, expiresAt, maxAttempts, attemptsUsed,
  status ACTIVE/SUPERSEDED/CONSUMED.
- **CompletionCodeAttempt**: per verify try.
- **OrderMedia / OrderNote / OrderEvent**: evidence and timeline.
- **OrderNotificationIntent / OrderActorCommand**: delivery request +
  idempotency (names may align with bookings patterns).

## Edge Cases

- Double-submit complete with same key → one COMPLETED.
- Complete after cancel → reject.
- Resend after CONSUMED code → reject.
- Worker removed from ACTIVE assignment mid-order → deny further writes
  (membership checked at write time).
- Clock skew: TTL uses server clock only.

# Feature Specification: R1-P17 — Worker & Team Assignment

**Feature Branch**: `r1-p17-worker-team-assignment`
**Created**: 2026-09-14
**Status**: Active — prepared for Codex PM acceptance; not Complete
**Input**: Roadmap §R1-P17; `/work-on-next-phase` activation DEC-098; vision
§8.1; entity ownership for `booking_assignments`,
`booking_assignment_members`, `booking_assignment_history`; P07 crew/`cleans`
rules; R1-P16 `ACCEPTED` bookings; Providers public workforce/availability
readers.

## Clarifications

### Session 2026-09-14 (MVB — locked holdings; do not re-ask owner)

These holdings are derived from canonical vision/roadmap/architecture and
owner-supplied MVB locks for this preparation pass. Codex PM must accept or
name exceptions before implementation; they are **not** open product questions.

- Q: Which module owns assignment? → A: **Extend** the existing `bookings`
  module. It owns `booking_assignments`, `booking_assignment_members`,
  `booking_assignment_history`, and any booking-owned notification intents for
  this phase. No other module may import bookings Prisma, repositories, or
  internal schemas. Providers remains the source of truth for workers/teams;
  Bookings reads only through named Providers public contracts.
- Q: Tables and migration? → A: Exactly the three roadmap tables. Migration
  name: `r1_p17_worker_team_assignment`. Optional `booking_actor_commands`
  extension (new command types) for idempotent provider assignment writes —
  not a new table family.
- Q: Statuses? → A: Extend BookingStatus with **`ASSIGNED`**. Executable set
  after P17: `DRAFT | AWAITING_DEPOSIT | CONFIRMED | ACCEPTED | ASSIGNED |
  CANCELLED`. First successful assign is `ACCEPTED → ASSIGNED`. Replace while
  already `ASSIGNED` stays `ASSIGNED` (history row written). No
  `ON_THE_WAY` / `IN_PROGRESS` / `COMPLETED` in this phase (P18).
- Q: When may assign/replace run? → A: Only while booking status is
  `ACCEPTED` or `ASSIGNED`, selected provider matches, and the booking is not
  cancelled. Deny assign from `CONFIRMED` (must accept first), drafts, or
  cancelled. Cancel from `ASSIGNED` keeps P16 cancel paths (customer /
  provider / staff) and leaves assignment rows as historical evidence (do not
  hard-delete).
- Q: Who may assign? → A: Only an **active Provider OWNER or ADMIN** of the
  **selected** `booking.providerId`. Workers, supervisors, customers, other
  providers, and staff cannot create/replace assignments in this phase. Staff
  may read dossiers including assignment facts.
- Q: Assign modes? → A: Three provider commands:
  1. **Assign existing team** — `teamId` must equal `booking.teamId` (the
     Browse-selected team) **or** be an active team of the same provider when
     replace is allowed; MVB lock: **primary path uses `booking.teamId` only**
     (EX-01 named below forbids arbitrary team switching to a different
     Browse alternative). Snapshot current active memberships with `cleans`.
  2. **Assign workers** — one or more worker IDs owned by the provider;
     builds an ad-hoc assignment without requiring a team row (teamId null on
     assignment; booking.teamId unchanged).
  3. **Replace** — same two bodies with replace semantics: supersede current
     ACTIVE assignment, append history, create new ACTIVE assignment.
- Q: Composition rules? → A: Snapshot every member at assign time with
  `workerId`, `workerType`, `gender`, `cleans`, display-safe name fields.
  Require ≥1 member with `cleans=true`. Escort (`workerType=ESCORT`) MUST have
  `cleans=false` (reject otherwise). `OTHER` workers may be included only with
  `cleans=false`. Cleaning members (`cleans=true`) must be `CLEANING_STAFF`
  and ACTIVE. Duplicate worker IDs in one assignment are rejected.
- Q: Crew preference? → A: Evaluate **only cleans=true members' gender**
  against `booking.crewPreference` using the same rule as eligibility
  (`ALL_MALE` / `ALL_FEMALE` / `ANY`). Escort gender never fails crew match.
  `other_or_unspecified` cleaner gender fails gendered preferences.
- Q: Ownership / active checks? → A: Every worker must belong to
  `booking.providerId`, be ACTIVE, profile-complete for cleaners, and
  identity/role enabled as Providers already defines for qualifying workers.
  Team assign requires team ACTIVE for that provider and current memberships
  only.
- Q: Schedule / conflict checks? → A: For each assigned worker, Providers
  public availability must confirm the booking `[startsAt, endsAt)` is fully
  covered by that worker's calendar (provider calendar alone is not enough for
  named workers). Reject if any assigned worker already has an ACTIVE
  assignment on another non-cancelled booking whose time window overlaps.
  Capacity: ad-hoc worker assign must include enough cleans=true members to
  satisfy `booking.requiredTeamUnits` when that field is ≥1 (each cleans=true
  cleaner counts as one unit); team assign inherits team structural validity
  (≥1 cleaner) and does not re-run marketplace capacity quotas.
- Q: History? → A: Exactly one ACTIVE assignment per booking. On replace,
  prior assignment becomes SUPERSEDED; append `booking_assignment_history`
  with actor, reason code, before/after safe JSON, timestamps. Never delete
  prior members rows (members stay attached to their assignment id).
- Q: Worker order visibility? → A: Authenticated worker with ACTIVE workforce
  membership for the provider may `GET` a list of bookings where they are an
  ACTIVE assignment member (safe projection: booking id, status, schedule
  window, service label from snapshot, address city/district labels already
  entitled post-confirm — no payment secrets, no other workers' PII beyond
  co-member display names on the same assignment).
- Q: Notification events? → A: Insert durable `booking_notification_intents`
  for `BOOKING_ASSIGNED` and `BOOKING_ASSIGNMENT_REPLACED` in the same unit of
  work (recipients: customer + assigned worker user ids when known). No
  FCM/SMS/email delivery (P23).
- Q: Required HTTP? → A:
  1. `POST` provider assign-team (idempotent)
  2. `POST` provider assign-workers (idempotent)
  3. `POST` provider replace-team / replace-workers (or same paths with
     `mode=replace` — pick one shape in plan; both behaviors required)
  4. `GET` current assignment for provider / customer owner / staff
  5. `GET` assignment history for provider / staff
  6. `GET` worker my-assignments (order visibility)
  Extend existing provider/customer/staff booking dossier reads to include
  current assignment summary.
- Q: Coverage? → A: Phase-owned executable files 80/75/80/80 (statements /
  branches / functions / lines). Include unimported P17 files.
- Q: Out of scope reminders? → A: P18 execution/completion, P19 panic, P20
  remaining/COD, fee invention (OQ-001), wallets, InstaPay invention, coupons,
  P23 delivery, Docker/cloud.

Named exceptions to propose:

- **EX-01**: Team assign/replace is limited to `booking.teamId` (the
  Browse-selected team). Switching to a different provider team is out of
  scope for this MVB (avoids reopening eligibility alternatives).
- **EX-02**: Notification **intents** only; no FCM/SMS/email delivery (P23).
- **EX-03**: No staff/admin reassignment command in this phase (read-only for
  staff). Provider OWNER/ADMIN remain the only writers.

## Definition of Done (explicit)

1. `bookings` owns the three roadmap tables; public contracts and HTTP are
   documented and tested.
2. Only the selected provider's active OWNER/ADMIN can assign or replace.
3. Crew preference, escort/`cleans`, ownership, active, schedule, and overlap
   conflicts are enforced; invalid compositions are blocked.
4. Historical assignments are preserved on replace; one ACTIVE assignment per
   booking.
5. Workers can list bookings where they are ACTIVE assignment members.
6. Status `ASSIGNED` exists; first assign is `ACCEPTED → ASSIGNED`.
7. OpenAPI + Postman for P17 HTTP; migration reviewed and proven.
8. Phase coverage ≥ 80/75/80/80; Codex prep-accept + final review PASS with no
   unresolved BLOCKER/MAJOR.
9. READY_FOR_OWNER_REVIEW recorded; no mark-complete; no Git publication.

## User Scenarios & Testing

### User Story 1 — Assign selected team (Priority: P1)

Provider OWNER/ADMIN assigns the Browse-selected team to an ACCEPTED booking.

**Acceptance Scenarios**:

1. **Given** an ACCEPTED booking for provider P with `teamId=T`, **When** an
   active OWNER of P posts assign-team for T, **Then** status becomes
   ASSIGNED, one ACTIVE assignment exists with memberships snapshotted
   including `cleans`, and history has the create event.
2. **Given** the same booking, **When** another provider's OWNER tries to
   assign, **Then** the command is denied.
3. **Given** team T has no cleans=true member, **When** assign-team runs,
   **Then** the command is rejected and status stays ACCEPTED.

### User Story 2 — Assign workers (Priority: P1)

Provider assigns one or more eligible workers without requiring a team row on
the assignment.

**Acceptance Scenarios**:

1. **Given** ACCEPTED booking and workers W1,W2 owned by P (cleans valid),
   **When** assign-workers succeeds, **Then** ACTIVE assignment lists both
   with snapshotted `cleans` and status is ASSIGNED.
2. **Given** a worker from another provider, **When** included, **Then**
   reject the whole command.
3. **Given** an ESCORT with cleans=true requested, **When** assign runs,
   **Then** reject with escort-cannot-clean semantics.

### User Story 3 — Crew preference enforcement (Priority: P1)

**Acceptance Scenarios**:

1. **Given** `crewPreference=ALL_FEMALE` and a male cleaner in the set,
   **When** assign runs, **Then** reject with crew mismatch.
2. **Given** `ALL_FEMALE` with female cleaners and a male escort
   (cleans=false), **When** assign runs, **Then** accept.
3. **Given** `ANY`, **When** gendered mix of cleaners, **Then** accept if
   other composition rules pass.

### User Story 4 — Schedule and overlap conflict (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a worker whose calendar does not cover the booking window,
   **When** assign includes that worker, **Then** reject.
2. **Given** the same worker ACTIVE on overlapping booking B2, **When**
   assign to B1, **Then** reject as conflict.
3. **Given** non-overlapping prior assignment, **When** assign, **Then**
   allow.

### User Story 5 — Replace assignment (Priority: P1)

**Acceptance Scenarios**:

1. **Given** ASSIGNED booking with ACTIVE assignment A1, **When** replace
   with a valid new set, **Then** A1 is SUPERSEDED, history records the
   change, A2 is ACTIVE, status remains ASSIGNED.
2. **Given** CANCELLED booking, **When** replace attempted, **Then** deny.
3. **Given** CONFIRMED (not yet ACCEPTED), **When** assign attempted,
   **Then** deny.

### User Story 6 — Worker order visibility (Priority: P2)

**Acceptance Scenarios**:

1. **Given** worker W is an ACTIVE member on booking B, **When** W lists
   my-assignments, **Then** B appears with safe fields only.
2. **Given** worker W is not on any ACTIVE assignment, **When** lists,
   **Then** empty list.
3. **Given** another worker X, **When** X requests W's list, **Then** deny
   (actors see only self).

### User Story 7 — Dossier / history reads (Priority: P2)

**Acceptance Scenarios**:

1. **Given** ASSIGNED booking, **When** provider/customer/staff GET dossier,
   **Then** current assignment summary is present.
2. **Given** two replacements, **When** provider GET history, **Then**
   ordered history entries exist without deleting member rows.

### User Story 8 — Idempotency (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a successful assign with Idempotency-Key K, **When** replayed
   with same fingerprint, **Then** return the same result without duplicating
   ACTIVE assignments.
2. **Given** same key with different body, **Then** conflict/reject stably.

### User Story 9 — Notification intents (Priority: P2)

**Acceptance Scenarios**:

1. **Given** successful assign, **When** transaction commits, **Then**
   BOOKING_ASSIGNED intents exist for customer and assigned workers (when
   user ids known); no delivery adapter invoked.
2. **Given** replace, **Then** BOOKING_ASSIGNMENT_REPLACED intents are
   written once per successful command (idempotent replay does not
   duplicate).

## Edge Cases

- Booking version mismatch (optimistic concurrency) rejects without partial
  writes.
- Soft-deleted / inactive team memberships are not snapshotted.
- Worker becomes inactive after assignment: current ACTIVE assignment remains
  until replace/cancel; visibility still lists it (P18 may later block start).
- Cancel after ASSIGNED: status CANCELLED via P16 paths; assignment rows
  retained; worker list excludes cancelled bookings.
- requiredTeamUnits > cleans=true count on ad-hoc assign → reject.
- Empty worker list → reject.

## Requirements

### Functional Requirements

- **FR-001**: Bookings MUST own `booking_assignments`,
  `booking_assignment_members`, and `booking_assignment_history`.
- **FR-002**: BookingStatus MUST include `ASSIGNED`; first assign transitions
  `ACCEPTED → ASSIGNED` under persisted status_transition_rules.
- **FR-003**: Only active OWNER/ADMIN of `booking.providerId` MAY create or
  replace assignments.
- **FR-004**: Assign-team MUST snapshot the selected team's current active
  members with `cleans` (EX-01: `booking.teamId` only).
- **FR-005**: Assign-workers MUST accept one or more provider-owned worker
  ids and snapshot each member with `cleans`.
- **FR-006**: Composition MUST require ≥1 cleans=true cleaner; escorts MUST
  have cleans=false; reject invalid types.
- **FR-007**: Crew preference MUST be enforced on cleans=true genders only.
- **FR-008**: Schedule coverage and ACTIVE overlapping-assignment conflicts
  MUST block invalid assigns.
- **FR-009**: Exactly one ACTIVE assignment per booking; replace MUST
  supersede and append history without deleting prior rows.
- **FR-010**: Workers MUST be able to list bookings where they are ACTIVE
  assignment members (safe projection).
- **FR-011**: Dossier reads for provider/customer/staff MUST include current
  assignment summary when present.
- **FR-012**: Assign/replace MUST be idempotent via booking actor commands.
- **FR-013**: Notification intents BOOKING_ASSIGNED /
  BOOKING_ASSIGNMENT_REPLACED MUST be written in-transaction; no delivery.
- **FR-014**: OpenAPI + Postman MUST cover all new/changed P17 HTTP endpoints.
- **FR-015**: Migration `r1_p17_worker_team_assignment` MUST be reviewed and
  proven (clean install + upgrade from P16).
- **FR-016**: Bookings MUST NOT import Providers Prisma; only public readers
  injected at composition.
- **FR-017**: No fee, wallet, order-execution, panic, or remaining-payment
  behavior in this phase.

### Success Criteria

- **SC-001**: Unauthorized actors cannot assign (selected-provider only).
- **SC-002**: Invalid crew / escort / schedule / overlap compositions are
  blocked with stable error codes.
- **SC-003**: Replace preserves history and never leaves two ACTIVE rows.
- **SC-004**: Worker my-assignments returns only the caller's ACTIVE
  memberships.
- **SC-005**: Phase coverage ≥ 80/75/80/80 on phase-owned files.
- **SC-006**: OpenAPI/Postman/docs gates pass for P17 artifacts.
- **SC-007**: Live migration clean + P16→P17 upgrade proofs pass on a
  disposable database.
- **SC-008**: Codex prep-accept authorizes implementation; final review has
  no unresolved BLOCKER/MAJOR.
- **SC-009**: Boundary tests prove no payments/ledger/fee writes from P17
  assign paths.

## Verbatim Constraints

- Module: `bookings` (extend)
- Tables: `booking_assignments`, `booking_assignment_members`,
  `booking_assignment_history`
- Migration folder: `r1_p17_worker_team_assignment`
- New status: `ASSIGNED`
- Coverage: 80 / 75 / 80 / 80
- Providers contracts: extend/reuse `ProviderWorkforcePublicReader` and
  availability coverage reader as needed; no cross-Prisma
- EX-01 / EX-02 / EX-03 as named above

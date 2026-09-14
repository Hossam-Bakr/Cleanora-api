# Data Model — R1-P17 Worker & Team Assignment

Prisma models are added only by this phase in `prisma/schema.prisma`.
Booking ids are Restrict FKs. Do not cascade-delete assignment history.

Migration folder name: `r1_p17_worker_team_assignment`.

## Enums (extend / add)

```text
BookingStatus (extend):
  DRAFT
  | AWAITING_DEPOSIT
  | CONFIRMED
  | ACCEPTED
  | ASSIGNED            # new
  | CANCELLED

BookingAssignmentStatus:
  ACTIVE
  | SUPERSEDED

BookingAssignmentSource:
  TEAM
  | WORKERS

BookingAssignmentHistoryEvent:
  CREATED
  | REPLACED
  | SUPERSEDED

BookingActorCommandType (extend):
  ...existing P16...
  | ASSIGN_TEAM
  | ASSIGN_WORKERS
  | REPLACE_TEAM
  | REPLACE_WORKERS

BookingNotificationTemplate (extend):
  ...existing P16...
  | BOOKING_ASSIGNED
  | BOOKING_ASSIGNMENT_REPLACED
```

Gender / workerType on member snapshots are stored as constrained strings
matching Providers public facts (`male`|`female`|`other_or_unspecified`;
`CLEANING_STAFF`|`ESCORT`|`OTHER`).

## Tables

### booking_assignments

Current and superseded assignment headers. Exactly one `ACTIVE` row per
booking (enforced by partial unique index in SQL).

- id (cuid)
- bookingId (FK bookings, Restrict)
- providerId (string; denormalized from booking for query locality)
- status (BookingAssignmentStatus)
- source (BookingAssignmentSource)
- teamId (nullable string; required when source=TEAM; must equal
  booking.teamId under EX-01)
- teamVersion (nullable int; snapshot of team version when source=TEAM)
- startsAt / endsAt (copy of booking window at assign time for conflict
  queries)
- assignedByUserId (actor)
- version (int; assignment aggregate version)
- createdAt / updatedAt
- supersededAt (nullable)
- indexes: (bookingId, status), (providerId, status, startsAt, endsAt),
  (status, startsAt, endsAt) for overlap scans
- partial unique: one ACTIVE per bookingId

### booking_assignment_members

Immutable member rows for an assignment (never updated in place).

- id (cuid)
- assignmentId (FK booking_assignments, Restrict)
- workerId (string)
- workerUserId (nullable string; identity for visibility/notifications)
- workerType (`CLEANING_STAFF`|`ESCORT`|`OTHER`)
- gender (`male`|`female`|`other_or_unspecified`)
- cleans (boolean)
- displayNameEn / displayNameAr (safe snapshot strings, varchar)
- sortOrder (int)
- createdAt
- unique (assignmentId, workerId)
- index (workerId, assignmentId)
- index (workerUserId, assignmentId)

### booking_assignment_history

Append-only history.

- id (cuid)
- bookingId
- assignmentId (the assignment that was created or superseded)
- event (BookingAssignmentHistoryEvent)
- actorUserId
- reasonCode (varchar; e.g. `INITIAL_ASSIGN`, `PROVIDER_REPLACE`)
- reasonText (nullable)
- safeBefore / safeAfter (Json)
- requestId
- idempotencyKey / operationKey patterns consistent with bookings
- createdAt
- indexes: (bookingId, createdAt), (assignmentId, createdAt)

## Status transition seed rows (new)

| Actor | From | To | Category |
|---|---|---|---|
| PROVIDER | ACCEPTED | ASSIGNED | NORMAL |

P16 cancel rows from ACCEPTED remain. Add:

| Actor | From | To | Category |
|---|---|---|---|
| CUSTOMER | ASSIGNED | CANCELLED | CANCELLATION |
| PROVIDER | ASSIGNED | CANCELLED | CANCELLATION |
| STAFF_ADMIN | ASSIGNED | CANCELLED | PRIVILEGED_OVERRIDE |

## Conflict detection note

Overlap uses ACTIVE assignments where
`startsAt < other.endsAt AND endsAt > other.startsAt` and booking status not
CANCELLED. Implementation may join bookings.status or denormalize a
cancelled flag — prefer join to bookings to avoid dual-write.

## Providers public extensions (composition-owned)

Bookings needs (if not already sufficient):

- Resolve worker eligibility facts by ids for a provider (status, type,
  gender, userId, profileComplete)
- Resolve team memberships for `booking.teamId` (existing
  `getBookingSafeTeamFacts`)
- Worker calendar coverage for `[startsAt, endsAt)` per workerId

Any new reader methods live on `providers.public` and are implemented inside
Providers; Bookings only consumes the injected port.

# Data Model — R1-P16 Provider Booking Response & Cancellation Events

Prisma models are added only by this phase in `prisma/schema.prisma`.
Booking ids are Restrict FKs. Do not cascade-delete response or
cancellation history.

Migration folder name: `r1_p16_provider_booking_response_cancellation_events`.

## Enums (extend / add)

```text
BookingStatus (extend):
  DRAFT
  | AWAITING_DEPOSIT
  | CONFIRMED
  | ACCEPTED          # new
  | CANCELLED

StatusTransitionActor (extend):
  CUSTOMER
  | SYSTEM
  | STAFF_ADMIN
  | PROVIDER          # new

BookingResponseStatus:
  PENDING
  | ACCEPTED
  | REJECTED
  | EXPIRED

BookingCancellationActor:
  CUSTOMER
  | PROVIDER
  | STAFF_ADMIN
  | SYSTEM

BookingNotificationTemplate:
  BOOKING_CONFIRMED_FOR_PROVIDER
  | BOOKING_ACCEPTED
  | BOOKING_REJECTED
  | BOOKING_RESPONSE_EXPIRED
  | BOOKING_CANCELLED

BookingNotificationIntentStatus:
  PENDING             # stored only; P23 may later lease
```

Existing `BookingCancelReason` enum may remain for P13 draft cancel bodies.
P16 reasons live in `cancellation_reasons` (table), not a frozen Prisma enum
of fee codes.

## Tables

### cancellation_reasons

Configurable seeded reasons.

- id (cuid)
- code (stable string, unique)
- actor (BookingCancellationActor) — who may use it
- purpose (`REJECT` | `CANCEL`)
- locale labels AR/EN (or existing localization pattern)
- active (boolean)
- sortOrder (int)
- createdAt / updatedAt
- unique (code)
- index (actor, purpose, active)

Egypt/global seed (minimum):

- PROVIDER / REJECT: `PROVIDER_CANNOT_FULFILL`, `PROVIDER_SCHEDULE_CONFLICT`, `OTHER`
- PROVIDER / CANCEL: `PROVIDER_UNABLE_TO_CONTINUE`, `OTHER`
- CUSTOMER / CANCEL: reuse P13 codes `CUSTOMER_CHANGED_MIND`, `CUSTOMER_WRONG_DETAILS`, `OTHER` as active rows
- STAFF_ADMIN / CANCEL: `STAFF_OPS_CANCEL`, `OTHER`
- SYSTEM / CANCEL: `PROVIDER_RESPONSE_EXPIRED` (active, not offered on HTTP reject/cancel forms)

### booking_responses

Exactly one per booking.

- id (cuid)
- bookingId (unique FK Booking Restrict)
- providerId (logical; must match booking.providerId)
- status (BookingResponseStatus)
- expiresAt (DateTime)
- decidedAt (DateTime?)
- decidedByUserId (User? Restrict)
- rejectReasonId (FK cancellation_reasons?)
- idempotencyKey (string?)
- createdAt / updatedAt
- unique (bookingId)
- index (providerId, status, expiresAt)

### booking_cancellations

Append-oriented cancellation event. At most one successful cancellation per
booking (unique bookingId). Replays return the existing row.

- id (cuid)
- bookingId (unique FK Booking Restrict)
- actorKind (BookingCancellationActor)
- actorUserId (User? Restrict; null for SYSTEM)
- reasonId (FK cancellation_reasons Restrict)
- fromStatus (string)
- notes (optional short safe text; no fee fields)
- createdAt
- unique (bookingId)
- index (actorKind, createdAt)

**Forbidden columns**: feeAmount, feeMinorUnits, depositFate, refundAmount.

### booking_notification_intents

Durable undelivered events.

- id (cuid)
- bookingId (FK Booking Restrict)
- template (BookingNotificationTemplate)
- locale (AR | EN)
- recipientUserId (User Restrict)
- idempotencyKey (unique)
- safeVariables (Json)
- status (PENDING)
- createdAt
- unique (idempotencyKey)
- index (bookingId, template)

## Booking / rules / commands extensions

- `Booking.status` includes ACCEPTED.
- `status_transition_rules` seed the new executable rows from the plan
  matrix; `executable=true` only for those rows.
- Customer `booking_commands` stays customer-scoped. Do not overload it.

### booking_actor_commands (required)

Provider and staff idempotency. Not a roadmap product entity; required
because `booking_commands` is unique on `(customerUserId, commandType,
idempotencyKey)`.

- id (cuid)
- actorUserId (User Restrict)
- commandType (`ACCEPT` | `REJECT` | `PROVIDER_CANCEL` | `STAFF_CANCEL`)
- idempotencyKey
- bookingId (FK Booking Restrict)
- requestHash
- responseJson
- createdAt
- unique (actorUserId, commandType, idempotencyKey)
- index (bookingId)

## Configuration seed

`app_configs` / country config: `commercial.provider_response_hours` = `24`
for Egypt only, mirroring `commercial.deposit_percent` pattern.

## Indexes / integrity

- Unique bookingId on responses and cancellations (one pending/terminal
  response; one cancellation).
- Reject reason FK must have purpose REJECT and actor PROVIDER when used
  on reject.
- Cancel reason FK must match actorKind and purpose CANCEL (SYSTEM expiry
  uses `PROVIDER_RESPONSE_EXPIRED`).

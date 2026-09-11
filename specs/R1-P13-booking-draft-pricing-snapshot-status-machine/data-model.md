# Data Model — R1-P13 Booking Draft

Prisma models are added only by this phase in `prisma/schema.prisma`.
Cross-module ids: `userId` FK to `User`; `countryId` FK to `Country`;
provider/team/catalog/media/address-source ids are logical references
(Restrict semantics in application code; no cascade delete of history).

## Enums

```text
BookingStatus: DRAFT | AWAITING_DEPOSIT | CONFIRMED | CANCELLED
BookingCommandType: CREATE | SUBMIT_FOR_DEPOSIT | CANCEL | ATTACH_MEDIA
BookingCancelReason: CUSTOMER_CHANGED_MIND | CUSTOMER_WRONG_DETAILS | OTHER
StatusTransitionCategory: NORMAL | CANCELLATION | FAILURE | PRIVILEGED_OVERRIDE | COMPLETION | EMERGENCY_RELATED
CrewPreference: reuse eligibility strings all_male | all_female | any (store as text enum BookingCrewPreference)
```

## Tables

### bookings

- id (cuid)
- customerUserId
- countryId, currencyCode, currencyDecimalPlaces
- status: BookingStatus
- path: `BROWSE` (closed; no recommended)
- serviceId, providerId, teamId (logical)
- startsAt, endsAt (timestamptz, half-open)
- crewPreference
- requiredTeamUnits int 1–50
- locale AR|EN
- notes (optional, max 2000)
- emergencySignaled boolean default false
- grossMinorUnits, depositMinorUnits, remainderMinorUnits (nullable until first quote)
- depositPercent (canonical decimal string, e.g. "25.00")
- eligibilityEvaluationId (logical, optional audit)
- version int
- submittedAt, cancelledAt nullable
- createdAt, updatedAt
- unique (id)
- indexes: (customerUserId, createdAt), (status, createdAt)

### booking_items

- id, bookingId unique-for-mvb-single-item
- catalogServiceId, catalogServiceCode, catalogServiceVersion
- providerServiceId, providerServiceVersion
- providerServicePriceId
- estimatedDurationMinutes
- createdAt

### booking_answers

- id, bookingId, fieldId, fieldCode, kind, valueJson, createdAt
- unique (bookingId, fieldId)

### booking_addresses

- id, bookingId unique
- sourceUserAddressId (logical)
- countryCode, cityId, districtId nullable, cityLabel, districtLabel,
  addressText, building, floor, notes
- createdAt

### booking_media

- id, bookingId, mediaId (logical), displayOrder
- createdAt
- unique (bookingId, mediaId)

### booking_snapshots

- id, bookingId unique at freeze
- catalogSnapshotJson, providerSnapshotJson
- catalogHash, providerHash, priceInputHash
- frozenAt
- createdAt only (immutable)

### booking_price_breakdowns

- id, bookingId unique at freeze
- currencyCode, decimalPlaces
- grossMinorUnits, depositMinorUnits, remainderMinorUnits
- depositPercent
- formulaVersion (e.g. `r1-p13-v1`)
- createdAt only (immutable)

### booking_status_history

- id, bookingId, fromStatus, toStatus, actorUserId, actorType
- reasonCode nullable, requestId nullable, note nullable
- createdAt only
- index (bookingId, createdAt)

### status_transition_rules

- id, actor (`CUSTOMER` | `SYSTEM` | `STAFF_ADMIN`)
- fromStatus, toStatus (text; booking or documented order labels)
- category
- executable boolean (true only for P13-allowed rows)
- preconditionsJson, sideEffectsJson, auditJson, failureJson
- unique (actor, fromStatus, toStatus)

Seed executable rows:

| actor    | from             | to               | category     |
| -------- | ---------------- | ---------------- | ------------ |
| CUSTOMER | (new)            | DRAFT            | NORMAL       | represented as fromStatus `NONE` |
| CUSTOMER | DRAFT            | AWAITING_DEPOSIT | NORMAL       |
| CUSTOMER | DRAFT            | CANCELLED        | CANCELLATION |
| CUSTOMER | AWAITING_DEPOSIT | CANCELLED        | CANCELLATION |

Seed non-executable documentation rows (executable=false) including
`AWAITING_DEPOSIT` → `CONFIRMED` (SYSTEM, P15), order labels, privileged
override, emergency-related parallel note.

### booking_commands

- id, customerUserId, commandType, idempotencyKey, bookingId nullable
- requestHash, responseJson
- createdAt
- unique (customerUserId, commandType, idempotencyKey)

## Configuration seed

`country_configs` key `commercial.deposit_percent` NUMBER `25` for Egypt;
`app_configs` resolution `COUNTRY_REQUIRED` (fail closed if missing).

## Media enum addition

`MediaOwnerType.BOOKING_ATTACHMENT`

## Integrity

- CHECK status/emergencySignaled types in Prisma enums.
- Reject rewrite of snapshot/breakdown in repository (no update API).
- Do not add P14 ledger or P16 cancellation-fee tables.

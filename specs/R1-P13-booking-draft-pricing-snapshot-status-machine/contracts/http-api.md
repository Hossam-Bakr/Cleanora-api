# Booking HTTP API Contract (R1-P13)

Base: `/api/v1/bookings`
Auth: required Bearer; principal must include a verified customer category
(`INDIVIDUAL` | `COMPANY` | `ENGINEER`).
Success/error envelopes: repository standard.

Idempotency: header `Idempotency-Key` (1–128 chars) required on POST create,
submit-for-deposit, cancel, and media attach.

Optimistic concurrency: body `version` required on PATCH, submit, cancel.

## POST `/`

Create `DRAFT`.

Body:

- `serviceId`, `providerId`, `teamId`
- `countryId`, `cityId`, optional `districtId`
- `startsAt`, `endsAt` (UTC ISO, half-open)
- `crewPreference`: `all_male` | `all_female` | `any`
- `requiredTeamUnits` integer 1–50
- `locale`: `AR` | `EN`
- `userAddressId`
- optional `notes`, optional `answers[]` `{ fieldId, value }`
- **no** `gross`, `deposit`, `total` fields

Data: booking aggregate + `quote` { gross, deposit, remainder, currencyCode,
depositPercent } as canonical decimal strings.

Errors: `AUTHENTICATION_REQUIRED`, `FORBIDDEN` (unverified),
`VALIDATION_FAILED`, `NOT_ELIGIBLE`, `CONFLICT` (idempotency body mismatch),
`DEPOSIT_PERCENT_UNAVAILABLE`, mapped dependency failures.

## GET `/`

Query: `limit` default 20 max 50, `cursor`, optional `status`.
Data: items + nextCursor. Self only.

## GET `/:bookingId`

Data: aggregate including answers, address snapshot, media delivery URLs
(omit unsigned failures), frozen snapshot/breakdown when present, status
history summary.

When frozen, `snapshot` contains the copied Catalog and Provider facts plus
`frozenAt`. `priceBreakdown` contains canonical decimal-string `gross`,
`deposit`, and `remainder` values with currency, decimal places, deposit
percent, formula version, and creation time. The frozen breakdown—not mutable
live Provider pricing—is the authoritative submitted quote returned by GET.

Not found for other customers' ids (non-enumerating).

## PATCH `/:bookingId`

Only `DRAFT`. May replace answers, notes, `userAddressId`, crewPreference
(re-evaluates eligibility if schedule/crew/address locality changes — if those
fields change they are allowed only with a matching re-eval; MVB may restrict
PATCH to answers/notes/media and require recreate for schedule — **plan lock**:
PATCH allows `notes`, `answers`, `userAddressId` only; schedule/provider/team
are immutable after create).

Requires `version`.

## POST `/:bookingId/submit-for-deposit`

`DRAFT` → `AWAITING_DEPOSIT`. Re-evaluates eligibility. Requires all required
catalog answers. Persists immutable snapshot + breakdown. Requires `version`.

## POST `/:bookingId/cancel`

Body: `{ version, reason: BookingCancelReason }`.
From `DRAFT` or `AWAITING_DEPOSIT` only.

## POST `/:bookingId/media`

Multipart or `{ mediaId }` for an already READY `BOOKING_ATTACHMENT` owned by
the principal. Max 5. Draft only.

## Error codes (stable)

`AUTHENTICATION_REQUIRED` | `FORBIDDEN` | `VALIDATION_FAILED` | `NOT_FOUND` |
`NOT_ELIGIBLE` | `CONFLICT` | `TRANSITION_NOT_AVAILABLE` |
`DEPENDENCY_FAILURE` | `DEPOSIT_PERCENT_UNAVAILABLE`

## Browse hint (existing)

`bookingPrerequisites.bookingAvailable` true iff verified customer;
`requiresVerifiedCustomer` true; `phase` `R1-P13`. Browse still never creates
bookings.

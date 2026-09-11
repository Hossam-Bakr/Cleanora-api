# Research — R1-P13

## Eligibility reuse

P11 public `evaluateEligibility` explicit mode is the mutation gate. Browse
facade is list-only and must not be used to create bookings (DEC-072/086).

## Money

P09 persists minor units as `Decimal(65,0)` and formats canonical decimal
strings. Booking quote/deposit MUST reuse those helpers, never `number`.

## Deposit percent

Vision default 25/75 split. No existing `commercial.deposit_percent` key.
Configuration must own the key; Egypt seed 25; missing key fails closed.

## OQ-010

Architecture status-machine-draft is provisional. P13 freezes booking statuses
and emergency-as-parallel-flag. Order labels are documented, not tabulated as
orders rows.

## OQ-001

Temporary rule: cancellable states + audit; do not calculate fees. P16 owns
cancellation fee tables.

## Idempotency

Follow Configuration/Providers command unique `(scope, idempotencyKey)` pattern
scoped to `customerUserId` + command type.

## Media

No booking owner type exists. Adding `BOOKING_ATTACHMENT` is in-phase because
roadmap lists permitted media. Cap at five images.

## Address

Customers addresses are live mutable. Booking must copy fields at write time.
A public reader is required so Bookings does not import customers Prisma.

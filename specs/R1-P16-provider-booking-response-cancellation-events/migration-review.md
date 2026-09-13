# R1-P16 migration review

Migration: `prisma/migrations/r1_p16_provider_booking_response_cancellation_events/migration.sql`

## Inventory

Additive only:

- `BookingStatus.ACCEPTED`
- `StatusTransitionActor.PROVIDER`
- Tables: `cancellation_reasons`, `booking_responses`, `booking_cancellations`, `booking_notification_intents`, `booking_actor_commands`
- Seeded Egypt `commercial.provider_response_hours = 24`
- Seeded cancellation/reject reasons including `PROVIDER_RESPONSE_EXPIRED`
- Executable transition rows for accept, reject, expiry, and post-confirm cancel

## Risks

- Enum `ADD VALUE` is PostgreSQL-forward-compatible and not rewritten in earlier migrations.
- No `DROP TABLE`, `TRUNCATE`, or `DELETE FROM`.
- No wallet tables, fee columns, or refund-request invention.
- Unique booking response/cancellation rows prevent duplicate audit facts.

## Forward-fix

If hours seed misses a country, fail closed at confirm; backfill `country_configs` for EG (or later countries) without editing this applied SQL.

## Live proof

Requires disposable `CLEANORA_R1_P16_DATABASE_URL` matching `cleanora_r1_p16_*_(test|proof|clean|ci)`. SQL shape is unit-tested independently of that URL.

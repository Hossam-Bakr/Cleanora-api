# Migration Review — r1_p18_order_execution_completion_code

**Date**: 2026-09-14
**Phase**: R1-P18 Order Execution & Client Completion Code

## Summary

Additive migration introducing Orders-owned fulfillment tables and enums:

- `OrderStatus` (ASSIGNED → … → COMPLETED | CANCELLED; no FAILED)
- `orders` with unique `booking_id` (1:1)
- `order_status_history`, `completion_codes` (+ partial unique ACTIVE per order),
  `completion_code_attempts`, `order_media`, `order_notes`, `order_events`,
  `order_notification_intents`, `order_actor_commands`

Does **not** alter `BookingStatus` or booking tables.

## Risk

- Low: additive enums/tables/indexes only; no drops or rewrites.
- Partial unique index on ACTIVE completion codes requires PostgreSQL.
- Logical `booking_id` / `provider_id` / `customer_user_id` (no cross-module FK).

## Defaults

- Notification intent `delivery_status` defaults to `PENDING` (no send).
- Completion code TTL/maxAttempts applied in application layer (defaults 1800s / 5).

## Backfill

None. Orders are created lazily from ASSIGNED bookings.

## Forward-fix

Drop new FKs/tables/types only via a new forward migration if ever needed.
Never edit this applied migration.

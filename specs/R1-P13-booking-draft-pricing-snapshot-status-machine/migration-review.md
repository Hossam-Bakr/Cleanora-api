# R1-P13 Migration Review

**Migration**: `prisma/migrations/r1_p13_booking_draft_pricing_snapshot_status_machine/migration.sql`  
**Authority**: DEC-090, DEC-091, `data-model.md`  
**Status**: Forward-only SQL authored and reviewed for first application; live
apply remains gated on an approved disposable Phase 13 database.

## Statements

1. Add `BOOKING_ATTACHMENT` to `MediaOwnerType`.
2. Create booking enums: status, path, crew preference, command type, cancel
   reason, transition actor, transition category.
3. Create `bookings` and owned item/answer/address/media/snapshot/breakdown/
   history/command tables with Restrict FKs to `users` and `countries`.
4. Create `status_transition_rules` and seed executable customer rows plus
   documented non-executable CONFIRMED/override/emergency rows.
5. Insert `app_configs` catalog row `commercial.deposit_percent` and
   Egypt-only (`countries.code = 'EG'`) COUNTRY_REQUIRED value of `25`.
   Other countries fail closed with no invented percent.

## SQL review checklist

| Check | Result |
|---|---|
| Additive only; no DROP of product tables | Pass |
| Snapshots and breakdowns have `created_at` only | Pass |
| No fee columns on cancel history | Pass |
| No `orders` table | Pass |
| No ledger/payment tables | Pass |
| Unique idempotency `(customer_user_id, command_type, idempotency_key)` | Pass |
| Decimal money columns `DECIMAL(65,0)` | Pass |
| Snapshot/breakdown UPDATE/DELETE triggers raise `55000` | Pass |
| Egypt-only `commercial.deposit_percent` seed | Pass |

## Risks

- `ALTER TYPE ... ADD VALUE` is not transactional on older Postgres; apply on
  disposable targets first.
- Deposit-percent seed is Egypt-only; missing country config fails closed.

## Out of scope

- Payment capture, ledger postings, `CONFIRMED` execution, assignment, Docker,
  cloud, stored-value wallets.

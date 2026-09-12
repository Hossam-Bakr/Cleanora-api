# Migration Review — R1-P15 Deposit Payments, Methods & Webhooks

**Migration folder**: `prisma/migrations/r1_p15_deposit_payments_methods_webhooks/`
**Authority**: DEC-094 / data-model.md

## Summary

Additive forward-only migration after P14. Creates six payment tables, enums,
partial unique index for one SUCCEEDED `BOOKING_DEPOSIT` per booking, Egypt
method seed (Paymob CARD + WALLET enabled; OTHER_DISABLED disabled), and
enables SYSTEM `AWAITING_DEPOSIT` → `CONFIRMED` transition rule.

## SQL review notes

| Item | Decision |
|---|---|
| Enums | PaymentRailProvider, PaymentMethodKind, PaymentAttemptStatus, PaymentStatus, PaymentPurpose, PaymentGatewayEventStatus, RefundRequestStatus |
| Money | `DECIMAL(65,0)` with positive checks |
| One succeeded deposit | Partial unique index `payments_one_succeeded_booking_deposit_key` on `(booking_id, purpose) WHERE status = 'SUCCEEDED'` |
| Gateway idempotency | Unique `(provider, idempotency_key)` |
| Attempt idempotency | Unique `(customer_user_id, booking_id, idempotency_key)` |
| FKs | Restrict to `countries` / payment tables; booking ids logical (no FK cascade) |
| Seed | Idempotent `NOT EXISTS` inserts for Egypt |
| Destructive | None; no DROP; no wallet tables |

## Live proof status

**PASS** — see `migration-evidence.md` (2026-09-12). Clean install and
populated P14→P15 upgrade both succeeded on authorized Neon disposable
`cleanora_r1_p15_proof`.

SQL notes from live remediation (before successful apply):

- Do not set `updated_at` on `status_transition_rules` (column does not exist).
- Egypt method INSERT in SQL is a no-op until country exists; `prisma/seed.ts`
  upserts methods after country creation.

Never edit this migration after it is applied in a non-disposable environment.

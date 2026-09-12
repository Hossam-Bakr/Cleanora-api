# R1-P14 Migration Review

**Migration**: `prisma/migrations/r1_p14_financial_ledger_payment_architecture/migration.sql`  
**Authority**: DEC-093, DEC-003, DEC-006, DEC-007, `data-model.md`  
**Status**: Forward-only SQL authored and reviewed for first application; live
apply remains gated on an approved disposable Phase 14 database.

## Statements

1. Create closed ledger enums: account type, entry type, side, link kind,
   command type, actor kind, snapshot subject.
2. Create the six Payments-owned tables: `ledger_accounts`, `ledger_entries`,
   `ledger_entry_links`, `financial_idempotency_keys`, `financial_snapshots`,
   `financial_adjustments`.
3. Seed eight Egypt (`countries.code = 'EG'`) system accounts for the closed
   account-type catalog, using the country's configured currency. Idempotent
   `NOT EXISTS` insert. No per-user accounts.
4. Add UPDATE/DELETE triggers on entries, links, and snapshots that raise
   `55000` (`ledger_entries_immutable`, `ledger_entry_links_immutable`,
   `financial_snapshots_immutable`).

## SQL review checklist

| Check | Result |
|---|---|
| Additive only; no DROP of product tables | Pass |
| Entries, links, and snapshots have `created_at` only | Pass |
| Money columns `DECIMAL(65,0)` with positive-amount check | Pass |
| No `orders` table | Pass |
| No wallet / `user_wallets` table | Pass |
| Unique system account `(country_id, currency_code, account_type)` | Pass |
| Unique idempotency `(command_type, actor_kind, actor_id, idempotency_key)` | Pass |
| Egypt-only system-account seed | Pass |
| Entry/link/snapshot UPDATE/DELETE triggers raise `55000` | Pass |
| `ORDER` link kind reserved; booking kind requires `booking_id` | Pass |

## Risks

- Clean install applies the account INSERT before `prisma/seed.ts` creates
  Egypt. Seed therefore upserts the same eight accounts after countries exist.
- Upgrade against a populated P13 schema inserts the eight accounts during
  migrate because Egypt already exists.

## Out of scope

- Payment capture, Paymob/webhooks, receipts, `CONFIRMED` from money, staff
  finance HTTP, stored-value wallets, Docker, cloud.

# Migration Evidence — R1-P18

**Date**: 2026-09-14  
**Status**: **PASS** — live clean install + P17→P18 upgrade on disposable Neon

## Required

`CLEANORA_R1_P18_DATABASE_URL` / `CLEANORA_R1_P18_UPGRADE_DATABASE_URL`
pointing at authorized disposable Postgres databases for:

1. Clean install of all migrations through `r1_p18_order_execution_completion_code`
2. Populated upgrade from a through-P17 database to P18

## Target (no secrets)

| Field | Value |
|---|---|
| Neon project | `morning-base-18570783` (Cleanora R1-P18 proof) |
| Clean DB | `cleanora_r1_p18_proof` |
| Upgrade DB | `cleanora_r1_p18_upgrade_proof` |
| Branch | `br-frosty-pine-awfkrxz7` |
| Env vars | `CLEANORA_R1_P18_DATABASE_URL`, `CLEANORA_R1_P18_UPGRADE_DATABASE_URL` (session-scoped; not committed) |

## Commands

```text
node --conditions=development --import tsx scripts/apply-r1-p18-migrations-pg.ts
node --conditions=development --import tsx scripts/apply-r1-p18-upgrade-pg.ts
```

Note: `prisma migrate deploy` connected to the disposable Neon target but
applied zero migrations in this Windows/Prisma 7 path (exit 0, no SQL). Live
proofs therefore apply committed `migration.sql` files in order via `pg`
(statement-split respecting dollar-quotes / enum ADD VALUE), stamp
`_prisma_migrations`, then run `assertPostDeployState`.

## Observed results

| Proof | Result | Notes |
|---|---|---|
| Clean install | **PASS** | 24 migrations; 135 tables; empty order tables; `orders_booking_id_key`; ACTIVE completion-code partial unique; OrderStatus.READY_TO_COMPLETE |
| P17→P18 upgrade | **PASS** | Fixture provider preserved; P18 tables empty; post-deploy asserts PASS |

## SQL review (static)

- Migration folder: `prisma/migrations/r1_p18_order_execution_completion_code/`
- Review notes: `specs/R1-P18-order-execution-completion-code/migration-review.md`
- Unit validation: `tests/unit/scripts/validate-r1-p18-migration.test.ts` PASS
- Guard: `assertR1P18MigrationSql`, `APPROVED_R1_P18_TARGET_PATTERN`

## Notes

- Proofs used disposable Neon databases matching
  `cleanora_r1_p18_*_(test|proof|clean|ci)`.
- This evidence does **not** authorize production migration, mark-complete,
  commit, push, merge, or deploy.

# Migration Evidence — R1-P17

**Date**: 2026-09-14  
**Status**: **PASS** — live clean install + P16→P17 upgrade on disposable Neon

## Required

`CLEANORA_R1_P17_DATABASE_URL` pointing at an authorized disposable Postgres
for:

1. Clean install of all migrations through `r1_p17_worker_team_assignment`
2. Populated upgrade from a P16-applied database to P17

## Target (no secrets)

| Field | Value |
|---|---|
| Neon project | `super-brook-96581434` (Cleanora R1-P17 proof) |
| Database name | `cleanora_r1_p17_proof` |
| Branch | `br-polished-cherry-av8y7v1a` |
| Env var | `CLEANORA_R1_P17_DATABASE_URL` (session-scoped for proofs; not committed) |

## Commands

```text
npm run db:validate-clean-migration
npm run db:validate-r1-p17-upgrade
```

## Observed results

| Proof | Result | Notes |
|---|---|---|
| Clean install | **PASS** | Isolated schema `cleanora_r1_p17_proof_*`; 126 tables; 23-migration history; ASSIGNED + empty assignment tables; ACCEPTED→ASSIGNED seeds; one-ACTIVE partial unique |
| P16→P17 upgrade | **PASS** | Isolated schema `cleanora_r1_p17_upgrade_proof_*`; baseline digests preserved; idempotent re-deploy |

## SQL review (static)

- Migration folder: `prisma/migrations/r1_p17_worker_team_assignment/`
- Review notes: `specs/R1-P17-worker-team-assignment/migration-review.md`
- Unit validation: `tests/unit/scripts/validate-r1-p17-migration.test.ts` PASS
  (ASSIGNED enum, three tables, partial unique ACTIVE, transition seeds)
- Script guards: `assertR1P17MigrationSql`, `APPROVED_R1_P17_TARGET_PATTERN`

## Notes

- Proofs used a disposable Neon database matching
  `cleanora_r1_p17_*_(test|proof|clean|ci)`.
- This evidence does **not** authorize production migration, mark-complete,
  commit, push, merge, or deploy.

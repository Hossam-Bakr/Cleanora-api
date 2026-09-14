# Local Maintenance Scripts

These scripts are safe developer tools. They do not replace public APIs,
application services, admin actions, migrations, or production runbooks.

- `check-database.ts` checks connectivity with `SELECT 1`.
- `inspect-auth.ts` reports whether planned R1-P02 auth tables exist. It never
  prints users, credentials, sessions, tokens, OTP values, or passwords.
- `seed.ts` runs the repository-owned idempotent Prisma seed entry.
- `validate-clean-migration.ts` reviews every phase-owned migration through
  R1-P10 (rejecting destructive, unrelated, or implicit-backfill SQL), verifies
  the exact product-table set and one successful history row per migration, and
  deploys only after the explicit empty non-production target checks pass.
- `resolve-test-database-url.cjs` selects the approved automated-test database
  URL (`TEST_DATABASE_URL`). Ordinary `DATABASE_URL` is never an approved test
  target. `register-env.cjs` applies that selection for Vitest.
- `count-seed-rows.ts` prints natural-key row counts used for seed idempotency
  evidence (never prints connection strings or secrets).
- `docs-check.ts` verifies the required release API and delivery documentation paths.
- `openapi-validate.ts` verifies the source OpenAPI documents and runtime Swagger contract.

Run them through the matching `package.json` scripts so `.env` and TypeScript
execution are configured consistently.

Useful commands: `npm run seed`, `npm run db:validate-clean-migration`,
`npm run docs:check`, and `npm run openapi:validate`.
The clean-migration and R1-P16 upgrade proofs read
`CLEANORA_R1_P16_DATABASE_URL` and must target a named R1-P16 disposable
database (`cleanora_r1_p16_*_(test|proof|clean|ci)`).
Historical R1-P15 deposit proofs still read `CLEANORA_R1_P15_DATABASE_URL`
(`cleanora_r1_p15_*_(test|proof|clean|ci)`).
The clean-migration and R1-P14 upgrade proofs historically read
`CLEANORA_R1_P14_DATABASE_URL` and must target a named R1-P14 disposable
database (`cleanora_r1_p14_*_(test|proof|clean|ci)`).
Historical R1-P13 booking proofs still read `CLEANORA_R1_P13_DATABASE_URL`
(`cleanora_r1_p13_*_(test|proof|clean|ci)`).
Historical R1-P11 Eligibility proofs still read `CLEANORA_R1_P11_DATABASE_URL`
(`cleanora_r1_p11_*_(test|proof|clean|ci)`).
Historical R1-P10 upgrade proofs still read
`CLEANORA_R1_P10_DATABASE_URL` and must target a named R1-P10 disposable
database (`cleanora_r1_p10_*_(test|proof|clean|ci)`).
Historical R1-P09 Provider-service proofs still read `CLEANORA_R1_P09_DATABASE_URL`
(`cleanora_r1_p09_*_(test|proof|clean|ci)`).
Historical R1-P08 Catalog proofs still read `CLEANORA_R1_P08_DATABASE_URL`
(`cleanora_r1_p08_*_(test|proof|clean|ci)`).
Automated Vitest suites prefer `TEST_DATABASE_URL` (pooled Neon endpoint to the
same isolated current-schema proof named `cleanora_r1_p04_*_proof`) and never
print connection strings. `TEST_MIGRATION_DATABASE_URL` must name that same
R1-P04 proof database. Do not point either family at `Cleanora` or the
historical `cleanora_r1_p04_clean_proof`.

R1-P10 Postman generation: `npm run postman:generate:r1-p10`.
R1-P13 upgrade proof: `npm run db:validate-r1-p13-upgrade` (owner-approved
disposable only; requires `CLEANORA_R1_P13_DATABASE_URL`).
R1-P10 upgrade proof: `npm run db:validate-r1-p10-upgrade` (owner-approved
disposable only; final Phase 10 live proof passed on `cleanora_r1_p10_proof`).

R1-P09 Postman generation: `npm run postman:generate:r1-p09`.
R1-P09 upgrade proof: `npm run db:validate-r1-p09-upgrade` (owner-approved
disposable only).

Both current validators call phase constraint probes against their isolated
schema. Savepoints recover each expected rejection; the fixture transaction
rolls back entirely. No immutable history is deleted or trigger disabled.

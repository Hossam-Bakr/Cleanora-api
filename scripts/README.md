# Local Maintenance Scripts

These scripts are safe developer tools. They do not replace public APIs,
application services, admin actions, migrations, or production runbooks.

- `check-database.ts` checks connectivity with `SELECT 1`.
- `inspect-auth.ts` reports whether planned R1-P02 auth tables exist. It never
  prints users, credentials, sessions, tokens, OTP values, or passwords.
- `seed.ts` runs the repository-owned idempotent Prisma seed entry.
- `validate-clean-migration.ts` reviews every phase-owned migration through
  R1-P04A (rejecting destructive, unrelated, or implicit-backfill SQL), verifies
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
The clean-migration and R1-P08 upgrade proofs read
`CLEANORA_R1_P08_DATABASE_URL` and must target a named R1-P08 disposable
database (`cleanora_r1_p08_*_(test|proof|clean|ci)`).
Automated Vitest suites prefer `TEST_DATABASE_URL` (pooled Neon endpoint to the
same isolated current-schema proof named `cleanora_r1_p04_*_proof`) and never
print connection strings. `TEST_MIGRATION_DATABASE_URL` must name that same
R1-P04 proof database. Do not point either family at `Cleanora` or the
historical `cleanora_r1_p04_clean_proof`.

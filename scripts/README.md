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
The clean-migration proof reads only `TEST_MIGRATION_DATABASE_URL` and must
target a clean, non-production test database.
Automated Vitest suites prefer `TEST_DATABASE_URL` (pooled Neon endpoint to the
same isolated test database) and never print connection strings. Use an
explicitly empty, non-production PostgreSQL database for first-time
clean-migration validation.

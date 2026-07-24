# Local Maintenance Scripts

These scripts are safe developer tools. They do not replace public APIs,
application services, admin actions, migrations, or production runbooks.

- `check-database.ts` checks connectivity with `SELECT 1`.
- `inspect-auth.ts` reports whether planned R1-P02 auth tables exist. It never
  prints users, credentials, sessions, tokens, OTP values, or passwords.
- `seed.ts` runs the repository-owned idempotent Prisma seed entry.
- `validate-clean-migration.ts` reviews the phase-owned migration SQL (rejects
  destructive statements outside scope), verifies the five P01 tables, and,
  only when `DATABASE_URL` is provided, invokes Prisma migration deployment.
- `ci-db-validate.ts` runs migration SQL review/deploy checks plus a double
  Egypt seed and row-count proof when `DATABASE_URL` is available; otherwise it
  exits successfully so CI quality gates remain database-optional.
- `count-seed-rows.ts` prints natural-key row counts used for seed idempotency
  evidence (never prints connection strings or secrets).
- `docs-check.ts` verifies required R1-P01 API and delivery documentation paths.
- `openapi-validate.ts` verifies the R1-P01 OpenAPI document and required health
  paths.

Run them through the matching `package.json` scripts so `.env` and TypeScript
execution are configured consistently.

Useful commands: `npm run seed`, `npm run db:validate-clean-migration`,
`npm run db:ci-validate`, `npm run docs:check`, and `npm run openapi:validate`.
The database proof reads only `CI_DATABASE_URL`, must target a clean,
non-production test database, and is intentionally separate from `npm run ci`.
Use an explicitly empty, non-production PostgreSQL database for first-time
clean-migration validation.

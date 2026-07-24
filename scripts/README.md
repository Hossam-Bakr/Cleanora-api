# Local Maintenance Scripts

These scripts are safe developer tools. They do not replace public APIs,
application services, admin actions, migrations, or production runbooks.

- `check-database.ts` checks connectivity with `SELECT 1`.
- `inspect-auth.ts` reports whether planned R1-P02 auth tables exist. It never
  prints users, credentials, sessions, tokens, OTP values, or passwords.
- `seed.ts` runs the repository-owned idempotent Prisma seed entry.

Run them through the matching `package.json` scripts so `.env` and TypeScript
execution are configured consistently.

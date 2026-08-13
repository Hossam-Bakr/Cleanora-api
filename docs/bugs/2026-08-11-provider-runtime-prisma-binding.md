# Bug Report — Provider runtime accessed Prisma before startup binding

## Observed behavior

`npm run dev` exited during startup with the safe top-level log
`Application startup failed`.

## Expected behavior

Runtime composition must construct all routers and adapters without reading the
process-wide Prisma singleton. The application must bind/connect its owned
`PrismaLifecycle.client` before repository work and then start HTTP listening.

## Reproduction

Run `npm run dev` with `AUTH_ENABLED=true`. A diagnostic invocation of
`startApplication()` exposed:

```text
Prisma client is not bound; compose the database lifecycle before repository access
```

## Environment

- Development startup through `src/server.ts`
- R1-P05 Provider runtime enabled
- Node/tsx process using the repository `.env`

## Evidence and root cause

`createRuntimeDependencies()` created the Provider module before
`src/server.ts` called `bindPrismaClient()`. Several newly wired Provider
readers/repositories used `getPrismaClient()` or default constructors during
composition, so startup failed before the database lifecycle could connect and
bind its client.

## Fix

Provider runtime composition now injects `database.client` explicitly into the
Provider repository, identity/applicant/country/media readers, media adapter,
review/media/outbox repositories, and dispatcher. The Media-owned factory
accepts an opaque optional database dependency, preserving its module boundary
without exposing Prisma types.

## Regression test

The authenticated runtime composition test no longer pre-binds a fake global
Prisma client. It proves Provider/customer/authentication routers can be
constructed from the runtime-owned lifecycle client before connection.

## Validation

- Typecheck passed.
- Focused composition regression: 1 passed, 2 skipped.
- Unsandboxed `npm run dev` reached `HTTP server listening` on port 8000.
- The server was stopped immediately after the startup proof.

## Remaining risk

The database currently selected by `.env` is named `Cleanora` and is not an
approved R1 development target. Read-only migration status reports that both
`r1_p04a_category_aware_customer_signup_verification` and
`r1_p05_provider_onboarding_profile_lifecycle` are unapplied; this explains the
missing `MediaStatus.FAILED` enum and Provider email-outbox warnings after HTTP
startup. No database migration was run. Do not apply repository migrations to
that historical database: first replace `DATABASE_URL` with an approved,
isolated development database, then request explicit database-change
authorization.

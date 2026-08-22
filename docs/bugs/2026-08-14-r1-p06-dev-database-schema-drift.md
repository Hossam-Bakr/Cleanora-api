# Bug Report — R1-P06 runtime used an R1-P05 database schema

## Observed behavior

`npm run dev` started the HTTP listener, but the Provider email-outbox worker and
Media cleanup sweep logged `PrismaClientKnownRequestError`. The concrete Media
error reported that `media_files.verification_provider_id` did not exist.

## Expected behavior

The runtime database schema matches the generated Prisma Client and all R1-P06
background queries run without missing-column errors.

## Reproduction

1. Point `.env` at the affected Neon `Cleanora` database and start the current
   R1-P06 runtime with `npm run dev`.
2. Allow the Provider email-outbox and Media cleanup background tasks to run.
3. Observe missing-column warnings from R1-P06 model queries.
4. Run `npx prisma migrate status` and observe that
   `r1_p06_provider_verification_external_payout_destinations` is pending.

## Environment

- Date: `2026-08-14`
- Application environment: `development`
- Database provider: PostgreSQL on Neon
- Database/schema: `Cleanora.public`
- Repository migrations: 13
- Initially applied migrations: 12

Credentials and the database URL are intentionally omitted.

## Evidence and root cause

The generated Prisma schema includes R1-P06 fields such as
`media_files.verification_provider_id`,
`media_files.verification_document_version_id`, and the R1-P06 Provider email
outbox history references. The forward migration creates those columns, but
read-only `prisma migrate status` showed that the database had not applied the
R1-P06 migration. The code/client therefore targeted the completed R1-P06
schema while the runtime database remained at R1-P05. This was deployment
schema drift, not a Media repository or email-worker code defect.

## Fix

The human owner stopped the first runtime and applied the existing reviewed
forward migration with:

```text
npx prisma migrate deploy
```

Prisma applied only
`r1_p06_provider_verification_external_payout_destinations`. No source code,
Prisma schema, or applied migration was changed as part of the repair.

## Regression test

The migration already has phase-owned clean-install, populated R1-P05 upgrade,
schema-contract, exact-table/history, seed-idempotency, and live-constraint
coverage. This incident requires the existing deployment preflight
`npx prisma migrate status`; no duplicate product-code regression test is
appropriate for a database that simply skipped a committed migration.

## Validation

- `npx prisma migrate status`: PASS — 13 migrations found and schema up to date.
- Restarted `npm run dev`: PASS — HTTP server listening without the prior
  missing-column warnings in the supplied startup output.
- `GET /api/v1/system/health/live`: HTTP 200, `status=ok`.
- `GET /api/v1/system/health/database`: HTTP 200, `status=up`.
- `GET /api/v1/system/health/ready`: HTTP 200, `status=ready`.

## Remaining risk

Future environments can reproduce this failure if application code is deployed
before `prisma migrate deploy`. Deployment must treat migration status as a
preflight gate. Successful readiness confirms the configured database and
R1-P06 key references; actual ClamAV, Cloudinary, SMTP, wallet, and bank channel
operations remain separate operational checks.

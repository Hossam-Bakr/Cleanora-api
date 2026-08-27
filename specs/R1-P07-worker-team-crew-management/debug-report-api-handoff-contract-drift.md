# R1-P07 API handoff contract-drift report

## Observed behavior

The generated R1-P07 Postman collection sent worker create/replace payloads with
`operationalPhone` and `skills`. The mounted runtime schemas require
`operationalPhoneE164` and `skillTags`, so manual `POST
/api/v1/providers/{providerId}/workers` requests failed with
`REQUEST_VALIDATION_FAILED` before reaching the workforce service.

The frontend handoff also exposed several smaller contract drifts: list workers
was serialized in the generic array-plus-meta shape instead of the documented
`{ items, nextCursor }` payload; omitted create fields did not receive the
documented defaults; full worker replacement accepted an incomplete body; team
create/rename response schemas described a team projection instead of a command
result; and no actor-facing read exposed the Provider aggregate version required
by Provider-level compare-and-swap commands.

## Expected behavior

- Generated examples must pass the same Zod schemas mounted by the HTTP routes.
- OpenAPI, Swagger fragments, controllers, generated Postman requests, tests,
  and the frontend API guide must describe one consistent wire contract.
- The Provider owner/admin must be able to read the current workforce version
  before sending a create-worker or create-team compare-and-swap command.

## Reproduction

Before regenerating the collection, run:

```powershell
npm.cmd run postman:validate
```

The enhanced validator rejects the stale generated create-worker payload with:

```text
R1-P07 createProviderWorkerDraft request body fails runtime validation:
operationalPhoneE164 ... undefined; Unrecognized keys: "operationalPhone", "skills"
```

The original manual server request produced HTTP 400 with
`REQUEST_VALIDATION_FAILED` for the same reason.

## Environment

- Branch: `r1-p07-worker-team-crew-management`
- Runtime: Node.js/TypeScript modular monolith
- Contract surfaces: Express route schemas, R1-P07 OpenAPI, generated Postman
  collection/environments, Arabic frontend handoff guide

## Evidence and root cause

The generator used presentation-oriented field aliases that never existed in
the strict runtime request schema. The previous Postman validation checked
operation and environment parity, but did not parse generated request bodies
through the mounted Zod schemas, so the invalid example could be regenerated
without failing CI-style validation.

Independent comparison of the controller serializers, runtime schemas, OpenAPI
components, and phase tests revealed the related response/default/CAS drifts.
They shared the same underlying issue: the handoff artifacts were not being
validated against the executable boundary in both directions.

The repeated local notification-dispatcher Prisma error seen during manual
`npm run dev` is separate from the request-validation failure. It is consistent
with a local database that does not have the R1-P07 migration state, but that
inference was deliberately not verified against an unapproved `.env` database.
It is not used as evidence for the request-body root cause.

## Fix

- Generate `operationalPhoneE164` and `skillTags` in worker create/replace
  requests.
- Validate all generated R1-P07 JSON request bodies with the corresponding
  runtime Zod schemas; validate multipart avatar command fields as well.
- Align worker list/default/replacement behavior and team command response
  schemas with the executable contract.
- Return `workforceVersion` from the actor-facing workforce-readiness response
  so the frontend can supply Provider aggregate `expectedVersion` values.
- Regenerate Postman artifacts and document all 25 phase endpoints in the Arabic
  frontend API guide.
- Correct the affected desktop UX references without changing their shared
  design system.

## Regression test

Focused integration and unit coverage now verifies:

- worker list shape and create defaults;
- rejection of incomplete full-replacement payloads;
- team create/rename command result shapes and draft-name defaulting;
- actor-facing `workforceVersion`;
- OpenAPI response fragment parity;
- generated Postman request-body parity with the runtime schemas.

## Validation

The focused seven-file suite passed 30 tests after the fixes. The final rerun
also passed:

- TypeScript typecheck, ESLint, production build, and Prisma schema validation;
- all 188 unit files / 911 unit tests;
- 76 R1-P07 test files / 329 tests, with 3 files / 5 database-proof tests skipped
  by the phase configuration;
- R1-P07 coverage at 85.19% statements, 76.51% branches, 84.86% functions, and
  88.17% lines;
- OpenAPI validation, documentation checks, and `git diff --check`;
- dependency audit with zero vulnerabilities after compatible updates and
  scoped patched Prisma-tooling overrides;
- Postman validation for all 25 phase operations per environment, 50 generated
  requests total, and 34 validated request bodies with runtime parity enabled.

A broad `test:integration` attempt was stopped after multiple legacy P04-P06
database suites timed out against the current configured PostgreSQL target. The
failures were not localized to the R1-P07 changes and the target was not treated
as an approved disposable proof database. The isolated R1-P07 suite and its
coverage run completed successfully.

## Remaining risk

Runtime smoke testing against a persistent local PostgreSQL database requires
that database to have the chronological R1-P07 migrations applied. Do not point
the migration validator at an unknown `.env` target or any production database;
use an owner-approved disposable proof database when migration proof must be
repeated.

# Bug Report — Descriptive API errors and password policy

## Observed behavior

Duplicate signup identifiers returned `409 AUTH_SIGNUP_UNAVAILABLE` with the
mechanically generated message `auth signup unavailable`. Failure JSON did not
repeat its HTTP status, and the 12-character password minimum was stricter than
the human-approved product behavior.

## Expected behavior

Every JSON failure provides a stable code, matching numeric status, safe
descriptive message, optional field metadata, and request ID. Signup identifies
whether phone or email conflicts. Passwords accept 7–128 characters, including
unpredictable numbers-only values, while rejecting predictable patterns.

## Reproduction

Submit `POST /api/v1/auth/signup` using a normalized phone already assigned to
another identity. The prior response returned only the generic signup code and
mechanical message.

## Environment

R1-P02 local development API and PostgreSQL persistence.

## Evidence and root cause

`authenticationError` converted enum names to lowercase text instead of using
an approved public catalog. `AuthenticationTransactionRepository.createSignup`
mapped Prisma `P2002` to `null`, and `AuthenticationService.signup` converted
every null result to one generic code. The global failure type omitted the
numeric status from JSON.

## Fix

Add an explicit authentication error catalog, a matching global
`error.statusCode`, safe field details, pre/post-insert normalized identifier
checks for concurrent correctness, and the DEC-020 password policy.

## Regression test

Focused tests cover the global envelope, duplicate phone/email signup
contracts, generic login behavior, accepted random numeric passwords, and
rejected common/repeated/sequential values.

## Validation

- Focused unit tests: 6 files / 25 tests passed.
- Core HTTP integration tests: 3 files / 14 tests passed.
- Database-backed signup and normalized uniqueness checks: 5 tests passed.
- TypeScript typecheck, changed-file ESLint, build, OpenAPI validation,
  documentation check, Postman JSON parsing, and relevant diff/whitespace
  checks passed.
- No coverage, full CI, converge, commit, push, deployment, production
  migration, or schema change was performed.

## Remaining risk

Field-specific signup conflicts permit limited identifier enumeration by
design. Login and recovery retain generic public semantics.

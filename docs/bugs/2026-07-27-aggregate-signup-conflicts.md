# Bug Report — Aggregate signup identifier conflicts

## Observed behavior

A syntactically valid signup using an already-registered phone and email
returned only `AUTH_PHONE_ALREADY_REGISTERED`.

## Expected behavior

The safe signup-only conflict contract reports both conflicting identifier
fields in one response. Password is never treated as a duplicate field.

## Root cause

`assertSignupIdentifiersAvailable` awaited and rejected the phone lookup before
executing the email conflict branch.

## Fix

Resolve both normalized ownership lookups together, collect safe conflict field
names, preserve the existing single-field codes, and return
`AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED` with both issue entries when
needed.

## Regression test

Focused tests cover phone-only, email-only, and combined phone/email conflicts.

## Validation

- Focused unit/request-contract tests: 2 files / 5 tests passed.
- Database-backed individual signup suite: 1 file / 4 tests passed, including
  the repeated valid phone-and-email conflict response and single-row proof.
- TypeScript typecheck, changed-file ESLint, build, OpenAPI validation,
  documentation check, Postman JSON parsing, and relevant diff checks passed.
- No coverage, full CI, converge, commit, push, deployment, schema change, or
  migration was performed.

## Remaining risk

This is an intentional signup-only identifier-existence disclosure approved by
the human owner. Login and recovery remain enumeration-safe.

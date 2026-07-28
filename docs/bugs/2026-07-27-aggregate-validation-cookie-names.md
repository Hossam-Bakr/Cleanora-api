# Bug Report — Aggregate validation and cookie names

## Observed behavior

A signup body containing an invalid phone, email, and predictable password
returned only the email issue. The client had to fix and resubmit repeatedly to
discover later phone and password errors. Browser storage also showed an
ambiguous `fs_refreshtoken` cookie alongside the Cleanora refresh cookie.

## Expected behavior

One validation response lists every independently detectable invalid field.
Authentication cookies use explicit Cleanora-owned names, and known stale names
are expired without being accepted as credentials.

## Reproduction

Submit `POST /api/v1/auth/signup` with phone `123`, email `invalid`, and
password `1234567`. Before the fix, the Zod boundary reported only email.
Repository search proves no current source creates `fs_refreshtoken`.

## Root cause

Zod already aggregated its own issues, but phone-format and password
predictability checks ran later in `AuthenticationService` and threw one
domain error at a time. The refresh name was configurable but retained the
shorter earlier default, while `fs_refreshtoken` was stale/external localhost
state outside this repository.

## Fix

Reuse non-throwing domain-policy predicates in the authentication Zod schemas,
preserving service assertions as defense in depth. Adopt
`cleanora_refresh_token` and `cleanora_google_oauth_state`, and expire the
known legacy names on authentication cookie set/clear and invalid refresh.

## Regression test

Focused tests assert one response contains phone, email, and password issues;
cookie helper/controller tests assert canonical names and legacy expiry.

## Validation

- Focused validation and cookie suites: 5 files / 42 tests passed.
- TypeScript typecheck, changed-file ESLint, build, OpenAPI validation,
  documentation check, all Postman JSON parsing, and relevant diff/whitespace
  checks passed.
- An additional pre-existing database-backed session suite did not complete:
  its second test timed out after 90 seconds against the remote test database.
  It produced no cookie-contract assertion failure and was not retried.
- No coverage, full CI, converge, commit, push, deployment, schema change, or
  migration was performed.

## Remaining risk

Cookies already stored under another path or domain can only be removed by a
matching origin/path response or by the user clearing that browser storage.
The remote database timeout leaves the broader logout/logout-all integration
journey unrefreshed in this pass; focused controller and cookie-helper
regressions passed.

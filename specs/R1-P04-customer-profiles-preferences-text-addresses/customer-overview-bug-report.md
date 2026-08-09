# Bug Report — Customer overview transaction-pool exhaustion

## Observed behavior

`GET /api/v1/customers/me/overview` intermittently returned HTTP `500` during
the new proof-database integration test.

## Expected behavior

An eligible authenticated customer receives HTTP `200` with the complete
profile-screen projection, including not-created category profiles when this is
their first visit.

## Reproduction

```text
node --require ./scripts/register-env.cjs ./node_modules/vitest/vitest.mjs run tests/integration/customers/customer-overview.test.ts
```

The R1-P04 fail-closed database guard required the approved disposable proof
database and rejected ordinary development, CI, Railway, production-like, and
historical `Cleanora` targets.

## Environment

- R1-P04 disposable proof database
- Prisma interactive transactions
- Existing `PrismaCustomersUnitOfWork` defaults: `maxWait=2s`, `timeout=5s`
- Fake Cloudinary adapter; no external media network call

## Evidence and root cause

The first GET launched all component service reads concurrently. Multiple
category-profile reads, profile-image read, preference read, address read, and
contact read competed for Prisma connections at once. The captured safe error
was:

```text
PrismaClientKnownRequestError P2028
Unable to start a transaction in the given time
```

This was not an assertion-only or environment-only failure: the endpoint itself
returned the canonical internal-error envelope with HTTP `500`.

## Fix

`CustomerOverviewService` now uses bounded parallel waves:

1. category profiles are read sequentially while the profile image and contact
   state run alongside that profile sequence;
2. preferences and addresses then run together.

The fix preserves existing service authorization, persistence ownership,
signed-URL behavior, and no-success-audit rules. It does not increase global
transaction timeouts, add retries, or hide pool exhaustion.

## Regression test

- Unit coverage asserts that overview orchestration never has more than three
  protected reads active at once.
- Proof-DB HTTP integration covers initial not-created state, completed
  multi-category profiles, signed image, contact state, preferences, addresses,
  no success audit, pending-only denial, inactive denial, and redacted denial
  audit evidence.

## Validation

- Focused unit: PASS — 2 files / 4 tests
- Focused proof-DB integration after repair: PASS three consecutive runs —
  1 file / 3 tests each
- Full unit: PASS — 119 files / 535 tests
- Full integration on the approved proof DB: PASS — 52 files / 146 tests
- Full coverage on the approved proof DB: PASS — 171 files / 681 tests;
  statements 83.06%, branches 77.54%, functions 86.11%, lines 84.59%
- Typecheck, lint (0 errors; one historical SC-008 warning), build,
  `docs:check`, `openapi:validate`, `postman:validate`, `prisma:validate`, and
  `git diff --check`: PASS

## Remaining risk

The endpoint is a UI projection rather than a single database snapshot; writes
committed between bounded read waves may appear on the next refresh. That is
acceptable for a profile screen and preserves the independent write contracts.

# Test Strategy — R1-P13

## Scope

Phase-owned executable files listed in `plan.md`. Thresholds 80/75/80/80.

## Suites

| Layer | Location | Focus |
|---|---|---|
| Unit | `tests/unit/modules/bookings/` | quote math, matrix, snapshot immutability guards, eligibility mapping, idempotency hash |
| Unit | `tests/unit/modules/configuration/` | deposit-percent reader fail-closed / Egypt 25 |
| Unit | `tests/unit/modules/customers/` | owned address snapshot reader |
| HTTP integration | `tests/integration/bookings/` | auth, eligibility fail-closed, create/submit/cancel, stale version, browse still creates no booking |

## Money cases

- 100.00 EGP, 25% → deposit 25.00 remainder 75.00
- minimum charge > unit price uses minimum as gross
- half-up to currency decimal places
- reject missing deposit config

## Authorization cases

- guest 401
- unverified customer 403
- other customer's GET 404
- invitation-onboarding / verification-only 403

## Transition cases

- draft → awaiting-deposit success
- awaiting-deposit → confirmed rejected
- cancel from both cancellable states
- stale version conflict
- cancelled cannot submit

## Snapshot case

Change live provider price after freeze; GET still returns frozen amounts.

## Commands

`npm run test:r1-p13`
`npm run test:coverage:r1-p13`
Keep P12 coverage config; do not lower thresholds.

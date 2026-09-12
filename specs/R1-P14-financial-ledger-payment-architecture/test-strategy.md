# Test Strategy — R1-P14

## Scope

Phase-owned executable files listed in the Vitest include/coverage globs.
Thresholds 80/75/80/80 (statements / branches / functions / lines).

## Suites

| Layer | Location | Focus |
|---|---|---|
| Unit | `tests/unit/modules/payments/` | money helpers, journal balance, type catalog, wallet rejection, idempotency hash |
| Unit | `tests/unit/modules/bookings/` | financial snapshot reader only (P14-owned file) |
| Unit | `tests/unit/modules/payments/module-boundaries.test.ts` | no foreign Prisma/repository imports; no payments HTTP router |
| Integration | `tests/integration/payments/` | post/replay/conflict, reconcile vs booking snapshot, adjustment immutability, Egypt seed |

## Money cases

- Balanced two-line DEPOSIT in EGP minor units persists
- Unbalanced journal writes nothing
- Mixed currency journal rejected
- Non-digit / negative magnitude rejected
- Derived balance equals signed sum (debit minus credit on one account)

## Idempotency cases

- Same actor + key + payload returns original journalId
- Same key + different payload → conflict, no second journal

## Reconciliation cases

- Posted deposit matching booking requirement → balanced; booking status unchanged
- No posts → missing/unbalanced
- DRAFT booking without frozen deposit → not-ready, not a fake zero

## Immutability / correction

- Adjustment posts compensating ADJUSTMENT lines
- Original entry bytes unchanged
- SQL UPDATE/DELETE on entries/links/snapshots rejected

## Negative product cases

- MARKETER_COMMISSION posting rejected
- ORDER link rejected
- User-scoped account creation rejected
- No Express path starts with `/api/v1/payments` or `/api/v1/ledger`

## Commands

`npm run test:r1-p14`
`npm run test:coverage:r1-p14`

Do not lower thresholds. Do not disable tests to manufacture a pass.

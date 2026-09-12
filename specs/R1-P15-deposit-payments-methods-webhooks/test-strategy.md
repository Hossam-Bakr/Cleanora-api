# Test Strategy — R1-P15

## Scope

Phase-owned executable files listed in the Vitest include/coverage globs for
`vitest.r1-p15.config.ts`. Thresholds **80/75/80/80** (statements / branches /
functions / lines). Include unimported P15 files (adapters, routes, schemas).

## Suites

| Layer | Location | Focus |
|---|---|---|
| Unit | `tests/unit/modules/payments/` | money reuse, method enablement filters, initiate validators, webhook signature verify, idempotency hash, refund REQUESTED-only |
| Unit | `tests/unit/modules/bookings/` | `confirmDepositPayment` transition + amount fail-closed |
| Unit | `tests/unit/modules/payments/module-boundaries.test.ts` | no foreign Prisma/repository imports; no wallets; no InstaPay adapter |
| Integration | `tests/integration/payments/` | HTTP methods list, initiate, browser return, webhook success/fail/replay, receipt auth, staff toggle |
| Integration | `tests/integration/payments/` | success pipeline: SUCCEEDED + DEPOSIT journal + receipt + booking CONFIRMED |

## Gateway isolation

- Use `FakePaymentGateway` implementing `PaymentGatewayPort` in unit/integration.
- Paymob adapter unit tests: signature verify true/false; fail closed when env
  missing on `createDepositSession`.
- Never hit real Paymob in CI.

## Money cases

- Initiate amount equals booking deposit minor units
- Success webhook amount mismatch → no SUCCEEDED / no confirm
- No JS `number` arithmetic in payments money paths (lint/test as existing)

## Idempotency / concurrency cases

- Initiate replay same key+payload → original attempt
- Initiate same key different payload → conflict
- Webhook duplicate idempotency key → replayed true, one journal, one confirm
- Two attempts then one success → one SUCCEEDED payment only

## Redirect-not-proof cases

- GET return with success-looking query → booking still AWAITING_DEPOSIT if
  webhook not processed
- GET return never creates receipt or journal

## Authorization cases

- Unauthenticated methods/deposits/receipt → 401
- Non-owner receipt → 404/403 non-enumerating
- Non-staff method PATCH → 403
- Staff enable/disable reflected in customer list

## Negative product cases

- Disabled method cannot initiate
- No InstaPay executable path
- Refund request does not call gateway refund or post REFUND journal
- Wallet endpoints absent

## Commands

`npm run test:r1-p15`
`npm run test:coverage:r1-p15`

Do not lower thresholds. Do not disable tests to manufacture a pass.

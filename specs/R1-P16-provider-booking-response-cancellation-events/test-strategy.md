# Test Strategy — R1-P16

## Scope

Phase-owned executable files listed in the Vitest include/coverage globs for
`vitest.r1-p16.config.ts`. Thresholds **80/75/80/80** (statements /
branches / functions / lines). Include unimported P16 files (routes,
schemas, repositories).

Do not lower thresholds. Do not disable tests to manufacture a pass. Do
not exclude phase-owned files solely to pass.

## Suites

| Layer | Location | Focus |
|---|---|---|
| Unit | `tests/unit/modules/bookings/` | accept/reject/expiry/cancel matrix, lazy expiry, no-fee invariant, idempotency, confirmDepositPayment creates PENDING response |
| Unit | `tests/unit/modules/bookings/module-boundaries.test.ts` | no foreign Prisma/repository imports; no fee fields; no NotificationPort delivery |
| Integration | `tests/integration/bookings/` | inbox authz, dossier privacy, accept/reject HTTP, customer/provider/staff cancel, reasons list, stale version |
| Unit | `tests/unit/scripts/validate-r1-p16-migration.test.ts` | migration SQL naming/constraints if following P15 pattern |

## Authorization cases

- Other provider cannot inbox/dossier/accept
- Worker cannot accept
- Customer cannot provider-accept
- Non-staff cannot staff-cancel
- Unauthenticated → 401
- Non-owner customer cancel → 404/403 non-enumerating

## Expiry / concurrency

- Clock past expiresAt → accept denied and CANCELLED
- Concurrent accept vs reject: one terminal winner
- Idempotent replay same key+body
- Same key different body → IDEMPOTENCY_BODY_MISMATCH

## Money / product negatives

- No feeAmount on cancellation rows or JSON
- No refund_request insert
- No ledger post from bookings
- No price mutation on accept
- Confirm fail-closed without provider_response_hours

## Notification

- Intent inserted once per success
- Replay does not duplicate intent (idempotency key)
- Safe variables only

## Commands

`npm run test:r1-p16`
`npm run test:coverage:r1-p16`

Repository gates at readiness: `npm run typecheck`, `npm run lint`,
`npm run test:unit` (or focused plus phase), `npm run docs:check`,
`npm run openapi:validate`, `npm run postman:validate` as discovered in
`package.json`.

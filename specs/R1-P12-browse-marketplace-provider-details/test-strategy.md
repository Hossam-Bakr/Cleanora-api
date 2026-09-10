# Test strategy — R1-P12

## Thresholds

Phase-owned executable files: statements 80% / branches 75% / functions 80% / lines 80%.

## Suites

| Suite | Path pattern | Focus |
|---|---|---|
| Unit | `tests/unit/modules/bookings/**`, auth optional middleware, provider preview omit | sort/filter/cursor, EX-01, privacy mappers |
| Integration HTTP | `tests/integration/browse/**` | guest catalog→list→detail; ineligible absent; EX-02 no booking/payment |
| Contract | OpenAPI + Postman validators | FR-014 |

## Commands

- `npm run test:coverage:r1-p12` (phase)
- `npm run typecheck`
- `npm run openapi:validate`
- `npm run postman:validate`
- `npm run docs:check`
- `npm run build`
- Migration proofs: NOT_APPLICABLE unless schema added

## EX-02 assertions

Integration must assert response creates no booking id and invokes no payment initiation APIs/side effects for browse handlers.

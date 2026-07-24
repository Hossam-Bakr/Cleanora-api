# Testing Standard

Vitest is the test runner and Supertest is the HTTP test client.

## Test levels

- Unit: deterministic business rules and helpers with no real database/network.
- Integration: Express, PostgreSQL, migrations, repositories, authorization,
  and provider-adapter contracts.
- E2E: complete public actor journeys across approved phase APIs.

Release 1 does not use Docker or Testcontainers. Database tests use an explicit
isolated local/test PostgreSQL database and deterministic cleanup.

Coverage baseline:

- Statements: 80%
- Lines: 80%
- Functions: 80%
- Branches: 75%

Coverage is a guardrail, not proof of correct business behavior. Phase
acceptance criteria, authorization, invalid transitions, idempotency, replay,
and concurrency scenarios remain mandatory where applicable.

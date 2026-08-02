# Testing Standard

Vitest is the runner and Supertest is the Express HTTP client.

- Unit tests cover deterministic rules, controllers, middleware, and adapters.
- Integration tests cover the exported Express app, PostgreSQL repositories,
  transactions, authorization, and complete public API journeys.
- There is no separate E2E suite or separately running test server.

Database tests require an explicit isolated PostgreSQL target with
deterministic cleanup. Release 1 does not use Docker or Testcontainers.

Coverage thresholds remain 80% statements, 75% branches, 80% functions, and
80% lines. Coverage is a guardrail; authorization, invalid transitions,
idempotency, replay, and concurrency evidence remain required where applicable.

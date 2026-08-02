# ADR-0006 — Testing framework

- Status: Amended by R1-P02A
- Date: 2026-07-23
- Amended: 2026-07-30

## Decision

- Use Vitest for tests and coverage.
- Use Supertest against the exported Express app.
- Keep `tests/unit`, `tests/integration`, and `tests/helpers`.
- Complete public journeys are integration tests; there is no E2E suite.
- Use an explicit isolated PostgreSQL test database with deterministic cleanup.
- Do not use Docker or Testcontainers before Release 3 approval.
- Enforce 80% statements/lines/functions and 75% branches.

Tests never use production credentials or external provider accounts.

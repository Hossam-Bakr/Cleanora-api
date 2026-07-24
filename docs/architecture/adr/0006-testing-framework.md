# ADR-0006 — Testing framework

- Status: Accepted
- Date: 2026-07-23
- Accepted: 2026-07-24

## Context

Cleanora requires unit, integration, authorization, migration, and end-to-end
tests across TypeScript, Express, and PostgreSQL.

## Decision

- Use Vitest as the test runner and coverage engine.
- Use Supertest for HTTP integration and e2e requests.
- Keep `tests/unit`, `tests/integration`, `tests/e2e`, and `tests/helpers`.
- Release 1 database tests use an explicit isolated local/test PostgreSQL
  database with deterministic cleanup.
- Do not use Docker or Testcontainers before Release 3 approval.
- Start with 80% statements/lines/functions and 75% branches, while phase
  acceptance and invariant tests remain mandatory regardless of percentage.

## Consequences

Vitest and Supertest are approved dependencies. Tests must not use production
credentials or external provider accounts.

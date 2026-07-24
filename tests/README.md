# Test Architecture

Vitest is the approved runner and Supertest is the approved HTTP test client.
See `docs/standards/testing.md` and ADR-0006.

- `tests/unit/` contains isolated domain and cross-cutting tests.
- `tests/integration/` contains composed API, PostgreSQL, migration, and adapter tests.
- `tests/e2e/` contains complete actor journeys through public HTTP contracts.
- `tests/helpers/` contains deterministic fakes and shared lifecycle helpers.
- Module-specific fixtures may remain beside their owning module.
- Every accepted defect receives regression coverage.

Release 1 must not rely on Docker or Testcontainers. Database suites use an
explicit isolated local/test PostgreSQL database with deterministic cleanup.

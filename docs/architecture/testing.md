# Testing Architecture

Vitest and Supertest are approved in ADR-0006. Follow
`docs/standards/testing.md`.

Required coverage:

- Unit tests beside owning modules
- App/PostgreSQL integration tests under `tests/integration`
- Authorization, ownership, and invalid transition tests
- Clean migration and compatibility tests
- Redis/queue adapter lifecycle and failure tests
- Payment webhook authenticity, replay, and concurrency tests
- Regression tests for every accepted bug

Test databases must be isolated per worker or suite with deterministic cleanup.
Release 1 must not rely on Docker or Testcontainers. External providers use
contract fakes; production credentials are never used.

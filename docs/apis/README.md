# Cleanora API Documentation

API documentation is organized by roadmap phase.

| Phase | Document | Status |
|---|---|---|
| R1-P00 foundation | [System health API](foundation-system.md) | Implemented |
| R1-P01 foundation | [OpenAPI health contract](openapi/r1-p01-foundation.yaml) | Implemented |
| R1-P02 authentication | [Authentication API](authentication.md) | Prepared, not implemented |

Every document must state whether an endpoint is `Implemented`, `Prepared`, or
`Deprecated`. Prepared routes must not be presented as working APIs.

All responses follow `docs/standards/api-response-and-errors.md`.
Importable collections and the local environment are under `postman/`.

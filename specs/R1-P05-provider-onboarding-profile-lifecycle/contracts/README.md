# R1-P05 Contracts

These contracts freeze the pre-implementation R1-P05 boundaries.

- [provider-api.md](./provider-api.md): actors, endpoint catalog, request and
  response semantics, error codes, pagination, privacy, and state behavior.
- [provider-api.openapi.yaml](./provider-api.openapi.yaml): OpenAPI 3.1 design
  contract for the authenticated HTTP surface.
- [module-public-contracts.md](./module-public-contracts.md): named public
  cross-module capabilities and forbidden dependency directions.
- [transaction-boundaries.md](./transaction-boundaries.md): transaction owner,
  participating ports, locks, external I/O, rollback, and idempotency.

The runtime/published OpenAPI and generated Postman collection are
implementation deliverables. They must derive from these contracts and remain
identical in behavior. There is no anonymous Browse or Provider Details API in
R1-P05.

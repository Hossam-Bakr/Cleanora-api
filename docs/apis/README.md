# Cleanora API Documentation

API documentation is organized by roadmap phase.

| Phase | Document | Status |
|---|---|---|
| R1-P00 foundation | [System health API](foundation-system.md) | Implemented |
| R1-P01 foundation | [OpenAPI health contract](openapi/r1-p01-foundation.yaml) | Implemented |
| R1-P02 authentication | [Authentication API](authentication.md) | Implemented; phase Complete |
| R1-P02 Google frontend | [Google sign-in frontend integration](google-sign-in-frontend.md) | Implemented; phase Complete |
| R1-P03A staff-admin role commands | [OpenAPI staff-admin role management](openapi/r1-p03a-staff-admin-role-management.yaml) | Implemented under DEC-030 |
| R1-P03A owner staff-admin provisioning | [OpenAPI owner staff-admins](openapi/r1-p03a-owner-staff-admins.yaml) | Implemented under DEC-030 |
| R1-P06 Provider verification and external payout destinations | [OpenAPI Provider verification and payout destinations](openapi/r1-p06-provider-verification-external-payout-destinations.yaml) | Implemented; phase Complete |
| R1-P08 Catalog, localization, and service requirements | [Protected Staff Catalog Swagger reference](../swagger/README.md#r1-p08--staff-catalog-management) | Implemented protected-management routes; active-phase validation and owner completion approval remain pending |
| Runtime API reference | [Interactive Swagger documentation](../swagger/README.md) | Implemented at `/api/v1/docs` |

Every document must state whether an endpoint is `Implemented`, `Prepared`, or
`Deprecated`. Prepared routes must not be presented as working APIs.

All responses follow `docs/standards/api-response-and-errors.md`.
Importable collections and the local environment are under `postman/`.
The phase-owned R1-P06 collection destination is
`postman/Cleanora-R1-P06-Provider-Verification.postman_collection.json`; it contains synthetic,
masked examples only, and generation plus validation pass with runtime parity.
The corresponding R1-P08 protected-management collection is
`postman/Cleanora-R1-P08-Catalog-Management.postman_collection.json`; it contains no
anonymous Browse request and is generated from the runtime R1-P08 OpenAPI
source.

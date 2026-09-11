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
| R1-P09 Provider services, pricing, and historical snapshots | [Provider services API](../api/provider-services.md) | Implemented protected Provider/Staff routes (11 operations); live migration gates require disposable `CLEANORA_R1_P09_DATABASE_URL` |
| R1-P10 Availability, capacity, and textual coverage | [OpenAPI availability contract](openapi/r1-p10-availability-capacity-textual-coverage.yaml) | Implemented protected Staff localities/time-zone and Provider availability routes (19 operations); phase Complete under DEC-061 |
| R1-P11 Eligibility Engine V1 | [Phase HTTP decision](../../specs/R1-P11-eligibility-engine-v1/contracts/http-api.md) | **Zero new HTTP / OpenAPI operations** (DEC-070 / DEC-072). In-process `evaluateEligibility`, `getStandardBrowseCandidates`, and `purgeExpiredEvaluations` only; Browse HTTP remains R1-P12 |
| R1-P12 Browse marketplace | [OpenAPI browse contract](openapi/r1-p12-browse-marketplace.yaml) | Implemented guest-capable Browse HTTP under DEC-086; P12 Complete (DEC-090) |
| R1-P13 Booking draft | [OpenAPI booking draft contract](openapi/r1-p13-booking-draft.yaml) | Implemented verified-customer draft/quote/cancel HTTP; payments and CONFIRMED remain later phases |

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
The R1-P09 protected Provider-services collection is
`postman/Cleanora-R1-P09-Provider-Services.postman_collection.json` (exactly 11
operations; no Browse/Booking); regenerate with `npm run postman:generate:r1-p09`.
The R1-P10 protected availability collection is
`postman/Cleanora-R1-P10-Availability-Capacity-Textual-Coverage.postman_collection.json`
(exactly 19 operations; no customer/Browse/Booking evaluation); regenerate with
`npm run postman:generate:r1-p10`.

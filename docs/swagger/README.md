# Cleanora Swagger Documentation

Status: The runtime Swagger contract began in R1-P02. R1-P02A preserved it
while simplifying the source structure; completed R1-P10 adds the implemented
protected Staff localities/time-zone and Provider availability surface
described below. Phase completion is recorded under DEC-061.

## Runtime endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/docs` | Professional interactive Swagger UI |
| `GET` | `/api/v1/docs/openapi.json` | Complete machine-readable OpenAPI 3.1 contract |

The runtime contract is defined in `src/swagger/openapi.document.ts`. It
documents the currently implemented system-health, authentication, and
protected-management API surfaces.

## R1-P10 — Availability, capacity, and textual coverage

Swagger presents the R1-P10 operations under **Staff Localities**, **Staff
Country Time Zone**, and **Provider Availability**. Every operation is protected
by bearer authentication and the phase authorization boundary, and is mounted
only under:

```text
/api/v1/staff/configuration
/api/v1/providers/:providerId/availability
```

The documented Staff surface covers city/district management and per-country
IANA time-zone reads/writes. The Provider surface covers textual coverage,
Provider and Worker calendars, capacity, and temporary pause start/resume.
Write commands show the required command controls: a UUID idempotency key and
an expected version (Staff locality creates also require an approved privileged
reason code).

There is deliberately no customer, anonymous, Browse, Booking, Eligibility, or
reservation evaluation HTTP operation in this phase. Internal availability
readers remain TypeScript module-public contracts and are absent from Swagger.

The generated importable companion is
`postman/Cleanora-R1-P10-Availability-Capacity-Textual-Coverage.postman_collection.json`.
It contains synthetic values and the same protected-only boundary.

## R1-P08 — Staff Catalog management

Swagger presents the R1-P08 operations under the **Staff Catalog** tag. Every
operation is protected by the existing bearer-authentication and staff Catalog
authorization boundary, and is mounted only under:

```text
/api/v1/staff/catalog
```

The documented surface includes localized categories and services, activation
and ordering, country availability, price units and service fields/options,
and service-media association/upload/reorder/removal commands. Write commands
show the required command controls: an idempotency key, the approved
`catalog_management_change` reason code, and an expected version when the
operation is versioned.

Activation is intentionally stricter than draft saving: required Arabic and
English content must be complete before a category, service, price unit, or
field configuration can become selectable. Swagger does not document fallback
from one locale to the other.

There is deliberately no anonymous or customer Catalog Browse HTTP operation
in this phase. The Catalog definition reader used by future booking work is a
small module-public TypeScript contract, not an HTTP API, so it is also absent
from Swagger. Service-media delivery examples stay in the protected management
surface and do not expose persistent storage URLs.

The generated importable companion is
`postman/Cleanora-R1-P08-Catalog-Management.postman_collection.json`. It contains
synthetic values and the same protected-only boundary.

## Documentation conventions

- Every operation has a stable `operationId`, summary, detailed description,
  access model, request contract, success response, relevant failure responses,
  and frontend usage guidance.
- JSON responses follow the Cleanora success/failure envelope and include
  `requestId`.
- Bearer and refresh-cookie authentication are documented separately.
- Passwords, OTPs, reset credentials, access tokens, cookies, provider secrets,
  connection strings, and internal errors never appear as usable examples.
- Google browser endpoints document redirects rather than pretending the
  callback is a normal JSON API.
- The interactive page does not persist Swagger authorization between reloads.
- R1-P08 Catalog examples use Arabic and English together for any item intended
  to be activated; incomplete examples are explicitly inactive drafts.
- R1-P10 examples use synthetic locality and schedule values only; they never
  expose customer contact data or reservation behavior.

## Local use

Start the server:

```bash
npm run dev
```

Open:

```text
http://localhost:8000/api/v1/docs
```

Swagger UI assets are loaded from the pinned
`swagger-ui-dist@5.17.14` browser distribution because local npm package
installation is not available in the current environment. The OpenAPI document
and documentation endpoints themselves are served locally by Cleanora.

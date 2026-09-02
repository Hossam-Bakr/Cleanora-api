# Cleanora Swagger Documentation

Status: The runtime Swagger contract began in R1-P02. R1-P02A preserved it
while simplifying the source structure; the active R1-P08 phase adds the
implemented protected Staff Catalog management surface described below. This
documentation does not signal phase completion or owner approval.

## Runtime endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/docs` | Professional interactive Swagger UI |
| `GET` | `/api/v1/docs/openapi.json` | Complete machine-readable OpenAPI 3.1 contract |

The runtime contract is defined in `src/swagger/openapi.document.ts`. It
documents the currently implemented system-health, authentication, and
protected-management API surfaces.

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


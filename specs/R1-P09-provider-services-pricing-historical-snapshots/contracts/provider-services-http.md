# Planned HTTP Contract: Provider Services and Pricing

**Status**: Design only — none of these routes, schemas, DTOs, OpenAPI paths,
or Postman requests is implemented.

All routes use the existing Cleanora response envelope:

```json
{
  "success": true,
  "data": {},
  "requestId": "server-correlation-id",
  "meta": {}
}
```

Failures use the existing `success: false` envelope with a stable error code,
status, safe message, request ID, and allowlisted details only.

## Common Boundary Rules

- Every route is protected by the existing access-token middleware.
- Provider routes require the trusted principal's active Provider-admin global
  authority plus active OWNER or ADMIN membership for the exact approved
  Provider.
- Staff routes require `providers.services.prices.approve`, mapped only to
  active `staff_admin`.
- Mutation objects are strict. Unknown fields—including `subtotal`, `total`,
  `tax`, `fee`, `discount`, `commission`, `deposit`, `payable`, or equivalent
  client monetary results—produce `REQUEST_VALIDATION_FAILED`.
- `idempotencyKey` is a UUID string. Create requires `expectedVersion: 0`; all
  later mutations require a positive integer expected version.
- Monetary input is an untrimmed string matching
  `^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$`; whitespace, signs, exponent notation,
  grouping, leading zeros, trailing dot, and excess currency precision are
  rejected. Business rules then require values > 0.
- Notes are either both omitted/null or both strings that become 1–1000
  characters after trimming. Stored values are trimmed.
- Price/lifecycle/Staff reasons become 1–1000 characters after trimming.
- List queries use the existing opaque cursor convention and `limit` from 1 to
  100, default 25.

## Core Management DTOs

### `ProviderServiceManagementDto`

```text
id: string
providerId: string
catalogService:
  id: string
  code: string
  version: integer
  selectableForProviderCountry: boolean
enabled: boolean
estimatedDurationMinutes: integer
notes:
  ar: string | null
  en: string | null
version: integer
effectivePrice: ProviderServicePriceManagementDto | null
pendingPrice: ProviderServicePriceManagementDto | null
usability:
  usable: boolean
  blockerCodes: approved DEC-051 blocker code[]
createdAt: ISO-8601 string
updatedAt: ISO-8601 string
```

The Catalog public reference returns the existing service ID/code even when the
service is currently unselectable, with
`selectableForProviderCountry=false`. The Provider table never stores a copied
current code/name/label. An unexpected failure to resolve the FK-backed
reference maps to `PROVIDER_SERVICE_DEPENDENCY_FAILED`; no fabricated marker is
returned and Providers never reads Catalog persistence directly.

### `ProviderServicePriceManagementDto`

```text
id: string
status: PENDING | EFFECTIVE | REJECTED | SUPERSEDED
catalogPriceUnit:
  id: string
  codeAtProposal: string
currencyCode: string
currencyDecimalPlaces: integer
price: canonical decimal string
minimumCharge: canonical decimal string
approvalRequiredAtProposal: boolean
effectiveAt: ISO-8601 string | null
rejectedAt: ISO-8601 string | null
supersededAt: ISO-8601 string | null
createdAt: ISO-8601 string
```

Management DTOs never expose receipt fingerprints, `safeResultJson`, raw audit
context, transaction values, or another Provider's data.

## Provider Routes

### GET `/api/v1/providers/:providerId/services`

Lists the exact Provider's offerings ordered by `(createdAt, id)`.

Query: `cursor?`, `limit?`.

Response: `ProviderServiceManagementDto[]`; `meta.nextCursor` when present.

### POST `/api/v1/providers/:providerId/services`

Creates one disabled offering and one retained initial price atomically.

```json
{
  "catalogServiceCode": "STANDARD_HOME_CLEANING",
  "catalogPriceUnitId": "price-unit-id",
  "price": "250.00",
  "minimumCharge": "300.00",
  "estimatedDurationMinutes": 120,
  "noteAr": "ملاحظات اختيارية",
  "noteEn": "Optional notes",
  "expectedVersion": 0,
  "idempotencyKey": "00000000-0000-4000-8000-000000000001"
}
```

`noteAr` and `noteEn` may both be omitted. Currency, approval policy, maximum,
Provider scope, actor, Catalog service identity, and unit code are server-owned.

Fresh success: `201` with `ProviderServiceManagementDto`, version 1, disabled.
Matching replay: `200` with the original DTO and `meta.replayed=true`.

### GET `/api/v1/providers/:providerId/services/:providerServiceId`

Returns exact-Provider management detail. Cross-Provider and unknown IDs share
the same non-enumerating `PROVIDER_SERVICE_NOT_FOUND` response.

### PUT `/api/v1/providers/:providerId/services/:providerServiceId/configuration`

Replaces only duration and the optional localized note pair. It never creates
or mutates a price.

```json
{
  "estimatedDurationMinutes": 150,
  "noteAr": null,
  "noteEn": null,
  "expectedVersion": 4,
  "idempotencyKey": "00000000-0000-4000-8000-000000000002"
}
```

Success/replay: `200` with the current `ProviderServiceManagementDto` and
`meta.replayed` when applicable.

### POST `/api/v1/providers/:providerId/services/:providerServiceId/price-proposals`

Creates a new retained price proposal. It never edits an older row.

```json
{
  "catalogPriceUnitId": "price-unit-id",
  "price": "275.00",
  "minimumCharge": "325.00",
  "reason": "Updated operating cost",
  "expectedVersion": 5,
  "idempotencyKey": "00000000-0000-4000-8000-000000000003"
}
```

Success: `201` for a fresh accepted proposal, `200` for replay. The response is
the exact Provider's management DTO and makes effective versus pending truth
explicit. It never returns a client-calculated total.

### POST `/api/v1/providers/:providerId/services/:providerServiceId/lifecycle`

```json
{
  "action": "ENABLE",
  "reason": "Offering is ready for use",
  "expectedVersion": 6,
  "idempotencyKey": "00000000-0000-4000-8000-000000000004"
}
```

`action` is exactly `ENABLE` or `DISABLE`. An enable checks every current
DEC-051 condition. A disable is immediate for an authorized member and needs no
price approval. Success/replay: `200`.

### GET `/api/v1/providers/:providerId/services/:providerServiceId/price-history`

Returns authorized price history ordered `(createdAt, id)`, with cursor
pagination. Each item contains price ID, event, safe before/after commercial
facts, actor ID, safe reason, request ID, resulting aggregate version, and
created time. It excludes receipt hashes/results and Admin audit internals.

### GET `/api/v1/providers/:providerId/services/:providerServiceId/status-history`

Returns only `OFFERING_ENABLED`/`OFFERING_DISABLED` rows ordered
`(createdAt, id)`. Each item contains from/to enabled state, actor ID, reason,
request ID, resulting aggregate version, and time. Internal creation/
configuration receipt rows are excluded.

## Staff Routes

### GET `/api/v1/staff/providers/service-price-proposals`

Query: `countryCode?`, `cursor?`, `limit?`.

Returns pending proposals only, ordered `(createdAt, id)`, with Provider ID,
Provider Service ID/version, price ID, Catalog service/unit identities,
canonical amounts/currency, proposal time, and safe Provider display identity.
It excludes Provider contacts, receipt data, and raw audit.

An older retained pending proposal may remain readable when the country's
current policy no longer requires approval, but it is not decidable unless the
fresh decision-time policy check permits the Staff workflow.

### GET `/api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId`

Returns a Staff-safe pending dossier plus the currently effective price when
one exists. Unknown, non-pending, and mismatched scope use a safe not-found or
state-conflict outcome without exposing another proposal.

### POST `/api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId/decisions`

```json
{
  "decision": "APPROVE",
  "reason": "Price evidence accepted",
  "expectedVersion": 7,
  "idempotencyKey": "00000000-0000-4000-8000-000000000005"
}
```

`decision` is exactly `APPROVE` or `REJECT`. A fresh decision requires the
current country policy to still require approval. A matching completed replay
is returned after current Staff and exact-target authorization but before the
fresh current-policy/version checks, so a later policy change cannot invalidate
the original idempotent outcome. Success/replay: `200` with a Staff-safe result
that identifies the decision, resulting version, decided price state, and
current effective price ID; it never includes hidden audit context.

## Status and Error Catalog

| Code | HTTP | Meaning / safe behavior |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | Shape, strict-field, syntax, UUID, cursor, duration, notes, or reason failure. |
| `PROVIDER_SERVICE_PRICE_INVALID` | 400 | Decimal scale/value/minimum/maximum rule failed without echoing sensitive context. |
| `PROVIDER_SERVICE_FORBIDDEN` | 403 | Trusted identity, global capability, exact membership, or Staff permission denied. |
| `PROVIDER_SERVICE_NOT_FOUND` | 404 | Unknown or non-enumerating wrong-Provider management target. |
| `PROVIDER_SERVICE_PROVIDER_STATE_INVALID` | 409 | Provider is not approved or cannot perform this operation. |
| `PROVIDER_SERVICE_ALREADY_EXISTS` | 409 | Provider already selected this Catalog service. |
| `PROVIDER_SERVICE_VERSION_CONFLICT` | 409 | Expected aggregate version is stale. |
| `PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT` | 409 | Same scoped key has different canonical content. |
| `PROVIDER_SERVICE_CATALOG_UNAVAILABLE` | 409 | Catalog service is not currently selectable for this country. |
| `PROVIDER_SERVICE_PRICE_UNIT_UNAVAILABLE` | 409 | Selected unit is not currently active/allowed for the service. |
| `PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE` | 503 | Required country/currency/policy facts are missing, inactive, invalid, or unsupported. |
| `PROVIDER_SERVICE_ENABLE_BLOCKED` | 409 | Enable failed; allowlisted details contain only approved blocker codes. |
| `PROVIDER_SERVICE_PRICE_APPROVAL_NOT_REQUIRED` | 409 | Staff decision is not permitted by current country policy. |
| `PROVIDER_SERVICE_PRICE_NOT_PENDING` | 409 | Target cannot receive a Staff decision. |
| `PROVIDER_SERVICE_SNAPSHOT_CONFLICT` | no HTTP route | Internal Provider/Catalog state drift exceeded the bounded retry policy. |
| `PROVIDER_SERVICE_DEPENDENCY_FAILED` | 502 | Unexpected public-contract or persistence dependency failure; no internal detail exposed. |

No route returns stack traces, SQL/Prisma messages, database URLs, raw role
grants, private Provider contacts, pending values to anonymous/current-safe
consumers, or hidden Staff approval metadata.

## OpenAPI and Postman

Implementation must define these exact 11 protected operations in
`src/swagger/r1-p09-openapi.paths.ts`, merge them in
`src/swagger/openapi.document.ts`, generate only these operations into
`postman/Cleanora-R1-P09-Provider-Services.postman_collection.json`, and prove
route/OpenAPI/Postman method/path/schema/security parity. No anonymous Browse or
Booking request may appear.

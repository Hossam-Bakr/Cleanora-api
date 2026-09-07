# Data Model: R1-P09 Provider Services and Pricing

**Status**: Planned only. No Prisma model, table, enum, constraint, index,
trigger, or migration described here has been created.

## Aggregate and Ownership

`ProviderService` is the aggregate root. A single integer version serializes
offering creation/configuration, price proposals, lifecycle commands, and Staff
price decisions. `ProviderServicePrice` contains retained commercial proposals.
The two history models are append-only evidence and also retain durable command
receipts so R1-P09 does not add a fifth table.

All four models and their repositories belong to Providers. Foreign keys to
Provider, Catalog, Configuration, and Authentication identities provide
structural integrity but do not transfer behavior or read ownership.

```text
Provider 1 ── * ProviderService * ── 1 Catalog.Service
                     │
                     ├── * ProviderServicePrice ── 1 Catalog.ServicePriceUnit
                     │             │              └── 1 Configuration.Currency
                     │             └── 1 Configuration.Country (proposal context)
                     ├── * ProviderServicePriceHistory
                     └── * ProviderServiceStatusHistory
```

## Planned Enums

### `ProviderServicePriceStatus`

| Value | Meaning |
|---|---|
| `PENDING` | Accepted proposal waiting for the Staff decision required at proposal time; never current effective truth. |
| `EFFECTIVE` | The sole current effective price for the offering. |
| `REJECTED` | Retained proposal explicitly rejected by authorized Staff. |
| `SUPERSEDED` | Retained prior pending or effective proposal replaced by a later accepted transition. |

### `ProviderServicePriceHistoryEvent`

- `PRICE_PROPOSED_PENDING`
- `PRICE_EFFECTIVE_IMMEDIATE`
- `PRICE_APPROVED`
- `PRICE_REJECTED`
- `PRICE_SUPERSEDED_PENDING`
- `PRICE_SUPERSEDED_EFFECTIVE`

### `ProviderServiceStatusHistoryEvent`

- `OFFERING_CREATED`
- `CONFIGURATION_UPDATED`
- `OFFERING_ENABLED`
- `OFFERING_DISABLED`

The first two values are internal aggregate-state/command-receipt evidence.
Only the last two are returned from the management status-history endpoint.

## Planned Model: `ProviderService`

**Table**: `provider_services`

| Field | Planned Prisma/PostgreSQL shape | Rules |
|---|---|---|
| `id` | `String @id @default(cuid())` | Stable Provider Service identity. |
| `providerId` | `String` | Required FK to `providers.id`, `ON DELETE RESTRICT`. |
| `catalogServiceId` | `String` | Required FK to `services.id`, `ON DELETE RESTRICT`; identity reference only. |
| `enabled` | `Boolean @default(false)` | Provider-controlled state; never rewritten by Catalog/config changes. |
| `estimatedDurationMinutes` | `Int` | Whole minutes, 1–1440. |
| `noteAr` | `String? @db.VarChar(1000)` | Null together with EN or trimmed 1–1000 characters. |
| `noteEn` | `String? @db.VarChar(1000)` | Null together with AR or trimmed 1–1000 characters. |
| `version` | `Int @default(1)` | Aggregate version; positive and incremented exactly once per accepted mutation. |
| `createdAt` | `DateTime @default(now())` | Creation time. |
| `updatedAt` | `DateTime @updatedAt` | Current aggregate update time. |

### Provider Service constraints

- Primary key: `id`.
- Unique: `(provider_id, catalog_service_id)`; one offering per Provider and
  Catalog service.
- Supporting unique keys: `(id, provider_id)` and `(id, catalog_service_id)` for
  composite child foreign keys.
- Check `estimated_duration_minutes BETWEEN 1 AND 1440`.
- Check `version >= 1`.
- Notes check:
  - both null; or
  - both non-null, equal to their trimmed values, and each character length is
    1–1000.
- Index `(provider_id, enabled, id)` for readiness/list scans.
- Index `(catalog_service_id, provider_id)` for reference impact probes.
- No delete HTTP/service/repository operation. FK deletion is `RESTRICT`.

## Planned Model: `ProviderServicePrice`

**Table**: `provider_service_prices`

| Field | Planned Prisma/PostgreSQL shape | Rules |
|---|---|---|
| `id` | `String @id @default(cuid())` | Retained proposal identity. |
| `providerId` | `String` | Structural scope; composite FK proves the offering belongs to this Provider. |
| `providerServiceId` | `String` | Required Provider Service parent. |
| `catalogServiceId` | `String` | Structural identity repeated only to enforce price-unit/service compatibility. |
| `catalogPriceUnitId` | `String` | FK to `service_price_units.id`, `ON DELETE RESTRICT`. |
| `priceUnitCodeAtProposal` | `String @db.VarChar(64)` | Immutable Catalog code snapshot for authorized history evidence. |
| `countryIdAtProposal` | `String` | FK to `countries.id`, `ON DELETE RESTRICT`; immutable proposal context. |
| `countryCodeAtProposal` | `String @db.VarChar(2)` | Immutable proposal context returned by Configuration. |
| `currencyId` | `String` | FK to `currencies.id`, `ON DELETE RESTRICT`. |
| `currencyCode` | `String @db.VarChar(3)` | Immutable currency code snapshot. |
| `currencyDecimalPlaces` | `Int` | Immutable configured scale at acceptance, 0–30. |
| `providerPriceMinorUnits` | `Decimal @db.Decimal(65,0)` | Positive whole minor-unit value derived from the authoritative decimal string. |
| `minimumChargeMinorUnits` | `Decimal @db.Decimal(65,0)` | Positive whole minor-unit value not less than `providerPriceMinorUnits`. |
| `maximumPriceMinorUnitsAtProposal` | `Decimal @db.Decimal(65,0)` | Immutable accepted country-bound minor-unit snapshot; both amounts must not exceed it. |
| `approvalRequiredAtProposal` | `Boolean` | Immutable explanation of initial state. |
| `status` | `ProviderServicePriceStatus` | Mutable only through the approved transition table below. |
| `proposedByUserId` | `String` | FK to `users.id`, `ON DELETE RESTRICT`. |
| `effectiveAt` | `DateTime?` | First time the row became effective; retained after later supersession. |
| `rejectedAt` | `DateTime?` | Present only for rejected rows. |
| `supersededAt` | `DateTime?` | Present only for superseded rows. |
| `createdAt` | `DateTime @default(now())` | Accepted proposal time. |

### Provider Service Price constraints

- Primary key: `id`.
- Supporting unique `(id, provider_service_id, provider_id)` for history FKs.
- Composite FK `(provider_service_id, provider_id)` →
  `provider_services(id, provider_id)`.
- Composite FK `(provider_service_id, catalog_service_id)` →
  `provider_services(id, catalog_service_id)`.
- Supporting unique index `(id, service_id)` on Catalog-owned
  `service_price_units`; composite FK
  `(catalog_price_unit_id, catalog_service_id)` →
  `service_price_units(id, service_id)`. This is structural only; Providers code
  still validates through `CatalogDefinitionReader`.
- FK `country_id_at_proposal` → `countries.id`, `RESTRICT`.
- FK `currency_id` → `currencies.id`, `RESTRICT`.
- Check `provider_price_minor_units > 0`.
- Check `minimum_charge_minor_units > 0 AND minimum_charge_minor_units >=
  provider_price_minor_units`.
- Check `maximum_price_minor_units_at_proposal > 0`, both amount columns ≤ that
  value, and every minor-unit column is an exact `numeric(65,0)` integer.
- Check `currency_decimal_places BETWEEN 0 AND 30`.
- Boundary parsing must reject any canonical decimal whose scale exceeds
  `currency_decimal_places` or whose zero-padded minor-unit digit string exceeds
  65 digits. Output formatting inserts the decimal point from the recorded
  scale and appends required leading/trailing zeros without rounding.
- Check uppercase ISO-shaped country/currency and stable price-unit code
  snapshots.
- Status/timestamp check:
  - `PENDING`: all transition timestamps null;
  - `EFFECTIVE`: `effective_at` non-null and reject/supersede null;
  - `REJECTED`: `rejected_at` non-null, effective/supersede null;
  - `SUPERSEDED`: `superseded_at` non-null, reject null, and `effective_at` may
    be null (formerly pending) or non-null (formerly effective).
- Partial unique index on `provider_service_id WHERE status = 'PENDING'`.
- Partial unique index on `provider_service_id WHERE status = 'EFFECTIVE'`.
- Index `(provider_service_id, created_at, id)` for price history/current detail.
- Index `(provider_id, status, created_at, id)` for the Staff pending queue.
- Trigger rejects `DELETE` and any `UPDATE` to identity, commercial,
  proposal-context, approval-at-proposal, actor, or creation columns. Only
  status and its transition timestamps may change.

## Planned Model: `ProviderServicePriceHistory`

**Table**: `provider_service_price_history`

| Field | Shape and purpose |
|---|---|
| `id` | CUID primary key. |
| `providerId` | Provider identity required by history scope. |
| `providerServiceId` | Aggregate identity. |
| `providerServicePriceId` | Retained price identity. |
| `event` | `ProviderServicePriceHistoryEvent`. |
| `fromStatus` | Nullable prior status. |
| `toStatus` | Required resulting status. |
| `actorUserId` | Trusted Provider member or Staff actor FK, `RESTRICT`. |
| `reasonCode` | Required stable action/transition reason code, max 100. |
| `reasonText` | Trimmed caller/Staff reason when required, max 1000; otherwise null. |
| `safeBefore` | Nullable allowlisted JSON commercial state. |
| `safeAfter` | Required allowlisted JSON commercial state. |
| `requestId` | Required server correlation, max 200. |
| `aggregateVersion` | Resulting Provider Service version, positive. |
| `scopeKey` | Nullable primary-receipt command scope, max 240. |
| `idempotencyKey` | Nullable caller key, max 200. |
| `requestFingerprint` | Nullable SHA-256 hex digest, `char(64)`. |
| `safeResultCode` | Nullable original success code, max 100. |
| `safeResultJson` | Nullable allowlisted original response for replay. |
| `operationKey` | Required unique deterministic event identity, max 240. |
| `createdAt` | Immutable event time. |

### Price history integrity

- Composite FK `(provider_service_price_id, provider_service_id, provider_id)`
  → `provider_service_prices(id, provider_service_id, provider_id)`.
- FK `actor_user_id` → `users.id`, `RESTRICT`.
- Receipt fields are all null for a secondary transition row or all present for
  a primary command row.
- Partial unique `(scope_key, idempotency_key)` where both are non-null.
- Index `(provider_id, provider_service_id, created_at, id)`.
- Index `(provider_service_price_id, created_at, id)`.
- Index `(actor_user_id, created_at)` and `(request_id, event)`.
- Check `aggregate_version >= 1` and lowercase SHA-256 shape.
- Trigger rejects every `UPDATE` and `DELETE`.

## Planned Model: `ProviderServiceStatusHistory`

**Table**: `provider_service_status_history`

| Field | Shape and purpose |
|---|---|
| `id` | CUID primary key. |
| `providerId` | Provider identity. |
| `providerServiceId` | Aggregate identity. |
| `event` | `ProviderServiceStatusHistoryEvent`. |
| `fromEnabled` | Null for creation; otherwise prior Provider-controlled state. |
| `toEnabled` | Resulting Provider-controlled state. |
| `actorUserId` | Trusted OWNER/ADMIN actor FK, `RESTRICT`. |
| `reasonCode` | Required stable action code, max 100. |
| `reasonText` | Trimmed lifecycle reason for ENABLE/DISABLE, max 1000; null for derived create/configuration codes. |
| `safeBefore` | Nullable allowlisted offering state. |
| `safeAfter` | Required allowlisted offering state. |
| `requestId` | Required server correlation, max 200. |
| `aggregateVersion` | Resulting aggregate version, positive. |
| `scopeKey` | Required command scope for one primary receipt. |
| `idempotencyKey` | Required caller key. |
| `requestFingerprint` | Required SHA-256 digest, `char(64)`. |
| `safeResultCode` | Required original success code. |
| `safeResultJson` | Required allowlisted original response. |
| `operationKey` | Required unique event identity, max 240. |
| `createdAt` | Immutable event time. |

### Status history integrity

- Composite FK `(provider_service_id, provider_id)` →
  `provider_services(id, provider_id)`.
- FK `actor_user_id` → `users.id`, `RESTRICT`.
- Unique `(scope_key, idempotency_key)` and unique `operation_key`.
- Index `(provider_id, provider_service_id, created_at, id)`.
- Index `(actor_user_id, created_at)` and `(request_id, event)`.
- Event/value checks:
  - creation: `from_enabled IS NULL`, `to_enabled=false`;
  - configuration: `from_enabled=to_enabled`;
  - enabled: `from_enabled=false`, `to_enabled=true`, reason text present;
  - disabled: `from_enabled=true`, `to_enabled=false`, reason text present.
- Check `aggregate_version >= 1` and lowercase SHA-256 shape.
- Trigger rejects every `UPDATE` and `DELETE`.

## State Transitions

### Offering

```text
CREATE (expectedVersion 0)
  └─ disabled, version 1

disabled --ENABLE--> enabled
enabled  --DISABLE--> disabled

configuration replacement preserves enabled and increments version once
Catalog/config changes never alter enabled or append Provider status history
```

An ENABLE command is accepted only when a current Catalog definition, selected
active price unit, effective price, country/default currency/policy, duration,
and note pair all pass. A DISABLE command never needs price approval.

### Price

```text
new proposal + approvalRequired=true  -> PENDING
new proposal + approvalRequired=false -> EFFECTIVE

PENDING   --Staff APPROVE--> EFFECTIVE
PENDING   --Staff REJECT-->  REJECTED
PENDING   --new proposal-->  SUPERSEDED
EFFECTIVE --new immediately-effective proposal or Staff approval--> SUPERSEDED
```

`REJECTED` and `SUPERSEDED` are terminal. Commercial columns never change.

## Aggregate Concurrency

- All mutations carry exact `expectedVersion`; create carries `0`.
- A fresh transaction updates/creates the aggregate only after receipt lookup
  and exact-provider authorization.
- Later mutations use a compare-and-increment guarded by
  `(id, provider_id, version)`. Zero affected rows maps to
  `PROVIDER_SERVICE_VERSION_CONFLICT` and changes nothing.
- The unit of work uses a serializable transaction and constructs Catalog,
  Configuration, Authentication, and Admin participants through composition-
  supplied public factories over an opaque transaction context. Provider
  domain/services never receive the raw transaction. Prisma/PostgreSQL
  serialization, partial-unique, and offering-unique races map to stable
  conflicts.
- One accepted command advances the aggregate by exactly one, even when it
  creates a new price and supersedes both a pending and an effective price.
  Every history row produced by that command records the same resulting
  aggregate version.

## Idempotency Receipt Rules

The scope key includes the exact aggregate identity and command kind. Because a
create replay must not depend on current Catalog availability, creation uses
the deterministic `(providerId, normalizedCatalogServiceCode, CREATE)` scope;
later commands use the existing Provider Service identity. A primary history
row stores:

```text
scopeKey + idempotencyKey + requestFingerprint
safeResultCode + safeResultJson
```

- Matching scope/key/hash returns the stored result without rerunning current
  Catalog/config/version validation.
- Matching scope/key with a different hash returns
  `PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT` and changes nothing.
- A concurrent duplicate that loses the unique race rereads the winning receipt
  and applies the same comparison.
- Invalid, unauthorized, stale, or conflicting operations write no domain
  receipt/history row. Separately authorized denial audit remains Admin-owned.

## Current and Historical Projections

- Current effective price: the sole `ProviderServicePrice` with
  `status=EFFECTIVE`, then revalidated against current Configuration and Catalog
  facts before a safe current result.
- Pending management price: the sole `status=PENDING` row, visible only to the
  exact Provider's OWNER/ADMIN and authorized Staff.
- Price history: all authorized price events ordered `(createdAt, id)`.
- Status history: only ENABLE/DISABLE events ordered `(createdAt, id)`; internal
  creation/configuration receipt rows are not part of that response.
- Safe internal snapshot: current effective only; never includes pending,
  rejected, superseded, Staff reasons, receipt hashes, or raw history.

## Delete and Retention Policy

R1-P09 defines no hard-delete route, service method, repository port, or cascade
for any of the four models. Database FKs use `RESTRICT`; history triggers reject
updates/deletes; price triggers reject deletes and commercial rewrites. Future
retention changes would require a separately approved phase and forward
migration.

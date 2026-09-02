# R1-P08 Repository Baseline and Lean Architecture Research

**Status:** Complete — repository research and planning decisions resolved
**Date:** 2026-08-30

## Purpose

Record the current Cleanora architecture facts that R1-P08 planning must reuse
so the phase fits the existing modular monolith without premature abstraction.
This file records the evidence and resolved design choices used by
`speckit-plan`.

## Observed repository facts

### Existing modules and composition

- Runtime business modules are currently `admin`, `authentication`,
  `configuration`, `customers`, `media`, and `providers`. No Catalog runtime
  module exists yet.
- `src/composition.ts` constructs concrete services and adapters directly.
  `src/routes/index.ts` is the single visible HTTP route map.
- Module conventions favor a compact `routes/controller/service/repository/
  schema` layout, with optional files only when behavior requires them.
- Cross-module calls use explicit named public files. One-line barrels,
  repository imports across modules, and generic interface-per-implementation
  layers are prohibited.

### Configuration seam

- `configuration.public.ts` already exposes `ActiveCountryReader` and
  `ActiveCountryAndCurrencyReader` using ISO `countryCode` and optional opaque
  transaction context.
- R1-P08 should reuse this contract for country validation. It does not need a
  second country repository, copied country model, country cache, or Catalog-
  owned country lifecycle.

### Authentication and staff authorization seam

- Authentication owns the finite roles, permissions, role mappings, and
  protected-operation declarations.
- Existing staff roles are `staff_admin`, `staff_operations`, `staff_support`,
  and `staff_finance`; holding one never implies another's permissions.
- `ProtectedOperationAuthorizer` is the general public authorization seam.
  R1-P08 will need additive Catalog permission and operation declarations after
  the owner decides the exact staff authority. Catalog must not inspect role
  tables or import Authentication internals.
- Reusing the protected-operation pattern is sufficient; a new authorization
  framework or Catalog-specific role system would be over-engineering.

### Admin audit seam

- `admin/audit.public.ts` exposes business-neutral privileged,
  general-transactional, and denial-audit contracts without Prisma types.
- Privileged audit inputs already support required reason, safe before/after
  context, actor, target, request ID, and timestamp.
- Catalog should own each catalog mutation transaction and append required
  audit evidence through an injected Admin-owned transaction writer. It should
  not create a second audit table or make Admin own Catalog truth.
- The roadmap does not require a Catalog mutation-history table. Live Catalog
  records carry current version truth, Admin audit carries privileged mutation
  evidence, and later Booking records own their copied historical snapshots.
  Adding a Catalog history table now would duplicate audit and anticipate a
  future consumer without an approved R1-P08 use case.

### Media seam and the association gap

- Media owns `media_files`, storage provider details, processing state,
  cleanup, and delivery. Its public file currently exposes Provider, Worker,
  Customer, and verification-specific contracts, but no Catalog media
  eligibility/receipt contract.
- `MediaOwnerType` has no Catalog value. `MediaFile` has no Catalog relation and
  requires `ownerUserId`.
- The R1-P08 roadmap includes service media and lists `media_files` as a
  modified table, but the frozen architecture inventory does not name a
  Catalog-owned media-association table.
- The final plan must choose the smallest boundary-safe representation. The
  leading technical option is one Catalog-owned ordered association table that
  references a Media-owned READY asset, plus the minimum additive Media owner
  type/public eligibility port needed for platform catalog images. This is a
  proven active-phase data need, but it must be documented as an explicit
  architecture inventory addition rather than silently hidden in
  `media_files`.
- Putting service lifecycle or association columns directly on `media_files`
  would make Media own Catalog business meaning and is rejected.

### Persistence and migration baseline

- The current schema ends at the R1-P07 migration and contains no Catalog
  models.
- `Country.code` is the unique two-character country key and Country owns
  activity/default locale/supported locale truth.
- `AuditLog` already stores actor, action, target, reason, safe context,
  request ID, and timestamp.
- R1-P08 must use one new forward-only migration after
  `r1_p07_worker_team_crew_management`; applied migrations remain immutable.
- The proposed migration name is
  `r1_p08_catalog_localization_service_requirements`.

### Testing baseline

- Unit tests belong under `tests/unit`; PostgreSQL and public-route journeys
  belong under `tests/integration` using Vitest/Supertest.
- Database-changing phases require isolated clean-install and populated-upgrade
  proof, without Docker/Testcontainers or an unknown `.env` database.
- Authorization denial, invalid transitions, idempotency, concurrency,
  migration/seed compatibility, Media boundaries, and safe error behavior are
  phase risks requiring direct evidence.

## Resolved planning decisions

### Decision: one Catalog module and service aggregate

**Decision**: Add one `src/modules/catalog/` module. Category is one aggregate;
Service is a second aggregate that owns translations, price units,
fields/options, country availability, and media presentation. The service
integer version changes for every accepted nested configuration or media change.
Category changes that alter current service definitions also bump all affected
child-service versions in the same transaction.

**Rationale**: These records change together and form one snapshot-ready service
definition. One version makes stale UI updates and later consumer snapshots
unambiguous without versioning every child independently.

**Alternatives considered**:

- Separate modules for taxonomy, localization, and forms: rejected as premature
  internal fragmentation.
- Independent version on every child row: rejected because clients would need a
  fragile version vector for one service definition.
- One global Catalog version: rejected because unrelated service edits would
  conflict and serialize unnecessarily.

### Decision: explicit two-locale storage without a generic i18n platform

**Decision**: Keep the canonical `service_translations` table with one
`AR`/`EN` row per service. Store category, price-unit, field, and option Arabic
and English values in explicit nullable bilingual columns on their canonical
tables. Application activation checks require both trimmed values; reads never
fall back.

**Rationale**: The product locks exactly two locales and the frozen phase table
inventory names only service translations. Explicit columns keep validation,
indexes, and DTO mapping simple while nullable values support inactive drafts.

**Alternatives considered**:

- Translation tables for every localized entity: rejected as four unapproved
  tables and join-heavy genericization for two fixed locales.
- JSON localization maps: rejected because locale keys/completeness are harder
  to constrain and query safely.
- Cross-locale fallback: rejected by DEC-041.

### Decision: service-scoped price units

**Decision**: `service_price_units` contains the units allowed for one service,
identified by stable code within that service and presented with bilingual
labels. Later Provider pricing refers to the chosen service-price-unit identity.

**Rationale**: This follows the canonical table name and R1-P08 ownership while
avoiding a global unit catalog plus a second join table. It does not store a
price amount.

**Alternatives considered**:

- Global `price_units` plus `service_allowed_price_units`: rejected because
  neither table is in the phase inventory and no cross-service administration
  use case requires it.
- Free-text unit on future Provider pricing: rejected because it would bypass
  Catalog validation.

### Decision: full-replacement service configuration

**Decision**: One management PUT replaces translations, price units,
fields/options, and country availability atomically under the service expected
version. Stable child codes preserve IDs; omitted units/fields/options are
retained inactive and omitted countries become unavailable. Category/service
identity/lifecycle/order and service media use focused commands.

**Rationale**: The configuration is small, ordered, and validated as one graph.
Full replacement prevents partial child edits and gives Cursor a smaller,
testable API than nested CRUD for every row.

**Alternatives considered**:

- Separate CRUD endpoint for every child: rejected as excessive surface and
  more race/partial-state cases.
- One unrestricted generic patch document: rejected because field-kind and
  lifecycle invariants would become opaque.

### Decision: no anonymous Browse HTTP in R1-P08

**Decision**: Expose protected staff management HTTP only. Selectable and
snapshot-ready reads are provided through `catalog.public.ts` for later module
consumers. R1-P08 adds no anonymous/customer Catalog list or detail route.

**Rationale**: FR-050 excludes browsing and canonical product decisions assign
anonymous Browse to R1-P12. The internal contract still proves selectability and
snapshot readiness without shipping future-phase UX early.

**Alternatives considered**:

- Anonymous `/catalog/services` endpoints: rejected as R1-P12 scope.
- Authenticated customer Browse preview: rejected because no R1-P08 customer
  journey or authorization contract requires it.

### Decision: one Catalog-owned media association table

**Decision**: Add `service_media_associations` with `serviceId`, unique
`mediaFileId`, and contiguous display position. Extend Media with
`CATALOG_SERVICE_IMAGE` plus narrow ingest, transaction-bound READY eligibility,
safe delivery, and cleanup contracts. Catalog orchestrates a resumable upload
reservation but never owns storage state.

**Rationale**: Ordering and service association are Catalog business facts,
while file status/storage remain Media facts. The association table is the
smallest boundary-safe representation even though the high-level inventory did
not name it explicitly.

**Alternatives considered**:

- Put `serviceId` and position on `media_files`: rejected because Media would
  own and mutate Catalog state.
- Polymorphic `(entityType, entityId)` association: rejected because R1-P08
  authorizes service media only and polymorphism loses a real service FK.
- Category media: rejected because the roadmap specifies service media only.

### Decision: persistent command receipts and media reservation

**Decision**: Add `catalog_command_requests` keyed by command scope and
idempotency key, storing request fingerprint, status, target reference,
accepted version, and an optional reserved Media ID. Ordinary commands complete
the receipt inside the Catalog transaction. Service-image upload reserves the
receipt/media ID in a short transaction, performs Media I/O, then finalizes
association/audit/receipt atomically; a retry resumes the same reservation.

**Rationale**: FR-035 requires restart-safe idempotency. The special reservation
keeps external image I/O outside long transactions without creating duplicate
files on retries.

**Alternatives considered**:

- Reuse `audit_logs`: rejected because audit ownership and retention semantics
  differ from command deduplication.
- In-memory idempotency: rejected because it fails after restart or on another
  process.
- Hold a database transaction during image processing: rejected because it
  creates long locks around external I/O.

### Decision: exact-version locks and deterministic ordering

**Decision**: Use transaction-scoped advisory locks for idempotency identities,
row locks in stable category/service/child order, exact integer expected
versions, and full order arrays normalized to zero-based contiguous positions.

**Rationale**: This produces one winner for concurrent mutations and avoids
unique-position swap collisions or partial ordering.

**Alternatives considered**:

- Last-write-wins: rejected by FR-034/FR-035.
- Fractional positions: rejected because the expected Catalog is small and
  rebalancing adds no product value.

### Decision: create-if-missing seed ownership

**Decision**: The DEC-044 seed creates missing stable-code records with active,
complete initial values but uses empty update branches for existing records. It
does not reactivate, reorder, or rewrite owner-managed values. No Media file is
seeded.

**Rationale**: A clean database receives a usable Egypt Catalog, while repeated
runs preserve staff-managed truth and remain deterministic.

**Alternatives considered**:

- Force canonical seed values on every run: rejected because it would overwrite
  application-managed content.
- Seed inactive placeholders only: rejected by DEC-044.
- Seed multiple services: rejected by DEC-044 as unapproved breadth.

## Lean proposed module shape

The final plan should start with the smallest cohesive module and add files only
when tasks prove they carry behavior:

```text
src/modules/catalog/
├── catalog.routes.ts
├── catalog.controller.ts
├── catalog.service.ts
├── catalog.repository.ts
├── catalog.schema.ts
└── catalog.public.ts
```

Likely additions such as a transaction repository, policy file, or domain
catalog constants must be justified by concrete invariants; they are not part
of the default scaffold.

## Dependency direction and transaction ownership

```text
HTTP -> Catalog routes/controller -> Catalog service -> Catalog repository/Prisma
                                      |-> Authentication public authorization
                                      |-> Configuration public country facts
                                      |-> Media public eligibility/receipt facts
                                      `-> Admin public audit writer

Providers / Eligibility / Bookings (later phases) -> catalog.public.ts
```

- Catalog owns Catalog business transactions and persistence mutations.
- Configuration, Authentication, Media, and Admin retain their own persistence
  and expose only the minimum public facts Catalog needs.
- Direct application calls are preferred. No internal event is currently
  justified because R1-P08 has no asynchronous cross-module side effect.
- Later consumers receive stable Catalog DTOs/facts, never Prisma models or
  Catalog repository access.

## Explicitly rejected over-engineering

- No microservice, service discovery, RPC, message broker, or event bus.
- No generic localization/i18n platform outside Catalog.
- No arbitrary JSON-Schema form engine or executable expression language for
  service fields.
- No generic admin CRUD generator or global repository.
- No new shared business layer for Catalog codes, price units, or field rules.
- No provider offering/pricing, eligibility, browse, booking, snapshot
  persistence, frontend, or notification behavior ahead of its roadmap phase.
- No cache until a measured R1-P08 read requirement proves one is necessary.
- No background worker for ordinary catalog state changes.

## Owner decisions and remaining plan blockers

- DEC-041 approves strict Arabic/English completeness before activation or
  selectability and prohibits cross-locale read fallback. Localized records may
  remain incomplete only while inactive.
- DEC-042 approves the closed Release 1 field-kind set: `INFORMATION`, `TEXT`,
  `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, and `MULTI_SELECT`, with only compatible
  display, length, numeric-mode/bound, option, and selection-count constraints.
- DEC-043 approves separate `catalog.management.read` and
  `catalog.management.write` permissions mapped only to active `staff_admin`;
  no other staff role receives protected Catalog access.
- DEC-044 approves the minimal complete Egypt seed: one active
  `HOME_CLEANING` category, one active `STANDARD_HOME_CLEANING` service,
  `PER_VISIT` and `PER_HOUR`, five representative fields, and active `EG`
  availability. The seed must not decide OQ-002.

No material owner product choice remains before technical planning. The service-media
association representation is a Codex architecture decision to document after
the product specification is clarified; it does not authorize broader media or
future-phase scope.

### Lean lifecycle interpretation of DEC-041

- The R1-P08 roadmap requires active/inactive status and does not authorize a
  third Catalog lifecycle state.
- An incomplete saved record is therefore an inactive draft; `draft` describes
  how staff are using the inactive record, not a separate `DRAFT` enum value.
- Activation is the single guarded transition that proves bilingual and other
  selectability prerequisites. Adding a separate draft state, transition graph,
  API actions, and tests would not add approved R1-P08 behavior.

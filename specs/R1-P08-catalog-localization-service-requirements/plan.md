# Implementation Plan: Catalog, Localization & Service Requirements

**Branch**: `r1-p08-catalog-localization-service-requirements` | **Date**:
2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: R1-P08 specification, DEC-041 through DEC-044, canonical product
rules, and the owner's authorization to progress through reviewed implementation
while preserving all Git, production, and phase-completion approval boundaries.

## Summary

Add one cohesive `catalog` module for platform-owned categories, services,
strict Arabic/English content, service-scoped price units, the closed six-kind
field model, country availability, ordered service images, protected staff
management, selectable reads, and snapshot-ready current facts. Catalog owns
its transactions and persistence. Authentication authorizes two Catalog
operations, Configuration supplies authoritative country facts, Media owns file
processing/delivery, and Admin owns privileged audit persistence. The phase adds
one forward-only migration named
`r1_p08_catalog_localization_service_requirements` and a minimal idempotent Egypt
seed. It does not implement Provider offerings/prices, eligibility, browse,
bookings, customer answers, frontend, Docker/cloud, or deployment.

## Technical Context

**Language/Version**: Node.js 24+, TypeScript 6.0, CommonJS package with
ESM-style `.js` imports

**Primary Dependencies**: Express 5.2, Zod 4.4, Prisma 7.9 with PostgreSQL
adapter, Sharp 0.35, Cloudinary 2.10

**Storage**: Existing PostgreSQL database through centralized
`prisma/schema.prisma`; Media-owned private/authenticated object storage for
service images

**Testing**: Vitest 4, Supertest 7, isolated PostgreSQL integration suites,
repository OpenAPI/Postman validators, phase-scoped and full coverage gates

**Target Platform**: Existing Cleanora modular-monolith HTTP backend

**Project Type**: Single deployable backend modular monolith; no R1-P08 frontend

**Performance Goals**: Deterministic indexed management/selectable reads and
bounded pagination; no invented request-latency SLO beyond the measurable
product outcomes in `spec.md`

**Constraints**: Strict AR/EN activation with no fallback; active
`staff_admin`-only management; deny by default; privileged reason and atomic
audit; exact-version CAS; persistent idempotency; no external Media I/O inside
Catalog business transactions; no Docker/Testcontainers in Release 1

**Scale/Scope**: Five user stories, FR-001–FR-052, SC-001–SC-012, one initial
Egypt category/service, and a backend-only Catalog vertical slice

## Constitution Check

### Pre-research gate

| Principle | Result | Evidence |
|---|---|---|
| I. Standalone greenfield | PASS | Only repository-local modules, PostgreSQL, and the existing Media storage adapter are used. |
| II. One active phase and traceability | PASS | `docs/product/current.md` names only R1-P08; all FRs and build-verifiable SCs must map to tasks and evidence. |
| III. Modular-monolith ownership | PASS | Catalog owns catalog behavior/persistence and calls only named public seams for Authentication, Configuration, Media, and Admin. |
| IV. Global design/local implementation | PASS | Only R1-P08 tables/fields are planned in one incremental phase migration. |
| V. Canonical truth/no invention | PASS | DEC-041–DEC-044 close localization, field-kind, authority, and seed choices; OQ-002 remains explicitly neutral. |
| VI. Authority/integrity/security | PASS | Server-side validation, protected operations, CAS, idempotency, atomic privileged audit, and safe Media references are explicit. |
| VII. Risk-proportional evidence | PASS | Localization, authorization, audit, field policies, races, seed, migration, Media, and contract tests are planned. |
| VIII. Human controls | PASS | Implementation may proceed from frozen tasks; phase completion, Git, production migration, deployment, and destructive actions still require their own approvals. |
| IX. Release boundaries | PASS | No stored-value wallet, Docker/cloud, Provider pricing, eligibility, Booking, frontend, or later-phase model is introduced. |
| X. Immutable migrations | PASS | Existing migrations remain unchanged; one forward-only R1-P08 migration follows R1-P07. |

### Post-design gate

PASS. `research.md`, `data-model.md`, `authorization-matrix.md`,
`migration-plan.md`, `test-strategy.md`, `quickstart.md`, and the contracts under
`contracts/` preserve all ten principles. Two architecture-inventory additions
are explicitly justified in Complexity Tracking: one Catalog-owned service-
media association table and one Catalog-owned idempotency table. Neither adds a
future capability or changes ownership.

## Architecture and Ownership

### Catalog owns

- Category and service stable codes, inactive-draft/active lifecycle, localized
  presentation, ordering, aggregate versions, service price units, fields,
  options, country availability, service-media associations, command
  idempotency, management DTOs, selectable DTOs, and snapshot-ready current DTOs.
- `CatalogService` as the application coordinator and
  `PrismaCatalogRepository` as the Catalog transaction/repository owner.
- All Catalog writes, including safe before/after facts, service aggregate
  version changes, command receipts, and the call to the transaction-bound Admin
  privileged audit writer.

### Authentication owns

- Additive permission definitions `catalog.management.read` and
  `catalog.management.write`, both mapped only to `staff_admin`.
- Protected operation declarations with operation IDs matching the permission
  codes. The write operation is privileged and uses
  `CATALOG_MANAGEMENT_WRITE` plus the active reason
  `catalog_management_change`.
- `ProtectedOperationAuthorizer`; Catalog never reads roles, permissions,
  grants, or reason tables directly.

### Configuration owns

- Country identity and active state. Catalog uses `ActiveCountryReader` or its
  transaction-bound factory to resolve `EG` and other country codes.
- Catalog stores only `countryId` on availability rows and exposes the
  authoritative country code in DTOs.

### Media owns

- Image validation/normalization, storage keys, object storage, processing
  status, cleanup, and signed delivery.
- Add `CATALOG_SERVICE_IMAGE` to the Media owner-type catalog and expose a
  narrow Catalog image port for ingest, READY eligibility, safe receipt facts,
  delivery, and cleanup. The uploader's trusted staff user ID remains the
  technical `ownerUserId`; Catalog owns the service association and presentation
  order.
- External image processing/storage occurs outside Catalog transactions. The
  final association transaction rechecks READY eligibility through a
  transaction-bound Media public contract. Failed finalization requests Media
  cleanup and exposes no partial service association.

### Admin owns

- `audit_logs`, audit safety/redaction rules, and the transaction-bound
  `PrivilegedAuditWriter` factory. Catalog provides only allowlisted IDs, codes,
  versions, lifecycle flags, positions, and outcome facts—never localized text,
  storage keys, signed URLs, request bodies, or binary data.

## Dependency Direction

```text
HTTP -> Catalog routes/controller -> CatalogService -> Catalog repository/Prisma
                                      |-> Authentication public authorization
                                      |-> Configuration public country reader
                                      |-> Media public Catalog-image contracts
                                      `-> Admin public privileged audit writer

Providers / Eligibility / Browse / Bookings (later) -> catalog.public.ts
```

Direct application calls are sufficient. R1-P08 introduces no event bus,
background worker, cache, shared business repository, or internal network hop.

## Public HTTP Contract Direction

The design OpenAPI contract is
`contracts/catalog-api.openapi.yaml`. It documents the protected management
surface only:

1. `/api/v1/staff/catalog/*` management routes authenticated with the existing
   access-token middleware and authorized by the read/write protected
   operations. Management reads may expose inactive drafts and versions.

`catalog.public.ts` is the separate module contract for exact-locale/country
selectable and snapshot-ready current facts. It returns management-neutral DTOs
and no Prisma/repository types. R1-P08 adds no anonymous/customer Catalog HTTP;
public Browse remains R1-P12.

To keep the API small, service translations, price units, fields/options, and
country availability are replaced atomically through one versioned service-
configuration PUT. Service images remain separate because Media I/O has
different failure semantics. Every management mutation carries
`expectedVersion`, `idempotencyKey`, and the approved `reasonCode`; create and
collection-order commands use the exact version vector defined in the contract.

## Data and Localization Direction

The canonical phase tables remain:

- `service_categories`
- `services`
- `service_translations`
- `service_price_units`
- `service_fields`
- `service_field_options`
- `service_country_availability`
- modified `media_files`

Two narrowly required Catalog tables are added and documented in the
architecture inventory during implementation:

- `service_media_associations` for Catalog-owned service/order meaning without
  moving file lifecycle into Catalog or service lifecycle into `media_files`;
- `catalog_command_requests` for FR-035 persistent idempotency without using
  Admin audit as an idempotency store.

`service_translations` uses one row per service and locale because that table is
canonical. Category, price-unit, field, and option records use explicit nullable
`nameAr`/`nameEn`, `descriptionAr`/`descriptionEn`, or `labelAr`/`labelEn`
columns because R1-P08 has exactly two locked locales; extra translation tables
or a generic i18n platform would add no approved behavior. Nullable localized
values permit inactive drafts. Activation policies require every applicable AR
and EN value after trimming.

Service is the aggregate/version boundary for translations, price units,
fields/options, availability, and media order. Category is its own aggregate.
Any category change that affects current service definitions bumps versions for
the category's child services in the same transaction, so a service's integer
version remains the snapshot-ready current definition revision.

## Transaction, Idempotency, and Lock Strategy

The fixed order for ordinary Catalog commands is:

1. transaction-scoped advisory lock for `(actor/scope, idempotencyKey)`;
2. existing idempotency receipt lookup and request-fingerprint comparison;
3. affected categories by ascending ID;
4. affected services by ascending ID;
5. service translations, price units, fields/options, availability, then media
   associations by ascending ID/position;
6. authoritative country and transaction-bound Media eligibility reads;
7. aggregate writes/version increments;
8. privileged audit append;
9. completed command receipt insert/update.

Authorization is checked before work and rechecked for the final transaction.
Exact expected versions are checked after locks. A stale, conflicting,
unauthorized, invalid, or dependency-failed command commits no Catalog business
row, version, ordering, association, accepted receipt, or success audit.

Service-image upload uses a resumable idempotency reservation because binary
processing is external I/O: a short transaction reserves one stable media ID
against the request fingerprint; Media ingest is idempotent by that media ID;
then the final Catalog transaction rechecks authorization/version/READY state,
inserts the association, bumps the service, appends audit, and completes the
receipt. A retry resumes the same reservation. A failed finalization requests
cleanup; the pending technical receipt never makes the image selectable.

## Lifecycle and Validation

- Inactive is the only draft state. No `DRAFT` enum or additional workflow.
- Category activation requires complete trimmed Arabic/English name and
  description.
- Service activation requires an active parent category, complete AR and EN
  service translations, at least one active complete price unit, and a valid
  field graph when fields are present. A service may have zero active fields;
  country availability determines selectability, not lifecycle.
- Price units, fields, and options may be incomplete only while inactive. Active
  selectable children must be bilingual and kind-compatible.
- `INFORMATION`, `TEXT`, `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, and
  `MULTI_SELECT` enforce DEC-042 exactly. Options exist only for select kinds.
- Category deactivation immediately removes every child service from selectable
  reads without deleting identities or silently rewriting child lifecycle.
- Reordering is full replacement, requires the exact current ID set, normalizes
  positions to contiguous zero-based integers, and rejects duplicates/omissions.
- No category, service, field, option, or price-unit hard-delete endpoint exists.

## Seed Direction

`prisma/seed.ts` composes one Catalog seed function that uses stable-code
create-if-missing behavior and the same Catalog policies as management. On a
clean database it creates active:

- category `HOME_CLEANING`;
- service `STANDARD_HOME_CLEANING`;
- price units `PER_VISIT` and `PER_HOUR`;
- fields for localized preparation information, optional non-negative integer
  bedroom count, optional non-negative integer bathroom count, optional pet
  presence, and optional special
  instructions (maximum 1000 characters);
- availability for authoritative `EG`.

The initial localized copy follows DEC-044 and remains neutral on OQ-002. Empty
update branches preserve later staff-managed content, ordering, lifecycle, and
versions. The seed creates no Media file. Double-run tests assert stable IDs and
exact counts.

## Security, Privacy, Errors, and Observability

- All management routes use trusted principals and deny by default. Catalog
  never accepts actor IDs or role claims from request bodies.
- Failure envelopes use repository-standard stable error codes. 403 protects
  authorized-resource distinctions; selectable absence uses a safe 404 or empty
  list; validation is 400; stale/idempotency conflicts are 409; Media dependency
  failure is a safe 503.
- Localized management content is not PII, but logs/audit still exclude text and
  request bodies to prevent accidental sensitive content ingestion.
- Structured logs include request ID, operation, safe target ID/code, outcome,
  and duration. Metrics remain existing process-level signals; no new telemetry
  service or tracing dependency is introduced.
- Signed Media URLs are short-lived safe delivery references. Storage provider,
  storage key, uploader identity, binary metadata beyond the safe DTO, and Media
  failure details never cross Catalog responses.

## Test and Evidence Strategy

`test-strategy.md` defines unit, PostgreSQL integration, Supertest contract,
migration/seed, authorization/audit, localization, field-kind, lifecycle,
idempotency/concurrency, Media failure/cleanup, error-redaction, OpenAPI/Postman,
coverage, and module-boundary evidence. Clean chronological installation and a
populated R1-P07 upgrade must use explicitly isolated phase-named targets. No
Docker/Testcontainers or unknown repository `.env` database is permitted.

## Project Structure

### Documentation (this feature)

```text
specs/R1-P08-catalog-localization-service-requirements/
├── activation.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── authorization-matrix.md
├── migration-plan.md
├── test-strategy.md
├── quickstart.md
├── implementation-prompt.md
├── contracts/
│   ├── catalog-api.openapi.yaml
│   ├── catalog-public-contract.md
│   └── transaction-boundaries.md
├── checklists/
└── tasks.md
```

### Expected implementation paths

```text
prisma/schema.prisma
prisma/migrations/r1_p08_catalog_localization_service_requirements/migration.sql
prisma/seed.ts
src/modules/catalog/catalog.routes.ts
src/modules/catalog/catalog.controller.ts
src/modules/catalog/catalog.service.ts
src/modules/catalog/catalog.repository.ts
src/modules/catalog/catalog.schema.ts
src/modules/catalog/catalog.public.ts
src/modules/catalog/catalog.policy.ts
src/modules/catalog/catalog.errors.ts
src/modules/authentication/authentication.public.ts
src/modules/authentication/domain/authorization.catalog.ts
src/modules/authentication/domain/authorization.types.ts
src/modules/media/media.public.ts
src/modules/media/domain/media.types.ts
src/modules/media/domain/media.ports.ts
src/modules/media/infrastructure/prisma-media.repository.ts
src/composition.ts
src/routes/index.ts
src/swagger/r1-p08-openapi.paths.ts
src/swagger/openapi.document.ts
scripts/generate-r1-p08-postman.ts
scripts/validate-r1-p08-upgrade.ts
tests/unit/catalog/
tests/unit/modules/
tests/integration/catalog/
tests/integration/http/
tests/integration/database/
```

**Structure Decision**: Add exactly one Catalog module and extend only named
public seams. Do not put Catalog rules in `shared`, add a localization module,
or give Catalog direct access to another module's repository.

## Implementation Phases

1. Authorization/Media public-contract additions and Catalog policy foundation.
2. Schema, phase migration, SQL review, Catalog repository/unit-of-work, and
   idempotency primitives.
3. Category/service management, configuration replacement, lifecycle, ordering,
   and privileged audit.
4. Service-image ingest/association, safe delivery, cleanup, and failure paths.
5. Internal selectable/snapshot-ready Catalog public contracts with an explicit
   no-anonymous-Browse guard.
6. Egypt seed, OpenAPI/Postman/runtime composition, migration proofs, coverage,
   boundary review, and completion evidence.

Detailed dependency-ordered implementation work belongs to `tasks.md`.

## Complexity Tracking

| Addition | Why required | Simpler alternative rejected | Ownership/approval |
|---|---|---|---|
| `service_media_associations` | Service media needs Catalog-owned ordering and lifecycle meaning while Media owns files. | Put `serviceId`/position on `media_files`; rejected because Media would own Catalog business state and Catalog could not mutate atomically with its audit/version. | Catalog; active-phase architecture decision under FR-038–FR-041. |
| `catalog_command_requests` | FR-035 requires durable retry/idempotency and concurrent duplicate suppression. | Reuse `audit_logs` or in-memory keys; rejected because Admin audit is not an idempotency store and memory is not restart-safe. | Catalog; active-phase integrity requirement. |

No constitutional exception or future-phase abstraction is introduced.

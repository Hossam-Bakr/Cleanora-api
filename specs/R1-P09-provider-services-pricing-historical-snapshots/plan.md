# Implementation Plan: Provider Services, Pricing & Historical Snapshots

**Branch**: Current checkout remains `main`; no implementation branch has been
created. The eventual feature branch is planned as
`r1-p09-provider-services-pricing-historical-snapshots` and requires separate
human authorization.

**Date**: 2026-09-05

**Spec**: [spec.md](./spec.md)

**Status**: Planning completed and analyzed — no application source, tests,
Prisma schema, migration SQL, API artifact, runtime configuration, or
implementation was created or changed by this plan.

## Summary

R1-P09 extends the existing Providers module so an approved Provider's active
OWNER or ADMIN can select a currently selectable Catalog service, maintain a
disabled-by-default Provider offering, propose decimal-safe prices in the
Provider country's active default currency, and explicitly enable or disable
the offering. Providers owns current offering state, retained price rows,
append-only price and status/configuration history, aggregate concurrency,
idempotent command receipts, and the `servicesReady` contribution.

The implementation will add exactly the four roadmap tables through one
forward-only migration. Catalog, Configuration, Authentication, and Admin stay
authoritative behind narrow public contracts. Safe current reads dynamically
revalidate Catalog selectability and country pricing configuration, so later
Catalog or Configuration changes can make an offering unusable without
rewriting Provider-controlled state. A Providers-owned internal reader will
return one bounded, copy-ready Provider/Catalog/effective-price value for a
later Booking owner; R1-P09 creates no Browse or Booking behavior or storage.

## Technical Context

**Language/Version**: TypeScript 6.0 in strict NodeNext mode; Node.js 24+

**Primary Dependencies**: Express 5.2, Zod 4.4, Prisma Client/CLI 7.9,
`@prisma/adapter-pg` 7.9, PostgreSQL driver 8.16

**Storage**: Existing PostgreSQL database through Prisma; one additive
R1-P09 migration named
`r1_p09_provider_services_pricing_historical_snapshots`

**Testing**: Vitest 4.1, Supertest 7.2, existing disposable PostgreSQL migration
proof harnesses; no Docker or Testcontainers

**Target Platform**: Existing Cleanora modular-monolith backend

**Project Type**: Single deployable backend modular monolith

**Performance Goals**: No new product SLA is invented. Management lists remain
cursor-paginated and bounded; snapshot consistency retries a failed whole
repeatable-read transaction at most three times before returning a stable
conflict.

**Constraints**: Exactly four R1-P09 tables; no new business module; decimal
strings at boundaries and exact integer minor units in PostgreSQL
`numeric(65,0)`/Prisma `Decimal` internally; no
binary floating point; no hard delete; no anonymous/customer HTTP; no Booking
persistence; `eligibleForPublicBrowse=false`; no production Provider offering
or price seed data; no production country policy value is invented.

**Scale/Scope**: One existing Providers capability, four user stories, four
tables, two protected HTTP route groups, three additive cross-module public
contract seams, one internal Providers reader, and one phase-specific test and
migration-validation gate.

## Authority and Inputs

This plan is derived from the repository-local R1-P09 roadmap section, the
active phase pointer, the constitution, `AGENTS.md`, DEC-036, DEC-041–DEC-046,
the five accepted R1-P09 decisions DEC-047–DEC-051, the entity-ownership and
master-ERD documents, the Catalog and Providers public contracts, OQ-002 and
OQ-004, and the current Prisma/migration history. The planning artifacts do not
override those authorities.

Implementation must stop rather than invent a production value for the
country-required Provider-service pricing policy. The code may define and read
the policy shape, tests may create deterministic fixtures, and missing policy
data must fail closed. Supplying production country values is an owner-operated
configuration action outside this planning workflow.

## Constitution Check

### Pre-design gate

| Principle | Result | Evidence and planned control |
|---|---|---|
| I. Standalone Greenfield Product | PASS | All authority and dependencies are repository-local; no external repository, schema, or undocumented service is used. |
| II. One Active Phase and Complete Traceability | PASS | `docs/product/current.md` names R1-P09; `spec.md`, this plan, later `tasks.md`, and checklists remain in one feature directory with FR/SC mappings. |
| III. Modular Monolith Ownership | PASS | Providers owns all four tables and use cases; cross-module access is only through `*.public.ts` contracts; no new module is planned. |
| IV. Global Design, Local Implementation, Incremental Migration | PASS | The design accounts for Catalog, Configuration, Authentication, Admin, and later Booking while implementation remains local and uses one forward migration. |
| V. Canonical Product Truth and No AI Invention | PASS | DEC-047–DEC-051 resolve the material behavior; OQ-002/OQ-004 stay neutral; production policy values are not fabricated. |
| VI. Backend Authority, Integrity, and Security | PASS | Trusted principal/scope, server-owned currency, decimal parsing, strict DTOs, optimistic concurrency, idempotency, and atomic audit are required. |
| VII. Risk-Proportional Testing and Evidence | PASS | Unit, HTTP, repository, live-DB, concurrency, idempotency, migration, architecture, privacy, OpenAPI/Postman, coverage, and repository gates are planned. |
| VIII. Human-Controlled Decisions and Operations | PASS | This plan performs no Git, database, deployment, production configuration, migration, or completion action; all remain human-controlled. |
| IX. Locked Release and Product Boundaries | PASS | No Docker/cloud, wallet, Browse, Booking, pricing engine, generic approval workflow, or future-phase work is planned. |
| X. Immutable Migrations and Phase-Owned Data | PASS | Applied migrations remain untouched; financial history is retained; no hard delete or destructive backfill is planned. |

### Post-design re-check

The same ten checks remain PASS after the detailed data, contract, consistency,
authorization, migration, and test design in this folder. There is no
constitution exception to justify and no complexity waiver.

## Design Overview

### Ownership and dependency direction

- `src/modules/providers/` owns orchestration, policies, repositories, unit of
  work, HTTP adapters, safe management DTOs, current-price selection, histories,
  command receipts, readiness, and the internal snapshot-ready reader.
- `src/modules/catalog/catalog.public.ts` remains the only Catalog seam. It will
  add Provider-consumer lookup by Catalog service ID plus a transaction-bound
  factory for the same reader interface while preserving Catalog-owned
  selectability/localization. Providers never imports a Catalog repository,
  policy, service implementation, Prisma type, or raw transaction.
- `src/modules/configuration/configuration.public.ts` will expose one resolved
  Provider-service pricing-policy reader containing active country/default
  currency facts, decimal places, approval-required, and maximum price. The
  shape is backed by a country-required Configuration key. A transaction-bound
  factory makes the same policy available inside the Providers snapshot; Providers
  never queries country, currency, or config tables.
- `src/modules/authentication/authentication.public.ts` will add the minimum
  Staff permission `providers.services.prices.approve` and transaction-bound
  recheck. Existing trusted Provider identity/global `provider_admin` authority
  is reused; no recent-authentication proof is added.
- `src/modules/admin/audit.public.ts` remains the only privileged audit seam.
  The Providers unit of work receives a transaction-bound public writer from
  composition so state, histories, receipt, and audit commit or roll back
  together.
- Booking remains absent. A later authorized composition consumer may call the
  Providers public reader and decide whether to persist the returned plain DTO.

### Command model and transaction order

Every mutation uses a strict body, trusted request principal, server request
correlation, a caller idempotency key, and an expected Provider Service
aggregate version. Offering creation uses `expectedVersion: 0`; an accepted
create establishes version `1`. Every later accepted mutation performs one
compare-and-increment and advances the aggregate exactly once.

The common flow is:

1. Authenticate and authorize the trusted actor for the exact Provider; reject
   caller-supplied actor/scope authority.
2. Validate the strict request and produce a canonical SHA-256 request
   fingerprint. Unknown monetary-total fields fail at the HTTP boundary.
3. Enter one Providers-owned serializable transaction. The Providers UoW
   constructs transaction-bound Catalog, Configuration, Authentication, and
   Admin public participants from composition-supplied factories; Provider
   domain/services never receive the raw transaction.
4. Recheck Provider state and exact membership or Staff permission, then look up
   the scoped receipt before current Catalog/config validation. The same key/hash
   returns the stored safe result even after later mutations; the same key with
   a different hash conflicts. Creation scopes by Provider plus normalized
   Catalog service code, so replay does not depend on current Catalog availability.
5. For a fresh command, read Catalog and/or Configuration facts through those
   transaction-bound public contracts; recheck the expected aggregate version;
   mutate current rows; append all required history rows; persist the primary
   command receipt; append Admin-owned audit; and commit once. This gives the
   accepted mutation one database snapshot/commit boundary across all owned
   persistence while preserving module APIs.
6. Map retryable serialization/unique races and stale writers to stable
   conflict outcomes. Never retry a business conflict as though it succeeded.

No repository orchestrates this sequence. The service owns it; repositories
only perform persistence operations supplied by the unit of work.

### Current state, retained prices, and append-only evidence

- `ProviderService` is the mutable aggregate root. It references a Provider and
  Catalog service by IDs, stores Provider-owned duration/notes/enabled state,
  and carries the single aggregate version. A newly created offering is always
  disabled; enablement is a separate reasoned command.
- `ProviderServicePrice` is a retained proposal. Its amount, minimum charge,
  selected Catalog unit identity/code snapshot, currency identity/code/scale
  snapshot, and approval-at-proposal flag never change. Only its lifecycle
  status and transition timestamps may advance.
- A partial unique index allows at most one `PENDING` row and at most one
  `EFFECTIVE` row per offering. The current effective price is selected by
  status, not by a caller-controlled pointer.
- `ProviderServicePriceHistory` records proposal creation and every accepted
  pending/effective/approved/rejected/superseded transition. Its primary row
  for a price or Staff-decision command also carries the scoped idempotency
  receipt and original safe result; secondary transition rows use derived
  unique operation keys.
- `ProviderServiceStatusHistory` records offering creation, Provider-owned
  configuration replacement, enablement, and disablement. Creation and
  configuration rows are internal state-history/receipt evidence; the
  management status-history projection returns only actual ENABLED/DISABLED
  transitions. This lets all non-price aggregate commands retain durable retry
  receipts without adding a fifth table.
- Both history tables have no update timestamp, no delete path, and SQL
  immutability triggers rejecting `UPDATE` and `DELETE`. Price rows reject
  deletion and reject updates to immutable commercial columns.

### Price and approval transitions

Provider price, minimum charge, and configured maximum are parsed from canonical
plain decimal strings using the current default currency scale, converted to
whole minor-unit digit strings, and persisted as exact
`Decimal(65,0)`/PostgreSQL `numeric(65,0)` values. Formatting reverses that
conversion using the retained currency scale; code performs no authoritative
money operation with JavaScript `number`. All minor-unit values must fit 65
digits. Both amounts must be positive, the minimum must be at least the price,
and both must not exceed the resolved country maximum. Currency scales outside
0–30, non-canonical/oversized maximum values, missing policy, inactive
country/currency, or mismatched currency fail closed.

- Approval disabled at proposal time: the new price becomes `EFFECTIVE`; any
  preceding pending and effective rows become `SUPERSEDED` in the same
  transaction.
- Approval required at proposal time: the new price becomes `PENDING`; any
  preceding pending row becomes `SUPERSEDED`; an earlier effective price stays
  `EFFECTIVE`.
- Staff approval: the pending row becomes `EFFECTIVE` and a prior effective row
  becomes `SUPERSEDED` atomically.
- Staff rejection: the pending row becomes `REJECTED`; a prior effective row
  is unchanged.
- If country approval configuration later changes, existing price rows do not
  transition automatically. Turning approval on affects new proposals only.
  Turning it off creates no new Staff work and does not auto-activate an old
  pending proposal; the next valid Provider proposal supersedes that pending
  row and becomes effective. Existing pending work may be read but Staff
  decisions require the currently resolved approval policy. This avoids an
  unaudited automatic price change.

All Provider price proposals and lifecycle commands require a trimmed reason;
Staff decisions require a permitted privileged reason. Derived transition
rows use stable reason codes such as `REPLACED_BY_NEW_PROPOSAL` rather than
invented caller text.

### Dynamic usability and readiness

No `servicesReady` boolean is persisted. A Providers-owned repeatable-read
snapshot evaluates enabled offerings against Providers rows and transaction-
bound current Catalog/Configuration facts. It reports `servicesReady=true` when
at least one offering satisfies DEC-051 and otherwise returns only the exact
approved blocker codes. A Catalog/config/country change therefore affects the
next snapshot without changing `ProviderService.enabled` or fabricating
history.

The existing marketplace-readiness policy consumes these facts and continues
to set `eligibleForPublicBrowse=false`. R1-P09 does not calculate LIVE status,
coverage, availability, schedule, capacity, or final eligibility.

### Snapshot consistency

The internal reader accepts Provider ID, Catalog service code, country code,
and exact locale. The Providers UoW opens one repeatable-read transaction and
constructs transaction-bound Catalog and Configuration public readers over the
same opaque context. Within that snapshot it resolves the immutable Catalog
code, reads the matching Provider offering/current effective price, obtains the
complete exact-locale Catalog definition, and evaluates every current country,
unit, currency, maximum, approval, duration, and note condition.

A successful value therefore comes from one database snapshot without passing
a raw transaction or foreign repository into Provider domain/service code. A
stable non-qualifying condition returns one opaque `UNAVAILABLE`. A retryable
serialization/snapshot failure retries the whole read at most three times and
then returns `CONFLICT`; it never returns a mixed view. No pending/rejected/
superseded price, Staff reason, private contact, raw row, or hidden approval
metadata is emitted.

## Planned HTTP Surface — Not Implemented

Provider management routes are authenticated and mounted below
`/api/v1/providers`. Staff approval routes are authenticated and mounted below
`/api/v1/staff/providers`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/providers/:providerId/services` | Cursor-paginated exact-Provider management list |
| POST | `/api/v1/providers/:providerId/services` | Create one disabled offering and its initial retained price (`expectedVersion: 0`) |
| GET | `/api/v1/providers/:providerId/services/:providerServiceId` | Exact-Provider management detail with effective/pending distinction |
| PUT | `/api/v1/providers/:providerId/services/:providerServiceId/configuration` | Replace estimated duration and optional AR/EN note pair |
| POST | `/api/v1/providers/:providerId/services/:providerServiceId/price-proposals` | Submit a retained replacement price proposal |
| POST | `/api/v1/providers/:providerId/services/:providerServiceId/lifecycle` | Explicit reasoned `ENABLE` or `DISABLE` command |
| GET | `/api/v1/providers/:providerId/services/:providerServiceId/price-history` | Cursor-paginated authorized price history |
| GET | `/api/v1/providers/:providerId/services/:providerServiceId/status-history` | Cursor-paginated enable/disable history |
| GET | `/api/v1/staff/providers/service-price-proposals` | Cursor-paginated pending queue for active Staff authority |
| GET | `/api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId` | Staff-safe pending dossier |
| POST | `/api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId/decisions` | Reasoned, versioned, idempotent `APPROVE` or `REJECT` |

There is no anonymous, customer, Browse, Provider Details, price-calculation,
or Booking HTTP operation. Strict Zod objects reject unknown totals, fees,
taxes, discounts, commissions, deposits, and payable amounts.

## Safe DTO and Error Policy

Management DTOs may expose the exact Provider's paired notes, current effective
price, pending proposal, retained price/status history, aggregate version, and
safe Catalog identity. They never expose raw Prisma objects, private contacts,
secrets, transaction data, internal URLs, stack traces, or raw Admin audit.

The internal snapshot DTO is narrower and exposes only one usable enabled
offering and effective price. Error mapping distinguishes validation,
authorization/not-found-safe scope denial, Provider state, Catalog/config
unavailability, approval state, stale aggregate version, idempotency conflict,
snapshot drift, and unexpected dependency failure. Cross-Provider detail and
history access use the same non-enumerating safe outcome as an unknown target.

## Project Structure

### Documentation for this feature

```text
specs/R1-P09-provider-services-pricing-historical-snapshots/
├── activation.md
├── preparation-prompt.md
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
│   ├── provider-services-http.md
│   └── provider-services-public-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Planned source changes — not created by planning

```text
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
    └── r1_p09_provider_services_pricing_historical_snapshots/
        └── migration.sql

src/modules/providers/
├── domain/
│   ├── provider-service.types.ts
│   ├── provider-service.ports.ts
│   ├── provider-service.errors.ts
│   ├── provider-service.policy.ts
│   ├── provider-service-authorization.policy.ts
│   └── provider-service-readiness.policy.ts
├── infrastructure/
│   ├── prisma-provider-service.repository.ts
│   ├── prisma-provider-service.unit-of-work.ts
│   └── provider-service-prisma-errors.ts
├── provider-service.service.ts
├── provider-service-query.service.ts
├── provider-service-snapshot.service.ts
├── provider-service.dto.ts
├── provider-service.schema.ts
├── provider-service.controller.ts
├── provider-service.routes.ts
└── providers.public.ts

src/modules/catalog/
├── catalog.public.ts
├── catalog.repository.ts
└── catalog.service.ts

src/modules/configuration/
├── config-key.catalog.ts
├── configuration.public.ts
├── configuration.repository.ts
└── configuration.service.ts

src/modules/authentication/
├── authentication.public.ts
├── authorization.policy.ts
├── domain/authorization.catalog.ts
├── domain/authorization.types.ts
└── infrastructure/prisma-r1-p06-security.adapters.ts

src/modules/admin/audit.public.ts
src/composition.ts
src/routes/index.ts
src/swagger/openapi.document.ts
src/swagger/r1-p09-openapi.paths.ts

scripts/generate-r1-p09-postman.ts
scripts/validate-clean-migration.ts
scripts/validate-r1-p09-upgrade.ts
postman/Cleanora-R1-P09-Provider-Services.postman_collection.json
vitest.r1-p09.config.ts
package.json

tests/
├── helpers/r1-p09-provider-services-fixtures.ts
├── unit/providers/provider-service-*.test.ts
├── unit/modules/r1-p09-*.test.ts
├── unit/modules/authentication/authorization-provider-services.test.ts
├── unit/scripts/validate-r1-p09-upgrade.test.ts
├── unit/swagger/r1-p09-*.test.ts
├── integration/providers/provider-service-*.test.ts
├── integration/http/provider-services-*.test.ts
└── integration/database/r1-p09-*.test.ts
```

**Structure Decision**: Extend the existing Providers vertical using one
service for commands, one management query service, one internal snapshot
service, one repository/UoW pair, and thin HTTP adapters. Public-contract
changes stay in the owning modules. No repository, generic workflow, pricing
engine, approval framework, event bus, queue, cache, worker, or new deployable
is introduced.

## Migration and Verification Summary

The planned migration adds exactly `provider_services`,
`provider_service_prices`, `provider_service_price_history`, and
`provider_service_status_history`, plus their enums, constraints, indexes,
foreign keys, and immutability triggers. It may add supporting unique indexes
to existing referenced Catalog identities but will not edit any applied
migration or backfill Provider offerings/prices.

Migration proof must cover chronological clean installation, populated R1-P08
upgrade preservation, exact migration history, live uniqueness/FK/check/partial
unique/immutability probes, decimal round trips, idempotent redeployment, and
absence of destructive SQL. Details are in [migration-plan.md](./migration-plan.md).

## Test and Quality Summary

Implementation follows test-first ordering per story. The phase-specific suite
will include Providers policies and services, cross-module public contracts,
repository and HTTP behavior, two-writer and retry races, Catalog/config drift,
readiness and snapshot consistency, audit/redaction, migration contracts,
OpenAPI/Postman parity, and module-boundary guards. Coverage retains the
repository's 80% statements/functions/lines and 75% branches thresholds for the
phase include set. Full repository lint, typecheck, tests, coverage, build,
documentation, OpenAPI, Postman, Prisma validation, and approved disposable-DB
gates are planned but were not run during planning. See
[test-strategy.md](./test-strategy.md).

## Complexity Tracking

No constitution violation or exception is required. The two history tables
also carry scoped command receipts because the authorized model permits only
the four roadmap tables; this is a bounded reuse of phase-owned append-only
evidence, not a generic command framework or fifth entity.

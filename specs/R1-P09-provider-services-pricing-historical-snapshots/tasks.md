# Tasks: R1-P09 Provider Services, Pricing & Historical Snapshots

**Input**: Design artifacts in
`specs/R1-P09-provider-services-pricing-historical-snapshots/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`authorization-matrix.md`, `migration-plan.md`, `test-strategy.md`,
`contracts/`, and `quickstart.md`

**Tests**: Required. Write each story's focused tests first and observe the
expected failure before implementing that behavior.

**Status**: T001–T084 checked against fresh review evidence. Technically ready
for the separately authorized Git workflow; human phase completion is pending.
No staging, commit, push, merge, deployment, production migration, or R1-P10.

## Format

- `[P]` means the task can proceed in parallel after its stated prerequisites
  because it targets different files.
- `[US#]` maps the task to the corresponding prioritized user story.
- Every task cites its primary FR/SC or acceptance evidence.

## Phase 1: Setup and Evidence Baseline

**Purpose**: Re-establish the authorized phase boundary and phase-specific test
scaffold before product code.

- [x] T001 Revalidate `main`, the human-approved base commit, current R1-P09 pointer, clean/intended worktree paths, and no future-phase activation; record the exact pre-implementation evidence in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-045–FR-046; SC-011–SC-012).
- [x] T002 [P] Add the serial R1-P09 include set and 80/75/80/80 coverage thresholds from `test-strategy.md` in `vitest.r1-p09.config.ts` (FR-043; SC-012).
- [x] T003 Add `test:r1-p09`, `test:coverage:r1-p09`, `postman:generate:r1-p09`, and `db:validate-r1-p09-upgrade` scripts and append R1-P09 to the aggregate Postman generator in `package.json` (FR-040, FR-043; SC-012).
- [x] T004 [P] Create deterministic Provider/Catalog/country-pricing-policy fixtures and cross-module fakes without production data in `tests/helpers/r1-p09-provider-services-fixtures.ts` (FR-003–FR-006, FR-012, FR-028, FR-046; SC-001–SC-002).
- [x] T005 Create the implementation evidence headings for task IDs, commands, coverage, SQL review/hash, clean/upgrade proof, API parity, privacy/boundary results, limitations, and remaining work in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-041–FR-046; SC-011–SC-012).

---

## Phase 2: Foundational Ownership, Contracts, and Data Integrity

**Purpose**: Add test-first shared seams and the four-table Provider-owned
foundation that blocks every story.

**Critical**: Do not start story implementation until T006–T021 pass their
focused tests.

### Foundational tests first

- [x] T006 [P] Add failing tests for the country-required `providers.service_pricing_policy`, active default currency ID/code/scale, canonical maximum-to-minor-unit conversion, transaction-bound reader, missing/invalid fail-closed behavior, and no invented production values in `tests/unit/modules/r1-p09-configuration-public-contract.test.ts` (FR-012–FR-013, FR-028–FR-030, FR-046; SC-002, SC-007–SC-008).
- [x] T007 [P] Add failing tests for Catalog lookup by code/ID, service/unit compatibility, current selectability, exact-locale snapshot output, transaction-bound reader, and no Provider-price ownership in `tests/unit/modules/r1-p09-catalog-public-contract.test.ts` (FR-002–FR-005, FR-019–FR-020, FR-036–FR-039; SC-001, SC-010–SC-011).
- [x] T008 [P] Add failing tests that `providers.services.prices.approve` exists exactly once, belongs only to active `staff_admin`, and has matching outer/transaction-bound authorization in `tests/unit/modules/authentication/authorization-provider-services.test.ts` (FR-028, FR-031, FR-041; SC-003, SC-008).
- [x] T009 [P] Add failing boundary tests that permit only owning `*.public.ts` imports, exactly four R1-P09 models/tables, thin routes/controllers, service orchestration, and no new/future-phase module in `tests/unit/modules/r1-p09-module-boundaries.test.ts` (FR-005–FR-006, FR-038, FR-040, FR-044–FR-045; SC-011).
- [x] T010 [P] Add failing schema/migration contract tests for exact model/table names, composite FKs, unique/partial indexes, decimal/note/duration/version/status checks, receipt integrity, immutability triggers, RESTRICT deletes, and forbidden destructive/future SQL in `tests/integration/database/r1-p09-migration-contract.test.ts` (FR-002, FR-011–FR-013, FR-021–FR-027, FR-044–FR-046; SC-001–SC-002, SC-004–SC-007, SC-011).

### Foundational implementation

- [x] T011 Register the non-secret country-required object key shape for `providers.service_pricing_policy` with decimal-string maximum validation in `src/modules/configuration/config-key.catalog.ts` (FR-012–FR-013, FR-028–FR-030; SC-002, SC-007–SC-008).
- [x] T012 Add and implement the narrow active-country/default-currency/provider-pricing-policy reader plus transaction-bound factory in `src/modules/configuration/configuration.public.ts`, `src/modules/configuration/configuration.repository.ts`, and `src/modules/configuration/configuration.service.ts` (FR-012–FR-013, FR-028, FR-033; SC-002, SC-007–SC-009).
- [x] T013 Register only null-global Configuration key metadata—never a country value, Provider offering, or Provider price—in `prisma/seed.ts` (FR-012, FR-028, FR-046; SC-011).
- [x] T014 Add the non-localized code lookup, ID-based current/snapshot lookup, and transaction-bound reader factory to `src/modules/catalog/catalog.public.ts`, `src/modules/catalog/catalog.repository.ts`, and `src/modules/catalog/catalog.service.ts` without exposing internals (FR-003–FR-005, FR-019–FR-020, FR-036–FR-039; SC-001, SC-010–SC-011).
- [x] T015 Add the Staff price-approval permission, role mapping, public union, and transaction-bound adapter in `src/modules/authentication/domain/authorization.catalog.ts`, `src/modules/authentication/domain/authorization.types.ts`, `src/modules/authentication/authentication.public.ts`, and `src/modules/authentication/infrastructure/prisma-r1-p06-security.adapters.ts` (FR-028, FR-031, FR-041; SC-003, SC-008).
- [x] T016 Define Provider Service aggregate, price/history/status/receipt types, repository/UoW ports, stable errors, and safe dependency types in `src/modules/providers/domain/provider-service.types.ts`, `src/modules/providers/domain/provider-service.ports.ts`, and `src/modules/providers/domain/provider-service.errors.ts` (FR-006, FR-018–FR-027, FR-041–FR-045; SC-004–SC-006, SC-011).
- [x] T017 Add exactly the four Provider-owned Prisma models/enums/relations and no future-phase model in `prisma/schema.prisma` (FR-002, FR-011–FR-013, FR-018, FR-021–FR-027, FR-044–FR-046; SC-001, SC-004–SC-007, SC-011).
- [x] T018 Create the single additive forward migration with all reviewed constraints/indexes/triggers in `prisma/migrations/r1_p09_provider_services_pricing_historical_snapshots/migration.sql` without editing predecessors or inserting Provider data (FR-002, FR-011–FR-013, FR-018–FR-027, FR-044–FR-046; SC-001–SC-007, SC-011).
- [x] T019 Implement persistence-only current/retained/history/receipt primitives plus serializable-mutation and repeatable-read Providers UoW modes that construct public transaction participants without exposing raw transactions in `src/modules/providers/infrastructure/prisma-provider-service.repository.ts` and `src/modules/providers/infrastructure/prisma-provider-service.unit-of-work.ts` (FR-002–FR-005, FR-021–FR-027, FR-036–FR-043; SC-001–SC-006, SC-010–SC-011).
- [x] T020 Map Prisma uniqueness, FK/check, serialization, stale-version, and receipt races to stable Provider-service errors in `src/modules/providers/infrastructure/provider-service-prisma-errors.ts` (FR-024–FR-026, FR-042–FR-043; SC-001–SC-006).
- [x] T021 Compose only public Catalog/Configuration/Authentication/Admin transaction-participant factories and the Providers UoW in `src/composition.ts` while keeping route registration dormant until each story adapter exists (FR-003–FR-007, FR-026, FR-031, FR-036–FR-041, FR-045; SC-003, SC-010–SC-011).

**Checkpoint**: Four-table integrity, public seams, Staff permission, Providers
ports/UoW, and module boundaries are ready for story slices.

---

## Phase 3: User Story 1 — Configure a Provider Offering (Priority: P1) — MVP

**Goal**: An authorized exact-Provider OWNER/ADMIN can create, list, and read one
disabled, complete Provider offering with an initial retained price.

**Independent Test**: Create and retrieve one offering through protected HTTP;
prove Catalog/unit/country/decimal/duration/note/client-total/cross-Provider
failures leave no partial state.

### Tests first

- [x] T022 [P] [US1] Add failing canonical decimal, default-currency, maximum/minimum, duration, localized-note, initial approval-state, and client-total rejection policy tests in `tests/unit/providers/provider-service-configuration.policy.test.ts` (FR-003–FR-004, FR-011–FR-017, FR-028–FR-030; SC-001–SC-002, SC-007–SC-008).
- [x] T023 [P] [US1] Add failing exact OWNER/ADMIN allow, disabled/missing-capability/unapproved/cross-Provider deny, and non-enumeration tests in `tests/unit/providers/provider-service-authorization.policy.test.ts` (FR-001, FR-007–FR-010; SC-003).
- [x] T024 [P] [US1] Add failing create/list/detail/configuration orchestration tests for expectedVersion 0, disabled version 1, receipt replay/conflict before current dependency validation, transaction-bound Catalog/Configuration calls, and rollback ordering in `tests/unit/providers/provider-service.service.test.ts` (FR-001–FR-019, FR-024–FR-026, FR-041–FR-043; SC-001–SC-003, SC-006–SC-007).
- [x] T025 [P] [US1] Add failing live-repository tests for atomic create, initial effective-versus-pending price, Provider/service uniqueness, composite unit/FK guards, concurrent duplicate create, and audit rollback in `tests/integration/providers/provider-service-create.repository.test.ts` (FR-002–FR-004, FR-021–FR-026, FR-041–FR-043; SC-001–SC-004, SC-006).
- [x] T026 [P] [US1] Add failing Supertest coverage for list/create/detail/configuration, strict unknown-total/currency/actor rejection, replay status/meta, and cross-Provider safety in `tests/integration/http/provider-services-create-read.test.ts` (FR-007–FR-017, FR-025, FR-032, FR-042–FR-043; SC-001–SC-003, SC-007).
- [x] T027 [P] [US1] Add failing DTO/log/history forbidden-marker tests for raw Prisma, contacts, secrets, receipt hashes, database URLs, stack traces, client totals, and hidden approval metadata in `tests/unit/providers/provider-service-output-safety.test.ts` (FR-009–FR-010, FR-014, FR-032, FR-038, FR-041–FR-043; SC-003, SC-008, SC-011).

### Implementation

- [x] T028 [US1] Implement exact decimal parsing/formatting, price/minimum/maximum, duration, note-pair, Catalog-unit, and initial-state policies in `src/modules/providers/domain/provider-service.policy.ts` (FR-003–FR-004, FR-011–FR-017, FR-028–FR-030; SC-001–SC-002, SC-007–SC-008).
- [x] T029 [US1] Implement trusted Provider identity plus exact approved OWNER/ADMIN scope checks with no ownership/membership expansion in `src/modules/providers/domain/provider-service-authorization.policy.ts` (FR-001, FR-007–FR-010; SC-003).
- [x] T030 [US1] Add strict create/list/detail/configuration schemas and safe management/price/usability mappers in `src/modules/providers/provider-service.schema.ts` and `src/modules/providers/provider-service.dto.ts` (FR-007–FR-017, FR-032, FR-042; SC-001–SC-003, SC-007–SC-008).
- [x] T031 [US1] Implement create/configuration orchestration with canonical fingerprinting and, inside one Providers transaction, authority recheck, prior receipt replay, transaction-bound public-contract validation, aggregate versioning, history receipt, and audit in `src/modules/providers/provider-service.service.ts` (FR-001–FR-019, FR-024–FR-026, FR-041–FR-043; SC-001–SC-003, SC-006–SC-007).
- [x] T032 [US1] Implement exact-Provider cursor-paginated list/detail management reads and current Catalog reference mapping in `src/modules/providers/provider-service-query.service.ts` (FR-003–FR-010, FR-018, FR-032, FR-042; SC-001, SC-003).
- [x] T033 [US1] Complete create/configuration/list/detail repository operations and durable creation/configuration receipts in `src/modules/providers/infrastructure/prisma-provider-service.repository.ts` (FR-002, FR-018, FR-021–FR-027, FR-041–FR-043; SC-001–SC-006).
- [x] T034 [US1] Add thin Provider handlers/routes for the four US1 operations and mount them through existing Provider route composition in `src/modules/providers/provider-service.controller.ts`, `src/modules/providers/provider-service.routes.ts`, `src/composition.ts`, and `src/routes/index.ts` (FR-007–FR-017, FR-032, FR-042–FR-045; SC-001–SC-003, SC-011).

**Checkpoint**: US1 independently proves a complete disabled offering, initial
retained price, exact management scope, decimal safety, strict client-total
rejection, and atomic failure behavior.

---

## Phase 4: User Story 2 — Maintain Effective Price and Offering Status (Priority: P2)

**Goal**: Authorized Provider members can replace configuration, submit retained
prices, enable/disable offerings, and read immutable chronological histories
under one conflict-safe aggregate version.

**Independent Test**: From one offering, change configuration/price/status,
retry old/new commands, race writers, and prove current truth, history, and
dynamic Catalog effects remain consistent.

### Tests first

- [x] T035 [P] [US2] Add failing price state-transition, derived supersession, enable/disable, reason, no-op, and safe history projection tests in `tests/unit/providers/provider-service-history.policy.test.ts` (FR-018–FR-023, FR-026–FR-027, FR-032; SC-004–SC-005).
- [x] T036 [P] [US2] Add failing repository tests for new pending/effective rows, one-version multi-row supersession, visible status history, internal configuration receipts, commercial/history immutability, and no hard delete in `tests/integration/providers/provider-service-price-status.repository.test.ts` (FR-018–FR-027; SC-004–SC-006).
- [x] T037 [P] [US2] Add failing two-writer, stale-version, concurrent partial-unique, identical-late-retry, key-reuse-conflict, failure rollback, and same-transaction Catalog/config/country validation race tests in `tests/integration/providers/provider-service-concurrency-idempotency.test.ts` (FR-003–FR-004, FR-012, FR-019–FR-020, FR-023–FR-026, FR-043; SC-001, SC-004–SC-006, SC-009).
- [x] T038 [P] [US2] Add failing Supertest coverage for price-proposal/lifecycle/price-history/status-history schemas, pagination, blockers, replay, conflict, exact scope, and redaction in `tests/integration/http/provider-services-price-lifecycle.test.ts` (FR-007–FR-010, FR-018–FR-027, FR-032, FR-042–FR-043; SC-003–SC-006).

### Implementation

- [x] T039 [US2] Extend Provider Service policies with retained price transitions, derived reasons, current-effective selection, enable preconditions, status transitions, and chronological cursor rules in `src/modules/providers/domain/provider-service.policy.ts` (FR-018–FR-023, FR-026–FR-027, FR-032; SC-004–SC-005).
- [x] T040 [US2] Implement price-proposal and lifecycle orchestration with exact late replay, one aggregate increment, dynamic Catalog/Configuration checks, multi-row history, and atomic audit in `src/modules/providers/provider-service.service.ts` (FR-018–FR-027, FR-032, FR-041–FR-043; SC-004–SC-006, SC-009).
- [x] T041 [US2] Implement atomic price/status transitions, partial-unique race handling, immutable history/receipt writes, and no-delete persistence in `src/modules/providers/infrastructure/prisma-provider-service.repository.ts` (FR-018–FR-027, FR-041–FR-043; SC-004–SC-006).
- [x] T042 [US2] Add exact-Provider cursor-paginated price/status history reads that exclude internal receipt fields and non-status events in `src/modules/providers/provider-service-query.service.ts` and `src/modules/providers/provider-service.dto.ts` (FR-009, FR-021–FR-023, FR-032, FR-042; SC-003–SC-005).
- [x] T043 [US2] Add strict price-proposal/lifecycle/history path/query/body schemas and stable error mapping in `src/modules/providers/provider-service.schema.ts` and `src/modules/providers/domain/provider-service.errors.ts` (FR-013–FR-015, FR-022–FR-025, FR-042–FR-043; SC-002, SC-004–SC-007).
- [x] T044 [US2] Add thin Provider price/lifecycle/history handlers and routes without anonymous/customer surfaces in `src/modules/providers/provider-service.controller.ts` and `src/modules/providers/provider-service.routes.ts` (FR-007–FR-010, FR-018–FR-027, FR-032, FR-042–FR-045; SC-003–SC-006, SC-011).
- [x] T045 [US2] Run the focused US1+US2 unit/repository/HTTP slice and record commands/results and exact remaining failures without marking the phase complete in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-001–FR-027, FR-041–FR-046; SC-001–SC-007, SC-011–SC-012).

**Checkpoint**: US1 and US2 independently preserve correct current offering/
effective-price truth, late retry behavior, and immutable histories.

---

## Phase 5: User Story 3 — Apply Configured Price Approval (Priority: P3)

**Goal**: An active permitted Staff Admin can decide country-configured pending
prices without exposing or activating unapproved truth.

**Independent Test**: Exercise enabled/disabled approval, initial/replacement
pending prices, approve/reject, config change, stale/duplicate/two-writer/
revoked-Staff failures, and preservation of the right effective price.

### Tests first

- [x] T046 [P] [US3] Add failing approval/rejection, current-policy-change, required-reason, active-staff-only, and safe Staff DTO policy/service tests in `tests/unit/providers/provider-service-approval.test.ts` (FR-028–FR-032, FR-041–FR-043; SC-003, SC-008).
- [x] T047 [P] [US3] Add failing live-repository tests for initial/replacement approve/reject, one-version atomic supersession, Staff two-writer races, permission revocation, replay, and audit rollback in `tests/integration/providers/provider-service-approval.repository.test.ts` (FR-023–FR-031, FR-041–FR-043; SC-004, SC-006, SC-008).
- [x] T048 [P] [US3] Add failing Supertest coverage for pending queue/dossier/decisions, exact permission, policy-disabled dormancy, non-enumeration, replay/conflict, and redaction in `tests/integration/http/provider-service-price-approval.test.ts` (FR-009–FR-010, FR-028–FR-032, FR-038, FR-041–FR-043; SC-003, SC-008).

### Implementation

- [x] T049 [US3] Implement Staff pending-list/detail and approve/reject orchestration with current policy, permitted reason, outer plus transactional permission, aggregate version, receipt, history, and audit checks in `src/modules/providers/provider-service.service.ts` (FR-023–FR-032, FR-041–FR-043; SC-004, SC-006, SC-008).
- [x] T050 [US3] Implement pending queue/dossier reads and atomic approve/reject/supersede persistence in `src/modules/providers/infrastructure/prisma-provider-service.repository.ts` and `src/modules/providers/provider-service-query.service.ts` (FR-023, FR-026, FR-028–FR-032, FR-041–FR-043; SC-004, SC-006, SC-008).
- [x] T051 [US3] Add strict Staff queue/dossier/decision schemas and safe Staff mappers that exclude contacts, receipts, and audit internals in `src/modules/providers/provider-service.schema.ts` and `src/modules/providers/provider-service.dto.ts` (FR-009, FR-028–FR-032, FR-038, FR-042; SC-003, SC-008).
- [x] T052 [US3] Add thin Staff pending/decision handlers and routes under the existing `/staff/providers` mount only in `src/modules/providers/provider-service.controller.ts` and `src/modules/providers/provider-service.routes.ts` (FR-010, FR-028–FR-032, FR-042–FR-045; SC-003, SC-008, SC-011).
- [x] T053 [US3] Wire the Staff public/transactional authorizers, current Configuration participant, and Admin transactional audit writer into the same Provider Service transaction in `src/composition.ts` (FR-026, FR-028, FR-031, FR-041–FR-043; SC-003, SC-006, SC-008, SC-011).
- [x] T054 [US3] Run the focused approval unit/repository/HTTP slice and record exact commands/results without marking implementation complete in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-023–FR-032, FR-041–FR-043; SC-003–SC-004, SC-006, SC-008, SC-012).

**Checkpoint**: US3 independently proves configured Staff approval and correct
effective-price preservation with no hidden activation.

---

## Phase 6: User Story 4 — Supply Readiness and Snapshot-Ready Facts (Priority: P4)

**Goal**: Providers dynamically reports service readiness and returns one safe,
consistent, current Provider/Catalog/effective-price value to a later internal
consumer without Booking persistence.

**Independent Test**: Evaluate every blocker and exact-locale/current-snapshot
case across Provider/Catalog/Configuration changes and force read drift to prove
bounded retry or stable conflict.

### Tests first

- [x] T055 [P] [US4] Add failing pure readiness tests for one qualifying offering, every exact approved blocker, precedence/deduplication, no LIVE/coverage/schedule/capacity logic, and literal `eligibleForPublicBrowse=false` in `tests/unit/providers/provider-service-readiness.policy.test.ts` (FR-033–FR-035; SC-009).
- [x] T056 [P] [US4] Add failing integration tests for one-snapshot dynamic readiness after offering/price/approval/lifecycle/Provider-country/Configuration/Catalog changes with no persisted flag or fabricated status history in `tests/integration/providers/provider-service-readiness.test.ts` (FR-020, FR-026, FR-033–FR-035; SC-005, SC-009).
- [x] T057 [P] [US4] Add failing internal DTO tests for every DEC-051 field, exact-locale note/no fallback, effective-only output, unavailable collapse, and forbidden pending/Staff/contact/receipt/raw fields in `tests/unit/providers/provider-service-snapshot.test.ts` (FR-036–FR-040; SC-010–SC-011).
- [x] T058 [P] [US4] Add failing consistency tests for code-to-ID resolution inside one repeatable-read Provider/Catalog/Configuration snapshot, whole-transaction retry, third-failure conflict, copied-value stability, and zero Booking/answer/total/snapshot persistence in `tests/integration/providers/provider-service-snapshot-consistency.test.ts` (FR-036–FR-040; SC-010–SC-011).
- [x] T059 [P] [US4] Add failing public-contract and boundary tests for `ProviderServicesReadyFacts` and `ProviderServiceSnapshotReader` with no HTTP/raw repository export in `tests/unit/modules/r1-p09-providers-public-contract.test.ts` (FR-006, FR-033–FR-040, FR-045; SC-009–SC-011).

### Implementation

- [x] T060 [US4] Implement usable-offering evaluation and exact blocker-code mapping without persisted readiness or final eligibility in `src/modules/providers/domain/provider-service-readiness.policy.ts` (FR-019–FR-020, FR-033–FR-035; SC-009).
- [x] T061 [US4] Add bounded enabled-offering/current-effective projections for readiness and snapshot reads through the repeatable-read Providers UoW in `src/modules/providers/infrastructure/prisma-provider-service.repository.ts` (FR-018–FR-020, FR-033–FR-039; SC-009–SC-010).
- [x] T062 [US4] Implement dynamic Provider Service readiness queries through Catalog/Configuration public contracts in `src/modules/providers/provider-service-query.service.ts` (FR-020, FR-033–FR-035; SC-009).
- [x] T063 [US4] Implement code-to-ID resolution, one-snapshot Provider/Catalog/Configuration reads, three-attempt whole-transaction retry, current usability checks, and AVAILABLE/UNAVAILABLE/CONFLICT mapping in `src/modules/providers/provider-service-snapshot.service.ts` (FR-036–FR-040; SC-010–SC-011).
- [x] T064 [US4] Add the narrow readiness facts and internal snapshot-ready DTO/reader/factory to `src/modules/providers/providers.public.ts` without management or persistence exports (FR-006, FR-033–FR-040, FR-045; SC-009–SC-011).
- [x] T065 [US4] Replace the R1-P09 deferred services gate with injected dynamic facts while preserving every earlier readiness owner and `eligibleForPublicBrowse=false` in `src/modules/providers/domain/provider-readiness.policy.ts` and `src/modules/providers/provider-projection.service.ts` (FR-033–FR-035; SC-009).
- [x] T066 [US4] Compose the readiness/snapshot readers for internal use only and add no customer/anonymous route in `src/composition.ts` and `src/routes/index.ts` (FR-010, FR-033–FR-040, FR-045; SC-009–SC-011).

**Checkpoint**: All four stories are independently testable; R1-P09 supplies
current facts only and still has no Browse/Booking behavior.

---

## Phase 7: Cross-Cutting Contracts, Migration Proof, and Quality Gates

**Purpose**: Prove the complete phase without adding new product behavior. No
task here authorizes owner completion, Git publication, deployment, production
migration/configuration, or R1-P10.

### Contract and security tests first

- [x] T067 [P] Add failing route/OpenAPI operation/schema/security/error/replay parity tests for exactly the 11 protected operations in `tests/unit/swagger/r1-p09-openapi-parity.test.ts` and `tests/unit/swagger/r1-p09-openapi-fragments.test.ts` (FR-007–FR-010, FR-032, FR-038, FR-042, FR-045; SC-003, SC-008, SC-011–SC-012).
- [x] T068 Implement the Provider/Staff OpenAPI source and merge it into the canonical document without anonymous Browse or Booking paths in `src/swagger/r1-p09-openapi.paths.ts` and `src/swagger/openapi.document.ts` (FR-007–FR-010, FR-032, FR-038, FR-040, FR-042, FR-045; SC-003, SC-008, SC-011).
- [x] T069 [P] Add failing deterministic generator/schema/path/security/example tests for the R1-P09 collection in `tests/unit/providers/r1-p09-postman-schema-parity.test.ts` (FR-010, FR-014, FR-032, FR-038, FR-040, FR-042; SC-003, SC-007–SC-008, SC-011).
- [x] T070 Implement the OpenAPI-derived generator and checked-in protected collection in `scripts/generate-r1-p09-postman.ts` and `postman/Cleanora-R1-P09-Provider-Services.postman_collection.json` (FR-007–FR-010, FR-014, FR-032, FR-038, FR-040, FR-042; SC-003, SC-007–SC-008, SC-011).
- [x] T071 Add whole-surface negative-route and forbidden-marker scans covering errors/logs/DTOs/OpenAPI/Postman and proving no anonymous/customer/Booking/total path in `tests/integration/http/provider-services-negative-surface.test.ts` (FR-009–FR-010, FR-014, FR-038, FR-040, FR-042–FR-045; SC-003, SC-007, SC-011).

### Migration proof tests first

- [x] T072 [P] Add failing clean-install live probes for exact tables/history, FKs/checks/partial uniques/receipts/immutability/decimals, empty post-seed R1-P09 data, and idempotent redeploy in `tests/integration/database/r1-p09-clean-migration.test.ts` (FR-002, FR-011–FR-013, FR-021–FR-027, FR-044–FR-046; SC-001–SC-007, SC-011).
- [x] T073 [P] Add failing unit tests for exact R1-P08 baseline history, digest preservation, destructive-path guards, controlled cleanup, and live R1-P09 probes in `tests/unit/scripts/validate-r1-p09-upgrade.test.ts` (FR-027, FR-043–FR-046; SC-002, SC-011–SC-012).
- [x] T074 Extend clean chronological migration assertions through exactly R1-P09 in `scripts/validate-clean-migration.ts` (FR-027, FR-043–FR-046; SC-002, SC-011–SC-012).
- [x] T075 Implement the isolated populated R1-P08→R1-P09 upgrade/digest/constraint/redeploy proof in `scripts/validate-r1-p09-upgrade.ts` (FR-002, FR-011–FR-013, FR-021–FR-027, FR-043–FR-046; SC-001–SC-007, SC-011–SC-012).

### Documentation and gates

- [x] T076 [P] Document the implemented protected Provider-service surface, internal-only snapshot boundary, configuration prerequisite, no production Provider-price seed, and R1-P09 safety commands in `docs/README.md`, `docs/api/provider-services.md`, `scripts/README.md`, and `postman/README.md` (FR-010, FR-036–FR-046; SC-010–SC-012).
- [x] T077 Run `npm run test:r1-p09` and record the command, timestamp, totals, and zero failures in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-001–FR-046; SC-001–SC-012).
- [x] T078 Run `npm run test:coverage:r1-p09`, verify 80/75/80/80 thresholds for the planned include set, and record the summary in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-001–FR-046; SC-001–SC-012).
- [x] T079 Run `npm run prisma:validate`, then the clean and populated-upgrade validators only against the explicitly approved disposable PostgreSQL target, and record migration history/hash/constraint/redeploy proof in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-002, FR-011–FR-013, FR-021–FR-027, FR-043–FR-046; SC-001–SC-007, SC-011–SC-012). — PASS on local `cleanora_r1_p09_review_proof`: clean/upgrade validators, exact table/history/seed checks, 28 live SQLSTATE probes, unchanged migration SHA256.
- [x] T080 Run the R1-P09 Postman generator plus `npm run openapi:validate`, `npm run postman:validate`, and `npm run docs:check`; verify checked-in generation parity and record results in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-007–FR-010, FR-014, FR-032, FR-038, FR-040, FR-042, FR-045; SC-003, SC-007–SC-008, SC-011–SC-012).
- [x] T081 Run `npm run lint`, `npm run typecheck`, and `npm run build`; record exact results and generated-code status in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-041–FR-045; SC-011–SC-012).
- [x] T082 Run full `npm test` and `npm run test:coverage`; prove earlier R1-P01–R1-P08 behavior and repository thresholds remain intact, and record results in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-043–FR-046; SC-002, SC-011–SC-012). — PASS: full tests 1894 passed / 6 skips; five guarded Phase 7 tests passed separately; full coverage 84.70/76.10/87.61/86.43.
- [x] T083 Re-run the module-boundary, privacy/redaction, client-total, two-writer, late-replay, snapshot-consistency, no-Booking, and SQL-safety focused tests and record their exact names/results in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-005–FR-010, FR-014, FR-020–FR-027, FR-036–FR-046; SC-003–SC-006, SC-010–SC-012). — Included in fresh local Phase 9 suite: 168 passed, 1 inverse no-DB check skipped.
- [x] T084 Reconcile every FR-001–FR-046 and SC-001–SC-012 against passing task evidence, list all remaining unchecked tasks/blockers without claiming owner approval or completion, and update only the evidence summary in `specs/R1-P09-provider-services-pricing-historical-snapshots/implementation-evidence.md` (FR-001–FR-046; SC-001–SC-012). — All 84 tasks reconciled; no unresolved technical review findings. Human phase completion remains pending.

---

## Dependencies and Execution Order

### Phase dependencies

```text
Phase 1 Setup
  -> Phase 2 Foundation (blocks every story)
      -> US1 Configure Offering (MVP)
          -> US2 Price/Status History
              -> US3 Configured Approval
              -> US4 Readiness/Snapshot
                  -> Phase 7 Cross-Cutting Gates
```

- US2 depends on US1's aggregate and initial retained price.
- US3 depends on US2's price proposal/transitions and the foundational Staff
  permission.
- US4 depends on US1 current configuration and US2 current-effective/lifecycle
  behavior; it can proceed in parallel with US3 once US2 is stable, using both
  approval-on/off fixtures.
- Phase 7 depends on all desired story route/service shapes; its test-first
  OpenAPI/Postman/migration tasks precede the related implementation tasks.

### Within each story

1. Add focused tests and verify they fail for the intended missing behavior.
2. Implement domain policy/types before service orchestration.
3. Implement repository/UoW operations before HTTP adapters depend on them.
4. Keep controllers/routes thin and register only implemented operations.
5. Run the story slice and record evidence before the next dependent story.

## Genuine Parallel Opportunities

- After T001, T002 and T004 can run in parallel; T003 follows T002.
- T006–T010 target independent owning seams/test files and can run in parallel.
- After foundational ports exist, each story's `[P]` test files can be authored
  in parallel before that story's implementation.
- After US2, US3 implementation and US4 readiness/snapshot tests can proceed in
  parallel because they touch distinct service/test concerns; shared file edits
  in `provider-service.service.ts` and `prisma-provider-service.repository.ts`
  must still be serialized.
- T067, T069, T072, T073, and T076 target distinct contract/migration/docs files
  and can proceed in parallel after story shapes are stable.

## Parallel Examples

### User Story 1

```text
T022 decimal/configuration policy tests
T023 authorization tests
T025 repository atomic-create tests
T026 HTTP create/read tests
T027 output-safety tests
```

### User Story 2

```text
T035 transition/history policy tests
T036 repository price/status tests
T037 concurrency/idempotency tests
T038 HTTP price/lifecycle tests
```

### User Story 3

```text
T046 approval unit tests
T047 approval repository/race tests
T048 Staff HTTP tests
```

### User Story 4

```text
T055 readiness policy tests
T056 dynamic readiness integration tests
T057 snapshot DTO tests
T058 snapshot consistency/no-Booking tests
T059 Providers public-contract tests
```

## Implementation Strategy

### MVB first

1. Complete setup and the shared four-table/public-contract foundation.
2. Complete US1 and stop to validate the independently usable management MVP:
   one correct disabled offering and initial retained price.
3. Add US2 retained commercial/status behavior without weakening US1.
4. Add US3 configured approval as a Provider-price policy, not a generic
   workflow.
5. Add US4 dynamic readiness and current internal snapshot facts without
   Booking/Browse storage or HTTP.
6. Finish contract, migration, documentation, phase, and full repository gates.

### Stop rules

Stop implementation and return to the human if a material product decision
would change accepted behavior, a fifth table/new module appears necessary, a
production policy value is needed, a non-disposable database is the only
available target, or another phase/dirty change conflicts with R1-P09.

Do not include or infer tasks for commit, push, merge, deployment, production
migration/configuration, owner completion approval, phase completion, or
R1-P10.

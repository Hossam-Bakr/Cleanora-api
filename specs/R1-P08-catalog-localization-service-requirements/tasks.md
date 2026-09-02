# Tasks: Catalog, Localization & Service Requirements

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`authorization-matrix.md`, `migration-plan.md`, `test-strategy.md`,
`quickstart.md`, and `contracts/`

**Tests**: Mandatory. R1-P08 explicitly requires unit, contract, integration,
migration/seed, authorization/audit, localization, concurrency/idempotency,
Media, error/redaction, coverage, and full-repository evidence.

**Organization**: T001–T156 are continuous and dependency ordered. Story tasks
carry `[US#]`; setup/foundational/final evidence tasks intentionally do not.
Every task names its primary file path and relevant FR/SC IDs.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means safe to implement in parallel because the task primarily changes
  different files and does not depend on an incomplete sibling.
- Tests for each behavior are written first and must fail for the intended
  reason before implementation.
- No task authorizes staging, commit, push, merge, deployment, production
  migration, destructive cleanup, or phase-complete status.

## Phase 1: Setup and guarded implementation baseline

**Purpose**: Establish the R1-P08 file/test/runtime surfaces while preserving
the intentionally dirty worktree.

- [x] T001 Record branch, `.specify/feature.json`, intended R1-P08 paths, preserved unrelated dirty groups, Node/Prisma baseline, and no-Git/no-production boundaries in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-050, FR-052)
- [x] T002 Create the lean Catalog module files `src/modules/catalog/catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts`, `catalog.repository.ts`, `catalog.schema.ts`, `catalog.public.ts`, `catalog.policy.ts`, and `catalog.errors.ts` without generic barrels or placeholder abstractions (FR-001, FR-002, FR-007)
- [x] T003 [P] Create focused test locations under `tests/unit/catalog/`, `tests/integration/catalog/`, `tests/integration/http/`, and `tests/integration/database/` with no Docker/Testcontainers dependency (FR-052, SC-012)
- [x] T004 [P] Add `vitest.r1-p08.config.ts` plus `test:r1-p08` and `test:coverage:r1-p08` scripts in `package.json` using unchanged repository thresholds (FR-052, SC-012)
- [x] T005 [P] Create runtime contract scaffolds in `src/swagger/r1-p08-openapi.paths.ts` and `scripts/generate-r1-p08-postman.ts` that will be filled story by story (FR-037, FR-042)
- [x] T006 [P] Add R1-P08 migration/seed validator test scaffolds in `tests/unit/scripts/validate-r1-p08-upgrade.test.ts` and `tests/unit/catalog/catalog-seed.test.ts` with guarded target expectations (FR-047–FR-052, SC-005, SC-011)
- [x] T007 Add an implementation evidence ledger with T001–T156 placeholders and command-result sections to `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` without marking any task complete prematurely (SC-010, SC-012)
- [x] T008 Run and record pre-change `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:unit`, and `git diff --check` baselines in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md`, distinguishing pre-existing failures from R1-P08 changes (FR-052)

---

## Phase 2: Foundational Catalog, authorization, Media, persistence, and transactions

**Purpose**: Blocking seams and persistence required by every user story.

**Critical**: No story implementation begins until this phase is green.

### Foundation tests first

- [x] T009 [P] Add failing Authentication catalog tests for the two permissions, two protected operations, `CATALOG_MANAGEMENT_WRITE`, and `catalog_management_change` in `tests/unit/modules/authentication/authorization-catalog.test.ts` (FR-030–FR-032, SC-007)
- [x] T010 [P] Add failing role/account/grant separation tests proving only active `staff_admin` authority in `tests/unit/modules/authentication/authorization-staff-separation.test.ts` (FR-030, FR-031, SC-007)
- [x] T011 [P] Add failing Catalog-service-image public-contract/type tests in `tests/unit/modules/r1-p08-public-contracts.test.ts` (FR-038–FR-040, FR-042–FR-043)
- [x] T012 [P] Add failing Catalog import/ownership/no-future-module guards in `tests/unit/modules/r1-p08-module-boundaries.test.ts` (FR-001, FR-002, FR-006, FR-007, FR-043, FR-050)
- [x] T013 [P] Add a failing static migration guard for exact migration/table/enum shape and forbidden destructive/future SQL in `tests/unit/catalog/r1-p08-database-guard.test.ts` (FR-051, SC-011)
- [x] T014 [P] Add failing PostgreSQL constraint-contract tests for Catalog codes, versions, positions, FKs, uniqueness, field-kind columns, bounds, and command states in `tests/integration/database/r1-p08-migration-contract.test.ts` (FR-017–FR-020, FR-024, FR-034–FR-035, FR-051)
- [x] T015 [P] Add failing command fingerprint/replay/reservation policy tests in `tests/unit/catalog/catalog-idempotency.policy.test.ts` (FR-034, FR-035, SC-006)

### Foundation implementation

- [x] T016 Extend `src/modules/authentication/domain/authorization.types.ts` and `authorization.catalog.ts` with the exact DEC-043 permissions, role mapping, operations, reason operation/code, and deny-by-default declarations (FR-030–FR-032)
- [x] T017 Expose only the required additive Catalog authorization/reason types through `src/modules/authentication/authentication.public.ts` and keep Authentication internals private (FR-030, FR-032, FR-043)
- [x] T018 Extend `src/modules/media/domain/media.types.ts`, `media.ports.ts`, and `media.public.ts` with `CATALOG_SERVICE_IMAGE`, safe receipts, ingest/delivery/cleanup, and transaction-bound READY authorization contracts (FR-038–FR-040)
- [x] T019 Implement the Catalog image reservation/status/READY authorization primitives in `src/modules/media/infrastructure/prisma-media.repository.ts` without Catalog business meaning in Media (FR-038–FR-040)
- [x] T020 Add the R1-P08 enums/models/relations/indexes from `data-model.md` to `prisma/schema.prisma`, including only the nine Catalog tables and minimal Country/Media opposite relations (FR-002–FR-007, FR-013–FR-024, FR-034–FR-035, FR-038–FR-041, FR-051)
- [x] T021 Generate the forward-only migration `prisma/migrations/r1_p08_catalog_localization_service_requirements/migration.sql` after R1-P07 without editing any applied migration (FR-051, SC-011)
- [x] T022 Review and add named first-application SQL checks/indexes required by `migration-plan.md` in `prisma/migrations/r1_p08_catalog_localization_service_requirements/migration.sql`, then document every statement/risk in `specs/R1-P08-catalog-localization-service-requirements/migration-review.md` (FR-017–FR-020, FR-024, FR-034–FR-035, FR-051)
- [x] T023 Update Catalog ownership inventory for `service_media_associations` and `catalog_command_requests` in `docs/architecture/entity-ownership.md` without adding a future-phase entity (FR-002, FR-007, FR-050)
- [x] T024 Implement stable-code, locale, version, order-vector, and safe command-hash primitives in `src/modules/catalog/catalog.policy.ts` and stable errors in `catalog.errors.ts` (FR-004, FR-010–FR-012, FR-024, FR-034–FR-036)
- [x] T025 Implement common Zod params/query/command/idempotency/reason/localized schemas in `src/modules/catalog/catalog.schema.ts` with trusted actor excluded from inputs (FR-010, FR-031, FR-034–FR-036)
- [x] T026 Define Catalog repository/unit-of-work ports and transaction-bound dependency factories in `src/modules/catalog/catalog.repository.ts`, naming `CatalogService` and Catalog as transaction owner (FR-002, FR-007, FR-032–FR-035, FR-039)
- [x] T027 Implement advisory locking, request hashing, PENDING/COMPLETED receipts, replay, and different-payload conflict behavior in `src/modules/catalog/catalog.repository.ts` (FR-034, FR-035, SC-006)
- [x] T028 Inject Authentication reauthorization, Configuration country reads, Media READY checks, and Admin `PrivilegedAuditWriter` into the Catalog unit of work in `src/modules/catalog/catalog.repository.ts` and `src/composition.ts` without cross-module repository imports (FR-022, FR-030–FR-033, FR-039)
- [x] T029 Implement shared protected-read/write gates, reason validation, safe audit-context construction, and transaction recheck helpers in `src/modules/catalog/catalog.service.ts` (FR-030–FR-036, SC-007)
- [x] T030 Compose the Catalog repository/service plus transaction-bound public seams in `src/composition.ts` without event bus, cache, worker, or new environment secret (FR-007, FR-032, FR-039, FR-050)
- [x] T031 Add only the optional protected staff Catalog router to `src/routes/index.ts` and reserve composition dependencies for the later internal reader without exposing unfinished or anonymous handlers (FR-037, FR-042, FR-050)
- [x] T032 Run foundation tests, Prisma validate/generate, typecheck, lint, and module-boundary guards; record exact exits in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` before US1 (FR-051, FR-052, SC-012)

**Checkpoint**: Foundational contracts/schema/transaction primitives are green;
no user story behavior is claimed yet.

---

## Phase 3: User Story 1 — Manage the localized service catalog (Priority: P1) 🎯 MVP

**Goal**: Authorized staff can create/read/update stable inactive/active
categories and services with strict Arabic/English content.

**Independent Test**: From an empty Catalog, active `staff_admin` creates a
category and service, completes AR/EN, reads both management views, updates
content without identity change, and observes atomic version/audit evidence;
other actors and fallback reads fail safely.

### US1 tests first

- [x] T033 [P] [US1] Add failing stable identity, inactive-draft, bilingual completeness, trim, no-fallback, and activation tests in `tests/unit/catalog/catalog-localization.policy.test.ts` (FR-003–FR-005, FR-008–FR-012, SC-002)
- [x] T034 [P] [US1] Add failing category/service parent and service-translation repository tests in `tests/integration/catalog/catalog-taxonomy.repository.test.ts` (FR-001–FR-005, FR-008–FR-012)
- [x] T035 [P] [US1] Add failing management schema tests for category/service create/update/lifecycle inputs in `tests/unit/catalog/catalog.schema.test.ts` (FR-004, FR-008–FR-012, FR-034–FR-036)
- [x] T036 [P] [US1] Add failing authorization/reason/atomic privileged-audit tests for taxonomy writes in `tests/integration/catalog/catalog-management-audit.test.ts` (FR-030–FR-035, SC-007)
- [x] T037 [P] [US1] Add failing Supertest journeys for staff category/service management, error envelopes, and draft visibility in `tests/integration/http/catalog-management-taxonomy.test.ts` (FR-031, FR-036, FR-037, SC-001)
- [x] T038 [US1] Add failing same-command replay, changed-payload conflict, and same-version taxonomy race tests in `tests/integration/catalog/catalog-taxonomy-concurrency.test.ts` (FR-034, FR-035, SC-006)

### US1 implementation

- [x] T039 [US1] Implement category/service localized completeness, immutable code/identity, parent, and lifecycle policies in `src/modules/catalog/catalog.policy.ts` (FR-003–FR-005, FR-008–FR-012)
- [x] T040 [US1] Implement category create/read/update/lock/version persistence in `src/modules/catalog/catalog.repository.ts` (FR-001–FR-005, FR-027–FR-029)
- [x] T041 [US1] Implement service/translation create/read/update/parent persistence in `src/modules/catalog/catalog.repository.ts` (FR-001–FR-005, FR-008–FR-012)
- [x] T042 [US1] Implement protected category/service management use cases in `src/modules/catalog/catalog.service.ts` with exact-version, idempotency, transaction reauthorization, and one privileged audit (FR-030–FR-037)
- [x] T043 [US1] Implement category/service activation/deactivation guards and child service version propagation for category content/lifecycle changes in `src/modules/catalog/catalog.service.ts` and `catalog.repository.ts` (FR-011, FR-025–FR-029, FR-034)
- [x] T044 [P] [US1] Implement management-safe category/service DTO mapping in `src/modules/catalog/catalog.public.ts` without raw Prisma/auth/audit fields (FR-042, FR-043)
- [x] T045 [US1] Complete category/service Zod bodies, params, queries, and response-facing types in `src/modules/catalog/catalog.schema.ts` (FR-008–FR-012, FR-034–FR-036)
- [x] T046 [US1] Implement thin management category/service controller handlers and standard envelopes in `src/modules/catalog/catalog.controller.ts` (FR-036, FR-037)
- [x] T047 [US1] Register category/service list/detail/create/update/lifecycle management routes in `src/modules/catalog/catalog.routes.ts` with trusted authentication middleware (FR-030–FR-037)
- [x] T048 [US1] Mount the completed staff Catalog router through `src/composition.ts` and `src/routes/index.ts` (FR-037)
- [x] T049 [P] [US1] Add runtime taxonomy-management OpenAPI paths/schemas in `src/swagger/r1-p08-openapi.paths.ts` and compose them from `src/swagger/openapi.document.ts` (FR-036, FR-037)
- [x] T050 [P] [US1] Add taxonomy-management Postman requests/examples in `scripts/generate-r1-p08-postman.ts` (FR-037)
- [x] T051 [US1] Add stable Catalog error mapping and safe request-scoped structured logging for taxonomy operations in `src/modules/catalog/catalog.errors.ts`, `catalog.controller.ts`, and `catalog.service.ts` (FR-036)
- [x] T052 [US1] Make all T033–T038 tests pass and add regression assertions for missing locale, blank trimmed content, duplicate locale, wrong role/reason, audit failure, and stale versions in their existing test files (FR-008–FR-012, FR-030–FR-036)
- [x] T053 [US1] Run the US1 focused unit/integration/HTTP/OpenAPI checks and record exact file/test counts in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (SC-001, SC-002, SC-007)
- [x] T054 [US1] Record US1 independent-test evidence and requirement mapping in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` without claiming later stories (FR-001–FR-012, FR-030–FR-037)

**Checkpoint**: US1 is independently usable as a protected localized taxonomy
MVP; no units/fields/country/media/snapshot claim yet.

---

## Phase 4: User Story 2 — Configure price units and service booking fields (Priority: P1)

**Goal**: Staff atomically configures service-scoped units and the closed,
ordered six-kind field/option graph.

**Independent Test**: One versioned configuration PUT accepts every valid kind,
rejects every incompatible/bilingual/order graph without partial state, and
returns deterministic unit/field/option definitions containing no price amount
or customer answer.

### US2 tests first

- [x] T055 [P] [US2] Add failing exhaustive six-kind requiredness/constraint/option matrix tests in `tests/unit/catalog/service-field.policy.test.ts` (FR-016–FR-020, SC-003)
- [x] T056 [P] [US2] Add failing price-unit stable code/localization/order/no-amount tests in `tests/unit/catalog/service-price-unit.policy.test.ts` (FR-013–FR-015, SC-003)
- [x] T057 [P] [US2] Add failing full service-configuration Zod graph tests in `tests/unit/catalog/catalog-configuration.schema.test.ts` (FR-009–FR-020)
- [x] T058 [P] [US2] Add failing atomic replacement/ID-preservation repository tests in `tests/integration/catalog/catalog-configuration.repository.test.ts` (FR-013–FR-020, FR-027–FR-028)
- [x] T059 [P] [US2] Add failing configuration PUT Supertest success/error/redaction journeys in `tests/integration/http/catalog-management-configuration.test.ts` (FR-013–FR-021, FR-036–FR-037)
- [x] T060 [US2] Extend live constraint tests for kind columns, bounds, codes, and ordered uniqueness in `tests/integration/database/r1-p08-migration-contract.test.ts` (FR-017–FR-020, FR-024)

### US2 implementation

- [x] T061 [US2] Implement service-scoped price-unit and six-kind field/option graph validators in `src/modules/catalog/catalog.policy.ts` exactly matching DEC-042 (FR-013–FR-020)
- [x] T062 [US2] Implement deterministic price-unit/field/option read and replacement persistence in `src/modules/catalog/catalog.repository.ts`, preserving child IDs by stable codes (FR-013–FR-020, FR-027)
- [x] T063 [US2] Implement one atomic service-configuration replacement use case in `src/modules/catalog/catalog.service.ts` with one version bump, audit, receipt, and no partial graph (FR-013–FR-021, FR-028, FR-032–FR-035)
- [x] T064 [P] [US2] Extend management and public DTO definitions for units, fields, kind rules, and options in `src/modules/catalog/catalog.public.ts` using decimal strings and no customer answers (FR-013–FR-021, FR-042–FR-045)
- [x] T065 [US2] Implement the exact configuration input discriminators and limits in `src/modules/catalog/catalog.schema.ts` (FR-016–FR-020, FR-036)
- [x] T066 [US2] Add thin configuration controller/PUT routing in `src/modules/catalog/catalog.controller.ts` and `catalog.routes.ts` (FR-016, FR-037)
- [x] T067 [P] [US2] Add runtime configuration OpenAPI schema/path parity in `src/swagger/r1-p08-openapi.paths.ts` (FR-013–FR-020, FR-037)
- [x] T068 [P] [US2] Add valid/invalid six-kind configuration examples to `scripts/generate-r1-p08-postman.ts` (FR-017–FR-020, FR-037)
- [x] T069 [US2] Reconcile generated SQL constraints with the passing kind/bounds tests and update `specs/R1-P08-catalog-localization-service-requirements/migration-review.md` before any accepted migration application (FR-017–FR-020, FR-051)
- [x] T070 [US2] Add accepted replay/different-payload idempotency coverage for full configuration in `tests/integration/catalog/catalog-configuration.repository.test.ts` (FR-035)
- [x] T071 [US2] Add two-writer configuration race coverage proving one winner and zero partial child/audit state in `tests/integration/catalog/catalog-configuration-concurrency.test.ts` (FR-028, FR-034–FR-035, SC-006)
- [x] T072 [US2] Add neutral OQ-002 and localized-content log/audit redaction assertions in `tests/unit/catalog/catalog-output-redaction.test.ts` and `tests/integration/catalog/catalog-management-audit.test.ts` (FR-021, FR-033, FR-036)
- [x] T073 [US2] Run all US2 policy/schema/repository/HTTP/constraint tests plus phase coverage and record exact results in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (SC-003, SC-006, SC-007)
- [x] T074 [US2] Record US2 independent-test and FR-013–FR-021 evidence in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md`

**Checkpoint**: Units and service fields/options are independently configurable
and validated; country/media/snapshot delivery remains pending.

---

## Phase 5: User Story 3 — Control availability, lifecycle, display order, and Egypt seed (Priority: P2)

**Goal**: Staff controls country availability, lifecycle, and deterministic
orders; internal selectable-reader behavior and the minimal Egypt seed are
correct.

**Independent Test**: A complete service becomes selectable for `EG` only while
category/service/availability are eligible; reorder/lifecycle races have one
winner; two seed runs preserve exact IDs/counts and staff-managed changes.

### US3 tests first

- [x] T075 [P] [US3] Add failing category/service/child activation and selectability truth-table tests in `tests/unit/catalog/catalog-lifecycle.policy.test.ts` (FR-011, FR-022–FR-026, SC-004)
- [x] T076 [P] [US3] Add failing active-country resolution/inactive/unknown country tests using Configuration fakes in `tests/unit/catalog/catalog-country.policy.test.ts` (FR-022, FR-023)
- [x] T077 [P] [US3] Add failing exact-set category/service/child/media order-vector tests in `tests/unit/catalog/catalog-order.policy.test.ts` (FR-024, FR-027, FR-028)
- [x] T078 [P] [US3] Add failing availability/lifecycle/order/version propagation repository tests in `tests/integration/catalog/catalog-availability-lifecycle.repository.test.ts` (FR-022–FR-029)
- [x] T079 [P] [US3] Add failing protected management lifecycle/order Supertest journeys and assert no anonymous/customer Browse route in `tests/integration/http/catalog-availability-lifecycle.test.ts` (FR-022–FR-029, FR-036–FR-037, FR-050, SC-001, SC-004)
- [x] T080 [US3] Add category/service simultaneous lifecycle/order race tests with stable lock-order assertions in `tests/integration/catalog/catalog-lifecycle-concurrency.test.ts` (FR-028, FR-034–FR-035, SC-006)
- [x] T081 [P] [US3] Add failing exact DEC-044 seed-value and preserve-owner-change policy tests in `tests/unit/catalog/catalog-seed.test.ts` (FR-047–FR-049, SC-005)
- [x] T082 [US3] Add failing PostgreSQL clean/double-run/selectability seed integration tests in `tests/integration/catalog/catalog-live-disposable.test.ts` guarded to an approved R1-P08 target (FR-047–FR-049, SC-005)

### US3 implementation

- [x] T083 [US3] Wire transaction-bound `ActiveCountryReader` use through `src/modules/catalog/catalog.repository.ts` and `src/composition.ts` without duplicating Country persistence (FR-022, FR-023)
- [x] T084 [US3] Implement availability, lifecycle, and selectability policies in `src/modules/catalog/catalog.policy.ts` including no locale fallback and no hidden third state (FR-011, FR-022–FR-026)
- [x] T085 [US3] Implement deterministic category/service/availability/order locking and persistence in `src/modules/catalog/catalog.repository.ts` (FR-022–FR-028, FR-034)
- [x] T086 [US3] Implement lifecycle/availability management commands in `src/modules/catalog/catalog.service.ts` with exact versions, idempotency, and atomic audit (FR-022–FR-026, FR-028, FR-032–FR-035)
- [x] T087 [US3] Implement full category/service order replacement commands in `src/modules/catalog/catalog.service.ts` and `catalog.repository.ts` with exact ID/version sets (FR-024, FR-027, FR-028)
- [x] T088 [US3] Implement protected lifecycle/order controllers/routes/schemas in `src/modules/catalog/catalog.controller.ts`, `catalog.routes.ts`, and `catalog.schema.ts` (FR-024–FR-028, FR-037)
- [x] T089 [US3] Implement the exact-locale/country selectable service list query and module-public DTO in `src/modules/catalog/catalog.repository.ts`, `catalog.service.ts`, and `catalog.public.ts`, with no HTTP exposure (FR-008–FR-012, FR-022–FR-026, FR-042, FR-050)
- [x] T090 [US3] Implement child-service version propagation for category content/lifecycle/order changes in `src/modules/catalog/catalog.repository.ts` and cover it in `tests/integration/catalog/catalog-live-disposable.test.ts` (FR-027, FR-028, FR-034)
- [x] T091 [US3] Add DEC-043 Authentication permission/reason and DEC-044 create-if-missing Catalog seed composition to `prisma/seed.ts` using empty update branches for existing rows (FR-030, FR-047–FR-049)
- [x] T092 [US3] Implement exact bilingual Home Cleaning/Standard Home Cleaning/two-unit/five-field/EG values and OQ-002 neutrality in `prisma/seed.ts` (FR-021, FR-047–FR-049)
- [x] T093 [P] [US3] Add only protected runtime lifecycle/order OpenAPI paths and an explicit no-anonymous-Browse parity assertion to `src/swagger/r1-p08-openapi.paths.ts` (FR-022–FR-028, FR-037, FR-042, FR-050)
- [x] T094 [P] [US3] Add protected lifecycle/order and seed-observation requests, with no anonymous Browse request, to `scripts/generate-r1-p08-postman.ts` (FR-022–FR-028, FR-037, FR-050)
- [x] T095 [US3] Make T075–T082 pass, including one-winner races and owner-change-preserving seed reruns, without using an unapproved database (FR-022–FR-029, FR-047–FR-049)
- [x] T096 [US3] Run US3 focused suites/coverage and record exact results or the explicit safe-target blocker in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (SC-004–SC-006)
- [x] T097 [US3] Record US3 independent-test and FR-022–FR-029/FR-047–FR-049 evidence in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md`

**Checkpoint**: Non-media seeded Catalog selection is operational for Egypt;
service images and full snapshot-ready detail remain pending.

---

## Phase 6: User Story 4 — Manage service media safely (Priority: P2)

**Goal**: Staff uploads, orders, presents, and detaches service images while
Media retains file lifecycle ownership.

**Independent Test**: One READY Catalog image associates in deterministic order;
invalid/wrong-purpose states fail; retry resumes one Media ID; CAS/audit failure
leaves no association/version and requests cleanup; detach preserves Media row.

### US4 tests first

- [x] T098 [P] [US4] Add failing Catalog image MIME/size/normalization/receipt policy tests in `tests/unit/catalog/catalog-media.policy.test.ts` (FR-038–FR-040)
- [x] T099 [P] [US4] Add failing Media ingest/status/READY/delivery/cleanup adapter tests in `tests/integration/media/catalog-service-image.test.ts` (FR-038–FR-040)
- [x] T100 [P] [US4] Add failing association uniqueness/order/non-deletion repository tests in `tests/integration/catalog/catalog-media.repository.test.ts` (FR-040, FR-041, SC-008)
- [x] T101 [P] [US4] Add failing reserve→ingest→finalize orchestration tests in `tests/unit/catalog/catalog-media.service.test.ts` (FR-035, FR-038–FR-041)
- [x] T102 [US4] Add audit/CAS/auth/Media failure compensation tests in `tests/integration/catalog/catalog-media-compensation.test.ts` (FR-031–FR-035, FR-038–FR-041, SC-006–SC-008)
- [x] T103 [US4] Add crash/pending/same-key retry and different-payload conflict tests in `tests/integration/catalog/catalog-media-idempotency.test.ts` (FR-035, FR-040, SC-006)
- [x] T104 [P] [US4] Add failing multipart add/reorder/remove Supertest journeys in `tests/integration/http/catalog-management-media.test.ts` (FR-036–FR-041)
- [x] T105 [P] [US4] Add protected-delivery/internal-reference/storage-key/uploader redaction tests in `tests/unit/catalog/catalog-output-redaction.test.ts` and `tests/integration/catalog/catalog-selectable-media.test.ts` (FR-036, FR-039–FR-044)

### US4 implementation

- [x] T106 [US4] Implement Catalog image normalization/storage/receipt/delivery/cleanup in Media-owned files under `src/modules/media/` by reusing safe image infrastructure without Provider coupling (FR-038, FR-039)
- [x] T107 [US4] Implement idempotent supplied-media-ID reserve/read and transaction-bound READY owner-type/uploader authorization in `src/modules/media/infrastructure/prisma-media.repository.ts` (FR-038–FR-040)
- [x] T108 [US4] Implement service-media association lock/read/add/reorder/remove persistence in `src/modules/catalog/catalog.repository.ts` (FR-040, FR-041)
- [x] T109 [US4] Implement resumable PENDING receipt, external ingest, final reauthorization/CAS/READY check, atomic association/version/audit, and cleanup orchestration in `src/modules/catalog/catalog.service.ts` (FR-031–FR-035, FR-038–FR-041)
- [x] T110 [US4] Implement deterministic media reorder and detach-without-file-delete commands in `src/modules/catalog/catalog.service.ts` (FR-041)
- [x] T111 [US4] Add safe multipart parser/limits and media command schemas in `src/modules/catalog/catalog.schema.ts` plus a focused `catalog-media.multer.ts` only if existing router middleware cannot express them (FR-036, FR-038–FR-040)
- [x] T112 [US4] Add thin media add/reorder/remove controller and routes in `src/modules/catalog/catalog.controller.ts` and `catalog.routes.ts` (FR-037–FR-041)
- [x] T113 [US4] Add safe short-lived protected-management delivery presentation using the Media public port in `src/modules/catalog/catalog.service.ts` and `catalog.controller.ts`, keeping the internal reader on stable references (FR-039, FR-042–FR-044)
- [x] T114 [P] [US4] Add runtime media paths/schemas/statuses to `src/swagger/r1-p08-openapi.paths.ts` (FR-036–FR-041)
- [x] T115 [P] [US4] Add multipart add/reorder/remove and invalid-Media examples to `scripts/generate-r1-p08-postman.ts` (FR-037–FR-041)
- [x] T116 [US4] Implement safe Media dependency errors, cleanup logs, and audit redaction in `src/modules/catalog/catalog.errors.ts` and `catalog.service.ts` (FR-033, FR-036, FR-038–FR-041)
- [x] T117 [US4] Make T098–T105 pass and run focused Media/Catalog/HTTP/phase-coverage suites, recording exact results in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (SC-006–SC-008)
- [x] T118 [US4] Record US4 independent-test and FR-038–FR-041 evidence in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md`

**Checkpoint**: Service media is usable through the approved boundary and no
Media lifecycle ownership moved into Catalog.

---

## Phase 7: User Story 5 — Consume snapshot-ready Catalog facts (Priority: P3)

**Goal**: Later-module consumers receive, through the internal Catalog contract,
one exact-locale, country-selectable, internally consistent current service
definition without direct persistence access or historical snapshot ownership.

**Independent Test**: During a concurrent live edit, the reader returns either
the complete old or complete new `serviceVersion`, never a mix; copied fixture
truth stays unchanged after later edits and no Booking/history row is created.

### US5 tests first

- [x] T119 [P] [US5] Add failing public-contract compile/shape/no-Prisma tests for summaries, fields, decimal strings, Media refs, and reader methods in `tests/unit/modules/r1-p08-public-contracts.test.ts` (FR-042–FR-045)
- [x] T120 [P] [US5] Add failing snapshot-ready repository projection tests in `tests/integration/catalog/catalog-definition.repository.test.ts` (FR-042–FR-044, SC-009)
- [x] T121 [US5] Add concurrent mutation/read consistency tests proving one aggregate version in `tests/integration/catalog/catalog-definition-concurrency.test.ts` (FR-034, FR-044, SC-009)
- [x] T122 [P] [US5] Add exact AR/EN, no-fallback, EG, inactive/unavailable, ordering, pagination, and safe-Media internal-reader integration tests in `tests/integration/catalog/catalog-selectable-definition.test.ts` (FR-008–FR-012, FR-022–FR-026, FR-042–FR-044)
- [x] T123 [P] [US5] Add copied-fixture stability and no Booking/provider-price/answer persistence assertions in `tests/integration/catalog/catalog-snapshot-boundary.test.ts` (FR-006, FR-015, FR-021, FR-045, FR-046, FR-050)
- [x] T124 [P] [US5] Extend cross-module import scans for Catalog public-only consumers in `tests/unit/modules/r1-p08-module-boundaries.test.ts` (FR-002, FR-007, FR-043)

### US5 implementation

- [x] T125 [US5] Finalize `CatalogDefinitionReader`, exact DTOs, decimal-string rules, and stable Media references in `src/modules/catalog/catalog.public.ts` (FR-042–FR-045)
- [x] T126 [US5] Implement one-snapshot selectable list/detail and snapshot-ready aggregate queries in `src/modules/catalog/catalog.repository.ts` (FR-022–FR-026, FR-042–FR-044)
- [x] T127 [US5] Implement management-neutral reader/list/detail use cases in `src/modules/catalog/catalog.service.ts` with exact locale/country and no fallback/draft leakage (FR-008–FR-012, FR-042–FR-044)
- [x] T128 [US5] Implement the thin `CatalogDefinitionReader` adapter/factory in `src/modules/catalog/catalog.public.ts` over the management-neutral service use cases, with no controller or route (FR-042, FR-043, FR-050)
- [x] T129 [US5] Compose the internal reader factory in `src/composition.ts` without mounting any selectable Catalog router in `src/routes/index.ts` (FR-042, FR-043, FR-050)
- [x] T130 [P] [US5] Add runtime route/OpenAPI parity tests in `tests/unit/swagger/r1-p08-openapi-parity.test.ts` proving R1-P08 documents protected management only and no `/api/v1/catalog/services*` Browse operation (FR-037, FR-042–FR-044, FR-050)
- [x] T131 [P] [US5] Complete protected exact-locale management examples and assert no anonymous Browse request in `scripts/generate-r1-p08-postman.ts` (FR-037, FR-042–FR-044, FR-050)
- [x] T132 [US5] Enforce internal-reader safe null/dependency behavior plus management DTO/log redaction in `src/modules/catalog/catalog.errors.ts` and `catalog.service.ts` without inventing a public controller (FR-036, FR-042–FR-044, FR-050)
- [x] T133 [US5] Make T119–T124 pass and run focused public-contract/repository/concurrency/internal-reader tests with exact counts recorded in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (SC-002–SC-004, SC-008, SC-009)
- [x] T134 [US5] Run phase coverage after all five stories and resolve uncovered behavior branches without excluding R1-P08 source in `vitest.r1-p08.config.ts` (FR-052, SC-012)
- [x] T135 [US5] Record US5 independent-test and FR-042–FR-046 evidence in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md`

**Checkpoint**: All five user stories are implemented and independently tested;
final database/global/review evidence remains.

---

## Phase 8: Cross-cutting validation, migration evidence, review, and owner handoff

**Purpose**: Prove all FR/SC/DoD gates without weakening authorization, database,
Git, production, or human-completion boundaries.

- [x] T136 Complete R1-P08 package scripts and include R1-P08 in aggregate Postman generation in `package.json` without changing unrelated script semantics (FR-037, FR-052)
- [x] T137 Generate/update only R1-P08 Postman artifacts under `postman/` from `scripts/generate-r1-p08-postman.ts` and keep unrelated local Postman directories untouched (FR-037, FR-052)
- [x] T138 Document the implemented protected-management API, internal Catalog public contract, explicit no-anonymous-Browse boundary, and safe examples in `docs/README.md` and the R1-P08 section of `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-037, FR-042–FR-044, FR-050)
- [x] T139 Add/complete protected-management OpenAPI/Postman/runtime-Zod parity and no-anonymous-Browse tests in `tests/unit/swagger/r1-p08-openapi-parity.test.ts`, `tests/unit/swagger/r1-p08-openapi-fragments.test.ts`, and `tests/unit/catalog/r1-p08-postman-schema-parity.test.ts` (FR-036–FR-044, FR-050)
- [x] T140 Run `npm.cmd run prisma:validate` and `npm.cmd run prisma:generate`; record exact exits and generated-schema status in `specs/R1-P08-catalog-localization-service-requirements/migration-review.md` (FR-051, SC-011)
- [x] T141 Re-review the complete generated R1-P08 SQL against `migration-plan.md`, all live/static constraint expectations, and applied-migration immutability in `specs/R1-P08-catalog-localization-service-requirements/migration-review.md` (FR-051, FR-052)
- [x] T142 Implement/finish the guarded clean chronological validation path in `scripts/validate-clean-migration.ts` or a narrowly named R1-P08 helper plus `tests/unit/scripts/validate-clean-migration.test.ts` without weakening target guards (FR-051, FR-052, SC-011)
- [x] T143 Implement the populated R1-P07→R1-P08 validator in `scripts/validate-r1-p08-upgrade.ts` and `tests/unit/scripts/validate-r1-p08-upgrade.test.ts`, including baseline digests and double-seed/live-constraint probes (FR-047–FR-052, SC-005, SC-011)
- [x] T144 After an explicitly approved phase-named disposable target exists, run the clean 15-migration/seed-twice/live-constraint proof and record raw commands, target safety, table/row counts, digests, and exits in `specs/R1-P08-catalog-localization-service-requirements/migration-evidence.md` (FR-047–FR-052, SC-005, SC-011)
- [x] T145 After an explicitly approved separate target exists, run the populated R1-P07 upgrade proof and record preserved baseline/Media/Auth/Provider/Worker truth in `specs/R1-P08-catalog-localization-service-requirements/migration-evidence.md` (FR-051, FR-052, SC-011)
- [x] T146 Re-run the seed twice after an owner-managed localized/order/lifecycle change and record no-overwrite evidence plus exact DEC-044 counts in `specs/R1-P08-catalog-localization-service-requirements/migration-evidence.md` (FR-047–FR-049, SC-005)
- [x] T147 Run `npm.cmd run test:unit` and record exact files/tests/skips/exits in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-052, SC-012)
- [x] T148 Run `npm.cmd run test:r1-p08` and record exact files/tests/skips/exits in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-052, SC-012)
- [x] T149 Run `npm.cmd run test:coverage:r1-p08` and record exact statement/branch/function/line coverage in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-052, SC-012)
- [x] T150 Run `npm.cmd run test:integration` and record exact files/tests/skips/exits in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-052, SC-012) — **DEC-045 rerun 2026-09-02**: 169 passed / 3 skipped files, 601 passed / 5 skipped tests, exit 0
- [x] T151 Run `npm.cmd run test:coverage` and record unchanged global threshold evidence in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-052, SC-012) — **DEC-045 rerun 2026-09-02**: 83.69 / 75.03 / 86.46 / 85.61, exit 0
- [x] T152 Run typecheck, lint, build, OpenAPI, Postman, docs, Prisma, audit-high, and `git diff --check`; record every exact exit and distinguish any unrelated failure in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` (FR-036, FR-037, FR-051, FR-052, SC-012)
- [x] T153 Review the complete diff for module ownership/import/transaction/public-contract violations and record file/line evidence in `specs/R1-P08-catalog-localization-service-requirements/module-boundary-review.md` (FR-001, FR-002, FR-007, FR-039, FR-043, FR-050)
- [x] T154 Audit the complete implementation for role/reason separation, atomic audit, privacy/redaction, Media lifecycle, idempotency/races, safe errors, and forbidden future scope in `specs/R1-P08-catalog-localization-service-requirements/security-validation.md` (FR-030–FR-046, SC-006–SC-009)
- [x] T155 Run an independent read-only Cursor Claude review against the frozen spec/plan/tasks and complete diff, record the verdict in `specs/R1-P08-catalog-localization-service-requirements/implementation-review-report.md`, resolve/reject every valid BLOCKER/MAJOR with tests and evidence in `review-resolution.md`, and rerun affected gates (FR-052, SC-012)
- [x] T156 Reconcile T001–T156 and 100% FR/SC evidence in `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md` and `completion-report.md`, update `docs/product/current.md` only to `Ready for owner completion approval`, execute mandatory Companion after-implement capture, and do not mark the phase Complete or perform Git/production actions without separate owner approval (SC-010, SC-012)

---

## Dependencies and execution order

### Phase dependencies

- Phase 1 has no code dependency and establishes the guarded baseline.
- Phase 2 depends on Phase 1 and blocks every story.
- US1 depends on Phase 2 and is the MVP taxonomy slice.
- US2 depends on US1 because configuration belongs to a service aggregate.
- US3 depends on US1+US2 because activation/selectability validates localized
  service configuration; its seed is the first complete non-media journey.
- US4 depends on the service aggregate/idempotency foundation but is otherwise
  isolated from seed and snapshot logic.
- US5 depends on US1–US4 so its definition can include every current fact.
- Phase 8 depends on all stories and never substitutes focused green tests for
  global/database/review evidence.

### Story completion order

```text
Setup → Foundation → US1 → US2 → US3
                         └──────→ US4
US3 + US4 → US5 → Final validation/review
```

### Within each story

1. Write focused failing tests.
2. Implement policy/persistence/service behavior.
3. Add protected HTTP and/or module-public contracts plus required runtime
   artifacts, according to the story boundary.
4. Make focused tests pass and run phase coverage.
5. Record checkpoint evidence before the next story.

## Parallel opportunities

- `[P]` unit, HTTP-contract, public-contract, and migration-static tests that
  touch different files can be written together.
- Runtime OpenAPI and Postman work for one finished story can run in parallel.
- US4 Media adapter tests can begin after Foundation while US3 lifecycle/seed
  work proceeds, but both must converge before US5.
- Do not parallelize tasks that modify `prisma/schema.prisma`, the R1-P08
  migration, `catalog.repository.ts`, `catalog.service.ts`, `src/composition.ts`,
  `prisma/seed.ts`, or the same shared test file.

### Parallel example: US2

```text
T055 service-field policy tests
T056 price-unit policy tests
T057 configuration schema tests
T059 HTTP configuration contract tests
```

After T061–T066 are stable:

```text
T067 runtime OpenAPI configuration contract
T068 Postman configuration examples
```

### Parallel example: US4

```text
T098 Catalog Media policy tests
T099 Media integration contract tests
T100 association repository tests
T104 multipart HTTP tests
T105 output redaction tests
```

## Implementation strategy

### MVP first

1. Finish Setup and Foundation.
2. Finish US1 and its checkpoint.
3. Validate the protected localized taxonomy before extending the aggregate.

### Incremental delivery

1. US1: stable bilingual category/service management.
2. US2: atomic price-unit/field graph.
3. US3: lifecycle/order/country/seed internal-selectable slice.
4. US4: service images through Media boundary.
5. US5: snapshot-ready current contract.
6. Final: database/global/review evidence and owner handoff.

### Cursor/Codex handoff

- Cursor receives only this frozen task list plus the canonical artifacts and
  implements in dependency order, reporting checkpoints and blockers without
  choosing product behavior.
- Codex reviews every diff/checkpoint, independently verifies commands and
  findings, protects architecture/database/Git boundaries, and owns final gate
  interpretation.
- Environment-sensitive T144–T146 wait for an explicitly safe approved target;
  that wait does not authorize an unknown database.

## Requirement traceability

| Requirement | Primary task coverage |
|---|---|
| FR-001–FR-007 | T002, T012, T020, T023, T040–T042, T124, T153 |
| FR-008–FR-012 | T033–T045, T052–T054, T122, T127 |
| FR-013–FR-015 | T056, T058, T061–T064, T073–T074 |
| FR-016–FR-020 | T014, T055, T057–T069, T073–T074 |
| FR-021 | T072, T092, T123 |
| FR-022–FR-026 | T075–T089, T093–T097, T122, T126–T127 |
| FR-027–FR-029 | T039–T043, T077–T090, T095–T097 |
| FR-030–FR-033 | T009–T010, T016–T017, T028–T029, T036, T042–T043, T086–T087, T154 |
| FR-034–FR-035 | T015, T027–T029, T038, T042–T043, T070–T071, T080, T086–T090, T101–T103, T109–T110, T121 |
| FR-036–FR-037 | T025, T037, T045–T051, T059, T065–T068, T079, T088, T093–T094, T104, T111–T116, T128–T132, T136–T139, T152 |
| FR-038–FR-041 | T011, T018–T019, T098–T118, T154 |
| FR-042–FR-044 | T011–T012, T044, T064, T089, T105, T113, T119–T132, T138–T139, T153 |
| FR-045–FR-046 | T064, T119–T127, T135, T153 |
| FR-047–FR-049 | T006, T081–T082, T091–T097, T143–T146 |
| FR-050 | T001–T002, T012–T013, T020, T023, T030, T123–T124, T153–T156 |
| FR-051 | T013–T014, T020–T023, T032, T069, T140–T145, T152 |
| FR-052 | T001, T003–T008, T032, T053, T073, T096, T117, T133–T156 |
| SC-001 | T037, T042–T054, T079, T096 |
| SC-002 | T033, T039, T052–T054, T122, T127, T133 |
| SC-003 | T055–T074 |
| SC-004 | T075, T079, T084–T089, T095–T097, T122 |
| SC-005 | T006, T081–T082, T091–T097, T143–T146 |
| SC-006 | T015, T027, T038, T071, T080, T095–T096, T102–T103, T117, T121 |
| SC-007 | T009–T010, T016–T017, T028–T029, T036, T042–T043, T052–T054, T154 |
| SC-008 | T098–T118, T133, T154 |
| SC-009 | T119–T135, T154 |
| SC-010 | T007, T156 and this matrix |
| SC-011 | T006, T013–T014, T020–T023, T140–T146 |
| SC-012 | T004, T008, T032, T053, T073, T096, T117, T133–T156 |

## Notes

- Every checkbox remains unchecked until the exact task and its evidence are
  actually complete.
- Preserve unrelated dirty files and untracked design/Postman assets.
- Never edit an applied migration or use an unapproved database.
- No task means “commit after completion.” The guarded Git workflow requires a
  separate human message whose entire content is exactly `commit and push`.

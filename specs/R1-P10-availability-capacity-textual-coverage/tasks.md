# Tasks: R1-P10 — Availability, Capacity & Textual Coverage

Every task is mandatory unless explicitly labeled evidence-only. Tests are written before or with their owning behavior. Cursor batches are sequential writers.

## Phase 1 — Setup and test boundary

- [x] T001 Add `@js-temporal/polyfill` and Phase 10 scripts to `package.json` and lockfile
- [x] T002 Create exact Phase 10 test/coverage selection in `vitest.r1-p10.config.ts`
- [x] T003 Add a test that asserts the resolved Phase 10 selection excludes historical suites in `tests/unit/scripts/r1-p10-test-selection.test.ts`
- [x] T004 Create reusable Phase 10 fixtures without secrets in `tests/helpers/r1-p10-availability-fixtures.ts`
- [x] T005 Record pre-implementation selection and preservation evidence in `specs/R1-P10-availability-capacity-textual-coverage/implementation-evidence.md`

## Phase 2 — Persistence, contracts and authorization foundation

- [x] T006 Add Phase 10 Prisma models/relations/enums to `prisma/schema.prisma`
- [x] T007 Create and SQL-review `prisma/migrations/r1_p10_availability_capacity_textual_coverage/migration.sql`
- [x] T008 Update Egypt time-zone and locality-safe seed behavior in `prisma/seed.ts`
- [x] T009 Add Configuration locality read/write permissions and privileged reason in `src/modules/authentication/domain/authorization.catalog.ts`
- [x] T010 Update authorization types/public contract for the new protected operations in `src/modules/authentication/domain/authorization.types.ts` and `src/modules/authentication/authentication.public.ts`
- [x] T011 [P] Add authorization catalog tests in `tests/unit/modules/authentication/authorization-r1-p10.test.ts`
- [x] T012 Evolve `platform.default_timezone` to validated country-required IANA resolution in `src/modules/configuration/config-key.catalog.ts`
- [x] T013 Add Configuration locality domain types/errors/schemas in `src/modules/configuration/locality.types.ts` and `src/modules/configuration/locality.schema.ts`
- [x] T014 Add Configuration locality repository and transaction-bound reader in `src/modules/configuration/infrastructure/prisma-locality.repository.ts`
- [x] T015 Expose the narrow locality/time-zone reader in `src/modules/configuration/configuration.public.ts`
- [x] T016 Add Providers availability types, blockers, interval policy and Temporal calendar utility in `src/modules/providers/domain/provider-availability*.ts`
- [x] T017 Add Provider availability ports and Prisma error mapping in `src/modules/providers/domain/provider-availability.ports.ts` and `src/modules/providers/infrastructure/provider-availability-prisma-errors.ts`
- [x] T018 Add Provider availability repository/UoW with Serializable mutations and RepeatableRead evaluation in `src/modules/providers/infrastructure/prisma-provider-availability*.ts`
- [x] T019 [P] Add schema/constraint tests in `tests/integration/database/r1-p10-schema-constraints.test.ts`
- [x] T020 Add module-boundary tests for Configuration/Providers/Authentication seams in `tests/unit/modules/r1-p10-module-boundaries.test.ts`

## Phase 3 — User Story 1: textual areas and Provider coverage

**Independent test**: Staff maintains active localized ancestry; Owner/Admin replaces city/district coverage; matching honors whole-city inclusion and inactivity.

- [x] T021 [P] [US1] Add locality service unit tests in `tests/unit/configuration/locality.service.test.ts`
- [x] T022 [P] [US1] Add Staff locality HTTP authorization/validation tests in `tests/integration/http/r1-p10-staff-localities.test.ts`
- [x] T023 [US1] Implement versioned/audited Staff locality service in `src/modules/configuration/locality.service.ts`
- [x] T024 [US1] Implement Staff locality controller/routes in `src/modules/configuration/locality.controller.ts` and `src/modules/configuration/locality.routes.ts`
- [x] T025 [US1] Wire locality services/routes through `src/composition.ts` and `src/routes/index.ts`
- [x] T026 [P] [US1] Add Provider coverage policy/service unit tests in `tests/unit/providers/provider-availability-coverage.test.ts`
- [x] T027 [P] [US1] Add coverage repository/idempotency/concurrency tests in `tests/integration/providers/provider-availability-coverage.repository.test.ts`
- [x] T028 [P] [US1] Add protected coverage HTTP isolation tests in `tests/integration/http/r1-p10-provider-coverage.test.ts`
- [x] T029 [US1] Implement full-replacement Provider coverage service in `src/modules/providers/provider-availability.service.ts`
- [x] T030 [US1] Implement coverage schemas/controller/routes in `src/modules/providers/provider-availability.schema.ts`, `src/modules/providers/provider-availability.controller.ts` and `src/modules/providers/provider-availability.routes.ts`
- [x] T031 [US1] Wire Provider availability routes through `src/composition.ts` and `src/routes/index.ts`
- [x] T032 [US1] Prove active district, whole-city, new-district and inactive-ancestry matching in `tests/integration/providers/provider-textual-coverage.test.ts`

## Phase 4 — User Story 2: Provider schedule, exceptions and pause

**Independent test**: evaluate ordinary, overnight, exception, DST and paused intervals using the country zone.

- [x] T033 [P] [US2] Add half-open/overnight/exception/DST policy tests in `tests/unit/providers/provider-availability-calendar.test.ts`
- [x] T034 [P] [US2] Add Provider schedule HTTP validation/version/replay tests in `tests/integration/http/r1-p10-provider-schedules.test.ts`
- [x] T035 [P] [US2] Add Provider schedule repository/concurrency tests in `tests/integration/providers/provider-schedules.repository.test.ts`
- [x] T036 [US2] Implement Provider weekly/exception replacement in `src/modules/providers/provider-availability.service.ts`
- [x] T037 [US2] Extend Provider schemas/controller/routes for weekly schedules and dated exceptions in `src/modules/providers/provider-availability.schema.ts`, `src/modules/providers/provider-availability.controller.ts` and `src/modules/providers/provider-availability.routes.ts`
- [x] T038 [P] [US2] Add pause policy/time-boundary tests in `tests/unit/providers/provider-temporary-pause.test.ts`
- [x] T039 [P] [US2] Add pause serialization and idempotency tests in `tests/integration/providers/provider-temporary-pause.repository.test.ts`
- [x] T040 [P] [US2] Add protected pause HTTP tests in `tests/integration/http/r1-p10-provider-pause.test.ts`
- [x] T041 [US2] Implement start/read/resume/expiry pause behavior in `src/modules/providers/provider-availability.service.ts`
- [x] T042 [US2] Extend Provider schemas/controller/routes for pause operations in `src/modules/providers/provider-availability.schema.ts`, `src/modules/providers/provider-availability.controller.ts` and `src/modules/providers/provider-availability.routes.ts`
- [x] T043 [US2] Add safe availability history and command replay persistence in `src/modules/providers/infrastructure/prisma-provider-availability.repository.ts` (schedule/exception `schedule.configuration.replaced` and pause `pause.started`/`pause.resumed` command replay/history done)
- [x] T044 [US2] Prove suspension and pause block runtime evaluation without erasing configuration in `tests/integration/providers/provider-availability-runtime-state.test.ts`

## Phase 5 — User Story 3: Worker schedules and complete-Team capacity

**Independent test**: Worker/Provider intersection and complete-Team calculation produce the approved capacity without reservations.

- [x] T045 [P] [US3] Add Worker schedule/exception policy tests in `tests/unit/providers/worker-availability-calendar.test.ts`
- [x] T046 [P] [US3] Add owned Worker schedule HTTP isolation tests in `tests/integration/http/r1-p10-worker-schedules.test.ts`
- [x] T047 [P] [US3] Add Worker schedule repository/version/idempotency tests in `tests/integration/providers/worker-schedules.repository.test.ts`
- [x] T048 [US3] Implement Worker schedule replacement and Provider intersection in `src/modules/providers/provider-worker-availability.service.ts`
- [x] T049 [US3] Extend schemas/controller/routes for owned Worker schedules in `src/modules/providers/provider-availability.schema.ts`, `src/modules/providers/provider-availability.controller.ts` and `src/modules/providers/provider-availability.routes.ts`
- [x] T050 [P] [US3] Add complete-Team capacity policy tests including Escorts/non-cleaners in `tests/unit/providers/provider-team-capacity.test.ts`
- [x] T051 [P] [US3] Add capacity rule HTTP/version tests in `tests/integration/http/r1-p10-provider-capacity.test.ts`
- [x] T052 [P] [US3] Add capacity repository/concurrency tests in `tests/integration/providers/provider-capacity.repository.test.ts`
- [x] T053 [US3] Implement capacity replacement and complete-Team evaluation in `src/modules/providers/provider-capacity.service.ts`
- [x] T054 [US3] Extend schemas/controller/routes for capacity in `src/modules/providers/provider-availability.schema.ts`, `src/modules/providers/provider-availability.controller.ts` and `src/modules/providers/provider-availability.routes.ts`
- [x] T055 [US3] Consume current Team/member facts through Providers-owned application ports in `src/modules/providers/provider-capacity.service.ts`
- [x] T056 [US3] Prove three-Team/limit-two, incomplete Team and unteamed Worker cases in `tests/integration/providers/provider-capacity-evaluation.test.ts`

## Phase 6 — User Story 4: public facts and readiness

**Independent test**: candidate lookup and one-Provider evaluation return stable facts/versions without customer HTTP or reservation behavior.

- [x] T057 [P] [US4] Add public contract shape/privacy tests in `tests/unit/providers/provider-operational-availability.public.test.ts`
- [x] T058 [P] [US4] Add readiness policy tests for DEC-060 in `tests/unit/providers/provider-availability-readiness.test.ts`
- [x] T059 [P] [US4] Add snapshot-consistency/evaluation tests in `tests/integration/providers/provider-operational-availability.test.ts`
- [x] T060 [US4] Implement candidate/evaluation query service in `src/modules/providers/provider-operational-availability.service.ts`
- [x] T061 [US4] Export only the narrow reader/factory from `src/modules/providers/providers.public.ts`
- [x] T062 [US4] Replace Phase 10 readiness placeholders in `src/modules/providers/domain/provider-readiness.policy.ts`
- [x] T063 [US4] Inject live readiness facts in `src/modules/providers/provider-projection.service.ts`
- [x] T064 [US4] Wire transaction-bound Configuration reader and public factory in `src/composition.ts`
- [x] T065 [US4] Assert no customer/anonymous evaluation route exists in `tests/unit/modules/r1-p10-module-boundaries.test.ts`

## Phase 7 — API artifacts, migration evidence and closure

- [x] T066 Add source OpenAPI contract in `docs/apis/openapi/r1-p10-availability-capacity-textual-coverage.yaml`
  - Evidence: YAML documents all 19 protected Staff locality/time-zone and Provider availability operations with synthetic examples only.
- [x] T067 Add runtime Swagger fragments in `src/swagger/r1-p10-openapi.paths.ts` and `src/swagger/openapi.document.ts`
  - Evidence: YAML-backed fragments wired into runtime document; info version `1.0.0-r1-p10`.
- [x] T068 Add Phase 10 Postman generator in `scripts/generate-r1-p10-postman.ts` and register it in `package.json`
  - Evidence: `postman:generate:r1-p10` and aggregate `postman:generate` include Phase 10.
- [x] T069 Generate `postman/Cleanora-R1-P10-Availability-Capacity-Textual-Coverage.postman_collection.json`
  - Evidence: Generated Hosted/Local collection with 19×2 protected requests.
- [x] T070 Add Swagger/Postman parity and safe-example tests in `tests/unit/swagger/r1-p10-openapi.test.ts` and `tests/unit/providers/r1-p10-postman-schema-parity.test.ts`
  - Evidence: Registered in `vitest.r1-p10.config.ts`.
- [x] T071 Update API/document navigation in `docs/apis/README.md`, `docs/swagger/README.md`, `scripts/docs-check.ts` and `scripts/README.md`
  - Evidence: Navigation, docs-check required paths, and openapi-validate defaults updated.
- [x] T072 Add Phase 10 upgrade validator and unit tests in `scripts/validate-r1-p10-upgrade.ts` and `tests/unit/scripts/validate-r1-p10-upgrade.test.ts`
  - Evidence: Guarded upgrade validator mirrors P09; unit tests cover URL/SQL/digest guards without live migrate.
- [x] T073 Run and record Prisma, typecheck, lint, build, OpenAPI, Postman, docs and diff gates in `specs/R1-P10-availability-capacity-textual-coverage/implementation-evidence.md`
  - Evidence: Fresh 2026-09-09 final gates pass for Prisma/typecheck/build/docs/OpenAPI/Postman/diff and phase-scoped ESLint; whole-tree lint remains non-evidence because unrelated untracked `.agents` relay files are present.
- [x] T074 Run and record Phase 10 tests/coverage with resolved selection and four metrics in `specs/R1-P10-availability-capacity-textual-coverage/implementation-evidence.md`
  - Evidence: Approved disposable live run passed 43 files / 301 tests; coverage 86.85% statements, 76.47% branches, 93.38% functions and 87.60% lines (SC-006 PASS).
- [x] T075 Run and record disposable clean/upgrade migration evidence in `specs/R1-P10-availability-capacity-textual-coverage/migration-evidence.md`
  - Evidence: Approved disposable `cleanora_r1_p10_proof` clean-chain and populated R1-P09→R1-P10 upgrade validators both exit 0 (SC-008 PASS).
- [x] T076 Review module boundaries, authorization, privacy, SQL and final diff in `specs/R1-P10-availability-capacity-textual-coverage/implementation-review-report.md`
  - Evidence: Final Codex adversarial review verdict PASS; seven correctness/integrity defects repaired with focused regressions; independent module-boundary review PASS; no unresolved BLOCKER or MAJOR.
- [x] T077 Reconcile specification/plan/contracts/tasks with final behavior and write `specs/R1-P10-availability-capacity-textual-coverage/implementation-summary.md`
  - Evidence: Summary, completion report, DEC-061 and current pointer record technical readiness PASS, explicit owner completion, Git boundaries, and fresh gate results.

## Dependencies and Cursor batches

- Batch A: T001–T032 (test boundary, schema/Configuration, textual coverage).
- Batch B: T033–T056 (Provider/Worker calendars, pause and capacity).
- Batch C: T057–T072 (public facts, readiness, HTTP documentation and validators).
- Final repair/evidence: T073–T077 after independent Codex review and affected repairs.

US1 depends on foundation. US2 depends on country zone/foundation but is otherwise separable from US1. US3 depends on the calendar foundation. US4 depends on US1–US3. Documentation and evidence follow implemented contracts. Parallel `[P]` tasks touch separate test files but must not be dispatched as overlapping workspace writers.

Suggested MVP is US1 plus the schedule foundation; technical readiness requires every task because roadmap Done When includes coverage, availability and capacity together.

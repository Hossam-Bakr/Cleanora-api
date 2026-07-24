# Tasks: Project Foundation & Country Configuration

**Input**: Design documents from `/specs/R1-P01-project-foundation-country-configuration/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Phase type**: Implementation of R1-P01 only. Converge on existing foundation; inspect before replacing. Preserve R1-P02 artifacts. No Docker/cloud, production migration, Git actions, auth features, future tables, or automatic phase completion.

**Tests**: Included and ordered **before** corresponding implementation (FR-016; user request). Write tests first; confirm they fail; then implement.

**Organization**: Phases follow US1–US7 from `spec.md`.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (different files; no unfinished dependency)
- **[USn]**: User-story tasks only
- Setup / Foundational / Polish: no story label

## Path Conventions

- App: `src/`, `tests/`, `prisma/`, `scripts/`, `docs/`, `postman/`
- Spec Kit: `specs/R1-P01-project-foundation-country-configuration/`
- Phase pointer: `docs/product/current.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Activate the phase pointer, inventory what to reuse, and prepare delivery scaffolding without rewriting working foundation files.

- [x] T001 Mark R1-P01 status `In Progress`, set `Started At` and `Last Updated` in `docs/product/current.md` (constitution II; do not set Complete)
- [x] T002 Create stub `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` with sections for baseline reuse, files changed, migration SQL review, seed evidence, exclusions, and open risks (R1-P01 roadmap Definition of Done; constitution II and VIII; phase delivery/validation evidence)
- [x] T003 Record baseline reuse inventory (inspect `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/core/http/*`, `src/integrations/logging/pino-logger.ts`, `tests/**`, `postman/R1-P00-foundation.postman_collection.json`) into `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` — note preserve-untouched R1-P02 paths (`docs/phases/release-1/R1-P02-authentication/**`, `postman/R1-P02-authentication.postman_collection.json`, `scripts/inspect-auth.ts`)
- [x] T004 Add R1-P01 dependencies only (`rate-limiter-flexible`, ESLint TypeScript stack, OpenAPI validator package) in `package.json` / `package-lock.json` without removing existing deps (research R1, R7, R11, R12)
- [x] T005 Add npm scripts `lint`, `docs:check`, `openapi:validate`, `prisma:migrate:dev`, `prisma:migrate:deploy`, `prisma:migrate:status`, `ci`, and clean-migration helper script name in `package.json` (plan delivery; FR-017)
- [x] T006 [P] Create ESLint flat config scaffold in `eslint.config.js` aligned with CommonJS/TypeScript boundaries (research R12; ADR-0005)
- [x] T007 [P] Create docs-check script stub in `scripts/docs-check.ts` that will verify required P01 doc paths exist (FR-015, FR-017)
- [x] T008 [P] Create OpenAPI validate script stub in `scripts/openapi-validate.ts` targeting `docs/apis/openapi/r1-p01-foundation.yaml` (contracts/openapi-foundation.md)

**Checkpoint**: Phase In Progress; delivery stubs exist; baseline inventory recorded; no product schema yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared env/startup convergence, five Prisma models + named migration, module scaffolds, rate-limiter adapter, and shared validation helper that ALL later stories need.

**⚠️ CRITICAL**: No user-story implementation until this phase completes.

### Tests first (foundation)

- [x] T009 [P] Extend unit tests for foundation-required env startup (missing/malformed `DATABASE_URL` / `CORS_ORIGINS`) in `tests/unit/config/env.test.ts` — assert failure diagnostics without secret leakage (FR-001–FR-003, SC-002); do not add auth-feature tests
- [x] T010 [P] Add failing integration test placeholder for `GET /api/v1/system/health/database` in `tests/integration/system-api.test.ts` (FR-005, SC-003; contracts/health-api.md)
- [x] T011 [P] Add failing unit tests for memory rate-limiter adapter fail-closed behavior in `tests/unit/core/memory-rate-limiter.test.ts` (FR-014; research R7)

### Implementation (foundation)

- [x] T012 Inspect and converge `src/config/env.ts` so **foundation-required** variables alone allow startup; keep existing auth-related keys as non-blocking optional placeholders without implementing authentication behavior; never overwrite `.env` secrets; update safe placeholders only in `.env.example` (FR-001–FR-003, SC-001–SC-002; research R2)
- [x] T013 Inspect `src/server.ts` and `src/app.ts` lifecycle; change only what is required for safe startup/shutdown and probe registration — do not rewrite unrelated middleware (FR-001, FR-004)
- [x] T014 Add shared Zod request-validation helper in `src/core/http/validate-request.ts` (and export from `src/core/http/index.ts`) mapping failures to `REQUEST_VALIDATION_FAILED` (FR-008; contracts/response-envelope.md)
- [x] T015 Implement `MemoryRateLimiterAdapter` in `src/integrations/security/memory-rate-limiter.adapter.ts` implementing `src/core/security/rate-limit.port.ts` using `rate-limiter-flexible` (FR-014; ADR-0009; research R7)
- [x] T016 Update `src/core/security/rate-limit.middleware.ts` to map limiter/storage failures to fail-closed `503 RATE_LIMITER_UNAVAILABLE` via `src/core/http/api-response.ts` (FR-014; research R7) — inspect before changing existing success path
- [x] T017 Scaffold `src/modules/configuration/` with `index.ts` public exports stub and private folders (`application/`, `domain/`, `infrastructure/`) per plan structure (FR-028; constitution III)
- [x] T018 [P] Scaffold `src/modules/admin/` with `index.ts` public exports stub and private folders (`application/`, `domain/`, `infrastructure/`) (FR-029; constitution III)
- [x] T019 Register module placeholders (no business HTTP yet) in `src/routes/register-modules.ts` without breaking existing system routes (plan structure)
- [x] T020 Add Prisma enums and models only for `currencies`, `countries`, `app_configs`, `country_configs`, `audit_logs` in `prisma/schema.prisma` per `specs/R1-P01-project-foundation-country-configuration/data-model.md` (FR-018–FR-021, FR-029, FR-033–FR-037)
- [x] T021 Create phase migration `prisma/migrations/r1_p01_foundation_country_configuration/migration.sql` via Prisma migrate workflow named **`r1_p01_foundation_country_configuration`** (FR-033–FR-034, SC-009)
- [x] T022 Review generated SQL in `prisma/migrations/r1_p01_foundation_country_configuration/migration.sql`; reject unexplained destructive statements; record review evidence in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (FR-038)
- [x] T023 Run `prisma validate` and `prisma generate` updating `src/generated/prisma/**` as needed (FR-033; plan database plan)
- [x] T024 Create clean-migration validator in `scripts/validate-clean-migration.ts` (empty DB → migrate deploy → assert only P01 tables / migration name) (FR-036–FR-037, SC-009; research R15; no Docker)
- [x] T025 [P] Add database connectivity helper used by health route in `src/core/health/database-probe.ts` without exposing secrets (FR-004–FR-005, FR-039)

**Checkpoint**: Schema + migration ready; modules scaffolded; env/rate-limit foundations in place; user stories may proceed.

---

## Phase 3: User Story 1 - Start and Observe a Safe Application Foundation (Priority: P1) 🎯 MVP

**Goal**: Predictable local/test startup, actionable env failure, distinguishable live/ready/database health without secret leakage.

**Independent Test**: Valid env starts and becomes ready; invalid env fails before listen; live vs ready vs database-unavailable distinguishable; health bodies contain no secrets (US1; FR-001–FR-005, FR-039; SC-001–SC-003, SC-013).

### Tests for User Story 1

- [x] T026 [US1] After T010 completes, extend (do not replace or race) the database-health placeholder/assertions created by T010 in `tests/integration/system-api.test.ts` with live/ready success and safe failure details (FR-005, FR-039, SC-003, SC-013; contracts/health-api.md; depends on T010)
- [ ] T027 [P] [US1] Add E2E liveness/readiness/database smoke coverage in `tests/e2e/foundation-liveness.test.ts` (FR-005, SC-001, SC-003)
- [ ] T028 [P] [US1] Add unit tests for database probe safe error mapping in `tests/unit/core/database-probe.test.ts` (FR-004, FR-039)

### Implementation for User Story 1

- [x] T029 [US1] Implement `GET /health/database` in `src/core/http/system.routes.ts` returning `200`/`503 DATABASE_UNAVAILABLE` per `specs/R1-P01-project-foundation-country-configuration/contracts/health-api.md` (FR-005, FR-039, SC-003)
- [x] T030 [US1] Wire database probe into readiness + database route registration from `src/server.ts` / `src/app.ts` composition (inspect first; FR-004–FR-005)
- [ ] T031 [US1] Confirm Helmet security headers and CORS remain active in `src/app.ts` without weakening; document any required header assertion in `tests/integration/system-api.test.ts` (FR-013)
- [x] T032 [US1] Mount one explicit foundation rate-limit policy (generous window) on a documented non-liveness system path via `src/app.ts` + `src/core/security/rate-limit.middleware.ts` using memory adapter (FR-014; research R7)
- [x] T033 [US1] Update `docs/apis/foundation-system.md` for live/ready/database distinction and safety rules (FR-015, FR-039)

**Checkpoint**: US1 independently demonstrable via health trio + startup failure tests.

---

## Phase 4: User Story 2 - Consume Stable API Contracts (Priority: P1)

**Goal**: One stable success/validation/unexpected-error envelope under `/api/v1`.

**Independent Test**: Sample success, validation failure, and unexpected error responses match `docs/standards/api-response-and-errors.md` and include `requestId` (US2; FR-006–FR-009; SC-004).

### Tests for User Story 2

- [ ] T034 [P] [US2] Add/extend unit tests for success and failure helpers in `tests/unit/core/api-response.test.ts` (create if missing) (FR-007–FR-009, SC-004; contracts/response-envelope.md)
- [ ] T035 [P] [US2] Add integration test for validation-failure envelope using `src/core/http/validate-request.ts` on a minimal test route or existing path in `tests/integration/api-envelope.test.ts` (FR-008, SC-004)
- [ ] T036 [US2] After T035 completes, sequentially extend the same file `tests/integration/api-envelope.test.ts` with unexpected-error envelope coverage (no stack/SQL leak); do not merge with the T035 validation-failure concern; depends on T035 (FR-009, SC-004)

### Implementation for User Story 2

- [ ] T037 [US2] Inspect `src/core/http/api-response.ts` and `src/core/http/error.middleware.ts`; converge only gaps vs `docs/standards/api-response-and-errors.md` — do not invent a second envelope (FR-006–FR-009)
- [ ] T038 [US2] Ensure `API_PREFIX` `/api/v1` versioning remains the single public foundation in `src/config/constants.ts` / `src/config/env.ts` and docs (FR-006)
- [ ] T039 [US2] Sync contract notes in `specs/R1-P01-project-foundation-country-configuration/contracts/response-envelope.md` only if implementation clarified examples (keep canonical standard authoritative)

**Checkpoint**: US2 envelope tests pass against live helpers/middleware.

---

## Phase 5: User Story 3 - Trace Operations Without Leaking Secrets (Priority: P1)

**Goal**: Correlation IDs + structured Pino logs with redaction.

**Independent Test**: Find logs by `requestId`; sensitive fixtures redacted; malformed client `x-request-id` normalized (US3; FR-010–FR-012; SC-005–SC-006).

### Tests for User Story 3

- [ ] T040 [P] [US3] Extend correlation-ID unit tests (accept UUID / reject malformed / mint new) in `tests/unit/core/request-id.test.ts` (create if missing) covering `src/core/http/request-id.middleware.ts` (FR-010, SC-005)
- [ ] T041 [P] [US3] Extend logging redaction integration tests for credentials/tokens/secrets/cookies/PII fixtures in `tests/integration/logging.test.ts` (FR-012, SC-006; research R5)
- [ ] T042 [P] [US3] Assert `requestId` present on successful and error response envelopes in dedicated file `tests/integration/request-id-envelope.test.ts` (separate from `tests/integration/api-envelope.test.ts` and `tests/integration/logging.test.ts`) (FR-010, SC-005)

### Implementation for User Story 3

- [ ] T043 [US3] Inspect `src/core/http/request-id.middleware.ts`; change only if tests prove gaps vs UUID accept-or-mint policy (FR-010; research R4)
- [ ] T044 [US3] Inspect `src/integrations/logging/pino-logger.ts`; extend `REDACTED_PATHS` only as needed for failing redaction tests; keep request bodies unlogged (FR-011–FR-012; research R5)
- [ ] T045 [US3] Confirm `docs/standards/logging.md` still matches behavior; update only if gaps found (FR-011–FR-012)

**Checkpoint**: US3 tracing/redaction independently verified.

---

## Phase 6: User Story 4 - Resolve Country-Aware Configuration Safely (Priority: P1)

**Goal**: Configuration module public contract with per-key policies and explicit failures; no hard-coded Egypt business branches; no Prisma leakage.

**Independent Test**: Resolve EG via public contract for all three policies; unknown key/country fail explicitly; consumers import only `#modules/configuration` (US4; FR-018–FR-022, FR-025, FR-027–FR-028; SC-008, SC-011, SC-014–SC-016).

### Tests for User Story 4

- [ ] T046 [P] [US4] Add unit tests for resolution matrix (GLOBAL_ONLY, COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK, COUNTRY_REQUIRED) in `tests/unit/modules/configuration/resolve-effective-config.test.ts` (FR-022, SC-015–SC-016; contracts/configuration-public-api.md)
- [ ] T047 [P] [US4] Add unit tests for unknown key, inactive/unsupported country, rejected global-only country override, and secret-denylist rejection in `tests/unit/modules/configuration/resolve-effective-config-errors.test.ts` (FR-022, FR-025, FR-027, SC-008, SC-016)
- [ ] T048 [US4] Add integration tests for configuration public API against DB in `tests/integration/configuration-public-api.test.ts` importing only `#modules/configuration` (FR-028, SC-011)

### Implementation for User Story 4

- [ ] T049 [P] [US4] Implement currency repository mapping in `src/modules/configuration/infrastructure/currency.repository.ts` (FR-019)
- [ ] T050 [P] [US4] Implement country repository mapping in `src/modules/configuration/infrastructure/country.repository.ts` (FR-018, FR-025)
- [ ] T051 [P] [US4] Implement app/country config repositories in `src/modules/configuration/infrastructure/app-config.repository.ts` and `src/modules/configuration/infrastructure/country-config.repository.ts` (FR-021)
- [ ] T052 [US4] Implement key catalog Zod schemas and secret-denylist guards in `src/modules/configuration/domain/config-key-catalog.ts` (FR-022, FR-027; research R8)
- [ ] T053 [US4] Implement `resolveEffectiveConfig` service in `src/modules/configuration/application/resolve-effective-config.ts` per data-model algorithm (FR-020, FR-022, SC-015)
- [ ] T054 [US4] Implement public exports `getCountryByCode`, `getCurrencyByCode`, `resolveEffectiveConfig`, `assertCountryCurrencySupported` in `src/modules/configuration/index.ts` with DTO types only — no Prisma exports (FR-028, SC-011; contracts/configuration-public-api.md)
- [ ] T055 [US4] Add Easy-English comments on services/repositories per convention in the new configuration module files (owner coding standard)

**Checkpoint**: US4 resolution policies independently proven (may use fixtures/seed from US5 when available; unit matrix must not require Egypt hard-coding).

---

## Phase 7: User Story 5 - Seed Egypt and Apply the First Product Migration (Priority: P1)

**Goal**: Idempotent Egypt seed + clean migration validation evidence on empty test DB.

**Independent Test**: Clean migrate apply; seed twice with zero duplicate EG/EGP/config natural keys; migration name matches; no future-phase tables (US5; FR-023–FR-026, FR-033–FR-038; SC-007, SC-009, SC-014).

### Tests for User Story 5

- [ ] T056 [P] [US5] Add seed idempotency integration test (run seed logic twice, assert counts) in `tests/integration/egypt-seed.test.ts` (FR-023, FR-026, SC-007)
- [ ] T057 [P] [US5] Add migration naming / no-future-table assertions in `tests/integration/migration-clean-apply.test.ts` (may call `scripts/validate-clean-migration.ts` internally) (FR-034, FR-037, SC-009; no Docker)

### Implementation for User Story 5

- [ ] T058 [US5] Implement idempotent Egypt seed (EG, EGP, locales, app_configs/country_configs per data-model) in `prisma/seed.ts` using upserts/natural keys (FR-023–FR-026, FR-024; research R14)
- [ ] T059 [US5] Ensure `scripts/seed.ts` and Prisma seed config in `prisma.config.ts` invoke the idempotent seed entrypoint (FR-026)
- [ ] T060 [US5] Run clean-apply validation with empty DB via `scripts/validate-clean-migration.ts` and record evidence in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (FR-036, FR-038, SC-009)
- [ ] T061 [US5] Run `npm run seed` twice against test DB and record zero-duplicate evidence in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (SC-007)
- [ ] T062 [US5] Confirm seed contains no hard-coded Egypt business-fee/auth rules — configuration enablement only — documented in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (FR-023, SC-014)

**Checkpoint**: US5 migration + seed independently evidenced.

---

## Phase 8: User Story 6 - Establish Shared Audit Evidence Foundation (Priority: P2)

**Goal**: Admin-owned append-only audit foundation with fail-closed writes; no R1-P03 privileged workflows.

**Independent Test**: `writeAudit` persists identity/action/target/timestamp/trace fields; persistence failure fails closed; no privileged authz workflows (US6; FR-029–FR-032; SC-012).

### Tests for User Story 6

- [ ] T063 [P] [US6] Add unit tests for audit input mapping / immutability expectations in `tests/unit/modules/admin/write-audit.test.ts` (FR-030, SC-012)
- [ ] T064 [US6] Add integration tests for successful `writeAudit` and fail-closed behavior in `tests/integration/audit-public-api.test.ts` importing only `#modules/admin` (FR-029–FR-032, SC-012; contracts/audit-public-api.md)

### Implementation for User Story 6

- [ ] T065 [US6] Implement audit repository append-only write in `src/modules/admin/infrastructure/audit-log.repository.ts` (no update/delete APIs) (FR-029–FR-031)
- [ ] T066 [US6] Implement `writeAudit` application service with fail-closed error propagation in `src/modules/admin/application/write-audit.ts` (FR-032)
- [ ] T067 [US6] Export public audit contract types/functions from `src/modules/admin/index.ts` without Prisma types (FR-029–FR-030; constitution III)
- [ ] T068 [US6] Add Easy-English comments on admin audit service/repository files (owner coding standard)
- [ ] T069 [US6] Record explicit exclusion of R1-P03 privileged workflows in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (FR-031)

**Checkpoint**: US6 audit foundation independently verified.

---

## Phase 9: User Story 7 - Prove Quality Gates in CI (Priority: P2)

**Goal**: Lint, typecheck, tests, coverage, docs, OpenAPI, prisma validate, migration/seed gates detect failures.

**Independent Test**: `npm run ci` (and GH Actions without Docker) fails when any gated check is broken (US7; FR-015–FR-017; SC-010).

### Tests for User Story 7

- [ ] T070 [P] [US7] Assert approved coverage thresholds remain configured in `vitest.config.ts` via `tests/unit/tooling/coverage-thresholds.test.ts` (FR-016–FR-017, SC-010; research R13)
- [ ] T071 [P] [US7] Extend rate-limit integration coverage for middleware + memory adapter in `tests/integration/rate-limit-middleware.test.ts` (FR-014, FR-016)

### Implementation for User Story 7

- [ ] T072 [US7] Finalize ESLint rules and ensure `npm run lint` fails on violations using `eslint.config.js` (FR-017)
- [ ] T073 [US7] Implement `scripts/docs-check.ts` to require P01 docs (`docs/apis/foundation-system.md`, OpenAPI file, Postman P01 collection path) (FR-015, FR-017)
- [ ] T074 [US7] Author static OpenAPI document in `docs/apis/openapi/r1-p01-foundation.yaml` for live/ready/database + envelopes (FR-015; contracts/openapi-foundation.md; research R11)
- [ ] T075 [US7] Complete `scripts/openapi-validate.ts` and wire `npm run openapi:validate` (FR-015, FR-017)
- [ ] T076 [US7] Assemble `npm run ci` script in `package.json` to run typecheck, lint, tests, coverage, prisma validate, docs check, openapi validate, and migration/seed validation when `DATABASE_URL` available (FR-017, SC-010)
- [ ] T077 [US7] Add GitHub Actions workflow without Docker/Testcontainers in `.github/workflows/ci.yml` (unit/lint/typecheck always; DB jobs only when secret/variable present) (FR-017; research R12; constitution IX)
- [ ] T078 [US7] Confirm coverage thresholds remain branches 75 / functions·lines·statements 80 in `vitest.config.ts` and produce coverage report via `npm run test:coverage` (FR-016; research R13)
- [ ] T079 [US7] Update `docs/apis/README.md` to index OpenAPI + P01 system docs without marking R1-P02 auth as implemented (FR-015)

**Checkpoint**: US7 quality gates independently enforceable locally (and in CI where configured).

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Docs, Postman, scripts README, quickstart proof, scope-negative checks, implementation summary completion.

- [ ] T080 [P] Create `postman/R1-P01-foundation-country-configuration.postman_collection.json` for health trio + envelope/`requestId` checks (FR-015; quickstart.md)
- [ ] T081 [P] Update `postman/Cleanora-local.postman_environment.json` only as needed for P01 base URL/port — preserve auth cookie vars for R1-P02 untouched (FR-015)
- [ ] T082 [P] Update `postman/README.md` to include P01 collection import order and state R1-P02 collection remains prepared/unimplemented (FR-015)
- [ ] T083 Update `scripts/README.md` for migrate/seed/clean-migration/docs-check/openapi scripts (FR-017)
- [ ] T084 Walk `specs/R1-P01-project-foundation-country-configuration/quickstart.md` commands and record pass/fail evidence in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (SC-001–SC-016 mapping)
- [ ] T085 Scope-negative check: confirm no auth routes/JWT issuance/OTP/Google code under `src/modules/**` and no R1-P02 tables in `prisma/schema.prisma`; record in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (exclusions; FR-031, FR-037)
- [ ] T086 Scope-negative check: confirm no Docker/Testcontainers usage in `package.json`, workflows, or tests; record in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (constitution IX)
- [ ] T087 Scope-negative check: confirm foreign modules/tests do not import configuration/admin internals or Prisma models — only `#modules/configuration` / `#modules/admin`; record in `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` (FR-028, SC-011)
- [ ] T090 Create automated SC-014 regression in `tests/unit/tooling/no-hardcoded-eg-business-rules.test.ts` that detects hard-coded Egypt-specific business branching in `src` (e.g. direct `countryCode` comparisons to `EG`/`Egypt`), allows only documented seed/configuration/reference-data locations, does not flag legitimate ISO reference data or Egypt seed fixtures, and proves Egypt behavior is configuration/seed driven (FR-020, FR-023, SC-014; depends on Egypt seed/configuration implementation T052–T054, T058; result recorded only via T088)
- [ ] T088 Finalize `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md` with files changed, migration SQL review, seed double-run evidence, gate results, T090 SC-014 regression result, and explicit “not Complete / no commit” note (delivery; constitution VIII)
- [ ] T089 Verify `docs/product/current.md` remains `In Progress` (not Complete) after implementation tasks (constitution II, VIII)

**Checkpoint**: P01 delivery evidence complete; human approval still required for Complete/commit/push.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → no dependencies
- **Phase 2 Foundational** → depends on Setup; **blocks all user stories**
- **US1–US3** → after Foundational (can proceed in parallel, except same-file sequential pairs below)
- **US4** → after Foundational (needs models); ideally after/with seed fixtures from US5 for integration, but unit matrix independent
- **US5** → after Foundational migration exists
- **US6** → after Foundational (`audit_logs` model)
- **US7** → after US1 health + rate-limit paths exist; OpenAPI after US1 routes stable
- **Polish** → after desired stories complete; **T090** after US4/US5 configuration+seed implementation (T052–T054, T058); **T088** after T090

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 | Foundational | MVP health/startup; **T026 depends on T010** (extends same `system-api.test.ts`) |
| US2 | Foundational | Envelope reuse; parallel with US1/US3; **T036 sequential after T035** (same `api-envelope.test.ts`) |
| US3 | Foundational | Logging/correlation; parallel with US1/US2; **T042** uses dedicated `request-id-envelope.test.ts` |
| US4 | Foundational (+ seed data for integration) | Public config contract |
| US5 | Foundational migration | Seed + clean-apply evidence |
| US6 | Foundational audit model | After/parallel US4/US5 |
| US7 | US1 (+ tooling from Setup) | Gates/docs/CI |

### Within Each Story

1. Tests first (must fail)
2. Implementation
3. Easy-English comments where required
4. Checkpoint validation

### Parallel Opportunities

- Setup: T006, T007, T008 after T005
- Foundational tests: T009–T011 parallel; later T017/T018 parallel; T025 parallel with non-conflicting work
- After Foundational: US1/US2/US3 streams in parallel **except**:
  - T026 is **not** `[P]` vs T010 — wait for T010, then extend
  - T036 is **not** `[P]` — sequential after T035 on the same file
  - T042 `[P]` is safe (dedicated `request-id-envelope.test.ts`; no collision with T035/T036/T041)
- US4 repository tasks T049–T051 parallel
- US5 tests T056–T057 parallel
- US7: T070 `[P]` (dedicated `coverage-thresholds.test.ts`) with T071
- Polish Postman/docs tasks T080–T082 parallel
- T090 after configuration/seed implementation; before T088 summary finalization

---

## Parallel Example: After Foundational

```text
# Stream A — US1 health
T010 (Foundational) → T026 (extends T010) + T027 [P] + T028 [P] → T029–T033 implementation

# Stream B — US2 envelope
T034 [P] → T035 [P] → T036 (sequential, same file) → T037–T039 implementation

# Stream C — US3 logging / requestId
T040 [P] + T041 [P] + T042 [P request-id-envelope.test.ts] → T043–T045 implementation
```

## Parallel Example: User Story 4 repositories

```text
T049 currency.repository.ts
T050 country.repository.ts
T051 app-config.repository.ts + country-config.repository.ts
# then sequential: T052 catalog → T053 resolve → T054 public index
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup  
2. Phase 2 Foundational (through migration generate)  
3. Phase 3 US1 health/startup  
4. **STOP and validate** quickstart health section  

### Incremental Delivery

1. US2 envelopes → US3 logging (foundation observability complete)  
2. US5 seed + US4 resolution (country/config usable)  
3. US6 audit foundation  
4. US7 CI/docs/OpenAPI  
5. Polish + scope-negative + T090 SC-014 regression + implementation-summary  

### Suggested MVP Scope

**US1 + Foundational migration/env/rate-limit scaffolds** — proves safe startup and distinguishable health before config/audit depth.

---

## Traceability (story → FR/SC)

| Story | Primary FR | Primary SC |
|---|---|---|
| US1 | FR-001–FR-005, FR-013–FR-014, FR-039 | SC-001–SC-003, SC-013 |
| US2 | FR-006–FR-009 | SC-004 |
| US3 | FR-010–FR-012 | SC-005–SC-006 |
| US4 | FR-018–FR-022, FR-025, FR-027–FR-028 | SC-008, SC-011, SC-014–SC-016 |
| US5 | FR-023–FR-026, FR-033–FR-038 | SC-007, SC-009, SC-014 |
| Polish T090 | FR-020, FR-023 | SC-014 |
| US6 | FR-029–FR-032 | SC-012 |
| US7 | FR-015–FR-017 | SC-010 |

---

## Notes

- Inspect existing files before replacement; prefer converge-over-rewrite for `src/app.ts`, envelopes, logging, request-id, live/ready.
- Preserve R1-P02 docs/Postman/`scripts/inspect-auth.ts`/auth env placeholders.
- Do not commit, push, deploy, or mark phase Complete in these tasks.
- Same-file tasks are sequential (no `[P]`).
- Format validation: every task uses `- [ ] T### ...` with file paths; story tasks include `[USn]`; IDs `T001`–`T090` unique; no ambiguous alternate output paths.

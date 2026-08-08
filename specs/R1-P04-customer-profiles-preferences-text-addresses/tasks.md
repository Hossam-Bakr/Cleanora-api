# Tasks: R1-P04 — Customer Profiles, Preferences & Text Addresses

**Input**: Design documents from `specs/R1-P04-customer-profiles-preferences-text-addresses/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `traceability.md`, `review-report.md` (`PASS`)

**Authority**: DEC-030, DEC-031, DEC-032; approved `spec.md` FR-001–FR-048 / SC-001–SC-019

**Tests**: Required (quickstart matrices + SC evidence). Prefer failing tests before implementation within each story.

**Status**: **Complete** as of `2026-08-08` by explicit human-owner approval. Fresh independent final implementation re-review **PASS**. T001–T120 remain checked. Historical implementation review **CHANGES REQUIRED**, historical first re-review **BLOCKED**, and historical later re-review **CHANGES REQUIRED** remain labelled historical evidence only. Live Cloudinary smoke **PASS**. Proof DB `cleanora_r1_p04_clean_proof`. Separate unresolved operational incident: accidental historical migration of database `Cleanora` (not authorized / not accessed by Complete approval).

> Phase-purpose lines below that say “Phase remains **In Progress**” are
> historical task-gate wording from when those repair waves were authorized;
> they are not the current phase status.

**Constraints**: No `customer` role / `resource.self.*`; no geospatial fields; no R1-P02 `/auth/*` contract changes; no queues/Docker/cloud object storage beyond DEC-033 Cloudinary profile images; no public processor HTTP; no AppConfig retention key; never edit applied migrations; customers owns business TX; Admin audit via ports only; story-gated route registration only (no temporary 501 handlers).

**Total tasks**: 120 (T001–T120) — all checked at Complete

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable only when target files are disjoint and dependencies are complete
- **[Story]**: `[US1]`…`[US5]` on user-story tasks only
- Every task includes exact repository-relative path(s)
- Shared `customers.routes.ts`, `customers.controller.ts`, `customers.schema.ts`, and `src/swagger/openapi.document.ts` modifications are always serialized across stories

---

## Phase 1: Setup (Shared Baseline) — 2 tasks

**Purpose**: Lock active-phase context and non-goals before coding

- [X] T001 Record R1-P04 implementation baseline (active pointer, DEC-030/031/032 locks, migration name `r1_p04_customer_profiles_preferences_text_addresses`, module map customers+media, unauthorized until separate owner implement auth, story-gated route registration rule) in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`
- [X] T002 Confirm Companion/tasks posture and that no premature `src/modules/customers/` or `src/modules/media/` trees exist yet; note evidence in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`

**Checkpoint**: Baseline documented; foundational work may begin

---

## Phase 2: Foundational (Blocking Prerequisites) — 22 tasks

**Purpose**: Schema, env, module scaffolds, ports, FR-028 policy, Auth catalog additive rows, Admin audit seams, composition wiring — MUST complete before any user story

**⚠️ CRITICAL**: No user-story implementation until this phase is complete. Do not mount any `/api/v1/customers` public routes in this phase.

### Foundation tests (write first; expect fail until foundation lands)

**Wave 1 — independent:**

- [X] T003 [P] Add migration SQL expectation tests (tables/enums/FKs/partial unique active request/lifecycle CHECKs including CANCELLED six invariants; `processor_id` has no FK) in `tests/integration/migration-r1-p04.test.ts`
- [X] T004 [P] Extend clean chronological migration coverage for `r1_p04_customer_profiles_preferences_text_addresses` in `tests/integration/migration-clean-apply.test.ts`
- [X] T005 [P] Add FR-028 customer SELF policy unit tests (ACTIVE/verified/pending-only/suspended/banned/missing category; no customer-role/`resource.self.*` dependency) in `tests/unit/modules/customers/customer-self-policy.test.ts`
- [X] T006 [P] Add module-boundary tests forbidding customers/media from importing auth/admin repositories or Prisma delegates of other modules in `tests/unit/tooling/module-boundaries.test.ts`
- [X] T007 [P] Add Auth catalog additive assertion tests for `privacy.requests.reassign` → `staff_admin` only + reason `privacy_request_reassign` in `tests/unit/modules/authentication/authorization-catalog.test.ts`
- [X] T008 [P] Add env readiness unit tests for required `MEDIA_STORAGE_ROOT` and positive-integer `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` (no default; tooling without customers runtime must not require retention) in `tests/unit/config/env-r1-p04.test.ts`
- [X] T009 [P] Add Admin audit-writer contract unit tests for general transactional append and safe non-transactional denial append (actor/action/time/outcome/opaque resource identity; redaction; no protected payloads) in `tests/unit/modules/admin/r1-p04-audit-writers.test.ts`

**⟶ Wait for Wave 1 to finish, then:**

### Schema, migration, generate, validate

**Wave 2 — sequential schema path:**

- [X] T010 Extend `prisma/schema.prisma` with customers/media models, enums, opposite relation fields, and Authentication additive privileged-reassignment catalog fields (including `PrivilegedActionOperation` value `PRIVACY_REQUEST_REASSIGN`) per `specs/R1-P04-customer-profiles-preferences-text-addresses/data-model.md`
- [X] T011 Create forward-only migration directory `prisma/migrations/r1_p04_customer_profiles_preferences_text_addresses/` with reviewed `migration.sql` (partial unique index + lifecycle CHECKs; never edit applied migrations)
- [X] T012 Run `npm run prisma:generate` and `npm run prisma:validate`; record results in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`
- [X] T013 Validate clean chronological migration apply via disposable DB + `tests/integration/migration-clean-apply.test.ts` / `tests/integration/migration-r1-p04.test.ts`; record evidence in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`

**⟶ Wait for Wave 2 to finish, then:**

### Env, catalogs, module scaffolds

**Wave 3 — independent after schema (file-disjoint):**

- [X] T014 [P] Add `MEDIA_STORAGE_ROOT` and `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` to `src/config/env.ts` and document in `.env.example`
- [X] T015 [P] Add Authentication catalog constants for DEC-031 reassignment permission/reason/operation in `src/modules/authentication/domain/authorization.catalog.ts` and extend `PrivilegedOperation` in `src/modules/authentication/domain/authorization.types.ts`
- [X] T016 [P] Idempotent seed updates for additive Auth catalog rows only (no customer grants) in `prisma/seed.ts`
- [X] T017 [P] Scaffold `customers` module skeleton (domain types/errors/ports, empty service/controller/routes placeholders) under `src/modules/customers/`
- [X] T018 [P] Scaffold `media` module skeleton (ports, filesystem adapter placeholder, types/errors) under `src/modules/media/`

**⟶ Wait for T017 (customers scaffold) to finish, then:**

- [X] T019 Add composition-only processor capability constant/type `privacy.requests.process` in `src/modules/customers/domain/privacy-processor.capability.ts` (depends on T017; writes inside the customers module tree)

**⟶ Wait for Wave 3 (T014–T019) to finish, then:**

### Admin audit seams (serialized — both edit Admin audit public ports)

- [X] T020 Add Admin **general transactional** audit writer port and Prisma factory for ordinary FR-033 mutations (reasonless) in `src/modules/admin/audit.service.ts` and `src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.ts`
- [X] T021 Add Admin **safe non-transactional** denial audit writer port and Prisma factory for security-relevant denials when no business mutation commits (actor/action/time/outcome/opaque resource identity; redacted; no protected payloads) in `src/modules/admin/audit.service.ts` and `src/modules/admin/infrastructure/prisma-denial-audit.writer.ts`

**⟶ Wait for audit seams, then:**

### Join wiring (no public route mount)

- [X] T022 Implement FR-028 customer SELF authorization policy helpers in `src/modules/customers/domain/customer-self.policy.ts`
- [X] T023 Implement customers unit-of-work / transaction boundary helpers that accept Admin **general transactional** and **privileged transactional** audit writer factories only (must not accept or invoke the non-TX denial writer inside the UoW) in `src/modules/customers/infrastructure/prisma-customers.unit-of-work.ts`
- [X] T024 Wire customers + media + Admin general transactional audit + Admin privileged transactional audit + Admin non-TX denial audit + retention readiness into `src/composition.ts`; export a customers router factory seam without registering unfinished handlers; document story-gated route registration plan in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`

**Checkpoint**: Foundation ready — user story implementation can begin. No `/api/v1/customers` routes mounted yet.

---

## Phase 3: User Story 1 — Manage the correct customer profile (Priority: P1) 🎯 MVP — 13 tasks

**Goal**: Category-isolated Individual/Company/Engineer profiles + shared protected profile image, with FR-033/FR-034/FR-035 obligations complete for US1 surfaces

**Independent Test**: Accounts with individual-only, company-only, engineer-only, multi-verified, and pending category; create/view/edit; blank reject; image replace/remove; frozen identity contract; profile/image mutations audited; audit failure rolls back DB mutation; successful profile/image GETs create no personal-content business audit

### Tests for User Story 1

**Wave 1 — independent:**

- [X] T025 [P] [US1] Unit tests for profile field trim/blank/isolation rules in `tests/unit/modules/customers/profile-fields.test.ts`
- [X] T026 [P] [US1] Unit tests for media path containment / opaque keys in `tests/unit/modules/media/media-path-safety.test.ts`
- [X] T027 [P] [US1] Integration tests for profile CRUD + not-created reads + FR-035 assertion that successful profile GET creates no personal-content business audit record in `tests/integration/customers/profiles.test.ts`
- [X] T028 [P] [US1] Integration tests for image association CAS, general transactional audit rollback of DB mutation, filesystem-outside-TX compensation/orphan cleanup, protected binary GET/absence, and FR-035 assertion that successful protected image GET creates no personal-content business audit record in `tests/integration/customers/profile-image.test.ts`
- [X] T029 [P] [US1] Integration tests for US1 ownership-safe denials using Admin non-TX denial audit (redacted actor/action/time/outcome/opaque resource identity; no protected payload leakage) in `tests/integration/customers/us1-denial-audit.test.ts`

**⟶ Wait for Wave 1 to finish, then:**

### Implementation for User Story 1

**Wave 2 — independent persistence/adapters:**

- [X] T030 [P] [US1] Implement customers profile repository for individual/company/engineer + customer_profiles anchor in `src/modules/customers/infrastructure/prisma-profile.repository.ts`
- [X] T031 [P] [US1] Implement local filesystem media adapter under `MEDIA_STORAGE_ROOT` in `src/modules/media/infrastructure/local-filesystem-media.adapter.ts`
- [X] T032 [P] [US1] Implement Zod schemas for category profile bodies in `src/modules/customers/customers.schema.ts`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — services then HTTP (serialized shared HTTP/OpenAPI files):**

- [X] T033 [US1] Implement profile application service (authorize family, upsert/read, identity freeze) that appends Admin general transactional audit inside the customers TX on successful profile mutations in `src/modules/customers/profile.service.ts`
- [X] T034 [US1] Implement profile-image association service (store bytes outside TX, CAS associate with Admin general transactional audit inside customers TX, compensating `PENDING_DELETE` on association/audit failure) in `src/modules/customers/profile-image.service.ts`
- [X] T035 [US1] Implement ownership-safe denial helpers and wire Admin non-TX denial audit writer into US1 denial paths in `src/modules/customers/domain/ownership-denial.ts` and `src/modules/customers/customers.controller.ts`
- [X] T036 [US1] Implement thin controllers/routes for category profiles + profile-image GET/PUT/DELETE per `contracts/customer-self-service.md` in `src/modules/customers/customers.routes.ts` and `src/modules/customers/customers.controller.ts`; mount `/api/v1/customers` from `src/routes/index.ts` registering **only** these completed US1 handlers; record story-gated registration evidence in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`
- [X] T037 [US1] Register published OpenAPI paths for US1 operations in `src/swagger/openapi.document.ts` from `contracts/customer-self-service.openapi.yaml`

**Checkpoint**: US1 independently functional and testable (MVP). FR-033 profile/image audit, FR-034 US1 denial audit, and FR-035 profile/image GET non-audit assertions are green. No unfinished endpoints mounted.

---

## Phase 4: User Story 2 — Maintain a customer-owned text address book (Priority: P1) — 6 tasks

**Goal**: Text addresses with countryCode→country_id, version CAS, no geo/default, with FR-033/FR-035 for address mutations/reads

**Independent Test**: Multi-address CRUD; cross-customer denial; geo rejection; unsupported/inactive country; peer list with no default; address mutation audit rollback; successful address GET/list create no personal-content business audit

### Tests for User Story 2

**Wave 1 — independent:**

- [X] T038 [P] [US2] Unit tests for address validation + geo rejection + version rules in `tests/unit/modules/customers/address-validation.test.ts`
- [X] T039 [P] [US2] Integration tests for address CRUD, ownership denial, peer list, country mapping, general transactional audit rollback on create/update/remove, and FR-035 assertion that successful address GET/list create no personal-content business audit record in `tests/integration/customers/addresses.test.ts`

**⟶ Wait for Wave 1 to finish, then:**

### Implementation for User Story 2

**Wave 2 — repository then serialized HTTP shared files:**

- [X] T040 [P] [US2] Implement address repository in `src/modules/customers/infrastructure/prisma-address.repository.ts`
- [X] T041 [US2] Extend Zod address schemas (`countryCode`, no geo props, `additionalProperties` false) in `src/modules/customers/customers.schema.ts`
- [X] T042 [US2] Implement address service (Configuration active Country resolve → persist `country_id` only; version CAS; Admin general transactional audit inside customers TX on create/update/remove) in `src/modules/customers/address.service.ts`
- [X] T043 [US2] Wire address HTTP endpoints in `src/modules/customers/customers.routes.ts` / `src/modules/customers/customers.controller.ts` and OpenAPI in `src/swagger/openapi.document.ts`, registering **only** completed US2 handlers (serialized after US1 shared-file work); wire ownership denials through Admin non-TX denial audit

**Checkpoint**: US1 + US2 independently functional; address FR-033/FR-035 evidenced

---

## Phase 5: User Story 5 — Protect and trace customer-data changes (Priority: P1) — 3 tasks

**Goal**: Deny-by-default SELF authz matrix and eligibility-loss retention for shipped US1–US2 surfaces (US1/US2 audit obligations already completed in-story)

**Independent Test**: Forged owner/category/permission on profile/image/address; wrong-owner denial; pending-only limits for shared image/address; eligibility loss retains data unchanged

### Tests / hardening for User Story 5

- [X] T044 [P] [US5] Authorization/security matrix integration tests for US1–US2 surfaces per quickstart in `tests/integration/customers/authorization-matrix-us1-us2.test.ts`
- [X] T045 [P] [US5] Add eligibility-loss retention behavior tests (access suspended; data unchanged; restore re-enables access) in `tests/integration/customers/eligibility-retention.test.ts`

**⟶ Wait for T043 (US2 address HTTP wiring) and T044 to finish, then:**

- [X] T046 [US5] Add US2 address security assertions in `tests/integration/customers/authorization-matrix-us1-us2.test.ts`: wrong-owner and ineligible address denials emit Admin safe non-transactional denial audit with actor/action/time/outcome/opaque resource identity; audit excludes full address and other protected personal content; denials produce no business mutation; successful SELF address GET/list produce no personal-content business audit record

**Checkpoint**: Protection/authz obligations evidenced on shipped US1–US2 surfaces

---

## Phase 6: User Story 3 — Understand contact state and control preferences (Priority: P2) — 8 tasks

**Goal**: Contact-state projection (identity facts only) + DEC-032 full-replacement preferences with FR-033/FR-035

**Independent Test**: Verified/unverified/absent contact labels; language AR/EN/null; required boolean matrix; omit rejected; mandatory notices non-disableable; version CAS; preference PUT audit rollback; successful contact/preferences GETs create no personal-content business audit

### Tests for User Story 3

**Wave 1 — independent:**

- [X] T047 [P] [US3] Unit tests for DEC-032 preference PUT completeness + mandatory-notice policy in `tests/unit/modules/customers/preferences-policy.test.ts`
- [X] T048 [P] [US3] Integration tests for contact-state projection (identity unchanged) + FR-035 assertion that successful contact-state GET creates no personal-content business audit record in `tests/integration/customers/contact-state.test.ts`
- [X] T049 [P] [US3] Integration tests for preferences GET/PUT (null language, omit rejected, concurrency) + general transactional audit rollback of complete replacement + FR-035 assertion that successful preferences GET creates no personal-content business audit record in `tests/integration/customers/preferences.test.ts`

**⟶ Wait for Wave 1 to finish, then:**

### Implementation for User Story 3

**Wave 2 — independent internals, then serialized HTTP:**

- [X] T050 [P] [US3] Implement preferences repository in `src/modules/customers/infrastructure/prisma-preferences.repository.ts`
- [X] T051 [P] [US3] Implement contact-state read adapter using Authentication identity facts only (no R1-P02 contract change) in `src/modules/customers/infrastructure/identity-contact.read.ts`
- [X] T052 [US3] Implement preferences service (full replace; CAS; mandatory policy; Admin general transactional audit inside customers TX on successful PUT) in `src/modules/customers/preferences.service.ts`
- [X] T053 [US3] Implement contact-state + preferences HTTP + Zod in `src/modules/customers/customers.schema.ts`, `src/modules/customers/customers.controller.ts`, `src/modules/customers/customers.routes.ts`, registering **only** completed US3 handlers; wire prefs denials through Admin non-TX denial audit
- [X] T054 [US3] Publish OpenAPI preference/contact paths in `src/swagger/openapi.document.ts`

**Checkpoint**: US3 independently functional; prior stories still green; preference FR-033 and contact/preferences FR-035 evidenced

---

## Phase 7: User Story 4 — Request deactivation, deletion, or data export safely (Priority: P2) — 13 tasks

**Goal**: Privacy request lifecycle foundations, processor/privileged ports, retention sweep, with FR-033/FR-034/FR-035 and privileged audit rollback

**Independent Test**: Idempotent submit; cancel PENDING only; claim/resolve with capability; staff_admin reassign; closed outcomes; retention env + sweep; no fulfillment side effects; audit failure rolls back each transition; privileged audit failure leaves processor assignment unchanged

### Tests for User Story 4

**Wave 1 — independent:**

- [X] T055 [P] [US4] Unit tests for privacy lifecycle transitions + CANCELLED invariants + closed outcomes in `tests/unit/modules/customers/privacy-lifecycle.test.ts`
- [X] T056 [P] [US4] Unit tests for processor capability accept/reject and privileged reassign deny-by-default in `tests/unit/modules/customers/privacy-authority.test.ts`
- [X] T057 [P] [US4] Integration tests for submit/cancel/coexistence/claim/resolve/reassign in `tests/integration/customers/privacy-requests.test.ts`, including: Admin general transactional audit rollback for submit/cancel/claim/resolve; privileged transactional audit append failure rolls back reassignment with processor assignment unchanged and no partial audit/business mutation; FR-035 assertion that successful privacy request GET/list create no personal-content business audit record; security-relevant denials use Admin non-TX denial audit with redaction
- [X] T058 [P] [US4] Integration tests for retention readiness, read exclusion, bounded sweep, audit preserved in `tests/integration/customers/privacy-retention.test.ts`

**⟶ Wait for Wave 1 to finish, then:**

### Implementation for User Story 4

**Wave 2 — independent internals:**

- [X] T059 [P] [US4] Implement privacy_requests repository (partial-unique semantics, purge_after reads) in `src/modules/customers/infrastructure/prisma-privacy-request.repository.ts`
- [X] T060 [P] [US4] Implement PrivacyProcessorPort claim/resolve services that append Admin general transactional audit inside the customers TX in `src/modules/customers/privacy-processor.service.ts`
- [X] T061 [P] [US4] Implement PrivacyPrivilegedPort reassignment (staff_admin + permission + reason; Admin privileged transactional audit; audit failure rolls back reassignment) in `src/modules/customers/privacy-privileged.service.ts`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — application service, HTTP, sweep, composition (serialized shared HTTP/OpenAPI):**

- [X] T062 [US4] Implement customer privacy-request application service for submit/list/get/cancel (Admin general transactional audit on submit/cancel inside customers TX; controllers remain thin) in `src/modules/customers/privacy-request.service.ts`
- [X] T063 [US4] Implement thin customer privacy HTTP submit/list/get/cancel in `src/modules/customers/customers.routes.ts` / `src/modules/customers/customers.controller.ts` / `src/modules/customers/customers.schema.ts`, registering **only** completed US4 handlers; wire privacy denials through Admin non-TX denial audit
- [X] T064 [US4] Expose processor/privileged application ports via composition only (no public processor HTTP) in `src/composition.ts`
- [X] T065 [US4] Implement customers-owned bounded retention sweep (startup + hourly) in `src/modules/customers/privacy-retention.sweep.ts` and schedule from `src/server-lifecycle.ts` / `src/composition.ts`
- [X] T066 [US4] Publish customer privacy OpenAPI paths in `src/swagger/openapi.document.ts`
- [X] T067 [US4] Extend authorization/security matrix for US3–US4 families (contact/preferences/privacy; pending-only limits; forged processor/capability/permission) in `tests/integration/customers/authorization-matrix-us3-us4.test.ts`

**Checkpoint**: Privacy foundations complete without fulfillment side effects; FR-033/034/035 privacy obligations and privileged rollback evidenced

---

## Phase 8: Polish & Cross-Cutting Concerns — 11 tasks

**Purpose**: Executable acceptance harnesses, regressions, docs, quality gates

**Wave 1 — independent where file-disjoint:**

- [X] T068 [P] Add R1-P02 `/auth/*` contract regression test (SC-010) in `tests/integration/authentication/r1-p02-contract-freeze.test.ts`
- [X] T069 [P] Add executable SC-005 fixed P01–P20 cohort acceptance test in `tests/integration/customers/sc005-cohort.test.ts`: exact SC-005 category/profile assignments; common starting state (authenticated, no assigned-category profile, no language preference, empty address book); journey performs assigned profile creation, Arabic or English selection, and one valid address save; asserts at least 19 of 20 finish correctly within five minutes
- [X] T070 [P] Add SC-008 canonical exact 1,000-row scenario manifest generator/validator (25 lanes × 40 interactions; locked leaf counts; caller context/ownership/operation/expected outcome/lane/slot fixed) in `tests/integration/customers/sc008-manifest.ts`
- [X] T071 Add SC-008 acceptance workload runner in `tests/integration/customers/sc008-workload.test.ts`: load validated 1,000-row manifest; execute exactly 25 lanes × 40 interactions during a 10-minute steady-state measurement window; assert every locked leaf count and expected outcome; assert at least 95% of measured interactions complete within two seconds; exclude protected-media byte-transfer time and other locked SC-008 exclusions; **fail the test when the threshold is missed**
- [X] T072 [P] Copy planning OpenAPI into exact published path `docs/apis/openapi/r1-p04-customer-self-service.yaml` and configure `npm run openapi:validate` to cover that exact file
- [X] T073 [P] Update `specs/R1-P04-customer-profiles-preferences-text-addresses/traceability.md` with task→FR/SC evidence links for T001–T078
- [X] T074 [P] Add cross-story FR-035 negative audit assertions covering profile GET, protected image GET, address GET/list, contact-state GET, preferences GET, and privacy request GET/list (and redacted operational logs if inspected) in `tests/integration/customers/fr035-read-non-audit.test.ts`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — validation suite (single owner):**

- [X] T075 Run quickstart static + unit + integration validation matrix, explicitly including SC-005 (`tests/integration/customers/sc005-cohort.test.ts`) and SC-008 (`tests/integration/customers/sc008-workload.test.ts`); record commands and measured results (including SC-005 19/20@5min and SC-008 95%@2s) in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`
- [X] T076 Run `npm run typecheck`, `npm run lint`, `npm run docs:check`, `npm run openapi:validate`, `npm run prisma:validate`, `git diff --check`; record results in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`
- [X] T077 Confirm no `customer` role provisioning path, no `resource.self.*`, no geo columns, no queues, no AppConfig retention key, no temporary 501 customer handlers, no public processor HTTP; record scan evidence in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md`
- [X] T078 Prepare independent implementation review package (diff scope + DoD checklist) in `specs/R1-P04-customer-profiles-preferences-text-addresses/implementation-summary.md` — do not claim Complete without human-owner approval

---

## Phase 9: DEC-033 repair + independent-review remediations — T079+

**Purpose**: Cloudinary always-replace profile images; durable cleanup; repair accepted review findings. Phase remains **In Progress**; independent re-review **PENDING**; do not claim Complete.

- [X] T079 Record DEC-033 in `docs/product/decision-log.md` and align `docs/product/current.md`, `specs/R1-P04-customer-profiles-preferences-text-addresses/{activation,plan,research,data-model,quickstart,traceability,review-resolution,implementation-summary}.md`, `contracts/media-profile-image.md`, `contracts/customer-self-service.md`, source+published OpenAPI, and checklist status prose
- [X] T080 Update `src/config/env.ts` and `.env.example` for Cloudinary/`MEDIA_STORAGE_PROVIDER`/`MEDIA_IMAGE_MAX_BYTES`; remove `MEDIA_STORAGE_ROOT`; extend `tests/unit/config/env-r1-p04.test.ts`
- [X] T081 Create forward-only Prisma schema + migration `prisma/migrations/r1_p04_cloudinary_profile_image_storage/migration.sql` (do not edit `r1_p04_customer_profiles_preferences_text_addresses`); add migration structural coverage in `tests/integration/migration-r1-p04*.ts` / clean-apply as needed
- [X] T082 Implement Sharp processor `src/modules/media/infrastructure/sharp-profile-image.processor.ts` and unit tests in `tests/unit/modules/media/sharp-profile-image.processor.test.ts`
- [X] T083 Implement Cloudinary adapter + provider factory + Prisma media repository + cleanup sweep under `src/modules/media/infrastructure/`; remove `src/modules/media/infrastructure/local-filesystem-media.adapter.ts` and obsolete filesystem tests
- [X] T084 Implement Multer route middleware `src/modules/customers/profile-image.multer.ts` and wire only on `PUT /profile-image` in `src/modules/customers/customers.routes.ts`
- [X] T085 Rewrite `src/modules/customers/profile-image.service.ts` + controller/schema for always-replace CAS, signed URL GET/PUT aggregate, DELETE CAS; update `src/composition.ts` wiring and background cleanup
- [X] T086 Expose `src/modules/authentication/authentication.public.ts` and stop customers deep-imports of Authentication `domain/`/`infrastructure/`
- [X] T087 Ensure denial audit never executes inside customers UoW; add regression coverage under `tests/unit/modules/customers/` or integration denial tests
- [X] T088 Align privacy path param `privacyRequestId` across routes/Zod/controller/source+published OpenAPI/tests
- [X] T089 Remove unused `src/modules/customers/customers.service.ts`; fix stale route comments; update OpenAPI operation inventory in `tests/unit/swagger/openapi-document.test.ts`
- [X] T090 Replace SC-005 / SC-008 / FR-035 placeholders with real authenticated HTTP/DB journeys in `tests/integration/customers/sc005-cohort.test.ts`, `sc008-workload.test.ts`, `fr035-read-non-audit.test.ts`
- [X] T091 Move mock-only customer “integration” tests to `tests/unit/`; keep DB CRUD/audit/CAS/retention under `tests/integration/customers/` against approved disposable R1-P04 DB
- [X] T092 Add/repair media HTTP + CAS + cleanup tests (Multer/Sharp/Cloudinary/always-replace) under `tests/unit/modules/media/` and `tests/integration/customers/profile-image.test.ts`
- [X] T093 Run validation matrix (generate/validate/typecheck/lint/build/docs/openapi/unit/focused suites/migration/DB integration/SC-005/SC-008/coverage/`git diff --check`); record results in `implementation-summary.md` and `review-resolution.md`; leave re-review **PENDING**; do not claim Complete

## Phase 10: Post-re-review BLOCKED remediations — T094+

**Purpose**: Repair accepted independent re-review findings after DEC-033. Phase remains **In Progress**; next gate is fresh independent read-only re-review; do not claim Complete.

- [X] T094 Move all non-TX ownership-denial audit writes outside customers `$transaction` (address get/update/remove; privacy cancel; equivalent paths); add TX-boundary regression tests
- [X] T095 Expose `src/modules/media/media.public.ts` (`MediaPendingUploadPort`); stop customers imports of media `domain/`/`infrastructure/`; add media boundary unit test; wire composition
- [X] T096 Require Cloudinary upload `type === "authenticated"` in adapter validation; reject `type: "upload"`; add unit regression
- [X] T097 Make first profile-image association concurrency-safe (P2002 → CONFLICT; loser PENDING_DELETE); add real-DB concurrent first-put test
- [X] T098 Replace SC-008 `profile.media` no-ops with real ProfileImageService interactions (fake Cloudinary); fail harness on no-op rows
- [X] T099 Stabilize full integration isolation (`authorization-seed-drift-repair`, `uniqueIdentity`); obtain one clean first-attempt full sequential `test:integration` on proof DB
- [X] T100 Align status docs: re-review BLOCKED / repair in progress; live Cloudinary smoke PENDING until owner-authorized smoke PASS; run smoke + validation; leave next gate as fresh independent re-review; do not claim Complete

## Phase 11: Post-re-review CHANGES REQUIRED remediations — T101+

**Purpose**: Repair accepted findings from the fresh independent implementation
re-review (`CHANGES REQUIRED`). Phase remains **In Progress**; next gate is
another fresh independent read-only re-review; do not claim Complete.

- [X] T101 Remove cross-customer existence oracle (address get/update/delete; privacy cancel/get); denial audit after TX; OpenAPI + unit/integration equivalence tests; denial-outside-UoW for update/remove
- [X] T102 Rename Cloudinary migration for safe lexical order; create/migrate `cleanora_r1_p04_clean_proof`; leave old proof DB untouched; prove idempotent deploy
- [X] T103 Fail-closed R1-P04 test-database gate; `.env.example` docs; unit tests for safe/unsafe configs
- [X] T104 Eliminate OTP/seed-drift/coverage `.tmp` flakes with root-cause fixes (OTP P2034 retry; seed operation free; `reportOnFailure`); capture safe signup error codes; one honest first post-fix full integration + coverage attempt
- [X] T105 SC-008 exact media leaf matrix 5 auth / 5 add / 5 replace / 5 remove with fake non-network media and one-shot fixtures
- [X] T106 Owner-authorized live Cloudinary smoke + redacted evidence artifact; no residue
- [X] T107 Keep `media.public.ts` infrastructure-free; move pending-upload factory to composition-owned media factory; strengthen boundary test
- [X] T108 Align status/evidence surfaces after validation; preserve historical verdicts; next gate fresh independent re-review; not Complete
- [X] T109 Sequential validation matrix on `cleanora_r1_p04_clean_proof` only; record attempt history honestly

## Phase 12: Convergence-audit DEC-033 documentation alignment — T110+

**Purpose**: Repair actionable post-repair documentation contradictions found
during convergence audit. Phase remains **In Progress**; next gate is fresh
independent read-only re-review; do not claim Complete.

- [X] T110 Align DEC-033 current contract/data-model surfaces (remove superseded `MEDIA_STORAGE_ROOT` delivery wording; name Cloudinary migration `r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`) in `specs/R1-P04-customer-profiles-preferences-text-addresses/data-model.md`, `specs/R1-P04-customer-profiles-preferences-text-addresses/contracts/README.md`, and `specs/R1-P04-customer-profiles-preferences-text-addresses/contracts/transaction-boundaries.md`; add regression in `tests/unit/tooling/r1-p04-dec033-contract-docs.test.ts`; validate with `npm run test:unit -- tests/unit/tooling/r1-p04-dec033-contract-docs.test.ts` and `npm run docs:check`
- [X] T111 Make privileged-reason seed restore transactional upsert-by-code with bounded P2002/P2034 retry (no non-TX delete-then-create race) in `prisma/seed.ts`; align `tests/integration/authorization-seed-drift-repair.test.ts` and `tests/unit/tooling/authorization-seed-upserts.test.ts`; validate with focused seed-drift + authorization-seed-upserts then restart full validation matrix
- [X] T112 Stop coverage/integration pool exhaustion from seed opening a competing Prisma/pg pool: accept optional shared Prisma client, standalone max-1 pool, update seed call sites under `tests/integration/**` to `seed(getPrismaClient())`, pre-clean coverage once via `scripts/clean-coverage.cjs`; regression in `tests/unit/tooling/authorization-seed-upserts.test.ts`; validate focused OTP + authorization-seed then restart full validation matrix

---

## Phase 13: Final re-review repair loop — T113–T117

**Purpose**: Repair fresh independent final re-review `CHANGES REQUIRED` findings (smoke evidence hardcoding, customers audit-rollback evidence gap, three MINOR items, Cleanora DB incident prevention). Phase remains **In Progress**; next gate is another fresh independent read-only final re-review.

- [X] T113 Fail-closed R1-P04 database command runner (`scripts/r1-p04-database-command.cjs`) + incident artifact (`docs/ai/incidents/r1-p04-cleanora-database-incident.md`) + unit tests (`tests/unit/tooling/r1-p04-database-command.test.ts`); package scripts `r1-p04:migrate:deploy`, `r1-p04:migrate:status`, `r1-p04:seed`
- [X] T114 Response-derived Cloudinary smoke evidence: adapter upload/destroy result contracts + smoke script + unit tests (`tests/unit/tooling/smoke-cloudinary-evidence.test.ts`, `tests/unit/modules/media/cloudinary-media.adapter.test.ts`); one authorized live smoke rerun
- [X] T115 Customers audit-failure rollback integration (`tests/integration/customers/customers-audit-rollback.test.ts`); reconcile checked task evidence for T039/T044/T049/T057/T058 with consolidated shipped suites
- [X] T116 MINOR closure: whole-directory coverage cleanup alignment (`scripts/clean-coverage.cjs`, `tests/unit/tooling/clean-coverage.test.ts`); expanded DEC-033 normative doc regression (`tests/unit/tooling/r1-p04-dec033-contract-docs.test.ts`); Sharp metadata strip test (`tests/unit/modules/media/sharp-profile-image.processor.test.ts`)
- [X] T117 Sequential validation matrix on `cleanora_r1_p04_clean_proof` using safe runner only; record attempt history; align status surfaces to `READY_FOR_ANOTHER_FRESH_INDEPENDENT_FINAL_REVIEW` without claiming review PASS or Complete

---

## Phase 14: SC-008 concurrent-lane harness repair — T118–T120

**Purpose**: Repair SC-008 harness defect that serialized all 1,000 interactions instead of running exactly 25 concurrent lanes. Do not refresh or recreate any database. Phase remains **In Progress**; next gate is another fresh independent read-only final re-review.

- [X] T118 Implement true SC-008 25 concurrent-lane execution (`tests/helpers/sc008-lane-executor.ts`, `tests/integration/customers/sc008-workload.test.ts`) + unit regression (`tests/unit/tooling/sc008-lane-executor.test.ts`); keep 10-minute / 95%@2s / media 5/5/5/5 locks
- [X] T119 Fresh-process coverage after T118; disposition prior `coverage/.tmp` ENOENT as downstream unless it reproduces
- [X] T120 Complete final sequential validation matrix and check T117 after all broad gates pass; status handoff without claiming review PASS or Complete

**Evidence mapping (T039/T044/T049/T057/T058 consolidated — no empty wrapper files):**

| Task | Shipped evidence |
|---|---|
| T039 | `tests/integration/customers/fr035-read-non-audit.test.ts` (address GET/list FR-035); `tests/integration/customers/sc008-workload.test.ts` (address CRUD/concurrency); `tests/unit/modules/customers/address.service.test.ts`; `tests/integration/customers/customers-audit-rollback.test.ts` (audit rollback) |
| T044/T046 | `tests/unit/modules/customers/authorization-matrix-us1-us2.test.ts`; `tests/integration/customers/us1-denial-audit.test.ts`; `tests/integration/customers/fr030-existence-redaction` coverage via `tests/unit/modules/customers/fr030-existence-redaction.test.ts` + `denial-audit-outside-uow.test.ts` |
| T049 | `tests/integration/customers/fr035-read-non-audit.test.ts` (preferences GET FR-035); `tests/integration/customers/sc008-workload.test.ts` (preferences PUT/CAS); `tests/unit/modules/customers/preferences.service.test.ts`; `tests/integration/customers/customers-audit-rollback.test.ts` (audit rollback) |
| T057 | `tests/integration/customers/sc008-workload.test.ts` (privacy lifecycle); `tests/unit/modules/customers/privacy-*.test.ts`; `tests/integration/customers/customers-audit-rollback.test.ts` (privileged rollback) |
| T058 | `tests/unit/modules/customers/privacy-retention.sweep.test.ts`; retention env readiness in `tests/unit/config/env-r1-p04.test.ts` |

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup** → no dependencies; T001 then T002 (serialized; both write `implementation-summary.md`)
- **Phase 2 Foundational** → depends on Setup; **BLOCKS** all user stories; **does not mount** public customer routes
- **US1 (P1)** → after Foundational — **MVP** (includes FR-033/034/035 for profile/image)
- **US2 (P1)** → after Foundational and after US1 shared HTTP/OpenAPI/schema files are stable (serialize shared-file tasks)
- **US5 (P1)** → after US1+US2 surfaces exist for authz/eligibility evidence on those surfaces; T046 after T043 and T044 (same authz-matrix test file as T044)
- **US3 (P2)** → after Foundational; serialize shared HTTP/OpenAPI/schema after prior stories
- **US4 (P2)** → after Foundational; serialize shared HTTP/OpenAPI/schema after prior stories; may run internals in parallel with US3 only when files are disjoint
- **Polish** → after desired stories complete; T071 depends on T070 manifest

### Parallel opportunities

- Foundation test wave (T003–T009) parallel
- After schema: env/catalog/seed/scaffolds (T014–T018) parallel; T019 runs after T017 (writes inside `src/modules/customers/`)
- Admin audit writers T020 then T021 serialized (both edit `audit.service.ts`)
- US1 tests (T025–T029) parallel; US1 repos/adapters (T030–T032) parallel
- US2/US3/US4 test waves parallel within story when file-disjoint
- US5: T044 and T045 parallel; T046 serialized after T043 and T044 (shared `authorization-matrix-us1-us2.test.ts`)
- Polish T068–T070, T072–T074 parallel; T071 after T070

### MVP scope

Complete Phase 1 + Phase 2 + Phase 3 (US1) → stop and validate independently before continuing.

MVP includes US1 FR-033 general transactional audit for profile/image mutations, FR-034 US1 denial audit, FR-035 profile/image GET non-audit assertions, and story-gated mount of completed US1 handlers only.

---

## Explicitly out of scope (do not task)

- Customer role grants / `resource.self.read` / `resource.self.write`
- Maps, coordinates, geocoding, zones, radius, provider onboarding
- Privacy fulfillment (account status change, session revoke, delete/anonymize, export files)
- Staff privacy UI / production processor adapter / public processor HTTP
- Docker, Testcontainers, cloud object storage, queues/job engines
- Temporary 501 handlers or mounting unfinished public routes
- Editing applied migrations
- Claiming phase Complete without human-owner approval
- Beginning implementation before separate human-owner implement authorization

---

## Notes

- Do not mark tasks complete in this file until implementation is authorized and work is done
- Prefer failing tests before implementation within each story
- Customers owns all R1-P04 business transactions; Admin participates only via audit ports
- Non-TX denial audit writer is composition-injected into denial paths and must not live inside the customers UoW
- Historical technical-planning `CHANGES REQUIRED` is evidence only; current planning review is `PASS`
- Historical post-tasks `/speckit.analyze` `CHANGES REQUIRED` results (including N1/N2 rerun) remain historical evidence only; final independent `/speckit.analyze` verdict is **`CLEAN`**
- Companion remains `currentStep=plan` / `status=planned` (`after_tasks` skipped — `python3` unavailable; non-blocking; does not authorize implementation)

## Task count by phase

| Phase | Tasks | IDs |
|---|---|---|
| 1 Setup | 2 | T001–T002 |
| 2 Foundational | 22 | T003–T024 |
| 3 US1 (MVP) | 13 | T025–T037 |
| 4 US2 | 6 | T038–T043 |
| 5 US5 | 3 | T044–T046 |
| 6 US3 | 8 | T047–T054 |
| 7 US4 | 13 | T055–T067 |
| 8 Polish | 11 | T068–T078 |
| **Total** | **78** | **T001–T078** |

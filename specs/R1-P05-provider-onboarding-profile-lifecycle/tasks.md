---

description: "Dependency-ordered implementation tasks for R1-P05"
---

# Tasks: R1-P05 Provider Onboarding, Profile & Lifecycle

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, and
`quickstart.md` in this directory.  
**Tests**: Mandatory. In every user-story phase, create the listed tests first,
confirm the focused tests fail for the missing behavior, then implement.  
**Scope gate**: These tasks describe implementation; generating this file does
not execute them. No commit, push, deployment, production migration, frontend,
or later-phase behavior is included.

## Format

Every item uses `- [ ] T### [P?] [US#?] Description with exact file path`.
`[P]` means the task is safe to perform in parallel only after its dependencies
are satisfied and it does not overlap another task's files.

## Phase 1: Setup and contract registration

**Purpose**: Register the approved phase surfaces and prepare focused test
infrastructure without implementing business behavior.

- [x] T001 Register `docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml` in `scripts/openapi-validate.ts` and `scripts/docs-check.ts`, using `specs/R1-P05-provider-onboarding-profile-lifecycle/contracts/provider-api.openapi.yaml` as the planning authority (FR-079, FR-080, FR-081, FR-082).
- [x] T002 Add the R1-P05 Postman generator/validation entry points to `scripts/generate-r1-p05-postman.ts`, `scripts/validate-postman.ts`, and `package.json` without changing earlier collection contracts (FR-079, FR-080, FR-081, FR-082).
- [x] T003 [P] Add deterministic Provider, Staff, media, invitation, and categoryless-invitee fixture builders in `tests/helpers/provider-fixtures.ts` and document their isolated proof-database use in `tests/integration/README.md`.
- [x] T004 [P] Add barrier/latch and deterministic email/media fakes in `tests/helpers/provider-concurrency.ts`, `tests/helpers/fake-provider-email.ts`, and `tests/helpers/fake-provider-media.ts`; prohibit sleep-based races and real SMTP/Cloudinary calls (FR-084, FR-086).
- [x] T005 Create the approved module skeleton and explicit public entry point in `src/modules/providers/providers.public.ts`, `src/modules/providers/providers.routes.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.schema.ts` without importing another module's internals (FR-079, FR-080, FR-081, FR-082).
- [x] T006 Wire dependency factories and route mounting only through `src/composition.ts` and `src/routes/index.ts`, keeping Staff Provider routes owned by `providers` and Admin limited to audit ownership (FR-079, FR-080, FR-082).

---

## Phase 2: Foundational persistence, authority, and ports

**Purpose**: Build the blocking data and module contracts used by every story.

**Critical**: No user-story implementation begins until this phase passes its
focused tests and migration validation.

### Foundation tests first

- [x] T007 [P] Add Prisma schema-shape and migration-hygiene tests for exactly eight Provider tables, enum additions, FKs, partial uniqueness, CHECKs, and the full migration inventory in `tests/integration/migration-r1-p05-hygiene.test.ts` (FR-008, FR-014, FR-028, FR-040, FR-048, FR-055, FR-083, FR-084).
- [x] T008 [P] Add clean-apply, double-seed, rollback, and constraint-probe coverage in `tests/integration/migration-r1-p05.test.ts` and extend `scripts/validate-clean-migration.ts` to verify the complete chronology (FR-008, FR-026, FR-040, FR-055, FR-084; SC-002, SC-011).
- [x] T009 [P] Add Authentication policy regressions for public `PROVIDER_OWNER` rejection, invitation-purpose OTP shape, restricted onboarding principal, empty-category invited identities, and role-only full login capability without Provider-table reads in `tests/unit/modules/authentication/provider-onboarding-policy.test.ts` and `tests/integration/authentication/provider-onboarding-compatibility.test.ts` (FR-010, FR-011, FR-052, FR-058).
- [x] T010 [P] Add Media public-contract tests for Provider owner types, PROCESSING/FAILED lifecycle, thumbnails, signed delivery, and safe cleanup in `tests/unit/modules/media/provider-media-public.test.ts` (FR-040–FR-047, FR-086).
- [x] T011 [P] Add public-module boundary tests forbidding cross-module repository/Prisma/internal imports in `tests/unit/architecture/provider-module-boundaries.test.ts` (FR-082, FR-086).

### Foundation implementation

- [x] T012 Update `prisma/schema.prisma` with the eight models and enums exactly defined in `data-model.md`, including Provider review-cycle counter, typed status history, profile media slots, gallery items, invitations, and non-invitation email outbox (FR-008, FR-014, FR-025, FR-028, FR-040, FR-048, FR-055, FR-083).
- [x] T013 Create forward-only SQL in `prisma/migrations/<timestamp>_r1_p05_provider_onboarding_profile_lifecycle/migration.sql` with named partial indexes/CHECKs, nullable invitation OTP category shape, deliberate `users_categories_nonempty_check` removal, and Provider Media enum extensions; do not edit any applied migration (FR-008, FR-010, FR-014, FR-028, FR-040, FR-055, FR-058, FR-084).
- [x] T014 Update idempotent permission catalogs/seeds in `src/modules/authentication/domain/authorization.catalog.ts`, `scripts/seed.ts`, and their owned helpers to grant `providers.applications.review` and `providers.lifecycle.manage` only to `staff_admin` (FR-019, FR-030, FR-085).
- [x] T015 Remove `PROVIDER_OWNER` from public signup/enrollment schemas and policy branches in `src/modules/authentication/auth.schema.ts` and `src/modules/authentication/domain/auth.policy.ts`, while retaining staff-only approval grant support (FR-010, FR-011).
- [x] T016 Extend Authentication's public contract in `src/modules/authentication/authentication.public.ts` with current Provider eligibility/contact reads, transaction-bound owner/role authority participant, and invitation-only identity onboarding; implement adapters inside `src/modules/authentication/` (FR-002, FR-010, FR-011, FR-026, FR-052, FR-057, FR-058).
- [x] T017 Update Authentication OTP/session policies in `src/modules/authentication/` so `PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION` binds the fixed email with null category, yields only a restricted accept/session-cleanup principal before acceptance, and grants full capability afterward from Authentication's enabled `provider_admin` role without reading Provider tables (FR-052, FR-057, FR-058, FR-059).
- [x] T018 [P] Add `ProviderApplicantProfileReader` to `src/modules/customers/customers.public.ts` and its Customers-owned implementation, returning only matching-profile completeness plus private Individual/Company review identity context (FR-002, FR-033, FR-034).
- [x] T019 [P] Add/reuse the active-country public reader in `src/modules/configuration/configuration.public.ts` and its owner implementation with safe active/inactive outcomes (FR-031).
- [x] T020 [P] Extend `src/modules/media/media.public.ts` and Media-owned adapters for Provider image/video processing, thumbnail variants, signed delivery, PROCESSING/FAILED/PENDING_DELETE, and bounded cleanup without letting Media decide Provider authorization (FR-040–FR-047, FR-086).
- [x] T021 [P] Expose narrow transactional and denial audit contracts from `src/modules/admin/audit.public.ts` and its Admin-owned adapter without allowing Provider imports from `admin/infrastructure/` (FR-025, FR-026, FR-030, FR-085, FR-086).
- [x] T022 Define Provider domain enums, aggregate types, ports, errors, transition matrices, and expected-version contract in `src/modules/providers/domain/providers.types.ts`, `src/modules/providers/domain/providers.ports.ts`, `src/modules/providers/domain/providers.errors.ts`, and `src/modules/providers/domain/provider-lifecycle.policy.ts` (FR-014, FR-015, FR-021, FR-023, FR-024, FR-028, FR-083).
- [x] T023 Implement explicit-select Provider repositories and a transaction-scoped unit of work in `src/modules/providers/infrastructure/prisma-provider.repository.ts` and `src/modules/providers/infrastructure/prisma-providers.unit-of-work.ts`; expose no raw Prisma records (FR-025, FR-083, FR-084, FR-086).
- [x] T024 Implement closed-template review/operational outbox persistence, five-attempt fixed retry schedule with terminal FAILED, bounded dispatcher, and strict Provider email/token/media configuration in `src/modules/providers/infrastructure/prisma-provider-email-outbox.repository.ts`, `src/modules/providers/provider-email-dispatcher.ts`, and `src/config/env.ts`; exclude invitations and user preferences (FR-077, FR-078, FR-086).
- [x] T025 Run the Phase 2 focused tests plus `npm run prisma:validate`, `npm run prisma:generate`, and `npm run db:validate-clean-migration`; record passing evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md` before any story work.

**Checkpoint**: Schema, migration, seeds, public ports, module boundary, and unit
of work are ready; earlier Authentication/Media/Customer behavior remains green.

---

## Phase 3: User Story 1 — Individual Team Application (P1)

**Goal**: A verified eligible Individual creates exactly one draft as Application
Owner without pre-approval Provider authority.

**Independent test**: Exercise eligible, unverified, incomplete-profile,
Engineer-only, duplicate, and concurrent creation cases.

### Tests first

- [x] T026 [P] [US1] Add unit tests for Individual eligibility, Engineer denial, authoritative mapping, and Application Owner-without-membership policy in `tests/unit/modules/providers/individual-application.policy.test.ts` (FR-001–FR-004, FR-013; SC-001).
- [x] T027 [P] [US1] Add API/integration tests for `POST /api/v1/providers`, idempotent identical retry, conflicting kind, retrieval, and no pre-approval authority in `tests/integration/providers/us1-individual-application.test.ts` (FR-002, FR-003, FR-008, FR-013, FR-016; SC-001, SC-002).
- [x] T028 [US1] Add barrier-based concurrent initial-creation coverage asserting one Provider/application/history row in `tests/integration/providers/us1-concurrent-create.test.ts` (FR-008, FR-084; SC-002).

### Implementation

- [x] T029 [P] [US1] Implement server-authoritative applicant eligibility and kind mapping in `src/modules/providers/domain/provider-eligibility.policy.ts` using Authentication/Customers public readers (FR-001–FR-004).
- [x] T030 [US1] Implement idempotent one-Provider application creation in `src/modules/providers/provider-application.service.ts` with Application Owner linkage only (FR-008, FR-013, FR-084).
- [x] T031 [US1] Implement strict create/list/get schemas and safe DTO mappers in `src/modules/providers/providers.schema.ts` and `src/modules/providers/provider.dto.ts` (FR-013, FR-079, FR-082, FR-086).
- [x] T032 [US1] Expose `POST /providers`, `GET /providers`, and `GET /providers/{providerId}` through `src/modules/providers/providers.controller.ts` and `src/modules/providers/providers.routes.ts` with existing envelopes/request ids/rate limits (FR-079, FR-082).
- [x] T033 [US1] Run the US1 unit/integration/concurrency tests and confirm SC-001 and SC-002 evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 4: User Story 2 — Registered Company Application (P1)

**Goal**: A verified Company creates the same Provider entity with Company-
specific eligibility while account identity remains separate.

**Independent test**: Verify Company, dual-category choice, never-submitted kind
change, identity-context switch, and post-submission immutability.

### Tests first

- [x] T034 [P] [US2] Add Company/dual-category/kind-change policy tests in `tests/unit/modules/providers/company-application.policy.test.ts` (FR-001, FR-002, FR-004–FR-007, FR-033, FR-034).
- [x] T035 [P] [US2] Add Company creation and `PATCH /providers/{providerId}/kind` API tests in `tests/integration/providers/us2-company-application.test.ts` (FR-001, FR-005–FR-007; SC-001, SC-002).

### Implementation

- [x] T036 [US2] Extend `src/modules/providers/domain/provider-eligibility.policy.ts` for Company profile completeness and explicit dual-category choice without duplicating customer identity (FR-001, FR-002, FR-004, FR-005, FR-033, FR-034).
- [x] T037 [US2] Implement never-submitted kind-change CAS behavior and authoritative context recheck in `src/modules/providers/provider-application.service.ts` (FR-006, FR-007, FR-083).
- [x] T038 [US2] Add strict kind-change validation/DTOs in `src/modules/providers/providers.schema.ts` and `src/modules/providers/provider.dto.ts` (FR-005–FR-007, FR-082).
- [x] T039 [US2] Add `PATCH /providers/{providerId}/kind` to `src/modules/providers/providers.controller.ts` and `src/modules/providers/providers.routes.ts` (FR-006, FR-007, FR-079).
- [x] T040 [US2] Run US2 tests and record Company/dual-category evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 5: User Story 3 — Profile and Private Contacts (P1)

**Goal**: Authorized actors manage required presentation and private operational
contact data without creating a direct-customer contact surface.

**Independent test**: Replace profile/contacts, validate active country and
required/optional fields, then prove preview contains no direct contacts.

### Tests first

- [x] T041 [P] [US3] Add profile/contact completion and normalization tests in `tests/unit/modules/providers/provider-profile-contact.policy.test.ts` (FR-031–FR-036, FR-062).
- [x] T042 [P] [US3] Add authorization and full-replacement API tests for profile/contact endpoints in `tests/integration/providers/us3-profile-contacts.test.ts` (FR-016, FR-031–FR-037, FR-083).
- [x] T043 [P] [US3] Add post-approval edit and contact-free preview regression tests in `tests/integration/providers/us3-approved-edit-privacy.test.ts` (FR-027, FR-038, FR-039; SC-004).

### Implementation

- [x] T044 [P] [US3] Implement normalized profile/contact value policies and strict full-replacement schemas in `src/modules/providers/domain/provider-profile.policy.ts` and `src/modules/providers/providers.schema.ts` (FR-031, FR-032, FR-035, FR-036).
- [x] T045 [US3] Implement profile/contact writes with active-country lookup, CAS, current-state authorization, audit, and completion invalidation in `src/modules/providers/provider-profile.service.ts` (FR-016, FR-027, FR-031–FR-037, FR-062, FR-083).
- [x] T046 [US3] Implement separate private-contact and allowlisted contact-free preview DTOs in `src/modules/providers/provider.dto.ts` (FR-033–FR-039, FR-086; SC-004).
- [x] T047 [US3] Add `GET|PUT /profile`, `GET|PUT /contacts`, and protected `GET /preview` handlers in `src/modules/providers/providers.controller.ts` and `src/modules/providers/providers.routes.ts` (FR-037–FR-039, FR-079).
- [x] T048 [US3] Ensure approved profile/contact edits preserve `APPROVED`, increment version, audit, and recompute projections in `src/modules/providers/provider-profile.service.ts` (FR-027, FR-062, FR-083).
- [x] T049 [US3] Add privacy-safe logging/error redaction for these endpoints in `src/modules/providers/provider.dto.ts` and `src/modules/providers/providers.controller.ts` (FR-038, FR-086; SC-004).
- [x] T050 [US3] Run US3 tests and record the zero-contact preview field inventory in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 6: User Story 4 — Provider Media (P1)

**Goal**: Safely manage fixed Provider media slots and bounded ordered gallery.

**Independent test**: Prove every count/byte/MIME/dimension/state boundary,
READY-only contribution, replacement compensation, and approved edit behavior.

### Tests first

- [x] T051 [P] [US4] Add exhaustive image/video/thumbnail policy tests in `tests/unit/modules/providers/provider-media.policy.test.ts` (FR-040–FR-047; SC-005, SC-013).
- [x] T052 [P] [US4] Add multipart and Media-port fake API tests for logo, cover, gallery image/video, list, reorder, explicit slot deletion, and gallery-item deletion in `tests/integration/providers/us4-provider-media.test.ts` (FR-040–FR-047, FR-083).
- [x] T053 [US4] Add barrier races for 13th image, third video, slot replacement, reorder, and delete in `tests/integration/providers/us4-media-concurrency.test.ts` (FR-040, FR-047, FR-084; SC-005).
- [x] T054 [P] [US4] Add approved/suspended management, failure compensation, signed URL, and contact/storage-secret redaction tests in `tests/integration/providers/us4-media-lifecycle.test.ts` (FR-027, FR-030, FR-046, FR-086).

### Implementation

- [x] T055 [P] [US4] Implement Provider semantic media limits, READY rules, fixed image dimensions, video constraints, and 60-second guidance-only policy in `src/modules/providers/domain/provider-media.policy.ts` (FR-040–FR-047).
- [x] T056 [US4] Implement short reserve/upload/finalize/compensate workflows using the Media public port in `src/modules/providers/provider-media.service.ts` (FR-040–FR-047, FR-083, FR-084).
- [x] T057 [US4] Implement Provider gallery-item/profile-slot persistence and locked capacity checks in `src/modules/providers/infrastructure/prisma-provider-media.repository.ts` (FR-040, FR-041, FR-046, FR-047, FR-084).
- [x] T058 [US4] Implement multipart limits and strict media schemas in `src/modules/providers/provider-media.multer.ts` and `src/modules/providers/providers.schema.ts` (FR-042–FR-045, FR-047).
- [x] T059 [US4] Add all media routes from `contracts/provider-api.md` to `src/modules/providers/providers.controller.ts` and `src/modules/providers/providers.routes.ts` (FR-079, FR-082).
- [x] T060 [US4] Return authorized short-lived signed media/thumbnail projections without storage ids in `src/modules/providers/provider.dto.ts` (FR-046, FR-086).
- [x] T061 [US4] Preserve APPROVED during authorized media mutation and recalculate completion/readiness/public-false state in `src/modules/providers/provider-media.service.ts` (FR-027, FR-062, FR-073).
- [x] T062 [US4] Run US4 tests three times for concurrency suites and record boundary/compensation evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 7: User Story 5 — Submission and Resubmission (P1)

**Goal**: Application Owner submits only a complete editable application and
retains immutable review history across resubmission.

**Independent test**: Submit, observe lock, request-changes fixture, edit, and
resubmit with a new cycle while incomplete calls return every blocker.

### Tests first

- [x] T063 [P] [US5] Add transition/editability/all-blocker unit tests in `tests/unit/modules/providers/provider-submission.policy.test.ts` (FR-014–FR-018, FR-022–FR-024; SC-013, SC-014).
- [x] T064 [P] [US5] Add submit/resubmit API journey tests in `tests/integration/providers/us5-submission.test.ts` (FR-016–FR-018, FR-022, FR-025, FR-083; SC-013, SC-014).
- [x] T065 [US5] Add concurrent/retried submission tests asserting one incremented cycle/history/outbox intent in `tests/integration/providers/us5-submission-concurrency.test.ts` (FR-018, FR-084).

### Implementation

- [x] T066 [US5] Implement authoritative submission blocker aggregation and Application Owner-only edit lock in `src/modules/providers/domain/provider-submission.policy.ts` (FR-016–FR-018; SC-013, SC-014).
- [x] T067 [US5] Implement submit/resubmit transaction, reviewCycle counter, typed history, audit, and mandatory submission email intent in `src/modules/providers/provider-application.service.ts` (FR-018, FR-022, FR-025, FR-077, FR-083, FR-084).
- [x] T068 [US5] Add strict `POST /providers/{providerId}/application/submit` endpoint and stable all-blocker conflict response in `src/modules/providers/providers.schema.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.routes.ts` (FR-017, FR-079, FR-082, FR-086).
- [x] T069 [US5] Enforce PENDING_REVIEW mutation/invitation/member denial in `src/modules/providers/domain/provider-authorization.policy.ts` (FR-018, FR-048, FR-054; SC-014).
- [x] T070 [US5] Run US5 tests three times for concurrency and record cycle/lock/outbox evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 8: User Story 6 — Staff Approval (P1)

**Goal**: Staff Admin reviews a deterministic queue and approves one complete
atomic ownership outcome that remains inactive.

**Independent test**: Queue/dossier/approve with authorized, unauthorized,
repeated, concurrent, stale, and injected participant-failure cases.

### Tests first

- [x] T071 [P] [US6] Add Staff permission, queue filter/cursor, and private dossier tests in `tests/integration/providers/us6-staff-review-queue.test.ts` (FR-019, FR-020, FR-033, FR-037, FR-080; SC-010).
- [x] T072 [P] [US6] Add approval transaction component/rollback tests in `tests/integration/providers/us6-approval-transaction.test.ts` (FR-011, FR-026, FR-027, FR-085; SC-003, SC-009, SC-011).
- [x] T073 [US6] Add barrier-based repeated/concurrent approval and retry tests asserting exact categories/roles/membership/history/audit/outbox cardinality in `tests/integration/providers/us6-approval-concurrency.test.ts` (FR-026, FR-084; SC-011).
- [x] T074 [P] [US6] Add unit transition tests proving approval cannot set LIVE or later gates in `tests/unit/modules/providers/provider-approval.policy.test.ts` (FR-027–FR-029; SC-009).

### Implementation

- [x] T075 [US6] Implement deterministic Staff queue and dossier reads with default 20/max 100 cursor pagination in `src/modules/providers/provider-review-query.service.ts` and `src/modules/providers/infrastructure/prisma-provider-review.repository.ts` (FR-019, FR-020, FR-080).
- [x] T076 [US6] Implement active Staff permission checks and transaction-time recheck in `src/modules/providers/domain/provider-authorization.policy.ts` and `src/modules/providers/provider-review.service.ts` (FR-019, FR-052, FR-085; SC-010).
- [x] T077 [US6] Implement the Provider-owned approval transaction across Authentication authority participant, OWNER membership, typed history, privileged audit, and approval outbox in `src/modules/providers/provider-approval.service.ts` (FR-011, FR-026, FR-084, FR-085; SC-011).
- [x] T078 [US6] Make approval idempotent only for a complete matching prior outcome and fail closed on incomplete integrity state in `src/modules/providers/provider-approval.service.ts` (FR-026, FR-084; SC-011).
- [x] T079 [US6] Enforce approved `INACTIVE`, no LIVE/public/later-gate promotion, and recomputed readiness in `src/modules/providers/provider-approval.service.ts` (FR-027–FR-029, FR-073; SC-009).
- [x] T080 [US6] Add Staff queue/dossier/approve schemas, handlers, routes, and stable errors in `src/modules/providers/providers.schema.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.routes.ts` (FR-019, FR-020, FR-080, FR-082, FR-086).
- [x] T081 [US6] Ensure approval notification dispatch is post-commit and failure cannot roll back the decision in `src/modules/providers/provider-email-dispatcher.ts` (FR-026, FR-077, FR-086).
- [x] T082 [US6] Run US6 tests three times for concurrency and record atomic component counts/rollback evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 9: User Story 7 — Request Changes and Resubmit (P1)

**Goal**: Staff requests reasoned corrections, reopens only Application Owner
editing, and preserves prior cycle evidence.

**Independent test**: Request changes with/without reason, edit/resubmit, and
verify cycle/history/authority invariants.

### Tests first

- [x] T083 [P] [US7] Add reason/transition/history unit tests in `tests/unit/modules/providers/provider-request-changes.policy.test.ts` (FR-015, FR-021, FR-022, FR-025; SC-003).
- [x] T084 [P] [US7] Add request-changes/edit/resubmit API journey in `tests/integration/providers/us7-request-changes.test.ts` (FR-016, FR-019, FR-021, FR-022, FR-025, FR-048; SC-003, SC-014).

### Implementation

- [x] T085 [US7] Implement required trimmed reason and pending-cycle transition transaction in `src/modules/providers/provider-review.service.ts` (FR-015, FR-019, FR-021, FR-022, FR-025, FR-083).
- [x] T086 [US7] Append immutable prior/next/cycle/actor/reason/time history, privileged audit, and mandatory changes-requested outbox intent in `src/modules/providers/provider-review.service.ts` (FR-025, FR-077, FR-085; SC-003).
- [x] T087 [US7] Add request-changes schema/handler/route in `src/modules/providers/providers.schema.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.routes.ts` (FR-021, FR-080, FR-082).
- [x] T088 [US7] Restore only Application Owner edits/submission without membership/admin availability in `src/modules/providers/domain/provider-authorization.policy.ts` (FR-016, FR-018, FR-022, FR-048, FR-054; SC-014).
- [x] T089 [US7] Run US7 tests and record multi-cycle/history evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 10: User Story 8 — Terminal Rejection (P1)

**Goal**: Staff rejects with reason and permanently blocks restart/resubmission
without creating Provider authority.

**Independent test**: Reject, retry/resubmit/restart/invite, and inspect history
plus absence of category/role/member/invitation effects.

### Tests first

- [x] T090 [P] [US8] Add terminal rejection transition/reason tests in `tests/unit/modules/providers/provider-rejection.policy.test.ts` (FR-015, FR-021, FR-023, FR-024, FR-060).
- [x] T091 [P] [US8] Add rejection API and authority-absence integration tests in `tests/integration/providers/us8-terminal-rejection.test.ts` (FR-019, FR-021, FR-023–FR-025, FR-060; SC-003, SC-014).

### Implementation

- [x] T092 [US8] Implement terminal rejection transaction with typed history, audit, mandatory email intent, and no authority/membership/invitation effects in `src/modules/providers/provider-review.service.ts` (FR-021, FR-023–FR-025, FR-060, FR-077, FR-085).
- [x] T093 [US8] Add reject schema/handler/route with required trimmed reason in `src/modules/providers/providers.schema.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.routes.ts` (FR-021, FR-080, FR-082).
- [x] T094 [US8] Enforce no rejected restart, withdrawal, delete, resubmit, or Provider-management capability in `src/modules/providers/domain/provider-lifecycle.policy.ts` and `src/modules/providers/domain/provider-authorization.policy.ts` (FR-023, FR-024, FR-060).
- [x] T095 [US8] Add explicit repository assertions that rejection writes no role/category/member/invitation in `src/modules/providers/provider-review.service.ts` (FR-060, FR-084).
- [x] T096 [US8] Run US8 tests and record terminal/no-authority evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 11: User Story 9 — Completion, Readiness, Dashboard, Settings (P1)

**Goal**: Expose deterministic completion and cross-phase readiness separately,
plus actionable dashboard/settings projections with no generic settings store.

**Independent test**: Exhaust all 1024 completion combinations, both kinds,
all eleven gates, and next-action states.

### Tests first

- [x] T097 [P] [US9] Add exhaustive 1024-combination completion tests for exactly ten stable 10-point checks in `tests/unit/modules/providers/provider-completion.policy.test.ts` (FR-061–FR-065; SC-006).
- [x] T098 [P] [US9] Add both-kind eleven-gate readiness matrix tests in `tests/unit/modules/providers/provider-readiness.policy.test.ts` (FR-061, FR-066–FR-073; SC-007–SC-009).
- [x] T099 [P] [US9] Add dashboard next-action/settings capability and no-generic-store tests in `tests/unit/modules/providers/provider-dashboard-settings.test.ts` (FR-074–FR-078; SC-015).
- [x] T100 [P] [US9] Add completion/readiness/history/dashboard/settings endpoint integration tests in `tests/integration/providers/us9-projections.test.ts` (FR-064, FR-066–FR-080; SC-006–SC-009, SC-015).

### Implementation

- [x] T101 [P] [US9] Implement pure policy-versioned ten-check calculation in `src/modules/providers/domain/provider-completion.policy.ts` without persisting percentages (FR-061–FR-065; SC-006).
- [x] T102 [P] [US9] Implement pure eleven-gate readiness with Individual NOT_REQUIRED documents, Company R1-P06 blocker, later-phase owners, and public false in `src/modules/providers/domain/provider-readiness.policy.ts` (FR-061, FR-066–FR-073; SC-007–SC-009).
- [x] T103 [US9] Implement bounded history, dashboard, and capability-only settings projections in `src/modules/providers/provider-projection.service.ts` without a settings/notification-preference store (FR-074–FR-078; SC-015).
- [x] T104 [US9] Add completion/readiness/history/dashboard/settings handlers and routes in `src/modules/providers/providers.controller.ts` and `src/modules/providers/providers.routes.ts` (FR-079, FR-082).
- [x] T105 [US9] Run US9 tests and record 1024-case, eleven-gate, and next-action evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 12: User Story 10 — Invite Existing User as Admin (P2)

**Goal**: Approved OWNER manages single-use existing-user invitations and ADMIN
membership without sharing ownership.

**Independent test**: Create/send, inspect, resend, revoke, accept, replay,
disable, and reconcile multi-Provider global role state.

### Tests first

- [x] T106 [P] [US10] Add OWNER/ADMIN capability matrix and membership-role reconciliation tests in `tests/unit/modules/providers/provider-membership.policy.test.ts` (FR-009, FR-048–FR-053).
- [x] T107 [P] [US10] Add invitation token/hash/72-hour/resend/revoke/one-shot-delivery unit tests in `tests/unit/modules/providers/provider-invitation.policy.test.ts` (FR-054–FR-056, FR-086).
- [x] T108 [P] [US10] Add existing-user invite/inspect/accept/list/member-disable API journey in `tests/integration/providers/us10-existing-admin-invitation.test.ts` (FR-048–FR-057, FR-059, FR-081; SC-010, SC-012).
- [x] T109 [US10] Add accept-vs-resend/revoke/replay barriers and multi-Provider role-reconciliation races in `tests/integration/providers/us10-invitation-concurrency.test.ts` (FR-056, FR-057, FR-059, FR-084; SC-012).
- [x] T110 [P] [US10] Add delivery-failure tests proving no raw-token outbox/log/audit/response and resend rotation in `tests/integration/providers/us10-invitation-delivery.test.ts` (FR-055, FR-056, FR-086).

### Implementation

- [x] T111 [US10] Implement exact-provider OWNER/ADMIN authorization and membership capabilities in `src/modules/providers/domain/provider-authorization.policy.ts` (FR-009, FR-048–FR-053; SC-010).
- [x] T112 [US10] Implement keyed verifier generation/constant-time validation, 72-hour expiry, revoke, and resend rotation in `src/modules/providers/domain/provider-invitation.policy.ts` and `src/modules/providers/provider-membership.service.ts` (FR-054–FR-056, FR-059, FR-086).
- [x] T113 [US10] Implement atomic existing-user acceptance and global `provider_admin` reconciliation using the Authentication transaction participant in `src/modules/providers/provider-invitation-acceptance.service.ts` (FR-057, FR-059, FR-084, FR-085; SC-012).
- [x] T114 [US10] Implement ADMIN soft-disable and enable/disable global role only from aggregate active Provider authority in `src/modules/providers/provider-membership.service.ts` (FR-048–FR-053, FR-085).
- [x] T115 [US10] Implement invitation create/resend post-commit one-shot email from process memory, safe `DELIVERED|RESEND_REQUIRED` state, and no durable raw token retry in `src/modules/providers/provider-invitation-delivery.service.ts` (FR-054–FR-056, FR-086).
- [x] T116 [US10] Add invitation/member schemas, token-body-only routes, handlers, rate limits, and safe DTOs in `src/modules/providers/providers.schema.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.routes.ts` (FR-054–FR-057, FR-081, FR-082, FR-086).
- [x] T117 [US10] Run US10 concurrency suites three times and record single-consumption/no-ownership/no-secret evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 13: User Story 11 — Invitation-only New Admin Onboarding (P2)

**Goal**: A new invitee receives a categoryless identity bound to the fixed
invited email, then gains Provider authority only through atomic acceptance.

**Independent test**: Start/verify/accept with fixed email and reject every
changed-email, invalid-state, duplicate, and partial failure path.

### Tests first

- [x] T118 [P] [US11] Add invitation-only identity policy tests for fixed email, required phone/password, null category OTP, restricted accept-only principal, and role-only full login capability with no Authentication-to-Providers dependency in `tests/unit/modules/authentication/provider-admin-invitation-onboarding.test.ts` (FR-010, FR-052, FR-058, FR-059).
- [x] T119 [P] [US11] Add new-user onboarding/verification/acceptance API journey and categoryless persistence assertions in `tests/integration/providers/us11-new-admin-onboarding.test.ts` (FR-055, FR-058, FR-059, FR-081; SC-012).
- [x] T120 [US11] Add identity-create/accept rollback and concurrent verify/accept/revoke/resend tests in `tests/integration/providers/us11-onboarding-concurrency.test.ts` (FR-058, FR-059, FR-084; SC-012).
- [x] T121 [P] [US11] Add secret/privacy failure-path tests for token, password, OTP, private email, and safe mismatch responses in `tests/integration/providers/us11-onboarding-redaction.test.ts` (FR-059, FR-086).

### Implementation

- [x] T122 [US11] Implement Authentication-owned invitation onboarding participant for fixed email, normalized phone, password hash, invitation OTP, restricted accept/session-cleanup principal, and no customer category in `src/modules/authentication/` (FR-010, FR-052, FR-058, FR-086).
- [x] T123 [US11] Implement Provider onboarding orchestration that revalidates the invitation before/after Authentication work and never trusts caller email in `src/modules/providers/provider-invitation-onboarding.service.ts` (FR-058, FR-059, FR-084).
- [x] T124 [US11] Implement atomic new-user invitation acceptance/role/member/audit path using existing Provider and Authentication transaction participants in `src/modules/providers/provider-invitation-acceptance.service.ts` (FR-057–FR-059, FR-084, FR-085; SC-012).
- [x] T125 [US11] Update login-capability evaluation in `src/modules/authentication/` so a verified categoryless identity becomes fully usable from Authentication's enabled `provider_admin` role after atomic acceptance, while exact membership remains checked only by Providers and no reverse module dependency is introduced (FR-052, FR-058, FR-059).
- [x] T126 [US11] Add inspect/onboarding-start/verify-email/accept strict schemas and POST-body-only token handlers in `src/modules/providers/providers.schema.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.routes.ts` (FR-058, FR-059, FR-081, FR-082, FR-086).
- [x] T127 [US11] Add bounded invitation inspection/onboarding/OTP rate limits in `src/modules/providers/providers.routes.ts` using repository-standard middleware (FR-059, FR-086).
- [x] T128 [US11] Run US11 concurrency suites three times and record categoryless/fixed-email/atomic-acceptance evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 14: User Story 12 — Scope and Contact Privacy (P1)

**Goal**: Fail closed across Providers and preserve zero direct-contact exposure
in every preview/customer-shaped representation.

**Independent test**: Use two Providers and all actor types, tamper all scope
inputs, inspect DTOs/logs/errors, and prove no anonymous Browse routes exist.

### Tests first

- [x] T129 [P] [US12] Add exhaustive actor/Provider/operation authorization matrix tests in `tests/unit/modules/providers/provider-authorization-matrix.test.ts` (FR-037, FR-048–FR-053; SC-010).
- [x] T130 [P] [US12] Add two-Provider cross-scope and caller-claim tampering tests in `tests/integration/providers/us12-scope-isolation.test.ts` (FR-052, FR-053; SC-010).
- [x] T131 [P] [US12] Add recursive DTO/OpenAPI/runtime/log/error field-inventory tests in `tests/integration/providers/us12-contact-secret-redaction.test.ts` (FR-036–FR-039, FR-086; SC-004).
- [x] T132 [P] [US12] Add route-manifest tests proving no anonymous Browse/Provider Details endpoint in `tests/integration/providers/us12-negative-surface.test.ts` (FR-039; SC-004).

### Implementation

- [x] T133 [US12] Centralize active identity/global-role/exact-membership/level/state checks in `src/modules/providers/domain/provider-authorization.policy.ts` and remove any handler-local trust of caller scope facts (FR-037, FR-048–FR-053; SC-010).
- [x] T134 [US12] Apply one allowlisted contact-free preview mapper across protected preview and future public-contract projections in `src/modules/providers/provider.dto.ts` and `src/modules/providers/providers.public.ts` (FR-036–FR-039, FR-086; SC-004).
- [x] T135 [US12] Apply consistent cross-provider safe-denial and denial-audit behavior in `src/modules/providers/providers.controller.ts` and `src/modules/providers/provider-denial-audit.service.ts` (FR-052, FR-053, FR-085, FR-086; SC-010).
- [x] T136 [US12] Verify route composition in `src/routes/index.ts` exposes only authenticated Provider/token/Staff routes and no R1-P05 anonymous browse router (FR-039).
- [x] T137 [US12] Run US12 tests and record zero-contact/zero-public-route/cross-scope evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 15: User Story 13 — Legacy Provider Owner Recovery (P2)

**Goal**: Legacy owner-only identities follow the normal verified Individual or
Company eligibility path and cannot bypass application review.

**Independent test**: Deny owner-only, then verify each approved customer path
enables only its matching kind.

### Tests first

- [x] T138 [P] [US13] Add owner-only legacy eligibility and both recovery-path unit tests in `tests/unit/modules/providers/legacy-provider-owner.policy.test.ts` (FR-010–FR-012; SC-001).
- [x] T139 [P] [US13] Add enrollment/profile/application recovery integration journeys in `tests/integration/providers/us13-legacy-provider-owner.test.ts` (FR-010–FR-012; SC-001).

### Implementation

- [x] T140 [US13] Enforce matching verified Individual/Company facts independent of legacy Provider Owner category in `src/modules/providers/domain/provider-eligibility.policy.ts` (FR-002, FR-010–FR-012).
- [x] T141 [US13] Return safe actionable Individual-or-Company eligibility blockers in `src/modules/providers/provider-application.service.ts` and `src/modules/providers/provider.dto.ts` without revealing private profile data (FR-012, FR-086).
- [x] T142 [US13] Confirm ordinary Authentication enrollment supports only Individual/Company/Engineer and never Provider Owner in `src/modules/authentication/auth.schema.ts` and `src/modules/authentication/domain/auth.policy.ts` (FR-010–FR-012).
- [x] T143 [US13] Run US13 tests and record both recovery paths/no-bypass evidence in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`.

---

## Phase 16: Operational lifecycle and cross-cutting completion

**Purpose**: Complete Staff suspension/reinstatement, synchronize contracts, and
run all release gates after all user stories are independently green.

### Tests first

- [x] T144 [P] Add suspend/reinstate reason, permission, history, management-remediation, and never-LIVE tests in `tests/unit/modules/providers/provider-operational-lifecycle.test.ts` and `tests/integration/providers/operational-lifecycle.test.ts` (FR-019, FR-021, FR-025, FR-028–FR-030, FR-085; SC-003, SC-009).
- [x] T145 [P] Add mandatory six-template outbox fixed-delay/fifth-attempt-FAILED/idempotency/lease tests and invitation-exclusion assertions in `tests/integration/providers/provider-email-outbox.test.ts` (FR-077, FR-078, FR-084, FR-086).
- [x] T146 [P] Add runtime Swagger/source OpenAPI parity and stable envelope/error tests in `tests/integration/providers/provider-openapi-contract.test.ts` and `tests/integration/swagger-docs.test.ts` (FR-079–FR-082, FR-086).
- [x] T147 [P] Add Postman collection validation and safe example assertions in `tests/unit/scripts/generate-r1-p05-postman.test.ts` (FR-079–FR-082, FR-086).
- [x] T148 Add a full sequential Supertest acceptance journey in `tests/integration/providers/r1-p05-acceptance.test.ts` covering SC-001–SC-015; do not add a nonexistent `test:e2e` script.

### Implementation and documentation

- [x] T149 Implement Staff-only reasoned suspend/reinstate transactions, typed history, audit/outbox, management-remediation access, and `SUSPENDED -> INACTIVE` in `src/modules/providers/provider-lifecycle.service.ts` (FR-019, FR-021, FR-025, FR-028–FR-030, FR-077, FR-085; SC-003, SC-009).
- [x] T150 Add suspend/reinstate schemas, handlers, and routes in `src/modules/providers/providers.schema.ts`, `src/modules/providers/providers.controller.ts`, and `src/modules/providers/providers.routes.ts` (FR-030, FR-080, FR-082).
- [x] T151 Synchronize the implemented source contract to `docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml` and `src/swagger/openapi.document.ts`, including all stable methods/statuses/errors and the negative public surface (FR-079–FR-082, FR-086).
- [x] T152 Generate and validate R1-P05 requests/examples in `docs/apis/postman/Cleanora-R1-P05.postman_collection.json` and update `scripts/generate-r1-p05-postman.ts` without embedding credentials/tokens/private contacts (FR-079–FR-082, FR-086).
- [x] T153 Update `docs/product/decision-log.md`, `docs/product/current.md`, `docs/product/roadmap.md`, and `docs/README.md` only with verified implementation/test evidence; do not activate the next phase or claim deployment.
- [x] T154 [P] Run each focused Provider concurrency suite three consecutive times and preserve deterministic row/effect assertions in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md` (FR-084; SC-002, SC-011, SC-012).
- [x] T155 Run `npm run prisma:validate`, `npm run prisma:generate`, and `npm run db:validate-clean-migration` sequentially and record exact results in `specs/R1-P05-provider-onboarding-profile-lifecycle/completion-report.md`.
- [x] T156 Run `npm run test:unit`, `npm run test:integration`, and `npm run test:coverage` sequentially and record exact counts/coverage in `specs/R1-P05-provider-onboarding-profile-lifecycle/completion-report.md`.
- [x] T157 Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm run docs:check`, `npm run openapi:validate`, `npm run postman:validate`, and `git diff --check`; record exact results in `specs/R1-P05-provider-onboarding-profile-lifecycle/completion-report.md`.
- [x] T158 Perform an independent active-spec/diff/module-boundary/security review and resolve every verified blocker/major finding in `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-review-report.md` before completion is considered.
- [x] T159 Verify every task is checked, SC-001–SC-015 have concrete evidence, no future-phase/public-contact behavior was added, and update `specs/R1-P05-provider-onboarding-profile-lifecycle/activation.md` to Complete only after explicit human approval.

---

## Dependencies and execution order

1. Phase 1 precedes Phase 2.
2. Phase 2 blocks every user story.
3. Implement user stories in dependency order: US1 → US2 → US3 → US4 → US5
   → US6 → US7 → US8 → US9 → US10 → US11 → US12 → US13. US12 is P1
   security acceptance that is implemented incrementally in US3/US6 and closes
   only after US10/US11 exist, because its complete actor matrix includes both
   existing-user and invitation-onboarded ADMINs; P2 behavior cannot weaken its
   already-enforced P1 privacy/scope rules.
4. US7 reuses the submission behavior from US5. US10 requires US6 approval and
   foundational Authentication authority. US11 extends US10 token/acceptance.
5. Phase 16 begins only after US1–US13 are independently green.
6. Within every story: tests first and failing for the missing behavior; domain
   policy before service; persistence/ports before controller/routes; focused
   validation before the checkpoint.

Database-backed suites and the complete validation commands run sequentially.
`[P]` never authorizes overlapping database suites against the shared proof DB.

## Requirement traceability

| Requirement set | Primary tasks |
|---|---|
| FR-001–FR-009 | T026–T040, T106, T111 |
| FR-010–FR-012 | T009, T015–T017, T118, T122, T138–T143 |
| FR-013–FR-018 | T026–T032, T063–T070 |
| FR-019–FR-030 | T014, T071–T096, T144, T149–T150 |
| FR-031–FR-039 | T018–T019, T041–T050, T129–T137 |
| FR-040–FR-047 | T010, T020, T051–T062 |
| FR-048–FR-060 | T069, T090–T095, T106–T128 |
| FR-061–FR-073 | T097–T105 |
| FR-074–FR-078 | T024, T099–T105, T145 |
| FR-079–FR-082 | T001–T006, endpoint tasks, T146–T152 |
| FR-083–FR-086 | T004, T007–T024, concurrency/redaction tasks, T145–T158 |
| SC-001–SC-005 | T026–T033, T051–T062, T129–T137, T148 |
| SC-006–SC-010 | T071–T082, T097–T105, T129–T137, T144, T148 |
| SC-011–SC-015 | T063–T082, T097–T105, T106–T128, T148, T154–T159 |

## Parallel opportunities

- T003 and T004 may proceed after contract registration without touching the
  same files.
- Foundation test tasks T007–T011 may be authored in parallel, then all must
  fail for the intended missing behavior before T012–T024.
- Within each story, only tasks explicitly marked `[P]` may be parallelized.
- Pure completion/readiness policies T101/T102 are independent after their tests.
- Documentation generators/tests T146/T147 may proceed in parallel after all
  endpoint contracts stabilize.

## Final stop rule

Task generation ends here. The next Spec Kit step after clean analysis is
`/speckit-implement`, but it must not run as part of specification, clarification,
planning, task generation, or analysis. Commit/push/merge/deploy/production
migration also remain outside this handoff.

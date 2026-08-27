# Tasks: Worker, Team & Crew Management

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [test-strategy.md](./test-strategy.md)

**Tests**: Required by the specification and Constitution. Within each story,
focused tests are written before the behavior they prove.

**Organization**: Setup → blocking foundations → eight independently testable
user-story slices → cross-cutting proof. `[P]` appears only where paths and
dependencies permit parallel work.

## Phase 1: Setup and phase tooling

**Purpose**: Establish R1-P07-specific test/contract tooling without product behavior.

- [x] T001 Add the phase-scoped Vitest include/exclude and coverage configuration in `vitest.r1-p07.config.ts` (Refs: SC-003–SC-014)
- [x] T002 Add R1-P07 test, coverage, Postman, and safe migration-validation script entries in `package.json` (Refs: SC-003–SC-014)
- [x] T003 [P] Add shared R1-P07 PostgreSQL fixture builders and deterministic cleanup helpers in `tests/helpers/r1-p07-workforce-fixtures.ts` (Refs: FR-001–FR-088)
- [x] T004 [P] Add Authentication/Media/Admin contract fakes for workforce tests in `tests/helpers/r1-p07-workforce-contract-fakes.ts` (Refs: FR-018, FR-025, FR-029–FR-031, FR-040, FR-087)
- [x] T005 [P] Add safe request/logger capture utilities that fail on phone/proof/credential markers in `tests/helpers/r1-p07-sensitive-output-assertions.ts` (Refs: FR-028, FR-080, FR-085, FR-087; SC-012)
- [x] T006 [P] Add R1-P07 OpenAPI operation inventory helper in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-001–FR-088)
- [x] T007 Add R1-P07 implementation-evidence command order and disposable-target safeguards in `specs/R1-P07-worker-team-crew-management/quickstart.md` (Refs: SC-003–SC-014)

**Checkpoint**: Phase-specific tooling exists; no business route is mounted.

---

## Phase 2: Foundational data, contracts, transaction, and policies

**Purpose**: Blocking foundations required by every user story.

**⚠️ CRITICAL**: No story implementation begins until this phase is complete.

- [x] T008 Add only the approved R1-P07 enums, models, relations, and `ProviderMember.version` to `prisma/schema.prisma` (Refs: FR-001–FR-088)
- [x] T009 Create and line-review the forward-only R1-P07 SQL with partial indexes, checks, FKs, and deferred constraints in `prisma/migrations/r1_p07_worker_team_crew_management/migration.sql` (Refs: FR-004, FR-056, FR-057, FR-059, FR-061, FR-063–FR-065, FR-076–FR-078; SC-009–SC-011)
- [x] T010 [P] Write failing database-constraint tests for current engagement, current membership, Team name, Escort, Supervisor, and positive-version invariants in `tests/integration/providers/r1-p07-workforce-constraints.test.ts` (Refs: FR-004, FR-056, FR-059, FR-061, FR-064; SC-009)
- [x] T011 Define Worker identity/preference/onboarding/role/proof public contracts in `src/modules/authentication/authentication.public.ts` (Refs: FR-003, FR-012, FR-018, FR-033, FR-040, FR-070, FR-084)
- [x] T012 [P] Define Worker avatar receipt/processing/delivery/transactional authorization public contracts in `src/modules/media/media.public.ts` (Refs: FR-029–FR-031)
- [x] T013 [P] Extend Providers public readiness and Booking-safe Team fact contracts in `src/modules/providers/providers.public.ts` (Refs: FR-055, FR-069–FR-075)
- [x] T014 Write failing public-contract boundary tests for Authentication, Media, Admin audit, and Providers exports in `tests/unit/modules/r1-p07-public-contracts.test.ts` (Refs: FR-018, FR-029–FR-035, FR-070, FR-087)
- [x] T015 Implement transaction-bound Worker identity/preference/role/proof adapters in `src/modules/authentication/infrastructure/prisma-worker-workforce.adapters.ts` (Refs: FR-003, FR-018, FR-033–FR-040, FR-070, FR-084)
- [x] T016 Implement Worker invitation restricted-onboarding adapter without Providers repository access in `src/modules/authentication/infrastructure/prisma-worker-invitation-onboarding.ts` (Refs: FR-012, FR-016–FR-020)
- [x] T017 Implement Worker avatar processing/ownership/delivery adapters through Media policy in `src/modules/media/infrastructure/worker-avatar.adapter.ts` (Refs: FR-029–FR-031)
- [x] T018 Add Worker avatar owner-type and processing policy definitions in `src/modules/media/domain/media.types.ts` (Refs: FR-029–FR-031)
- [x] T019 Define Providers workforce types, states, commands, reason unions, safe facts, and ports in `src/modules/providers/domain/provider-workforce.types.ts` (Refs: FR-001–FR-088)
- [x] T020 [P] Implement Worker/Team lifecycle, completeness, reason, Escort, Supervisor, and readiness pure policies in `src/modules/providers/domain/provider-workforce.policy.ts` (Refs: FR-021–FR-023, FR-037, FR-042–FR-046, FR-052–FR-075, FR-081–FR-083)
- [x] T021 [P] Implement locale resolution and safe notification-template policy in `src/modules/providers/domain/provider-workforce-notification.policy.ts` (Refs: FR-011, FR-049, FR-084–FR-086)
- [x] T022 [P] Implement domain-separated invitation proof issue/verify policy interface in `src/modules/providers/domain/worker-invitation-proof.policy.ts` (Refs: FR-013–FR-016, FR-028)
- [x] T023 Implement Prisma workforce aggregate repository and fixed row-lock queries in `src/modules/providers/infrastructure/prisma-provider-workforce.repository.ts` (Refs: FR-001–FR-088)
- [x] T024 Implement Providers-owned workforce unit of work with injected transaction-bound public factories in `src/modules/providers/infrastructure/prisma-providers-workforce.unit-of-work.ts` (Refs: FR-018, FR-031, FR-033, FR-040, FR-051, FR-076–FR-087)
- [x] T025 [P] Implement workforce command idempotency and safe-result persistence in `src/modules/providers/infrastructure/prisma-provider-workforce-command.repository.ts` (Refs: FR-076–FR-078; SC-010–SC-011)
- [x] T026 [P] Implement immutable safe workforce history persistence in `src/modules/providers/infrastructure/prisma-provider-workforce-history.repository.ts` (Refs: FR-007–FR-008, FR-043, FR-047–FR-051, FR-059, FR-068, FR-079–FR-080, FR-087)
- [x] T027 [P] Implement workforce notification-intent lease/retry repository in `src/modules/providers/infrastructure/prisma-provider-workforce-notification.repository.ts` (Refs: FR-049, FR-084–FR-086)
- [x] T028 Implement HMAC invitation proof adapter using existing `AUTH_VERIFIER_SECRET` and no new configuration in `src/modules/providers/infrastructure/worker-invitation-proof.adapter.ts` (Refs: FR-013–FR-016, FR-028)
- [x] T029 Implement Providers workforce notification dispatcher on the existing SMTP delivery adapter in `src/modules/providers/provider-workforce-notification.dispatcher.ts` (Refs: FR-049, FR-084–FR-086; SC-014)
- [x] T030 Define complete Zod param/query/body schemas and action-specific reason validation in `src/modules/providers/provider-workforce.schema.ts` (Refs: FR-021–FR-024, FR-040–FR-046, FR-052, FR-056–FR-057, FR-076, FR-081–FR-084)
- [x] T031 Define role-specific private/safe/history/readiness DTO mappers with forbidden-field allowlists in `src/modules/providers/provider-workforce.dto.ts` (Refs: FR-025–FR-028, FR-069–FR-075, FR-079–FR-080, FR-087–FR-088)

**Checkpoint**: Schema, module contracts, transaction ownership, repositories,
policies, and test infrastructure are ready; story behavior can begin.

---

## Phase 3: User Story 1 — Create a Worker Profile and invite the person (P1) 🎯 MVP

**Goal**: Owner/Admin creates a Provider-owned draft; Owner issues localized access without choosing a password.

**Independent Test**: Create a complete draft without User identity, issue one Owner-authorized invitation, and prove exact scope, step-up, safe evidence, and no Provider-selected password.

### Tests first

- [x] T032 [P] [US1] Write failing Worker-profile completeness, E.164, type, gender, normalization, and idempotency unit tests in `tests/unit/providers/provider-worker-profile.policy.test.ts` (Refs: FR-001–FR-002, FR-021–FR-024, FR-052, FR-057, FR-076–FR-078)
- [x] T033 [P] [US1] Write failing Owner/Admin/cross-Provider create-profile integration tests in `tests/integration/providers/provider-worker-create.test.ts` (Refs: FR-001–FR-002, FR-006, FR-033–FR-036, FR-088)
- [x] T034 [P] [US1] Write failing Owner-only issue-invitation, step-up, locale/version, audit, and outbox tests in `tests/integration/providers/provider-worker-invitation-issue.test.ts` (Refs: FR-010–FR-011, FR-040, FR-076–FR-087)
- [x] T035 [P] [US1] Write failing create/list/detail HTTP contract tests in `tests/integration/http/provider-workers-create-read.test.ts` (Refs: FR-001–FR-002, FR-021–FR-028, FR-088; SC-001, SC-005–SC-006)
- [x] T036 [P] [US1] Write failing Worker avatar input/private-association tests in `tests/integration/media/provider-worker-avatar.test.ts` (Refs: FR-023, FR-029–FR-031)

### Implementation

- [x] T037 [US1] Implement draft Worker create/profile replace/skill normalization use cases in `src/modules/providers/provider-workforce.service.ts` (Refs: FR-001–FR-002, FR-021–FR-024, FR-052–FR-057, FR-076–FR-080)
- [x] T038 [US1] Implement Owner-only invitation issue command with proof recheck, immutable locale, history, audit, and intent in `src/modules/providers/provider-workforce-invitation.service.ts` (Refs: FR-010–FR-011, FR-040, FR-076–FR-087)
- [x] T039 [US1] Implement two-stage Worker avatar ingest/READY association/removal orchestration in `src/modules/providers/provider-workforce-media.service.ts` (Refs: FR-029–FR-031, FR-041, FR-076–FR-080)
- [x] T040 [US1] Implement Worker create/read/profile/avatar controller methods in `src/modules/providers/provider-workforce.controller.ts` (Refs: FR-001–FR-002, FR-021–FR-031, FR-088)
- [x] T041 [US1] Mount Provider Worker collection/detail/avatar routes with Zod and trusted principal in `src/modules/providers/provider-workforce.routes.ts` (Refs: FR-001–FR-002, FR-025–FR-031, FR-033–FR-041)
- [x] T042 [US1] Add create/read/avatar operations to runtime R1-P07 OpenAPI fragments in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-001–FR-002, FR-021–FR-031)
- [x] T043 [US1] Prove SC-001 three-minute journey measurement excluding email delivery in `tests/integration/http/provider-worker-create-invite-timing.test.ts` (Refs: SC-001)
- [x] T044 [US1] Run and fix the independently scoped US1 suites documented in `tests/integration/providers/provider-worker-invitation-issue.test.ts` (Refs: FR-001–FR-002, FR-010–FR-011, FR-021–FR-031, SC-001)

**Checkpoint**: A Provider can record a safe draft and issue a localized invitation without an existing account.

---

## Phase 4: User Story 2 — Accept, resend, expire, or revoke an invitation (P1)

**Goal**: Latest invitation version safely links a new/existing identity and activates Worker access.

**Independent Test**: Accept as new and existing users; reject expired/revoked/superseded/cross-Provider races with zero partial state.

### Tests first

- [x] T045 [P] [US2] Write failing invitation proof generation, constant-time verification, expiry, version, and redaction unit tests in `tests/unit/providers/worker-invitation-proof.test.ts` (Refs: FR-013–FR-016, FR-028)
- [x] T046 [P] [US2] Write failing resend/revoke/expire/accept race and idempotency integration tests in `tests/integration/providers/provider-worker-invitation-lifecycle.test.ts` (Refs: FR-013–FR-020, FR-076–FR-080; SC-003, SC-010–SC-011)
- [x] T047 [P] [US2] Write failing new-user password/email onboarding integration tests in `tests/integration/authentication/worker-invitation-new-user.test.ts` (Refs: FR-011–FR-012, FR-016–FR-018, FR-020)
- [x] T048 [P] [US2] Write failing existing-user/Customer-role-preservation tests in `tests/integration/authentication/worker-invitation-existing-user.test.ts` (Refs: FR-003, FR-009, FR-012, FR-018)
- [x] T049 [P] [US2] Write failing cross-Provider identity-claim concurrency test in `tests/integration/providers/provider-worker-identity-claim-race.test.ts` (Refs: FR-004–FR-006, FR-020; SC-009, SC-011)
- [x] T050 [P] [US2] Write failing invitation inspect/onboarding/verify/accept HTTP tests in `tests/integration/http/worker-invitations.test.ts` (Refs: FR-012–FR-020, FR-028; SC-002–SC-003)
- [x] T051 [P] [US2] Write failing locale preference/accepted-version/AR fallback and delivery-failure tests in `tests/integration/providers/provider-worker-notification-locale.test.ts` (Refs: FR-084–FR-086; SC-014)

### Implementation

- [x] T052 [US2] Implement resend/revoke/expiry transitions and replacement-version invalidation in `src/modules/providers/provider-workforce-invitation.service.ts` (Refs: FR-013–FR-016, FR-019–FR-020, FR-076–FR-080)
- [x] T053 [US2] Implement latest-proof inspection and safe invitation projection in `src/modules/providers/provider-workforce-invitation-query.service.ts` (Refs: FR-013–FR-016, FR-028, FR-088)
- [x] T054 [US2] Implement atomic invitation acceptance, identity claim, phone review, access activation, and Worker-role reconciliation in `src/modules/providers/provider-workforce-invitation-acceptance.service.ts` (Refs: FR-003–FR-006, FR-012, FR-016–FR-020, FR-024, FR-076–FR-087)
- [x] T055 [US2] Implement Worker onboarding start/verify composition over Authentication public contracts in `src/modules/providers/provider-workforce-onboarding.service.ts` (Refs: FR-011–FR-012, FR-016–FR-020)
- [x] T056 [US2] Implement public/restricted invitation controller methods with secret-safe errors in `src/modules/providers/provider-workforce-invitation.controller.ts` (Refs: FR-012–FR-020, FR-028)
- [x] T057 [US2] Mount the four independent Worker invitation routes before ordinary Provider routes in `src/modules/providers/provider-workforce-invitation.routes.ts` (Refs: FR-012–FR-020)
- [x] T058 [US2] Add invitation operations and write-only secret schemas to runtime R1-P07 OpenAPI in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-012–FR-020, FR-028)
- [x] T059 [US2] Prove SC-002 first-attempt/two-minute acceptance harness excluding email delivery in `tests/integration/http/worker-invitation-acceptance-timing.test.ts` (Refs: SC-002)
- [x] T060 [US2] Run and fix independently scoped US2 invitation/Auth/HTTP suites in `tests/integration/http/worker-invitations.test.ts` (Refs: FR-003–FR-006, FR-011–FR-020, FR-084–FR-086, SC-002–SC-003)

**Checkpoint**: Latest-version invitation onboarding is safe, idempotent, localized, and identity-correct.

---

## Phase 5: User Story 3 — Manage Worker lifecycle and access safely (P1)

**Goal**: Owner/Admin manage operational status while Owner controls removal/access/Admin authority.

**Independent Test**: Exercise every allowed/denied transition, reason catalog, step-up, separate role relationship, and stale command.

### Tests first

- [x] T061 [P] [US3] Write failing Worker and login-access transition-matrix unit tests in `tests/unit/providers/provider-worker-lifecycle.policy.test.ts` (Refs: FR-019, FR-042–FR-048; SC-004)
- [x] T062 [P] [US3] Write failing five action-specific reason-catalog and note-rule unit tests in `tests/unit/providers/provider-workforce-reasons.test.ts` (Refs: FR-045–FR-046, FR-081–FR-083; SC-013)
- [x] T063 [P] [US3] Write failing recent-auth purpose/age/target/one-use tests in `tests/integration/authentication/worker-sensitive-action-proof.test.ts` (Refs: FR-040–FR-041; SC-013)
- [x] T064 [P] [US3] Write failing lifecycle/access/Admin authority integration tests in `tests/integration/providers/provider-worker-lifecycle-access.test.ts` (Refs: FR-032–FR-049, FR-076–FR-087)
- [x] T065 [P] [US3] Write failing stale/competing lifecycle/idempotency concurrency tests in `tests/integration/providers/provider-worker-lifecycle-concurrency.test.ts` (Refs: FR-076–FR-080; SC-010–SC-011)
- [x] T066 [P] [US3] Write failing lifecycle/access/Admin HTTP actor/error tests in `tests/integration/http/provider-worker-commands.test.ts` (Refs: FR-033–FR-049, FR-076–FR-088; SC-004–SC-005, SC-013)

### Implementation

- [x] T067 [US3] Implement activate/deactivate/reactivate transitions with reasons and exact-version CAS in `src/modules/providers/provider-workforce-lifecycle.service.ts` (Refs: FR-042–FR-046, FR-050–FR-051, FR-074–FR-083)
- [x] T068 [US3] Implement Owner-only removal atomic set with proof, membership/access end, history, audit, readiness, and intent in `src/modules/providers/provider-workforce-lifecycle.service.ts` (Refs: FR-007–FR-009, FR-035, FR-040, FR-043, FR-046–FR-051, FR-074–FR-087)
- [x] T069 [US3] Implement Owner-only login-access reset/revoke commands and role reconciliation in `src/modules/providers/provider-workforce-access.service.ts` (Refs: FR-009–FR-010, FR-019, FR-035, FR-040, FR-076–FR-087)
- [x] T070 [US3] Implement Owner-only Admin grant/revoke with versioned ProviderMember and role reconciliation in `src/modules/providers/provider-workforce-authority.service.ts` (Refs: FR-032–FR-040, FR-076–FR-087)
- [x] T071 [US3] Add lifecycle/access/Admin command methods and stable error mapping in `src/modules/providers/provider-workforce.controller.ts` (Refs: FR-033–FR-049, FR-076–FR-088)
- [x] T072 [US3] Mount lifecycle/access/Admin command routes in `src/modules/providers/provider-workforce.routes.ts` (Refs: FR-033–FR-049)
- [x] T073 [US3] Add lifecycle/access/Admin operations to runtime R1-P07 OpenAPI in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-033–FR-049, FR-081–FR-083)
- [x] T074 [US3] Add safe lifecycle/access/Admin templates to Provider email rendering in `src/modules/providers/infrastructure/provider-invitation-email.adapter.ts` (Refs: FR-049, FR-084–FR-086)
- [x] T075 [US3] Prove accepted and denied high-risk audit allowlists in `tests/integration/providers/provider-workforce-audit.test.ts` (Refs: FR-079–FR-080, FR-087; SC-012–SC-013)
- [x] T076 [US3] Run and fix independently scoped US3 policy/Auth/Providers/HTTP suites in `tests/integration/http/provider-worker-commands.test.ts` (Refs: FR-019, FR-032–FR-051, FR-076–FR-087, SC-004–SC-005, SC-010–SC-013)

**Checkpoint**: Operational lifecycle, access, and Admin authority remain separate and auditable.

---

## Phase 6: User Story 4 — Create and maintain operational Teams (P1)

**Goal**: Owner/Admin create, activate, edit, populate, supervise, move, and archive valid Teams.

**Independent Test**: Create empty draft, add valid cleaner, activate, assign/clear eligible Supervisor, move member, and archive with retained history.

### Tests first

- [x] T077 [P] [US4] Write failing Team lifecycle/name normalization and activation policy tests in `tests/unit/providers/provider-team.policy.test.ts` (Refs: FR-060–FR-068; SC-004, SC-009)
- [x] T078 [P] [US4] Write failing membership uniqueness/move/history database tests in `tests/integration/providers/provider-team-membership.test.ts` (Refs: FR-054–FR-055, FR-059, FR-068–FR-069; SC-009)
- [x] T079 [P] [US4] Write failing primary-Supervisor eligibility/assignment/clear tests in `tests/integration/providers/provider-team-supervisor.test.ts` (Refs: FR-053, FR-064–FR-066)
- [x] T080 [P] [US4] Write failing Team CRUD/lifecycle/membership/Supervisor HTTP tests in `tests/integration/http/provider-teams.test.ts` (Refs: FR-036–FR-037, FR-059–FR-069; SC-004–SC-005, SC-009)

### Implementation

- [x] T081 [US4] Implement Team draft/name/lifecycle/activation/archive use cases in `src/modules/providers/provider-team.service.ts` (Refs: FR-060–FR-068, FR-076–FR-080)
- [x] T082 [US4] Implement add/remove/move/current-membership commands with history in `src/modules/providers/provider-team-membership.service.ts` (Refs: FR-054–FR-055, FR-059, FR-067–FR-069, FR-076–FR-080)
- [x] T083 [US4] Implement eligible primary-Supervisor assign/clear and role reconciliation in `src/modules/providers/provider-team-supervisor.service.ts` (Refs: FR-053, FR-064–FR-066, FR-076–FR-080)
- [x] T084 [US4] Implement Team list/detail/history role-specific DTO queries in `src/modules/providers/provider-team-query.service.ts` (Refs: FR-025–FR-028, FR-037, FR-059, FR-064, FR-069, FR-079, FR-088)
- [x] T085 [US4] Add Team CRUD/lifecycle/membership/Supervisor/history controller methods in `src/modules/providers/provider-workforce.controller.ts` (Refs: FR-036–FR-037, FR-059–FR-069)
- [x] T086 [US4] Mount Team route family with validated commands and cursor reads in `src/modules/providers/provider-workforce.routes.ts` (Refs: FR-036–FR-037, FR-059–FR-069, FR-076)
- [x] T087 [US4] Add Team operations to runtime R1-P07 OpenAPI fragments in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-059–FR-069)
- [x] T088 [US4] Add Provider/Authentication composition factories for Team Supervisor role reconciliation in `src/composition.ts` (Refs: FR-053, FR-064–FR-066)
- [x] T089 [US4] Prove archive keeps Worker lifecycle and historical membership references in `tests/integration/providers/provider-team-archive.test.ts` (Refs: FR-059, FR-067–FR-068)
- [x] T090 [US4] Run and fix independently scoped US4 Team suites in `tests/integration/http/provider-teams.test.ts` (Refs: FR-036–FR-037, FR-053–FR-069, SC-004–SC-005, SC-009)

**Checkpoint**: Team lifecycle and membership history work without changing Worker lifecycle.

---

## Phase 7: User Story 5 — Preserve Team validity when Workers change (P1)

**Goal**: Final-cleaner and primary-Supervisor effects are warned, authorized, atomic, and race-safe.

**Independent Test**: Supervisor command conflicts; Owner/Admin confirmed change updates all affected truth or none.

### Tests first

- [x] T091 [P] [US5] Write failing primary-Supervisor final-cleaner denial unit tests in `tests/unit/providers/provider-final-cleaner.policy.test.ts` (Refs: FR-037, FR-050–FR-051)
- [x] T092 [P] [US5] Write failing Owner/Admin confirmed membership+Team atomic integration tests in `tests/integration/providers/provider-final-cleaner-atomicity.test.ts` (Refs: FR-050–FR-051, FR-063, FR-076–FR-080; SC-008, SC-011)
- [x] T093 [P] [US5] Write failing deactivation/removal/departure final-cleaner atomic tests in `tests/integration/providers/provider-worker-team-impact.test.ts` (Refs: FR-047–FR-051, FR-065–FR-066, FR-074–FR-075; SC-007–SC-008)
- [x] T094 [P] [US5] Write failing cancellation/stale/competing lock-wave tests in `tests/integration/providers/provider-final-cleaner-concurrency.test.ts` (Refs: FR-051, FR-076–FR-078; SC-010–SC-011)
- [x] T095 [P] [US5] Write failing warning/confirmation/conflict HTTP tests in `tests/integration/http/provider-team-impact-commands.test.ts` (Refs: FR-050–FR-051, FR-074–FR-075; SC-008)

### Implementation

- [x] T096 [US5] Implement shared locked Team-impact evaluation and safe warning projection in `src/modules/providers/provider-workforce-impact.service.ts` (Refs: FR-050, FR-063, FR-065–FR-066, FR-074)
- [x] T097 [US5] Implement Supervisor final-cleaner conflict and Owner/Admin confirmed membership+Team atomic command in `src/modules/providers/provider-team-membership.service.ts` (Refs: FR-037, FR-050–FR-051, FR-076–FR-080)
- [x] T098 [US5] Integrate Team-impact atomicity into Worker lifecycle/removal paths in `src/modules/providers/provider-workforce-lifecycle.service.ts` (Refs: FR-047–FR-051, FR-065–FR-066, FR-074–FR-075)
- [x] T099 [US5] Add explicit impact confirmation fields and safe conflict details to Zod/domain mapping in `src/modules/providers/provider-workforce.schema.ts` (Refs: FR-050–FR-051, FR-074–FR-078)
- [x] T100 [US5] Add final-cleaner/readiness impact responses to runtime R1-P07 OpenAPI in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-050–FR-051, FR-074–FR-075)
- [x] T101 [US5] Prove separate immutable history/audit rows for each atomic changed truth in `tests/integration/providers/provider-workforce-impact-history.test.ts` (Refs: FR-051, FR-079–FR-080, FR-087; SC-013)
- [x] T102 [US5] Run and fix independently scoped US5 atomicity/concurrency/HTTP suites in `tests/integration/http/provider-team-impact-commands.test.ts` (Refs: FR-037, FR-047–FR-051, FR-063–FR-066, FR-074–FR-080, SC-007–SC-008, SC-010–SC-011)

**Checkpoint**: No allowed race leaves an active Team without a valid cleaner or partial evidence.

---

## Phase 8: User Story 6 — Enforce scoped authority and Worker privacy (P2)

**Goal**: Every actor receives only approved operations and role-specific data.

**Independent Test**: Compare identical requests as Owner/Admin/Supervisor/self/ordinary Worker/Customer/cross-Provider.

### Tests first

- [x] T103 [P] [US6] Write failing exhaustive authorization-matrix table tests in `tests/unit/providers/provider-workforce-authorization.policy.test.ts` (Refs: FR-025–FR-041, FR-088; SC-005–SC-006)
- [x] T104 [P] [US6] Write failing full-phone projection and immediate Supervisor-scope-loss integration tests in `tests/integration/providers/provider-worker-phone-privacy.test.ts` (Refs: FR-025–FR-028, FR-037–FR-038; SC-006)
- [x] T105 [P] [US6] Write failing Supervisor only-`cleans` write and all prohibited-operation tests in `tests/integration/providers/provider-supervisor-scope.test.ts` (Refs: FR-037, FR-051, FR-064–FR-066; SC-005)
- [x] T106 [P] [US6] Write failing generic history/audit/log/error/outbox forbidden-marker tests in `tests/integration/providers/provider-workforce-sensitive-output.test.ts` (Refs: FR-028, FR-080, FR-085, FR-087; SC-012)
- [x] T107 [P] [US6] Write failing cross-Provider non-enumeration HTTP tests for every route family in `tests/integration/http/provider-workforce-cross-provider.test.ts` (Refs: FR-006, FR-088; SC-005)

### Implementation

- [x] T108 [US6] Implement deny-by-default Owner/Admin/Supervisor/self decisions in `src/modules/providers/domain/provider-workforce-authorization.policy.ts` (Refs: FR-025–FR-041, FR-088)
- [x] T109 [US6] Apply role-specific DTO mappers and no-store headers across workforce queries in `src/modules/providers/provider-workforce-query.service.ts` (Refs: FR-025–FR-028, FR-037–FR-038)
- [x] T110 [US6] Enforce Supervisor current-Team/current-member joins on every scoped read/write repository query in `src/modules/providers/infrastructure/prisma-provider-workforce.repository.ts` (Refs: FR-026, FR-037, FR-064–FR-066)
- [x] T111 [US6] Harden workforce forbidden-field and safe-URL handling in the existing HTTP logging policy in `src/middlewares/http-logger.ts` (Refs: FR-028, FR-087)
- [x] T112 [US6] Add safe phone/private response headers and error mapping in `src/modules/providers/provider-workforce.controller.ts` (Refs: FR-025–FR-028, FR-088)
- [x] T113 [US6] Add permission/privacy descriptions and no-store response headers to runtime OpenAPI in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-025–FR-028, FR-037–FR-038, FR-088)
- [x] T114 [US6] Prove Providers imports only public Authentication/Media/Admin surfaces in `tests/unit/modules/r1-p07-module-boundaries.test.ts` (Refs: FR-033, FR-087)
- [x] T115 [US6] Run and fix independently scoped US6 authorization/privacy suites in `tests/integration/http/provider-workforce-cross-provider.test.ts` (Refs: FR-025–FR-041, FR-088, SC-005–SC-006, SC-012)

**Checkpoint**: Full phone and management authority cannot leak across actors, Teams, or Providers.

---

## Phase 9: User Story 7 — Classify Workers and evaluate crew composition (P2)

**Goal**: Worker type/capability/skills/membership facts and readiness are correct and Booking-safe.

**Independent Test**: Classify Cleaner/Escort/Other, reject invalid Escort facts, evaluate Team composition and `workersReady`.

### Tests first

- [x] T116 [P] [US7] Write failing Worker type/Supervisor independence/skill normalization unit tests in `tests/unit/providers/provider-worker-classification.policy.test.ts` (Refs: FR-052–FR-058)
- [x] T117 [P] [US7] Write failing Escort `cleans=true` and Cleaner-to-Escort ordering integration tests in `tests/integration/providers/provider-escort-membership.test.ts` (Refs: FR-052–FR-056, FR-063, FR-069, FR-073; SC-008–SC-009)
- [x] T118 [P] [US7] Write failing crew-composition/booking-safe public-contract tests in `tests/integration/providers/provider-team-composition.test.ts` (Refs: FR-054–FR-055, FR-069)
- [x] T119 [P] [US7] Write failing derived `workersReady` matrix and no-auto-promotion tests in `tests/integration/providers/provider-workers-ready.test.ts` (Refs: FR-070–FR-075; SC-007)
- [x] T120 [P] [US7] Write failing readiness HTTP/public reader tests in `tests/integration/http/provider-workforce-readiness.test.ts` (Refs: FR-070–FR-075; SC-007)

### Implementation

- [x] T121 [US7] Enforce Worker type/skill/Supervisor-capability independence and Escort ordering in `src/modules/providers/provider-workforce.service.ts` (Refs: FR-052–FR-058)
- [x] T122 [US7] Enforce Escort membership and crew-composition calculations in `src/modules/providers/provider-team-membership.service.ts` (Refs: FR-054–FR-056, FR-063, FR-069)
- [x] T123 [US7] Implement derived qualifying-Worker query and blockers in `src/modules/providers/provider-workforce-readiness.service.ts` (Refs: FR-070–FR-075)
- [x] T124 [US7] Implement Booking-safe Team facts and `workersReady` in Providers public reader in `src/modules/providers/providers.public.ts` (Refs: FR-055, FR-069–FR-075)
- [x] T125 [US7] Add readiness HTTP operation/runtime OpenAPI mapping in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-070–FR-075)
- [x] T126 [US7] Run and fix independently scoped US7 classification/Team/readiness suites in `tests/integration/http/provider-workforce-readiness.test.ts` (Refs: FR-052–FR-075, SC-007–SC-009)

**Checkpoint**: Escorts never clean or satisfy readiness; Booking receives safe composition facts only.

---

## Phase 10: User Story 8 — Leave, remove, and rehire without losing history (P2)

**Goal**: Self-leave/Owner removal terminate current engagement safely; rehire creates a linked new record.

**Independent Test**: Complete leave and removal, then rehire same identity while preserving all terminal/history/notification facts.

### Tests first

- [x] T127 [P] [US8] Write failing Worker self-leave authorization/atomicity tests in `tests/integration/providers/provider-worker-self-leave.test.ts` (Refs: FR-008–FR-009, FR-048–FR-051, FR-074–FR-080)
- [x] T128 [P] [US8] Write failing terminal removal/rehire predecessor/current-engagement tests in `tests/integration/providers/provider-worker-rehire.test.ts` (Refs: FR-004–FR-009, FR-042–FR-049, FR-080; SC-009)
- [x] T129 [P] [US8] Write failing leave/removal notification recipient/locale/failure tests in `tests/integration/providers/provider-worker-departure-notification.test.ts` (Refs: FR-008, FR-049, FR-084–FR-086; SC-014)
- [x] T130 [P] [US8] Write failing Worker self read/leave and Owner rehire HTTP tests in `tests/integration/http/worker-self-leave-rehire.test.ts` (Refs: FR-007–FR-009, FR-038, FR-048–FR-049, FR-088)

### Implementation

- [x] T131 [US8] Implement trusted-identity current Worker self-context query in `src/modules/providers/provider-worker-self.service.ts` (Refs: FR-025, FR-038, FR-088)
- [x] T132 [US8] Implement Worker self-leave atomic command without shared User disable in `src/modules/providers/provider-worker-self.service.ts` (Refs: FR-008–FR-009, FR-048–FR-051, FR-074–FR-087)
- [x] T133 [US8] Implement linked rehire command that never reopens `REMOVED` in `src/modules/providers/provider-workforce.service.ts` (Refs: FR-004–FR-007, FR-042–FR-043, FR-076–FR-080)
- [x] T134 [US8] Add current Worker self/read/leave controller in `src/modules/providers/provider-worker-self.controller.ts` (Refs: FR-008–FR-009, FR-025, FR-038, FR-048–FR-049)
- [x] T135 [US8] Mount `/workers/me` and `/workers/me/leave` routes in `src/modules/providers/provider-worker-self.routes.ts` (Refs: FR-008–FR-009, FR-038, FR-048–FR-049)
- [x] T136 [US8] Add self-service/leave operations to runtime R1-P07 OpenAPI in `src/swagger/r1-p07-openapi.paths.ts` (Refs: FR-008–FR-009, FR-038, FR-048–FR-049)
- [x] T137 [US8] Prove retained bookings/references are unaffected through repository FK fixtures in `tests/integration/providers/provider-worker-history-retention.test.ts` (Refs: FR-043, FR-047–FR-048)
- [x] T138 [US8] Run and fix independently scoped US8 leave/removal/rehire suites in `tests/integration/http/worker-self-leave-rehire.test.ts` (Refs: FR-004–FR-009, FR-042–FR-051, FR-080, FR-084–FR-086, SC-009, SC-014)

**Checkpoint**: Turnover preserves immutable history and never disables unrelated identity relationships.

---

## Phase 11: Polish, contracts, migration proofs, and quality gates

**Purpose**: Integrate all stories and produce completion evidence without deployment/Git tasks.

- [x] T139 Mount Provider workforce, Worker self, and invitation routers in `src/routes/index.ts` (Refs: FR-001–FR-088)
- [x] T140 Complete Providers/Authentication/Media/Admin workforce factories and dispatcher lifecycle wiring in `src/composition.ts` (Refs: FR-018, FR-029–FR-040, FR-084–FR-087)
- [x] T141 Merge implemented R1-P07 design fragments into the runtime document in `src/swagger/openapi.document.ts` (Refs: FR-001–FR-088)
- [x] T142 Validate exact design/runtime OpenAPI path, operation, schema, security, and error parity in `tests/unit/swagger/r1-p07-openapi-parity.test.ts` (Refs: FR-001–FR-088)
- [x] T143 Generate a credential-free R1-P07 Postman collection from runtime operations in `scripts/generate-r1-p07-postman.ts` (Refs: FR-001–FR-088)
- [x] T144 Add R1-P07 operation/secret/example validation to `scripts/validate-postman.ts` (Refs: FR-028, FR-076, FR-088)
- [x] T145 Generate and validate `postman/cleanora-r1-p07-provider-workforce.postman_collection.json` (Refs: FR-001–FR-088)
- [x] T146 Implement disposable chronological clean-install proof for all migrations through R1-P07 in `scripts/validate-clean-migration.ts` (Refs: FR-004, FR-056, FR-059, FR-061, FR-064, FR-076–FR-078; SC-009–SC-011)
- [x] T147 Implement populated R1-P06-to-R1-P07 upgrade preservation proof in `scripts/validate-r1-p07-upgrade.ts` (Refs: FR-001–FR-088)
- [x] T148 Review and record generated SQL/default/index/trigger/FK/backfill/lock risks in `specs/R1-P07-worker-team-crew-management/migration-review.md` (Refs: FR-004, FR-056, FR-059, FR-061, FR-064, FR-076–FR-078)
- [x] T149 Run the explicitly approved disposable clean-install and populated-upgrade proofs and record redacted evidence in `specs/R1-P07-worker-team-crew-management/migration-evidence.md` (Refs: SC-009–SC-011)
- [x] T150 Run phase-scoped tests and coverage, then record thresholds and invariant-suite evidence in `specs/R1-P07-worker-team-crew-management/implementation-summary.md` (Refs: SC-003–SC-014)
- [x] T151 Run full unit/integration regression sequentially and record results in `specs/R1-P07-worker-team-crew-management/implementation-summary.md` (Refs: SC-003–SC-014)
- [x] T152 Run typecheck, lint, build, OpenAPI, Postman, docs, and diff gates and record exact outputs in `specs/R1-P07-worker-team-crew-management/implementation-summary.md` (Refs: FR-001–FR-088, SC-003–SC-014)
- [x] T153 Run module-boundary and forbidden-import scans and record evidence in `specs/R1-P07-worker-team-crew-management/module-boundary-review.md` (Refs: FR-033, FR-087)
- [x] T154 Run full phone/invitation proof/credential/storage-key static and runtime redaction scans and record evidence in `specs/R1-P07-worker-team-crew-management/security-validation.md` (Refs: FR-028, FR-080, FR-085, FR-087; SC-006, SC-012)
- [x] T155 Reconcile final runtime/API/operator documentation, including confirmation that no new env variable is required, in `docs/product/current.md` (Refs: FR-011, FR-029–FR-031, FR-084–FR-086)
- [x] T156 Produce the implementation/review handoff with every DoD item and FR/SC evidence link in `specs/R1-P07-worker-team-crew-management/implementation-summary.md` (Refs: FR-001–FR-088, SC-001–SC-014)

**Checkpoint**: R1-P07 is implemented and evidence-complete for independent review; commit, push, merge, deployment, and production migration remain separate human-controlled actions.

---

## Dependencies and Execution Order

### Phase dependencies

- Setup (T001–T007) has no product-behavior dependency.
- Foundation (T008–T031) depends on Setup and blocks every story.
- US1 (T032–T044) establishes Worker draft/invitation foundation.
- US2 (T045–T060) depends on US1 invitation issuance and Authentication foundations.
- US3 (T061–T076) depends on US2 access projection for full lifecycle evidence.
- US4 (T077–T090) depends on active Worker fixtures from US2/US3.
- US5 (T091–T102) depends on US3 lifecycle and US4 Team/membership behavior.
- US6 (T103–T115) can begin after Foundation but final evidence depends on US1–US5 surfaces.
- US7 (T116–T126) depends on US4 membership and US5 impact handling.
- US8 (T127–T138) depends on US2 access, US3 lifecycle, and US5 impact handling.
- Polish/evidence (T139–T156) depends on all selected stories.

### Tests-before-behavior rule

Within every story, complete its “Tests first” tasks and observe the expected
failure before implementing that story's services/routes. Schema/public types
may be required for compilation, but behavioral assertions must not be written
after the behavior they are intended to prove.

### Parallel opportunities

- Setup helper/config tasks marked `[P]` target different files.
- Foundation policy/repository/public-contract tasks marked `[P]` are parallel
  only after their declared input types exist.
- Tests marked `[P]` within a story use separate files and may be authored in
  parallel before story implementation.
- Different stories are not fully parallel because the workforce aggregate is
  cumulative; the dependency list above is authoritative.

## Independent story criteria

| Story | Independent completion criterion |
|---|---|
| US1 | Draft + localized Owner invitation without existing User/password |
| US2 | New/existing acceptance and terminal-link/race safety |
| US3 | Full Worker/access/Admin lifecycle and reason/step-up evidence |
| US4 | Team lifecycle/membership/Supervisor history |
| US5 | Supervisor conflict and Owner/Admin atomic final-cleaner outcome |
| US6 | Complete actor/privacy matrix with no sensitive leakage |
| US7 | Escort/composition/readiness truth and Booking-safe facts |
| US8 | Self-leave/removal/linked rehire with retained history |

## Requirement coverage index

| Requirements | Primary task coverage |
|---|---|
| FR-001–FR-020 | T032–T060, T139–T145 |
| FR-021–FR-032 | T032, T035–T043, T103–T115 |
| FR-033–FR-041 | T061–T076, T103–T115 |
| FR-042–FR-051 | T061–T076, T091–T102, T127–T138 |
| FR-052–FR-069 | T077–T102, T116–T126 |
| FR-070–FR-075 | T093, T096–T102, T119–T126 |
| FR-076–FR-088 | Foundation plus each command story and T150–T156 |
| SC-001–SC-002 | T043, T059 |
| SC-003–SC-006 | T046, T050, T061, T066, T103–T115 |
| SC-007–SC-009 | T092–T102, T117–T126, T146–T149 |
| SC-010–SC-014 | T046, T051, T063–T076, T092–T102, T129–T150 |

## Implementation strategy

The smallest demonstrable vertical slice is Setup + Foundation + US1. It is not
production-ready alone because invitation acceptance and lifecycle arrive in
later P1 stories. Complete all P1 stories (US1–US5) before considering an
operational workforce MVP, then add the P2 privacy/classification/turnover
slices and cross-cutting proof.

## Notes

- Task IDs are continuous T001–T156.
- `[P]` never overrides the phase dependencies or permits concurrent database
  proof suites against one shared target.
- No task authorizes commit, push, merge, deployment, production migration,
  production credentials, or destructive database work.

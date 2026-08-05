# Tasks: R1-P03 — Roles, Permissions & Privileged Audit

**Input**: Design documents from `specs/R1-P03-roles-permissions-privileged-audit/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `checklists/requirements.md`

**Tests**: Required (spec SC/FR matrix + plan/quickstart gates). Write failing tests before implementation for each story.

**Organization**: Baseline → foundation (schema/migration/seed/ports) → user stories by priority → polish/handoff.

**Constraints**: No public R1-P03 endpoints; no auth route/OpenAPI/Postman changes; no `audit_logs` schema/index changes; no provider/worker persistence; no auto grants/staff bootstrap; no CI/CD/E2E/Docker/Redis/queue/dependency additions; keep junior-readable startup/routes unchanged. Do not mark tasks complete in this file until implementation.

**Remediation note**: Regenerated 2026-08-03 after `/speckit.analyze` blockers. All checkboxes remain unchecked. Implementation unauthorized until a fresh analyze passes and the human owner approves.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no incomplete dependency)
- **[Story]**: `[US1]`…`[US8]` on user-story tasks only
- Every task includes exact repository-relative path(s)

---

## Phase 1: Baseline and Setup

**Purpose**: Confirm active-phase context and freeze non-goals before coding

- [X] T001 Record R1-P03 baseline inventory (active pointer, existing migrations `prisma/migrations/r1_p01_foundation_country_configuration` through `prisma/migrations/r1_p02_google_provider_profile_claims`, auth public surface, `AuthenticationPrincipal` freeze against `src/modules/authentication/domain/authentication.types.ts`, and confirmation that no new public routes will be mounted from `src/routes/index.ts` or `src/modules/authentication/auth.routes.ts`) in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`

**Checkpoint**: Baseline documented; implementation may begin Phase 2

---

## Phase 2: Foundational Schema, Migration, Seed, Types, and Internal Ports

**Purpose**: Blocking prerequisites for every user story

**⚠️ CRITICAL**: No user-story implementation until this phase is complete

### Foundation tests (write first; expect fail until schema/seed/ports exist)

- [X] T002 [P] Add finite catalog constant tests for FR-002 roles/permissions/map in `tests/unit/modules/authentication/authorization-catalog.test.ts`
- [X] T003 [P] Add FR-026 privileged-reason catalog and one-to-one operation-binding tests in `tests/unit/modules/authentication/privileged-reason-catalog.test.ts`
- [X] T004 [P] Add migration SQL expectation tests for only the five approved tables and no `audit_logs` DDL change in `tests/integration/migration-r1-p03.test.ts`
- [X] T005 [P] Extend clean chronological migration compatibility coverage for `r1_p03_roles_permissions_privileged_audit` in `tests/integration/migration-clean-apply.test.ts`
- [X] T006 [P] Add seed idempotency + no automatic `user_roles` grant assertions for `npm run seed` in `tests/integration/authorization-seed.test.ts`
- [X] T007 [P] Add module-boundary test forbidding authentication application/domain files from accessing `auditLog` delegates or admin persistence internals in `tests/unit/tooling/authentication-module-boundary.test.ts`

### Schema, migration, generate, validate

- [X] T008 Add `UserRoleStatus` enum (`ENABLED`, `DISABLED`, `REVOKED`) and models `Role`, `Permission`, `RolePermission`, `UserRole`, `PrivilegedActionReason`, plus `User.userRoles` relation only as needed, to `prisma/schema.prisma` per `specs/R1-P03-roles-permissions-privileged-audit/data-model.md` (no `roles.isActive`, no `permissions.isActive`, no `user_roles.assignedByUserId`, keep `privileged_action_reasons.isActive`, Restrict FKs, exact uniques/indexes, zero structural/index edits to `AuditLog` / `audit_logs`)
- [X] T009 Create forward-only migration directory `prisma/migrations/r1_p03_roles_permissions_privileged_audit/` and generate `prisma/migrations/r1_p03_roles_permissions_privileged_audit/migration.sql` (do not edit any existing migration)
- [X] T010 Review generated SQL in `prisma/migrations/r1_p03_roles_permissions_privileged_audit/migration.sql` against data-model constraints/indexes/on-delete and record the review in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T011 Run `npm run prisma:generate` and record the result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T012 Run `npm run prisma:validate` and record the result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T013 Validate clean chronological migration application and earlier-phase compatibility via `npm run db:validate-clean-migration` and `tests/integration/migration-clean-apply.test.ts` / `tests/integration/migration-r1-p03.test.ts`

### Catalogs before seed

- [X] T014 Add FR-002 role/permission catalog constants and FR-026 privileged-reason definition/binding constants only in `src/modules/authentication/domain/authorization.catalog.ts` (do not add protected-operation declarations here)
- [X] T015 [P] Add authorization domain types/errors (denial codes, grant status, scope/ownership facts) in `src/modules/authentication/domain/authorization.types.ts` and `src/modules/authentication/domain/authorization.errors.ts`
- [X] T016 Update definition-only seeding for exact FR-002 and FR-026 catalogs in `prisma/seed.ts` using `src/modules/authentication/domain/authorization.catalog.ts` (no user-role grants, no staff bootstrap, no provider/worker data)
- [X] T017 Prove `npm run seed` twice on an isolated non-production database is idempotent and creates zero production `user_roles` rows; never use `npm run db:seed`; record evidence in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`

### Transaction architecture (exact dependency order)

- [X] T018 Add business-level `PrivilegedAuditWriter` + safe privileged-audit input/ack types (no Prisma types in identity-facing signatures) in `src/modules/admin/audit.service.ts`
- [X] T019 Add business-level tx-scoped identity store interfaces (`grants`, `roles`, `reasons`, `users`) in `src/modules/authentication/domain/authorization.ports.ts`
- [X] T020 Add `RoleManagementUnitOfWork` port and business-only `RoleManagementUnitOfWorkContext` exposing grants/roles/reasons/users/`PrivilegedAuditWriter` (no Prisma types, no `any`/`unknown` escape hatches) in `src/modules/authentication/role-management.unit-of-work.ts`
- [X] T021 Add infrastructure-only factory `createPrismaPrivilegedAuditWriter(transaction)` that reuses existing audit validation/redaction and alone calls `transaction.auditLog.create` in `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`
- [X] T022 Implement `PrismaRoleManagementUnitOfWork` opening `getPrismaClient().$transaction` from `src/database/prisma.ts`, creating tx-scoped identity stores, and calling the injected admin audit-writer factory (never accessing `transaction.auditLog` or mapping audit persistence) in `src/modules/authentication/infrastructure/prisma-role-management.unit-of-work.ts`

### Evaluation skeletons

- [X] T023 Implement non-transactional definition/grant read repository in `src/modules/authentication/infrastructure/authorization.repository.ts`
- [X] T024 Add `AuthorizationService` skeleton (effective permissions + deny-by-default authorize) in `src/modules/authentication/authorization.service.ts`
- [X] T025 Add pure ownership/scope policy helpers in `src/modules/authentication/authorization.policy.ts`
- [X] T026 Add `RoleManagementService` skeleton depending only on `RoleManagementUnitOfWork` and authorization evaluation in `src/modules/authentication/role-management.service.ts`
- [X] T027 Wire composition injection of `createPrismaPrivilegedAuditWriter` into `PrismaRoleManagementUnitOfWork` and inject the unit of work into `RoleManagementService` construction in `src/composition.ts` without changing public auth router mounting in `src/modules/authentication/auth.module.ts`
- [X] T028 Add transaction-path boundary tests proving `RoleManagementService` imports no Prisma type, authentication domain/application files import no admin infrastructure, authentication code contains no `auditLog` delegate access, only admin Prisma audit infrastructure maps/writes `audit_logs`, and no `any`/`unknown` escape hatch exists in the transaction path in `tests/unit/tooling/authentication-module-boundary.test.ts` and `tests/unit/tooling/module-boundaries.test.ts`

**Checkpoint**: Schema/migration/seed/ports ready; user stories can proceed

---

## Phase 3: User Story 1 — Deny Unauthorized Protected Actions (Priority: P1) 🎯 MVP

**Goal**: Deny-by-default authorization for R1-P03 protected operations using trusted principal, account state, and required permission

**Independent Test**: Principal lacking permission is denied; principal with required ENABLED grant is allowed; suspended/banned/verification-ineligible states deny; unauthenticated callers denied by existing auth middleware; client-supplied authority cannot grant access

### Tests for User Story 1

- [X] T029 [P] [US1] Add deny-by-default evaluation unit tests in `tests/unit/modules/authentication/authorization-deny-by-default.test.ts`
- [X] T030 [P] [US1] Add account-state denial unit tests in `tests/unit/modules/authentication/authorization-account-state.test.ts`
- [X] T031 [P] [US1] Add protected-operation declaration coverage for R1-P03 internal operations (`publicHttp=false`) in `tests/unit/modules/authentication/protected-operation-declarations.test.ts`
- [X] T032 [P] [US1] Add positive-allow unit tests for a trusted active `AuthenticationPrincipal` with an ENABLED role grant, required permission, and matching ownership where required, asserting authorization returns allowed in `tests/unit/modules/authentication/authorization-positive-allow.test.ts`
- [X] T033 [US1] Extend the existing authentication middleware test so a missing principal is denied before an R1-P03 internal protected operation can execute (do not create a public R1-P03 endpoint) in `tests/unit/modules/authentication/authentication-middleware.test.ts`
- [X] T034 [P] [US1] Add trusted-principal-only unit tests proving authorization input accepts trusted `AuthenticationPrincipal`, client-supplied role codes / permission codes-as-authority / ownership assertions cannot grant access, and `AuthenticationPrincipal` public shape is unchanged in `tests/unit/modules/authentication/authorization-trusted-principal.test.ts`

### Implementation for User Story 1

- [X] T035 [US1] Implement effective-permission loading from ENABLED grants only and deny-by-default `authorize(...)` (including the positive-allow path for required permission + ownership) in `src/modules/authentication/authorization.service.ts` using `src/modules/authentication/infrastructure/authorization.repository.ts`
- [X] T036 [US1] Encode non-staff R1-P03 protected-operation declarations with `publicHttp=false` in `src/modules/authentication/domain/authorization.catalog.ts` (role-management and other non-staff operations only; staff samples remain T058)

**Checkpoint**: US1 independently testable

---

## Phase 4: User Story 2 — Hold and Evaluate Multiple Roles (Priority: P1)

**Goal**: Union effective permissions across multiple ENABLED roles; DISABLED roles contribute nothing

**Independent Test**: Two ENABLED roles union permissions; DISABLED role ignored; neither-role permission denied

### Tests for User Story 2

- [X] T037 [P] [US2] Add multi-role effective-permission union tests in `tests/unit/modules/authentication/authorization-multi-role.test.ts`
- [X] T038 [P] [US2] Add disabled/revoked grant exclusion tests in `tests/unit/modules/authentication/authorization-grant-status.test.ts`

### Implementation for User Story 2

- [X] T039 [US2] Complete multi-role permission aggregation as the non-overlapping delta beyond US1 single-grant ENABLED loading: union permissions across multiple ENABLED roles for one user in `src/modules/authentication/authorization.service.ts`
- [X] T040 [US2] Ensure DISABLED/REVOKED grants never contribute permissions in query/filter logic in `src/modules/authentication/infrastructure/authorization.repository.ts`

**Checkpoint**: US2 independently testable

---

## Phase 5: User Story 3 — Assign, Revoke, Enable, Disable Roles Safely (Priority: P1)

**Goal**: Internal role-management contract with exact transition matrix, validation-before-noop, audit-only-on-mutation, self-escalation denial, atomic rollback

**Independent Test**: Exercise full transition matrix via `RoleManagementService` + unit-of-work; no-ops append no audit; illegal transitions reject; self-management escalation denied; audit failure rolls back mutation

### Tests for User Story 3

- [X] T041 [P] [US3] Add complete role-management transition-matrix unit tests in `tests/unit/modules/authentication/role-management-transitions.test.ts`
- [X] T042 [P] [US3] Add validation-before-authorized-noop tests (reason/permission still required) in `tests/unit/modules/authentication/role-management-noop.test.ts`
- [X] T043 [P] [US3] Add self-management/self-escalation denial tests in `tests/unit/modules/authentication/role-management-self-escalation.test.ts`
- [X] T044 [US3] Add integration tests for real mutations appending audit and no-ops appending none in `tests/integration/authentication/role-management.test.ts`
- [X] T045 [US3] Add atomic rollback integration test forcing audit append failure after a would-be successful mutation and asserting `user_roles` state was not committed in `tests/integration/authentication/role-management-audit-rollback.test.ts`

### Implementation for User Story 3

- [X] T046 [US3] Implement exact transition matrix, precondition validation (actor, permission, target, role, self-management rule, exact active operation-bound reason), and audit append via context `audit` only after successful real mutation in `src/modules/authentication/role-management.service.ts`
- [X] T047 [US3] Implement timestamp reset rules for REVOKED→ENABLED and related transitions in the tx-scoped grant store used by `src/modules/authentication/infrastructure/prisma-role-management.unit-of-work.ts`

**Checkpoint**: US3 independently testable

---

## Phase 6: User Story 4 — Enforce Ownership and Scope Boundaries (Priority: P1)

**Goal**: Ownership allow/deny; synthetic provider/worker scope matrix; production denial without real provider/worker records; cross-provider denial

**Independent Test**: SELF ownership allow/deny; synthetic scope matrix cases; production-style deny when real membership/worker facts absent; cross-provider deny

### Tests for User Story 4

- [X] T048 [P] [US4] Add ownership allow/deny unit tests in `tests/unit/modules/authentication/authorization-ownership.test.ts`
- [X] T049 [P] [US4] Add synthetic provider/worker scope matrix tests in `tests/unit/modules/authentication/authorization-scope-synthetic.test.ts`
- [X] T050 [P] [US4] Add production denial-without-real-scope-records tests in `tests/unit/modules/authentication/authorization-scope-production-deny.test.ts`
- [X] T051 [P] [US4] Add cross-provider denial tests in `tests/unit/modules/authentication/authorization-cross-provider.test.ts`

### Implementation for User Story 4

- [X] T052 [US4] Implement ownership and scope evaluation (synthetic facts tests-only; production deny without real membership/worker records; cross-provider deny) in `src/modules/authentication/authorization.policy.ts` and `src/modules/authentication/authorization.service.ts`, and record evidence that no provider/worker tables, routes, or services were created under `src/modules/` or `prisma/schema.prisma` in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`

**Checkpoint**: US4 independently testable

---

## Phase 7: User Story 8 — Preserve Existing Authentication Contracts (Priority: P1)

**Goal**: Existing auth endpoints remain authentication-protected only; no R1-P03 role/permission wrapping; principal contract unchanged; no OpenAPI/Postman drift

**Independent Test**: Auth regression suite passes without `customer` / `resource.self.*` grants; middleware/routes unchanged; OpenAPI/Postman tooling tests still pass

### Tests for User Story 8

- [X] T053 [P] [US8] Add assertion that existing auth endpoints succeed without customer/`resource.self.*` grants in `tests/integration/authentication/auth-without-roles.test.ts`
- [X] T054 [P] [US8] Add `AuthenticationPrincipal` contract freeze test in `tests/unit/modules/authentication/authentication-principal-contract.test.ts`
- [X] T055 [US8] Extend OpenAPI, Postman, and route-inventory tooling assertions sequentially in `tests/unit/tooling/openapi-validation.test.ts`, `tests/unit/tooling/postman-auth-collection.test.ts`, and `tests/integration/swagger-docs.test.ts` to prove unchanged public auth contracts and no new public R1-P03 routes, and record that `src/modules/authentication/auth.middleware.ts`, `src/modules/authentication/auth.routes.ts`, `src/modules/authentication/auth.module.ts`, and `src/routes/index.ts` remain authentication-only in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`

**Checkpoint**: US8 independently testable

---

## Phase 8: User Story 5 — Separate Staff Powers (Priority: P2)

**Goal**: Staff sample operations are mutually exclusive by role permission, without staff workflow leakage

**Independent Test**: Each staff sample operation allows only its matching staff role permission and denies the other three

**Staff sample scope (hard limit)**: four finite protected-operation declarations, permission mapping, pure authorization policy tests, and synthetic privileged-reason validation when applicable. Must not add a staff business write, a `RoleManagementService` method, a public endpoint, or provider/worker/finance/support/admin runtime behavior. `staff_sample_privileged_write` remains a seeded reason and synthetic policy case only.

### Tests for User Story 5

- [X] T056 [P] [US5] Add staff separation authorization policy tests for `identity.staff.sample.admin|operations|support|finance` in `tests/unit/modules/authentication/authorization-staff-separation.test.ts`
- [X] T057 [P] [US5] Add synthetic privileged-reason validation tests for `staff_sample_privileged_write` as a policy/reason case only (no `RoleManagementService` staff write method) in `tests/unit/modules/authentication/privileged-reason-staff-sample.test.ts`

### Implementation for User Story 5

- [X] T058 [US5] Wire exactly four staff sample protected-operation declarations and their FR-002 permission mappings only in `src/modules/authentication/domain/authorization.catalog.ts` (no non-staff declarations, no `RoleManagementService` method, no public endpoint, no staff business write)

**Checkpoint**: US5 independently testable

---

## Phase 9: User Story 6 — Privileged-Write Reasons and Durable Audit Evidence (Priority: P2)

**Goal**: Exact reason-to-operation matching; fail closed on bad reasons; safe audit redaction; mutation+audit atomicity

**Independent Test**: Missing/unknown/inactive/unauthorized/mismatched reasons deny; successful mutation creates safe audit; secret-like context rejected; audit failure rolls back

### Tests for User Story 6

- [X] T059 [P] [US6] Add exact reason-to-operation matching tests in `tests/unit/modules/authentication/privileged-reason-validation.test.ts`
- [X] T060 [P] [US6] Add missing/unknown/inactive/unauthorized/mismatched reason denial tests in `tests/unit/modules/authentication/privileged-reason-failures.test.ts`
- [X] T061 [P] [US6] Add audit redaction/secret-key rejection tests in `tests/unit/modules/admin/privileged-audit-redaction.test.ts`
- [X] T062 [US6] Extend rollback coverage for reason-validated privileged writes in `tests/integration/authentication/role-management-audit-rollback.test.ts`

### Implementation for User Story 6

- [X] T063 [US6] Implement safe before/after audit-context construction for real role-grant mutations only in `src/modules/authentication/role-management.service.ts`, reusing the exact active operation-bound reason validation implemented by T046 and relying on admin-owned validation/redaction in `src/modules/admin/audit.service.ts` and `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`; do not introduce a second privileged-reason validation path

**Checkpoint**: US6 independently testable

---

## Phase 10: User Story 7 — Keep Authorization Current After Revocation (Priority: P2)

**Goal**: Immediate denial after revoke/disable with no authorization caching

**Independent Test**: Allow under ENABLED grant; revoke/disable; next authorize/effective-permission check denies without cache invalidation API

### Tests for User Story 7

- [X] T064 [P] [US7] Add immediate revocation/disable freshness tests proving no authz cache in `tests/unit/modules/authentication/authorization-revocation-freshness.test.ts`
- [X] T065 [US7] Add integration freshness check after revoke/disable mutation in `tests/integration/authentication/authorization-revocation-freshness.test.ts`

### Implementation for User Story 7

- [X] T066 [US7] Ensure `AuthorizationService` performs fresh reads with no module-level permission cache in `src/modules/authentication/authorization.service.ts`

**Checkpoint**: US7 independently testable

---

## Phase 11: Polish, Regression, Complete Validation, Documentation, and Handoff

**Purpose**: Cross-cutting proof and human-ready handoff; phase remains In Progress

- [X] T067 Extend module-boundary enforcement for authorization and transaction-seam files in `tests/unit/tooling/module-boundaries.test.ts` and `tests/unit/tooling/authentication-module-boundary.test.ts`, including evidence of no automatic production grants after seed and that applied migrations outside `prisma/migrations/r1_p03_roles_permissions_privileged_audit/` are byte-unchanged, recorded in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T068 Inspect the implementation diff for unexpected changes under auth routes, OpenAPI, Postman, and API contract documentation (`src/modules/authentication/auth.routes.ts`, `src/routes/index.ts`, OpenAPI/Postman/docs API contract paths). If an unexpected change exists, stop and report it as a blocker. Do not revert, delete, overwrite, checkout, reset, or discard any file. Preserve unrelated and pre-existing user changes. Record the inspection result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T069 Run `git diff --check` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T070 Run `npm run prisma:generate` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T071 Run `npm run prisma:validate` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T072 Run `npm run db:validate-clean-migration` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T073 Run `npm run typecheck` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T074 Run `npm run lint` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T075 Run `npm run test:unit` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T076 Run `npm run test:integration` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T077 Run `npm run test:coverage` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T078 Run `npm run openapi:validate` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T079 Run `npm run docs:check` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T080 Run `npm run build` and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T081 Run `npm run seed` on an isolated non-production database and record result in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T082 Run `npm run seed` a second time on the same isolated non-production database and record idempotency evidence in `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md`
- [X] T083 Finalize `specs/R1-P03-roles-permissions-privileged-audit/implementation-summary.md` with migration SQL review, gate evidence, auth-compat proof, and status **In Progress** pending converge/analyze/review and explicit human completion approval; keep `docs/product/current.md` status In Progress (do not mark R1-P03 Complete)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Baseline)**: none
- **Phase 2 (Foundational)**: depends on Phase 1; **blocks all user stories**
- **Phases 3–10 (User stories)**: depend on Phase 2
  - Preferred sequential order by priority: US1 → US2 → US3 → US4 → US8 → US5 → US6 → US7
  - After Phase 2, P1 stories can proceed carefully; shared files (`authorization.service.ts`, `role-management.service.ts`, `authorization.catalog.ts`) must not be edited in parallel
- **Phase 11 (Polish)**: depends on all user stories intended for delivery

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 | Phase 2 | MVP deny-by-default + positive allow + trusted principal |
| US2 | Phase 2, ideally US1 service APIs | Multi-role delta over US1 |
| US3 | Phase 2 unit-of-work ports | Needs admin writer factory + adapter + composition |
| US4 | Phase 2 + US1 authorize API | Policy helpers |
| US8 | Phase 2 | Mostly regression; can run early after foundation |
| US5 | Phase 2 + US1 declarations | Declarations + policy tests only |
| US6 | US3 mutation/audit path | Reuses T046 reason validation; T063 owns safe audit-context only |
| US7 | US1/US3 | Freshness after revoke/disable |

### Within Each Story

1. Tests first (must fail)
2. Implementation
3. Story tests pass with recorded evidence where required
4. No public HTTP added

### Parallel Opportunities

- Phase 2 foundation tests: T002–T007 in parallel
- Phase 2 catalogs: T015 parallel with T014 (different files)
- US1 tests T029–T032 and T034 parallel; T033 extends `tests/unit/modules/authentication/authentication-middleware.test.ts`
- US2 tests T037–T038 parallel
- US3 unit tests T041–T043 parallel; integration T044–T045 sequential with shared DB fixtures if needed
- US4 tests T048–T051 parallel
- US5 tests T056–T057 parallel
- US6 unit tests T059–T061 parallel; T062 sequential on rollback file
- US8 tests T053–T054 parallel; T055 sequential across listed tooling files
- Polish gate commands T069–T082 sequential

### Corrected dependency order (transaction path)

1. `PrivilegedAuditWriter` business contract (T018)
2. Business identity store ports (T019)
3. `RoleManagementUnitOfWork` + context (T020)
4. Admin Prisma audit-writer factory (T021)
5. `PrismaRoleManagementUnitOfWork` (T022)
6. Evaluation skeletons including `RoleManagementService` (T023–T026)
7. Composition injection (T027)
8. Boundary tests (T028)
9. Atomic rollback integration test (T045)

Catalog constants (T014) before seed consumption (T016).  
`npm run prisma:generate` (T011) immediately after migration creation/review; `prisma:validate` (T012) and clean migration validation (T013) remain separate.

### Invalid `[P]` rules applied

- No `[P]` on same-file sequential edits
- No `[P]` on tasks that depend on incomplete prerequisites
- OpenAPI/Postman/route inventory assertions merged into sequential T055
- Composition wiring is a single task (T027)
- Privileged-reason validation is a single implementation task (T046); T063 reuses it for safe audit-context only

---

## Independent Test Criteria per Story

| Story | Independent test criteria |
|---|---|
| US1 | Missing permission denied; required ENABLED permission allowed; bad account state denied; unauthenticated denied by existing middleware; trusted-principal-only; declarations `publicHttp=false` |
| US2 | Multi-role permission union; DISABLED/REVOKED excluded |
| US3 | Full transition matrix; validation before noop; no audit on noop; self-escalation denied; audit failure rolls back mutation |
| US4 | Ownership allow/deny; synthetic scope matrix; production deny without real scope records; cross-provider deny; no provider/worker persistence |
| US5 | Four staff sample operations mutually exclusive by permission; no staff workflow leakage |
| US6 | Exact reason binding; bad reasons fail closed; safe audit redaction; atomic audit+mutation |
| US7 | Next check after revoke/disable denies; no authz cache |
| US8 | Auth endpoints work without customer/`resource.self.*`; principal unchanged; no new public routes; OpenAPI/Postman unchanged |

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1–2
2. Complete US1 deny-by-default / positive allow / trusted principal
3. Stop and validate US1 tests

### Incremental Delivery

1. Foundation → US1 → US2 → US3 (internal role management MVP+)
2. US4 scope/ownership → US8 auth freeze proof
3. US5–US7 staff declarations/reasons/freshness
4. Phase 11 full gates + implementation summary (status remains In Progress)

### Exact Transition Matrix (must be preserved in US3)

- assign: absent/REVOKED → ENABLED; DISABLED rejects; ENABLED authorized no-op
- enable: DISABLED → ENABLED; ENABLED authorized no-op; REVOKED/absent rejects
- disable: ENABLED → DISABLED; DISABLED authorized no-op; REVOKED/absent rejects
- revoke: ENABLED/DISABLED → REVOKED; REVOKED authorized no-op; absent rejects

Every call validates actor, permission, target, role, self-management rule, and exact active reason before mutation/noop/rejection. Audit only for real mutations.

---

## Task Count Summary

| Phase / Story | Tasks | IDs |
|---|---|---|
| Phase 1 Baseline | 1 | T001 |
| Phase 2 Foundation | 27 | T002–T028 |
| Phase 3 US1 | 8 | T029–T036 |
| Phase 4 US2 | 4 | T037–T040 |
| Phase 5 US3 | 7 | T041–T047 |
| Phase 6 US4 | 5 | T048–T052 |
| Phase 7 US8 | 3 | T053–T055 |
| Phase 8 US5 | 3 | T056–T058 |
| Phase 9 US6 | 5 | T059–T063 |
| Phase 10 US7 | 3 | T064–T066 |
| Phase 11 Polish | 17 | T067–T083 |
| Phase 12 Convergence | 3 | T084–T086 |
| **Total** | **86** | T001–T086 sequential, no gaps |

---

## Notes

- Seed command is `npm run seed` only (never `npm run db:seed`)
- Migration name is exactly `r1_p03_roles_permissions_privileged_audit`
- `RoleManagementService` receives only business ports; Prisma stays in infrastructure/composition
- Admin alone writes `audit_logs` via `createPrismaPrivilegedAuditWriter`; authentication never maps audit persistence
- Do not mark R1-P03 Complete in this task list’s polish phase

---

## Phase 12: Convergence

**Purpose**: Close post-implementation gaps found by `/speckit-converge`. Do not
expand product scope. Keep R1-P03 In Progress until these tasks, review, and
human completion approval finish.

- [X] T084 [US3] Move actor authorization (account state, required `authz.roles.*` permission, and `authz.reasons.use`) inside `RoleManagementUnitOfWork.run` so it uses transaction-scoped grant reads before transition/mutation/audit, matching `contracts/transaction-coordination.md` and `plan.md` atomic sequence; add a regression proving a revoked/disabled actor grant cannot complete a privileged mutation that began after a stale pre-transaction allow — per FR-004, FR-018, plan: transaction design, `contracts/transaction-coordination.md` (`contradicts`)
- [X] T085 Restore idempotent definition **upserts** (or equivalent reconcile-by-stable-`code`) in `prisma/seed.ts` for FR-002 roles/permissions/role-permission map and FR-026 privileged reasons so a second seed restores drifted `name` / `operation` / `isActive=true` without creating duplicates or any `user_roles` grants — per `plan.md` seed plan, `research.md` seed decision (`partial`)
- [X] T086 Remove `unknown` and type-assertion escape hatches from the R1-P03 transaction path (`src/modules/authentication/role-management.service.ts` `Record<string, unknown>` audit context and `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts` `as Prisma.InputJsonValue`), replace with a safe JSON business type that needs no assertion, and strengthen `tests/unit/tooling/authentication-module-boundary.test.ts` to catch general `as …` assertions and `Record<…, unknown>` — per plan composition seam, `contracts/transaction-coordination.md`, T028 (`contradicts`)

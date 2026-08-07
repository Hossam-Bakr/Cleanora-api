# Tasks — R1-P03A Production Role Provisioning (Owner MVP)

**Authority:** [spec.md](./spec.md), **DEC-030**

**Status:** T001–T029 complete; R1-P03A Complete by explicit human-owner approval on 2026-08-07; R1-P04 not active.

## Phase A — Migration hygiene (superseded tables)

- [X] T001 Restore original SQL content for `prisma/migrations/r1_p03a_production_role_provisioning/migration.sql` from applied history (disposable DB evidence); do not casually alter checksum semantics
- [X] T002 Author forward-only drop migration removing obsolete bootstrap tables (`StaffAdminBootstrapClosure`, `StaffAdminBootstrapAuthorizationUse`, or equivalent superseded names) for disposable environments only
- [X] T003 Add integration test proving simplified MVP migration hygiene (create-before-drop ordering; no bootstrap models in schema) in `tests/integration/migration-r1-p03a-hygiene.test.ts`
- [X] T004 Document migration hygiene in implementation summary; confirm production `Cleanora` DB untouched

## Phase B — Owner staff-admin provisioning

- [X] T005 Use fixed SYSTEM audit reason string `owner_staff_admin_provision` (intentionally outside the staff privileged-reason catalog/enum; owner is not a ROLE_ASSIGN actor). Document in data-model.md — no schema enum expansion.
- [X] T006 Define Zod schema and safe error mapping for owner provision request body
- [X] T007 Implement timing-safe owner secret header verification and `OWNER_ADMIN_API_ENABLED` gate
- [X] T008 Wire owner endpoint rate limiting through repository rate-limit port
- [X] T009 Implement `OwnerStaffAdminProvisionService` with transaction-time target reload (`ACTIVE`, verified email)
- [X] T010 Implement Prisma unit of work: assign or re-enable `staff_admin` only, atomic audit with `owner_staff_admin_provision`
- [X] T011 Implement idempotent outcomes for already-enabled grants without duplicate audit
- [X] T012 Register `POST /api/v1/internal/owner/staff-admins` route and controller in Authentication module
- [X] T013 Unit tests: secret gate, rate limit, eligibility denial, idempotency
- [X] T014 Integration tests: successful assign, re-enable, audit rollback on failure

## Phase C — Staff-admin role-grant command API

- [X] T015 Update role-grant command Zod schema to exclude `customer` role code
- [X] T016 Ensure controller rejects customer role before `RoleManagementService` delegation
- [X] T017 Confirm route delegates assign/revoke/enable/disable to `RoleManagementService` with permission + reason checks
- [X] T018 Apply staff-admin API rate limiting consistent with privileged surfaces
- [X] T019 Unit tests: customer role rejection, self-management denial, reason/permission denial
- [X] T020 Integration tests: non-customer transition matrix matches R1-P03 outcomes

## Phase D — Contracts, boundaries, and documentation

- [X] T021 Register owner and staff-admin paths in OpenAPI document from phase contracts
- [X] T022 Add module-boundary test: no cross-module authorization persistence access
- [X] T023 Add OpenAPI contract test against `contracts/*.openapi.yaml`
- [X] T024 Verify no automatic grant hooks from signup/login/verification/startup paths
- [X] T025 Run quickstart validation matrix and record evidence in implementation summary

## Phase E — Completion gate

- [X] T026 R1-P02 regression: authentication public contracts unchanged
- [X] T027 SC-001–SC-010 evidence collected per [quickstart.md](./quickstart.md)
- [X] T028 Update traceability and implementation-summary for owner approval
- [X] T029 Owner sign-off: R1-P03A Complete (unblocks R1-P04 planning resume)

## Explicitly out of scope (do not task)

- Ed25519 CLI bootstrap, closure tables, authorization-use tracking, six-class evidence
- Customer-role assign/enable eligibility in role management
- R1-P04 implementation
- Real secrets in docs or tests committed to repo

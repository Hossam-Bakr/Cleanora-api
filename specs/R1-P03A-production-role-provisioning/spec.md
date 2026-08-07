# Feature Specification: R1-P03A — Production Role Provisioning (Owner MVP)

**Feature Branch**: No branch created; specification artifacts only

**Created**: 2026-08-06

**Revised**: 2026-08-07 — Owner **DEC-030** supersedes the prior complex bootstrap,
customer-role provisioning, and closure-table design. This document is the junior
MVP specification.

**Status**: Specification and planning artifacts rewritten under DEC-030; awaiting
owner approval to proceed to task generation and implementation.

**Input**: Human-owner **DEC-030** — a minimal Authentication-owned path to
provision `staff_admin` and to expose ordinary non-customer role management for
production administration without weakening R1-P02 or R1-P03.

## Clarifications

### Session 2026-08-07 (DEC-030)

- Q: How does production establish the first or additional `staff_admin` without
  the prior Ed25519 CLI bootstrap? → A: One internal owner HTTPS endpoint
  (`POST /api/v1/internal/owner/staff-admins`) gated by
  `OWNER_ADMIN_API_ENABLED=true`, a timing-safe owner secret header, rate
  limiting, and atomic grant+audit with reason `owner_staff_admin_provision`.
- Q: How do staff administrators manage other roles in production? → A: The
  existing-style authenticated staff-admin role-grant command HTTPS API delegates
  to `RoleManagementService` for approved **non-customer** roles only
  (`staff_admin`, staff variants, provider, worker as R1-P03 already allows).
- Q: Does R1-P03A provision the `customer` role or gate R1-P04 on customer grants?
  → A: **No.** Customer-role provisioning is out of scope. R1-P04 authorizes
  customer self-service through trusted `AuthenticationPrincipal` facts, `SELF`
  ownership, and category eligibility per DEC-030 — **without** a `customer`
  role grant, `resource.self.read`/`resource.self.write`, or other role-derived
  R1-P04 customer permissions. A historical `customer` user-role grant is not
  required and does not affect eligibility.

## Scope and Canonical Basis

### In scope

- One internal owner HTTPS endpoint to assign or re-enable `staff_admin` for one
  target user per request.
- One minimal public HTTPS staff-admin role-grant command API for ordinary
  assign, revoke, enable, and disable operations against **non-customer** roles.
- Delegation of every ordinary mutation to the completed R1-P03
  `RoleManagementService` contract without a second transaction owner.
- Safe finite errors, rate limiting, redacted audit evidence, and module
  boundary preservation.
- Reuse of existing `users`, `roles`, `user_roles`, privileged reasons, audit,
  and Authentication-owned transactions — **no new Prisma models** for the
  simplified feature.

### Out of scope

- Ed25519 envelopes, CLI bootstrap scripts, permanent bootstrap closure tables,
  command fingerprints, six-class bootstrap evidence matrices, or
  `StaffAdminBootstrapAuthorizationUse` / `StaffAdminBootstrapClosure` behavior.
- Customer-role assign, enable, disable, revoke, or eligibility workflows.
- Automatic, registration-time, verification-time, startup-time,
  category-derived, seed-based, migration-based, or bulk role grants.
- New Prisma models or forward schema migrations for the simplified MVP itself
  (see **Migration hygiene** for obsolete test-only tables from the superseded
  design).
- General admin dashboards, UI, or unrelated staff workflows.
- R1-P04 customer profiles, preferences, addresses, or privacy behavior.
- Real production secrets, user identifiers, or configuration values in
  specification artifacts — placeholders only.

### Canonical dependencies

- R1-P02 owns authentication, identity, account state, sessions, and
  `AuthenticationPrincipal`.
- R1-P03 remains Complete and owns roles, permissions, reasons, transitions,
  authorization, and the role-management transaction contract.
- Authentication remains the sole owner of role-provisioning behavior and
  persistence access.
- **DEC-030** supersedes **DEC-029** provisions that required complex bootstrap,
  permanent closure, and customer-role eligibility inside role management.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Owner provisions `staff_admin` safely (Priority: P1)

An authorized owner operator can call the internal owner API in an approved
environment to assign or re-enable `staff_admin` for one selected user, while
the endpoint stays disabled by default and rejects invalid secrets.

**Why this priority**: Production administration requires at least one
`staff_admin` without bypassing R1-P03 audit and transition rules.

**Independent Test**: With synthetic users and a placeholder owner secret,
verify enabled/disabled gate, timing-safe secret denial, rate limiting, target
eligibility (`ACTIVE` + verified email), assign and re-enable paths,
idempotent retry, atomic grant+audit, and safe error bodies that leak no secret
or unrelated-user existence.

**Acceptance Scenarios**:

1. **Given** `OWNER_ADMIN_API_ENABLED=true`, a valid owner secret, and a target
   who is `ACTIVE` with verified email and no enabled `staff_admin` grant,
   **When** the owner API assigns `staff_admin`, **Then** exactly one enabled
   grant and redacted audit evidence commit atomically with reason
   `owner_staff_admin_provision`.
2. **Given** the same valid request is retried after success, **When** it is
   evaluated again, **Then** a stable idempotent outcome is returned without a
   duplicate mutation or duplicate audit record.
3. **Given** the target already has a disabled `staff_admin` grant, **When** the
   owner API is called, **Then** the grant is re-enabled according to the R1-P03
   transition matrix inside one atomic transaction with audit.
4. **Given** `OWNER_ADMIN_API_ENABLED` is false, the secret is missing or wrong,
   or the caller is rate-limited, **When** the endpoint is invoked, **Then** the
   request fails closed with a safe response before any grant mutation.
5. **Given** the target is not `ACTIVE`, lacks verified email, or is unknown,
   **When** the owner API is invoked, **Then** the request fails closed without
   grant mutation and without disclosing whether an unrelated user exists.

---

### User Story 2 — Staff admin manages non-customer roles (Priority: P1)

An authenticated `staff_admin` can assign, revoke, enable, or disable approved
**non-customer** roles for another user through the minimal HTTPS command API.

**Why this priority**: After the first administrator exists, ordinary production
role changes must use the audited R1-P03 contract, not ad hoc persistence access.

**Independent Test**: Invoke assign, revoke, enable, and disable for staff,
provider, and worker role codes under allowed and denied actor, target, reason,
and concurrency combinations. Confirm `customer` role commands are rejected at
the API boundary and outcomes otherwise match `RoleManagementService`.

**Acceptance Scenarios**:

1. **Given** an eligible `staff_admin` with the matching permission and reason,
   **When** a non-customer role command is submitted, **Then** the API delegates
   to `RoleManagementService` and returns its safe business outcome.
2. **Given** the command names role code `customer`, **When** it is submitted,
   **Then** it is rejected before delegation without changing grant state.
3. **Given** the actor lacks permission, reason, or authentication, **When** a
   command is submitted, **Then** it fails closed without grant mutation.
4. **Given** the actor targets their own user, **When** any command is submitted,
   **Then** self-management is denied.
5. **Given** audit persistence fails for a real mutation, **When** the delegated
   transaction completes, **Then** the role mutation rolls back.

---

### User Story 3 — Preserve authentication boundaries (Priority: P2)

Existing authentication users and callers continue to receive approved R1-P02
behavior, and provisioning remains confined to Authentication.

**Why this priority**: Provisioning must not regress authentication or create a
cross-module authorization backdoor.

**Independent Test**: Compare completed authentication contracts before and after
delivery; inspect module imports and sample audit evidence for secret leakage.

**Acceptance Scenarios**:

1. **Given** any completed R1-P02 authentication operation, **When** R1-P03A is
   delivered, **Then** its public contract remains unchanged.
2. **Given** another module needs authorization, **When** it interacts with
   Authentication, **Then** it uses an approved public contract only.
3. **Given** signup, login, verification, or application startup, **When** those
   workflows run, **Then** none invokes owner provisioning or automatic grants.

### Edge Cases

- Owner API called while disabled in configuration.
- Wrong owner secret compared with timing-safe equality.
- Concurrent owner requests for the same target — at most one mutation wins;
  others receive safe conflict or no-op outcomes per R1-P03 rules.
- Staff API receives malformed JSON, wrong reason, or throttled traffic.
- Target user deleted or deactivated between validation and commit — transaction
  fails closed without partial grant.

## Requirements *(mandatory)*

### Functional Requirements

#### Ownership and preservation

- **FR-001**: Authentication MUST remain the sole owner of roles, permissions,
  user-role grants, privileged reasons, and production role-provisioning behavior.
- **FR-002**: R1-P03A MUST preserve completed R1-P02 and R1-P03 public contracts
  except for adding the owner internal endpoint and the staff-admin command API
  defined here.
- **FR-003**: No module outside Authentication MAY read or write authorization
  persistence directly.

#### Owner internal `staff_admin` provisioning

- **FR-004**: Authentication MUST expose
  `POST /api/v1/internal/owner/staff-admins` as the only owner provisioning
  surface. R1-P03A MUST provide no UI for this endpoint.
- **FR-005**: The owner endpoint MUST be unavailable unless
  `OWNER_ADMIN_API_ENABLED=true` in server configuration.
- **FR-006**: Every owner request MUST present an owner secret through the
  documented header. Validation MUST use timing-safe comparison. Invalid,
  missing, or disabled configuration MUST fail closed before grant evaluation.
- **FR-007**: The owner endpoint MUST enforce rate limiting appropriate to a
  privileged internal surface.
- **FR-008**: The target MUST be an existing user who is `ACTIVE` and has a
  verified email at transaction time. All target facts MUST be reloaded inside
  the Authentication-owned transaction immediately before mutation and audit.
- **FR-009**: The owner endpoint MUST assign or re-enable `staff_admin` only.
  It MUST NOT assign, revoke, disable, or enable any other role.
- **FR-010**: Owner provisioning MUST be idempotent: a retry after success
  returns a stable outcome without duplicate grant mutation or duplicate audit.
- **FR-011**: A successful owner provision MUST commit the grant mutation and
  required audit evidence atomically with privileged reason
  `owner_staff_admin_provision`.
- **FR-012**: Owner responses MUST use the repository's safe finite error
  envelope. They MUST NOT return the owner secret, raw credentials, tokens, or
  unnecessary personal data, and MUST NOT reveal whether an unrelated user
  exists when the target is unknown.

#### Staff-admin role-grant command API

- **FR-013**: R1-P03A MUST expose one minimal public HTTPS staff-admin
  role-grant command API limited to assign, revoke, enable, and disable against
  another user.
- **FR-014**: The staff-admin API MUST reject any command whose role code is
  `customer` before delegating to `RoleManagementService`.
- **FR-015**: Every staff-admin command MUST require trusted authentication, an
  eligible enabled `staff_admin` actor, the matching R1-P03 operation
  permission, and the matching active reason code
  (`role_grant_assign`, `role_grant_revoke`, `role_grant_enable`, or
  `role_grant_disable`).
- **FR-016**: The staff-admin API MUST delegate every accepted non-customer
  mutation to `RoleManagementService` and MUST NOT write grants directly or own
  a second transaction.
- **FR-017**: The staff-admin API MUST rate-limit abusive traffic, deny
  self-management, and fail closed for missing permissions, invalid targets, or
  unusable actors.
- **FR-018**: Real staff-admin mutations and required before/after audit evidence
  MUST remain in the existing Authentication-owned transaction; audit failure
  MUST roll back the mutation.

#### Boundaries and delivery controls

- **FR-019**: R1-P03A MUST NOT introduce automatic grants, category-derived
  grants, seed grants, migration grants, bulk grants, or backfills.
- **FR-020**: R1-P03A MUST NOT add new Prisma models or forward migrations for
  the simplified MVP feature itself.
- **FR-021**: Specification and contract examples MUST use placeholder secrets
  only (for example `OWNER_ADMIN_SECRET_PLACEHOLDER`). They MUST NOT document or
  store real production secrets.
- **FR-022**: R1-P03A MUST NOT implement R1-P04 behavior or require customer-role
  grants for downstream phases.

### Key Entities

- **Owner Provisioning Request**: An internal HTTPS request naming one target
  user. Authority comes only from enabled configuration, timing-safe secret
  validation, and server-held target facts — never from the JSON body alone.
- **Staff-Admin Role-Grant Command**: An authenticated HTTPS request naming one
  operation, target user, non-customer role code, and approved reason.
- **User-Role Grant**: The existing Authentication-owned grant lifecycle governed
  by R1-P03.

## Ownership and Boundary Expectations

- Authentication owns owner provisioning policy, staff-admin command adaptation,
  `RoleManagementService` delegation, transactions, and repositories.
- The owner endpoint and staff-admin API are inbound adapters only.
- Admin retains audit-record lifecycle ownership through the existing injected
  audit writer.
- R1-P04 remains paused until R1-P03A is implemented, validated, and explicitly
  owner-approved Complete. R1-P04 does not depend on customer-role provisioning
  from this phase.

## Success Criteria *(mandatory)*

- **SC-001**: In the owner API acceptance matrix, 100% of successful provisions
  create or re-enable exactly one `staff_admin` grant for an `ACTIVE` target
  with verified email and commit audit atomically.
- **SC-002**: In 100% of tests where the feature gate is disabled, the secret is
  invalid, or rate limiting applies, the owner API changes no grant state.
- **SC-003**: In 100% of idempotent owner retries after success, no duplicate
  grant mutation or duplicate audit record is created.
- **SC-004**: In 100% of staff-admin API tests, `customer` role commands are
  rejected before delegation.
- **SC-005**: In the complete non-customer transition matrix, 100% of outcomes
  match completed R1-P03 behavior when delegated through the staff-admin API.
- **SC-006**: In 100% of authorization denial tests for the staff-admin API, no
  grant changes.
- **SC-007**: In 100% of induced audit-failure tests, grant mutation rolls back.
- **SC-008**: In 100% of signup, login, verification, and startup tests, no
  automatic grant is created.
- **SC-009**: Architecture review finds zero direct authorization-persistence
  access from modules outside Authentication.
- **SC-010**: Review of owner and staff-admin audit samples finds zero owner
  secrets, credentials, tokens, or unnecessary personal data.

## Assumptions

- R1-P02 and R1-P03 remain completed upstream dependencies.
- **DEC-030** is approved and supersedes the superseded complex R1-P03A design
  for all new work.
- Obsolete bootstrap tables created by an earlier superseded migration on
  disposable test databases are handled separately (restore + forward drop) and
  are not part of the simplified MVP schema.
- Actual owner secret custody and environment configuration remain operational
  concerns outside this specification.

# Feature Specification: R1-P03 — Roles, Permissions & Privileged Audit

**Feature Branch**: `R1-P03-roles-permissions-privileged-audit`

**Created**: 2026-08-03

**Status**: Complete — as of 2026-08-05 by explicit human-owner approval. Frozen requirements (FR/SC/acceptance scenarios/clarifications/scope/product decisions) remain unchanged.

**Input**: User description: "Make authorization authoritative across customer, provider, worker, and staff operations while preserving the completed authentication system."

**Activation**: Activated In Progress as of 2026-08-03 by explicit human-owner authorization (`activation.md`). Implementation was explicitly authorized; tasks T001–T086 completed; convergence was clean; independent review was PASS; final completion audit was READY_FOR_OWNER_APPROVAL. Marked Complete on 2026-08-05 by the exact owner phrase: `I approve R1-P03 — Roles, Permissions & Privileged Audit as Complete.`

## Clarifications

### Session 2026-08-03

- Q: Exact initial role and permission catalog for R1-P03? → A: Option A — seed a finite authorization-only catalog now: `customer`; `staff_admin`, `staff_operations`, `staff_support`, `staff_finance`; `provider_member`, `provider_supervisor`, `provider_admin`, `worker`. Permissions are limited to authorization, ownership, scope-check, staff-separation samples, and privileged-audit controls. No later-phase business operation permissions. Account categories remain identity facts and are not authorization roles.
- Q: How do provider/worker-scoped grants behave before provider membership and worker entities exist? → A: Option A — In production, deny any authorization decision that needs real provider membership or worker records. Prove provider/worker/supervisor/provider-admin scope rules only in the authorization test matrix using synthetic scope facts. Do not create future-phase provider/worker persistence or workflows.
- Q: Does R1-P03 expose public role-assignment management endpoints or only an internal contract? → A: Option A — Role assign/revoke/enable/disable are managed only through an internal application contract in R1-P03. No public role-management endpoints. Later admin surfaces consume the contract; any future public endpoint requires separate explicit human approval.
- Q: How does a protected operation supply an approved privileged reason? → A: Option A — The privileged write call must receive an approved active reason code as a required input. Validate against seeded active reasons; missing, unknown, inactive, or unauthorized reasons fail closed. Callers never receive raw audit persistence or sensitive before/after values.
- Q: Exact initial privileged-action reason catalog for R1-P03? → A: Option A — Seed now: `role_grant_assign`, `role_grant_revoke`, `role_grant_enable`, `role_grant_disable`, `staff_sample_privileged_write`. Active by default. No later-phase business reason codes.
- Q: Are seeded privileged reasons bound one-to-one to matching operations? → A: Option A — One-to-one binding: each FR-026 reason code is valid only for its matching privileged operation (`role_grant_assign` only for assign, `role_grant_revoke` only for revoke, `role_grant_enable` only for enable, `role_grant_disable` only for disable, `staff_sample_privileged_write` only for staff-sample privileged writes). Any other active reason for that operation fails closed as unauthorized.
- Q: Does R1-P03 automatically assign or backfill any roles for production users, and does it bootstrap a staff_admin user? → A: Option A — Seed role, permission, role-permission, and privileged-reason definitions only. Do not automatically assign customer or any other role to existing users. Do not automatically assign roles during future user registration. Do not derive authorization roles from accountCategories. Do not seed or bootstrap a production staff_admin user in R1-P03. Production user-role grants require a separately authorized caller of the internal role-management contract. Authorization tests may create synthetic user-role assignments through test fixtures only. Staff bootstrap and public administration surfaces are deferred and require separate human approval. This does not remove R1-P03’s internal assign/revoke/enable/disable contract.
- Q: Do existing completed authentication endpoints receive R1-P03 role or permission enforcement? → A: Option A — Existing completed authentication endpoints remain authentication-protected only and MUST NOT receive R1-P03 role or permission enforcement. This includes existing signup, verification, login, refresh, logout, logout-all, password, Google authentication, and `/auth/me` operations. Preserve current authentication guards, behavior, requests, responses, status codes, cookies, tokens, sessions, and frontend contracts. Do not require the customer role or `resource.self.*` permissions for those endpoints. R1-P03 authorization consumes the trusted AuthenticationPrincipal produced by authentication but does not change that principal’s public contract. R1-P03 introduces no public permission-protected endpoints. Internal role-management operations must declare required permission, scope/target rules, privileged reason, and audit behavior. Authorization sample permissions are exercised through internal policy contracts and synthetic test scenarios only. Future business phases must declare permission and ownership/scope rules when their endpoints are introduced. Public authentication and OpenAPI contracts remain unchanged.

## Goal

Make authorization authoritative for customer, provider, worker, and staff
operations so protected actions succeed only when trusted identity,
permissions, ownership, account state, and resource state all allow them, and
privileged writes leave durable, reviewable evidence.

## Why

Authentication alone proves who someone is. Release 1 still needs a clear
answer to what they may do, on whose behalf, inside which scope, and why a
privileged change happened. Without that, later marketplace, provider, worker,
support, finance, and admin surfaces cannot safely share one backend.

## In Scope

- Users holding multiple roles at once
- Seeded role, permission, role-permission, and privileged-reason definitions
  required for Release 1 authorization
- Internal assigning, revoking, enabling, and disabling of user-role grants
  through the role-management application contract
- Deny-by-default authorization for R1-P03 authorization-protected operations
  (internal role-management and authorization sample policy contracts)
- Declared permission, scope/target, privileged-reason, and audit requirements
  for those internal protected operations
- Self and resource-ownership authorization rules
- Global, provider, and worker-related authorization scopes
- Supervisor and provider-admin scope restrictions (within one provider only)
- Separated staff power between admin, operations, support, and finance
- Privileged-write reason requirements where configured
- Audit evidence with actor, action, reason, timestamp, target, and safe
  before/after state
- Protection against self-escalation and cross-provider access
- Compatibility with completed authentication (sessions, cookies, tokens,
  account states, response envelopes, OpenAPI, and existing frontend API
  contracts), including consuming AuthenticationPrincipal without changing its
  public contract
- An authorization test matrix covering allowed and denied combinations,
  including synthetic user-role fixtures and sample-permission scenarios
  exercised only through internal policy contracts and tests
- An explicit identity-to-admin audit contract for writing privileged evidence
  into the existing admin-owned audit lifecycle
- Planned product entities treated as specification concepts only:
  roles, permissions, role_permissions, user_roles,
  privileged_action_reasons, and audit_logs integration

## Out of Scope

- R1-P03 role or permission enforcement on existing completed authentication
  endpoints (signup, verification, login, refresh, logout, logout-all,
  password, Google authentication, and `/auth/me`)
- Public permission-protected endpoints introduced by R1-P03
- Public role-assignment management endpoints
- Requiring the `customer` role or `resource.self.*` permissions for existing
  authentication endpoints
- Changing AuthenticationPrincipal’s public contract
- Changing public authentication or OpenAPI contracts
- Automatic role assignment or backfill for existing production users
- Automatic role assignment during user registration
- Deriving authorization roles from account categories
- Seeding or bootstrapping a production `staff_admin` (or any other)
  production user-role grant in R1-P03
- Staff bootstrap procedures and public administration surfaces (deferred;
  require separate human approval)
- Provider onboarding or provider management product features
- Worker profiles, teams, scheduling, or operational management
- Finance, payment, payout, settlement, or ledger workflows
- Support ticket or case-handling workflows
- Administrative dashboards or broad admin product features
- Customer profile features
- New business operations belonging to later phases
- Frontend or UI implementation
- Docker, cloud, CI/CD, queues, cache, notifications, or deployment work
- Implementation details, persistence schema design, migration SQL, source
  structure, seeds as code, or implementation task breakdown
- Direct cross-module repository or internal persistence access
- Changing existing authentication behavior or public authentication contracts

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deny unauthorized protected actions (Priority: P1)

An authenticated person tries a protected operation they are not allowed to
perform. The product refuses the action without revealing another person's
private data, and without treating authentication alone as authorization.

**Why this priority**: Deny-by-default is the core safety property. Every later
marketplace and staff feature depends on it.

**Independent Test**: With a signed-in user who lacks the required permission
or ownership, attempt a protected action and confirm refusal; with a user who
has the required permission and ownership, confirm the same action succeeds.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a valid session but no matching permission,
   **When** they attempt a protected operation, **Then** the product denies the
   action and does not perform the change.
2. **Given** a signed-in user with the required permission and ownership,
   **When** they attempt the same protected operation, **Then** the product
   allows the action.
3. **Given** an unauthenticated caller, **When** they attempt a protected
   operation, **Then** the product denies the action under existing
   authentication rules without changing those rules.
4. **Given** a signed-in user whose account is suspended or banned under
   existing authentication rules, **When** they attempt a protected operation,
   **Then** authorization still respects those existing account-state rules.

---

### User Story 2 - Hold and evaluate multiple roles (Priority: P1)

A person may hold more than one role. Authorization considers the combined
effective permissions from enabled roles, without requiring separate logins.

**Why this priority**: Release 1 actors can be both customers and staff or hold
multiple operational roles; multi-role support is foundational.

**Independent Test**: Assign two roles with different permissions to one user,
then verify actions allowed by either role succeed and actions allowed by
neither fail.

**Acceptance Scenarios**:

1. **Given** a user with two enabled roles whose permissions differ, **When**
   they attempt an action allowed by only one of those roles, **Then** the
   product allows the action.
2. **Given** the same user, **When** they attempt an action allowed by neither
   role, **Then** the product denies the action.
3. **Given** a user with one enabled role and one disabled role, **When** they
   attempt an action only granted by the disabled role, **Then** the product
   denies the action.

---

### User Story 3 - Assign, revoke, enable, and disable roles safely (Priority: P1)

An authorized staff actor changes another user's roles through the internal
role-management application contract. Production users do not receive roles
automatically from seeding, registration, or account categories, and R1-P03
does not bootstrap a production `staff_admin` user. Production grants happen
only when a separately authorized caller uses the internal contract. The
change takes effect for authorization decisions, cannot be used for
self-escalation, and leaves audit evidence when the change is privileged. No
public role-management endpoint is exposed in this phase.

**Why this priority**: Role grants are themselves high-risk privileged writes
and must be controlled before later admin surfaces rely on them.

**Independent Test**: Perform assign, revoke, enable, and disable actions under
allowed and denied actor combinations using synthetic fixtures where needed,
and verify resulting authorization and audit outcomes. Confirm production-path
seeding does not create user-role grants.

**Acceptance Scenarios**:

1. **Given** an actor permitted to manage roles for a target user through the
   internal contract, **When** they assign an allowed role with the required
   reason, **Then** the target gains that role's permissions for later
   authorization checks.
2. **Given** a target user with an assigned role, **When** an authorized actor
   revokes that role, **Then** later authorization checks no longer treat the
   revoked role as granting access.
3. **Given** a target user with an enabled role, **When** an authorized actor
   disables that role without removing the assignment history intent, **Then**
   the disabled role stops contributing permissions until re-enabled.
4. **Given** a user attempting to grant themselves a higher-power staff role
   they do not already hold authority to grant, **When** they request that
   grant, **Then** the product denies the self-escalation.
5. **Given** a privileged role-assignment change succeeds, **When** the change
   is reviewed later, **Then** durable audit evidence identifies actor, action,
   reason where required, timestamp, target, and safe before/after state.
6. **Given** R1-P03 seeds role, permission, role-permission, and
   privileged-reason definitions, **When** existing or newly registered
   production users are inspected, **Then** they have no automatically created
   user-role grants and no production `staff_admin` bootstrap grant exists.

---

### User Story 4 - Enforce ownership and scope boundaries (Priority: P1)

Protected operations that act on a resource succeed only when the caller has
both the permission and the correct ownership or scope relationship. Supervisor
and provider-admin powers never cross provider boundaries.

**Why this priority**: Cross-provider leakage and ownership bypass are the
highest marketplace authorization risks after deny-by-default.

**Independent Test**: Run same-permission callers against owned, foreign,
same-provider, and cross-provider targets and confirm only in-scope targets
succeed.

**Acceptance Scenarios**:

1. **Given** a user permitted to act on their own resource, **When** they act
   on that resource, **Then** the product allows the action.
2. **Given** a user with the same permission but no ownership of another
   person's resource, **When** they act on that foreign resource, **Then** the
   product denies the action.
3. **Given** a supervisor or provider-admin authorized only within Provider A,
   **When** they attempt to act for Provider B, **Then** the product denies the
   cross-provider action.
4. **Given** a global staff permission that is intentionally platform-wide,
   **When** that staff member performs an in-policy global action, **Then** the
   product allows it only within the separated staff-power rules for their
   role.

---

### User Story 5 - Separate staff powers (Priority: P2)

Admin, operations, support, and finance staff roles have different powers.
Holding one staff role does not imply the powers of another.

**Why this priority**: Staff separation prevents accidental concentration of
power and makes later admin features safer.

**Independent Test**: For each staff role, attempt representative allowed and
disallowed privileged actions from the other staff domains and confirm
separation.

**Acceptance Scenarios**:

1. **Given** a user with only the operations staff role, **When** they attempt
   an action reserved for finance, **Then** the product denies it.
2. **Given** a user with only the support staff role, **When** they attempt an
   action reserved for admin, **Then** the product denies it.
3. **Given** a user with only the finance staff role, **When** they attempt an
   action reserved for operations, **Then** the product denies it.
4. **Given** a user with only the admin staff role, **When** they perform an
   admin-reserved privileged action for which they are authorized, **Then** the
   product allows it and records required audit evidence.

---

### User Story 6 - Require privileged-write reasons and durable audit evidence (Priority: P2)

When a protected write is configured as privileged, the actor must supply an
approved reason. Successful privileged writes create durable evidence that a
reviewer can trust without seeing secrets.

**Why this priority**: Privileged changes without reasons and before/after
evidence cannot be investigated or contested.

**Independent Test**: Attempt privileged writes with missing, invalid, and
valid reasons; confirm only valid reasons succeed and produce complete safe
audit evidence.

**Acceptance Scenarios**:

1. **Given** a privileged write that requires a reason, **When** an authorized
   actor omits the required reason code on the write call, **Then** the product
   denies the write and creates no successful privileged change.
2. **Given** a privileged write that requires a reason, **When** an authorized
   actor supplies an inactive, unknown, unauthorized, or operation-mismatched
   reason code, **Then** the product denies the write.
3. **Given** a privileged write that requires a reason, **When** an authorized
   actor supplies an approved active reason code and completes the write,
   **Then** durable audit evidence records actor, action, reason, timestamp,
   target, and safe before/after state, and the caller does not receive raw
   audit persistence or sensitive before/after values.
4. **Given** audit evidence for a privileged write, **When** it is reviewed
   through authorized audit access, **Then** it contains no credentials,
   tokens, OTPs, cookies, raw secrets, or other sensitive values.

---

### User Story 7 - Keep authorization current after revocation (Priority: P2)

After a role is revoked or disabled, previously allowed protected actions that
depended only on that grant are denied. Authorization does not keep granting
stale powers.

**Why this priority**: Stale authorization after revocation is a critical
security failure mode.

**Independent Test**: Allow an action under a grant, revoke or disable the
grant, then retry the same action and confirm denial without requiring a
separate product workflow outside authorization rules.

**Acceptance Scenarios**:

1. **Given** a user who can perform a protected action because of an enabled
   role, **When** that role is revoked, **Then** a later attempt at the same
   action is denied.
2. **Given** a user who can perform a protected action because of an enabled
   role, **When** that role is disabled, **Then** a later attempt at the same
   action is denied until the role is re-enabled by an authorized actor.

---

### User Story 8 - Preserve existing authentication contracts (Priority: P1)

Existing completed authentication endpoints remain authentication-protected
only. R1-P03 MUST NOT add role or permission enforcement to signup,
verification, login, refresh, logout, logout-all, password, Google
authentication, or `/auth/me`. Those operations keep their current guards,
behavior, requests, responses, status codes, cookies, tokens, sessions,
OpenAPI, and frontend contracts. R1-P03 consumes the trusted
AuthenticationPrincipal for authorization decisions elsewhere but does not
change that principal’s public contract and introduces no public
permission-protected endpoints.

**Why this priority**: R1-P02 contracts are frozen and already in use; wrapping
them with role checks would regress the live identity journey and force
premature customer-role grants.

**Independent Test**: Re-run the existing authentication acceptance set and
confirm behavior and public contracts remain unchanged. Confirm those
endpoints succeed without `customer` or `resource.self.*` grants. Exercise
R1-P03 permission samples only through internal policy contracts and synthetic
tests.

**Acceptance Scenarios**:

1. **Given** the completed authentication system, **When** R1-P03 authorization
   capabilities are introduced, **Then** existing authentication endpoints,
   cookies, tokens, sessions, OpenAPI, and frontend-facing user contracts
   continue to behave as before and require no R1-P03 roles or permissions.
2. **Given** an authenticated user with no `customer` role and no
   `resource.self.*` permissions, **When** they call existing authentication
   endpoints such as refresh or `/auth/me` under current authentication rules,
   **Then** those endpoints are not denied by R1-P03 role or permission checks.
3. **Given** an existing authenticated session, **When** authorization is
   evaluated for an R1-P03 internal protected operation, **Then** evaluation
   uses the trusted AuthenticationPrincipal already established by
   authentication, not client-supplied role claims, and does not alter that
   principal’s public contract.
4. **Given** R1-P03 authorization sample permissions, **When** they are
   exercised, **Then** they are proven only through internal policy contracts
   and synthetic test scenarios, not through new public permission-protected
   endpoints.

---

### Edge Cases

- A user has multiple roles where one grants and another does not grant the
  same permission: the grant from any enabled role is enough unless a more
  specific ownership or scope rule still denies the action.
- A role assignment exists but is disabled: it contributes no permissions.
- Seeding role, permission, role-permission, and privileged-reason definitions
  does not create user-role grants for existing or newly registered production
  users.
- Account categories never become authorization roles and never trigger role
  grants.
- R1-P03 does not seed or bootstrap a production `staff_admin` user-role grant.
  Production grants require a separately authorized caller of the internal
  role-management contract.
- Authorization tests may create synthetic user-role assignments through test
  fixtures only; those fixtures are not production grants.
- Existing completed authentication endpoints remain authentication-protected
  only. Absence of the `customer` role or `resource.self.*` permissions does
  not block signup, verification, login, refresh, logout, logout-all,
  password, Google authentication, or `/auth/me`.
- R1-P03 introduces no public permission-protected endpoints; authorization
  sample permissions are exercised only through internal policy contracts and
  synthetic tests.
- A privileged reason exists but is inactive: it cannot authorize a privileged
  write.
- A caller has permission but the target resource does not exist or is not
  visible under ownership rules: the product denies access without leaking
  another party's private details beyond existing response conventions.
- A supervisor, provider-admin, provider-member, or worker grant is present
  while real provider membership or worker entities do not yet exist: any
  production authorization decision that would require those real records is
  denied. Provider/worker/supervisor/provider-admin scope rules are proven only
  in the authorization test matrix using synthetic scope facts. No
  future-phase provider/worker persistence or workflows are introduced.
- An actor attempts to assign a role that would expand their own authority:
  self-escalation is denied.
- An actor attempts a privileged write without the operation-bound approved
  active reason code, or with an unknown, inactive, unauthorized, or
  operation-mismatched reason code: the write is denied and no successful
  privileged change occurs. Callers do not receive audit persistence or
  sensitive before/after values.
- Audit evidence creation fails after a privileged decision would otherwise
  succeed: the product must not leave an unaudited successful privileged write;
  the privileged change fails closed.
- Cross-module audit recording must use the explicit identity-to-admin audit
  contract only; identity must not write admin-owned audit persistence
  directly.
- Authorization checks for operations that are not yet productized in later
  phases are defined as reusable rules and matrix cases, not as early delivery
  of those later business workflows.

### Failure Behavior

- Missing authentication for an R1-P03 authorization-protected operation fails
  under existing authentication rules.
- Applying R1-P03 role or permission checks to existing authentication
  endpoints is out of scope and must not occur; those endpoints continue under
  current authentication-only protection.
- Missing permission, ownership, or scope fails closed with a denial for
  R1-P03 authorization-protected operations.
- Missing, invalid, unauthorized, or operation-mismatched privileged reason
  fails closed with a denial.
- Attempts to treat account categories as authorization roles fail closed and
  create no role grants.
- Absence of a production staff bootstrap does not weaken deny-by-default:
  users without grants remain unauthorized for protected role-managed actions.
- Self-escalation attempts fail closed with a denial.
- Cross-provider proxy attempts fail closed with a denial.
- Inability to record required privileged audit evidence fails closed so the
  privileged write does not succeed without evidence.
- Failures must not weaken existing response-envelope conventions or expose
  secrets, tokens, or another user's private authorization internals.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST allow a single user to hold multiple roles at the
  same time.
- **FR-002**: The product MUST seed the following finite authorization-only
  catalog. Account categories (Individual, Company, Engineer, Provider-owner,
  Worker login identity, and similar authentication enrollment types) remain
  identity facts and MUST NOT be treated as authorization roles.
  - Roles seeded now: `customer`, `staff_admin`, `staff_operations`,
    `staff_support`, `staff_finance`, `provider_member`, `provider_supervisor`,
    `provider_admin`, `worker`.
  - Permissions seeded now (authorization domain only; no later-phase business
    operations):
    - `resource.self.read`, `resource.self.write` — self/resource ownership
      samples for the `customer` role.
    - `authz.roles.assign`, `authz.roles.revoke`, `authz.roles.enable`,
      `authz.roles.disable` — role-grant controls for `staff_admin` only.
    - `authz.reasons.use` — ability to supply an approved privileged reason on
      a configured privileged write; granted to staff roles that may perform
      privileged writes under staff separation (`staff_admin` and any other
      staff role whose reserved sample write is privileged).
    - `authz.staff.admin.sample`, `authz.staff.operations.sample`,
      `authz.staff.support.sample`, `authz.staff.finance.sample` — mutually
      exclusive staff-separation sample permissions for the matching staff
      role only.
    - `authz.scope.provider.member`, `authz.scope.provider.supervisor`,
      `authz.scope.provider.admin`, `authz.scope.worker` — provider/worker
      scope-check permissions for the matching provider/worker roles only.
  - Role-to-permission map:
    - `customer` → `resource.self.read`, `resource.self.write`
    - `staff_admin` → `authz.roles.assign`, `authz.roles.revoke`,
      `authz.roles.enable`, `authz.roles.disable`, `authz.reasons.use`,
      `authz.staff.admin.sample`
    - `staff_operations` → `authz.reasons.use`,
      `authz.staff.operations.sample`
    - `staff_support` → `authz.reasons.use`, `authz.staff.support.sample`
    - `staff_finance` → `authz.reasons.use`, `authz.staff.finance.sample`
    - `provider_member` → `authz.scope.provider.member`
    - `provider_supervisor` → `authz.scope.provider.supervisor`
    - `provider_admin` → `authz.scope.provider.admin`
    - `worker` → `authz.scope.worker`
  - The catalog MUST NOT include permissions for provider onboarding, worker
    operations, finance/payment/payout/settlement, support workflows, customer
    profiles, or admin dashboards.
- **FR-003**: The product MUST support assigning, revoking, enabling, and
  disabling user-role grants through the internal role-management application
  contract only.
- **FR-004**: R1-P03 authorization-protected operations MUST deny by default
  unless trusted identity, required permission, ownership or scope rules, and
  applicable account/resource state checks all pass. Existing completed
  authentication endpoints are not R1-P03 authorization-protected operations.
- **FR-005**: Every R1-P03 authorization-protected operation MUST declare the
  permission and ownership/scope rule that authorize it. Internal
  role-management operations MUST declare required permission, scope/target
  rules, privileged reason, and audit behavior. Authorization sample
  permissions MUST be exercised through internal policy contracts and
  synthetic test scenarios only. Future business phases MUST declare
  permission and ownership/scope rules when their endpoints are introduced.
  R1-P03 MUST NOT introduce public permission-protected endpoints.
- **FR-006**: Authorization MUST evaluate effective permissions from all
  enabled roles for the authenticated user.
- **FR-007**: Authorization MUST enforce self/resource ownership rules where a
  protected operation is owner-scoped.
- **FR-008**: Authorization MUST support global, provider, and worker-related
  scope semantics as reusable authorization rules for current and future
  protected operations.
- **FR-009**: Supervisor and provider-admin authority MUST be limited to the
  single provider scope they are allowed to represent and MUST NOT proxy
  across providers.
- **FR-010**: Before later provider membership and worker entities exist, any
  production authorization decision that requires real provider membership or
  worker records MUST deny. Provider/worker/supervisor/provider-admin scope
  semantics MUST still be defined and proven in the authorization test matrix
  using synthetic scope facts only. R1-P03 MUST NOT invent provider or worker
  persistence, membership records, or workflows, and MUST NOT allow production
  authorization to rely on invented provider or worker records.
- **FR-011**: Staff powers for admin, operations, support, and finance MUST be
  separated so that one staff role does not inherit another staff role's
  reserved powers.
- **FR-012**: Privileged writes that are configured to require a reason MUST
  accept only the approved active privileged-action reason code that is bound
  to that exact operation, supplied as a required input on the privileged write
  call, and MUST deny the write when the reason is missing, unknown, inactive,
  or unauthorized for that actor or operation.
- **FR-013**: Successful privileged writes MUST create durable audit evidence
  containing actor, action, reason, timestamp, target, and safe before/after
  state. Callers of the protected operation MUST NOT receive raw audit
  persistence access or sensitive before/after values.
- **FR-014**: Audit evidence MUST exclude credentials, tokens, OTPs, cookies,
  payment secrets, and other sensitive values.
- **FR-015**: Identity owns roles, permissions, role-permission grants,
  user-role assignments, and privileged-action reason definitions as product
  concepts and lifecycle authority.
- **FR-016**: The existing audit_logs lifecycle remains owned by the admin
  module. Identity MUST record privileged audit evidence only through an
  explicit identity-to-admin audit contract and MUST NOT access admin audit
  persistence directly.
- **FR-017**: The product MUST prevent role self-escalation: a user MUST NOT
  grant themselves authority they are not already allowed to grant.
- **FR-018**: After a role grant is revoked or disabled, later authorization
  decisions MUST stop granting permissions that depended only on that grant.
- **FR-019**: Authorization decisions MUST use trusted authenticated identity
  and account state from the completed authentication system, never
  client-supplied role or permission claims as authority.
- **FR-020**: R1-P03 MUST preserve all existing authentication behavior and
  public contracts, including sessions, cookies, tokens, OTP/email
  verification, Google flows, account states, response envelopes, OpenAPI, and
  frontend-facing current-user contracts. Existing completed authentication
  endpoints MUST remain authentication-protected only and MUST NOT receive
  R1-P03 role or permission enforcement. Those endpoints MUST NOT require the
  `customer` role or `resource.self.*` permissions. R1-P03 authorization MAY
  consume the trusted AuthenticationPrincipal produced by authentication but
  MUST NOT change that principal’s public contract.
- **FR-021**: Role assign, revoke, enable, and disable MUST be available only
  through an internal application contract in R1-P03. R1-P03 MUST NOT expose
  public role-assignment management endpoints. Later administrative surfaces
  MAY consume the internal contract. Any future public role-management endpoint
  requires separate explicit human approval and justification.
- **FR-022**: The product MUST provide an authorization test matrix covering
  allowed and denied combinations across roles, permissions, ownership,
  global/provider/worker scopes, supervisor/provider-admin limits, staff
  separation, privileged-reason presence/absence, self-escalation, revocation
  freshness, authentication-compatible account states, absence of automatic
  production role grants after definition seeding, absence of a production
  `staff_admin` bootstrap, and confirmation that existing authentication
  endpoints remain free of R1-P03 role/permission enforcement. Matrix and
  unit/integration authorization tests MAY create synthetic user-role
  assignments through test fixtures only. Authorization sample permissions
  MUST be exercised through internal policy contracts and synthetic test
  scenarios only.
- **FR-023**: R1-P03 MUST NOT deliver provider onboarding, worker operations,
  finance/payment workflows, support workflows, customer-profile features,
  admin dashboards, or other later-phase business products; it defines only
  the reusable authorization and privileged-audit behavior those phases will
  consume.
- **FR-024**: Planned persistence names (roles, permissions, role_permissions,
  user_roles, privileged_action_reasons, audit_logs integration) are
  specification entities only in this document and do not themselves define
  technical schema.
- **FR-025**: A protected operation configured as a privileged write MUST
  require the caller to supply an approved active reason code on that write
  call. The product MUST validate the code against seeded active privileged-
  action reasons, MUST fail closed for missing, unknown, inactive, or
  unauthorized reasons, and MUST NOT expose audit persistence or sensitive
  before/after values to callers.
- **FR-026**: The product MUST seed the following finite privileged-action
  reason catalog, active by default, and MUST NOT seed later-phase business
  reason codes:
  - `role_grant_assign` — valid only for role assign
  - `role_grant_revoke` — valid only for role revoke
  - `role_grant_enable` — valid only for role enable
  - `role_grant_disable` — valid only for role disable
  - `staff_sample_privileged_write` — valid only for staff-sample privileged
    writes
  Each reason code is bound one-to-one to its matching privileged operation.
  Supplying any other active reason for that operation MUST fail closed as
  unauthorized for the operation.
- **FR-027**: R1-P03 MUST seed role, permission, role-permission, and
  privileged-reason definitions only. It MUST NOT automatically assign the
  `customer` role or any other role to existing users, MUST NOT automatically
  assign roles during future user registration, MUST NOT derive authorization
  roles from account categories, and MUST NOT seed or bootstrap a production
  `staff_admin` user. Production user-role grants MUST require a separately
  authorized caller of the internal role-management contract. Authorization
  tests MAY create synthetic user-role assignments through test fixtures only.
  Staff bootstrap and public administration surfaces remain deferred and
  require separate human approval. This requirement does not remove the
  internal assign/revoke/enable/disable contract.
- **FR-028**: Existing completed authentication endpoints MUST remain
  authentication-protected only and MUST NOT receive R1-P03 role or permission
  enforcement. This includes existing signup, verification, login, refresh,
  logout, logout-all, password, Google authentication, and `/auth/me`
  operations. Their current authentication guards, behavior, requests,
  responses, status codes, cookies, tokens, sessions, OpenAPI, and frontend
  contracts MUST be preserved. They MUST NOT require the `customer` role or
  `resource.self.*` permissions. R1-P03 MUST introduce no public
  permission-protected endpoints.

### Key Entities *(specification concepts only)*

- **Role**: A named bundle of authority a user may be granted. A user may hold
  multiple roles. Roles can be enabled or disabled on a user without erasing
  the business meaning of assignment history intent.
- **Permission**: A named protected capability checked before a protected
  operation proceeds.
- **Role-permission grant**: The association that gives a role one or more
  permissions.
- **User-role assignment**: The association that gives a user a role, including
  whether that assignment is currently enabled. Production assignments are
  created only through the internal role-management contract by a separately
  authorized caller; they are not created by definition seeding, registration,
  account-category mapping, or a production staff bootstrap. Test fixtures may
  create synthetic assignments for authorization evidence only.
- **Privileged-action reason**: An approved reason code or definition that must
  be supplied for configured privileged writes. R1-P03 seeds the finite active
  catalog in FR-026.
- **Audit evidence record**: Durable privileged-action evidence owned through
  the admin audit lifecycle, created via the identity-to-admin audit contract,
  containing actor, action, reason, timestamp, target, and safe before/after
  state.
- **Authorization scope**: The boundary within which a permission may be
  exercised: self/resource ownership, global staff scope, provider scope, or
  worker-related scope.
- **Authorization decision**: The allow/deny outcome produced from trusted
  identity, enabled roles/permissions, ownership/scope, account/resource
  state, and privileged-reason rules.

### Security Invariants

- Deny protected actions by default.
- Never trust client-supplied roles, permissions, or ownership assertions as
  authority.
- Never allow self-escalation of role authority.
- Never allow supervisor/provider-admin powers to cross providers.
- Never allow a successful privileged write without required reason and
  durable safe audit evidence.
- Never allow identity to bypass the admin-owned audit lifecycle through direct
  persistence access.
- Never change or weaken completed authentication security behavior to make
  authorization easier.
- Never apply R1-P03 role or permission enforcement to existing authentication
  endpoints.
- Never leak secrets into audit evidence, logs, or authorization failure
  details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of R1-P03 authorization-protected operations have an
  explicit permission and ownership/scope rule, verified by the authorization
  test matrix. Existing authentication endpoints are excluded from that
  permission-protected set.
- **SC-002**: 100% of matrix-denied cases in the authorization test matrix are
  refused, including missing permission, missing ownership, cross-provider
  proxy attempts, staff-power mismatches, self-escalation, missing privileged
  reason, and post-revocation retries.
- **SC-003**: 100% of matrix-allowed cases that should succeed do succeed when
  identity, permission, ownership/scope, and privileged-reason rules are
  satisfied.
- **SC-004**: 100% of successful privileged writes examined in acceptance
  evidence include actor, action, reason, timestamp, target, and safe
  before/after state, with no secrets present.
- **SC-005**: After role revocation or disablement, 100% of sampled protected
  actions that depended only on that grant are denied on the next attempt.
- **SC-006**: Existing authentication acceptance checks used for completed
  identity behavior continue to pass with no intentional public-contract
  change, and those endpoints succeed without requiring R1-P03 roles or
  `resource.self.*` permissions.
- **SC-007**: Staff separation checks show that each of admin, operations,
  support, and finance can perform its allowed privileged samples and is
  denied on the other roles' reserved samples.
- **SC-008**: Cross-module audit evidence for privileged writes is produced
  only through the explicit identity-to-admin audit contract in 100% of
  sampled privileged successes.
- **SC-009**: After R1-P03 definition seeding, 100% of inspected existing and
  newly registered production users have no automatically created user-role
  grants, and no production `staff_admin` bootstrap grant is present.
- **SC-010**: 100% of sampled existing authentication endpoints remain free of
  R1-P03 role/permission enforcement, and R1-P03 introduces zero public
  permission-protected endpoints.

## Assumptions

- Historical planning context: while R1-P03 was active, it was the only active
  phase and was authorized for specification and planning; implementation then
  awaited later Spec Kit gates and human approval. R1-P03 is now Complete and
  this historical context does not reopen it or alter its settled behavior.
- Completed authentication remains the sole source of trusted sign-in identity,
  session validity, cookies/tokens, verification state, and account
  active/suspended/banned enforcement.
- Existing response-envelope and frontend authentication contracts remain
  frozen unless a later explicit product decision says otherwise.
- Identity owns roles, permissions, grants, user-role assignments, and
  privileged-action reasons; admin owns the audit_logs lifecycle created in
  R1-P01 and consumed by R1-P03 through a public contract only.
- Provider membership, worker entities, finance operations, support
  operations, customer profiles, and admin dashboards remain later-phase
  products; R1-P03 only prepares authorization semantics they will reuse.
- DEC-010 continues to guide Release 1 admin breadth at the product level
  (admin actions that do not require maps or marketer modules). The R1-P03
  role/permission catalog is the finite authorization-only set recorded under
  FR-002, and the privileged-action reason catalog is the finite set under
  FR-026, both recorded in Clarifications Session 2026-08-03.
- R1-P03 seeds authorization definitions only. It does not auto-assign or
  backfill production user roles, does not map account categories to roles,
  and does not bootstrap a production `staff_admin` user. Production grants
  require a separately authorized caller of the internal role-management
  contract; tests may use synthetic fixtures only.
- Existing completed authentication endpoints remain authentication-protected
  only. R1-P03 does not add role/permission enforcement to them, does not
  require `customer` or `resource.self.*` for them, does not change
  AuthenticationPrincipal’s public contract, and introduces no public
  permission-protected endpoints. Sample permissions are proven through
  internal policy contracts and synthetic tests; future phases declare
  permission/ownership rules when introducing their endpoints.
- All clarification markers from the initial specification draft are resolved
  in Clarifications Session 2026-08-03.
- Planned table names from the roadmap are conceptual labels for specification
  and later planning, not a schema design approved by this document.
- Authorization test evidence will be proportional to the security risk and
  will include both allowed and denied paths.

## Dependencies

- Completed R1-P02 authentication and identity behavior, including trusted
  authenticated principal, sessions, account states, and public auth contracts
- Existing admin-owned audit_logs lifecycle from R1-P01 and a still-to-be-
  specified explicit identity-to-admin audit contract
- Canonical roadmap scope for R1-P03 and entity-ownership rows for roles,
  permissions, grants, privileged reasons, and audit_logs
- Human-resolved clarification decisions recorded in this specification's
  Clarifications Session 2026-08-03

## Clarification Markers Pending Human Decision

None. All unique clarification topics from the initial draft are resolved in
Clarifications Session 2026-08-03.

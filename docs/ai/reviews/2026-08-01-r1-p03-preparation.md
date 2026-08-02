# R1-P03 Preparation — Roles, Permissions & Privileged Audit

**Prepared:** 2026-08-01  
**Target phase:** `R1-P03 — Roles, Permissions & Privileged Audit`  
**Preparation status:** `READY FOR OWNER ACTIVATION DECISION — target phase remains inactive`  
**Cleared gate:** `R1-P02A — Backend Structure Simplification` is **Complete** as of
`2026-08-01` by explicit human-owner completion approval.  
**Remaining activation gates:** explicit R1-P03 activation, Git handoff/isolation of
the R1-P02A worktree, and recorded product decisions in section 7.

This is a pre-activation planning handoff. It is not an R1-P03 specification,
does not activate R1-P03, and authorizes no implementation, Git operation,
deployment, or production migration.

## 1. Loaded authority and state

- `AGENTS.md`, `docs/ai/context-router.md`, `docs/product/current.md`, the
  R1-P03 roadmap section, and the R1-P02A phase artifacts.
- Relevant product rules from `docs/product/vision.md`, approved authentication
  decisions, and `docs/product/open-questions.md`.
- Minimal architecture contracts for the modular monolith, source layout,
  security, API behavior, Prisma, transactions, and entity ownership.
- The current authentication principal/middleware/module contracts, current
  admin audit service, Prisma schema, all existing migrations, and seed flow.
- The Spec Kit lifecycle instructions and the Cleanora review contract.

Repository evidence:

- R1-P02A has all tasks checked; technical implementation and validation are
  complete; human-owner completion approval was recorded on `2026-08-01`.
- `docs/product/current.md` and the R1-P02A implementation summary both report
  R1-P02A as **Complete**. No phase is currently In Progress.
- R1-P03 remains inactive until separate explicit human-owner activation.
- The worktree still contains the uncommitted R1-P02A refactor on `main`; R1-P03
  work must not be mixed into it until an authorized Git handoff isolates that
  work.

## 2. Readiness and dependencies

### Hard activation gates

1. ~~Human owner explicitly approves R1-P02A as Complete.~~ **Satisfied**
   `2026-08-01`.
2. ~~R1-P02A completion evidence and `docs/product/current.md` are aligned.~~
   **Satisfied** `2026-08-01`.
3. The R1-P02A worktree is handed off through an explicitly authorized Git
   workflow or otherwise isolated before R1-P03 implementation begins.
4. Human owner explicitly activates R1-P03 and confirms it is the only active
   phase.
5. The product decisions in section 7 are approved and recorded in
   `docs/product/decision-log.md` before implementation.

### Satisfied dependencies

- R1-P02 authentication is Complete and supplies a trusted
  `AuthenticationPrincipal` containing user, session, category, status, and
  verification-capability facts.
- Active/suspended/banned user checks, full versus verification-only sessions,
  JWT verification, account-category enrollment, Google Individual activation,
  and safe `/auth/me` behavior already exist.
- `audit_logs` and a fail-closed audit writer already exist from R1-P01.
- The central Prisma schema and append-only migration history are available.
- The backend has an explicit route map and composition root suitable for one
  access-control extension.

### Material dependency gap

The roadmap asks R1-P03 to cover provider membership scope, worker scope,
supervisor, and provider-admin behavior. Canonical entity ownership assigns
`providers` and `provider_members` creation to R1-P05 and provider membership
changes to R1-P07. Those tables do not exist now. R1-P03 must not create a
provider module, provider records, worker profiles, teams, assignments, or
provider administration endpoints early.

Recommended interpretation: R1-P03 defines and tests the generic provider-scope
authorization contract and the supervisor/provider-admin permission semantics,
but persists no real provider membership or flag before its owning phase.
R1-P05/R1-P07 will supply provider membership facts and perform the endpoint
integration through the R1-P03 public authorization contract. Because this
narrows the literal runtime meaning of the roadmap Done When statement, it
requires explicit human approval.

## 3. Precise proposed R1-P03 scope

### In scope

- Multiple simultaneous roles for one authenticated user.
- Idempotent seeds for the R1 roles and R1-P03 permissions.
- Account-category-to-role synchronization for existing and future users.
- Explicit staff-role grants and revocations with least privilege.
- Deny-by-default permission middleware and named ownership policies.
- A route declaration contract that makes authentication, permission, and
  ownership requirements visible for every protected endpoint.
- `SELF`, `GLOBAL`, and policy-level `PROVIDER` scope semantics.
- Pure provider-scope policy tests proving that supervisor/provider-admin proxy
  authority never crosses a provider boundary.
- Active privileged-action reason codes and optional constrained details.
- Atomic privileged role-assignment changes plus append-only audit evidence.
- Typed before/after audit snapshots, actor, request, target, reason, and time.
- Focused access-control administration APIs and audit-read API only.
- An authorization test matrix covering roles, permissions, scopes, account
  state, session capability, ownership, denial, and audit failure.
- Incremental Prisma changes and one new phase-owned migration named
  `r1_p03_roles_permissions_privileged_audit`.

### Out of scope

- Provider creation, profiles, verification, members, invitations, worker
  profiles, teams, schedules, assignments, services, or pricing.
- Real supervisor/provider-admin grants tied to `provider_members` before the
  provider-owning phase supplies those records.
- Worker operational actions or proxy endpoints.
- Finance operations, ledgers, payments, refunds, payouts, or exports.
- Support-ticket behavior and operations workflows.
- General admin panel behavior, account moderation, catalog/configuration
  management, incident operations, or bulk export.
- Marketer roles or Release 2 permissions.
- Redis authorization caches, queues, events, notifications, Socket.IO,
  microservices, or a policy engine framework.
- Fine-grained attribute-based policy authoring, custom tenant roles, user
  impersonation, or emergency break-glass access.
- Changes to R1-P02 authentication entry points, token format, cookies, Google
  flow, email verification, or password recovery.
- Editing any applied migration, running production migrations, committing,
  pushing, merging, or deploying.

## 4. Proposed authorization model

### Roles

Seed these R1-P03 roles:

| Role | Meaning in R1-P03 | Source |
|---|---|---|
| `CUSTOMER` | User with Individual, Company, or Engineer account category | Account-category synchronization |
| `PROVIDER_OWNER` | Provider-owner identity classification; no provider feature authority yet | Account-category synchronization |
| `WORKER` | Worker identity classification; no worker feature authority yet | Account-category synchronization/provider flow later |
| `ADMIN` | Access-control administration and privileged-audit review | Explicit privileged grant |
| `OPERATIONS` | Staff identity, with later operational permissions deferred | Explicit privileged grant |
| `SUPPORT` | Staff identity, with support behavior deferred | Explicit privileged grant |
| `FINANCE` | Staff identity, with financial behavior deferred | Explicit privileged grant |

Do not seed `MARKETER` in R1-P03; its behavior begins in Release 2.

Account categories and roles remain different concepts. Category-driven grants
are system-managed and cannot be revoked through the staff grant API while the
source category remains attached. Staff grants are explicit and revocable.

Recommended mapping:

- `INDIVIDUAL`, `COMPANY`, or `ENGINEER` -> `CUSTOMER`
- `PROVIDER_OWNER` -> `PROVIDER_OWNER`
- `WORKER` -> `WORKER`

Assign category-derived roles when the category is attached, not only after
verification. Existing `requireFullAuthentication` and authentication policies
remain responsible for verification gates. This preserves verification-only
access to safe self endpoints while preventing role grants from bypassing
R1-P02 security behavior.

### Permission naming and R1-P03 seed catalog

Use stable lowercase `resource.action[_scope]` codes. Seed only permissions
that R1-P03 or existing authentication routes actually consume:

| Permission | Purpose |
|---|---|
| `identity.self.read` | Read the authenticated user's safe identity |
| `identity.sessions.revoke_self` | Log out current/all own sessions |
| `identity.credentials.change_self` | Change own password after existing full-auth gate |
| `identity.categories.enroll_self` | Enroll an additional permitted account category |
| `identity.social_accounts.manage_self` | Link/unlink own Google account under existing policy |
| `access.catalog.read` | Read role and permission catalogs |
| `access.assignments.read` | Read user role assignments |
| `access.assignments.write` | Grant or revoke eligible explicit roles |
| `access.reasons.read` | Read active privileged-action reasons |
| `audit.logs.read` | Read sanitized privileged audit records |
| `provider.proxy.supervisor` | Future provider-scoped supervisor proxy capability |
| `provider.proxy.admin` | Future provider-scoped provider-admin proxy capability |

The two provider proxy permissions are contract placeholders only: they are
not assigned to persisted users until the provider-owning phase can supply a
real same-provider membership fact.

Recommended R1-P03 role matrix:

| Role | Current self permissions | R1-P03 administration permissions |
|---|---|---|
| `CUSTOMER` | All applicable `identity.*_self` permissions | None |
| `PROVIDER_OWNER` | All applicable `identity.*_self` permissions | None |
| `WORKER` | All applicable `identity.*_self` permissions | None |
| `ADMIN` | All applicable `identity.*_self` permissions | All `access.*` plus `audit.logs.read` |
| `OPERATIONS` | All applicable `identity.*_self` permissions | `access.catalog.read`, `access.reasons.read` |
| `SUPPORT` | All applicable `identity.*_self` permissions | `access.catalog.read` |
| `FINANCE` | All applicable `identity.*_self` permissions | `access.catalog.read` |

No later provider, worker, finance, support, or admin operation permission is
seeded early. Owning phases add their own permission codes and role mappings.

### Scopes and ownership

- `SELF`: the target user ID must equal the authenticated principal user ID.
- `GLOBAL`: no tenant/provider restriction, permitted only by an explicit
  global role grant.
- `PROVIDER`: the caller and target resource must resolve to the same provider
  through a provider-owned membership fact; no provider ID is trusted from the
  client alone.
- Supervisor and provider-admin are capabilities of a provider membership, not
  new identity systems and not global staff roles.
- Ownership checks are evaluated after authentication/account-state checks and
  permission checks, with every missing fact denied.

The future provider module should call a narrow contract similar to:

```text
authorization.authorize(principal, {
  permission: "provider.proxy.supervisor",
  ownership: "PROVIDER",
  resource: { providerId, ownerUserId }
})
```

The authorization module evaluates trusted resource facts supplied by the
owning service. It never queries or writes a future provider repository.

### Protected-route declaration

Every protected route should visibly declare:

- authentication level: authenticated or full-authenticated;
- permission code;
- ownership rule: none, self, or provider;
- whether a privileged reason is required for the write.

Existing R1-P02 routes retain their current authentication and verification
gates. Permission/ownership declarations are additive and must not change
request bodies, response envelopes, cookies, JWT claims, status codes, Google
behavior, or email-only verification.

Keep JWTs thin. Do not embed role/permission lists in access tokens. Resolve
current grants from PostgreSQL for protected operations so grant revocation is
authoritative without waiting for token expiry. Do not add Redis caching in
this phase.

## 5. Proposed privileged reasons and audit behavior

### Reason catalog

Seed a small, active catalog:

| Code | Intended use | Details required |
|---|---|---:|
| `STAFF_ONBOARDING` | Initial approved staff access | Yes |
| `RESPONSIBILITY_CHANGE` | Approved role/scope change | Yes |
| `ACCESS_CORRECTION` | Correct an erroneous assignment | Yes |
| `ACCESS_REMOVAL` | Remove access no longer required | Yes |
| `SECURITY_RESPONSE` | Restrict access due to a security event | Yes |
| `INITIAL_BOOTSTRAP` | One-time first-admin bootstrap | Yes |

Reasons are never hard-deleted. Deactivation prevents future use but does not
change historical evidence. The API accepts a reason code plus bounded,
non-secret details; it does not accept an unconstrained replacement reason.

### Audit contract

For every configured privileged write:

1. Authenticate and authorize the actor.
2. Validate the active reason and required details.
3. Load and allowlist a safe before snapshot.
4. Apply the mutation and create the audit record in the same database
   transaction.
5. Store actor, action, target, reason snapshot, safe before/after snapshots,
   request ID, and timestamp.
6. If audit persistence fails, roll back the privileged mutation.

Never include passwords, hashes, tokens, OTPs, cookies, provider credentials,
raw authorization headers, or unrestricted request bodies in audit JSON.
Audit rows are append-only and have no update/delete API.

Extend the existing R1-P01 `audit_logs` model additively; do not replace it or
edit its applied migration. Recommended nullable compatibility fields:

- `reason_id` -> `privileged_action_reasons.id` with delete restriction;
- `before_state` JSON;
- `after_state` JSON.

Keep the existing `reason` text as the immutable reason-code/display snapshot
for old and new rows. Existing audit rows remain valid without a backfill.

The `admin` module continues to own audit persistence and sanitization. The
identity/authentication capability owns roles, permissions, assignments, and
reason configuration. A named role-administration transaction coordinator
must compose the identity assignment repository and the admin audit writer;
neither module may directly access the other's repository.

Recommended denied-attempt behavior: return `PERMISSION_DENIED` without
revealing whether the target exists and emit a safe security event/log. Do not
put every ordinary denial into `audit_logs` unless the human owner explicitly
approves that retention and volume policy.

## 6. Proposed data and API contracts

### Data model

- `roles`: stable unique code, display name/description, system-managed flag,
  active flag, timestamps.
- `permissions`: stable unique code, resource/action description, active flag,
  timestamps.
- `role_permissions`: role/permission pair, unique composite key, timestamps.
- `user_roles`: user, role, source, scope type, nullable scope ID, grant actor
  and time, nullable revoke actor/time; retain history instead of hard delete.
- `privileged_action_reasons`: stable unique code, label/description, active
  flag, details-required flag, timestamps.
- `audit_logs`: preserve current columns and add nullable reason relation plus
  safe before/after JSON.

Use an SQL partial unique index to prevent duplicate active assignments for the
same user, role, and scope. Review the generated SQL explicitly because Prisma
schema syntax does not fully express every PostgreSQL partial-index invariant.

### HTTP APIs

All paths remain under the configured API prefix and use the standard response
and error envelopes.

| Method and path | Permission/ownership | Contract |
|---|---|---|
| `GET /access/roles` | `access.catalog.read`, none | Active role catalog with permission codes; no raw Prisma records |
| `GET /access/permissions` | `access.catalog.read`, none | Active permission catalog |
| `GET /access/role-assignments?userId=...` | `access.assignments.read`, none | Paginated assignment history/current grants |
| `POST /access/role-assignments` | `access.assignments.write`, none, privileged reason required | Grant one approved explicit role/scope idempotently |
| `POST /access/role-assignments/:assignmentId/revoke` | `access.assignments.write`, none, privileged reason required | Revoke an active explicit grant without deleting history |
| `GET /access/privileged-action-reasons` | `access.reasons.read`, none | Active reason codes safe for the actor to select |
| `GET /admin/audit-logs` | `audit.logs.read`, none | Paginated, filterable, sanitized audit evidence |

No role/permission catalog mutation API is proposed in R1-P03. Catalog changes
remain reviewed seed/migration changes until a later approved administration
phase.

### Stable authorization errors

- `AUTHENTICATION_REQUIRED` -> 401
- existing `AUTH_VERIFICATION_REQUIRED` -> current contract
- `PERMISSION_DENIED` -> 403
- `OWNERSHIP_DENIED` -> 403 only if a distinct public code is approved;
  otherwise use `PERMISSION_DENIED` to avoid disclosure
- `PRIVILEGED_REASON_REQUIRED` -> 400
- `PRIVILEGED_REASON_INVALID` -> 400
- `ROLE_ASSIGNMENT_CONFLICT` -> 409
- `ROLE_ASSIGNMENT_NOT_FOUND` -> 404 only after caller authorization

## 7. Decisions requiring human approval

### D1 — R1-P02A completion and R1-P03 activation

Approve R1-P02A as Complete, then separately activate R1-P03. Until both
actions occur, no R1-P03 Spec Kit command should create active artifacts.

### D2 — Provider-scope boundary before R1-P05/R1-P07

**Recommended:** define/test provider-scope contracts and proxy invariants in
R1-P03, but persist no real provider membership or supervisor/provider-admin
flag until the provider-owning phase. Approving a different choice requires an
explicit roadmap/entity-ownership amendment.

### D3 — Role mapping and first-admin bootstrap

Approve the category-to-role mapping above and a one-time, explicit bootstrap
command that grants the first `ADMIN` role to an existing active user, refuses
to run after an active admin exists, requires `INITIAL_BOOTSTRAP`, and writes
the grant plus audit record atomically. Do not auto-promote by email/domain and
do not put a user identifier in normal reference-data seeds.

### D4 — Staff permission matrix

**Recommended:** only `ADMIN` receives access-assignment write authority in
R1-P03. Operations, Support, and Finance are seeded as distinct roles with only
the minimal catalog visibility shown above; their business permissions are
added by their owning later phases.

### D5 — Privileged reasons and audit retention

Approve the initial reason-code catalog, mandatory details, successful-write
audit semantics, and whether denied privileged attempts belong only in safe
security/auth events (recommended) or also in durable `audit_logs`. A retention
or purge period is not canonical; no destructive purge behavior should be
implemented without an approved decision.

## 8. Ordered Spec Kit lifecycle prompts

Run these only after D1 is satisfied and D2-D5 are recorded as approved
decisions. Keep `SPECIFY_FEATURE_DIRECTORY` fixed as
`specs/R1-P03-roles-permissions-privileged-audit` because this repository uses
roadmap phase names rather than Spec Kit's automatic numeric folder name.

### 1. Specify

```text
Use speckit-specify for exactly one feature with
SPECIFY_FEATURE_DIRECTORY=specs/R1-P03-roles-permissions-privileged-audit.

Create the business specification for R1-P03 — Roles, Permissions &
Privileged Audit. First verify docs/product/current.md shows R1-P02A Complete,
R1-P03 explicitly activated, and no other phase active. Use only the R1-P03
roadmap section, approved decisions D2-D5 recorded in decision-log.md, and the
locked product rules cited by this preparation report.

Specify multi-role users, authoritative permission checks, explicit route
permission/ownership declarations, safe self/global/provider scope semantics,
staff-role separation, privileged reasons, atomic before/after audit evidence,
and the authorization test matrix. Preserve all completed R1-P02 auth behavior.
Exclude provider/worker operations, finance behavior, support behavior, general
admin features, marketer scope, caches, queues, notifications, payments,
realtime, and every future-phase table or endpoint.

Create spec.md and checklists/requirements.md. Mark no more than three truly
material product ambiguities and do not invent their answers. Do not create a
branch, implement code, commit, push, deploy, or run a production migration.
```

### 2. Clarify

```text
Use speckit-clarify on the active R1-P03 spec. Verify the phase pointer first.
Prioritize only ambiguities that materially change scope, security, data shape,
or acceptance tests: provider-scope timing, category-to-role synchronization,
first-admin bootstrap, staff permission separation, and denied-attempt/audit
retention behavior. Ask at most five questions, one at a time, recommend the
least-privilege/no-future-leak choice, and encode each approved answer directly
into spec.md and its requirements checklist. Stop rather than inventing a
product rule. Do not plan or implement yet.
```

### 3. Plan

```text
Use speckit-plan for the clarified R1-P03 specification. Follow the current
compact TypeScript/Express modular-monolith structure. Treat the existing
authentication module as the identity capability owning roles, permissions,
assignments, reasons, and authorization policy. Keep audit persistence and
sanitization in the admin module. Define the smallest named public service
contracts and explicitly name the transaction owner for atomic role changes
plus audit evidence; prohibit cross-module repository or raw Prisma access.

Keep JWT claims unchanged and load authoritative grants from PostgreSQL; do not
add Redis. Preserve every R1-P02 endpoint, cookie, token, verification-only,
Google Individual, email-only verification, and response/error contract.

Generate plan.md, research.md, data-model.md, contracts for the HTTP and module
APIs, and quickstart.md. Plan only incremental schema changes for roles,
permissions, role_permissions, user_roles, privileged_action_reasons, and
additive audit_logs fields. Name the new migration
r1_p03_roles_permissions_privileged_audit, require generated SQL review, a
clean test-database migration, double-seed proof, and earlier-phase
compatibility. Do not edit an applied migration or add future provider tables.
Repeat the Constitution Check after design and stop on any failed gate.
```

### 4. Tasks

```text
Use speckit-tasks for the completed R1-P03 spec and plan. Generate a strict,
dependency-ordered tasks.md with exact file paths and tests before behavior.
Organize independently testable vertical slices for: schema/migration and
idempotent seeds; category-derived multi-role compatibility; permission and
ownership enforcement on existing protected routes; explicit staff grant and
revoke flows; privileged reasons plus atomic before/after audit; provider-scope
policy contract tests without provider persistence; API/OpenAPI/Postman
contracts; and final quality/convergence evidence.

Include unit, integration, authorization-matrix, negative, transaction rollback,
secret-redaction, migration, clean-database, double-seed, boundary, auth
regression, OpenAPI, documentation, coverage, typecheck, lint, and build tasks.
Every user-story task must carry its story label and exact path. Do not create
tasks for later provider, worker, support, finance, admin, payment, queue,
notification, cache, realtime, Docker, or cloud behavior.
```

### 5. Analyze

```text
Use speckit-analyze after tasks.md exists. Perform a strictly read-only
cross-artifact analysis of R1-P03 spec.md, plan.md, and tasks.md against the
Cleanora constitution. Treat future-phase leakage, missing protected-route
declarations, stale JWT permission claims, non-atomic privileged audit,
cross-module repository access, unreviewed migration risk, missing auth
regression coverage, and any unmapped roadmap Done When item as HIGH or
CRITICAL as appropriate. Report coverage metrics and concrete remediation; do
not modify files or begin implementation.
```

### 6. Implement

```text
Use speckit-implement only after the human owner approves the analyzed R1-P03
artifacts and every checklist passes. Implement tasks.md in order with tests
first. Stay inside R1-P03 and the current compact backend structure. Preserve
R1-P02 authentication contracts, use named module services, keep business rules
out of shared code, and make privileged mutation plus audit evidence atomic.

Update prisma/schema.prisma incrementally and create only the new phase-owned
migration r1_p03_roles_permissions_privileged_audit. Review its SQL before
applying it to an isolated test database. Never edit an applied migration and
never run a production migration. Mark tasks complete only with evidence. Run
all specified quality gates. Do not commit, push, merge, deploy, or implement
future provider/worker/finance/support/admin features.
```

### 7. Converge

```text
Use speckit-converge only after the first R1-P03 implementation pass. Compare
the present codebase against R1-P03 spec.md, plan.md, tasks.md, and the
constitution. Pay special attention to every protected route, role/permission
seed idempotency, grant revocation authority, provider-boundary denial,
privileged reason validation, before/after redaction, audit rollback,
migration/seed compatibility, and R1-P02 regressions. If gaps exist, append one
new Convergence phase to tasks.md without rewriting existing tasks, then run a
separately authorized implement pass. If no gaps exist, leave tasks.md
byte-for-byte unchanged. Do not commit or push.
```

### 8. Review

```text
Act as Cursor Claude under CLAUDE.md and review the complete R1-P03 Git diff
against the active spec.md, plan.md, tasks.md, checklists, constitution, and
this phase's approved decisions. Use docs/ai/templates/review-report.md.

Verify module ownership and named contracts; no cross-module repositories;
transaction ownership for role changes plus audit; deny-by-default permission
and ownership checks on every protected endpoint; same-provider proxy policy;
least-privilege staff separation; reason enforcement; safe before/after audit;
append-only history; Prisma schema and generated migration SQL; idempotent
seeds; clean migration and earlier-phase compatibility; full R1-P02 auth
regression; API/OpenAPI/Postman accuracy; and absence of future-phase features.

Every finding must include severity, exact file/line evidence, violated
criterion, impact, and focused remediation. Separate blockers/majors, minors,
questions, and checks not run. Do not rewrite the implementation, commit, push,
merge, deploy, or run a production migration.
```

## 9. Next authorized action

The human owner should first approve or reject R1-P02A completion. If approved,
update the phase evidence/pointer without activating R1-P03 in the same implied
step. Then approve D2-D5, record those decisions, explicitly activate R1-P03,
and start with the Specify prompt above.

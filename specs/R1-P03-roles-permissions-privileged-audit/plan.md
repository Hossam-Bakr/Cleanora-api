# Implementation Plan: R1-P03 — Roles, Permissions & Privileged Audit

**Branch**: `R1-P03-roles-permissions-privileged-audit` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/R1-P03-roles-permissions-privileged-audit/spec.md` (clarification complete)

**Note**: Historical R1-P03 planning artifact. At this recorded point no runtime,
schema, migration, seed, or test implementation was authorized until a fresh
`/speckit.analyze` passed and the human owner approved. Those later gates and
implementation completed; R1-P03 is now Complete and this plan does not describe
the current active phase.

## Summary

Make authorization authoritative for customer, provider, worker, and staff operations without changing completed authentication contracts. Seed finite identity-owned role/permission/reason definitions; expose internal evaluation and privileged role-management contracts only; append admin-owned audit evidence atomically with role-grant mutations; prove behavior with an authorization matrix and authentication regression suite.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js (repository current LTS target)

**Primary Dependencies**: Express, Prisma 7, Zod, Vitest, existing authentication/admin modules

**Storage**: PostgreSQL via Prisma; one database; new phase-owned migration only

**Testing**: Vitest unit + integration; no E2E suite; no Docker/Testcontainers

**Target Platform**: Modular-monolith backend API process

**Project Type**: Web-service backend (modular monolith)

**Performance Goals**: Authorization checks complete within normal request handling; no authorization caching layer in R1-P03

**Constraints**:
- Deny-by-default; no client-trusted roles/permissions/scope
- No public R1-P03 endpoints; auth endpoints remain auth-only (FR-028)
- No auto user-role grants or staff bootstrap (FR-027)
- Identity must not write `audit_logs` directly
- Applied migrations immutable; forward migration `r1_p03_roles_permissions_privileged_audit` only
- No Redis, queues, Socket.IO, Docker, cloud, wallets, or later-phase modules

**Scale/Scope**: Finite FR-002 / FR-026 catalogs; internal contracts + matrix tests; five new tables; admin audit integration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design and after analyze remediation.*

### Pre-design (before research/data-model/contracts)

| Principle | Status | Evidence |
|---|---|---|
| I. Standalone greenfield | PASS | Repository-local spec/plan only; no external app dependency |
| II. One active phase + traceability | PASS | Historical planning state: `docs/product/current.md` recorded R1-P03 In Progress; plan traces to clarified `spec.md` |
| III. Modular monolith ownership | PASS | Identity owns authz tables; admin owns audit via infrastructure factory seam; no barrels/God service planned |
| IV. Global design, local incremental migration | PASS | Only R1-P03 tables; migration name fixed; no early provider/worker models |
| V. Canonical product truth / no invention | PASS | Clarifications Session 2026-08-03 resolves catalog, interim scope, surface, reasons, grants, auth-only endpoints |
| VI. Backend authority & security | PASS | Deny-by-default, privileged reasons, atomic audit, no client trust |
| VII. Risk-proportional testing | PASS | Matrix, atomic rollback, seed idempotency, auth regression planned |
| VIII. Human-controlled operations | PASS | Plan does not implement, commit, deploy, or migrate |
| IX. Locked release boundaries | PASS | No Docker/cloud/wallet work |
| X. Immutable migrations / phase-owned data | PASS | New forward migration only; no edit of applied migrations |

**Pre-design gate**: PASS — no unjustified violations.

### Post-design (after research, data-model, contracts, quickstart) — revised 2026-08-03 (analyze remediation)

| Principle | Status | Notes |
|---|---|---|
| I–X | PASS | Composition/infrastructure seam injects admin Prisma audit-writer factory into identity UoW; no `AdminAuditUnitOfWorkScope`; Prisma types stay out of application/domain/public contracts; audit_logs frozen; no definition activation invention; no public endpoints; no future-phase tables; seed via `npm run seed` only |

**Post-design gate**: PASS — planning/task remediation ready for a fresh `/speckit.analyze` (not implementation).

## Project Structure

### Documentation (this feature)

```text
specs/R1-P03-roles-permissions-privileged-audit/
├── activation.md
├── spec.md
├── plan.md                 # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── README.md
│   ├── authorization-evaluation.md
│   ├── role-management.md
│   ├── privileged-reason.md
│   ├── protected-operation.md
│   ├── privileged-audit.md
│   └── transaction-coordination.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (planned; not implemented here)

```text
src/
├── composition.ts                          # inject createPrismaPrivilegedAuditWriter into PrismaRoleManagementUnitOfWork
├── modules/
│   ├── authentication/                     # identity ownership (canonical)
│   │   ├── auth.module.ts                  # unchanged public auth composition surface
│   │   ├── domain/authentication.types.ts  # AuthenticationPrincipal unchanged
│   │   ├── domain/authorization.catalog.ts
│   │   ├── domain/authorization.types.ts
│   │   ├── domain/authorization.errors.ts
│   │   ├── domain/authorization.ports.ts   # business identity store ports
│   │   ├── authorization.service.ts        # effective permissions + authorize()
│   │   ├── authorization.policy.ts         # ownership/scope pure rules
│   │   ├── role-management.service.ts      # workflow owner (transition matrix)
│   │   ├── role-management.unit-of-work.ts # RoleManagementUnitOfWork port + context types
│   │   └── infrastructure/
│   │       ├── authorization.repository.ts # non-tx reads for evaluation when needed
│   │       └── prisma-role-management.unit-of-work.ts
│   └── admin/
│       ├── audit.service.ts                # existing validation/redaction + PrivilegedAuditWriter business types
│       └── infrastructure/
│           └── prisma-privileged-audit.writer.ts  # createPrismaPrivilegedAuditWriter(transaction) only
├── database/                               # existing Prisma lifecycle only
└── shared/                                 # no authorization business rules
prisma/
├── schema.prisma                           # add five identity models in implementation phase
├── migrations/r1_p03_roles_permissions_privileged_audit/
└── seed.ts                                 # idempotent definition upserts only; run via npm run seed
tests/
├── unit/.../authorization-*.test.ts
└── integration/.../authorization-*.test.ts
```

**Structure Decision**: Extend the existing authentication module as identity. Admin remains the sole mapper/writer of `audit_logs` through an infrastructure-only Prisma audit-writer factory injected at composition into `PrismaRoleManagementUnitOfWork`. No new top-level module, no shared business authz, no public routes.

## Module ownership and dependency direction

| Concern | Owner | Public consumer contract |
|---|---|---|
| Roles, permissions, role_permissions, user_roles, privileged_action_reasons | Identity (`authentication` module) | Internal evaluation + role-management services |
| Users / AuthenticationPrincipal | Identity (existing) | Unchanged |
| audit_logs append | Admin | Business `PrivilegedAuditWriter` via unit-of-work context; Prisma mapping only in admin infrastructure factory |
| HTTP auth endpoints | Identity (existing) | Unchanged; no R1-P03 permission wrapping |

**Application contracts** (no Prisma types):

- `RoleManagementService` depends on `AuthorizationService` for authorization evaluation and `RoleManagementUnitOfWork` for its transactional persistence workflow; it has no Prisma dependency.
- `RoleManagementUnitOfWorkContext` exposes business-level identity stores and `PrivilegedAuditWriter`.
- No Prisma types exist in role-management, authorization, domain, or public application contracts.

**Dependency direction**:

```text
composition
  → PrismaRoleManagementUnitOfWork
  → transaction-scoped authentication stores
  → injected admin Prisma audit-writer factory

RoleManagementService sees only:
  grants | roles | reasons | users | audit
```

- `composition.ts` imports both infrastructure constructors and injects `createPrismaPrivilegedAuditWriter` into `PrismaRoleManagementUnitOfWork`.
- Prisma transaction types are permitted only at the composition/infrastructure construction seam.
- They must never appear in `RoleManagementService`, `RoleManagementUnitOfWork`, `RoleManagementUnitOfWorkContext`, domain ports, or future caller contracts.
- No authentication application/domain file may import `prisma-privileged-audit.writer.ts`.
- No `any`, `unknown`, type assertion, global transaction state, `AsyncLocalStorage`, outbox, or hidden fallback client may be used on the transaction path.
- Admin remains the sole `audit_logs` mapper/writer.
- This composition/infrastructure seam is **not** a public business-module API.

## Transaction design

**Workflow owner**: `RoleManagementService` (identity) — owns authorize → validate → transition decision → mutate/no-op → audit-if-mutated order and commit requirements.

**Transaction mechanics owner**: `PrismaRoleManagementUnitOfWork` — opens `getPrismaClient().$transaction`, builds business-level context ports, never exposes Prisma types to the service.

**Application port**: `RoleManagementUnitOfWork.run(work)` supplying:

- identity grant/role/reason/user ports
- admin `PrivilegedAuditWriter`

**Authentication infrastructure** — planned file
`src/modules/authentication/infrastructure/prisma-role-management.unit-of-work.ts`:

1. Opens `getPrismaClient().$transaction`.
2. Creates transaction-scoped identity stores.
3. Receives an infrastructure-only transaction audit-writer factory through constructor injection.
4. Calls the injected factory with the active transaction and receives a `PrivilegedAuditWriter`.
5. Never accesses `transaction.auditLog` or maps audit persistence.

**Admin infrastructure** — planned file
`src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`:

1. Exports infrastructure-only factory `createPrismaPrivilegedAuditWriter(transaction)`.
2. This factory alone maps safe audit input and calls `transaction.auditLog.create`.
3. Returns the business-level `PrivilegedAuditWriter`.
4. Reuses existing audit validation/redaction behavior from `audit.service.ts`.
5. No authentication application/domain file may import this file.

**Atomic privileged role-management sequence** (one short DB transaction, only when a mutation may occur after validation):

1. Authorize trusted actor (`AuthenticationPrincipal` + enabled grants + required `authz.roles.*` + account state + anti self-escalation).
2. Validate target user, role code (seeded catalog; no definition `isActive`), and exact **active** operation-bound privileged reason.
3. Load grant before state and apply the exact transition matrix (see data-model / role-management contracts).
4. If illegal transition → reject (no mutation, no audit).
5. If authorized no-op → return success without audit.
6. If real mutation → apply identity-owned `user_roles` change, then append admin-owned audit evidence via `ctx.audit` (safe before/after only).
7. Commit only if mutation and audit both succeed; audit failure rolls back the mutation.

**Failure / rollback**:
- Validation/authorization/illegal transition: no mutation, no audit.
- Authorized no-op: no mutation, no audit.
- Audit append failure after mutation: full rollback.
- Callers never receive raw Prisma rows, audit rows, or sensitive before/after payloads.
- Identity never calls `tx.auditLog` directly.

**Why no outbox**: Same PostgreSQL database; privileged grants require immediate consistency between grant state and audit evidence.

**audit_logs freeze**: R1-P03 makes no structural or index change to `audit_logs`. Later audit schema work needs a separately approved plan change.

## Data and migration

**Migration name**: `r1_p03_roles_permissions_privileged_audit`
**Action**: Forward-only. Do not edit applied migrations.
**Models**: See [data-model.md](./data-model.md) for `roles`, `permissions`, `role_permissions`, `user_roles`, `privileged_action_reasons`.
**Unchanged / frozen**: Existing `audit_logs` (admin-owned) — no structural or index changes in R1-P03.
**Definition lifecycle**: No `roles.isActive` or `permissions.isActive`. Assignment lifecycle lives only on `user_roles.status`. `privileged_action_reasons.isActive` remains.
**No** `user_roles.assignedByUserId`.

## Seed plan

Idempotent definition seeding:

- **File**: `prisma/seed.ts`
- **Command**: `npm run seed` (do **not** use `npm run db:seed`; that script does not exist)
- Upsert all FR-002 roles and permissions by stable `code`
- Upsert FR-002 role-permission map by `(role_code, permission_code)`
- Upsert FR-026 privileged reasons by `code` with operation binding + `isActive=true`
- Running `npm run seed` **twice** must be validated explicitly (same definitions, no duplicates)
- **Never** seed user-role assignments, customer/staff grants, users, provider memberships, worker records, or later-phase permissions/reasons

## Internal contracts

Documented under [contracts/](./contracts/):

- Effective-permission evaluation
- Permission + ownership/scope authorization
- Role assign / revoke / enable / disable
- Privileged-reason validation
- Protected-operation declaration
- Safe audit append (admin)
- Transaction coordination

## Authentication compatibility

- Do not modify OpenAPI, Postman, cookies, tokens, sessions, envelopes, or frontend auth contracts
- Do not wrap existing auth endpoints with R1-P03 permissions
- `AuthenticationPrincipal` public shape unchanged; authorization consumes it as trusted input
- Auth regression suite must pass without `customer` / `resource.self.*` grants

## Testing and quality gates (implementation phase)

**Unit**: authorization matrix; multi-role effective permissions; disabled/revoked grants; revocation freshness (no cache); self-escalation; staff separation; ownership allow/deny; cross-provider denial; synthetic provider/worker scope; production deny without real scope records; reason missing/unknown/inactive/unauthorized/mismatched; safe audit redaction helpers; trusted-principal-only authority; positive allow path

**Integration**: atomic rollback when audit append fails; idempotent definition seed; clean chronological migration apply; earlier migration compatibility; authentication regression suite; auth endpoints without customer roles; unauthenticated denial via existing middleware before R1-P03 protected operations

**Gates** (implementation validation; no CI/CD/E2E/Docker/Testcontainers):

```bash
git diff --check
npm run prisma:generate
npm run prisma:validate
npm run db:validate-clean-migration
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run openapi:validate
npm run docs:check
npm run build
npm run seed
npm run seed
```

Also validate `npm run seed` twice for idempotent definitions (two consecutive runs recorded).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Composition/infrastructure seam: `composition.ts` injects admin `createPrismaPrivilegedAuditWriter` into `PrismaRoleManagementUnitOfWork` | Privileged grants require atomic identity mutation + admin-owned audit mapping without Prisma leakage into application/domain contracts | Identity writing `audit_logs` violates ownership; undefined `AdminAuditUnitOfWorkScope` was underspecified; opaque bindings were underspecified; non-atomic audit leaves unaudited grants; putting Prisma types on `RoleManagementUnitOfWork` would leak persistence into business contracts |

This seam is justified composition/infrastructure wiring only. It is **not** a public business-module API.

## Implementation readiness

- Spec clarifications: complete
- Plan / research / data-model / contracts / quickstart: complete
- Tasks: regenerated after analyze remediation (2026-08-03)
- Next: fresh `/speckit.analyze`, then human-authorized implementation only if analyze is clean
- Stop conditions for implementers: any new product decision not in clarifications → escalate; do not invent

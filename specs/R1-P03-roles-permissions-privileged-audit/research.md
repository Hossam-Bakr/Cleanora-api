# R1-P03 Research

**Phase**: R1-P03 — Roles, Permissions & Privileged Audit  
**Date**: 2026-08-03 (revised — analyze remediation)  
**Status**: Complete — planning unknowns resolved; no NEEDS CLARIFICATION markers

## R1. Canonical identity ownership for authorization

**Decision**: Keep R1-P03 authorization and role-management behavior inside the existing `src/modules/authentication/` module as the identity capability. Do not create a separate top-level `authorization` module for this phase.

**Rationale**: Entity ownership assigns tables to identity; current backend already places identity under `authentication/`; no public HTTP surface justifies a new module.

**Alternatives considered**: New `authorization` module; authorization in `shared/` — both rejected.

## R2. Executable unit-of-work (composition/infrastructure audit seam)

**Decision**: Introduce application port `RoleManagementUnitOfWork` with business-level context ports (`grants`, `roles`, `reasons`, `users`, `audit`). Implement `PrismaRoleManagementUnitOfWork` that opens `getPrismaClient().$transaction`, builds transaction-scoped identity adapters, and obtains `PrivilegedAuditWriter` by calling an **injected** admin infrastructure factory `createPrismaPrivilegedAuditWriter(transaction)`.

Exact rules:

- `RoleManagementService` depends only on `RoleManagementUnitOfWork`.
- `RoleManagementUnitOfWorkContext` exposes business-level identity stores and `PrivilegedAuditWriter`.
- No Prisma types exist in role-management, authorization, domain, or public application contracts.
- Planned authentication infrastructure file: `src/modules/authentication/infrastructure/prisma-role-management.unit-of-work.ts`
- Planned admin infrastructure file: `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`
- Composition (`src/composition.ts`) imports both infrastructure constructors and injects the admin factory into the identity UoW.
- Prisma transaction types are permitted only at this composition/infrastructure seam.
- The UoW never accesses `transaction.auditLog` or maps audit persistence.
- The admin factory alone maps safe audit input, reuses existing validation/redaction, and calls `transaction.auditLog.create`.
- No authentication application/domain file may import the admin Prisma writer file.
- Forbidden on the transaction path: `any`, `unknown`, type assertion escape hatches, global transaction state, `AsyncLocalStorage`, outbox, hidden fallback client.
- `AdminAuditUnitOfWorkScope` is **not** used (removed as underspecified).

**Rationale**: Satisfies atomic cross-module writes while keeping Prisma types out of application services and keeping admin as the sole `audit_logs` mapper.

**Alternatives considered**: Opaque binding token / `AdminAuditUnitOfWorkScope` — rejected as underspecified. Identity writing `audit_logs` — rejected. Outbox — rejected for immediate consistency. Prisma types on application ports — rejected (boundary leak).

## R3. User-role lifecycle without definition activation flags

**Decision**: One `user_roles` row per `(user_id, role_id)` with `ENABLED|DISABLED|REVOKED`. Exact transition matrix in data-model/role-management contracts. No `roles.isActive` / `permissions.isActive`. Effective permissions = ENABLED grants joined to seeded role-permission definitions. No `assignedByUserId`; actor history is audit-only.

**Rationale**: Matches clarified product rules; avoids unapproved definition lifecycle and duplicated incomplete actor history.

## R4. Provider/worker scope without later-phase tables

**Decision**: Synthetic scope facts in tests only; production denies when real membership/worker records would be required. No provider/worker tables/workflows.

## R5. Public API surface

**Decision**: Zero new public endpoints; OpenAPI/Postman unchanged; auth endpoints remain authentication-protected only (FR-028).

## R6. Seed strategy and command

**Decision**: Extend `prisma/seed.ts` with idempotent upserts. Stable command: `npm run seed`. Never document `npm run db:seed` (script does not exist). Never seed `user_roles`. Authorization catalog constants must exist before seed consumes them.

## R7. Authorization caching

**Decision**: No authorization result cache in R1-P03.

## R8. audit_logs freeze

**Decision**: R1-P03 makes no structural or index change to `audit_logs`. Later changes need a separately approved plan change.

## R9. Staff sample surface (no workflow leakage)

**Decision**: Staff sample coverage consists only of four finite protected-operation declarations, permission mapping, pure authorization policy tests, and synthetic privileged-reason validation when applicable. `staff_sample_privileged_write` remains a seeded reason and synthetic policy case only. Do not add a staff business write, a `RoleManagementService` sample method, a public endpoint, or provider/worker/finance/support/admin runtime workflows beyond declaration/policy tests.

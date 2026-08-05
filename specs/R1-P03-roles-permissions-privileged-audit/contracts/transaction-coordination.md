# Contract: Transaction Coordination & Unit of Work

**Workflow owner**: Identity `RoleManagementService`  
**Transaction mechanics owner**: `PrismaRoleManagementUnitOfWork` adapter  
**Database**: Single PostgreSQL database  
**Pattern**: One short `$transaction` — **no outbox**, no external I/O

## Application contracts (no Prisma types)

```text
RoleManagementService
  → depends only on RoleManagementUnitOfWork

RoleManagementUnitOfWork.run<T>(
  work: (ctx: RoleManagementUnitOfWorkContext) => Promise<T>
): Promise<T>
```

`RoleManagementUnitOfWorkContext` (business-level only) supplies:

| Port | Purpose |
|---|---|
| `grants` | Load/create/update `user_roles` by business fields |
| `roles` | Resolve seeded role by `code` |
| `reasons` | Load privileged reason by `code` for validation |
| `users` | Confirm target user exists (identity-owned lookup) |
| `audit` | `PrivilegedAuditWriter.append(safeInput)` — admin-owned writer |

**Must not expose** to `RoleManagementService`, domain ports, or future caller contracts:

- Prisma client
- Prisma transaction type
- Raw Prisma models
- Admin repository or `auditLog` delegate
- `any` / `unknown` / type-assertion escape hatches
- Global transaction state, `AsyncLocalStorage`, outbox, or hidden fallback client

## Authentication infrastructure: `PrismaRoleManagementUnitOfWork`

Planned file: `src/modules/authentication/infrastructure/prisma-role-management.unit-of-work.ts`

Behavior:

1. Open `getPrismaClient().$transaction(async (tx) => { ... })`
2. Construct transaction-scoped identity persistence adapters that use `tx` only for identity tables
3. Call the **constructor-injected** admin infrastructure factory with the active transaction and receive a `PrivilegedAuditWriter`
4. Pass only `RoleManagementUnitOfWorkContext` into the callback
5. Commit on callback success; rollback on thrown errors
6. Never access `transaction.auditLog` / `tx.auditLog` and never map audit persistence

## Admin infrastructure: `createPrismaPrivilegedAuditWriter`

Planned file: `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`

```text
createPrismaPrivilegedAuditWriter(transaction) → PrivilegedAuditWriter
```

Rules:

- Infrastructure-only factory (not a public business-module API)
- Alone maps safe audit input and calls `transaction.auditLog.create`
- Returns the business-level `PrivilegedAuditWriter`
- Must reuse existing audit validation/redaction behavior from `src/modules/admin/audit.service.ts`
- No authentication application/domain file may import this file

`AdminAuditUnitOfWorkScope` is **not** part of this contract (removed).

## Composition seam

Planned file: `src/composition.ts`

```text
composition
  → PrismaRoleManagementUnitOfWork
  → transaction-scoped authentication stores
  → injected admin Prisma audit-writer factory
```

- Composition imports both infrastructure constructors
- Composition injects `createPrismaPrivilegedAuditWriter` into `PrismaRoleManagementUnitOfWork`
- Prisma transaction types are permitted **only** at this composition/infrastructure construction seam
- This seam is justified wiring only; it is not a public business-module API

## Workflow sequence inside `RoleManagementService`

```text
unitOfWork.run(async (ctx) => {
  1. authorize actor (permission, account state, anti self-escalation)
  2. validate target, role code, exact active operation-bound reason
  3. load grant before state via ctx.grants
  4. if illegal transition → reject (no mutation, no audit)
  5. if authorized no-op → return success with mutated=false (no audit)
  6. if real mutation → apply via ctx.grants
  7. append audit via ctx.audit (safe before/after only)
  8. return success with mutated=true, auditAppended=true
})
// any throw after mutation including audit failure → rollback
```

`RoleManagementService` sees only: grants, roles, reasons, users, audit.

## Ownership and dependency direction

```text
composition.ts
  → imports PrismaRoleManagementUnitOfWork
  → imports createPrismaPrivilegedAuditWriter
  → injects factory into PrismaRoleManagementUnitOfWork
  → injects unit of work into RoleManagementService

RoleManagementService
  → depends on RoleManagementUnitOfWork (port)
  → depends on AuthorizationService (effective permissions)
  → does NOT import Prisma types
  → does NOT import admin infrastructure
  → does NOT import admin repositories

PrismaRoleManagementUnitOfWork (authentication/infrastructure)
  → getPrismaClient().$transaction
  → identity tx repositories
  → injected createPrismaPrivilegedAuditWriter(tx)

admin/infrastructure/prisma-privileged-audit.writer.ts
  → sole mapper/writer for audit_logs inside the transaction
```

Admin remains the sole `audit_logs` mapper/writer.

## Failure semantics

| Failure | Result |
|---|---|
| Authorization / validation / illegal transition | No mutation; no audit; no commit of privileged write |
| Authorized no-op | No mutation; no audit |
| Grant mutation failure | Rollback |
| Audit append failure after mutation | Rollback grant mutation |
| Commit failure | Rollback |

## Success semantics

- Real mutation + successful audit ⇒ both durable
- Authorized no-op ⇒ grant unchanged; no new audit row

## Test obligation

Integration test must force audit append failure after a would-be successful mutation and assert the grant state was not committed.

Boundary tests must prove:

- `RoleManagementService` imports no Prisma type
- Authentication domain/application files import no admin infrastructure
- Authentication code contains no `auditLog` delegate access
- Only admin Prisma audit infrastructure maps/writes `audit_logs`
- No `any`/`unknown` escape hatch exists in the transaction path

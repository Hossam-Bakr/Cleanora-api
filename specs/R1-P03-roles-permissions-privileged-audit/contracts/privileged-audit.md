# Contract: Privileged Audit Append (Admin)

**Owner**: Admin module  
**Business types / validation**: `src/modules/admin/audit.service.ts`  
**Prisma writer factory**: `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`  
**Consumers**: Identity role-management **only** via `PrivilegedAuditWriter` supplied inside `RoleManagementUnitOfWorkContext`

## Goal

Append durable privileged-action evidence to existing `audit_logs` without
exposing Prisma models or allowing identity to write admin tables directly.

## Schema freeze

R1-P03 makes **no** structural or index change to `audit_logs`. Any later audit
schema change requires a separately approved plan change.

## Public input (safe)

| Field | Type | Rules |
|---|---|---|
| `actorType` | `USER` \| `SYSTEM` \| `UNKNOWN` | Usually `USER` |
| `actorId` | string optional | Trusted actor user id |
| `action` | string | e.g. `identity.roles.assign` |
| `targetType` | string | e.g. `user_role` |
| `targetId` | string optional | Grant id or target user id |
| `reason` | string | Validated privileged reason code |
| `context` | object optional | Safe before/after only; **reject secret-like keys** |
| `requestId` | string optional | Correlation id |

Safe before/after examples: role code, grant status, timestamps. Never passwords,
tokens, cookies, OTPs, raw credentials.

## Ports

### Non-transactional (existing pattern)

- `writeAudit(input)` / `writeAuditWith(writer, input)` — remain for non-tx uses

### Transactional (R1-P03)

Business interface used by `RoleManagementService` through unit-of-work context:

```text
interface PrivilegedAuditWriter {
  append(input: SafePrivilegedAuditInput): Promise<PrivilegedAuditAck>
}
```

- Lives as a business-level type (admin business surface / shared audit types in `audit.service.ts`)
- Identity application/domain consume only this business interface through `RoleManagementUnitOfWorkContext`
- Public types consumed by `RoleManagementService` must not require Prisma client or Prisma model types

### Infrastructure-only factory (composition seam)

Planned file: `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`

```text
createPrismaPrivilegedAuditWriter(transaction) → PrivilegedAuditWriter
```

Rules:

- Called only through constructor injection into `PrismaRoleManagementUnitOfWork` from `src/composition.ts`
- Admin factory alone maps fields onto `audit_logs` and executes `transaction.auditLog.create`
- Must reuse existing audit validation/redaction behavior from `audit.service.ts`
- No authentication application/domain file may import this factory file
- Prisma transaction types are permitted only at the composition/infrastructure seam
- `AdminAuditUnitOfWorkScope` is **not** used

Identity never calls `transaction.auditLog` / `tx.auditLog`.

Admin remains the sole `audit_logs` mapper/writer.

## When to append

- Append **only** after a real `user_roles` state mutation succeeds in the same unit of work
- Authorized no-ops must **not** append

## Output

| Field | Type |
|---|---|
| `id` | string |
| `createdAt` | ISO string |

Role-management external results omit audit payloads.

## Failure

Invalid input or persistence failure rejects. The unit of work rolls back the grant mutation.

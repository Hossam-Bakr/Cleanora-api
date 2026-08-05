# R1-P03 Internal Contracts

These contracts are **internal application contracts** for the modular monolith.
They are not public HTTP APIs. R1-P03 adds no public endpoints and does not
change OpenAPI or Postman documents.

| Contract | File |
|---|---|
| Effective-permission evaluation | [authorization-evaluation.md](./authorization-evaluation.md) |
| Permission + ownership/scope authorization | (same) |
| Role assign / revoke / enable / disable | [role-management.md](./role-management.md) |
| Privileged-reason validation | [privileged-reason.md](./privileged-reason.md) |
| Protected-operation declaration | [protected-operation.md](./protected-operation.md) |
| Safe audit append (admin) | [privileged-audit.md](./privileged-audit.md) |
| Unit of work + transaction coordination | [transaction-coordination.md](./transaction-coordination.md) |

## Boundary rules

- Callers pass trusted `AuthenticationPrincipal` (or test double), never
  client-supplied roles/permissions/scope.
- Callers must not receive raw Prisma records, audit persistence rows, or
  sensitive before/after evidence.
- Identity owns role/grant/reason persistence; admin owns `audit_logs` writes.
- `RoleManagementService` depends only on `RoleManagementUnitOfWork` and sees
  only business ports: grants, roles, reasons, users, audit.
- Prisma transaction types exist only at the composition/infrastructure seam
  that injects `createPrismaPrivilegedAuditWriter` into
  `PrismaRoleManagementUnitOfWork`. That seam is not a public business-module
  API.
- No authentication application/domain file may import
  `src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts`.
- Existing authentication endpoints are outside these contracts’ enforcement
  surface (FR-028).

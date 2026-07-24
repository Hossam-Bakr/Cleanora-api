# Contract — Audit Foundation Public API

**Phase**: R1-P01  
**Owner module**: `admin`  
**Entry**: `src/modules/admin/index.ts` only  
**Extension**: R1-P03 may extend privileged authorization audit behavior without changing ownership

## Types (conceptual)

```ts
type AuditActorType = "USER" | "SYSTEM" | "UNKNOWN";

interface WriteAuditInput {
  actorType: AuditActorType;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  context?: Record<string, unknown>; // safe metadata only
  requestId?: string;
}

interface AuditRecord {
  id: string;
  actorType: AuditActorType;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  context?: Record<string, unknown>;
  requestId?: string;
  createdAt: string; // ISO timestamp
}
```

## Required operations

| Operation | Behavior |
|---|---|
| `writeAudit(input)` | Append one audit row; on persistence failure **reject/throw** (fail closed). Never silently discard. |
| `getAuditById(id)` (optional P01) | Read DTO for tests/diagnostics; not a public HTTP admin console |

## Rules

- Append-only: no update/delete in public API.
- No `updatedAt` semantics.
- Context MUST NOT contain credentials, tokens, cookies, OTPs, or raw secrets.
- Do not implement privileged authorization workflows, before/after diff product UX, or staff reason catalogs in R1-P01 (R1-P03).
- Raw Prisma `AuditLog` MUST NOT be exported.

## Failure semantics

If `writeAudit` cannot persist, callers that require evidence must abort their unit of work. Foundation tests prove fail-closed behavior with a fault injection or constrained DB case where feasible without Docker theatrics.

# Contract: Role Management (Internal)

**Owner**: Identity `RoleManagementService` (workflow order owner)  
**Surface**: Internal application contract only — **no public HTTP endpoints**  
**Persistence access**: Only through `RoleManagementUnitOfWork` business ports (see [transaction-coordination.md](./transaction-coordination.md))

## Shared command fields

Every privileged role-management call MUST include:

| Field | Type | Rules |
|---|---|---|
| `actor` | `AuthenticationPrincipal` | Trusted actor |
| `targetUserId` | string | Target user id |
| `roleCode` | string | FR-002 role code |
| `reasonCode` | string | Exact operation-bound FR-026 reason |
| `requestId` | string optional | From request context when available |

## Precondition validation (every call, including no-ops)

Before deciding mutation vs no-op vs reject, validate all of:

1. Trusted actor + usable account state
2. Required operation permission (`authz.roles.assign|revoke|enable|disable`)
3. Target user exists
4. Role definition exists by `roleCode` (finite seeded catalog; **no** inactive-definition concept)
5. Self-escalation denied
6. Exact **active** operation-bound reason for this operation

Validation failure → reject; no mutation; no audit.

## Exact transition matrix

| Operation | From | Result | Reason | Audit |
|---|---|---|---|---|
| `assignRole` | absent | mutate → `ENABLED` | `role_grant_assign` | yes |
| `assignRole` | `REVOKED` | mutate → `ENABLED` (reset applicable lifecycle timestamps) | `role_grant_assign` | yes |
| `assignRole` | `DISABLED` | **reject** (use `enableRole`) | — | no |
| `assignRole` | `ENABLED` | authorized idempotent no-op | reason still validated | **no** |
| `enableRole` | `DISABLED` | mutate → `ENABLED` | `role_grant_enable` | yes |
| `enableRole` | `ENABLED` | authorized idempotent no-op | reason still validated | **no** |
| `enableRole` | `REVOKED` or absent | **reject** (`assignRole` required for `REVOKED`) | — | no |
| `disableRole` | `ENABLED` | mutate → `DISABLED` | `role_grant_disable` | yes |
| `disableRole` | `DISABLED` | authorized idempotent no-op | reason still validated | **no** |
| `disableRole` | `REVOKED` or absent | **reject** | — | no |
| `revokeRole` | `ENABLED` or `DISABLED` | mutate → `REVOKED` | `role_grant_revoke` | yes |
| `revokeRole` | `REVOKED` | authorized idempotent no-op | reason still validated | **no** |
| `revokeRole` | absent | **reject** | — | no |

**Rules**:
- Append audit evidence **only** when an actual state mutation succeeds
- No mutation ⇒ no privileged write ⇒ no new audit row
- Audit failure rolls back every real mutation

## Outputs

| Field | Type |
|---|---|
| `targetUserId` | string |
| `roleCode` | string |
| `status` | `ENABLED` \| `DISABLED` \| `REVOKED` |
| `mutated` | boolean |
| `auditAppended` | boolean (`true` only when `mutated` and audit succeeded) |

**Must not return**: Prisma rows, audit persistence records, raw before/after payloads, secrets.

## Failure modes (fail closed)

- Missing/invalid actor or target
- Missing permission
- Unknown/inactive/mismatched reason
- Self-escalation
- Illegal transition (per matrix)
- Missing role code in seeded catalog
- Audit append failure → full transaction rollback of the mutation

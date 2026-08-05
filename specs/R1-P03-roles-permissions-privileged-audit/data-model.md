# R1-P03 Data Model

**Phase**: R1-P03 — Roles, Permissions & Privileged Audit  
**Date**: 2026-08-03 (revised)  
**Migration**: `r1_p03_roles_permissions_privileged_audit` (forward-only; do not edit applied migrations)  
**Ownership**: Identity (`authentication` module) owns all five models below. Admin continues to own existing `audit_logs` (not recreated; **no R1-P03 structural or index change**).

Conceptual Prisma names below follow repository conventions (`@@map` to snake_case tables). Exact Prisma declarations belong to the implementation phase.

## Shared conventions

- Surrogate string IDs (`cuid`) as primary keys
- Stable business `code` fields for seed upserts (not PKs)
- `created_at` on all rows; `updated_at` only on mutable authoritative rows
- On-delete: `Restrict` for authoritative parents; never cascade-delete audit or grant history obligations
- No provider/worker/membership tables in this migration
- Role and permission **definitions** have no activation lifecycle; only
  `user_roles.status` and `privileged_action_reasons.isActive` carry lifecycle flags

---

## 1. `roles` → table `roles`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `code` | String | Unique business code (`customer`, `staff_admin`, …) |
| `name` | String | Human-readable label |
| `createdAt` | DateTime | Required |
| `updatedAt` | DateTime | Mutable label/metadata only |

**Constraints / indexes**:
- PK: `id`
- Unique: `code`

**Ownership**: Identity  
**On-delete**: Referenced by `role_permissions` and `user_roles` with `onDelete: Restrict`  
**Query patterns**: Seed/load by `code`; resolve role id for grants  
**Invariants**: Codes match FR-002 exactly. There is **no** `isActive` field and **no** inactive-definition check. R1-P03 adds no role-definition management operations.

---

## 2. `permissions` → table `permissions`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `code` | String | Unique (`resource.self.read`, `authz.roles.assign`, …) |
| `name` | String | Human-readable label |
| `createdAt` | DateTime | Required |
| `updatedAt` | DateTime | Mutable label/metadata only |

**Constraints / indexes**:
- PK: `id`
- Unique: `code`

**Ownership**: Identity  
**On-delete**: Referenced by `role_permissions` with `onDelete: Restrict`  
**Query patterns**: Seed by `code`; resolve permission sets for roles  
**Invariants**: Codes match FR-002; no later-phase business permissions; **no** `isActive`; **no** inactive-permission checks; no permission-definition management operations.

---

## 3. `role_permissions` → table `role_permissions`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `roleId` | String | FK → `roles.id` |
| `permissionId` | String | FK → `permissions.id` |
| `createdAt` | DateTime | Required |

**Constraints / indexes**:
- PK: `id`
- Unique: `(roleId, permissionId)`
- Index: `roleId`
- Index: `permissionId`
- FK: `roleId` → `roles.id` `onDelete: Restrict`
- FK: `permissionId` → `permissions.id` `onDelete: Restrict`

**Ownership**: Identity  
**Query patterns**: Load permissions for a role; seed FR-002 map idempotently  
**Invariants**: Map matches FR-002; association exists or not (no enable/disable on the mapping row)

---

## 4. `user_roles` → table `user_roles`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String | FK → `users.id` |
| `roleId` | String | FK → `roles.id` |
| `status` | Enum `UserRoleStatus` | `ENABLED` \| `DISABLED` \| `REVOKED` |
| `assignedAt` | DateTime | First assignment time (set on create; reset policy on REVOKED→ENABLED below) |
| `disabledAt` | DateTime? | Set on disable; cleared when leaving DISABLED |
| `revokedAt` | DateTime? | Set on revoke; cleared when REVOKED→ENABLED via assign |
| `enabledAt` | DateTime? | Last transition into ENABLED |
| `createdAt` | DateTime | Required |
| `updatedAt` | DateTime | Mutable grant row |

**Not stored**: `assignedByUserId` (or any actor-id column). Authoritative actor, action, reason, and before/after history live only in admin `audit_logs`.

**Constraints / indexes**:
- PK: `id`
- Unique: `(userId, roleId)` — one grant row per user/role; prevents duplicate active grants
- Index: `(userId, status)` — authorization effective-permission lookup
- Index: `roleId`
- FK: `userId` → `users.id` `onDelete: Restrict`
- FK: `roleId` → `roles.id` `onDelete: Restrict`

**Ownership**: Identity  
**Query patterns**:
- Effective permissions: `user_roles` where `status = ENABLED` → `role_permissions` → `permissions`
- Role-management: load grant by `(userId, roleId)` for before/after capture

### Exact transition matrix

All operations first validate actor, required permission, target, role existence, self-escalation, and the exact **active** operation-bound reason. Validation failures reject before any mutation or audit.

| Operation | From | To | Reason code | Mutation? | Audit? |
|---|---|---|---|---|---|
| `assignRole` | absent | `ENABLED` | `role_grant_assign` | yes (create) | yes |
| `assignRole` | `REVOKED` | `ENABLED` | `role_grant_assign` | yes (reset lifecycle timestamps) | yes |
| `assignRole` | `DISABLED` | — | — | **reject**; caller must use `enableRole` | no |
| `assignRole` | `ENABLED` | `ENABLED` | `role_grant_assign` validated | authorized idempotent no-op | **no** |
| `enableRole` | `DISABLED` | `ENABLED` | `role_grant_enable` | yes | yes |
| `enableRole` | `ENABLED` | `ENABLED` | `role_grant_enable` validated | authorized idempotent no-op | **no** |
| `enableRole` | `REVOKED` or absent | — | — | **reject**; `assignRole` required for `REVOKED` | no |
| `disableRole` | `ENABLED` | `DISABLED` | `role_grant_disable` | yes | yes |
| `disableRole` | `DISABLED` | `DISABLED` | `role_grant_disable` validated | authorized idempotent no-op | **no** |
| `disableRole` | `REVOKED` or absent | — | — | **reject** | no |
| `revokeRole` | `ENABLED` or `DISABLED` | `REVOKED` | `role_grant_revoke` | yes | yes |
| `revokeRole` | `REVOKED` | `REVOKED` | `role_grant_revoke` validated | authorized idempotent no-op | **no** |
| `revokeRole` | absent | — | — | **reject** | no |

**Timestamp rules on real mutations**:
- absent → ENABLED: set `assignedAt`, `enabledAt`; clear `disabledAt`, `revokedAt`
- REVOKED → ENABLED (assign): set `enabledAt`; clear `revokedAt` and `disabledAt`; keep original `assignedAt` unless product later amends (R1-P03: keep `assignedAt`, clear revoke markers)
- DISABLED → ENABLED (enable): set `enabledAt`; clear `disabledAt`
- ENABLED → DISABLED: set `disabledAt`
- ENABLED|DISABLED → REVOKED: set `revokedAt`

**Invariants**:
- Authorization considers only `status = ENABLED`
- Disable and revoke immediately remove effective permissions on next check (no cache)
- No mutation ⇒ no privileged write ⇒ no new audit row
- Audit failure rolls back every real mutation
- Production rows are never created by seed; only internal contract or test fixtures
- Account categories never create these rows

---

## 5. `privileged_action_reasons` → table `privileged_action_reasons`

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `code` | String | Unique (`role_grant_assign`, …) |
| `name` | String | Human-readable label |
| `operation` | String/Enum | Bound operation: `ROLE_ASSIGN` \| `ROLE_REVOKE` \| `ROLE_ENABLE` \| `ROLE_DISABLE` \| `STAFF_SAMPLE_PRIVILEGED_WRITE` |
| `isActive` | Boolean | **Required**; default `true` |
| `createdAt` | DateTime | Required |
| `updatedAt` | DateTime | Mutable definition |

**Constraints / indexes**:
- PK: `id`
- Unique: `code`
- Unique: `operation` — enforces one-to-one reason↔operation binding (FR-026)
- Index: `isActive`

**Ownership**: Identity  
**Query patterns**: Validate reason by `code` + `operation` + `isActive`  
**Invariants**: Exact FR-026 codes; mismatched operation fails closed; inactive fails closed

---

## 6. Existing `audit_logs` (admin-owned; frozen for R1-P03)

R1-P03 consumes existing fields via admin public contract only:

- `actorType`, `actorId`, `action`, `targetType`, `targetId`, `reason`, `context` (safe before/after JSON), `requestId`, `createdAt`

**Hard plan constraint**:
- R1-P03 makes **no** structural change and **no** index change to `audit_logs`.
- Do not recreate the model.
- Any later audit schema or index change requires a **separately approved plan change**, not an informal task-time addition.

---

## Seed mapping (definitions only)

| Source | Seed target |
|---|---|
| FR-002 roles | `roles.code` |
| FR-002 permissions | `permissions.code` |
| FR-002 role→permission map | `role_permissions` |
| FR-026 reasons + bindings | `privileged_action_reasons.code` + `operation` + `isActive=true` |

**Implementation file**: `prisma/seed.ts`  
**Developer command**: `npm run seed` (not `npm run db:seed`)  
**Excluded from seed**: `user_roles`, users, staff bootstrap, provider/worker records.

## Authorization read model (derived, not persisted)

Effective permissions for user U =
permission codes linked through `role_permissions` to roles R where a
`user_roles` row exists for `(U, R)` with `status = ENABLED`.

There is no role-definition or permission-definition activation filter.

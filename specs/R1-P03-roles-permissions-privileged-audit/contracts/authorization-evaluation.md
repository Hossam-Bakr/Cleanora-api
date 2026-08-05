# Contract: Authorization Evaluation

**Owner**: Identity (`authentication` module)  
**Consumers**: Internal role-management; unit/integration authorization tests; future phases via this named service only

## Effective permissions

### Input

| Field | Type | Rules |
|---|---|---|
| `principal` | `AuthenticationPrincipal` | Trusted; public shape unchanged |
| `at` | timestamp optional | Defaults to now; for tests only |

### Behavior

1. If principal account status is not usable for authorization under existing
   auth rules (`SUSPENDED`/`BANNED` or verification-only where applicable),
   effective permissions are empty / deny.
2. Load `user_roles` for `principal.userId` with `status = ENABLED`.
3. Join those roles to permissions via the finite seeded `role_permissions`
   map (no role/permission definition activation filter).
4. Return the unique set of permission codes.
5. Do not derive permissions from `accountCategories`.

### Output

| Field | Type |
|---|---|
| `permissionCodes` | readonly string[] |
| `roleCodes` | readonly string[] (enabled role codes) |

No Prisma entities.

## Authorize permission + ownership/scope

### Input

| Field | Type | Rules |
|---|---|---|
| `principal` | `AuthenticationPrincipal` | Trusted |
| `permissionCode` | string | Required permission |
| `ownership` | optional ownership fact | e.g. `{ type: 'SELF', resourceOwnerUserId }` |
| `scope` | optional scope fact | e.g. provider/worker synthetic fact in tests only |
| `resourceState` | optional | Resource usability flags when relevant |

### Deny-by-default algorithm

Allow only if all pass:

1. Principal authenticated and account state allows authorization
2. `permissionCode` ∈ effective permissions
3. Ownership rule satisfied when required (`SELF` ⇒ `resourceOwnerUserId === principal.userId`)
4. Scope rule satisfied when required:
   - Global staff sample permissions: no provider scope required
   - Provider/supervisor/provider-admin/worker scope permissions:
     - **Production**: if real membership/worker records are required and absent → **deny**
     - **Tests**: synthetic scope facts may allow in-matrix cases only
   - Cross-provider proxy → **deny**
5. Never trust client-supplied roles, permissions, ownership, or scope as authority

### Output

| Field | Type |
|---|---|
| `allowed` | boolean |
| `denialCode` | optional stable code for tests (`PERMISSION_DENIED`, `OWNERSHIP_DENIED`, `SCOPE_DENIED`, `ACCOUNT_STATE_DENIED`, …) |

Callers receive no persistence rows.

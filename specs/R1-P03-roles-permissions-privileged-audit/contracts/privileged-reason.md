# Contract: Privileged-Reason Validation

**Owner**: Identity  
**Used by**: Role-management and staff-sample privileged writes

## Input

| Field | Type | Rules |
|---|---|---|
| `reasonCode` | string | Required on privileged writes **and** on authorized no-ops |
| `operation` | enum/string | Exact operation being attempted |
| `actor` | `AuthenticationPrincipal` | Must also hold `authz.reasons.use` when the write is privileged |

## Validation rules

1. Reason exists by `code`
2. Reason `isActive = true` (**required** lifecycle flag on privileged reasons only)
3. Reason `operation` equals the attempted operation (one-to-one FR-026 binding)
4. Actor is authorized to use privileged reasons (`authz.reasons.use`) where applicable
5. Otherwise fail closed: missing, unknown, inactive, unauthorized, or operation-mismatched

Validation runs **before** mutation/no-op/reject decisions for every role-management call.

## Seeded catalog (exact)

| Code | Operation |
|---|---|
| `role_grant_assign` | ROLE_ASSIGN |
| `role_grant_revoke` | ROLE_REVOKE |
| `role_grant_enable` | ROLE_ENABLE |
| `role_grant_disable` | ROLE_DISABLE |
| `staff_sample_privileged_write` | STAFF_SAMPLE_PRIVILEGED_WRITE |

## Output

| Field | Type |
|---|---|
| `valid` | boolean |
| `reasonCode` | string when valid |
| `denialCode` | optional |

No persistence entities returned to callers.

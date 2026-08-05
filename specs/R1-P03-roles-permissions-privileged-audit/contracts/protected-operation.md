# Contract: Protected-Operation Declaration

**Owner**: Identity authorization helpers  
**Purpose**: Every R1-P03 authorization-protected operation declares its rules in one place for matrix tests and future route wiring.

## Declaration shape

| Field | Type | Rules |
|---|---|---|
| `operationId` | string | Stable id (e.g. `identity.roles.assign`) |
| `permissionCode` | string | Required permission |
| `ownership` | enum | `NONE` \| `SELF` \| custom policy id |
| `scope` | enum | `NONE` \| `GLOBAL` \| `PROVIDER` \| `WORKER` |
| `privileged` | boolean | If true, reason + audit required on real mutation |
| `reasonOperation` | optional | FR-026 operation key when privileged |
| `publicHttp` | boolean | **Must be false for all R1-P03 operations** |

## R1-P03 declared operations (internal only)

| operationId | permission | privileged | reason operation |
|---|---|---|---|
| `identity.roles.assign` | `authz.roles.assign` | yes | `ROLE_ASSIGN` |
| `identity.roles.revoke` | `authz.roles.revoke` | yes | `ROLE_REVOKE` |
| `identity.roles.enable` | `authz.roles.enable` | yes | `ROLE_ENABLE` |
| `identity.roles.disable` | `authz.roles.disable` | yes | `ROLE_DISABLE` |
| `identity.staff.sample.admin` | `authz.staff.admin.sample` | yes when exercised as privileged sample | `STAFF_SAMPLE_PRIVILEGED_WRITE` |
| `identity.staff.sample.operations` | `authz.staff.operations.sample` | yes when exercised as privileged sample | `STAFF_SAMPLE_PRIVILEGED_WRITE` |
| `identity.staff.sample.support` | `authz.staff.support.sample` | yes when exercised as privileged sample | `STAFF_SAMPLE_PRIVILEGED_WRITE` |
| `identity.staff.sample.finance` | `authz.staff.finance.sample` | yes when exercised as privileged sample | `STAFF_SAMPLE_PRIVILEGED_WRITE` |

Ownership/scope evaluation samples (`resource.self.*`, `authz.scope.*`) remain non-HTTP matrix checks and are not public endpoints.

All rows above have `publicHttp = false`.

## Explicit non-declarations

Existing authentication endpoints are **not** protected-operation declarations for R1-P03:

- signup, verification, login, refresh, logout, logout-all, password, Google auth, `/auth/me`

They remain authentication-protected only (FR-028).

## Future phases

When a later phase introduces a public endpoint, that phase MUST add a
protected-operation declaration with permission and ownership/scope rules
before enabling the route.

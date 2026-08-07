# Data Model — R1-P03A Production Role Provisioning (Owner MVP)

**Status**: Phase 1 design under **DEC-030**

**Owner:** Authentication for grant mutations; Admin for `audit_logs` lifecycle

## Persisted model inventory (simplified MVP)

| Model | Change | Owner | Purpose |
|---|---|---|---|
| `User` | Reuse | Authentication | Target eligibility: `ACTIVE`, verified email |
| `Role` | Reuse | Authentication | Resolve `staff_admin` and other non-customer roles |
| `UserRole` | Reuse | Authentication | Grant lifecycle per R1-P03 |
| `PrivilegedActionReason` | Reuse (ordinary commands only) | Authentication | Ordinary `role_grant_*` codes for staff HTTPS commands. Owner provision uses fixed SYSTEM audit reason string `owner_staff_admin_provision` intentionally outside this catalog/enum (no schema expansion). |
| `AuditLog` | Reuse | Admin | Successful owner provision and ordinary mutation audit |
| `AuthEvent` | Reuse (optional) | Authentication | Operational/denial evidence if existing patterns require it |

**No new Prisma models** are required for the simplified MVP.

## Obsolete superseded bootstrap models (do not implement)

The prior superseded design introduced Authentication-owned bootstrap persistence
(for example closure and authorization-use tables). **DEC-030 removes these from
scope.** They must not appear in the simplified implementation.

### Migration evidence and hygiene

| Fact | Detail |
|---|---|
| Migration folder | `prisma/migrations/r1_p03a_production_role_provisioning` |
| Applied on disposable DBs | `cleanora_r1_p02_ci_02`, `cleanora_r1_p03_clean_proof` — obsolete bootstrap tables exist there |
| Working-tree corruption | `migration.sql` in that folder was later emptied; original SQL must be **restored** for migration-history integrity |
| Forward remediation | A **new** forward-only drop migration removes obsolete bootstrap tables on affected disposable environments |
| Checksum rule | Do not edit applied migration checksum meaning casually |
| Production `Cleanora` DB | Do not touch without explicit owner approval |
| Simplified MVP schema | Requires **no new models** |

Implementers must treat obsolete tables as test-only legacy from the superseded
design, not as part of the owner MVP data model.

## Owner provisioning eligibility snapshot

Transaction-scoped reload inside Authentication:

| Fact | Source | Rule |
|---|---|---|
| Account status | `users.status` | Must be `ACTIVE` |
| Verified email | `users.email_verified_at` | Required non-null |
| Target existence | `users.id` | Must exist |

Category arrays are **not** used for owner `staff_admin` provisioning under
DEC-030.

## `UserRole` lifecycle (unchanged R1-P03)

Owner provisioning uses only:

- **Assign** when grant absent or `REVOKED` → `ENABLED`
- **Enable** when grant `DISABLED` → `ENABLED`
- **Idempotent no-op** when grant already `ENABLED`

Staff-admin API uses the full non-customer transition matrix via
`RoleManagementService`. **`customer` role commands are rejected before delegation.**

## Audit mapping — owner provision

| Field | Value / rule |
|---|---|
| `action` | Owner staff-admin provision action (implementation selects stable code) |
| `reason` | `owner_staff_admin_provision` |
| `targetType` | `user_role` |
| `context` | Safe before/after grant state, opaque target reference — no owner secret |

Grant and audit commit atomically; audit failure rolls back the grant.

## Transaction boundaries

```text
Owner request
  -> verify config gate + timing-safe secret + rate limit
  -> Authentication transaction
       lock/revalidate target
       apply staff_admin assign or enable
       append audit
  -> COMMIT or ROLLBACK

Staff-admin command
  -> authenticate + authorize + reject customer role
  -> RoleManagementService (existing transaction)
```

No second transaction owner. No closure row insertion. No command fingerprint
persistence.

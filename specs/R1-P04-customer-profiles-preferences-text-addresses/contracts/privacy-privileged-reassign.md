# Privileged Privacy Reassignment Contract — R1-P04

## Purpose

Allow an authenticated privileged actor to reassign a `PROCESSING` privacy
request when the current claimant cannot continue. Introduces no staff UI and
no automatic return to `PENDING`.

## Actor requirements (DEC-031)

All required:

1. Authenticated privileged principal from trusted context
2. Enabled grant of role `staff_admin` carrying permission
   `privacy.requests.reassign`
3. Approved privileged reason code `privacy_request_reassign` (valid only for
   operation `PRIVACY_REQUEST_REASSIGN`)

Authentication catalog (additive; Auth-owned):

| Field | Value |
|---|---|
| Permission | `privacy.requests.reassign` |
| Role mapping | `staff_admin` only |
| Protected operation ID | `customers.privacy.requests.reassign` |
| PrivilegedActionOperation | `PRIVACY_REQUEST_REASSIGN` |
| Reason | `privacy_request_reassign` |
| Ownership / Scope | `NONE` / `GLOBAL` |
| Privileged / Public HTTP | `true` / `false` |

`staff_support`, `staff_operations`, `staff_finance`, provider roles, workers,
and customers receive **no** reassignment authority. Missing role mapping,
permission, operation declaration, or active reason fails closed.

**Must not** require customer `SELF` or customer category eligibility.
Customer remains request owner.

## Operation

### `reassignPrivacyRequest({ requestId, newProcessorId, actor, reasonCode })`

- Legal source: `PROCESSING` only
- Atomically replace `processor_id` and `processing_at`
- Invalidate former claimant authority to resolve
- Preserve redacted before/after audit evidence via Admin privileged
  transactional writer
- Stale/illegal calls leave state unchanged

## Denials

- Missing permission, wrong role, missing/invalid reason → safe denial; no change
- Client-forged permission/reason/processor authority → ignored; denial
- Terminal or PENDING request → illegal transition denial

## Boundary

Customers owns the transaction. Admin owns audit-row lifecycle through the
privileged transactional writer seam. Authentication owns catalog rows added by
the phase migration.

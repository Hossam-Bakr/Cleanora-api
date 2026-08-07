# Phase 1 Contracts — R1-P03A (Owner MVP)

Contracts describe the **DEC-030** simplified design. They do not authorize
implementation or production secrets.

| Contract | Purpose |
|---|---|
| [owner-staff-admins.openapi.yaml](./owner-staff-admins.openapi.yaml) | Internal owner HTTPS staff-admin provisioning |
| [owner-staff-admin-provision.md](./owner-staff-admin-provision.md) | Behavioral rules, transaction, and audit for owner provisioning |
| [staff-admin-role-management.openapi.yaml](./staff-admin-role-management.openapi.yaml) | Authenticated staff-admin non-customer role-grant commands |
| [transaction-boundaries.md](./transaction-boundaries.md) | Authentication/Admin ownership and transaction rules |

## Obsolete contracts (superseded — do not implement)

| Removed contract | Superseded by |
|---|---|
| `first-staff-admin-bootstrap.md` | `owner-staff-admin-provision.md` |
| `operational-evidence.md` (six-class bootstrap matrix) | Standard safe errors + optional existing `auth_events` patterns |

Prior PASS reviews referencing the obsolete contracts are historical only.

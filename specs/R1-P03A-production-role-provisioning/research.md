# Phase 0 Research — R1-P03A Production Role Provisioning (Owner MVP)

**Date**: 2026-08-07

**Status**: Complete under **DEC-030**. Prior research decisions for Ed25519 CLI
bootstrap, closure singletons, command fingerprints, and six-class bootstrap
evidence are **obsolete** and must not be implemented.

## Research questions and decisions

### RQ-1 — How should production establish `staff_admin`?

**Decision:** One internal HTTPS owner endpoint
`POST /api/v1/internal/owner/staff-admins`.

**Rationale:** DEC-030 replaces the complex non-HTTP Ed25519 bootstrap with an
operationally simpler, still fail-closed surface: disabled unless
`OWNER_ADMIN_API_ENABLED=true`, timing-safe owner secret header, rate limiting,
and atomic grant+audit.

**Alternatives rejected:** CLI stdin bootstrap, permanent closure tables, Ed25519
signed envelopes — superseded by DEC-030.

### RQ-2 — What may the owner endpoint mutate?

**Decision:** Assign or re-enable `staff_admin` only for one `ACTIVE` target
with verified email per request.

**Rationale:** Matches junior MVP scope and reuses R1-P03 transition semantics
inside one Authentication-owned transaction.

**Alternatives rejected:** Multi-role owner provisioning, category-based target
selection, customer grants.

### RQ-3 — How do staff administrators manage other roles?

**Decision:** Reuse the minimal authenticated HTTPS role-grant command API;
delegate to `RoleManagementService`; reject `customer` at the API boundary.

**Rationale:** R1-P03 already owns transitions, permissions, reasons, and audit.
R1-P03A adds only the inbound adapter and explicit non-customer restriction per
DEC-030.

### RQ-4 — What persistence changes are required?

**Decision:** None for the simplified MVP. Reuse `users`, `roles`, `user_roles`,
reasons, and audit tables.

**Rationale:** Owner provisioning and ordinary commands are grant mutations on
existing models. Obsolete bootstrap tables from the superseded migration on
disposable test DBs are dropped via a separate forward migration after restoring
corrupted historical SQL — not part of MVP feature schema.

### RQ-5 — How is the owner secret handled?

**Decision:** Server configuration plus request header validated with
timing-safe comparison. Documentation and OpenAPI examples use placeholders only.

**Rationale:** Prevents secret leakage in specs and reduces operational complexity
versus signed envelopes while preserving fail-closed behavior.

### RQ-6 — What audit reason applies to owner provisioning?

**Decision:** Fixed privileged reason `owner_staff_admin_provision`.

**Rationale:** Distinct from ordinary `role_grant_*` staff-admin commands and
traceable in audit evidence.

### RQ-7 — How does R1-P04 relate to this phase?

**Decision:** R1-P04 does not depend on customer-role grants from R1-P03A.
Customer operations authorize via trusted `AuthenticationPrincipal` facts,
`SELF` ownership, and FR-028 category eligibility. They do **not** require
`resource.self.read`/`resource.self.write` or other role-derived R1-P04
customer permissions.

**Rationale:** Removes the authorization-provisioning blocker that paused R1-P04
planning under the superseded design.

## Unresolved items

None within DEC-030 scope. Owner secret custody, exact header name, rate-limit
thresholds, and environment rollout remain operational choices during
implementation planning — not open product decisions.

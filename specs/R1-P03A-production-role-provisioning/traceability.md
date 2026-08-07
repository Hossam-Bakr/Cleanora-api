# Traceability — R1-P03A Production Role Provisioning (Owner MVP)

**Date**: 2026-08-07

**Authority**: [spec.md](./spec.md), **DEC-030**

| Spec ID | Requirement summary | Contract / design artifact | Validation |
|---|---|---|---|
| FR-004, FR-005 | Owner internal endpoint | [owner-staff-admins.openapi.yaml](./contracts/owner-staff-admins.openapi.yaml), [owner-staff-admin-provision.md](./contracts/owner-staff-admin-provision.md) | Owner API integration tests |
| FR-006, FR-007 | Secret + rate limit | owner-staff-admin-provision.md | Security + rate-limit tests |
| FR-008–FR-012 | Target eligibility, idempotency, audit | [data-model.md](./data-model.md), [transaction-boundaries.md](./contracts/transaction-boundaries.md) | Owner provision lifecycle tests |
| FR-013–FR-018 | Staff-admin command API | [staff-admin-role-management.openapi.yaml](./contracts/staff-admin-role-management.openapi.yaml) | Role-grant command API tests |
| FR-014 | Reject customer role | staff-admin-role-management.openapi.yaml (role enum) | Customer-role rejection tests |
| FR-019–FR-020 | No auto grants; no new models | plan.md, data-model.md | Boundary + schema review |
| FR-021 | Placeholder secrets in docs | All contracts | Docs scan |
| SC-001–SC-003 | Owner success/denial/idempotency | quickstart.md owner matrix | Integration tests |
| SC-004–SC-007 | Staff-admin API behavior | quickstart.md staff matrix | Integration + unit tests |
| SC-008–SC-010 | Boundaries and redaction | quickstart.md boundary checks | Module-boundary + audit sampling |

## Superseded traceability (historical — do not implement)

The prior design traced FR-019 six-class bootstrap evidence, Ed25519 CLI bootstrap,
`StaffAdminBootstrapClosure`, and customer-role eligibility (FR-029–FR-034) to
closure tables and operational-evidence contracts. **DEC-030 removes these links.**
Prior PASS reviews against the superseded design remain historical only.

## R1-P04 relationship

| Downstream need | R1-P03A deliverable under DEC-030 |
|---|---|
| Production `staff_admin` actor | Owner API + optional staff-admin grants |
| Customer self-service authorization | **Not** implemented by R1-P03A — R1-P04 will use AuthenticationPrincipal + SELF + category eligibility (no customer role; no role-derived R1-P04 customer permission) |
| R1-P04 planning resume | R1-P03A Complete owner approval |

# R1-P03 — Roles, Permissions & Privileged Audit

**Status:** Complete — historical activation record; completed 2026-08-05 by
explicit human-owner approval
**Activated:** 2026-08-03 by explicit human-owner authorization

## Goal

Make authorization authoritative across customer, provider, worker, and staff
operations.

## Roadmap scope

- Multi-role users, role/permission seeds, and user-role assignment
- Route permissions and resource ownership
- Provider membership, worker, supervisor, and provider-admin scopes
- Separated staff roles: admin, operations, support, and finance
- Privileged-write reasons and before/after audit evidence
- Authorization test matrix

## Planned persistence

- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `privileged_action_reasons`
- `audit_logs` integration

Identity owns roles, permissions, grants, and reason codes. The existing
`audit_logs` lifecycle remains owned by the admin module; R1-P03 must define an
explicit cross-module audit contract before implementation.

## Historical activation guardrails

The following guardrails applied during R1-P03 activation and are retained as a
historical record. R1-P03 is now Complete and none of this language reopens it.

- R1-P02B is Complete with independent review `PASS` and owner approval.
- R1-P03 was the only In Progress phase at activation.
- Initial activation authorized specification and planning, not implementation;
  implementation was later separately authorized, completed, validated, and
  human-approved as Complete.
- Do not add provider, worker, finance, support, or admin product workflows
  belonging to later phases; R1-P03 defines only reusable authorization scope
  semantics for those future consumers.
- Do not edit an applied migration. Any approved persistence change must use a
  new R1-P03-owned migration.
- Do not commit, push, merge, deploy, or run a production migration.

At activation, the next lifecycle step was Spec Kit `specify` using the R1-P03
roadmap section and the minimum security/entity-ownership architecture context.
That lifecycle has finished; R1-P03 remains Complete.

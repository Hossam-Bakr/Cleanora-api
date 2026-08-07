# Implementation Plan: R1-P03A — Production Role Provisioning (Owner MVP)

**Branch**: `R1-P03A-production-role-provisioning` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Status**: Planning artifacts rewritten under **DEC-030**; awaiting owner approval for tasks and implementation.

**Input**: [spec.md](./spec.md) and owner **DEC-030**, which supersedes the prior complex bootstrap and customer-role design.

## Summary

Extend Authentication with two inbound adapters only:

1. **Owner internal API** — `POST /api/v1/internal/owner/staff-admins` to assign or
   re-enable `staff_admin` when `OWNER_ADMIN_API_ENABLED=true`, using a
   timing-safe owner secret header, rate limiting, and atomic grant+audit with
   reason `owner_staff_admin_provision`.
2. **Staff-admin command API** — existing-style authenticated HTTPS role-grant
   commands that delegate non-customer mutations to `RoleManagementService`.

No new Prisma models. No customer-role commands. No CLI bootstrap, Ed25519
envelopes, closure tables, or six-class bootstrap evidence.

## Technical Context

**Language/Version**: TypeScript on Node.js 24+

**Primary Dependencies**: Express, Zod, Prisma, PostgreSQL, existing Authentication
authorization services, Admin privileged-audit writer, repository rate-limit port

**Storage**: Reuse `users`, `roles`, `user_roles`, `privileged_action_reasons`,
`auth_events`, and Admin `audit_logs` — **no new models for the simplified MVP**

**Testing**: Vitest, Supertest, unit/integration/contract tests; no Docker or
Testcontainers in Release 1

**Target Platform**: Existing Linux-hosted modular-monolith backend

**Project Type**: Single deployable web service; no R1-P03A UI

**Constraints**: Authentication owns all provisioning transactions; completed
R1-P02 contracts frozen; R1-P04 paused until R1-P03A Complete owner approval;
placeholder secrets only in docs

**Scale/Scope**: 3 user stories, 22 functional requirements, 10 success criteria,
2 HTTP surfaces, 0 new Prisma models

## Constitution Check

| Principle / gate | Status | Evidence |
|---|---|---|
| I. Standalone Greenfield Product | PASS | Repository-local dependencies only |
| II. One Active Phase | PASS | R1-P03A active; R1-P04 paused |
| III. Modular Monolith Ownership | PASS | Authentication owns provisioning; Admin owns audit lifecycle |
| IV. Incremental Migration | PASS | Simplified MVP adds no schema; obsolete test-only tables dropped via separate forward migration |
| V. Canonical Product Truth | PASS | DEC-030 supersedes superseded DEC-029 bootstrap/customer provisions |
| VI. Security | PASS | Disabled-by-default owner API, timing-safe secret, rate limits, atomic audit |
| VII. Testing | PASS | [quickstart.md](./quickstart.md) defines validation matrices |
| VIII. Human-Controlled Operations | PASS | Owner secret and enable flag are operational, not spec artifacts |
| IX. Release Boundaries | PASS | No UI, wallets, Docker/cloud, or R1-P04 implementation |
| X. Immutable Migrations | PASS | Restore corrupted superseded SQL for history; forward drop only on disposable DBs |

## Architecture and Ownership

### Inbound boundaries

- `POST /api/v1/internal/owner/staff-admins` — owner secret header, config gate,
  strict Zod parsing, rate limit, then Authentication-owned owner provisioning
  service and unit of work.
- `POST /api/v1/auth/role-grants/commands` (or equivalent existing route) —
  bearer authentication, staff-admin authorization, **customer role rejected at
  schema/controller boundary**, delegate to `RoleManagementService`.

HTTP pre-checks improve response speed only. Transaction-time revalidation inside
Authentication remains authoritative.

### Dependency direction

Authentication owns both use cases and all grant persistence ports. Admin exposes
the existing transaction-aware privileged-audit writer. Composition is the only
cross-module wiring seam.

## Migration hygiene (superseded design)

The folder `prisma/migrations/r1_p03a_production_role_provisioning` was applied
on disposable test databases `cleanora_r1_p02_ci_02` and
`cleanora_r1_p03_clean_proof`, creating obsolete bootstrap tables from the
superseded design. The working-tree `migration.sql` was later emptied
(corruption). Before any new work:

1. Restore the original applied SQL for migration-history integrity (do not
   casually change checksum meaning).
2. Add a **new forward-only drop migration** that removes obsolete bootstrap
   tables on environments that received the superseded migration.
3. Never apply corrective migrations to production `Cleanora` DB without explicit
   owner approval.

The simplified MVP itself requires **no new models**. Details: [data-model.md](./data-model.md).

## Project Structure

### Documentation (this phase)

```text
specs/R1-P03A-production-role-provisioning/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── traceability.md
├── tasks.md
└── contracts/
    ├── README.md
    ├── owner-staff-admin-provision.md
    ├── owner-staff-admins.openapi.yaml
    ├── staff-admin-role-management.openapi.yaml
    └── transaction-boundaries.md
```

### Expected implementation placement (when authorized)

```text
src/modules/authentication/
├── owner-staff-admin-provision.service.ts
├── role-grant-command.controller.ts
├── role-grant-command.schema.ts
└── infrastructure/
    └── prisma-owner-staff-admin-provision.unit-of-work.ts

src/composition.ts
tests/unit/
tests/integration/
```

Exact filenames may follow repository conventions during implementation.

## R1-P04 gate (revised)

R1-P04 remains paused until R1-P03A is implemented, validated, and owner-approved
Complete. Per **DEC-030**, R1-P04 does **not** require customer-role grants from
R1-P03A. Customer self-service authorization uses trusted
`AuthenticationPrincipal` facts, `SELF` ownership, and category eligibility —
without role-derived R1-P04 customer permissions.

## Phase outputs

- Phase 0: [research.md](./research.md) — complete under DEC-030
- Phase 1: [data-model.md](./data-model.md), [contracts/](./contracts/),
  [quickstart.md](./quickstart.md), [traceability.md](./traceability.md) — complete
- Phase 2: [tasks.md](./tasks.md) — prepared; all items unchecked pending authorization

Next gate: owner approval to begin implementation against this simplified plan.

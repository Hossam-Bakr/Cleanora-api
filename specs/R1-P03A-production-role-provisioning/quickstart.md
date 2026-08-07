# Phase 1 Validation Guide — R1-P03A (Owner MVP)

**Status:** Planning validation design under **DEC-030**

This guide defines evidence a separately authorized implementation must produce.
It does not authorize implementation, bootstrap CLI execution, or production
configuration with real secrets.

## Prerequisites

- R1-P03A specification and plan reflect DEC-030.
- R1-P03 Complete; R1-P04 paused.
- Disposable test database only.
- Owner tests use placeholder secret `OWNER_ADMIN_SECRET_PLACEHOLDER` in fixtures
  — never commit or document real secrets.

## Static validation

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run build
npm.cmd run docs:check
npx.cmd prisma validate
npx.cmd prisma generate
git diff --check
```

Validate OpenAPI contracts and module-boundary tests when present.

## Owner API matrix

| Case | Expected |
|---|---|
| Gate disabled (`OWNER_ADMIN_API_ENABLED=false`) | Safe denial; no grant change |
| Missing/wrong secret | Timing-safe denial; no grant change |
| Rate limit exceeded | 429 or repository equivalent; no grant change |
| Valid assign to eligible target | One enabled `staff_admin`; atomic audit with `owner_staff_admin_provision` |
| Valid re-enable disabled grant | Enabled grant; atomic audit |
| Idempotent retry after success | Stable outcome; no duplicate mutation/audit |
| Ineligible target (inactive, unverified email, unknown) | Safe denial; no grant change |
| Audit failure during success path | Rollback; no committed grant |

Verify error bodies contain no owner secret, tokens, or unrelated-user disclosure.

## Staff-admin command API matrix

| Case | Expected |
|---|---|
| Valid non-customer assign/enable/disable/revoke | Matches `RoleManagementService` |
| Role code `customer` | Rejected before delegation |
| Missing auth/permission/reason | Safe denial; no grant change |
| Self-target command | Denied |
| Audit failure on mutation | Rollback |

Run concurrency and no-op repetition cases per R1-P03 transition matrix.

## Boundary and regression checks

- Zero automatic grants from signup, login, verification, startup.
- Zero direct authorization-persistence access outside Authentication.
- R1-P02 authentication contract comparison shows no unintended public changes.
- Module-boundary test passes.

## Migration hygiene checks (superseded tables)

On disposable DBs that received the superseded migration:

1. Confirm restored historical SQL for
   `prisma/migrations/r1_p03a_production_role_provisioning`.
2. Apply forward drop migration; confirm obsolete bootstrap tables removed.
3. Confirm simplified MVP tests pass **without** new Prisma models.

Never run corrective migrations against production `Cleanora` without owner approval.

## Definition of Done (implementation gate)

- All SC-001–SC-010 evidence collected.
- Contracts match implemented routes and schemas.
- Owner and staff-admin integration tests green on disposable DB.
- No real secrets in repository artifacts.
- Human owner explicitly approves R1-P03A Complete before R1-P04 resumes planning.

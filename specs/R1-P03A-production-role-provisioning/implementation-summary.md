# R1-P03A implementation summary (DEC-030 owner MVP)

## Active boundary

- Authentication owns staff_admin owner provisioning and ordinary non-customer
  role-grant commands.
- Admin remains the sole `audit_logs` writer via injected transactional writers.
- No Admin UI. No real `OWNER_ADMIN_SECRET`, production user, or live provision
  was executed during this work.
- R1-P02/R1-P03 catalogs remain. Historical `customer` role may exist but is not
  provisioned by R1-P03A and is not required for R1-P04.
- R1-P03A is Complete as of `2026-08-07`. R1-P04 is not active; planning
  resume requires separate explicit human-owner activation.
- R1-P04 customer authorization is documentation-only in this phase: trusted
  `AuthenticationPrincipal` + `SELF` + category eligibility. No premature P04
  policy helpers ship in Authentication.

## Delivered behavior

1. `POST /api/v1/internal/owner/staff-admins`
   - Disabled unless `OWNER_ADMIN_API_ENABLED=true`
   - Header `X-Owner-Admin-Secret` compared with timing-safe equality
   - Body `{ "email": "..." }` only
   - Target must be ACTIVE with verified email
   - Assigns or re-enables fixed `staff_admin` only; idempotent when already
     ENABLED; audit reason `owner_staff_admin_provision`; audit failure rolls
     back the grant
2. `POST /api/v1/auth/role-grants/commands`
   - Authenticated staff-admin ordinary assign/revoke/enable/disable
   - Finite non-customer role codes only (`customer` rejected at Zod boundary)

## 2026-08-07 focused repair

- Removed unused premature
  `src/modules/authentication/domain/customer-self-service.policy.ts` and its
  unit test.
- Refocused `customer-role-no-automation.test.ts` on signup/verification/seed
  non-automation only.
- Aligned R1-P03A/R1-P04 normative docs so customer self-service does **not**
  require an explicit R1-P04 permission, `resource.self.*`, or other
  role-derived customer permission.
- Did not edit applied create/drop migrations or `prisma/schema.prisma`.

## Migration hygiene evidence

| Target | Classification | Evidence |
|---|---|---|
| `DATABASE_URL` → `Cleanora` | Production-like | **Never migrated** |
| `TEST_DATABASE_URL` → `cleanora_r1_p02_ci_02` | Disposable | Prior create migration was applied; forward drop `r1_p03a_production_role_provisioning_drop` applied |
| `TEST_MIGRATION_DATABASE_URL` → `cleanora_r1_p03_clean_proof` | Disposable | Same drop applied |

- Applied migrations were not deleted or edited in this repair.
- Simplified MVP needs no new Prisma models.

## Obsolete work removed (earlier + this repair)

Signed-envelope verifier, bootstrap CLI, authorization-use/closure repositories,
claim/CAS services, related tests, and the premature R1-P04 customer-self-service
policy helper.

## Validation (2026-08-07 repair pass — sequential)

| Command | Result |
|---|---|
| Targeted `customer-role-no-automation` | PASS — 1 file / 2 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run docs:check` | PASS (`ok: true`, 11 docs) |
| `npm run openapi:validate` | PASS |
| `npm run test:unit` | PASS — 85 files / 399 tests |
| Focused R1-P03A integration (sequential) | PASS — 4 files / 8 tests |
| Full integration (sequential, once) | PASS — 41 files / 118 tests |
| `git diff --check` | PASS (CRLF warnings only; no whitespace errors) |

No sequential failure remained. Shared-database interference from earlier
overlapping runs was not reproduced under sequential execution.

## Companion / completion

- Focused post-repair independent re-review: **PASS** (see
  `implementation-review-report.md`). Full integration was not rerun by that
  reviewer; prior same-day sequential evidence remains 41 files / 118 tests PASS.
- **T029 closed** on `2026-08-07` by exact owner phrase approving R1-P03A as
  Complete (`completion-report.md`).
- Companion status: `completed` (`currentStep=implement`).
- R1-P04 is not active; separate owner activation is required to resume planning.
- No Git staging/commit/push; no real owner secret or staff_admin provision against a real environment.

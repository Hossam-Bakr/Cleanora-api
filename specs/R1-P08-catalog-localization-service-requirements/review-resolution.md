# R1-P08 Codex Final Review Resolution

Updated: 2026-09-02  
Status: **RESOLVED AND PHASE COMPLETE — DEC-045 / DEC-046**

Migration note: the phase-owned `r1_p08_catalog_localization_service_requirements` migration remains in the uncommitted worktree (base `c187aa4`). DEC-045 keeps live Catalog proofs on `cleanora_r1_p08_test` via `CLEANORA_R1_P08_DATABASE_URL`, and points `TEST_DATABASE_URL` / `TEST_MIGRATION_DATABASE_URL` at the current-schema disposable `cleanora_r1_p04_current_proof`. Historical `cleanora_r1_p04_clean_proof` and `Cleanora` stay untouched.

## Finding dispositions

| ID | Severity | Disposition | Evidence |
|---|---|---|---|
| M-01 | MAJOR | **accepted — fixed** | `@@unique([actorUserId, scopeKey, idempotencyKey])`; actor-scoped advisory lock, lookup, replay; unit/live tests in `catalog-idempotency.policy.test.ts`, `prisma-catalog.repository.test.ts`, `catalog-actor-idempotency.test.ts` |
| M-02 | MAJOR | **accepted — fixed** | `TransactionalCatalogServiceMediaFactsReader`; no `mediaFile` Prisma relation in Catalog repository; `r1-p08-module-boundaries.test.ts` regression |
| M-03 | MAJOR | **accepted — fixed** | Live HTTP/DB proofs execute against `cleanora_r1_p08_test`; no TODO throws; `npm run test:r1-p08` **333 passed / 0 skipped** |
| M-04 | MAJOR | **accepted — fixed under DEC-045** | Dual targets: `cleanora_r1_p04_current_proof` for `TEST_DATABASE_URL`/`TEST_MIGRATION_DATABASE_URL`; `cleanora_r1_p08_test` for `CLEANORA_R1_P08_DATABASE_URL`. `npm run test:integration` exit 0 (169/3 files, 601/5 tests). `npm run test:coverage` exit 0 at 83.69/75.03/86.46/85.61. |
| M-05 | MAJOR | **accepted — fixed** | SQL + repository + schema discriminated union for PENDING `reservedMediaFileId`; probes in migration contract and `validate-clean-migration.ts` |
| m-01 | MINOR | **accepted — reconciled** | This file, `implementation-summary.md`, `completion-report.md`, and `docs/product/current.md` updated after green phase/disposable gates |

## Commands run (2026-09-02 stabilization closeout)

| Command | Exit | Result |
|---|---:|---|
| `npm run typecheck` | 0 | pass |
| `npm run lint` | 0 | pass |
| `npm run build` | 0 | pass |
| `npm run prisma:validate` | 0 | schema valid |
| `npm run test:r1-p08` | 0 | **333 passed, 0 skipped** (54 files) — re-run after Neon connection stabilization |
| `npm run test:coverage:r1-p08` | 0 | **85.41 / 76.04 / 83.37 / 85.21** |
| `npm run test:unit` | 0 | **1123 passed** (218 files) |
| Default-config R1-P08 live subset | 0 | **33 passed** (5 files) |
| R1-P08/global boundary suite | 0 | **23 passed** (4 files) |
| `npm run db:validate-clean-migration` | 0 | pass |
| `npm run db:validate-r1-p08-upgrade` | 0 | pass |
| OpenAPI / Postman / docs validation | 0 | all pass |
| `npm audit --audit-level=high` | 0 | 0 vulnerabilities |
| DEC-045 `npm run test:integration` | 0 | **169 passed / 3 skipped files**, **601 passed / 5 skipped tests** |
| DEC-045 `npm run test:coverage` | 0 | **83.69 / 75.03 / 86.46 / 85.61** versus 80/75/80/80 |

## Remaining blockers and non-blockers

1. **NON-BLOCKING**: Three inherited R1-P07 name-guarded files still skip when `TEST_DATABASE_URL` is not P07-named (`worker-signup-rejection`, `provider-worker-history-retention`, `provider-worker-identity-claim-race`). The repository commands exited 0.
2. **NON-BLOCKING**: PostgreSQL driver warnings from intentional concurrent query probes should be retired before a future major driver upgrade.
3. Git publication remains unauthorized until the human message is exactly `commit and push`.

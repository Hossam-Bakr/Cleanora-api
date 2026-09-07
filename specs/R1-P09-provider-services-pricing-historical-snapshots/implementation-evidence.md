# R1-P09 Implementation Evidence

**Phase**: R1-P09 — Provider Services, Pricing & Historical Snapshots

**Review date**: 2026-09-07

**Base/branch**: `e3383fb2d4f57ba4439d6783e5939c62670984d8` on `main`

**Status**: Technically ready for the separately triggered `commit and push` workflow.
Human phase completion has not been approved. Changes remain unstaged.

This ledger supersedes the earlier implementation totals. The original live
integration files contained empty bodies, and the migration validators did not
exercise Phase 9 constraints despite claiming that proof. Historical totals
are therefore not used as readiness evidence. See `review-report.md` and
`review-resolution.md` for accepted findings and fixes.

## Verified environment and boundaries

- New disposable PostgreSQL 18 cluster, `127.0.0.1:55439`, synthetic local data.
- Phase target: `cleanora_r1_p09_review_proof` through explicit `CLEANORA_R1_P09_DATABASE_URL`.
- Earlier regression target: `cleanora_r1_p04_review_proof` through `TEST_DATABASE_URL` and matching `TEST_MIGRATION_DATABASE_URL`.
- Catalog live target: `cleanora_r1_p08_review_proof` through explicit `CLEANORA_R1_P08_DATABASE_URL`.
- The disposable cluster was stopped after final verification; local proof data and logs are retained.
- Process-local URL overrides; repository `.env` and remote databases were not changed.
- One active phase; four new Providers-owned entities. No Browse, Booking, wallet, Docker or cloud implementation.
- No applied migration edited; SQL SHA-256 remains `F991C6386EDC6B623F4B38BFFDFFF01D2C06F1A53C5F34DC8D7EE73B744F0E0F`.

## Fresh gates

Commands use `npm.cmd` on this Windows host. Full logs are retained locally in
`C:/Users/ALYOSER/AppData/Local/Temp/cleanora-r1-p09-review-20260906/`.

| Gate | Result | Local evidence |
|---|---|---|
| Phase 9 tests and coverage | 37 files passed; 168 tests passed, 1 inverse no-DB check skipped; exit 0 | `phase-final.log` |
| Phase statements / branches / functions / lines | 88.31% / 80.13% / 86.12% / 88.69%; all 80/75/80/80 thresholds pass | `phase-coverage-summary.json` |
| Clean migration | Exact 80 tables, 16 migration history, double-seed idempotency, empty Phase 9 tables, redeploy and all phase probes; exit 0 | `clean-probes.log` |
| Populated Phase 8 → Phase 9 upgrade | All baseline table digests preserved; empty new tables before seed; idempotent redeploy; exit 0 | `upgrade-final.log` |
| Phase 9 live constraints, both validators | 28 expected SQLSTATE rejections; valid price transitions; exact 65-digit money; fixture rollback | Same migration logs |
| Build + Prisma client generation | exit 0 | `build-final.log` |
| Typecheck | exit 0 | `typecheck-probes.log` |
| Full test suite | 424 files passed; 1894 tests passed, 6 skipped; zero failures; exit 0; 477.18 seconds | `full-test-final.log`, `full-test-result.json`, `full-test-exit.txt` |
| Full repository coverage | 423 files passed; 1892 tests passed, 6 skipped; exit 0. Statements 84.70%, branches 76.10%, functions 87.61%, lines 86.43%; all thresholds pass | `full-coverage.log`, `full-coverage-summary.json` |
| Lint / Prisma schema / OpenAPI / Postman / docs | All passed; Phase 9 source/runtime/collection parity also covered by its focused suites | `lint-final.log`, `schema-final.log`, `openapi-final.log`, `postman-final.log`, `docs-final.log` |

The earlier full test attempt overlapped source edits and failed with stale
Configuration-reader exports (20 failures, 1874 passes). A fresh Phase 9 process
passed all affected tests; that earlier full attempt is not a readiness pass.

## Supplemental regression evidence

The five skipped Phase 7 live tests require a Phase 7 database name. All five
passed in three files against freshly migrated/seeded local
`cleanora_r1_p07_review_proof` (`p07-supplement.log`). The sixth coverage skip
is the intentional inverse no-Phase-9-database branch.

The SC-008 workload suite hit a database setup hook timeout in one full run.
An isolated rerun passed both tests in 31.41 seconds (`sc008-final.log`), including
the unchanged 25-lane, 1,000-interaction acceptance assertions. The subsequent full suite passed; all 25 workload lanes ran and 100% of measured
interactions met two seconds. No timeout, workload size or acceptance threshold
was weakened.

## Requirement and outcome reconciliation

Paths below are relative to the repository root. Each row maps to passing
Phase 9 behavior, with full-repository compatibility verified by T082.

| Requirements / outcomes | Implementation | Executable evidence |
|---|---|---|
| FR-001–FR-006; SC-001, SC-011 | Providers service/repository, Catalog public reader, Configuration public country/policy readers | `provider-service-create.repository`, `r1-p09-catalog-public-contract`, `r1-p09-module-boundaries`, real migration probes |
| FR-007–FR-010; SC-003 | Transaction-bound identity, exact membership, protected routes, no public surface | `provider-service-authorization.policy`, `provider-service.service`, `provider-services-create-read`, `provider-services-negative-surface` |
| FR-011–FR-017; SC-002, SC-007 | Exact minor-unit decimal policies, strict bodies, authoritative country policy, bilingual notes | `provider-service-configuration.policy`, `provider-service-output-safety`, create/HTTP tests, 65-digit live SQL probe |
| FR-018–FR-027; SC-004–SC-006 | Aggregate version, durable history receipts, serializable commands, immutable retained prices/histories | `provider-service-price-status.repository`, `provider-service-concurrency-idempotency`, `provider-service-history.policy`, audit rollback and live SQL probes |
| FR-028–FR-032; SC-008 | Country-controlled approval, Staff role/permission recheck, pending/effective separation | `provider-service-approval`, `provider-service-approval.repository`, `provider-service-price-approval`, price/lifecycle HTTP |
| FR-033–FR-035; SC-009 | Dynamic readiness, exact blockers, Browse eligibility false | `provider-service-readiness.policy`, `provider-service-readiness`, `provider-service-projection.coverage` |
| FR-036–FR-040; SC-010 | Safe exact-locale internal DTO, repeatable-read transaction, bounded conflict, no Booking writes | `provider-service-snapshot`, `provider-service-snapshot-consistency`, public-contract/output-safety/negative-surface tests |
| FR-041–FR-043 | Atomic audit/history/state, stable safe errors | Audit-failure unchanged-state assertion, live rejected/stale/race/replay scenarios, controller and Prisma error mapper tests |
| FR-044–FR-046; SC-011–SC-012 | Four-table additive migration, no new module or production price seed, explicit ownership and traceability | Clean/upgrade proofs, `r1-p09-migration-contract`, boundary suites, task/evidence reconciliation |

## Final task and review state

All 84 tasks are checked. All eight review findings are accepted and resolved.
Companion is synchronized to `implement/implemented`, preserving its history;
this is implementation status, not human phase-completion approval. The current
pointer records technical readiness while keeping Phase 9 active.

## Git handoff scope

The intended Phase 9 change includes the active spec directory, four-table
migration, Providers vertical, touched public adapters/composition/readiness,
API docs and Phase 9 OpenAPI/Postman artifacts, validation tooling and relevant
regression tests. Exact staging is reserved for the guarded Git workflow.

Preserve and exclude local extras: `.tmp-rerun-fails.txt`, `.tmp-test-run/`,
`code-security.datadog.yaml`, the Phase 9 frontend meeting-guide DOCX,
`postman/cleanora_collections/`, and `scripts/tmp-*.mjs`. Five temporary helpers
received their missing `node:url` import so the existing whole-tree lint gate
can pass; those helpers still remain local. Pre-existing Phase 8 Postman import
fixes in its generator and collection are separate from Phase 9 scope.

No independent Claude review is claimed. No human completion approval, staging,
commit, push, merge, deployment or production migration is implied by this ledger.

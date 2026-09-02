# Review Report — R1-P08 Catalog, Localization & Service Requirements

## Scope and evidence

### Loaded context summary

- Reviewed the active R1-P08 specification, plan, T001–T156 task claims, phase checklists, Definition of Done, current product pointer, prior review artifacts, and the complete effective working-tree change from `main`; T156 was reopened when the final SC-012 contradiction was confirmed.
- Reviewed branch `r1-p08-catalog-localization-service-requirements` from merge base `c187aa473c5dc6cb52f4ab1bbded2b20bcb089da`; `HEAD` is still that base, so the effective diff includes tracked changes and intended untracked R1-P08 files.
- Reviewed `src/modules/catalog/**`, the Catalog seams into Authentication, Media, Admin, and Configuration, centralized Prisma schema, the R1-P08 migration and seed, composition/routes, OpenAPI/Postman generation, migration validators, and R1-P08 tests.
- Applied the modular-monolith, module-boundary, Express/Zod, API-error, Prisma-migration, security, testing, and review rules together with the required `module-boundary-reviewer` and `prisma-phase-migration` procedures.
- Reproduced the prior findings instead of trusting stale PASS claims, verified the accepted fixes, ran the approved disposable-database proofs, and reconciled phase-scoped gates separately from known cross-phase global-test infrastructure debt.

### Diff and worktree qualification

- Base/merge ancestor: `main@c187aa473c5dc6cb52f4ab1bbded2b20bcb089da`.
- Branch: `r1-p08-catalog-localization-service-requirements`.
- The worktree contains unrelated pre-existing material such as `.claude/`, `.mcp.json`, older design exports, meeting-guide documents, and nested Postman workspace directories. They are outside this review and must not be swept into the guarded R1-P08 commit.
- The task-owned `.tmp-r1-p08` directory was moved outside the repository after generated cache files interfered with lint. It is not part of the Git worktree.

### Prior finding resolution verified

| Finding | Verified disposition |
|---|---|
| M-01 actor-scoped idempotency | Fixed: Prisma/SQL uniqueness, advisory lock, lookup, replay, and conflict identity include the trusted actor; unit and live cross-actor tests pass. |
| M-02 Catalog read of Media persistence | Fixed: Catalog queries only Catalog-owned association rows and consumes transaction-bound safe facts through `TransactionalCatalogServiceMediaFactsReader` on `media.public`. |
| M-03 TODO/skip live evidence | Fixed: approved-target live HTTP, persistence, migration-contract, actor-idempotency, seed, and concurrency bodies are implemented; final phase run is 333 passed and 0 skipped. |
| M-04 repository gate failures | Partially fixed: migration table inventory passes and all R1-P08 integration files pass under the default global Vitest configuration. The command-level repository integration and global coverage gates still exit 1, so SC-012 remains unresolved. |
| M-05 PENDING Media reservation shape | Fixed: application types, repository validation, Prisma/SQL constraint, static assertions, and live probes require the reserved Media ID for PENDING commands. |
| m-01 stale evidence | Reconciled by this report and the final closeout sections in the phase evidence artifacts. Historical checkpoint sections remain traceability records and are explicitly superseded. |

### Checks run

| Command | Exit | Salient output / classification |
|---|---:|---|
| `npm.cmd run typecheck` | 0 | Final TypeScript no-emit check passed. |
| `npm.cmd run lint` | 0 | Final ESLint run passed after task cache was moved outside the repository. |
| `npm.cmd run build` | 0 | Prisma Client 7.9.0 generated; production TypeScript build passed. |
| `npm.cmd run prisma:validate` | 0 | Centralized Prisma schema valid. |
| `npm.cmd run test:unit` | 0 | 218 files; 1,123 tests passed. |
| `npm.cmd run test:r1-p08` | 0 | Final run: 54 files; **333 passed, 0 skipped**. |
| `npm.cmd run test:coverage:r1-p08` | 0 | 54 files; 333 passed. Coverage: **85.41% statements, 76.04% branches, 83.37% functions, 85.21% lines**. |
| Default-config five-file R1-P08 live subset | 0 | 5 files and **33/33 tests passed** under the same default Vitest configuration used by `test:integration`; verifies the per-file live timeout fix. |
| Four-file module/public-contract suite | 0 | 4 files and **23/23 tests passed**. |
| Two-file migration-validator unit suite | 0 | 2 files and **5/5 tests passed**. |
| `npm.cmd run db:validate-clean-migration` | 0 | Final post-fix run: 15 migrations, exact 76 tables, double-seed idempotency, DEC-044 counts, and live R1-P05/R1-P06/R1-P07/R1-P08 probes passed in an isolated guarded schema. |
| `npm.cmd run db:validate-r1-p08-upgrade` | 0 | Final post-fix run: populated R1-P07 baseline digests/workforce truth preserved; empty pre-seed Catalog, idempotent redeploy, DEC-044 counts, and live R1-P08 constraints passed. |
| `npm.cmd run openapi:validate` | 0 | Repository OpenAPI/runtime document valid. |
| `npm.cmd run postman:validate` | 0 | 11 JSON files and runtime parity valid. |
| `npm.cmd run docs:check` | 0 | 12 configured documentation targets passed. |
| `npm audit --audit-level=high` | 0 | Zero vulnerabilities after a scoped Prisma CLI override to `mysql2@3.22.0`; Prisma remains 7.9.0. |
| `git -c safe.directory=D:/new_repos/Cleanora_R1 diff --check` | 0 | No whitespace errors; LF/CRLF notices only. |
| Valid-target `npm.cmd run test:integration` before the R1-P08 timeout fix | 1 | 13 files failed, 156 passed, 3 skipped; 9 tests failed, 582 passed, 15 skipped. Seven R1-P08 failures were the default 5-second timeout and were subsequently fixed/proved by the 5-file 33/33 default-config run. Remaining failures are older R1-P04 target-name guards and R1-P02/R1-P03 remote timing budgets. |
| Last recorded `npm.cmd run test:coverage` | 1 | Global thresholds were not met: 73.46% statements, 67.13% branches, 75.36% functions, and 74.83% lines versus required 80/75/80/80. It was not rerun after the final R1-P08 timeout repair. |

## Findings

### BLOCKER

None.

### MAJOR

#### M-04 Required repository integration and global coverage gates remain red

- Evidence: `specs/R1-P08-catalog-localization-service-requirements/spec.md:449`, `specs/R1-P08-catalog-localization-service-requirements/tasks.md:307`, `specs/R1-P08-catalog-localization-service-requirements/tasks.md:308`, `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md:372`, and `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md:373`.
- Criterion/rule: SC-012 requires all phase-specific **and repository** quality gates to pass before owner completion approval. T150 and T151 explicitly require the full `test:integration` and `test:coverage` commands and unchanged global thresholds.
- Impact: The implementation cannot be represented as satisfying 100% of SC-001–SC-012. The last valid-target full integration run exited 1, the last global coverage run exited 1 below the configured 80/75/80/80 thresholds, and no successful post-repair full run exists. Committing now would knowingly hand off a phase whose required repository gates are red.
- Focused remediation: Provide/authorize a current-schema disposable integration target arrangement that satisfies the historical R1-P04 guard while retaining the separate R1-P08 live target, then rerun `npm run test:integration` and `npm run test:coverage`. If the remaining older timing failures reproduce on that valid arrangement, fix only the shared test harness/timing defect with regression evidence; do not weaken guards, thresholds, assertions, or exclusions. Alternatively, the owner must explicitly approve and document an SC-012 exception before a reviewer can treat this as accepted debt.

### MINOR

#### m-01 Repository test infrastructure has incompatible historical target assumptions

- Evidence: `scripts/r1-p04-test-database.cjs:137`, `tests/integration/authentication/abuse-status-security.test.ts:4`, `tests/integration/authorization-seed.test.ts:34`, `specs/R1-P08-catalog-localization-service-requirements/tasks.md:307`, `specs/R1-P08-catalog-localization-service-requirements/tasks.md:308`.
- Criterion/rule: The testing-honesty rule requires exact recording and separation of phase defects from environment/infrastructure defects.
- Impact: A single `TEST_DATABASE_URL=cleanora_r1_p08_test` cannot also satisfy the older R1-P04 proof-name guard. Two older remote tests also exceed their 60/120-second timing budgets. This explains the remaining failures and narrows remediation, but it does not override SC-012's explicit command-level pass requirement.
- Remediation: Orchestrate approved phase-specific disposable targets for the full repository gate, then tune only demonstrably remote-safe older test budgets if still necessary. Do not weaken database-name guards or count skipped suites as passes.

#### m-02 PostgreSQL driver concurrency warnings should be removed before the next major driver upgrade

- Evidence: `tests/helpers/r1-p08-catalog-live.ts:1`, `tests/integration/catalog/catalog-live-disposable.test.ts:166` and repeated runtime warning: `Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0`.
- Criterion/rule: The TypeScript/testing rules require deterministic test infrastructure and honest warning reporting.
- Impact: Current pg 8 runs pass and the warning does not change application behavior, but the affected concurrency harness will need refactoring before pg 9.
- Remediation: In normal dependency maintenance, ensure each intentional concurrent operation owns a separate checked-out client or uses explicit async flow control, then rerun the live concurrency suite. Do not suppress the warning without changing the underlying call pattern.

## Questions for owner

1. How should the unresolved SC-012 repository-gate requirement be closed?

   1. Authorize a current-schema disposable integration-target arrangement that satisfies the historical R1-P04 guard while retaining the separate R1-P08 live target, then require both full commands to pass.
   2. Open a separate shared-test-infrastructure phase first; keep R1-P08 unapproved until it makes both repository commands green.
   3. Explicitly accept the documented `test:integration` / `test:coverage` failures as an SC-012 exception and tracked debt for this phase.

   **Recommendation after options:** Option 1. It preserves the locked safety guards and thresholds while producing the successful repository evidence SC-012 actually requires.

## Tests and checks not run

- `npm.cmd run test:coverage` was not rerun after the final R1-P08 timeout repair. The last recorded global result remains below the repository thresholds, and a new run would still encounter the independently reproduced R1-P04 database-name guard and older timing failures. Phase-scoped coverage was rerun after all changes and passed.
- The full one-hour `npm.cmd run test:integration` was not repeated after the per-file R1-P08 timeout repair. Instead, all five R1-P08 live-capable files were rerun under the default global Vitest configuration and passed 33/33, directly proving the phase-owned failure was removed.
- No commit, push, merge, deploy, production migration, force-push, reset, clean, or production/database action outside guarded disposable proof schemas was performed.

## Verdict

`CHANGES REQUIRED`

R1-P08 is **not ready for commit and push**. Most phase behavior is complete and verified, but the readiness criteria are not yet met:

1. M-04 remains an unresolved MAJOR against SC-012.
2. `test:integration` and `test:coverage` do not have successful final repository runs.
3. T156 cannot honestly claim 100% SC evidence or Ready status and has been reopened.
4. Module boundaries, migration safety, all 333 phase tests, phase coverage, static/security/API/docs/audit gates, and both disposable migration proofs otherwise pass.

## Owner handoff checklist

- Approve R1-P08 phase completion? **No — resolve M-04 or explicitly accept the SC-012 exception first.**
- Ready for guarded commit and push? **No.**
- Commit or push performed in this review? **No.** Git publication requires a separate human message whose entire content is exactly `commit and push`.
- Anything still blocking Phase 8? **Yes: successful repository integration/global coverage evidence, or an explicit owner-approved SC-012 exception.**

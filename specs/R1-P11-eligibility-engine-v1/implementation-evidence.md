# R1-P11 Implementation Evidence — Batch A (T001–T007)

**Phase**: R1-P11 — Eligibility Engine V1  
**Batch**: Batch A — phase test selection and public declarations (DEC-083)  
**Authority**: Codex `PREPARATION_ACCEPTED` / PM-05 (`preparation-acceptance-pm05.md`); DEC-062; DEC-083  
**Scope**: T001–T007 only. Batches B–G (persistence, readers, rules, evaluation, Browse, purge, full gates) are out of scope.

**Status**: Batch A deliverables created. Not staged, not committed. Gate results below are **TBD** for the parent agent to fill after running commands. This batch does **not** claim rule behavior, coverage-pass, migration validation, or P11 completion.

## Preparation acceptance

| Item | Value |
|---|---|
| Verdict | **PREPARATION_ACCEPTED** (PM-05) |
| P11-PREP-01 | **CLOSED** (with prior PREP-02–08 closures) |
| Batch A authorization | **Authorized** under DEC-083 (T001–T007 exactly) |
| Acceptance artifact | `specs/R1-P11-eligibility-engine-v1/preparation-acceptance-pm05.md` |

## Baseline and attribution

| Field | Value |
|---|---|
| Feature branch | `codex/r1-p11-eligibility-engine-v1` |
| Baseline / starting HEAD | `38f3efa080a4ffd71f24fd83b2ab800662558b30` |
| Inherited dirty tree | **Preserved** — prior P08/P09/P10 local and untracked work remains untouched by Batch A except intended P11 additions and status bookkeeping |
| Attribution | P11 Batch A files are new under this phase; inherited modifications listed in `git status` are **not** claimed as P11 work |

## Vitest selection allowlist (T001)

Exact `include` entries in `vitest.r1-p11.config.ts` (after Batch B):

1. `tests/unit/scripts/r1-p11-test-selection.test.ts`
2. `tests/unit/modules/r1-p11-module-boundaries.test.ts`
3. `tests/integration/database/r1-p11-schema-constraints.test.ts` *(Batch B; DB-gated)*
4. `tests/integration/eligibility/r1-p11-rule-seed.test.ts` *(Batch B; DB-gated)*

Coverage `include` (Batch A only):

- `src/modules/eligibility/eligibility.public.ts`

`reportsDirectory`: `coverage/r1-p11`  
Thresholds: statements/functions/lines **80**, branches **75**  
Pool/timeouts: same as P10 (`forks`, `maxWorkers: 1`, `fileParallelism: false`, 180s hooks/tests).

## Batch A file deliverables

| Task | Path |
|---|---|
| T001 | `vitest.r1-p11.config.ts` |
| T002 | `package.json` scripts `test:r1-p11`, `test:coverage:r1-p11` |
| T003 | `tests/unit/scripts/r1-p11-test-selection.test.ts` |
| T004 | `tests/helpers/r1-p11-eligibility-fixtures.ts` |
| T005 | this file |
| T006 | `tests/unit/modules/r1-p11-module-boundaries.test.ts` |
| T007 | `src/modules/eligibility/eligibility.public.ts` (declarations only) |

## Gate results (Batch A acceptance)

| Command | Exit | Notes |
|---|---|---|
| `npm run test:r1-p11` | **0** | 2 files / 8 tests passed (~955ms) |
| `npm run typecheck` (`tsc --noEmit`) | **0** | |
| eslint on Batch A paths | **0** | eligibility.public.ts + P11 selection/boundary/fixtures/config |
| `npm run test:coverage:r1-p11` | not required for Batch A pass claim | Declarations-only; coverage pass not claimed |
| `git diff --check` | **0** (earlier prep runs) | |

## Explicit non-claims (Batch A)

- No Prisma schema/migration created (Batch A)
- No Eligibility HTTP routes
- No runtime `EligibilityError` class or service bodies (Batch A)
- No Batches B–G behavior (Batch A snapshot)
- No commit / push

---

# R1-P11 Implementation Evidence — Batch B (T008–T013)

**Phase**: R1-P11 — Eligibility Engine V1  
**Batch**: Batch B — persistence (schema, migration, seed, repository)  
**Authority**: DEC-082, DEC-084; frozen `data-model.md` / `migration-plan.md` / `contracts/rule-version-contract.md`  
**Scope**: T008–T013 only. No evaluation rules, no Browse facade, no Batch C readers.

**Status**: Batch B deliverables created. Not staged, not committed.

## Batch B file deliverables

| Task | Path |
|---|---|
| T008 | `prisma/schema.prisma` — `EligibilityCandidateRowKind`, three models, `Country.eligibilityRuleVersions` |
| T009 | `prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql` + `specs/R1-P11-eligibility-engine-v1/migration-review.md` |
| T010 | `prisma/seed.ts` — `seedR1P11EligibilityRuleVersion`, checksum helper, `R1_P11_ELIGIBILITY_RULE_SEED` |
| T011 | `src/modules/eligibility/eligibility.errors.ts`, `infrastructure/eligibility.unit-of-work.ts`, `infrastructure/prisma-eligibility.repository.ts` |
| T012 | `tests/integration/database/r1-p11-schema-constraints.test.ts` (+ `tests/helpers/r1-p11-eligibility-live.ts`, fixture DB gate) |
| T013 | `tests/integration/eligibility/r1-p11-rule-seed.test.ts` |
| Allowlist | `vitest.r1-p11.config.ts` include extended with T012/T013 suites |

## Gate results (Batch B)

| Command | Exit | Notes |
|---|---|---|
| `npm run prisma:validate` | **0** | Schema valid |
| `npm run prisma:generate` | **0** | Client regenerated to `src/generated/prisma` |
| `npx tsc --noEmit` | **0** | After EligibilityError / JsonNull typing fixes |
| `npm run test:r1-p11` | **0** | 2 files passed / 2 skipped (DB-gated); 8 passed / 8 skipped |
| Live constraint/seed proofs | gated | Require approved `cleanora_r1_p11_*_(test\|proof\|clean\|ci)` via `CLEANORA_R1_P11_DATABASE_URL` |

## Explicit non-claims (Batch B)

- No evaluation rule implementations
- No Browse facade / HTTP
- No Providers/Catalog/Configuration reader extensions (Batch C)
- No commit / push
- Live migration apply / disposable DB constraint pass not claimed unless URL was provided and suites ran green

---

# R1-P11 Implementation Evidence — Batches C / D / E

**Phase**: R1-P11 — Eligibility Engine V1  
**Batches**: C (dependency readers), D (pure rules), E (application orchestration)  
**Authority**: DEC-063–084; `tasks.md`  
**Status**: Deliverables created. Not staged, not committed. Phase **not** complete.

## Context loaded (≤5)

- Active phase `specs/R1-P11-eligibility-engine-v1/` (tasks, dependency-readers, reason-codes, public contract)
- DEC-074 / DEC-080 / DEC-084 algebra and reader contracts
- Existing P09/P10 Providers public seams + Batch A/B Eligibility scaffold

## Batch D deliverables (priority-first)

| Task | Path |
|---|---|
| T021 | `src/modules/eligibility/eligibility.reasons.ts` |
| T022 | `src/modules/eligibility/eligibility.rules.ts` |
| T023 | `src/modules/eligibility/eligibility.crew-capacity.ts` |
| T024–T025 | `eligibility.performance.ts`, `performance-evidence.port.ts` |
| T026–T027 | `tests/unit/modules/eligibility/*.test.ts` (reasons, rules, crew-capacity, performance-gate) |

## Batch C deliverables

| Task | Path |
|---|---|
| T014–T016 | `providers.public.ts` Eligibility types/factories; `eligibility-availability.reader.ts`; `eligibility-pricing.reader.ts`; `eligibility-lifecycle.reader.ts` |
| T017 | Reused existing Catalog/Configuration tx factories (no API rewrite) |
| T018 | `src/composition.ts` — Eligibility UoW + tx-bound reader factories + `eligibilityApplicationService` |
| T019–T020 | reader contract suite + expanded module-boundary scan |
| Capacity facts | `gender` + `workerType` added to capacity evaluation members for Team aggregates |

### Batch C gaps / honesty notes

- Verification satisfaction defaults to “not required / satisfied” until composition injects a verification reader (`eligibility-lifecycle.reader.ts`).
- Escort required flag is currently always `false` (DEC-084: escort not universally required; no new product rule invented).
- Full live reader integration against disposable DB remains gated / placeholder beyond contract-shape tests.

## Batch E deliverables

| Task | Path |
|---|---|
| T028–T031 | `eligibility.service.ts` (`createEligibilityApplicationService`, validate, evaluateEligibility, persist) |
| T029 | `eligibility.hashes.ts` |
| Public export | `eligibility.public.ts` re-exports `createEligibilityApplicationService` |
| T033 / T035 | `determinism.test.ts`, `retry-clock.test.ts` |
| T032 / T034 / T036 | evaluate / overflow / concurrent — files started; live proofs incomplete |

### Batch E gaps

- End-to-end evaluate live matrix still gated on disposable DB.
- Concurrent snapshot + overflow live proofs not claimed.

## Batch F / purge deliverables

| Task | Path |
|---|---|
| T037–T038 | `getStandardBrowseCandidates` + composition `eligibilityApplicationService` |
| T039–T040 | `browse-projection.test.ts`, `privacy-negatives.test.ts` |
| T041–T042 | `r1-p11-browse-facade.test.ts` (always-on + live placeholder) |
| T043 | `docs/apis/README.md` zero-new-HTTP row; phase `contracts/http-api.md` |
| T044 (partial G) | `purgeExpiredEvaluations` service + `purge-batch-size.test.ts` |
| Bound factories | `createBoundEligibilityPricingReader`, `createBoundEligibilityAvailabilityReader`, lifecycle bind |

### Batch F gaps

- Live composed Browse/evaluate proofs against real P09/P10 fixtures require `CLEANORA_R1_P11_DATABASE_URL`.
- T045 retention suite added (always-on + live gated); live boundary/order proofs still need disposable URL.
- Codex Batch A–G reviews / final PASS blocked (usage limit / pending).

## Gate results (C/D/E + F wiring)

| Command | Exit | Notes |
|---|---|---|
| `npm run typecheck` | **0** | After composition + Browse/purge wiring |
| `npm run test:r1-p11` | **0** | 14 files passed / 2 skipped (DB-gated); 58 passed / 11 skipped |
| `npm run test:coverage:r1-p11` | not claimed | Coverage pass not asserted this batch |
| Live DB proofs | gated | Require `CLEANORA_R1_P11_DATABASE_URL` |

## Explicit non-claims

- No phase complete / no Codex PASS
- No commit / push
- No live SC-005 Browse DB matrix claimed
- No invented product decisions beyond approved DEC-063–084

---

# R1-P11 Implementation Evidence — Batch G scaffolding (T045–T048)

**Phase**: R1-P11 — Eligibility Engine V1  
**Batch**: Batch G partial — retention tests, upgrade/clean validators, coverage readiness  
**Scope**: T045–T048 only. Full gate matrix, Codex PASS, and phase completion remain out of scope.

**Status**: Deliverables created. Not staged, not committed. Phase **not** complete.

## Deliverables

| Task | Path / change |
|---|---|
| T045 | `tests/integration/eligibility/r1-p11-retention.test.ts` — always-on invalid `batchSize` / no caller `asOf` / 720h `computeEligibilityExpiresAt`; live 720h boundary + `(expiresAt, id)` order DB-gated |
| T046 | `scripts/validate-r1-p11-upgrade.ts` + `npm run db:validate-r1-p11-upgrade` |
| T047 | `tests/unit/scripts/validate-r1-p11-upgrade.test.ts` |
| T048 | `scripts/validate-clean-migration.ts` — `R1_P11_MIGRATION`, eligibility tables, `assertR1P11MigrationSql`, `APPROVED_R1_P11_TARGET_PATTERN`; P10 upgrade pinned through-P10 expectations |
| Coverage | `vitest.r1-p11.config.ts` include retention + upgrade unit suite; production coverage allowlist unchanged (eligibility module + eligibility-* readers; no whole `composition.ts`) |

## Gate results (Batch G scaffolding)

| Command | Exit | Notes |
|---|---|---|
| `npm run typecheck` | **0** | |
| `npm run test:r1-p11` | **0** | 21 passed / 2 skipped files; **93 passed / 13 skipped** tests |
| `npm run test:coverage:r1-p11` | **1** (threshold) | Statements **80.51%**, Branches **70.01%**, Functions **81.42%**, Lines **80.45%** — stmts/funcs/lines meet FR-032; **branches below 75%** |
| `npm run db:validate-r1-p11-upgrade` | not claimed live | Requires approved disposable URL |

### Coverage remaining gaps

- Branches (~70%): availability AVAILABLE path, pricing AVAILABLE path, deeper rule/service branches
- Live DB suites still skipped without `CLEANORA_R1_P11_DATABASE_URL`
- Availability/pricing reader happy-paths need more fixtures to close branch threshold

## Explicit Batch G non-claims

- No Codex adversarial PASS / no phase Complete
- No commit / push
- Live clean/upgrade migration proofs not claimed without disposable DB
- Coverage threshold pass not claimed (branches 70.01% < 75%)

---

# R1-P11 Implementation Evidence — Branch coverage close-out (FR-032 / SC-007)

**Phase**: R1-P11 — Eligibility Engine V1  
**Scope**: Raise phase branch coverage from ~70% to ≥75% via meaningful unit tests (no threshold lowering; coverage `include` unchanged).  
**Status**: Phase coverage thresholds **PASS**. Not staged, not committed. Phase **not** Complete (Codex PASS / live DB gates still outstanding).

## Tests extended (no new Vitest include entries)

| File | Coverage focus |
|---|---|
| `tests/unit/modules/eligibility/eligibility-readers.unit.test.ts` | Pricing AVAILABLE path; unapproved/catalog/country/usability UNAVAILABLE; serialization CONFLICT remap |
| `tests/unit/modules/eligibility/eligibility-availability.reader.test.ts` | Discovery OK + district ancestry; AVAILABLE_FACTS; CAPACITY_RULE-only MISSING_CONFIGURATION with preserved facts; district coverage + suspended |
| `tests/unit/modules/eligibility/eligibility.rules.test.ts` | Lifecycle multi-FAIL; OVERFLOW NOT_EVALUATED; pause/suspension; TEAM_MEMBERS_UNAVAILABLE; CREW_PREFERENCE FAIL; eligible sortingFacts; MISSING_CONFIGURATION multi-fail |
| `tests/unit/modules/eligibility/evaluate-orchestration.test.ts` | Geo / units / providerIds validation; AVAILABLE pricing + REQUESTED_INTERVAL_TOO_SHORT; eligible persist + Browse; discovery OVERFLOW; CAPACITY_RULE_MISSING evidence; PERSISTENCE_FAILED |
| `tests/unit/modules/eligibility/prisma-eligibility.repository.test.ts` | `insertEvaluationWithCandidates` + `createPrismaEligibilityRepository`; purge without lookahead |
| `tests/unit/modules/eligibility/eligibility.reasons.test.ts` | `EligibilityError` / `eligibilityError` / `isEligibilityError` |

`vitest.r1-p11.config.ts` test `include` list unchanged (existing files only). Coverage production `include` unchanged.

## Gate results

| Command | Exit | Notes |
|---|---|---|
| `npm run test:coverage:r1-p11` | **0** | All four thresholds met |

### Final coverage (`coverage/r1-p11/coverage-summary.json`)

| Metric | % | Covered / Total |
|---|---|---|
| Statements | **91.08** | 603 / 662 |
| Branches | **86.65** | 526 / 607 |
| Functions | **91.42** | 128 / 140 |
| Lines | **90.99** | 596 / 655 |

Thresholds: statements/functions/lines **80**, branches **75**.

## Explicit non-claims (superseded by Batch G close-out below)

- Live disposable-DB proofs, migration validators, and completion were outstanding at the branch-coverage snapshot above.

---

# R1-P11 Implementation Evidence — Batch G close-out (T032/T034/T036/T049–T054)

**Phase**: R1-P11 — Eligibility Engine V1  
**Date**: 2026-09-09  
**Authority**: DEC-062 delegated completion; DEC-078 honest repository-gate reporting  
**Status**: Technical readiness **PASS**. Live proofs used disposable `cleanora_r1_p11_proof` via `CLEANORA_R1_P11_DATABASE_URL` only (never production-looking `Cleanora`).

## Live composed proofs (T032 / T034 / T036 / T041)

Harness: `tests/helpers/r1-p11-eligibility-live.ts` — composed Eligibility against real P08 Catalog, P09 pricing, and P10 coverage/calendar/capacity fixtures on the approved disposable target.

| Task | Suite | Result |
|---|---|---|
| T032 | `tests/integration/eligibility/r1-p11-evaluate.test.ts` | Live discovery eligible; Catalog FAIL empty set; explicit missing-Provider summary persist; 501 IDs → `EVALUATION_LIMIT_EXCEEDED` |
| T034 | same evaluate suite | Overflow/limit bound proven live |
| T036 | `tests/integration/eligibility/r1-p11-concurrent-snapshot.test.ts` | Two parallel evaluates succeed |
| T041 | `tests/integration/eligibility/r1-p11-browse-facade.test.ts` | Composed facade against real P09/P10 facts; `providerIds` rejected |

## T049 — Phase tests and coverage (SC-007)

| Command | Exit | Notes |
|---|---|---|
| `npm run test:r1-p11` | **0** | **24 files / 131 tests passed** (live DB included) |
| `npm run test:coverage:r1-p11` | **0** | All four thresholds met |

Final coverage (`coverage/r1-p11/coverage-summary.json`):

| Metric | % | Covered / Total | Threshold |
|---|---|---|---|
| Statements | **91.84** | 608 / 662 | 80 |
| Branches | **86.98** | 528 / 607 | 75 |
| Functions | **93.57** | 131 / 140 | 80 |
| Lines | **91.75** | 601 / 655 | 80 |

## T050 — Disposable migration proofs (SC-008)

See `migration-evidence.md`.

| Command | Exit | Notes |
|---|---|---|
| `npm run db:validate-clean-migration` | **0** | 18 migrations, exact 96 product tables, double-seed, empty Eligibility evaluation trees with seeded rule versions, live P05–P09 probes |
| `npm run db:validate-r1-p11-upgrade` | **0** (retry after one Neon `P1017` disconnect) | Populated P10 fixture upgraded; baseline digests preserved; empty Eligibility trees before seed; seeded rule versions; idempotent re-deploy |

## T051 — DEC-078 repository gates (honest outcomes)

Required commands were run. Inherited dirty-tree and tooling-scope failures are **not** relabeled as passes.

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run prisma:validate` | **0** | |
| `npm run build` | **0** | |
| `npm run docs:check` | **0** | |
| `npm run openapi:validate` | **0** | |
| `npm run postman:validate` | **0** | |
| `git diff --check` | **0** | CRLF warnings only |
| Phase-scoped `npx eslint` on P11 source/test/script paths | **0** | |
| `npm run lint` (`eslint .`) | **1** | Inherited untracked `.agents/skills/*/scripts/relay.mjs` `no-undef` noise. **Not** accepted as P11 evidence. Intended P11 tree passes. |
| `npm run test:unit` | **1** | First run: 15 files / 21 tests failed, 271 files / 1564 tests passed. P11-introduced failures repaired (Prisma-free lifecycle reader; no `from "vitest"` in P11 suites; clean-migration EXPECTED includes P10+P11; P08 pin no longer forbids the Eligibility module). Remaining failures are inherited P08/P09/P10 dirty-tree pins (OpenAPI metadata, privileged-reason catalog / `CONFIGURATION_LOCALITY_WRITE`, configuration timezone policy codes, P08 “exactly one migration after P07”, composition Prisma bind without a test database). Recorded under DEC-078; not silently narrowed. |
| `npm run test:integration` | **not run** | Approved test URL is disposable `cleanora_r1_p04_current_proof`. Not executed in this closeout to avoid mutating the shared P04-named proof while P11 live proofs used `cleanora_r1_p11_proof`. Recorded as not run, not as pass (DEC-078). |
| `npm run test:coverage` | **not run** | Full-repo coverage not executed in this closeout. Phase `test:coverage:r1-p11` passed all four thresholds. Recorded as not run, not as pass (DEC-078). |

### P11-owned unit repairs (not inherited)

- `src/modules/providers/eligibility-lifecycle.reader.ts` — opaque transaction duck-typing; no `#generated` / `PrismaClient` outside Providers infrastructure
- P11 tests — globals-only Vitest API (`tests/unit/tooling/vitest-runner-identity.test.ts`)
- `tests/unit/scripts/validate-clean-migration.test.ts` — chronology includes `r1_p10_*` and `r1_p11_eligibility_engine_v1`
- `tests/unit/modules/r1-p08-module-boundaries.test.ts` — Eligibility module is in-scope for P11 (FR-001); Browse/Booking/Workers remain forbidden

## T052–T054

- Review: `implementation-review-report.md` (verdict **PASS**)
- Resolution: `review-resolution.md`
- Summary: `implementation-summary.md`
- Completion: `completion-report.md`

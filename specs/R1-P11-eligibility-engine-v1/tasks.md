# Tasks: R1-P11 — Eligibility Engine V1

Every task is mandatory unless labeled evidence-only. Tests are written before or
with owning behavior. Cursor batches are sequential writers. **All items
unchecked** until implementation evidence exists.

Batches **A–G** match Codex implementation order. **Batch A authorized** under
Codex PM-05 `PREPARATION_ACCEPTED` / DEC-083 (T001–T007). Batches B–G remain
unauthorized until Batch A acceptance.

Authority refinements: DEC-079–084.

## Batch A — Phase test selection and public declarations (DEC-083)

- [x] T001 Create Phase 11 Vitest selection in `vitest.r1-p11.config.ts` (exact allowlist: P11 suites + explicitly named changed-seam suites only)
- [x] T002 Add `test:r1-p11` and `test:coverage:r1-p11` scripts to `package.json` (and lockfile only if required by install policy)
- [x] T003 Add selection guard test in `tests/unit/scripts/r1-p11-test-selection.test.ts` asserting historical suites are excluded and allowlisted changed-seam suites are named
- [x] T004 Create reusable disposable fixtures without secrets in `tests/helpers/r1-p11-eligibility-fixtures.ts`
- [x] T005 Record pre-implementation selection/preservation notes in `specs/R1-P11-eligibility-engine-v1/implementation-evidence.md`
- [x] T006 Add module-boundary test file `tests/unit/modules/r1-p11-module-boundaries.test.ts` asserting public entry path `src/modules/eligibility/eligibility.public.ts` and forbidding eligibility HTTP route registration — **must pass before Batch A acceptance**
- [x] T007 Create **only** substantive approved TypeScript declarations in `src/modules/eligibility/eligibility.public.ts` matching [contracts/eligibility-public-contract.md](contracts/eligibility-public-contract.md) (types + method signatures on the public interface, including `evaluationOutcomes`, `EligibilityRuleId`, `EligibilityEvidenceSnapshot`, `EligibilityError` **interface** — not a runtime class). **Do not** create empty `domain/` / `application/` / `infrastructure/` / `ports/` folders, barrels, fake runtime stubs, or “not implemented” service bodies.

**Batch A acceptance** (all required):

- Phase config resolves expected files; selection test passes
- Fixtures compile; baseline attribution recorded
- T006 green
- `eligibility.public.ts` compiles with frozen declarations only
- typecheck + relevant lint pass with actual command outcomes
- No rule evaluation behavior claimed complete; no coverage-pass claim

## Batch B — Persistence, immutable rule seed, constraints

- [x] T008 Add Prisma models/enums/relations for the three eligibility tables in `prisma/schema.prisma` (physical types per [data-model.md](data-model.md)) — Evidence: `EligibilityCandidateRowKind`, `EligibilityRuleVersion`, `EligibilityEvaluation`, `EligibilityCandidateResult`, `Country.eligibilityRuleVersions`; composite uniques + evaluation composite FK; XOR/partials owned by migration SQL
- [x] T009 Create and SQL-review `prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql` (XOR CHECK, partial uniques, unique `(id, countryId)` on rule versions, restrictive composite FK `(ruleVersionId, countryId)`, no live provider/team FK, `createdAt`, `expiresAt = completedAt + interval '720 hours'`) — Evidence: migration.sql + [migration-review.md](migration-review.md); `expiresAt` column with no create-time interval DEFAULT (app sets `completedAt + 720h`)
- [x] T010 Implement deterministic V1 rule-version seed in `prisma/seed.ts` (`eligibility_rule_r1_v1_eg`, `r1-v1`, EG, `2026-09-09T00:00:00.000Z`); verify **all** immutable fields; no overwrite on drift — Evidence: `seedR1P11EligibilityRuleVersion` + checksum helper; wired from `seed()` when table exists
- [x] T011 Implement Eligibility persistence in `src/modules/eligibility/eligibility.repository.ts` (+ service helpers as needed) — Evidence: compact `eligibility.errors.ts`, `infrastructure/eligibility.unit-of-work.ts` (RepeatableRead), `infrastructure/prisma-eligibility.repository.ts` (insert/find/purge); no evaluation rules or Browse facade
- [x] T012 [P] Schema/constraint tests in `tests/integration/database/r1-p11-schema-constraints.test.ts` (version uniques including `(id, countryId)`, composite FK country agreement, XOR, partial uniques, cascade, nonexistent providerId insert) — Evidence: DB-gated via `CLEANORA_R1_P11_DATABASE_URL` / `hasExplicitR1P11TestDatabase`
- [x] T013 [P] Seed idempotency + drift-fail tests in `tests/integration/eligibility/r1-p11-rule-seed.test.ts` — Evidence: DB-gated; identical reseed no-op; drift throws without overwrite

**Batch B acceptance**: Migration applies on disposable DB; constraints reject illegal rows; seed stable; drift fails loudly.

## Batch C — Transaction-bound public dependency extensions

- [x] T014 Extend Providers availability for opaque tx binding, bounded discovery overflow, remaining Team budget + OVERFLOW, missing-configuration business variants, and Team aggregate gender/escort facts — Evidence: `providers.public.ts` Eligibility* types + factories; `eligibility-availability.reader.ts` (`EligibilityAvailabilityReaderService`); capacity facts extended with `gender`/`workerType` for aggregates (no Worker IDs at boundary)
- [x] T015 Add locale-independent Eligibility pricing projection — Evidence: `eligibility-pricing.reader.ts` (`EligibilityPricingReaderService`); AVAILABLE|UNAVAILABLE; CONFLICT rejects; no invented locale; no REQUESTED_INTERVAL_TOO_SHORT
- [x] T016 Add narrow Eligibility Provider lifecycle projection — Evidence: `eligibility-lifecycle.reader.ts` (`PRESENT`|`MISSING`; no ownerUserId)
- [x] T017 Ensure Catalog + Configuration named methods + tx-bound factories — Evidence: verified reuse of existing `createTransactionalCatalogDefinitionReaderFactory`, `getProviderOfferingReference`, `resolveSelectableProviderOffering`, `createTransactionalActiveCountryReader`, `getActiveCountryById`, locality/TZ factories (already present; no rewrite)
- [x] T018 Wire adapter construction in `src/composition.ts` — Evidence: `EligibilityUnitOfWork` + tx-bound Catalog/Config/Providers Eligibility factories; `createEligibilityApplicationService` exported on `RuntimeDependencies.eligibilityApplicationService` (no Eligibility HTTP)
- [x] T019 [P] Compatibility tests — Evidence: `tests/integration/providers/r1-p11-eligibility-readers.test.ts` (contract shape always-on; live DB proofs gated)
- [x] T020 [P] Update module-boundary tests — Evidence: `r1-p11-module-boundaries.test.ts` scans all eligibility sources for public-contract-only foreign imports

**Batch C acceptance**: Readers execute inside a shared interactive transaction; overflow sentinel works; no private imports; no Worker IDs at Eligibility boundary. Composition wiring T018 landed (in-process service).

## Batch D — Pure rules, reasons, crew-filtered capacity, verdict algebra

- [x] T021 Implement closed reason/rule catalogs — Evidence: `eligibility.reasons.ts` (`TEAM_STRUCTURALLY_INVALID`; informational vs exclusion helpers)
- [x] T022 Implement pure rule evaluators + Provider/Team eligibility algebra — Evidence: `eligibility.rules.ts` (`evaluateProviderCandidate`, Catalog/lifecycle/price/coverage/schedule/team)
- [x] T023 Implement crew preference + capacity-after-crew-filter — Evidence: `eligibility.crew-capacity.ts`
- [x] T024 Implement performance-gate policy — Evidence: `eligibility.performance.ts` (disabled ⇒ NOT_APPLICABLE / port not called; enabled paths)
- [x] T025 Implement trusted `PerformanceEvidencePort` + test double — Evidence: `performance-evidence.port.ts`; fixture `createPerformanceEvidencePortDouble`
- [x] T026 [P] Unit tests reasons/rules/crew-capacity — Evidence: `eligibility.reasons.test.ts`, `eligibility.rules.test.ts`, `crew-capacity.test.ts`
- [x] T027 [P] Unit tests performance-gate — Evidence: `performance-gate.test.ts`

**Batch D acceptance**: Pure tests cover SC-001–SC-003 including multi-independent FAIL and mixed Teams. *(Pure unit evidence green under `test:r1-p11`.)*

## Batch E — Atomic application evaluation and failure handling

- [x] T028 Implement request validation — Evidence: `validateEvaluateEligibilityRequest` in `eligibility.service.ts`; covered by `retry-clock.test.ts`
- [x] T029 Implement rule-version selection helpers + exact hashes — Evidence: repository `findEffectiveRuleVersion` (Batch B) + `eligibility.hashes.ts`; `determinism.test.ts`
- [x] T030 Implement `evaluateEligibility` orchestration — Evidence: `EligibilityApplicationServiceImpl.evaluateEligibility` (clock-before-retry ≤3, discovery/explicit, evaluationOutcomes, canonical ordering). **Requires composition-wired deps to run end-to-end.**
- [x] T031 Implement hard-error taxonomy + atomic persist path — Evidence: service maps OVERFLOW→EVALUATION_LIMIT_EXCEEDED, CONFLICT retries, `insertEvaluationWithCandidates`; Catalog business FAIL persists with empty Providers
- [x] T032 [P] Integration evaluate tests — Evidence: `tests/integration/eligibility/r1-p11-evaluate.test.ts` live discovery/catalog FAIL/explicit missing persist/501 overflow on `cleanora_r1_p11_proof`
- [x] T033 [P] Determinism tests — Evidence: `determinism.test.ts`
- [x] T034 [P] Bounds overflow tests — Evidence: live 501 IDs → `EVALUATION_LIMIT_EXCEEDED` in `r1-p11-evaluate.test.ts`
- [x] T035 [P] Retry clock stability tests — Evidence: `retry-clock.test.ts` (validation + clock contract note); full retry orchestration still composition-dependent
- [x] T036 [P] Concurrent snapshot tests — Evidence: `tests/integration/eligibility/r1-p11-concurrent-snapshot.test.ts` two parallel evaluates

**Batch E acceptance**: Live SC-004/exclusion/overflow/concurrent proofs passed on disposable `cleanora_r1_p11_proof` (`test:r1-p11` 24/131).

## Batch F — Browse facade and real integration proof

- [x] T037 Implement `getStandardBrowseCandidates` mapping in `src/modules/eligibility/eligibility.service.ts` — Evidence: validates Browse input; discovery evaluate; `mapDiagnosticToBrowseSafeProjection`
- [x] T038 Export facade + evaluate + purge signatures from `src/modules/eligibility/eligibility.public.ts`; wire in `src/composition.ts` — Evidence: public re-exports + `eligibilityApplicationService` on RuntimeDependencies
- [x] T039 [P] Projection privacy tests: `tests/unit/modules/eligibility/browse-projection.test.ts`
- [x] T040 [P] Worker-ID / privacy negative tests: `tests/unit/modules/eligibility/privacy-negatives.test.ts`
- [x] T041 Integration tests invoking **composed** facade against real P09/P10-backed fixtures: `tests/integration/eligibility/r1-p11-browse-facade.test.ts` — Evidence: live composed facade on disposable P11 URL
- [x] T042 Assert setup-readiness `eligibleForPublicBrowse: false` is not treated as exclusion filter; assert facade rejects `providerIds` — Evidence: browse-projection + browse-facade suites
- [x] T043 Document zero-new-HTTP note in API navigation / phase docs (no new OpenAPI operations) — Evidence: `docs/apis/README.md` R1-P11 row + existing `contracts/http-api.md`

**Batch F acceptance**: Unit privacy + live composed Browse facade on disposable P11 URL (SC-005).

## Batch G — Retention, validators, full gates, review

- [x] T044 Implement bounded idempotent `purgeExpiredEvaluations` in `src/modules/eligibility/eligibility.service.ts` (cutoff once via composition clock; no caller `asOf`; order `(expiresAt, id)`; batchSize 1–500 reject invalid; default 100) — Evidence: service callable; `resolvePurgeBatchSize` unit tests. Live retention suite still pending T045
- [x] T045 [P] Retention/purge tests: `tests/integration/eligibility/r1-p11-retention.test.ts` (720-hour boundary; invalid batchSize rejection; no asOf) — Evidence: always-on invalid batchSize / asOf / 720h compute; live suite DB-gated via `requireR1P11ProofDatabaseUrl` + `openR1P11LiveDb`; included in `vitest.r1-p11.config.ts`
- [x] T046 Add `scripts/validate-r1-p11-upgrade.ts` and `npm run db:validate-r1-p11-upgrade` — Evidence: script + package.json script; baseline through R1_P10; asserts three Eligibility tables; `CLEANORA_R1_P11_DATABASE_URL` + `APPROVED_R1_P11_TARGET_PATTERN`
- [x] T047 [P] Unit tests: `tests/unit/scripts/validate-r1-p11-upgrade.test.ts` — Evidence: static URL/migration/table/digest guards without live DB
- [x] T048 Extend/inspect clean migration validation so P11 chronology is included — Evidence: `R1_P11_MIGRATION`, `R1_P11_ELIGIBILITY_TABLES`, `assertR1P11MigrationSql`; expected migration/table counts include P11; P10 upgrade pinned via `MIGRATION_NAMES_THROUGH_R1_P10` / `POST_DEPLOY_TABLES_THROUGH_R1_P10`
- [x] T049 Run and record `test:r1-p11` + `test:coverage:r1-p11` with four metrics in `implementation-evidence.md` (SC-007)
- [x] T050 Run and record disposable clean + upgrade migration evidence (SC-008)
- [x] T051 Run and record repository gates required by DEC-078 with honest inherited-failure reporting
- [x] T052 Final module-boundary / no-HTTP / privacy review notes in `implementation-review-report.md`
- [x] T053 Codex review loop + focused repairs until no unresolved BLOCKER/MAJOR
- [x] T054 Reconcile spec/plan/contracts/tasks with final behavior; write `implementation-summary.md` (completion artifacts only after DEC-062 acceptance)

**Batch G acceptance**: SC-006–SC-010 evidenced; technical readiness Complete under DEC-062/DEC-085. Git publication is a separate owner-requested feature-branch push (no merge/deploy).

## Dependencies

```text
A → B → C → D → E → F → G
```

- D may begin pure-policy types against fixture shapes before C completes, but integration of rules to live readers requires C.
- F depends on E (same evaluator).
- G depends on F for full gate claims.

Parallel `[P]` tasks must not be overlapping workspace writers on the same files.

## Exact FR → task → test mapping

| FR / SC | Implementation tasks | Primary test files |
|---|---|---|
| FR-001 | T007, T038 | `r1-p11-module-boundaries.test.ts` |
| FR-002 | T028, T029, T030 | `r1-p11-evaluate.test.ts` |
| FR-003 | T021, T022, T030 | `eligibility.rules.test.ts`, `r1-p11-evaluate.test.ts` |
| FR-004 | T021, T022 | `eligibility.reasons.test.ts`, `eligibility.rules.test.ts` |
| FR-005 | T022, T024 | `eligibility.rules.test.ts`, `performance-gate.test.ts` |
| FR-006 | T030, T037 | `r1-p11-evaluate.test.ts`, `r1-p11-browse-facade.test.ts` |
| FR-007 | T028 | `r1-p11-evaluate.test.ts` |
| FR-008 | T014, T017 | `r1-p11-eligibility-readers.test.ts` |
| FR-009 | T022, T015 | `eligibility.rules.test.ts` |
| FR-010 | T014–T018, T030 | `r1-p11-concurrent-snapshot.test.ts`, reader tests |
| FR-011 | T029, T030 | `determinism.test.ts` |
| FR-012 | T029, T030 | `determinism.test.ts` |
| FR-013 | T008–T010, T013 | `r1-p11-rule-seed.test.ts` |
| FR-014 | T024, T025, T027 | `performance-gate.test.ts` |
| FR-015 | T011, T031, T012 | `r1-p11-schema-constraints.test.ts`, `r1-p11-evaluate.test.ts` |
| FR-016 | T031, T040 | `privacy-negatives.test.ts` |
| FR-017 | T008, T009, T012 | `r1-p11-schema-constraints.test.ts` |
| FR-018 | T044, T045 | `r1-p11-retention.test.ts` (720h; reject invalid batchSize; no asOf) |
| FR-019 | T006, T043 | `r1-p11-module-boundaries.test.ts` |
| FR-020 | T037, T039, T042 | `browse-projection.test.ts`, `r1-p11-browse-facade.test.ts` |
| FR-021 | T031, T032 | `r1-p11-evaluate.test.ts` |
| FR-022 | T030, T035, T036 | `retry-clock.test.ts`, `r1-p11-concurrent-snapshot.test.ts` (may succeed without retry) |
| FR-023 | T037, T038 | `r1-p11-browse-facade.test.ts` |
| FR-024 | T041 | `r1-p11-browse-facade.test.ts` |
| FR-025 | T014–T020 | `r1-p11-eligibility-readers.test.ts` (budget OVERFLOW; AVAILABLE\|UNAVAILABLE; named Catalog/Config), boundaries |
| FR-026 | T023, T026 | `crew-capacity.test.ts` |
| FR-027 | T030, T037 | `browse-projection.test.ts` |
| FR-028 | T034 | `r1-p11-evaluate.test.ts` |
| FR-029 | T008–T010, T046–T050 | seed/schema/upgrade tests + evidence |
| FR-030 | T028 | `r1-p11-evaluate.test.ts` |
| FR-031 | T042 | `r1-p11-browse-facade.test.ts` |
| FR-032 | T001–T003, T049, T051 | selection + coverage evidence |
| FR-033 | T015, T017 | `r1-p11-eligibility-readers.test.ts` |
| FR-034 | T022, T032 | `eligibility.rules.test.ts`, `r1-p11-evaluate.test.ts` |
| SC-001 | T026, T032 | rules + evaluate |
| SC-002 | T026 | `crew-capacity.test.ts` |
| SC-003 | T027 | `performance-gate.test.ts` |
| SC-004 | T033, T035 | `determinism.test.ts`, `retry-clock.test.ts` |
| SC-005 | T041 | `r1-p11-browse-facade.test.ts` |
| SC-006 | T012, T045 | schema + retention |
| SC-007 | T049 | coverage evidence |
| SC-008 | T050 | migration evidence |
| SC-009 | T006, T020, T040, T043 | boundaries + privacy-negatives |
| SC-010 | T052–T054 | review/summary artifacts |

## Out of scope reminders

No wallets, Docker/cloud, geo persistence, P12 HTTP, Booking, production migrate,
or Git publication from these tasks alone. Documentation repair does not check
off implementation tasks.


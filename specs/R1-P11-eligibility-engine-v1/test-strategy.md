# R1-P11 Test Strategy

Authority: DEC-074, DEC-068, DEC-066, DEC-072, DEC-078, DEC-080–084.

## Selection (DEC-083)

`vitest.r1-p11.config.ts` must resolve an **exact allowlist**:

1. All P11 suites under the paths listed in [plan.md](plan.md) / [tasks.md](tasks.md)
2. Explicitly named existing changed-seam suites only (named in the config and
   asserted by `tests/unit/scripts/r1-p11-test-selection.test.ts`)

Unrelated historical suites are excluded. Approved affected tests are permitted
when named. A unit test asserts both exclusion of historical suites and presence
of the named allowlist entries.

## Requirement → test mapping (exact)

| Requirement / SC | Primary test file(s) | Style |
|---|---|---|
| FR-003–FR-005 / SC-001 | `tests/unit/modules/eligibility/eligibility.rules.test.ts`, `tests/integration/eligibility/r1-p11-evaluate.test.ts` | Unit pure + integration |
| FR-004 / DEC-080 multi-FAIL | `eligibility.rules.test.ts` (Example A), `r1-p11-evaluate.test.ts` | Unit + integration |
| FR-034 / mixed Teams | `eligibility.rules.test.ts` (Example B/C), `r1-p11-evaluate.test.ts` | Unit + integration |
| FR-026 / SC-002 | `tests/unit/modules/eligibility/crew-capacity.test.ts` | Unit + integration |
| FR-014 / SC-003 | `tests/unit/modules/eligibility/performance-gate.test.ts` | Unit with evidence port; MISSING vs insufficient/stale vs incompatible policyVersionId |
| FR-010–FR-012, FR-022 / SC-004 | `tests/unit/modules/eligibility/determinism.test.ts`, `retry-clock.test.ts`, `tests/integration/eligibility/r1-p11-concurrent-snapshot.test.ts` | Exact hash inputs; concurrent may succeed without retry |
| FR-023–FR-024 / SC-005 | `tests/integration/eligibility/r1-p11-browse-facade.test.ts` | Integration (composed) |
| FR-015–FR-018 / SC-006 | `tests/integration/database/r1-p11-schema-constraints.test.ts`, `tests/integration/eligibility/r1-p11-retention.test.ts` | Composite FK; 720h expiry; reject invalid batchSize; no asOf |
| FR-004 Catalog empty discovery / DEC-084 | `r1-p11-evaluate.test.ts` | evaluationOutcomes.catalog FAIL with zero Providers |
| FR-034 TEAM_STRUCTURALLY_INVALID / DEC-084 | `eligibility.rules.test.ts`, `r1-p11-evaluate.test.ts` | Example B Team-scoped reason |
| FR-013 seed drift | `tests/integration/eligibility/r1-p11-rule-seed.test.ts` | Integration |
| FR-016 / SC-009 privacy | `tests/unit/modules/eligibility/privacy-negatives.test.ts` | Unit negatives |
| FR-032 / SC-007 | `npm run test:coverage:r1-p11` | Coverage command |
| FR-029 / SC-008 | clean validator + `db:validate-r1-p11-upgrade` | Disposable DB scripts |
| FR-019 / FR-025 / SC-009 | `tests/unit/modules/r1-p11-module-boundaries.test.ts` | Boundary unit |
| FR-021 | `r1-p11-evaluate.test.ts` | Integration |
| FR-028 | `r1-p11-evaluate.test.ts` | Integration |
| FR-030 | `r1-p11-evaluate.test.ts` | Unit/integration |
| FR-031 / FR-020 `providerIds` | `r1-p11-browse-facade.test.ts`, `browse-projection.test.ts` | Integration + unit |
| FR-033 | `tests/integration/providers/r1-p11-eligibility-readers.test.ts` | Integration |

## Exclusion path matrix (minimum)

1. Catalog inapplicable  
2. Provider not approved / not live / verification unsatisfied  
3. Offering/price unavailable  
4. Interval too short for duration  
5. Coverage mismatch  
6. Schedule closed / paused / suspended  
7. No valid complete Team / members unavailable  
8. Crew preference mismatch (cleaners only)  
9. Insufficient capacity after crew filter (inherits to all Teams)  
10. Performance gate failed (enabled fixture only)

Also: providers outside discovery scope are not falsely listed as excluded
individuals; informational performance codes are not exclusion reasons.

## Determinism / clock tests (DEC-081 / DEC-084)

- Same pinned fixtures → same `requestHash` / `evidenceHash` / `resultHash` and
  ordered IDs/reasons using the exact hash-input definitions in the public
  contract (null-vs-omit; array ordering).
- Replay from stored `EligibilityEvidenceSnapshot` without live dependency queries.
- Change price or team membership between evaluations → result may change.
- Semantic equality helpers exclude **generated IDs, trace IDs, execution
  durations, and persistence timestamps** (`createdAt` / `completedAt` /
  `expiresAt`) — **not** `evaluatedAt`.
- Retry clock: forced transaction conflict across attempts reuses the same
  captured `evaluatedAt` and may reselect the rule bundle against that instant;
  failed-attempt evidence discarded.

## Concurrent / snapshot tests (DEC-084)

- Concurrent mutation of underlying Provider facts during evaluation **may
  succeed** based entirely on one consistent snapshot without requiring a retry.
- Retry only for recognised transaction failures; exhaustion → typed conflict
  error. Never return a mixed-snapshot / partial success list.
- Bound readers never open nested transactions (asserted via factory/test doubles
  or instrumentation).

## Retention / purge tests (DEC-084)

- `expiresAt = completedAt + 720 elapsed hours` boundary.
- Invalid `batchSize` (0, negative, >500, non-integer) → `VALIDATION_FAILED`.
- Omitted `batchSize` ⇒ 100. Production options have no `asOf`.

## Seed drift tests

- Identical re-seed → no-op after verifying all immutable fields.
- Mutate any immutable field (effectiveFrom, versionLabel, parameters, country,
  checksum content) → seed fails without overwrite.

## Privacy negative tests

Assert Worker IDs and raw member arrays never appear in:

- Persisted `evidenceSafe` / candidate JSON fixtures
- Diagnostic success payloads intended for safe storage assertions
- Browse projection objects
- Routine log payload helpers used by Eligibility

## Crew / escort cases (mandatory)

| Setup | Expected |
|---|---|
| all_female cleaners + male escort (`cleans=false`) | Crew PASS if cleaners match; escort gender ignored for preference |
| Escort with invalid workforce fact | Owned by Providers validity — Eligibility consumes invalid Team as `TEAM_STRUCTURALLY_INVALID` |
| Team without Escort when escortRequired=false | Valid; Escort checks vacuously satisfied; not excluded for lacking Escort |
| Optional Escort present but unavailable for whole interval | Complete Team unavailable (`TEAM_MEMBERS_UNAVAILABLE` / availability fail); escortAvailable=false |
| Missing capacity rule + coverage mismatch + active pause + readable valid Team | `CAPACITY_RULE_MISSING` + coverage + pause exclusions; Team facts preserved; **not** `NO_VALID_COMPLETE_TEAM` |
| any preference | Gender ignored for preference rule |
| 3 crew-matching Teams, limit 2, need 2 | Capacity PASS with alternatives listed |
| 3 Teams but only 1 matches crew, need 2 | `INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER`; all Teams ineligible |

## Coverage thresholds

Phase (new executable + changed public/composition seams):

- Statements ≥ 80%
- Branches ≥ 75%
- Functions ≥ 80%
- Lines ≥ 80%

Repository `test:coverage` must meet configured repo thresholds (DEC-078).
Coverage scripts may exist before substantial executable coverage; do not claim
a coverage pass early (DEC-083).

## Gate matrix

| Gate | When |
|---|---|
| `test:r1-p11` | Each implementation batch affecting behavior |
| `test:coverage:r1-p11` | Before claiming SC-007 |
| Repository unit/integration/coverage | Before completion |
| typecheck/lint/build/prisma/openapi/postman/docs/diff | Before completion |
| clean + `db:validate-r1-p11-upgrade` | Before SC-008 |
| Module boundary + no-HTTP + privacy negatives | Before SC-009 |

Inherited failures: report with baseline evidence; do not silently narrow the command.


## Findings

### BLOCKER — DEC-078 repository completion gates are not satisfied

The phase requires both the P11-specific gates and the repository regression gates. DEC-078 says automatic progression occurs only after the actual gates pass, and it explicitly says the P10 phase-only exemption does not carry forward. The same requirement appears in the P11 test strategy. [decision-log.md](/D:/new_repos/Cleanora_R1/docs/product/decision-log.md:2683) [spec.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/spec.md:27) [test-strategy.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/test-strategy.md:124) [test-strategy.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/test-strategy.md:134)

The recorded closeout evidence says:

- `npm run lint` exited 1. [implementation-evidence.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/implementation-evidence.md:348)
- `npm run test:unit` exited 1 with 15 failing files and 21 failing tests; the remaining failures were classified as inherited P08–P10 failures. [implementation-evidence.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/implementation-evidence.md:349)
- `npm run test:integration` was not run. [implementation-evidence.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/implementation-evidence.md:350)
- Repository `npm run test:coverage` was not run. [implementation-evidence.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/implementation-evidence.md:351)

Reporting inherited failures honestly satisfies the reporting requirement; it does not turn the required gates into passes. DEC-085 nevertheless records P11 as complete. [decision-log.md](/D:/new_repos/Cleanora_R1/docs/product/decision-log.md:2772)

This leaves FR-032 and SC-010 unsatisfied. The P11 phase tests and coverage figures cannot replace the repository gates under DEC-078.

**Required repair:**

1. Keep the inherited-change attribution intact, but repair or reconcile the current-tree failures until `npm run lint` and `npm run test:unit` both exit 0.
2. Run `npm run test:integration` against an approved disposable database target and obtain exit 0.
3. Run repository `npm run test:coverage` and meet its configured thresholds.
4. After the source repairs below, rerun and record all DEC-078 gates rather than relying on the earlier results.
5. Append a corrective decision after DEC-085 and reconcile `checkpoint.md`, `implementation-review-report.md`, `implementation-evidence.md`, and completion artifacts. Preserve DEC-085 as history; do not rewrite it.

### MAJOR — Production composition treats verification as satisfied without reading verification truth

The lifecycle reader makes the verification dependency optional and documents that omission as “treated as not-required.” It then returns `true` whenever the dependency is absent. [eligibility-lifecycle.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-lifecycle.reader.ts:33) [eligibility-lifecycle.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-lifecycle.reader.ts:81)

Production composition creates the lifecycle reader without supplying that dependency. [composition.ts](/D:/new_repos/Cleanora_R1/src/composition.ts:1411)

Consequently, the composed engine cannot produce `VERIFICATION_NOT_SATISFIED` for a present Provider. This is materially wrong for Registered Companies: the existing Providers-owned verification policy only treats `INDIVIDUAL_TEAM` verification as not required, while Registered Companies depend on effective policy and approved document facts. [provider-verification.policy.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/domain/provider-verification.policy.ts:17) [provider-verification.policy.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/domain/provider-verification.policy.ts:24)

The unit test only proves that a manually injected callback works; it does not prove that production composition supplies one. [eligibility-readers.unit.test.ts](/D:/new_repos/Cleanora_R1/tests/unit/modules/eligibility/eligibility-readers.unit.test.ts:148)

This violates FR-003, FR-025, FR-034, DEC-063, DEC-073/079/084, and the Provider eligibility predicate.

**Required repair:**

1. Replace the optional fail-open verification callback with a mandatory Providers-owned, transaction-bound verification projection.
2. Compute the narrow `verificationSatisfiedOrNotRequired` fact from Provider kind, effective verification policy, and effective approved document types using the evaluation’s consistent transaction snapshot and captured evaluation time.
3. Keep policy rows, document data, and document identities inside Providers; expose only the boolean and a safe aggregate/source version.
4. Wire the mandatory projection in `src/composition.ts`. Missing wiring or a verification-reader failure must abort with a typed technical error rather than return `true`.
5. Add composed tests proving:
   - an Individual Team receives “not required” satisfaction;
   - a Registered Company with all required approvals satisfies verification;
   - a Registered Company with missing or unapproved required documents is excluded with `VERIFICATION_NOT_SATISFIED`;
   - a verification dependency failure aborts the evaluation.

### MAJOR — The 5,000-Team bound is enforced after all Team and Worker facts have been hydrated

The frozen reader contract requires the owning reader to query no more than `remainingTeamBudget + 1` Team identifiers and detect overflow before hydrating accepted Team facts. [dependency-readers.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:261)

The public availability reader accepts `remainingTeamBudget`, but passes only `providerId` to the repository. [eligibility-availability.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-availability.reader.ts:230) [eligibility-availability.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-availability.reader.ts:252)

The repository then loads every Team and deeply includes all current memberships, Workers, profiles, schedules, and exceptions. [prisma-provider-availability.repository.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/infrastructure/prisma-provider-availability.repository.ts:1044) [prisma-provider-availability.repository.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/infrastructure/prisma-provider-availability.repository.ts:1083)

Only after that unbounded hydration does the reader compare the Team count with the remaining budget and slice it. [eligibility-availability.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-availability.reader.ts:322)

The returned `OVERFLOW` result is functionally correct, but the bounded-work guarantee that protects the engine from excessive memory and database work is absent. This violates FR-025, FR-028, DEC-075, and DEC-084.

**Required repair:**

1. Pass the remaining Team budget into a Providers-owned bounded repository operation.
2. Query at most `remainingTeamBudget + 1` canonical Team IDs first.
3. Return `OVERFLOW` immediately when the sentinel row exists.
4. Hydrate membership, Worker, calendar, and exception facts only for the accepted IDs when the sentinel does not exist.
5. Add repository/reader tests that inspect the requested query bound and prove zero-budget, exact-budget, budget-plus-one, and cumulative multi-Provider overflow behavior. A test that supplies a pre-hydrated oversized array is insufficient.

### MAJOR — Runtime rule-version validation does not validate the frozen bundle or its checksum

The frozen selection contract requires parameter-schema validation and rejection of unknown rule IDs. The rule bundle also defines the exact schema version, engine compatibility, ordered rule IDs, request bounds, crew preferences, performance parameters, and canonical checksum. [rule-version-contract.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/rule-version-contract.md:16) [rule-version-contract.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/rule-version-contract.md:54) [rule-version-contract.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/rule-version-contract.md:81)

`parseRuleParameters` validates only the performance-gate object and the two 500/5,000 limits. It does not validate:

- `schemaVersion`;
- the selected row’s engine compatibility after selection;
- `ruleOrder`, including unknown, duplicate, missing, or reordered rules;
- `maxIntervalHours`;
- minimum and maximum required Team units;
- allowed crew preferences;
- the full closed parameter shape;
- the canonical `contentChecksum`.

[eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:202) [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:380)

The orchestration fixture even supplies the valid bundle with the literal checksum `"checksum"`, which confirms that evaluation does not authenticate the bundle content it reports in metadata. [evaluate-orchestration.test.ts](/D:/new_repos/Cleanora_R1/tests/unit/modules/eligibility/evaluate-orchestration.test.ts:43)

A malformed or mutated database row can therefore drive evaluation while being presented as an immutable, checksum-pinned rule version. This violates FR-002, FR-011, FR-013, the rule-version contract, and SC-010.

**Required repair:**

1. Validate the selected bundle before Catalog or candidate reads.
2. Require the exact supported `schemaVersion` and engine compatibility.
3. Validate an exact closed `ruleOrder`: all nine supported rule IDs once, in the frozen order, with no unknown IDs.
4. Validate the full parameter schema and all fixed V1 bounds and crew-preference values.
5. Recompute the canonical SHA-256 checksum from `schemaVersion`, `engineCompatibility`, `ruleOrder`, and `parameters`; compare it with `contentChecksum`.
6. Return `RULE_VERSION_INVALID` on any mismatch.
7. Replace fake checksum fixtures with the canonical checksum and add tests for schema mismatch, unknown/reordered rule IDs, malformed currently ignored parameters, and checksum drift.

### MAJOR — `resultHash` uses fields the frozen contract expressly excludes, and source-version metadata is discarded

The result-hash contract excludes `requestHash`, `evidenceHash`, and `resultHash`. It defines a precise semantic payload containing outcomes, candidates, and selected metadata. [eligibility-public-contract.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/eligibility-public-contract.md:414)

`metadataBase` contains both `requestHash` and `evidenceHash`. The service passes that object into `computeResultHash` by casting it to `EvaluationMetadata`. [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:597) [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:637)

`computeResultHash` hashes whatever `Omit<DiagnosticResult, "evaluationId">` object it receives; it does not construct or enforce the frozen projection. [eligibility.hashes.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.hashes.ts:100)

The implementation also hard-codes `sourceVersions: {}` in both the evidence snapshot and returned metadata, even though the dependency DTOs already expose lifecycle `aggregateVersion` and pricing `sourceVersion`, and the contract requires safe source-version identifiers. [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:556) [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:597) [dependency-readers.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:309)

This violates FR-011, FR-012, DEC-081/084, and SC-004. The current determinism tests prove consistency of the implementation’s current object shape; they do not prove conformance to the frozen hash input.

**Required repair:**

1. Introduce an explicit, strongly typed `EligibilityResultHashInput` matching the contract’s exact allowed fields.
2. Construct that projection explicitly before hashing. Remove the `as EvaluationMetadata` cast.
3. Ensure `requestHash`, `evidenceHash`, `resultHash`, `evaluationId`, trace data, execution durations, and persistence timestamps cannot appear in that type or runtime object.
4. Populate `sourceVersions` deterministically from the safe versions supplied by the owning readers. Add safe version fields to Configuration/availability projections where the frozen dependency contract requires them.
5. Canonically sort the source-version keys before hashing.
6. Add golden-vector tests proving:
   - changes to `requestHash`, `evidenceHash`, generated evaluation IDs, trace data, or persistence timestamps do not alter `resultHash`;
   - changes to a permitted semantic result or metadata field do alter it;
   - the exact hashed JSON object matches the frozen contract;
   - source versions are present, stable, and ordered.

### MAJOR — Excluded Teams can have no exclusion reason, and suspension is incorrectly reported as a pause

The reason algebra requires every rejected Team row to contain at least one real exclusion reason and states that a Team is eligible only when both the Team and its Provider qualify. Provider-level failures must therefore be inherited by Team alternatives. [reason-codes.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/reason-codes.md:64)

The final Team mapping only inherits:

- capacity failure;
- performance failure;
- lifecycle failure.

[eligibility.rules.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.rules.ts:609)

It does not inherit offering/price, coverage, schedule/pause, `CAPACITY_RULE_MISSING`, or other applicable Provider-grain exclusions. For example, an individually qualifying Team under an otherwise valid Provider whose only failure is `COVERAGE_MISMATCH` is returned in `excludedTeams` with `reasons: []`.

The availability reader also computes `runtimeBlocked` for either suspension or pause and returns `paused: paused || runtimeBlocked`. A suspended Provider with no pause therefore reports both a suspension and a fabricated pause. [eligibility-availability.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-availability.reader.ts:294) [eligibility-availability.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-availability.reader.ts:375)

The existing suspension test asserts `suspended: true` but does not assert `paused: false`, so it does not detect the fabricated fact. [eligibility-availability.reader.test.ts](/D:/new_repos/Cleanora_R1/tests/unit/modules/eligibility/eligibility-availability.reader.test.ts:503)

This violates FR-003, FR-004, FR-025, DEC-080/084, SC-001, and SC-010.

**Required repair:**

1. When a Provider is ineligible, inherit all of that Provider’s real exclusion reasons into each ineligible Team result, then combine them with Team-local reasons and deduplicate in canonical presentation order.
2. Continue excluding informational performance diagnostics from candidate exclusion reasons.
3. Enforce the invariant that every `eligible: false` Provider and Team row has at least one real reason before persistence.
4. Return `paused` strictly from an effective overlapping pause. Keep `suspended` independent. Use the combined runtime-blocked value only for availability/capacity computation.
5. Add tests for individually valid Teams excluded solely by pricing, coverage, schedule, pause, verification, capacity configuration, and performance failures.
6. Add suspension tests proving:
   - suspended with no pause emits `PROVIDER_SUSPENDED` without `PROVIDER_PAUSED`;
   - an actual pause without suspension emits only `PROVIDER_PAUSED`;
   - both real facts emit both reasons.

### MAJOR — Retryable conflicts are lost or misclassified, and dependency failures can escape the public typed-error contract

The Providers pricing reader converts a recognized serialization failure into a plain `Error` with a structural `code: "CONFLICT"`. [eligibility-pricing.reader.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/eligibility-pricing.reader.ts:55)

Eligibility’s retry classifier accepts only instances of its concrete runtime `EligibilityError` class. It therefore does not retry the structural pricing conflict and instead leaks the foreign error from the public API. [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:94) [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:264)

The Eligibility unit of work maps only Prisma `P2028`. The repository already recognizes the broader relevant set—`P2034`, `P2028`, SQLSTATE `40001`, and SQLSTATE `40P01`—for serialization/deadlock failures. [eligibility.unit-of-work.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/infrastructure/eligibility.unit-of-work.ts:29) [provider-service-prisma-errors.ts](/D:/new_repos/Cleanora_R1/src/modules/providers/infrastructure/provider-service-prisma-errors.ts:8)

In addition, `insertEvaluationWithCandidates` catches every error and converts it to `PERSISTENCE_FAILED`. A serialization conflict during insertion is consequently made non-retryable before the outer retry loop sees it. [eligibility.service.ts](/D:/new_repos/Cleanora_R1/src/modules/eligibility/eligibility.service.ts:711)

This violates FR-021, FR-022, DEC-071/081/084, and SC-010.

**Required repair:**

1. Add one Eligibility-owned technical-error normalization/classification boundary.
2. Recognize the Providers pricing `CONFLICT` shape and supported transaction conflict codes without requiring the foreign error to be an instance of Eligibility’s runtime class.
3. Map `P2028`, `P2034`, `40001`, and `40P01` to retryable `CONFLICT`.
4. Preserve retryable insert/commit conflicts through persistence handling so the outer loop can retry them; map only non-retryable persistence failures to `PERSISTENCE_FAILED`.
5. Map other reader/database outages to `DEPENDENCY_FAILURE`, and malformed dependency DTOs to `INVALID_DEPENDENCY_DTO`, before errors leave the public API.
6. Add actual orchestration tests proving:
   - success on the second and third attempts;
   - exactly three total attempts followed by `TRANSACTION_CONFLICT_EXHAUSTED`;
   - the same captured `evaluatedAt` on every attempt;
   - a fresh transaction/read set per attempt;
   - retry of the pricing-reader conflict;
   - retry of insert and commit serialization conflicts;
   - immediate typed failure for a non-retryable dependency outage.

## FR and success-criterion disposition

| Disposition | Requirements |
|---|---|
| Not satisfied | FR-002, FR-003, FR-004, FR-011, FR-012, FR-013, FR-021, FR-022, FR-025, FR-028, FR-032, FR-034 |
| No unresolved BLOCKER/MAJOR found in the inspected implementation | FR-001, FR-005–FR-010, FR-014–FR-020, FR-023, FR-024, FR-026, FR-027, FR-029–FR-031, FR-033 |
| Not satisfied | SC-001, SC-004, SC-010 |
| Recorded evidence is consistent and no contradictory BLOCKER/MAJOR was found | SC-002, SC-003, SC-005–SC-009 |

The recorded P11-specific evidence consistently reports 24 files and 131 tests passing, phase coverage of 91.84% statements, 86.98% branches, 93.57% functions, and 91.75% lines, plus successful clean and populated-upgrade migration validators. [implementation-evidence.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/implementation-evidence.md:309) [migration-evidence.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/migration-evidence.md:17)

This review independently reran `npm run typecheck` and `git diff --check`; both exited 0. The database-writing and coverage runs were inspected through their repository evidence and scripts, rather than re-executed during this read-only review.

The inspected migration is additive and contains the required three tables, composite rule/country foreign key, restrictive rule deletion, candidate XOR check, partial uniqueness indexes, evaluation cascade, and no live Provider/Team foreign keys. [migration.sql](/D:/new_repos/Cleanora_R1/prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql:14) [migration.sql](/D:/new_repos/Cleanora_R1/prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql:71) [migration.sql](/D:/new_repos/Cleanora_R1/prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql:77) [migration.sql](/D:/new_repos/Cleanora_R1/prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql:99)

No separate BLOCKER or MAJOR was found in the static module direction, zero-HTTP boundary, Browse input privacy, Worker-ID exclusion at the Eligibility boundary, or migration SQL. The boundary test checks both foreign-private imports and absence of Eligibility route files, and composition exposes the service only as an in-process dependency. [r1-p11-module-boundaries.test.ts](/D:/new_repos/Cleanora_R1/tests/unit/modules/r1-p11-module-boundaries.test.ts:95) [r1-p11-module-boundaries.test.ts](/D:/new_repos/Cleanora_R1/tests/unit/modules/r1-p11-module-boundaries.test.ts:113) [composition.ts](/D:/new_repos/Cleanora_R1/src/composition.ts:356)

VERDICT: FAIL
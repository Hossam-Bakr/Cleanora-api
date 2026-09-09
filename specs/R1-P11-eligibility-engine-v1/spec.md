# Feature Specification: R1-P11 — Eligibility Engine V1

**Feature Branch**: `codex/r1-p11-eligibility-engine-v1`  
**Created**: 2026-09-09  
**Status**: Prepared / Active — DEC-084 contract/persistence repair after PM-03 CHANGES_REQUIRED; awaiting Codex PM-04 re-review  
**Input**: Owner activation under DEC-062; Codex PM decisions DEC-063–DEC-084 under delegated authority. Documentation repair only in this batch; Batch A withheld until re-review acceptance.

## Clarifications

### Session 2026-09-09 (Codex under DEC-062)

- Q: Who owns eligibility orchestration and persistence? → A: One `eligibility` module; public entry `eligibility.public.ts`; other modules accessed only via public contracts (DEC-063).
- Q: Evaluation order and reason completeness? → A: Fixed nine-step **presentation** order; factual prerequisites; collect independent failures; expected absence → dependents `NOT_EVALUATED`; reader outage → whole-evaluation failure; Catalog outcome on `evaluationOutcomes` even with zero Providers (DEC-064, DEC-080, DEC-084).
- Q: Time and duration inputs? → A: Explicit UTC `[startsAt, endsAt)`; Configuration country IANA zone; interval must cover offering duration; bounds ≤24h, units 1–50; capture `evaluatedAt` once before retry loop (DEC-065, DEC-081).
- Q: Consistency / determinism? → A: One Eligibility-owned `RepeatableRead` transaction; typed `EligibilityEvidenceSnapshot`; exact `requestHash`/`evidenceHash`/`resultHash` inputs; semantic equality excludes generated IDs, trace IDs, durations, and **persistence** timestamps only — `evaluatedAt` remains semantic (DEC-066, DEC-081, DEC-084).
- Q: Rule versions? → A: Immutable country-scoped bundles; unique `(id, countryId)`; seed `r1-v1` / EG / `2026-09-09T00:00:00.000Z`; verify all immutable fields (DEC-067, DEC-082, DEC-084).
- Q: Performance gate / cold start? → A: Gate shipped **disabled** → `NOT_APPLICABLE` (port not called); port returns evidence|`MISSING` only; Eligibility owns sample/freshness/threshold; enabled missing/stale/insufficient → informational `NOT_EVALUATED`, not FAIL (DEC-068, DEC-080, DEC-084).
- Q: Persistence and retention? → A: Atomic evaluation + required Provider summaries; XOR `rowKind`/`teamId`; composite FK `(ruleVersionId, countryId)`; no live FK for provider/team IDs; **720 elapsed hours** purge; reject invalid purge `batchSize`; no caller `asOf` (DEC-069, DEC-082, DEC-084).
- Q: HTTP surface? → A: **Zero** new eligibility HTTP; in-process contracts only (DEC-070, DEC-072).
- Q: Exclusions vs technical failures? → A: Business exclusions continue; hard failures abort whole evaluation; ≤3 transaction retries (DEC-071).
- Q: Browse integration DoD? → A: P11 proves Browse-use facade contract; `providerIds` forbidden on facade; P12 mounts HTTP (DEC-072, DEC-079).
- Q: Contract reuse? → A: Named Catalog/Config methods; opaque tx-bound factories; discriminated pricing `AVAILABLE`|`UNAVAILABLE`; Team budget+`OVERFLOW`; lifecycle/missing-config variants; escort not universally required; no Worker IDs (DEC-073, DEC-079, DEC-084).
- Q: Crew / capacity / verdicts? → A: Crew on cleaners; Provider eligible iff gates + capacity + ≥1 qualifying Team; Team eligible iff Team qualifies AND Provider qualifies; Team-scoped `TEAM_STRUCTURALLY_INVALID` (DEC-074, DEC-080, DEC-084).
- Q: Bounds / sorting inputs? → A: 500 Providers / 5,000 Team results; overflow hard error (DEC-075).
- Q: Migration? → A: `r1_p11_eligibility_engine_v1` additive; clean + populated-P10 proofs (DEC-076).
- Q: Geo? → A: Textual only; reject coordinates/radius explicitly (DEC-077).
- Q: Validation gates? → A: Phase coverage thresholds **and** repository regression gates; P10 phase-only waiver does not carry forward (DEC-078).
- Q: Batch A scaffolding? → A: T007 only substantive declarations in `eligibility.public.ts` (`EligibilityError` interface, not class); no empty folders/barrels/stubs; T006 must pass before Batch A acceptance (DEC-083, DEC-084).
- Q: Final contract/persistence clarifications? → A: DEC-084 Repairs A–D in `preparation-rereview-report.md` (dependency contracts, evaluationOutcomes/reasons, evidence/hashes/performance, composite FK/720h purge).

## Definition of Done (explicit)

**P11 supplies and proves the Browse-use application contract** (`getStandardBrowseCandidates` + same evaluator + safe projection + real P09/P10-backed integration tests).  
**P12 mounts the marketplace HTTP consumer.** P11 does not implement Browse HTTP, ranking product, pagination product, or Bookings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Evaluate eligibility for a request (Priority: P1)

An approved internal consumer supplies a canonical browse-shaped request; Eligibility returns eligible Provider/Team candidates with deterministic metadata.

**Why this priority**: Shared domain for Browse and future Recommended.  
**Independent Test**: Compose evaluator against seeded Catalog/Providers/Configuration facts; assert PASS candidates and metadata hashes without HTTP.  
**Acceptance Scenarios**:

1. Given a valid UTC interval, textual locality, service, crew preference `any`, and required units within bounds, when evaluation runs inside one `RepeatableRead` transaction with `evaluatedAt` captured before retries, then eligible complete Teams appear with sorting inputs and pinned rule-version metadata.
2. Given no active compatible rule version for the country at the captured evaluation time, when evaluation is invoked, then the whole operation fails with a stable typed error (no partial candidate list).
3. Given discovery that would exceed 500 Providers or 5,000 Team results, when evaluation proceeds, then `EVALUATION_LIMIT_EXCEEDED` is returned without silent truncation.

### User Story 2 — Exclude candidates with machine-readable reasons (Priority: P1)

Ineligible Providers/Teams are excluded with complete applicable reasons; dependents that cannot run are `NOT_EVALUATED`.

**Why this priority**: Diagnosis and testing without inventing failures.  
**Independent Test**: Force each rule failure independently; assert ordered, deduplicated reason codes, independent multi-FAIL, and verdict algebra.  
**Acceptance Scenarios**:

1. Given a Provider failing coverage and schedule independently (facts readable), when evaluated, then both FAIL reasons appear in rule order; non-live Providers still receive independent price/coverage/schedule outcomes when facts are readable.
2. Given a disabled performance gate, when no performance evidence exists, then the rule is `NOT_APPLICABLE`, the evidence port is not called, and the candidate is not excluded for performance.
3. Given an enabled performance gate in tests with fresh below-threshold evidence, when evaluated, then `PERFORMANCE_GATE_FAILED` excludes the Provider and all its Team alternatives.
4. Given one invalid Team and one qualifying Team under an otherwise eligible Provider, when evaluated, then the Provider remains eligible and only the invalid Team is excluded.

### User Story 3 — Browse facade without filter duplication (Priority: P1)

Composition wires `getStandardBrowseCandidates`, which calls the same evaluator and maps success to a safe projection.

**Why this priority**: Honest P11↔P12 handoff.  
**Independent Test**: Integration tests invoke the facade against real P09/P10-backed facts; mocks alone do not pass.  
**Acceptance Scenarios**:

1. Given eligible facts, when the facade is called, then the projection contains only allowlisted eligible identities and commercial/availability facts.
2. Given rejected candidates, when the facade returns, then rejected diagnostics and member-level evidence / Worker IDs are omitted from the projection.
3. Given Providers setup readiness still exposing `eligibleForPublicBrowse: false`, when P11 evaluates, then that placeholder is neither treated as an exclusion filter nor as proof of eligibility.
4. Given a caller supplies `providerIds` to the Browse facade, when invoked, then validation fails; explicit mode remains on `evaluateEligibility` only.

### User Story 4 — Persist evaluations and retain for 720 hours (Priority: P2)

Successful application evaluations (including empty candidate sets) persist atomically; expired rows are purgeable.

**Why this priority**: Auditable decisions without unbounded PII retention.  
**Independent Test**: Persist then purge disposable fixtures; assert immutability, XOR constraints, composite FK country agreement, and FK cascading for children.  
**Acceptance Scenarios**:

1. Given a successful evaluation with zero eligible Teams (including Catalog FAIL on a well-formed unavailable service), when completed, then evaluation + `evaluationOutcomes` + required Provider-summary rows persist atomically (`expiresAt = completedAt + 720 elapsed hours`).
2. Given retention past 720 elapsed hours from completion, when the Eligibility purge runs with fixed cutoff (composition clock; no caller `asOf`) and valid batch size 1–500, then expired evaluations and their candidate results are removed; rule versions remain. Invalid `batchSize` is rejected.
3. Given a persistence failure mid-write, when the operation ends, then the caller receives a hard failure and no success payload is returned.
4. Given an explicit nonexistent Provider ID, when evaluated, then a Provider-summary row is still stored (historical logical reference; no live Provider FK).

## Edge Cases

- Interval too short for offering duration → `REQUESTED_INTERVAL_TOO_SHORT`.
- Zero-length, inverted, >24h, or non-UTC ambiguous local timestamps → global validation failure.
- Geographic coordinates/radius supplied → explicit rejection (DEC-077).
- Crew `all_female` with male Escort (`cleans=false`) and all-female cleaners → Team may still PASS crew rule.
- Escort counted toward capacity → must not; capacity units come only from complete crew-matching Teams.
- Missing optional performance evidence with gate disabled → `NOT_APPLICABLE`, not FAIL.
- Stale performance evidence with gate enabled → informational `NOT_EVALUATED`, not FAIL / not exclusion.
- Malformed performance evidence or reader outage → technical hard failure, not “missing data.”
- Providers outside textual discovery scope → not claimed evaluated or excluded.
- P09 `CONFLICT` from pricing → technical failure, never mapped to `UNAVAILABLE`.
- Transaction serialization conflicts → retry whole transaction ≤3 total attempts; reuse same `evaluatedAt`.
- Concurrent source mutation may succeed on one consistent snapshot without retry; retry only recognised transaction failures; never return mixed-snapshot results (DEC-084).
- Overflow beyond 500/5000 → hard error, no silent slice.
- Locale never invented for eligibility pricing projection (DEC-079).
- Well-formed unknown/inactive/unavailable service → Catalog business FAIL on `evaluationOutcomes`, not hard error (DEC-084).
- Structurally invalid Team under otherwise eligible Provider → `TEAM_STRUCTURALLY_INVALID` (DEC-084).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Introduce `eligibility` module owning orchestration, policies, reason vocabulary, and tables `eligibility_rule_versions`, `eligibility_evaluations`, `eligibility_candidate_results`; public surface via `src/modules/eligibility/eligibility.public.ts` (DEC-063, DEC-083).
- **FR-002**: Validate request shape, trusted invocation, and active rule version before candidate rules (DEC-064, DEC-065).
- **FR-003**: Evaluate candidates in fixed presentation order: Catalog applicability → Provider approval/verification/live → offering/price usability → textual coverage → schedule/suspension/pause → complete-Team validity/availability → crew preference → capacity after crew filter → performance gate (DEC-064).
- **FR-004**: Collect all independently evaluable FAIL reasons in rule order with deduplication; expected absence → dependents `NOT_EVALUATED` with dependency reference; reader outage/invalid DTO → whole-evaluation failure; persist `evaluationOutcomes.catalog` even with zero Providers (DEC-064, DEC-080, DEC-084).
- **FR-005**: Rule outcomes are exactly `PASS` | `FAIL` | `NOT_APPLICABLE` | `NOT_EVALUATED`; closed `EligibilityRuleId` union (DEC-064, DEC-084).
- **FR-006**: Normal discovery reuses P10 textual-area candidate lookup; record discovery scope in metadata; separate explicit Provider-ID entry on `evaluateEligibility` only (DEC-064, DEC-079).
- **FR-007**: Require UTC `[startsAt, endsAt)`, active country/city, optional district, exact service identity, crew preference (`all_male`|`all_female`|`any`), required complete-Team units 1–50; duration positive and ≤24 elapsed hours (DEC-065).
- **FR-008**: Reuse Configuration country IANA zone and DEC-053/054 calendar semantics via Providers public availability; do not invent new calendar arithmetic (DEC-065).
- **FR-009**: Exclude candidates whose offering estimated duration exceeds the requested interval with `REQUESTED_INTERVAL_TOO_SHORT` (DEC-065).
- **FR-010**: Bind discovery, rule selection, DB-backed readers, and successful persistence in one Eligibility-owned bounded `RepeatableRead` transaction via opaque tx-bound factories; bound readers must not open nested txs (DEC-066, DEC-073, DEC-079).
- **FR-011**: Emit deterministic metadata: contract/engine version, rule-version id/checksum, exact `requestHash`/`evidenceHash`/`resultHash` inputs, source versions, zone, calendar runtime version, discovery scope/counts, completeness (DEC-066, DEC-081, DEC-084).
- **FR-012**: Canonical sort of Provider IDs, Team IDs, and reason arrays; decimal money strings only; SHA-256 over UTF-8 canonical JSON with null-vs-omit and array ordering defined (DEC-066, DEC-075, DEC-081, DEC-084).
- **FR-013**: Store immutable country-scoped rule versions with unique `(id, countryId)`; evaluations composite FK `(ruleVersionId, countryId)`; select latest compatible version effective at captured `evaluatedAt`; seed `r1-v1` for EG effective `2026-09-09T00:00:00.000Z` verifying all immutable fields (DEC-067, DEC-082, DEC-084).
- **FR-014**: Ship performance gate **disabled** in the V1 seed (`NOT_APPLICABLE`, port not called); port returns evidence|`MISSING` only; Eligibility checks samples/freshness/threshold; `policyVersionId` must match; missing/insufficient/stale evidence does not exclude (DEC-068, DEC-080, DEC-084).
- **FR-015**: Persist every successful completed application evaluation atomically with exactly one Provider summary per evaluated Provider (including excluded/nonexistent explicit) and Team rows only for actual evaluated Teams; pure policy unit tests need not persist (DEC-069, DEC-082).
- **FR-016**: Persist only allowlisted non-contact inputs, typed `EligibilityEvidenceSnapshot`, outcomes/reasons, sorting facts; never raw addresses, customer identity, Worker IDs/identities, contacts, verification documents, or payout identifiers (DEC-069, DEC-070, DEC-079, DEC-084).
- **FR-017**: Enforce `rowKind`/`teamId` XOR and both partial uniqueness constraints (DEC-069, DEC-082).
- **FR-018**: Retain evaluations/results **720 elapsed hours** from `completedAt` (`expiresAt = completedAt + interval '720 hours'`); Eligibility-owned bounded idempotent purge (cutoff once via composition clock, no caller `asOf`, order `(expiresAt, id)`, `batchSize` integer 1–500 only default 100, reject invalid); rule versions are not purged by expiry (DEC-069, DEC-082, DEC-084).
- **FR-019**: Expose in-process public contracts only; **zero** new eligibility HTTP endpoints in P11 (DEC-070, DEC-072).
- **FR-020**: Separate internal diagnostic results from safe Browse-consumer projection; `providerIds` forbidden on Browse facade (DEC-070, DEC-079).
- **FR-021**: Map expected business exclusions to per-candidate continue; map malformed input, missing rule version, dependency/DB/DTO failure, exhausted retries, and persistence failure to whole-evaluation typed errors (DEC-071).
- **FR-022**: Capture `evaluatedAt` once before the retry loop; retry the whole evaluation transaction at most three total attempts for recognised retryable failures only; concurrent mutation may succeed on one consistent snapshot without retry; discard failed-attempt evidence (DEC-071, DEC-081, DEC-084).
- **FR-023**: Implement composition-wired `getStandardBrowseCandidates` that calls the same evaluator and maps to the safe projection without independent filters (DEC-072).
- **FR-024**: Integration tests must invoke the composed facade against real P09/P10-backed facts (DEC-072).
- **FR-025**: Extend owning-module public readers per DEC-073/079/084 (named Catalog/Config methods; discriminated pricing; Team budget+OVERFLOW; missing-config variants); Eligibility must not import private services/repositories/Prisma of other modules.
- **FR-026**: Apply crew preference to cleaner aggregates; escorts add no capacity; escort fields do not require every Team to contain an Escort; recompute capacity after crew filtering, capped by simultaneous-Team limit; apply Provider/Team eligibility algebra including `TEAM_STRUCTURALLY_INVALID` (DEC-074, DEC-080, DEC-084).
- **FR-027**: Return sorting inputs (price, minimum charge, currency, price-unit identity, estimated duration, matching capacity, optional valid performance facts, stable IDs) without deciding marketplace ranking (DEC-075).
- **FR-028**: Enforce bounds 500 discovered/explicit Providers and 5,000 Team results; overflow → `EVALUATION_LIMIT_EXCEEDED` (DEC-075).
- **FR-029**: Deliver additive migration `prisma/migrations/r1_p11_eligibility_engine_v1/` with deterministic seed; prove clean chronology and populated-P10 upgrade (DEC-076).
- **FR-030**: Reject unsupported geographic input explicitly; no geo persistence or dormant geo scaffolding (DEC-077).
- **FR-031**: Preserve Providers setup-readiness `eligibleForPublicBrowse: false` placeholder semantics; do not treat it as a P11 runtime exclusion (DEC-072).
- **FR-032**: Meet phase coverage ≥80% statements, 75% branches, 80% functions, 80% lines **and** repository regression gates required for P11 (DEC-078).
- **FR-033**: Resolve country via `createTransactionalActiveCountryReader`/`getActiveCountryById` and service via Catalog `getProviderOfferingReference`/`resolveSelectableProviderOffering`; use locale-independent Providers eligibility pricing projection `AVAILABLE`|`UNAVAILABLE` (DEC-079, DEC-084).
- **FR-034**: Provider eligibility requires applicable Provider gates + sufficient crew-filtered capacity + ≥1 qualifying Team; Team eligibility requires Team qualifies AND Provider qualifies (DEC-080).

### Key Entities

- **EligibilityRuleVersion**: Immutable country-scoped rule bundle (`r1-v1` seed).
- **EligibilityEvaluation**: One completed application evaluation snapshot.
- **EligibilityCandidateResult**: Provider summary (`PROVIDER_SUMMARY`) and Team result (`TEAM_RESULT`) rows.

## Success Criteria *(mandatory)*

- **SC-001**: Every FR-003 rule path has automated tests covering PASS, FAIL, and applicable `NOT_EVALUATED` / `NOT_APPLICABLE` outcomes, including independent multi-FAIL and mixed-Team algebra.
- **SC-002**: Crew preference cases prove Escort gender does not disqualify cleaning-crew match and capacity is recomputed after filtering.
- **SC-003**: Disabled performance gate yields `NOT_APPLICABLE` and never excludes for missing data; enabled-gate tests prove below-threshold FAIL and missing/stale informational `NOT_EVALUATED`.
- **SC-004**: Determinism tests show equal semantic results for equal pinned inputs/facts; live fact changes may change results; generated IDs / trace / duration / persistence timestamps excluded from equality; `evaluatedAt` included.
- **SC-005**: Browse facade integration tests pass against real P09/P10-backed fixtures without HTTP; `providerIds` rejected on facade.
- **SC-006**: Persistence atomicity, XOR/uniqueness, required Provider summaries, composite FK country agreement, and 720-hour purge tests (including invalid batchSize rejection) pass on disposable fixtures.
- **SC-007**: Phase coverage meets FR-032 thresholds for P11 production code and changed public/composition seams.
- **SC-008**: Clean migration and populated-P10 upgrade validators pass on explicit disposable targets.
- **SC-009**: Module-boundary tests prove Eligibility does not import foreign private layers; zero eligibility HTTP routes exist; Worker IDs absent from persistence/logs/projection negatives.
- **SC-010**: Requirements map to completed tasks with recorded evidence; no unresolved BLOCKER/MAJOR at technical readiness.

## Assumptions

- Authority: `docs/product/current.md`, roadmap R1-P11, DEC-005, DEC-062–DEC-084, vision eligibility sections, `activation.md`, entity-ownership eligibility rows.
- P09 pricing and P10 operational availability are Complete and reusable through public contracts.
- No stored-value wallets; no Docker/cloud until R3; no Booking/reservations; no P12 marketplace HTTP in this phase.
- Composition is the trust boundary for invoking Eligibility; caller role strings are not credentials.
- Planned npm scripts `test:r1-p11`, `test:coverage:r1-p11`, `db:validate-r1-p11-upgrade` are created during implementation, not in preparation.


# Reason Codes — Closed Ordered Catalogs (P11)

Authority: DEC-064, DEC-068, DEC-071, DEC-074, DEC-075, DEC-080, DEC-084.

## Rule catalog (evaluation / presentation order)

Evaluation order is **presentation order**, not a universal prerequisite chain
(DEC-080). Preconditions are **required facts**. Independent readable facts
still evaluate when a Provider is non-live.

| Order | Rule ID | Factual prerequisites | Independent failures collected |
|---|---|---|---|
| 0 | `REQUEST_AND_RULE_VERSION` | None (global). Fail → whole-evaluation typed error | N/A (hard error) |
| 1 | `CATALOG_APPLICABILITY` | Global request valid; rule version selected; service + country identities resolved | Yes — recorded in `evaluationOutcomes.catalog` even with zero Providers |
| 2 | `PROVIDER_APPROVAL_VERIFICATION_LIVE` | Provider identity in evaluation set; lifecycle facts readable as business result | Yes |
| 3 | `OFFERING_PRICE_USABILITY` | Service identity known; pricing projection readable for provider/service/country | Yes — even if Provider not live |
| 4 | `TEXTUAL_COVERAGE` | Availability coverage facts readable for provider + locality | Yes — even if Provider not live |
| 5 | `PROVIDER_SCHEDULE_PAUSE` | Schedule/pause facts readable | Yes — even if Provider not live |
| 6 | `COMPLETE_TEAM_VALIDITY_AVAILABILITY` | Team aggregate availability facts readable | Yes |
| 7 | `CREW_PREFERENCE` | Team structurally valid **and** members-available facts present for that Team | Yes per Team |
| 8 | `CAPACITY_AFTER_CREW_FILTER` | Crew preference evaluated for Teams under the Provider | Yes (Provider-level) |
| 9 | `PERFORMANCE_GATE` | Provider identity in set. If gate **disabled** → `NOT_APPLICABLE` and **port not called**. If enabled → evidence port result | Yes when enabled |

Outcomes per rule: `PASS` | `FAIL` | `NOT_APPLICABLE` | `NOT_EVALUATED`.

### Dependency vs independence (DEC-084)

- **Expected absence** returned through a documented business-result variant
  (`MISSING`, `MISSING_CONFIGURATION`, pricing `UNAVAILABLE`, evidence
  `MISSING`) can make dependent rules `NOT_EVALUATED` with `dependencyRuleId`
  identifying the owning failed rule. Do not fabricate downstream FAIL reasons.
- **Reader outage, database failure, or invalid DTO** fails the **whole
  evaluation** with a typed error. Prerequisite skip must never conceal a
  technical failure.
- When prerequisites are satisfied, evaluate the rule even if an **earlier
  independent** rule already FAILed (e.g. non-live Provider still receives
  price, coverage, and schedule outcomes).

### Disabled vs missing performance (DEC-080 / DEC-084)

| Condition | Outcome | Exclusion reason? |
|---|---|---|
| Gate disabled | `NOT_APPLICABLE` (port not called) | No |
| Gate enabled + port `MISSING` | `NOT_EVALUATED` + `PERFORMANCE_EVIDENCE_MISSING` | **No** |
| Gate enabled + samples below pinned minimum | `NOT_EVALUATED` + `PERFORMANCE_EVIDENCE_INSUFFICIENT_SAMPLES` (Eligibility decides) | **No** |
| Gate enabled + stale vs pinned max age | `NOT_EVALUATED` + `PERFORMANCE_EVIDENCE_STALE` (Eligibility decides) | **No** |
| Gate enabled + fresh below threshold | `FAIL` + `PERFORMANCE_GATE_FAILED` | Yes |
| Malformed / incompatible policyVersionId / reader outage | Whole-evaluation technical error | N/A |

## Final eligibility algebra (DEC-080)

### Provider eligible iff all of:

1. All **applicable** Provider-level gates PASS (Catalog context for the
   candidate, approval/verification/live, offering/price, coverage, schedule/
   pause, and any other Provider-grain FAIL rules that apply).
2. Capacity after crew filter is sufficient for `requiredTeamUnits`.
3. At least one Team individually qualifies (structurally valid, available,
   crew preference PASS).

Disabled or missing/stale optional performance evidence does **not** falsify
this predicate.

### Team eligible iff both of:

1. That Team individually qualifies (validity, availability, crew preference).
2. Its Provider is Provider-eligible for the request.

Therefore:

- Provider-level capacity or performance **FAIL** excludes **all** Team
  alternatives for that Provider (Teams inherit exclusion; record ≥1 real
  exclusion reason, including inherited Provider reasons).
- One invalid Team does **not** exclude a Provider that still has sufficient
  other qualifying Teams. Use Team-scoped `TEAM_STRUCTURALLY_INVALID` for that
  Team; keep `NO_VALID_COMPLETE_TEAM` as the **Provider summary** reason when
  **no** qualifying Team structure exists.
- Rejected rows need ≥1 **real** exclusion reason. Informational performance
  diagnostics are **not** exclusion reasons.

### Global failures vs Catalog business outcomes (DEC-084)

- Malformed service input → `VALIDATION_FAILED` (whole evaluation).
- Unknown/inactive textual ancestry → `VALIDATION_FAILED` (whole evaluation).
- Well-formed service that is unknown/inactive/unavailable in country → Catalog
  rule **business** `FAIL` (`SERVICE_INACTIVE_OR_UNKNOWN` or
  `SERVICE_NOT_AVAILABLE_IN_COUNTRY`). Persist successful diagnostic with
  `evaluationOutcomes.catalog` even when discovery yields zero Providers.
  **Not** a hard error.

## Worked examples

### Example A — Multiple independent FAILs on one Provider

Facts: Provider not live; coverage mismatch; schedule closed; Teams readable.

Expected rule outcomes (presentation order):

1. Catalog — PASS (also recorded in `evaluationOutcomes.catalog`)
2. Approval/live — FAIL `PROVIDER_NOT_LIVE`
3. Offering/price — evaluate independently (PASS or FAIL on own facts)
4. Coverage — FAIL `COVERAGE_MISMATCH`
5. Schedule — FAIL `PROVIDER_CLOSED_OR_OUTSIDE_HOURS`
6–8. Team/crew/capacity — evaluate on readable Team facts; Provider remains
   ineligible because live gate failed
9. Performance — `NOT_APPLICABLE` if disabled

Provider `eligible=false` with ≥1 real reasons (`PROVIDER_NOT_LIVE`,
`COVERAGE_MISMATCH`, …).

### Example B — Mixed valid/invalid Teams

Facts: Provider live; all Provider gates PASS; Team T1 structurally invalid;
Team T2 crew PASS and available; required units = 1; simultaneous limit ≥ 1;
performance disabled.

Expected:

- T1: `eligible=false`, reason `TEAM_STRUCTURALLY_INVALID`
- T2: `eligible=true`
- Provider: `eligible=true`, `qualifyingTeamCount=1`
- Capacity: PASS

### Example C — Provider capacity FAIL excludes all Teams

Facts: Two Teams individually crew-match; after filter matching capacity = 1;
`requiredTeamUnits=2`.

Expected:

- Capacity rule FAIL `INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER`
- Provider `eligible=false`
- Both Team rows `eligible=false` with inherited Provider capacity reason
  (plus any Team-local outcomes)

### Example D — Disabled vs missing performance

- Disabled gate, no evidence: rule `NOT_APPLICABLE`; Provider may still be
  eligible; port not called.
- Enabled gate, missing evidence: rule `NOT_EVALUATED` +
  `PERFORMANCE_EVIDENCE_MISSING`; **not** an exclusion reason; Provider may
  still be eligible if other gates pass.

### Example E — Unavailable service, zero Providers

Facts: Well-formed `serviceId`; Catalog returns null / unavailable; discovery
finds zero Providers.

Expected: Successful persist; `evaluationOutcomes.catalog` = FAIL with
`SERVICE_NOT_AVAILABLE_IN_COUNTRY` or `SERVICE_INACTIVE_OR_UNKNOWN`; empty
eligible/excluded Provider lists as applicable — **not** a whole-evaluation
hard error.

## Reason code catalog (machine-readable)

Closed set for V1 (extend only via new immutable rule version + DEC):

| Code | Typical rule | Scope | Exclusion? |
|---|---|---|---|
| `SERVICE_NOT_AVAILABLE_IN_COUNTRY` | Catalog | Evaluation / service | Yes |
| `SERVICE_INACTIVE_OR_UNKNOWN` | Catalog | Evaluation / service (well-formed) | Yes (business FAIL; **not** hard-if-global) |
| `PROVIDER_NOT_APPROVED` | Approval | Provider | Yes |
| `PROVIDER_NOT_LIVE` | Lifecycle | Provider | Yes |
| `PROVIDER_SUSPENDED` | Lifecycle | Provider | Yes |
| `VERIFICATION_NOT_SATISFIED` | Verification | Provider | Yes |
| `OFFERING_OR_PRICE_UNAVAILABLE` | Offering/price | Provider/service | Yes |
| `REQUESTED_INTERVAL_TOO_SHORT` | Offering duration vs interval (Eligibility compares `estimatedDurationMinutes` from AVAILABLE pricing to request; pricing reader never emits this) | Provider/service | Yes |
| `CAPACITY_RULE_MISSING` | Capacity config absent (`missingConfiguration` includes `CAPACITY_RULE`; limit is null) | Provider | Yes |
| `COVERAGE_MISMATCH` | Coverage | Provider | Yes |
| `PROVIDER_CLOSED_OR_OUTSIDE_HOURS` | Schedule | Provider | Yes |
| `PROVIDER_PAUSED` | Pause | Provider | Yes |
| `NO_VALID_COMPLETE_TEAM` | Team validity — only when no qualifying Team structure exists; never as a stand-in for missing configuration when Teams remain readable | Provider summary | Yes |
| `TEAM_STRUCTURALLY_INVALID` | Team validity | Team | Yes |
| `TEAM_MEMBERS_UNAVAILABLE` | Team availability | Team | Yes |
| `CREW_PREFERENCE_MISMATCH` | Crew | Team | Yes |
| `INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER` | Capacity | Provider | Yes |
| `PERFORMANCE_GATE_FAILED` | Performance | Provider | Yes |
| `PERFORMANCE_EVIDENCE_MISSING` | Performance | Diagnostic | **No** |
| `PERFORMANCE_EVIDENCE_INSUFFICIENT_SAMPLES` | Performance | Diagnostic | **No** |
| `PERFORMANCE_EVIDENCE_STALE` | Performance | Diagnostic | **No** |
| `NOT_IN_DISCOVERY_SCOPE` | Discovery metadata | Metadata only | N/A |

`EVALUATION_LIMIT_EXCEEDED` is a whole-evaluation error, not a per-candidate
reason.

Deduplicate identical exclusion codes on a single candidate while preserving
first rule-order occurrence.

## Owning-reader mapping

| Reason family | Prefer source |
|---|---|
| Catalog | `getProviderOfferingReference` / `resolveSelectableProviderOffering` (tx-bound) |
| Approval/verification/live | Eligibility Provider lifecycle projection |
| Offering/price | Locale-independent Eligibility pricing projection (`AVAILABLE` \| `UNAVAILABLE` with `OFFERING_OR_PRICE_UNAVAILABLE` only) |
| Interval too short | Eligibility (compares AVAILABLE duration to request) |
| Missing capacity rule | Availability `MISSING_CONFIGURATION` + `CAPACITY_RULE` kind → `CAPACITY_RULE_MISSING` |
| Coverage/schedule/pause/team availability | Eligibility availability reader (budget + OVERFLOW) |
| Crew gender / escort aggregates | Team aggregate facts (no Worker IDs; escort not universally required) |
| Capacity after filter | Eligibility policy on Team outcomes + Provider limit |
| Performance | PerformanceEvidencePort (`OK` \| `MISSING`) + Eligibility sample/freshness/threshold |

## Escort / crew notes

- Gender preference applies only to cleaner counts (`cleans=true` aggregates).
- Escort gender does not generate `CREW_PREFERENCE_MISMATCH`.
- Escort fields express Providers-owned Escort validity; they do **not** require
  every Team to contain an Escort. When an Escort is required by Providers
  policy, unavailability uses team availability / structural reasons — not crew
  mismatch.

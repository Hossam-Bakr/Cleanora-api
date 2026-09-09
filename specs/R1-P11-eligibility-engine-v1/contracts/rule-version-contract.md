# Rule Version Contract (P11)

Authority: DEC-067, DEC-068, DEC-075, DEC-081, DEC-082, DEC-084.

## Frozen initial seed identity (DEC-082)

| Field | Frozen value |
|---|---|
| Seed row `id` | Fixed deterministic text ID: `eligibility_rule_r1_v1_eg` |
| `versionLabel` | `r1-v1` |
| Country | Configured Egypt resolved by code **`EG`** (store `countryId` FK to that country row) |
| `effectiveFrom` | `2026-09-09T00:00:00.000Z` |
| `schemaVersion` | `eligibility.rules.v1` (text) |
| `engineCompatibility` | `eligibility-engine.r1.v1` |

## Bundle schema (V1)

```json
{
  "schemaVersion": "eligibility.rules.v1",
  "engineCompatibility": "eligibility-engine.r1.v1",
  "versionLabel": "r1-v1",
  "countryCode": "EG",
  "effectiveFrom": "2026-09-09T00:00:00.000Z",
  "ruleOrder": [
    "CATALOG_APPLICABILITY",
    "PROVIDER_APPROVAL_VERIFICATION_LIVE",
    "OFFERING_PRICE_USABILITY",
    "TEXTUAL_COVERAGE",
    "PROVIDER_SCHEDULE_PAUSE",
    "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
    "CREW_PREFERENCE",
    "CAPACITY_AFTER_CREW_FILTER",
    "PERFORMANCE_GATE"
  ],
  "parameters": {
    "maxProvidersPerEvaluation": 500,
    "maxTeamResultsPerEvaluation": 5000,
    "maxIntervalHours": 24,
    "minRequiredTeamUnits": 1,
    "maxRequiredTeamUnits": 50,
    "crewPreferences": ["all_male", "all_female", "any"],
    "performanceGate": {
      "enabled": false,
      "metricKey": null,
      "minimumThreshold": null,
      "minimumSampleCount": null,
      "maxEvidenceAgeSeconds": null
    }
  }
}
```

## Checksum

`contentChecksum` = SHA-256 hex digest over UTF-8 canonical JSON of:

- `schemaVersion`
- `engineCompatibility`
- `ruleOrder`
- `parameters`

Canonical JSON rules (DEC-081): sorted object keys, defined array order, no
`undefined`, UTC timestamps as ISO-8601 with `Z`, canonical decimal strings.

Checksum **excludes** provenance timestamps and the database row `id`, but seed
**verification** is broader (below).

## Seed behavior (DEC-082)

1. Upsert/insert the fixed deterministic seed id for Egypt `EG` with the frozen
   effective instant.
2. Re-running seed with **identical** content: verify **all immutable fields**
   match — `id`, `countryId` (resolved from `EG`), `versionLabel`,
   `schemaVersion`, `engineCompatibility`, `ruleOrder`, `parameters`,
   `effectiveFrom`, `contentChecksum`. Then no-op.
3. Re-running when **any** immutable field diverges: **fail loudly**; do **not**
   overwrite. Checksum-alone comparison is **insufficient**.
4. Provenance identifies the controlled seed/migration operation.

## Selection algorithm

1. Capture `evaluatedAt` once before the retry loop (DEC-081).
2. On each attempt, against a **fresh** DB snapshot, filter bundles by
   `countryId` and `engineCompatibility`.
3. Keep rows with `effectiveFrom <= evaluatedAt` (same captured instant on every
   retry).
4. Choose latest `effectiveFrom` (ties forbidden by uniqueness).
5. Validate parameters against schema; unknown rule ids → `RULE_VERSION_INVALID`.

Caller-selected rule versions are not accepted on live evaluation APIs.

## Performance gate parameters (DEC-084)

When `performanceGate.enabled === false` (seed default):

- Rule outcome exactly `NOT_APPLICABLE`
- Evidence port **not called**
- Missing evidence does **not** exclude

When enabled (tests / future versioned bundle):

| Param | Validation | Meaning |
|---|---|---|
| `metricKey` | Non-empty string | Trusted metric identity |
| `minimumThreshold` | Canonical decimal string | Minimum acceptable value |
| `minimumSampleCount` | Positive integer | Eligibility compares against returned `sampleCount` |
| `maxEvidenceAgeSeconds` | Positive integer | Eligibility freshness: `observedAt + maxAge` vs `evaluatedAt` |

Invalid parameter shapes on a selected bundle → `RULE_VERSION_INVALID`.

### Port vs Eligibility ownership

- Port request includes selected **`policyVersionId`** (= rule version id /
  policy identity).
- Port returns complete evidence (`OK`) or `MISSING` only. Technical failures
  reject.
- Returned `policyVersionId` **must match** the request; mismatch → technical
  integrity failure.
- Eligibility alone decides insufficient samples, staleness, and threshold FAIL.

Outcomes:

- Fresh below threshold → FAIL `PERFORMANCE_GATE_FAILED`
- Missing / insufficient / stale → `NOT_EVALUATED` with distinct informational
  codes (not FAIL, not exclusion)
- Malformed / future-dated / incompatible policy version → technical integrity
  failure
- Reader outage → `DEPENDENCY_FAILURE`

No formula editor; no dynamic code loading.

## Retention note (DEC-084)

Evaluation retention is **720 elapsed hours** from `completedAt`
(`expiresAt = completedAt + interval '720 hours'`). Rule versions are not
purged by evaluation expiry. See [data-model.md](../data-model.md).

## Version changes

Any parameter or rule-order change requires a **new** immutable row (new
`versionLabel` and `effectiveFrom`). P11 has no rule-authoring HTTP.

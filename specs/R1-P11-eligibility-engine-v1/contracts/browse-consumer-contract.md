# Browse Consumer Contract (P11)

Authority: DEC-072, DEC-070, DEC-079.  
DoD: **P11 proves Browse-use contract; P12 mounts HTTP.**

## Facade

Name: `getStandardBrowseCandidates`  
Export: `src/modules/eligibility/eligibility.public.ts`  
Wiring: composition supplies the concrete service to approved consumers.

```ts
getStandardBrowseCandidates(
  input: BrowseCandidatesRequest,
): Promise<BrowseSafeProjection>;
```

`BrowseCandidatesRequest` is discovery-shaped. **`providerIds` is forbidden.**
If a runtime object carries `providerIds`, reject with `VALIDATION_FAILED`.
Explicit Provider evaluation uses `evaluateEligibility` with `ExplicitRequest`
only — never this facade.

Behavior:

1. Accept browse-shaped request (same base fields as discovery).
2. Invoke the **same** evaluator used by `evaluateEligibility` (discovery mode).
3. On success, map to **safe projection** allowlist below.
4. On hard evaluation error, surface the typed `EligibilityError` unchanged.

Forbidden in the facade:

- Independent eligibility filtering
- HTTP, pagination product, marketplace cards, ranking algorithm
- Bookings module creation
- Treating `eligibleForPublicBrowse: false` setup placeholder as a filter
- Passing or accepting `providerIds`

## Safe projection allowlist

Include **only**:

| Field | Notes |
|---|---|
| `candidates[].providerId` | Eligible only |
| `candidates[].teamId` | Eligible only; canonical order Provider ID then Team ID |
| `candidates[].sortingFacts.priceAmount` | Decimal string |
| `candidates[].sortingFacts.minimumChargeAmount` | Decimal string |
| `candidates[].sortingFacts.currencyCode` | |
| `candidates[].sortingFacts.priceUnitId` | |
| `candidates[].sortingFacts.estimatedDurationMinutes` | |
| `candidates[].sortingFacts.matchingCapacityUnits` | |
| `candidates[].sortingFacts.performanceMetricKey` | Optional; only when valid + allowlisted |
| `candidates[].sortingFacts.performanceValue` | Optional; only when valid + allowlisted |
| `metadata.contractVersion` | |
| `metadata.engineVersion` | |
| `metadata.ruleVersionId` | |
| `metadata.requestHash` | |
| `metadata.evidenceHash` | |
| `metadata.resultHash` | |
| `metadata.evaluatedAt` | |
| `metadata.countryTimeZone` | |
| `metadata.discovery` | Mode, scope keys, counts, completeness — no exclusion dumps |

Omit:

- Excluded candidates and all rejection diagnostics / reason arrays
- Member-level workforce evidence and **Worker IDs**
- Raw addresses, customer identity, contacts, verification documents, payouts
- Internal rule-by-rule dumps for rejected rows
- `providerIds` request echo

## Integration proof requirements (real, not conceptual)

To satisfy DEC-072 / SC-005, tests in
`tests/integration/eligibility/r1-p11-browse-facade.test.ts` must:

1. Call the **composition-wired** facade from `src/composition.ts` (or the
   composition test harness that constructs the same wiring), not only a
   hand-built evaluator with mocks.
2. Use **real P09/P10-backed** Catalog/Providers/Configuration persistence
   fixtures for at least one PASS path and one exclusion path.
3. Assert projection contains only allowlisted fields.
4. Assert projection omits exclusion diagnostics even when
   `evaluateEligibility` would include them for the same fixtures.
5. Assert `providerIds` on the facade input is rejected.
6. A TypeScript type declaration alone is insufficient.
7. A fully mocked evaluator behind the facade alone is insufficient.

## Relationship to P12

P12 may mount HTTP that authenticates callers and invokes this facade. P12 must
add its own authz/privacy policy. P11 does not pre-create those routes.

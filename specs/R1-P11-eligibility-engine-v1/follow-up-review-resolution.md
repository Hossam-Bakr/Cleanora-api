# Review Resolution — R1-P11 Codex FAIL follow-up

Date: 2026-09-10  
Source: `codex-final-review-2026-09-09-fail.md`  
Result: **All listed BLOCKER/MAJOR findings resolved in the unpublished follow-up tree**

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| DEC-078 lint + `test:unit` not green | accepted | Historical P08/P10 pins updated to living contracts; Eligibility OVERFLOW is impossible inside candidate rules; unused-hash lint repaired | `npm run lint` exit 0 (8 GB heap); `npm run test:unit` 294 files / 1,632 tests then focused +23 follow-up tests |
| Verification treated as satisfied when unwired | accepted | Mandatory Providers-owned `readVerificationSatisfiedOrNotRequired`; composition supplies `evaluatedAt`; failures abort as `DEPENDENCY_FAILURE` | lifecycle reader + composed reader tests |
| 5,000-Team bound hydrated after unbounded load | accepted | Repository queries `take: remainingTeamBudget + 1` IDs first; sentinel returns OVERFLOW stubs without deep membership hydrate | availability reader/repository tests + live P11 coverage |
| Rule bundle/checksum not validated | accepted | `eligibility.rule-bundle.ts` validates schema, engine, exact rule order, closed parameters, checksum | `rule-bundle.validation.test.ts` |
| `resultHash` hashed excluded fields / empty sourceVersions | accepted | Typed `EligibilityResultHashInput`; explicit projection; sorted source versions | `result-hash.golden.test.ts` |
| Excluded Teams could have empty reasons; pause fabricated from suspension | accepted | Provider exclusion reasons inherited onto ineligible Teams; `paused` is pause-only | `eligibility.rules.test.ts`, availability reader tests |
| Retryable conflicts lost; foreign errors leaked | accepted | `eligibility.technical-errors.ts` classifies CONFLICT / P2028 / P2034 / 40001 / 40P01; persist preserves retryable insert conflicts | `conflict-retry.test.ts` |
| Candidate rules still accepted OVERFLOW | accepted | `evaluateProviderCandidate` throws; orchestration maps OVERFLOW to `EVALUATION_LIMIT_EXCEEDED` first | `eligibility.rules.test.ts` + typecheck |

No finding was rejected without evidence. DEC-085 remains the historical completion record; this file is the unpublished follow-up repair map.

## Remaining risks

- Whole-repository `npm run test:integration` and `npm run test:coverage` were not re-run in this combined pass.
- P11 live proofs used disposable `cleanora_r1_p11_proof` only.
- In-process Browse pagination snapshots remain process-local by MVB design.

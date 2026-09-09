# R1-P11 Analysis Report — Preparation Cross-Artifact Consistency

**Date**: 2026-09-09  
**Scope**: Preparation artifacts under `specs/R1-P11-eligibility-engine-v1/`  
**Authority**: DEC-062–084; `pm-preparation-report.md`; `preparation-review-report.md`; `preparation-rereview-report.md`

## Verdict

**PREPARATION_ACCEPTED** (Codex PM-05 / DEC-062; see `preparation-acceptance-pm05.md`)

P11-PREP-01 **CLOSED**. Historical CHANGES_REQUIRED verdicts (PM-02/PM-03) are
preserved as history. Batch A (T001–T007) is **authorized and in progress**
under DEC-083. This does not mark Batch A or P11 complete.

## Prior verdicts superseded

| Item | Status |
|---|---|
| Historical `analysis-report.md` CLEAN (pre-review) | **Superseded** |
| Codex preparation review (PM-02) | CHANGES_REQUIRED (`preparation-review-report.md`) — historical |
| DEC-079–083 documentation repair | Applied; insufficient for PREP-01–04 at the time |
| Codex preparation re-review (PM-03) | CHANGES_REQUIRED (`preparation-rereview-report.md`); DEC-084 recorded — historical |
| DEC-084 documentation repair | Applied |
| Codex PM-04 re-review | Narrow corrections applied; see `preparation-rereview-pm04.md` |
| Codex PM-05 focused acceptance | **PREPARATION_ACCEPTED** (`preparation-acceptance-pm05.md`); PREP-01 CLOSED |
| Batch A | **Authorized / in progress** (T001–T007 under DEC-083) |

## Finding resolution (P11-PREP-01–08)

| Finding | Severity | Resolution reference |
|---|---|---|
| P11-PREP-01 Public/dependency contracts | MAJOR | **RESOLVED** (DEC-084 + PM-04 narrow fix) — `MISSING_CONFIGURATION` preserves readable coverage/schedule/pause/suspension/Team facts + `missingConfiguration` kinds + `CAPACITY_RULE_MISSING`; pricing reader no longer emits `REQUESTED_INTERVAL_TOO_SHORT`; Escort vacuous vs present-unavailable clarified |
| P11-PREP-02 Rule dependencies / verdict algebra ambiguous | MAJOR | **RESOLVED** (DEC-084 Repair B) — `evaluationOutcomes`; closed `EligibilityRuleId`; no hard-if-global for well-formed inactive service; expected absence vs technical failure; `TEAM_STRUCTURALLY_INVALID` (`eligibility-public-contract.md`, `reason-codes.md`) |
| P11-PREP-03 Retry timing / semantic evidence inconsistent | MAJOR | **RESOLVED** (DEC-084 Repair C) — typed `EligibilityEvidenceSnapshot`; exact hash inputs; performance port evidence\|MISSING; Eligibility owns samples/freshness/threshold; concurrent may succeed without retry |
| P11-PREP-04 Data model / seed / purge deferred | MAJOR | **RESOLVED** (DEC-084 Repair D) — unique `(id, countryId)`; composite FK `(ruleVersionId, countryId)`; `expiresAt = completedAt + 720 hours`; purge reject invalid batchSize; no caller `asOf` |
| P11-PREP-05 Batch A scaffolding conflicts | MAJOR | **CLOSED** (PM-03; DEC-083) — unchanged; T001–T007 scope preserved |
| P11-PREP-06 Traceability / CLEAN unjustified | MAJOR | **CLOSED** (PM-03) — FR→task→test mapping retained; updated for DEC-084 cases |
| P11-PREP-07 Privacy wording / Worker IDs | MINOR | **CLOSED** (PM-03) |
| P11-PREP-08 Companion lifecycle missing | MINOR | **CLOSED** (PM-03 — graceful degradation; Python unavailable) |

## Consistency checks (DEC-084 repair)

| Check | Result |
|---|---|
| DEC-084 Repairs A–D reflected in named contracts + data/migration/ops | PASS (documentation) |
| `evaluationOutcomes` + Catalog empty-discovery example | PASS |
| `EligibilityError` interface (not class) for T007 | PASS |
| Performance port MISSING-only; Eligibility sample/freshness/threshold | PASS |
| Composite FK + 720h retention + reject invalid purge batchSize | PASS |
| Concurrent snapshot may succeed without retry | PASS |
| T001–T007 IDs and DEC-083 Batch A scope preserved | PASS |
| Zero new HTTP; no Batch A / src/tests/prisma edits in this repair | PASS |

## Validation commands

Parent agent will re-run `git diff --check` and `npm run docs:check`
(`TSX_DISABLE_CACHE=1`) after this repair. This subagent did not claim those
results.

No application tests, coverage, or database validation were run.

## Companion lifecycle

Unchanged graceful degradation: Python interpreter unavailable on this host;
sanctioned Companion writer not run; `.spec-context.json` not fabricated.

## Residual gaps

- Batch A gate results (test/typecheck/lint) remain for parent evidence fill.
- Runtime/implementation Batches B–G correctly remain pending.
- Companion `.spec-context.json` absent until Python writer can run.

## Conclusion

Preparation accepted under PM-05. **PREPARATION_ACCEPTED**. Batch A (T001–T007)
authorized and in progress under DEC-083; Batches B–G remain unauthorized until
Batch A acceptance.

**1. Verdict — CHANGES_REQUIRED**

**Repairs B, C and D are accepted. Repair A has one remaining material defect and two small contract corrections.** P11-PREP-02–08 are closed; only **P11-PREP-01 remains open**.

**Batch A T001–T007 is not yet authorized.** Its scope and acceptance conditions are sound. The remaining work is confined to the dependency contract and its mirrored evidence declarations—not a phase redesign.

Fresh verification:

- Branch and HEAD remain `codex/r1-p11-eligibility-engine-v1` at `38f3efa080a4ffd71f24fd83b2ab800662558b30`.
- Spec Kit selects P11.
- `src/modules/eligibility` does not exist; Batch A has not started.
- `npm run docs:check` with process-local `TSX_DISABLE_CACHE=1`: **exit 0**, `{"ok":true,"checked":14}`.
- `git diff --check`: **exit 0**.
- No runtime tests, coverage or database validation were run.

**2. Disposition of P11-PREP-01–08**

| Finding | Disposition | Evidence |
|---|---|---|
| **P11-PREP-01 — Public/dependency contracts** | **STILL OPEN — MAJOR, narrowly scoped** | Named readers, pricing discrimination, Team budgets and overflow are present. However, [`MISSING_CONFIGURATION`](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:184) discards every independently readable availability fact and exposes only one reason. Details below. |
| **P11-PREP-02 — Rule dependencies/verdicts** | **CLOSED** | [Public contract](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/eligibility-public-contract.md:195) now requires `evaluationOutcomes`; rule IDs are closed; [reason-codes.md](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/reason-codes.md) distinguishes technical failures from expected absence, adds `TEAM_STRUCTURALLY_INVALID`, and makes well-formed unavailable services business outcomes. |
| **P11-PREP-03 — Clock/evidence/determinism** | **CLOSED** | [Typed evidence and hash definitions](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/eligibility-public-contract.md:283) are present. The performance port returns complete evidence or `MISSING`; Eligibility owns comparison. The test strategy permits consistent-snapshot success without a forced retry. The evidence availability type needs only the mechanical synchronization described below. |
| **P11-PREP-04 — Data/seed/purge** | **CLOSED** | [Data model](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/data-model.md), migration plan and operations runbook agree on unique `(id, countryId)`, restrictive composite FK, 720 elapsed hours, rejection of invalid batch sizes, and composition-clock cutoff without caller `asOf`. |
| **P11-PREP-05 — Batch A structure/gates** | **CLOSED** | T007 remains declarations-only, including an `EligibilityError` **interface**; no empty folders or runtime stubs. T006 must pass. Typecheck and relevant lint remain required. |
| **P11-PREP-06 — Traceability/evidence** | **CLOSED** | FR→task→test mappings remain present and include DEC-084 cases. Analysis distinguishes preparation review from implementation proof. Update its resolution table to reflect this verdict. |
| **P11-PREP-07 — Privacy** | **CLOSED** | Separate persistence, diagnostic, projection and log allowlists retain explicit Worker-ID and raw-member-array prohibitions. |
| **P11-PREP-08 — Companion** | **CLOSED — graceful degradation** | Python unavailability remains documented; no lifecycle history is fabricated. This does not block implementation acceptance. |

**3. Minimal remaining documentation repairs**

These corrections implement the existing DEC-064/065/074/084 requirements. **No new module, workflow, policy framework or preparation artifact set is needed.**

**A. Preserve independent availability facts when configuration is incomplete — MAJOR**

The current `MISSING_CONFIGURATION` variant contains only `providerId` and one `reason`. Consequently, it cannot represent this valid evaluation case:

> A Provider lacks its capacity rule, has a coverage mismatch, is temporarily paused, and has readable Team facts.

Returning that variant drops coverage, pause, schedule and Team evidence. This conflicts with collecting all independently evaluable failures. Its reason union also allows `NO_VALID_COMPLETE_TEAM` as a substitute for missing configuration even when valid Teams exist.

**Required correction:**

- Retain the current top-level variants and overflow design.
- Make `MISSING_CONFIGURATION` preserve the same independently readable coverage, schedule, pause, suspension and Team fields as `AVAILABLE_FACTS`.
- Represent absent settings explicitly with a non-empty `missingConfiguration` list identifying `COVERAGE`, `PROVIDER_SCHEDULE` and/or `CAPACITY_RULE`.
- Permit `simultaneousTeamLimit: null` specifically when the capacity rule is absent. Do not fabricate zero.
- Add `CAPACITY_RULE_MISSING` to the initial reason catalog for that exact condition. Keep `NO_VALID_COMPLETE_TEAM` exclusively for an actual absence of qualifying Team structure.
- Pause and suspension remain operational facts; they are not missing-configuration categories.
- Continue applying the Team budget and overflow rule when Team facts remain independently readable.
- Mirror the corrected variant in `EligibilityEvidenceSnapshot`.

**Required documented example/test:**

Missing capacity rule + coverage mismatch + active pause + readable valid Team produces the truthful missing-capacity, coverage and pause exclusions. It preserves the Team facts and does not invent `NO_VALID_COMPLETE_TEAM`.

This is the sole remaining **MAJOR**.

**B. Remove request-duration judgment from the pricing reader — small contract correction**

The [pricing `UNAVAILABLE` union](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:78) includes `REQUESTED_INTERVAL_TOO_SHORT`, but `getEligibilityPricingFacts` receives no requested interval.

**Required correction:**

- Remove `REQUESTED_INTERVAL_TOO_SHORT` from the pricing reader’s return reasons.
- Keep it in Eligibility’s rule/reason catalog.
- Eligibility compares `estimatedDurationMinutes` from `AVAILABLE` pricing facts against the requested interval and emits that reason.

Do not add an interval parameter to the pricing reader; the existing ownership split is appropriate.

**C. Correct the Escort aggregate comment — small contract correction**

The [Escort contract comment](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:172) currently makes validity and availability true whenever an Escort is not required.

That conflates **no Escort required** with **an existing Escort is valid and available**.

**Required correction:**

- A Team with no Escort is not excluded merely for lacking one.
- If no Escort is present and none is required, Escort-specific checks are vacuously satisfied.
- If an Escort is present, its actual validity and whole-interval availability must be reflected, whether or not an Escort was required.
- `membersAvailableForWholeInterval` continues to include every current member, including Escorts.

Add one documented test case: an optional but present unavailable Escort makes the complete Team unavailable.

**4. Cursor repair scope and next gate**

Edit only the existing preparation documents needed for those three corrections:

- `contracts/dependency-readers.md`
- `contracts/eligibility-public-contract.md`
- `contracts/reason-codes.md`
- `test-strategy.md`
- Relevant task descriptions/mappings in `tasks.md`
- `analysis-report.md` and checkpoint/review-status notes

Update the spec only where necessary to keep wording consistent. Preserve the accepted B–D repairs and T001–T007 numbering.

After the edits:

1. Record P11-PREP-02–08 as closed and the specific P11-PREP-01 correction.
2. Run documentation and whitespace checks.
3. Return the corrected availability/pricing/Escort contract sections and mirrored evidence type for a focused re-review.

**Do not start Batch A during this repair.** No further broad preparation rewrite is requested.

**5. Authorization and role confirmation**

I made no edits, implemented no code, and performed no staging, commit, push, merge, deployment or migration.

The remaining corrections are decided above under **DEC-062**. **Do not ask the human for in-scope decisions.** Batch A remains withheld solely because its frozen declarations would otherwise encode the incomplete-configuration defect.
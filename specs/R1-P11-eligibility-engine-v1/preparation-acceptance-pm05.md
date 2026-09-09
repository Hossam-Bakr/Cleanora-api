1. **Verdict: PREPARATION_ACCEPTED**

Under **DEC-062 delegated owner authority**, I accept the P11 preparation artifacts after the PM-04 narrow corrections. **P11-PREP-01 is CLOSED.** The prior closures of P11-PREP-02–08 remain in force.

**Cursor is explicitly authorized to execute Batch A, T001–T007 only, under DEC-083**, subject to the acceptance conditions below. This authorizes starting Batch A; it does not mark that batch or P11 complete.

The checkout remains `codex/r1-p11-eligibility-engine-v1` at `38f3efa080a4ffd71f24fd83b2ab800662558b30`, with `.specify/feature.json` pointing to P11. `src/modules/eligibility` is absent, consistent with Batch A not yet having started.

2. **P11-PREP-01 disposition: CLOSED**

The repaired contracts and documented test cases now address all three narrow corrections.

| Correction | Verified evidence | Disposition |
|---|---|---|
| **A — Missing configuration preserves independent facts** | `EligibilityReadableAvailabilityFacts` carries coverage, schedule, pause, suspension, capacity limit, and Team facts into the missing-configuration variant. `missingConfiguration` has the three specified kinds and is explicitly required to be non-empty. Missing capacity uses `null`, with no fabricated zero; pause and suspension remain operational facts. Team budget and overflow rules continue to apply. See [dependency-readers.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:192). | **CLOSED** |
| **A — Evidence and reasons preserve the same meaning** | The evidence availability variant retains the same facts and missing-configuration kinds. `CAPACITY_RULE_MISSING` appears in the public reason union and reason catalog. `NO_VALID_COMPLETE_TEAM` is reserved for actual absence of qualifying Team structure. See [public evidence declaration](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/eligibility-public-contract.md:342), [public reason union](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/eligibility-public-contract.md:62), and [reason-codes.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/reason-codes.md:168). | **CLOSED** |
| **B — Pricing and interval ownership** | Pricing `UNAVAILABLE.reason` is restricted to `OFFERING_OR_PRICE_UNAVAILABLE`. The reader receives no requested interval. Eligibility explicitly compares available `estimatedDurationMinutes` against the requested interval and owns `REQUESTED_INTERVAL_TOO_SHORT`. See [pricing declaration and semantics](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:61) and [reason ownership mapping](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/reason-codes.md:195). | **CLOSED** |
| **C — Escort absence versus actual unavailability** | Escort checks are vacuously satisfied only when no Escort is present and none is required. If present, actual validity and whole-interval availability apply regardless of whether an Escort was required. Overall member availability includes actual Escorts. See [Escort contract](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:175). | **CLOSED** |
| **Regression expectations** | The mandatory test cases include optional-but-present unavailable Escort → `TEAM_MEMBERS_UNAVAILABLE`, and missing capacity + coverage mismatch + active pause + readable valid Team → the three truthful exclusions, preserved Team facts, and no fabricated `NO_VALID_COMPLETE_TEAM`. See [test-strategy.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/test-strategy.md:102). | **CLOSED at preparation level**; executable tests remain implementation work. |

These corrections satisfy the existing decisions, particularly DEC-064, DEC-065, DEC-074, and DEC-084. No additional product decision or redesign is required.

3. **Authorized Cursor Batch A — T001–T007 exactly**

Follow the scope in [tasks.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/tasks.md:12):

| Task | Authorized deliverable |
|---|---|
| **T001** | `vitest.r1-p11.config.ts`: exact selection allowlist for P11 suites and explicitly named changed-seam suites. |
| **T002** | Add `test:r1-p11` and `test:coverage:r1-p11` to `package.json`; change the lockfile only if actually required. |
| **T003** | `tests/unit/scripts/r1-p11-test-selection.test.ts`: verify selection and exclusion of unrelated historical suites. |
| **T004** | `tests/helpers/r1-p11-eligibility-fixtures.ts`: reusable disposable fixtures without secrets. |
| **T005** | `specs/R1-P11-eligibility-engine-v1/implementation-evidence.md`: record selection, baseline preservation, attribution, and actual validation outcomes. |
| **T006** | `tests/unit/modules/r1-p11-module-boundaries.test.ts`: verify the public entry and prohibit Eligibility HTTP registration. **This test must pass before Batch A acceptance.** |
| **T007** | `src/modules/eligibility/eligibility.public.ts`: substantive approved TypeScript declarations only, matching the repaired frozen public contract. Include the required types and interface signatures; `EligibilityError` remains an interface. |

T007 authorizes no runtime implementations, placeholder service bodies, runtime error class, barrels, or empty layer folders. Persistence, dependency-reader implementations, rule evaluation, composition, Browse facade behavior, and purge behavior remain outside this batch.

**Batch A acceptance requires all of the following:**

- The phase configuration selects the expected existing suites; the selection guard passes. An empty successful test run is insufficient.
- `npm run test:r1-p11` runs successfully after T002 creates that script, including a green T006.
- Fixtures and the public declarations compile.
- `npm run typecheck` and relevant lint pass, with exact commands and exit codes recorded. The existing repository scripts define `typecheck` as `tsc --noEmit` and `lint` as `eslint .`.
- T007 faithfully carries the repaired public contract, including `CAPACITY_RULE_MISSING` and the missing-configuration evidence fields, without Worker IDs or raw member arrays.
- Evidence distinguishes P11 changes from inherited P08/P09/P10 work and demonstrates preservation of the inherited tree.
- The handoff does not claim rule behavior, coverage thresholds, migration validation, full repository gates, or P11 completion from this declarations-and-test-setup batch.

4. **Residual MINOR and review validation**

One **nonblocking documentation-status cleanup** remains. [analysis-report.md](/D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/analysis-report.md:26) still calls PM-04 pending, and its closing text still awaits PM-04 acceptance, despite correctly describing the subsequent narrow repair near the top. Some active status text elsewhere also retains the earlier review label.

Cursor should record this response as the **PM-05 focused acceptance**, mark PREP-01 closed, preserve the historical CHANGES_REQUIRED verdicts, and synchronize the current preparation/Batch A status in the analysis report, current-phase pointer, checkpoint, and implementation handoff. This is authorized status bookkeeping alongside T005; it does not require another preparation review.

I reran:

- `git diff --check` — **exit 0**.
- `npm run docs:check`, with process-local `TSX_DISABLE_CACHE=1` — **exit 0**, `{"ok":true,"checked":14}`.

The documentation command checks required paths; semantic acceptance comes from the contract review above. No application tests, coverage checks, or database validators were run in this read-only review. The previously accepted Companion graceful degradation remains documented; no fabricated Companion state is required.

5. **Authority and execution confirmation**

This acceptance and Batch A authorization are **Codex decisions under DEC-062**, applying DEC-083. No separate human approval is represented or required.

I did not implement, edit files, commit, push, or ask the human. Cursor may now perform the specified Batch A work and return its evidence for acceptance.
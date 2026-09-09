**1. Verdict — CHANGES_REQUIRED**

The repair batch closes **P11-PREP-05, P11-PREP-06, P11-PREP-07 and P11-PREP-08**. It materially improves the other four findings, but does not fully close them.

**Cursor Batch A T001–T007 remains unauthorized.** Its revised scope is now appropriate; the remaining obstacle is the contract content that T007 must turn into declarations.

This is a narrower repair request. Preserve the accepted ownership, phase boundaries, verdict algebra, clock placement, seed identity, task structure and privacy decisions. Complete the specific contract and persistence details below.

Verified during this re-review:

- Branch: `codex/r1-p11-eligibility-engine-v1`.
- HEAD: `38f3efa080a4ffd71f24fd83b2ab800662558b30`.
- Spec Kit pointer selects P11.
- `src/modules/eligibility` does not exist; Batch A has not started.
- `npm run docs:check`, with process-local `TSX_DISABLE_CACHE=1`: **exit 0**, `{"ok":true,"checked":14}`.
- `git diff --check`: **exit 0**.
- These checks do not establish semantic contract completeness. No runtime tests, coverage or database proofs were run.

**2. Disposition of P11-PREP-01–08**

| Finding | Disposition | Evidence and assessment |
|---|---|---|
| **P11-PREP-01 — Public/dependency contracts** | **STILL OPEN — MAJOR** | Public types and transaction factories now exist. However, [dependency-readers.md](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:45) still says “reuse if already present” and refers to an unspecified `getDefinition`. Availability has no bounded Team-read contract or representation for missing configuration. Pricing uses independent booleans permitting contradictory states. |
| **P11-PREP-02 — Rule dependencies/verdicts** | **STILL OPEN — MAJOR** | Provider/Team algebra and examples A–D are substantially repaired. But [reason-codes.md](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/reason-codes.md:79) requires an evaluation-level Catalog outcome that the frozen public DTO cannot carry. The catalog still permits `SERVICE_INACTIVE_OR_UNKNOWN` to be a hard error, contrary to the repaired well-formed-service rule. A structurally invalid Team also lacks a clearly applicable Team-scoped reason. |
| **P11-PREP-03 — Clock/evidence/determinism** | **STILL OPEN — MAJOR** | Capturing `evaluatedAt` before retries is **closed**. The remaining issue is evidence: `evidenceSafe` is still described rather than typed, and only the rule checksum has a concrete hash-input definition. Performance evidence compatibility and sample evaluation remain incomplete. |
| **P11-PREP-04 — Data/seed/purge** | **STILL OPEN — MAJOR, reduced scope** | Physical types, required summaries, XOR, historical references, seed identity and full-field verification are repaired. The remaining schema issue is how evaluation-country agreement is enforced. Purge validation still says “clamp / validate,” and the SQL retention expression does not explicitly encode the required elapsed-time duration. |
| **P11-PREP-05 — Batch A structure/gates** | **CLOSED** | [T007 and Batch A acceptance](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/tasks.md) now require one substantive declaration file, no empty folders/barrels/runtime stubs, T006 green, typecheck and relevant lint. The implementation prompt agrees. Closure does not authorize the batch while other majors remain. |
| **P11-PREP-06 — Traceability/preparation evidence** | **CLOSED** | [tasks.md](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/tasks.md) now maps each FR-001–034 and SC-001–010 to tasks/tests. Preparation checks are separated from runtime proof; the old CLEAN verdict is explicitly superseded. Update the resolution table after this review because four findings remain open. |
| **P11-PREP-07 — Worker IDs/privacy/logs** | **CLOSED** | [security-design.md](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/security-design.md) separates persistence, diagnostics, Browse projection and logs; explicitly prohibits Worker IDs and raw member arrays; and tasks privacy-negative tests. This is preparation closure, not runtime verification. |
| **P11-PREP-08 — Companion capture** | **CLOSED — documented graceful degradation** | [analysis-report.md](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/analysis-report.md) records the unavailable Python interpreter, Store-stub failure and skipped sanctioned writer. No lifecycle history was fabricated. Python installation is not an implementation prerequisite for this phase. |

**3. Exact remaining repairs — documentation only**

Record the following as **DEC-084 — Final P11 contract and persistence clarifications**, approved by Codex under DEC-062. These are refinements to DEC-079–082, not new phase scope.

**Repair A — Finish the dependency contracts**

Update `contracts/dependency-readers.md`, its public types, and the corresponding research/task references.

1. **Name the actual reused Catalog and Configuration methods.** The repository already provides:

   - Configuration: `createTransactionalActiveCountryReader`, `getActiveCountryById`, transaction-bound locality/time-zone readers.
   - Catalog: `createTransactionalCatalogDefinitionReaderFactory`, `getProviderOfferingReference({ serviceId, countryCode })`, and `resolveSelectableProviderOffering({ serviceCode, countryCode })`.

   Replace conditional existence statements and the generic `getDefinition` reference. Identify which result supplies each required field and where a null result becomes a business outcome.

2. **Use mutually exclusive pricing states.** Replace `usable`, `unavailable` and `conflict` booleans with a discriminated result:

   - `AVAILABLE` with required, non-null price/unit/currency/duration facts.
   - `UNAVAILABLE` with the approved owning-module business reason.
   - Technical conflicts reject with the typed error.

   Do not allow an `AVAILABLE` result with null money or simultaneous “unavailable” state.

3. **Represent missing Provider/configuration facts explicitly.** The current availability DTO requires a numeric `simultaneousTeamLimit` and a populated result even for absent configuration. Define business-result variants for unavailable facts rather than inventing zero/default values or throwing a technical error for an expected incomplete setup.

4. **Bound Team retrieval before materialization.** Add a remaining-Team budget to the availability read and an `OVERFLOW` result. Evaluate Providers in canonical order and pass the remaining portion of the 5,000-Team budget. The owning reader must query at most the budget plus one sentinel Team before hydrating the accepted Team facts.

   This must cover both one Provider with excessive Teams and multiple Providers whose combined Team count exceeds 5,000.

5. **Define state invariants for lifecycle and Team aggregates.** Document valid combinations, missing-Provider behavior, and invalid-DTO rejection. Escort fields must express existing Providers-owned Escort validity; they must not introduce a new requirement that every Team contain an Escort.

**Acceptance:** Each reachable dependency state has exactly one specified treatment: usable facts, expected business exclusion/prerequisite absence, overflow, or typed technical failure.

---

**Repair B — Add the missing evaluation outcome and finish reason semantics**

Update `contracts/eligibility-public-contract.md`, `contracts/reason-codes.md`, `spec.md` and their tests.

1. Add a required, typed **`evaluationOutcomes`** field to `DiagnosticResult` and the persisted semantic result. It must carry the Catalog outcome even when no Providers are discovered.

   **Required example:** A well-formed unavailable service and zero discovered Providers returns a successful persisted diagnostic evaluation containing the Catalog `FAIL`; it must not become indistinguishable from an available service with no supply.

2. Replace `ruleId: string` and `dependencyRuleId?: string` with the closed `EligibilityRuleId` union.

3. Remove **“hard if global”** from `SERVICE_INACTIVE_OR_UNKNOWN`. Under DEC-080:

   - Malformed service input is global validation failure.
   - A well-formed unknown/inactive/unavailable service produces the Catalog business outcome.
   - Unknown/inactive textual ancestry remains global validation failure.

4. Replace **“facts unreadable” → `NOT_EVALUATED`** with an exact distinction:

   - Expected absence, returned through a documented business-result variant, can make dependent rules `NOT_EVALUATED`.
   - Reader outage, database failure or invalid DTO fails the whole evaluation.
   - Each prerequisite skip identifies the owning failed rule; it cannot conceal a technical failure.

5. Add a Team-scoped **`TEAM_STRUCTURALLY_INVALID`** exclusion reason. Keep `NO_VALID_COMPLETE_TEAM` as a Provider summary reason when no qualifying Team structure exists. An invalid Team under an otherwise eligible Provider must have its own truthful reason.

6. Make the Batch A error declaration genuinely declaration-only. The current Markdown contains a class shape without a constructor or initialization contract. Use an **`EligibilityError` interface extending `Error`** for the public error shape; a later runtime class may implement that shape. T007 must not create a runtime placeholder.

**Acceptance:** Empty discovery, unavailable service, nonexistent explicit Provider, invalid Team, missing business facts and technical reader failure are all representable without adding undocumented fields or reasons during implementation.

---

**Repair C — Freeze replay evidence, hashes and performance comparison**

Update the public/dependency/rule-version contracts and `test-strategy.md`.

1. Define the actual TypeScript **`EligibilityEvidenceSnapshot`** schema. At minimum, give typed fields for:

   - Normalized request and captured `evaluatedAt`.
   - Pinned rule identity/content reference.
   - Country/locality applicability and zone facts.
   - Evaluation-level Catalog outcome.
   - Canonically ordered Provider lifecycle, pricing and availability results.
   - Team aggregate facts.
   - Performance evidence or explicit absence.
   - Engine/calendar identity and source versions.

   Continue prohibiting Worker IDs and raw member arrays.

2. Define the exact inputs to all three hashes:

   - `requestHash`: normalized request, including normalized discovery/explicit mode.
   - `evidenceHash`: the frozen evidence snapshot.
   - `resultHash`: evaluation outcomes, Provider/Team semantic results and the explicitly listed semantic metadata; exclude the hash fields themselves and operational IDs/timestamps.

   Define omitted versus null fields and ordering for every array used in a hash. “Canonical JSON” alone does not choose those semantics.

3. Fix performance sample ownership. The current port can return `INSUFFICIENT_SAMPLES` without receiving the pinned minimum, so it cannot authoritatively make that decision.

   **Chosen:** The port returns complete evidence or `MISSING`; technical failures reject. Eligibility checks sample count, freshness and value against the pinned bundle.

4. Define evidence policy compatibility explicitly. Pass the selected rule-version identity in the evidence request and require returned `policyVersionId` to match it. Reject incompatible evidence. Specify parameter validation: canonical decimal threshold, positive integer minimum sample count and positive integer maximum age.

5. Correct the concurrent-snapshot test expectation. A concurrent source mutation need not force a retry. Accept a successful result based entirely on one consistent snapshot; retry only recognised transaction failures. Reject mixed-snapshot results in every case.

**Acceptance:** A stored fixture can be replayed without querying live dependency state or guessing which fields enter its hashes, and performance tests can distinguish missing evidence from malformed/incompatible evidence.

---

**Repair D — Finish the persistence and purge choices**

Update `data-model.md`, `migration-plan.md`, the public purge contract and `operations-runbook.md`.

1. Replace the unspecified **“country agreement: app + check”** with this concrete relationship:

   - Rule versions have a unique `(id, countryId)` key.
   - Evaluations reference `(ruleVersionId, countryId)` through a restrictive composite FK.

   Retain application validation as an earlier error boundary.

2. Specify retention as **720 elapsed hours**. Use fixed-duration arithmetic for `expiresAt`; if expressing it in SQL, use `interval '720 hours'`. Keep the existing `< cutoff` purge boundary consistent in contract, runbook and tests.

3. Replace “clamp / validate” with **reject invalid batch sizes**: integer 1–500 only; omitted means 100.

4. Remove caller-supplied `asOf` from the production public purge options. Inject the clock through trusted composition for tests, as with evaluation. The production purge method captures its cutoff once.

5. Add the corresponding constraint, retention-boundary and invalid-option test cases to the existing mapped test files.

**Acceptance:** Batch B can implement the relationship and expiry rules directly from the plan, and purge callers cannot move the retention cutoff through ordinary options.

**4. Repair handoff and gate status**

Cursor’s next action is one bounded **docs-only repair batch**:

1. Append DEC-084 and record this re-review in a new `preparation-rereview-report.md`.
2. Apply Repairs A–D to the named artifacts.
3. Update affected test mappings and checklists.
4. Correct `analysis-report.md`: P11-PREP-01–04 remain open until repaired; P11-PREP-05–08 are closed.
5. Run documentation/whitespace checks and return the repaired contracts plus a finding-resolution table for re-review.

Keep the existing T001–T007 numbering and the accepted DEC-083 Batch A scope. **Do not restart completed repairs or redesign the phase.**

Two non-blocking documentation follow-ups may be handled in that same batch:

- Several repaired files contain `CRCRLF` line endings, producing extra blank lines and breaking Markdown table layout in some renderers. Normalize only the P11 documents being repaired.
- When Python becomes available, use the sanctioned writer’s finish operation for the analyze boundary rather than replaying a command that defaults lifecycle status to `specified`. No Python installation is required now, and no missing history should be invented.

**5. Role and authorization confirmation**

I made no repository edits, implemented no code, and performed no staging, commit, push, merge, deployment or migration.

**No human clarification is needed.** DEC-084 supplies the remaining in-scope choices under DEC-062. Batch A remains withheld because the declarations it must create still depend on the contract repairs above; this is a technical preparation gate, not a request for owner permission.
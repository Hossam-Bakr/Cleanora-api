**1. Verdict — CHANGES_REQUIRED**

P11 remains correctly activated, but **preparation is not accepted and Cursor Batch A (T001–T007) is not authorized yet**.

The artifacts preserve the intended scope: one Eligibility module, three tables, public-contract reuse, no eligibility HTTP, no P12 marketplace implementation, crew-filtered capacity, and phase plus repository validation. The Spec Kit pointer now correctly selects P11.

However, several documents restate the decisions without resolving the implementation-changing details those decisions required. The principal gaps are the executable dependency contracts, rule prerequisites and verdict aggregation, deterministic timing, and persistence invariants. T007 also proposes scaffolding that conflicts with the repository’s module conventions.

I inspected all requested artifacts, all six contracts, all four checklists, the recorded decisions, relevant existing public readers, and repository architecture conventions. The current `analysis-report.md` **CLEAN** conclusion is not supported by that review.

Validation performed:

- `git diff --check`: **exit 0**.
- `npm run docs:check`: initially failed because `tsx` attempted a sandbox-denied cache write; rerun with process-local `TSX_DISABLE_CACHE=1` returned **exit 0**, checking 14 required paths.
- That documentation command does **not** analyze P11 requirements or contract consistency; its pass does not resolve the findings below.
- No application tests, coverage or database validation were run.

**2. Findings — evidence and required remediation**

**P11-PREP-01 — MAJOR: Public and dependency contracts are not sufficiently specified**

Evidence:

- [Public contract](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/eligibility-public-contract.md:19) uses descriptive return notation rather than closed types; Provider-summary output, rule-outcome payloads, sorting facts and purge options remain unspecified.
- [Dependency readers](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:14) leaves transaction binding as “factory option or `withTransaction(tx)`.”
- The existing [P09 snapshot reader](D:/new_repos/Cleanora_R1/src/modules/providers/providers.public.ts:97) requires `catalogServiceCode`, `countryCode` and `locale`, while the proposed Eligibility request supplies IDs and no locale.
- Catalog and Configuration already expose useful transaction-bound and ID-resolution capabilities. The research document still describes their availability conditionally.

**Impact:** Cursor must choose API shapes, mappings and transaction ownership while implementing, despite preparation claiming those decisions are closed. A nominally transaction-bound adapter could still call an independently transactional service.

**Required remediation:** Freeze exact TypeScript contract definitions in Markdown, including:

- Normal versus explicit-candidate input types.
- Provider summaries, Team results, rule outcomes, sorting facts and errors.
- Public factory signatures and the transaction context passed to each participant.
- The existing ID-to-code resolution chain.
- A locale-independent Eligibility pricing projection.
- Concrete Provider lifecycle/verification and Team availability/composition DTOs.
- Performance evidence and purge input/output types.
- Existing methods reused unchanged versus genuinely new methods.

Use the binding decision under DEC-079 below.

---

**P11-PREP-02 — MAJOR: Rule dependencies and final verdict propagation are ambiguous**

Evidence:

- [Reason catalog](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/reason-codes.md:11) makes Provider evaluation depend on Catalog passing and offering evaluation depend on a “live/approved path.”
- Coverage, schedule, Team and performance prerequisites are labelled **“Prior applicable.”**
- The same document promises complete independent failures.
- Neither the public contract nor data model specifies how a failed Provider gate affects otherwise qualifying Team rows, or how one failed Team affects a Provider with another valid Team.
- [Spec acceptance scenarios](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/spec.md:57) allow disabled performance to be `NOT_EVALUATED`, while tasks require `NOT_APPLICABLE`.

**Impact:** Plausible implementations include first-failure short-circuiting, rejecting a Provider because one alternative Team fails, or returning eligible Team rows under a failed Provider performance/capacity gate.

**Required remediation:** Replace “Prior applicable” with explicit factual prerequisites and define final Provider/Team eligibility algebra. Separate exclusion reasons from informational skip diagnostics. Map every reachable owning-reader outcome into a P11 outcome or hard error.

Use DEC-080 below, and include worked examples covering multiple independent failures and mixed valid/invalid Teams.

---

**P11-PREP-03 — MAJOR: Retry timing and semantic evidence are inconsistent**

Evidence:

- [Plan transaction sequence](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/plan.md:58) captures `evaluatedAt` after opening the transaction, then retries the whole operation.
- DEC-065 requires one clock value **per invocation**.
- [Determinism test strategy](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/test-strategy.md:46) says “timestamps differ” without distinguishing semantic `evaluatedAt` from operational timestamps.
- `evidenceSafe`, canonical hashing and calendar/source provenance are labels rather than defined schemas.
- [Performance port](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/dependency-readers.md:89) lacks policy/version identity and precise evidence types.

**Impact:** A retry could cross a rule-effective or freshness boundary within one invocation. Two implementations could produce different hashes from equivalent inputs, and stored evidence may not reproduce a decision.

**Required remediation:** Define capture placement, retry semantics, canonical serialization, exact semantic hash inputs, evidence schemas, and performance freshness/compatibility checks. Separate operational time fields explicitly.

Use DEC-081 below.

---

**P11-PREP-04 — MAJOR: Data model and rule seed still defer migration-critical decisions**

Evidence:

- [Data model](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/data-model.md:15) contains alternatives such as `UUID / cuid text`, `string/int`, `text/FK`, and `enum/text`.
- [Provider-summary cardinality](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/data-model.md:93) is conditional: “when summaries are stored.” DEC-069 requires Provider summaries.
- [Cross-module references](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/data-model.md:107) defer the chosen relationship strategy until SQL review.
- No explicit `rowKind`/`teamId` consistency constraint is specified.
- [Rule bundle](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/contracts/rule-version-contract.md:12) contains `countryCodeOrId` and an unspecified effective instant.
- Its checksum excludes selection fields, while seed drift detection is described as checksum-only.
- The evaluation table omits the repository-required `created_at` field.

**Impact:** Batch B would make unresolved schema and historical-integrity choices. Seed execution could fail to detect changes to effective selection metadata, and inconsistent candidate row identities could pass the planned uniqueness checks.

**Required remediation:** Freeze physical types, nullability, mappings, FK/delete behavior, required Provider-summary cardinality, row checks, seed identity, selection metadata validation and retention bounds.

Use DEC-082 below.

---

**P11-PREP-05 — MAJOR: Batch A scaffolding conflicts with repository conventions and lacks a firm passing boundary**

Evidence:

- [T007](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/tasks.md:15) requests layer “shells,” folders and types/exports stubs.
- [Implementation prompt](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/implementation-prompt.md:5) repeats that scope.
- [Module template](D:/new_repos/Cleanora_R1/docs/architecture/module-template.md:15) prohibits empty files and one-line barrels and requires deeper folders to be justified by current complexity.
- T006 may start red, but Batch A acceptance does not explicitly require it to finish green.
- The selection guard says historical suites are excluded without defining the allowed exceptions for existing changed-seam tests.

**Impact:** Batch A could create speculative structure and be reported complete with weak or failing boundary checks.

**Required remediation:** Keep T001–T007 numbering but rewrite T007 as one substantive contract declaration file, based on the repaired contracts. Do not create empty layer folders, placeholder runtime functions or barrels. Require actual passing selection, boundary, type and relevant lint checks.

Use DEC-083 below.

---

**P11-PREP-06 — MAJOR: Traceability and preparation evidence do not justify CLEAN**

Evidence:

- [Task traceability](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/tasks.md:108) is explicitly “conceptual,” grouping many requirements under broad task ranges.
- Numerous implementation tasks name directories rather than concrete files.
- [Requirements checklist](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/checklists/requirements.md:30) defers even preparation checks until later implementation evidence.
- [Preparation checklist](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/checklists/preparation-readiness.md:32) permits the Spec Kit pointer to remain a follow-up, although pointer correctness is a prerequisite.
- [Analysis report](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/analysis-report.md:9) claims no major inconsistencies despite the findings above.

**Impact:** The handoff cannot establish that each requirement has an implementation owner and an adequate verification task.

**Required remediation:** Produce requirement-level mappings and explicit tests for the repaired contracts, concurrent changes, retry clock stability, seed drift, persistence rollback, and diagnostic privacy. Evaluate preparation checklists now; keep runtime-proof items pending. Replace CLEAN with the actual review state until repairs and reanalysis pass.

---

**P11-PREP-07 — MINOR: Privacy wording could permit Worker identifiers or excess request logging**

Evidence:

- [Security design](D:/new_repos/Cleanora_R1/specs/R1-P11-eligibility-engine-v1/security-design.md:22) combines persisted and logged request allowlists.
- Several denial lists prohibit Worker contacts but omit Worker IDs, which DEC-069 expressly prohibits persisting.
- The existing workforce public DTO contains `workerId`.

**Remediation:** Separate persistence, diagnostic output and routine log schemas. Explicitly prohibit Worker IDs throughout persisted evidence and routine logs. Use the aggregate Team projection chosen in DEC-079. This is a documentation repair now, followed by negative privacy tests during implementation.

---

**P11-PREP-08 — MINOR: Companion lifecycle capture is missing without a recorded tooling outcome**

`specs/R1-P11-eligibility-engine-v1/.spec-context.json` does not exist. The installed sanctioned writer, `.specify/extensions/companion/scripts/write-context.py`, does exist.

**Remediation:** After repaired artifacts reach the appropriate workflow boundary, invoke the sanctioned writer with the explicit P11 feature directory. Do not fabricate historical transitions. If the documented graceful-degradation condition applies, record the actual unavailable-tool result and warning; absence alone is not evidence of unavailability.

This metadata issue is not the reason implementation is withheld.

**3. Decision consistency and additional delegated decisions**

DEC-063–078 are present, uniquely numbered and attributed to Codex under DEC-062. Their high-level intent is mostly preserved, but several are not yet fully expressed in executable preparation contracts.

| Decision | Review result |
|---|---|
| DEC-063 — ownership | Ownership aligned; planned shell structure needs repair. |
| DEC-064 — order/reasons | Not fully satisfied: ambiguous prerequisites and aggregation. |
| DEC-065 — time | Interval/zone rules aligned; per-invocation retry clock unclear. |
| DEC-066 — determinism | Single-transaction intent aligned; evidence/hash/timing contract incomplete. |
| DEC-067 — versions | Immutable-version intent aligned; seed identity and drift checks incomplete. |
| DEC-068 — performance | Cold-start choice aligned; disabled outcome and evidence contract inconsistent/incomplete. |
| DEC-069 — persistence | Atomicity/retention aligned; summary cardinality, schema invariants and privacy need repair. |
| DEC-070 — internal/privacy | Zero HTTP aligned; exact safe projections need freezing. |
| DEC-071 — failures | Broad split aligned; exhaustive mappings and final-result propagation incomplete. |
| DEC-072 — Browse reuse | Aligned: composed facade and real P09/P10 integration proof required. |
| DEC-073 — reuse | Required extensions identified, but exact contracts not delivered. |
| DEC-074 — crew/capacity | Core formula aligned; Provider/Team final verdict relationship missing. |
| DEC-075 — bounds/sorting | Values aligned; exact bounded reader/result contracts incomplete. |
| DEC-076 — migration | Scope/name/proofs aligned; schema choices deferred. |
| DEC-077 — geo boundary | Aligned. |
| DEC-078 — gates | Required gate scope aligned; preparation evidence and task mapping insufficient. |

To close the remaining choices without human questions, **record DEC-079–083 as approved by Codex under delegated owner authority, DEC-062**. These refine the earlier decisions; they do not reopen phase scope.

**DEC-079 — Concrete participant and public projection design**

- Use composition-supplied **transaction-bound factories with an opaque transaction context**, matching existing repository patterns. Bound readers must not open nested or independent transactions.
- Retain ID-based Eligibility inputs. Resolve country through Configuration’s existing public reader and service identity/code through Catalog’s existing ID-based public lookup.
- Add a **locale-independent Providers eligibility pricing projection** that reuses P09’s owned selection/usability logic. Do not invent a locale merely to call a localized snapshot API, and do not duplicate price selection in Eligibility.
- Ship separate normal-discovery and explicit-Provider entry points using the same evaluator. `providerIds` is forbidden on the Browse facade. Explicit IDs are validated, deduplicated and canonically sorted before evaluation.
- Providers returns Team validity/availability outcomes plus aggregate cleaner-gender counts and Escort-validity facts. Worker IDs and raw member arrays are unnecessary at the Eligibility boundary.
- Contract methods return `Promise<SuccessDto>` and reject with the documented typed technical errors. Ordinary business exclusions remain successful diagnostic results.
- Reject alternative per-call transaction creation and raw workforce DTO forwarding because they undermine consistency and privacy.

**DEC-080 — Rule prerequisites and final eligibility**

- Evaluation order determines presentation order; it does not make every earlier `PASS` a prerequisite.
- Preconditions are **required facts**. A non-live Provider with readable price, coverage and schedule facts still receives those independent evaluations.
- Unknown/inactive textual ancestry is a global validation failure. A well-formed service identity that is unavailable is a Catalog rule failure; define its evaluation-level outcome even when discovery yields no Providers.
- Provider eligibility requires all applicable Provider gates, sufficient crew-filtered capacity and at least one qualifying Team. Disabled or missing/stale optional performance evidence does not make that predicate false.
- Final Team eligibility requires that Team to qualify **and** its Provider to qualify for the request. Provider-level capacity or performance failure therefore excludes all Team alternatives.
- One invalid Team does not exclude a Provider with sufficient other qualifying Teams.
- Disabled performance is exactly `NOT_APPLICABLE`, and the evidence port is not called. Enabled missing/stale/insufficient evidence is exactly `NOT_EVALUATED` with informational diagnostics.
- For rejected rows, record at least one real exclusion reason, including inherited Provider reasons where applicable. Informational performance diagnostics are not exclusion reasons.

**DEC-081 — Invocation clock and reproducible evidence**

- Capture `evaluatedAt` **once before the retry loop**. Reuse it across all three possible attempts.
- Each retry obtains a fresh database snapshot and reselects the effective compatible bundle against that same captured instant. Failed-attempt evidence is discarded.
- Define SHA-256 over UTF-8 canonical JSON: sorted object keys, defined array ordering, no `undefined`, UTC timestamps and canonical decimal strings.
- `evaluatedAt` is a semantic input. Only generated IDs, trace IDs, execution durations and persistence timestamps are excluded from semantic equality.
- Performance evidence contains metric identity, compatible policy/version identity, exact decimal value, sample count and observed time. Eligibility computes freshness; a dependency does not decide “stale” without the pinned policy.
- No slow external call runs inside the transaction. P11’s production gate remains disabled; enabled tests use deterministic local evidence.
- Persist normalized rule inputs and owned-reader outcomes sufficient for replay of the Eligibility decision, without replaying Providers’ private calendar implementation or retaining Worker identities.

**DEC-082 — Persistence and seed invariants**

- Use text-backed identifiers consistent with existing foreign IDs. Evaluation and candidate IDs are UUID strings; use a fixed deterministic text ID for the seeded rule bundle.
- Freeze `schemaVersion` as text and `rowKind` as the closed `PROVIDER_SUMMARY | TEAM_RESULT` enum.
- Require exactly one Provider summary for every evaluated Provider, including excluded or nonexistent explicit candidates. Team rows exist only for actual evaluated Teams.
- Enforce the `rowKind`/`teamId` XOR relationship and both partial uniqueness constraints.
- Use restrictive FKs for rule country and evaluation-to-rule references. Enforce evaluation country agreement with the selected rule.
- Provider/Team result IDs are deliberate historical logical references without live FKs: explicit nonexistent Providers and retained evaluations must remain representable. Document this specific rationale; cross-module ownership alone is not a reason to avoid FKs.
- Add required `createdAt`; store `expiresAt` as exactly 30 elapsed days after `completedAt`.
- Purge uses a fixed cutoff captured per invocation, stable `(expiresAt, id)` order, default batch size 100 and maximum 500 evaluations. It returns deleted counts and whether more expired work remains.
- Freeze the initial bundle as `r1-v1`, for configured Egypt resolved by code `EG`, effective `2026-09-09T00:00:00.000Z`.
- Seed verification compares **all immutable fields**, including country, version label and effective time. A policy-content checksum alone does not prove seed identity is unchanged.
- Classify evaluation retention as the specific DEC-069 exception for expiring eligibility diagnostic history; it does not change retention of other audit or commercial records.

**DEC-083 — Minimal Batch A and evidence requirements**

- T007 creates only substantive, approved declarations in `src/modules/eligibility/eligibility.public.ts`. No empty layer folders, export-only barrels, fake runtime implementations or “not implemented” service stubs.
- Later tasks introduce concrete service/policy/repository files when needed, using the compact repository convention.
- T006 may be red while being authored, but must pass before Batch A acceptance.
- Phase selection uses an exact allowlist of P11 suites and explicitly named existing changed-seam suites. Unrelated historical suites are excluded; approved affected tests are permitted.
- Batch A must pass selection/boundary tests, fixture compilation, typecheck and relevant lint, with actual command outcomes. Coverage scripts may exist before substantial executable coverage exists, but no coverage pass is claimed prematurely.

**4. Exact Cursor repair list before implementation**

Perform a **documentation and workflow-metadata repair batch only**, in this order:

1. **Record this review and DEC-079–083.**  
   Create `specs/R1-P11-eligibility-engine-v1/preparation-review-report.md`. Append the new decisions to `docs/product/decision-log.md`. Mark the current review state `CHANGES_REQUIRED` in the checkpoint/current pointer. Preserve PM-01 as historical evidence.

2. **Freeze the six contracts.**  
   Update all `contracts/*` documents to implement DEC-079–082. Remove unresolved alternatives such as “factory option or,” “Prior applicable,” “or equivalent documented skip,” and optional explicit-mode delivery.

3. **Align the spec and research.**  
   Update `spec.md` and `research.md` with exact Provider/Team verdict rules, disabled-performance behavior, ID resolution, locale-independent pricing and single-invocation timing.

4. **Finalize persistence and operations.**  
   Update `data-model.md`, `migration-plan.md`, `contracts/rule-version-contract.md` and `operations-runbook.md` with exact types, required summaries, constraints, seed identity, immutable-field verification and bounded purge semantics.

5. **Repair privacy and evidence contracts.**  
   Update `security-design.md` and the public/Browse contracts with separate persistence, diagnostics, projection and logging allowlists. Explicitly reject Worker IDs in persisted evidence.

6. **Rewrite plan and tasks to concrete files and tests.**  
   Update `plan.md`, `tasks.md`, `test-strategy.md` and `implementation-prompt.md`. Preserve T001–T007 IDs and revise their content under DEC-083. Add exact requirement-to-implementation-to-test mappings. Add missing tests as necessary with continuous numbering.

7. **Re-evaluate preparation checklists.**  
   Mark verified preparation facts with evidence. Leave implementation checks pending. Require a correct P11 pointer, not a follow-up note. Correct the overbroad “timestamps excluded” wording.

8. **Run and record actual preparation checks and reanalysis.**  
   Replace the current CLEAN assertion with the repaired analysis and explicit resolution references for P11-PREP-01–08. Record documentation/whitespace checks without presenting them as semantic analysis. Capture Companion state through its sanctioned writer at the appropriate boundary, or record the documented graceful-degradation evidence.

9. **Return for Codex preparation re-review.**  
   Provide the repair diff, decision additions, updated analysis, completed preparation-check evidence and revised T001–T007 prompt. **Do not start Batch A in this repair turn.**

Preparation acceptance requires closure of **all six MAJOR findings**, internally consistent exact contracts, and a verifiable Batch A boundary. The two MINOR findings can be handled in this same repair batch; no implementation or database proof is required to close them.

**5. Authorization and role confirmation**

**Cursor Batch A is withheld pending the preparation repairs and re-review.** This is a Codex technical gate decision under DEC-062, not a request for human approval. Activation remains valid, and P11 remains the sole active phase.

I implemented no code, edited no files, staged nothing, and performed no commit, push, merge, deployment or migration. All remaining in-scope choices identified in this review are resolved above under delegated authority; **do not ask the human to decide them again**.
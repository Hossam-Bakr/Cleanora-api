**1. Verdict — activation READY; preparation must pass before implementation**

R1-P11 is correctly activated and ready for Cursor to prepare its specification and implementation plan. **This is not an implementation-readiness or completion verdict.**

Repository evidence supports activation:

| Check | Evidence | Assessment |
|---|---|---|
| Correct branch and baseline | Checkout is `codex/r1-p11-eligibility-engine-v1`; HEAD is `38f3efa080a4ffd71f24fd83b2ab800662558b30`. | PASS |
| Sole active product phase | [Current phase pointer](D:/new_repos/Cleanora_R1/docs/product/current.md:14) names P11; its activation and checkpoint exist. | PASS |
| Delegated authority | [DEC-062](D:/new_repos/Cleanora_R1/docs/product/decision-log.md:2448) authorizes Codex decisions, review and completion, with Cursor implementing. | PASS |
| P10 completion | [P10 completion report](D:/new_repos/Cleanora_R1/specs/R1-P10-availability-capacity-textual-coverage/completion-report.md) records DEC-061, 301 passing phase tests, coverage and clean/upgrade migration proofs. P10 tasks have no unchecked markers; Companion records `implement/completed`, T077. | PASS |
| Canonical documentation | All seven expected repository-local product documents exist. Relevant vision rules and open questions were inspected; no existing open question blocks P11 preparation. | PASS |
| Ownership | [Entity ownership](D:/new_repos/Cleanora_R1/docs/architecture/entity-ownership.md:146) already assigns all three expected tables to `eligibility`. | PASS |
| Dependency implementations | P09 pricing, P10 operational availability, workforce facts, Catalog and Configuration contracts exist in the current working tree. | PASS, with extensions required below |
| Preservation evidence | The named temporary baseline directory exists with HEAD, branch, status, patch and untracked-path records. The inherited dirty tree remains present. | Sufficient for preparation; strengthen change attribution before writes |
| Spec Kit routing | `.specify/feature.json` still points to P10. | Must correct before P11 workflow execution |

P10’s test and migration results above are **recorded completion evidence**, not gates rerun during this review. This review performed repository reads and Git inspection only.

**2. Decisions — approved by Codex under delegated owner authority, DEC-062**

The following decisions are made now. Cursor must append them to the decision log with:

> Date: 2026-09-09. Status: Approved by Codex under delegated owner authority for R1-P11, DEC-062.

The repository’s latest decision is DEC-062. Assign **DEC-063 through DEC-078** exactly as below. Do not attribute these choices to invented human replies.

**DEC-063 — Eligibility module ownership and dependency direction**

- **Chosen:** Introduce one substantive `eligibility` module during implementation. It owns orchestration, eligibility policies, reason vocabulary, evaluation persistence and all three P11 tables. Its public entry point is `src/modules/eligibility/eligibility.public.ts`.
- Providers continues owning offering/price usability, verification and lifecycle facts, coverage, calendars, workforce validity and capacity calculations. Configuration and Catalog retain their existing ownership.
- Eligibility accesses these modules through explicit public contracts. Composition may construct adapters; Eligibility must not import their private services, repositories or Prisma models.
- **Rationale:** This follows the existing canonical ownership map and permits Browse and future Recommended to share one domain.
- **Rejected:** Providers-owned eligibility, a generic engine in `shared`, a separate deployable service, or a new Browse/Bookings module in P11.
- **Preparation consequence:** Document ownership now. No scaffold file is needed in the first batch.

**DEC-064 — Evaluation order, complete applicable reasons and candidate scope**

- **Chosen:** Validate request shape, trusted invocation and active rule version first. Then evaluate in this fixed logical order:

  1. Catalog service and country applicability.
  2. Provider approval, applicable verification and live status.
  3. Exact Provider offering and effective price usability.
  4. Textual coverage.
  5. Provider schedule, suspension and pause.
  6. Complete-Team validity and whole-interval member availability.
  7. Crew preference.
  8. Capacity after crew filtering.
  9. Configured performance gate.

- Collect **all independently evaluable failures**, in rule order, with deduplicated machine-readable reasons. Failed prerequisites make dependent rules `NOT_EVALUATED`, with a dependency reference; do not fabricate downstream failures.
- Use closed rule outcomes: `PASS`, `FAIL`, `NOT_APPLICABLE`, `NOT_EVALUATED`. Missing optional performance evidence is explicitly represented, not silently counted as a pass.
- Normal discovery reuses P10’s textual-area candidate lookup. Record that discovery scope in metadata. Providers outside that discovered scope are not claimed as individually evaluated or excluded.
- An internal explicit-candidate evaluation entry point may evaluate a bounded supplied Provider-ID set through the same pipeline, including coverage failures. It is not an HTTP API.
- **Rationale:** Complete applicable reasons support testing and diagnosis without pretending unavailable facts were evaluated.
- **Rejected:** First-failure-only behavior, “full reasons” based on invented defaults, and scanning every Provider globally to explain a local search.

**DEC-065 — UTC input, P10 zone semantics and service duration**

- **Chosen:** Require an explicit canonical UTC interval, active textual country/city identifiers, optional district, exact service identity, crew preference and positive required complete-Team units.
- Use `[startsAt, endsAt)` semantics and Configuration’s country IANA zone. Reuse DEC-053/054 calendar behavior, including DST transitions, overnight periods, civil-date exception replacement and Worker/Provider intersection.
- P11 does not interpret ambiguous local timestamps or infer a customer’s time zone.
- The requested interval must cover the selected Provider offering’s effective estimated duration. Too short is a candidate exclusion, `REQUESTED_INTERVAL_TOO_SHORT`. P11 does not calculate a quantity-adjusted Booking duration.
- Choose a V1 interval bound of **positive duration up to 24 elapsed hours**, consistent with the current P09 offering-duration maximum of 1,440 minutes. Required units are **1–50**, matching P10’s configured capacity limit.
- Capture one trusted evaluation clock value per invocation. Use it consistently for rule selection and evidence freshness; do not expose caller-controlled historical-time evaluation as a live API.
- **Rationale:** Scheduling remains owned by the proven P10 implementation, while P11 prevents a short requested interval from qualifying a longer service.
- **Rejected:** Fixed UTC offsets, new calendar arithmetic, silently shortening service duration, or date-only requests with invented times.

**DEC-066 — Consistency and deterministic-result boundaries**

- **Chosen:** One Eligibility-owned, bounded `RepeatableRead` transaction binds candidate discovery, the selected rule version, all database-backed public readers and successful evaluation persistence.
- Extend public factories so the existing P09/P10 logic can execute inside that transaction. Calling independently transactional readers in sequence is insufficient.
- The deterministic function is:

  `normalized request + pinned rule/config + captured authoritative facts + evaluation time + engine/calendar version → semantic result`

- Return metadata containing contract/engine version, rule-version ID and checksum, normalized-input hash, evidence hash, result hash, source versions where available, applied country zone, calendar runtime version, discovery scope/counts and completeness.
- Sort Provider IDs, Team IDs and reason arrays canonically. Use canonical decimal money strings; never floating-point price arithmetic or locale-dependent ordering.
- Generated evaluation IDs, trace IDs, execution duration and persistence timestamps are operational metadata outside semantic-result equality.
- Preserve safe decision evidence sufficient to reproduce the decision within retention. Hashes or existing aggregate versions alone are insufficient when they omit a relevant changed fact.
- **Rationale:** Repeated requests can legitimately change after price, schedule, membership or time changes. The reproducibility promise must identify those dependencies.
- **Rejected:** Claiming equal query text always yields equal live results, combining unrelated snapshots, using wall-clock calls inside individual rules, or promising indefinite replay of old code.

**DEC-067 — Immutable rule versions and configuration**

- **Chosen:** `eligibility_rule_versions` stores immutable, country-scoped rule bundles: schema version, engine compatibility, rule order, typed parameters, effective-from instant, content checksum and creation provenance.
- Select the latest compatible version effective at the captured evaluation time. Enforce unique country/version and country/effective-from identities; every evaluation references the exact selected row.
- Seed one deterministic V1 bundle for the configured Release 1 country. Repeated seed execution verifies identical contents; it must not overwrite changed content.
- No active/compatible version, invalid parameters or an unknown executable rule is a hard evaluation error.
- Changes require a new immutable version through the controlled seed/migration path. No rule-authoring HTTP, arbitrary expressions or dynamic code loading in P11.
- Configuration continues owning country, zone and existing pricing configuration. Eligibility records the values/versions it consumed rather than introducing duplicate sources.
- **Rationale:** This gives the expected rule-version table real behavior without introducing an administration product.
- **Rejected:** A mutable JSON singleton, caller-selected rule versions for live evaluation, or a configurable scripting language.

**DEC-068 — Performance data, freshness and cold start**

- **Chosen:** Ship the initial performance gate **disabled**. Provide a typed trusted evidence port and implement/test the enabled-gate evaluation behavior.
- An enabled bundle must specify a metric key, a minimum threshold, minimum sample count and maximum evidence age. Use a simple minimum-threshold comparison; no formula editor.
- Fresh evidence for the matching metric/policy is evaluated. Below threshold excludes with `PERFORMANCE_GATE_FAILED`.
- Missing evidence, insufficient samples or stale evidence does **not** exclude a Provider in V1. Record distinct `NOT_EVALUATED` diagnostics. Evidence is fresh through `observedAt + maxAge`; older evidence is stale.
- Malformed, future-dated or incompatible evidence is a technical integrity failure. A reader outage must not be relabelled “missing data.”
- No production metric producer, Ratings module, fake scores or historical backfill is introduced. Tests supply controlled evidence through the port.
- **Rationale:** The roadmap says performance gates apply when data exists; cold-start Providers must not fail a metric that has no authoritative producer.
- **Rejected:** Missing/stale equals zero, stale scores treated as current, silently enabling an invented rating metric, or ignoring a fresh below-threshold result.

**DEC-069 — Evaluation persistence, atomicity and retention**

- **Chosen:** Persist every successful completed application evaluation, including an empty candidate result, atomically with its Provider/Team result rows. Pure policy tests need not persist.
- Store normalized non-contact inputs, pinned rule metadata, safe evidence, ordered outcomes/reasons and sorting facts. Do not persist raw addresses, customer identity, Worker identities, contacts, verification documents or payout identifiers.
- Use typed candidate identities: one Provider summary row per evaluation/Provider, and Team result rows per evaluation/Provider/Team. Enforce separate uniqueness for Provider rows with no Team and Team rows with a Team; ordinary nullable composite uniqueness is insufficient.
- Evaluations and results are immutable while retained. Version bundles remain retained; expiry may remove only P11 evaluation records and their children.
- Choose **30 days** of evaluation/result retention from completion. Implement a bounded, idempotent Eligibility-owned purge operation and test it on disposable fixtures. Runtime scheduling is not required in P11; document the maintenance invocation and expired-record behavior.
- Persistence failure fails the application operation. Never return success with partially written or missing required evidence.
- Repeated live invocations create fresh evaluations; do not use the request hash as a unique key or replay cache.
- **Rationale:** The expected historical tables become useful, bounded records without storing unnecessary personal data.
- **Rejected:** Indefinite request retention, hash-only “replay evidence,” mutable past evaluations, or best-effort partial persistence.
- **Execution boundary:** This decision defines the lifecycle of new P11 data. It does not authorize deleting inherited or existing user data during this task.

**DEC-070 — Internal API, privacy and authorization**

- **Chosen:** P11 exposes **in-process public module contracts only**. Add no anonymous, customer, Provider, Staff or “internal-secret” eligibility HTTP endpoints.
- Composition supplies the service to approved consumers. Caller-controlled role strings, Provider IDs or an evaluation ID are not authorization credentials.
- Separate the detailed internal diagnostic result from a safe Browse-consumer projection. The projection contains eligible Provider/Team identities and allowlisted commercial/availability facts; it omits rejected-candidate diagnostics and member-level evidence.
- No historical-evaluation browsing surface is added. Any later HTTP adapter must supply its own trusted authentication/authorization and privacy policy.
- Routine evaluation emits only safe operational metadata. Rule creation/provenance must identify the controlled system operation; no invented human actor.
- **Rationale:** The current phase needs a reusable backend contract, not another exposed management product.
- **Rejected:** Public diagnostic endpoints, cross-Provider inspection privileges, or exposing internal reasons because an endpoint is labelled “internal.”

**DEC-071 — Expected exclusions versus technical failures**

- **Chosen:** Expected business failures exclude the affected candidate and allow evaluation to continue: unapproved/non-live Provider, required verification unsatisfied, unusable offering/price, coverage mismatch, closure/pause, invalid Team, crew mismatch or insufficient capacity.
- Malformed global input, missing active rule version, dependency/database failure, invalid dependency DTO, exhausted transaction conflict or persistence failure fails the **whole evaluation** with a stable typed error. Return no apparently complete partial list.
- Retry the whole transaction at most **three total attempts** for recognised retryable transaction failures. Do not retry arbitrary validation or business exclusions.
- Preserve P09’s `CONFLICT` as a technical failure, never `UNAVAILABLE`.
- A legitimate missing Provider-specific setting may exclude that Provider using the owning reader’s reason. Corrupt shared configuration is a hard failure.
- **Rationale:** Infrastructure faults must not masquerade as “no Providers available.”
- **Rejected:** Catch-all empty arrays, silent per-candidate technical drops, unlimited retries and failing the whole search for an ordinary exclusion.

**DEC-072 — Minimum honest Browse integration**

- **Chosen:** Implement an Eligibility-owned, composition-wired application facade such as `getStandardBrowseCandidates`, which calls the same evaluator and maps its successful result into the safe candidate projection.
- It performs no independent eligibility filtering and adds no HTTP, marketplace cards, ranking algorithm, pagination product or Bookings module.
- Integration tests must invoke the composed facade against real P09/P10-backed facts. A type declaration or mocked evaluator alone does not satisfy the integration requirement.
- Record the DoD interpretation explicitly: **P11 supplies and proves the Browse-use application contract; P12 mounts the marketplace consumer.**
- Preserve the existing Providers setup-readiness HTTP behavior, including its `eligibleForPublicBrowse: false` placeholder. P11 neither treats that placeholder as an exclusion nor turns setup readiness into a request-independent eligibility boolean.
- **Rationale:** This is executable reuse within DEC-062’s activation boundary.
- **Rejected:** P12 HTTP implementation, a README-only promise, or duplicating filters in a nominal Browse adapter.

**DEC-073 — Reuse and exact public-contract extensions**

- **Chosen:** Plan these additions as P11 changes in the owning modules, preserving existing contracts:

| Existing contract | Required P11 use or extension |
|---|---|
| `CatalogDefinitionReader` | Reuse service/country selection and definition truth. |
| `ProviderServiceSnapshotReader` | Reuse effective-price and offering-usability logic; add a transaction-bound path. Map `UNAVAILABLE` to an honest combined offering/price reason unless the owning module adds finer diagnostics. |
| `ProviderPublicReader` and Providers verification/readiness logic | Expose a narrow transaction-bound eligibility projection for approval, lifecycle and applicable verification, without `ownerUserId` or private evidence. |
| `ProviderOperationalAvailabilityReader` | Reuse discovery, textual matching, schedule, pause and capacity logic; add transaction binding, bounded discovery and Team-level outcomes. |
| `ProviderWorkforcePublicReader.getBookingSafeTeamFacts` | Reuse existing gender/type/`cleans` semantics; add minimal transaction-consistent Team composition facts for evaluation. |
| Configuration public readers | Reuse active locality/country, country zone and pricing configuration; expose safe version/evidence metadata where current DTOs lack it. |

- Applicable verification means the Providers-owned satisfied/not-required rule; do not require a Registered Company badge from an Individual Team.
- Reuse existing mandatory go-live/readiness policy where applicable. Do not independently add all setup-readiness booleans as new runtime filters.
- **Rationale:** The current contracts supply much of the behavior, but not the complete atomic, Team-specific projection P11 needs.
- **Rejected:** Direct foreign-table reads, private-policy imports into Eligibility, copied price selection, copied calendar rules, or declaring the existing aggregate DTO sufficient.

**DEC-074 — Crew preference and capacity after filtering**

- **Chosen:** Keep `all_male`, `all_female`, `any`. Apply gender preference to members whose valid membership has `cleans=true`.
- Non-cleaners do not determine cleaning-crew gender. Escorts must have `cleans=false`, add no capacity units and remain required to be active/available with the complete Team.
- A male Escort does not disqualify an otherwise all-female cleaning Team.
- Consume Providers-owned Team validity/availability outcomes; Eligibility applies the request’s crew preference.
- Compute qualifying capacity from **complete, available, crew-matching Teams**, capped by the Provider’s configured simultaneous-Team limit. Do not use P10’s unfiltered aggregate capacity after crew filtering.
- Return all qualifying Team alternatives with the aggregate capacity limit. Alternative rows do not imply that all alternatives can be booked simultaneously.
- **Rationale:** This preserves DEC-055 and the vision’s Escort exception while avoiding inflated capacity.
- **Rejected:** Counting Escorts as cleaners, filtering on all member genders, counting unteamed Workers or claiming unreserved inventory.

**DEC-075 — Sorting inputs and bounded work**

- **Chosen:** Return price, minimum charge, currency, price-unit identity, estimated duration, matching capacity, optional valid performance facts and stable Provider/Team IDs.
- Canonical result order is Provider ID then Team ID. Price facts are sorting inputs, not a final quote or a promise that different price units are comparable.
- Initial versioned bounds: **500 discovered/explicit Providers and 5,000 Team results per evaluation**. Use bounded owning-module reads with an overflow sentinel, not an unbounded read followed by slicing.
- Overflow produces `EVALUATION_LIMIT_EXCEEDED`; no silent truncation or misleading “complete” result.
- **Rationale:** P11 supplies stable facts and bounded operations without deciding P12 marketplace ranking.
- **Rejected:** Premium boosts, synthetic ratings, automatic cross-unit price ordering, arbitrary top-N candidate loss and unbounded fan-out.

**DEC-076 — Migration scope**

- **Chosen:** Plan one additive migration:

  `prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql`

- Add the three expected tables, necessary relations/indexes/constraints and deterministic rule seed. No production model or SQL changes occur in the preparation batch.
- Review FK/delete behavior, immutable version identity, candidate uniqueness, result/reason consistency, timestamps, expiry indexes and atomic evaluation insertion.
- Clean proof applies the complete chronological history. Upgrade proof starts from populated P10 and preserves earlier-table data and migration history.
- P10 reports 17 migrations and 93 tables; with exactly this addition, the expected result is 18 migrations and 96 tables **under the same counting convention**, verified rather than assumed.
- **Rationale:** This matches the expected ownership and incremental migration requirement.
- **Rejected:** Applied-migration edits, preloading geo tables, destructive backfills or direct SQL changes to Provider truth.

**DEC-077 — R3 extension boundary**

- **Chosen:** Keep typed rule context, versioned rule identities and an explicit place to add future evidence/rules. P11 accepts textual location only.
- Reject unsupported geographic input explicitly. No coordinates, radius, distance, geo module or dormant geographic persistence.
- **Rationale:** Extension readiness comes from clear contracts and versioning.
- **Rejected:** A parallel future engine, speculative geo scaffolding or accepting geographic fields and ignoring them.

**DEC-078 — Validation scope and automatic progression**

- **Chosen:** P11 requires phase tests/coverage **and** the repository regression gates requested in this brief. P10’s phase-only exception does not carry forward.
- Require phase coverage of at least **80% statements, 75% branches, 80% functions and 80% lines**, including new executable code and changed public/composition seams. Repository coverage must meet its configured thresholds.
- Report inherited failures separately with baseline evidence. Do not relabel a failing required command as passing or silently substitute a narrower check.
- Codex may resolve an evidenced tooling-scope issue under DEC-062, but any adjustment must be explicitly recorded before completion.
- Progress automatically after actual preparation, implementation and review gates pass. No further human decision is required for these in-scope choices.
- **Rejected:** Inheriting P10’s test waiver, checking tasks without evidence, or treating phase completion as Git/deployment authorization.

**3. Findings**

| Severity | Finding | Required disposition |
|---|---|---|
| **MAJOR — preparation tooling** | [.specify/feature.json](D:/new_repos/Cleanora_R1/.specify/feature.json) still selects P10. Unqualified workflow execution could target completed artifacts. | Align to P11 before running Spec Kit; verify resolved paths. |
| **MAJOR — implementation design gap** | Current P09 pricing and P10 availability readers open separate transactions. Existing public metadata does not establish one consistent evaluation snapshot. | Specify transaction-bound adapters and evidence coverage under DEC-066/073 before implementation. |
| **MAJOR — implementation design gap** | P10’s public evaluation exposes aggregate capacity, while P11 requires Team candidates and crew-filtered capacity. | Specify the minimal Team projection and DEC-074 acceptance examples. |
| **MINOR — stale navigation** | [docs/README.md](D:/new_repos/Cleanora_R1/docs/README.md) still describes P09 as active. | Replace only its stale live-state paragraph with a P11 pointer and appropriate dependency references. |
| **MINOR — authorization wording** | P11 activation/checkpoint shorthand suggests `commit and push` covers merge/deploy. DEC-062 and AGENTS correctly exclude them. | Correct the local role-table/shorthand wording; preserve the original owner authorization accurately. |
| **MINOR — preservation evidence** | The baseline contains an untracked-path inventory, not copies/hashes of every untracked file’s contents. | Before editing any inherited untracked file, capture its current pre-write content/hash separately. Never call that a historical activation snapshot. |
| **Validation risk, not a fresh failure** | P10’s completion report documents unrelated whole-tree lint failures. | Plan an early P11 baseline gate inventory and preserve honest command outcomes. |

**No activation blocker was found.** The major findings are prerequisites for safe preparation/implementation, not grounds to undo activation.

**4. Preparation artifact checklist — exact Cursor write set**

Use `specs/R1-P11-eligibility-engine-v1/` as the feature directory.

| Create | Required contents |
|---|---|
| `pm-preparation-report.md` | This verdict, delegated decisions, findings and gate interpretation. |
| `baseline-boundary.md` | Baseline paths/HEAD, inherited-file attribution, P11 write allowlist and pre-write preservation procedure. |
| `spec.md` | Prioritized user stories, Given/When/Then cases, FR/SC IDs, scope, DEC links, explicit Browse DoD interpretation and all resolved clarifications. |
| `research.md` | Decision/rationale/rejected-alternative records; actual reader inventory and contract gaps. |
| `plan.md` | Technical context, constitution checks with DEC-062 exception, ownership, transaction design, dependency directions, file map, bounds and gate plan. |
| `data-model.md` | Three tables, fields, cardinalities, typed result identity, constraints, version selection, expiry and deletion semantics. |
| `contracts/eligibility-public-contract.md` | Exact input/result/error types, trusted invocation, deterministic metadata and evaluation entry points. |
| `contracts/dependency-readers.md` | Existing versus proposed public signatures, transaction binding, provenance and ownership for every input. |
| `contracts/reason-codes.md` | Closed ordered rule/reason catalogs, scope, applicability, prerequisite skips and owning-reader mappings. |
| `contracts/rule-version-contract.md` | Bundle schema, bounds, checksum, effective selection, seed identity and performance evidence compatibility. |
| `contracts/browse-consumer-contract.md` | Executable facade, safe projection, no-filter-duplication rule and integration proof. |
| `contracts/http-api.md` | Explicit zero-new-HTTP decision; no OpenAPI operations or placeholder endpoints. |
| `security-design.md` | Trust boundary, DTO allowlists, diagnostics separation, logging, rule provenance and retention. |
| `migration-plan.md` | Exact migration name, SQL review checklist, deterministic seed and clean/populated-P10 proof design. |
| `test-strategy.md` | Requirement-to-test mapping, regression cases, concurrency/atomicity tests, bounds, coverage and gate matrix. |
| `operations-runbook.md` | Rule seed/version verification, failure diagnosis, retention invocation and disposable proof-target rules. |
| `quickstart.md` | Existing runnable commands versus explicitly planned additions; safe verification order. |
| `checklists/requirements.md` | Specification completeness and canonical-rule traceability. |
| `checklists/api-security.md` | Internal API, privacy, no-route and consumer-projection checks. |
| `checklists/architecture-data.md` | Ownership, transaction, determinism and migration checks. |
| `checklists/preparation-readiness.md` | Evidence required before implementation. |
| `tasks.md` | Continuous `T001…` numbering, exact paths, dependencies, user-story labels and observable acceptance. |
| `analysis-report.md` | Actual cross-artifact consistency findings and their resolution. |
| `implementation-prompt.md` | Focused Cursor handoff following the repository template; explicitly conditional on preparation acceptance. |

Update only these existing preparation/navigation files:

- `docs/product/decision-log.md` — append DEC-063–078.
- `docs/product/current.md` — record preparation progress, preserving P10 completion history.
- `docs/README.md` — repair stale live navigation.
- `.specify/feature.json` — point to `specs/R1-P11-eligibility-engine-v1`.
- `specs/R1-P11-eligibility-engine-v1/activation.md` — add this readiness confirmation and correct Git authority shorthand.
- `specs/R1-P11-eligibility-engine-v1/checkpoint.md` — decisions, findings, written artifacts and exact next gate.
- `specs/R1-P11-eligibility-engine-v1/.spec-context.json` — **create/update through the installed Companion’s sanctioned lifecycle writer**, not fabricated history or direct lifecycle-field edits.

No amendment to the product vision, open questions or global constitution is required. Cite the P11-specific DEC-062 override rather than weakening repository-wide controls.

Do not create completion reports or passing implementation/migration evidence yet. Those belong to later actual work.

**5. Next Cursor tasks — first write batch and dependency order**

The **first batch is preparation artifacts only**. Do not modify `src/`, `tests/`, `prisma/`, `package.json`, the lockfile or runtime API artifacts.

| Order | Cursor task | Acceptance condition |
|---|---|---|
| 1 | Verify branch/HEAD and capture the current pre-write boundary. Repair the Spec Kit feature pointer. | P11 resolves explicitly; inherited changes are classified and preserved; P10 files are not workflow targets. |
| 2 | Append DEC-063–078 and make the narrow navigation/authority corrections. | IDs are unique; each decision says Codex under DEC-062; no invented owner reply or merge/deploy permission. |
| 3 | Write `spec.md`, `research.md` and the public/dependency/reason contracts. | Every requested clarification has a definitive answer; discovery, crew-capacity, time, failure and privacy behavior have examples. |
| 4 | Write plan, data model, version contract, migration/security/operations/test documents and Browse contract. | Every field has an owner; every dependency has an actual or explicitly proposed public seam; atomicity and retention are testable. |
| 5 | Write checklists and dependency-ordered `tasks.md`. | Every FR/SC maps to tasks and evidence; changed inherited files have P11-specific attribution; future code tasks remain unchecked. |
| 6 | Perform Spec Kit cross-artifact analysis and write the actual analysis report. | No unresolved blocker/major, conflicting DEC interpretation, missing rule reason, unbounded operation or unsupported command claim. |
| 7 | Produce the implementation prompt and update checkpoint/Companion truthfully. | Handoff specifies the first implementation slice and required checks; lifecycle reflects preparation completed only when true. |

The later implementation order recorded in `tasks.md` should be:

1. Phase test selection and boundary fixtures.
2. Eligibility persistence, immutable rule seed and constraints.
3. Transaction-bound public dependency extensions with compatibility tests.
4. Pure rules, reason collection and crew-filtered capacity.
5. Atomic application evaluation and failure handling.
6. Composed Browse-consumer facade and real integration proof.
7. Retention operation, migration validators, full gates, Codex review and repairs.

These are future tasks to plan now, not permission to skip preparation acceptance.

**6. Acceptance conditions — preparation → implementation**

Cursor may advance under DEC-062 when all of the following are evidenced:

- P11 is the resolved product and Spec Kit feature; P10 remains completed.
- DEC-063–078 are recorded and consistently applied.
- All required preparation artifacts exist, contain substantive content and have valid references.
- No implementation-changing clarification remains unresolved.
- Every rule has a defined outcome, reason, dependency behavior and test scenario.
- The public reader plan proves one transaction and identifies every required extension. No private cross-module access is proposed.
- Determinism distinguishes live changes from replay equality and includes safe captured evidence.
- Team capacity is recomputed after crew filtering; Escort and non-cleaner examples pass on paper.
- Browse reuse is an executable application contract with a real integration-test plan.
- Migration and retention plans preserve existing data and applied migrations.
- Spec Kit analysis and Codex preparation review have no unresolved BLOCKER or MAJOR.
- No application code or schema change was smuggled into the preparation batch.

Commands discovered in [package.json](D:/new_repos/Cleanora_R1/package.json) and required in the implementation/completion gate matrix are:

```text
npm run typecheck
npm run lint
npm run build
npm run prisma:validate
npm run prisma:generate
npm run test:unit
npm run test:integration
npm run test:coverage
npm run openapi:validate
npm run postman:validate
npm run docs:check
git diff --check
```

`npm run db:validate-clean-migration` also exists. Its implementation must be inspected and extended for P11 where needed.

The following names are **planned additions, not currently available commands**:

```text
npm run test:r1-p11
npm run test:coverage:r1-p11
npm run db:validate-r1-p11-upgrade
```

Plan `vitest.r1-p11.config.ts` and the P11 validator implementation following P10 conventions. Inspect the resolved phase test selection before execution. Clean and upgrade validation must use explicit disposable P11 targets; do not reuse an unknown `.env` database or assume P10’s historical proof server still exists.

For the preparation batch, run the relevant documentation/consistency checks and `git diff --check`; inspect new untracked Markdown as well, because ordinary Git diff checks do not cover its contents. Runtime, coverage and live migration results must remain labelled **pending implementation**, not passed.

**7. Do not implement / do not ask human — confirmation**

I made no edits, created no branch, implemented no code, ran no migration, and performed no staging, commit, push, merge or deployment.

All in-scope clarification choices above are **Codex decisions under DEC-062**. Cursor should record and apply them without asking the human to choose again. The next authorized action is the **docs-only preparation batch**, followed by evidence-based preparation acceptance and automatic progression within P11.
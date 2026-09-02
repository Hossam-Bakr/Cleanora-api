# Cursor Prompt — Prepare R1-P08 Through the `speckit-implement` Stop Gate

Copy the prompt below into an interactive Cursor Agent session. When using the
background `cursor-delegate` relay, follow the resume rule in the prompt: the
delegate must stop at each material owner question, and a new delta brief may
resume the same Cursor session only after the owner answers.

```xml
<task>
Prepare the active Cleanora phase R1-P08 — Catalog, Localization & Service
Requirements — through the complete pre-implementation Spec Kit workflow.

Execute the workflow in this order:

1. speckit-specify
2. speckit-clarify, interactively and one owner question at a time
3. speckit-plan
4. focused speckit-checklist runs
5. speckit-tasks
6. read-only speckit-analyze, followed by authorized artifact-only remediation
   and repeat analysis until CLEAN
7. final readiness validation and handoff

The terminal state is immediately BEFORE speckit-implement. Do NOT execute
speckit-implement, speckit-converge, Companion after-implement, any product
implementation, or any task from tasks.md. Finish with Companion at
currentStep=tasks and status=ready-to-implement, and report that the exact next
command is speckit-implement but remains unexecuted and separately gated.

Use this exact feature directory and preserve its existing activation record:
specs/R1-P08-catalog-localization-service-requirements

There is currently no R1-P08 spec.md. Creating and validating it is the first
workflow step. Do not generate a different numbered or timestamped feature
directory.
</task>

<authority_and_stop_gate>
The human owner authorizes only R1-P08 pre-implementation documentation and
Spec Kit preparation through the ready-to-implement handoff.

Authorized writes are limited to:

- the active R1-P08 feature directory;
- .specify/feature.json pointing to that exact directory;
- R1-P08 .spec-context.json and mandatory Companion preparation history;
- narrowly necessary canonical product-document reconciliation for owner-
  approved clarification answers;
- a focused R1-P08 implementation prompt that remains unexecuted.

Explicitly unauthorized:

- speckit-implement or any implementation/convergence task;
- src/, tests/, prisma/schema.prisma, prisma/migrations/, seeds, runtime API or
  Postman implementation changes;
- any database connection, inspection, migration, reset, seed, proof cluster,
  or environment-secret operation;
- Any additional Git branch creation or switching, git add, commit, push,
  merge, force-push,
  history rewriting, stash, reset, checkout/restore, clean, or deletion;
- Docker, cloud, deployment, production configuration, or production migration;
- R1-P09 or later-phase preparation or behavior.

Stop immediately and request owner direction if correct preparation would
require any action outside this boundary.
</authority_and_stop_gate>

<required_context>
Read in this order and use repository-local files as authority:

1. AGENTS.md
2. docs/ai/context-router.md
3. docs/product/current.md
4. specs/R1-P08-catalog-localization-service-requirements/activation.md
5. only the R1-P08 section of docs/product/roadmap.md
6. docs/product/vision.md section 6, Catalog and localization
7. only R1-P08-relevant entries in docs/product/decision-log.md and
   docs/product/open-questions.md, especially OQ-002
8. docs/architecture/entity-ownership.md R1-P08 ownership rows
9. .specify/memory/constitution.md
10. docs/ai/spec-kit-integration.md,
    docs/ai/decision-question-format.md, and
    docs/ai/workflows/prepare-phase.md
11. .specify/extensions.yml and the exact repository-local Spec Kit skills
    needed for the current step

Load further rules or prior artifacts only when a concrete R1-P08 dependency
requires them. Do not preload future-phase specifications or another repository.
Never treat R1-P07 artifacts as R1-P08 product authority; they may be consulted
only for repository conventions or existing public-contract facts.
</required_context>

<locked_product_baseline>
Preserve these owner-approved facts and do not reopen or silently expand them:

- The platform owns the service catalog.
- Categories contain services.
- Catalog names and descriptions support Arabic and English.
- R1-P08 covers categories/services, localized names/descriptions, configurable
  price units, service requirements and booking fields, service media, display
  order, country availability, active/inactive state, an Egypt housekeeping
  seed, Admin CRUD, and snapshot-ready catalog data.
- The Catalog module owns service_categories, services, service_translations,
  service_price_units, service_fields, service_field_options, and
  service_country_availability.
- Media owns media_files and its upload/processing/storage/delivery lifecycle.
  Catalog may consume only an explicit Media public contract and must not query
  or mutate Media persistence directly.
- Authentication owns identities, roles, permissions, sessions, step-up/recent
  proof, and capability facts. Admin owns business-neutral privileged audit.
- Provider offerings and provider-owned prices are R1-P09, not R1-P08.
- Booking selection and confirmed booking snapshots are later-phase behavior.
  R1-P08 defines snapshot-ready catalog facts/contracts only.
- Launch is Egypt-only, but country-sensitive behavior uses countryCode and
  business rules must not hard-code Egypt.
- OQ-002 remains unresolved. The specification may support configurable service
  notes and requirements but must not enforce a universal rule about whether
  cleaning materials are provider-supplied or customer-supplied.
- R1-P08 Done When: catalog management does not require deployment; localized
  content is complete; disabled services cannot be selected; country and
  price-unit rules are validated.
</locked_product_baseline>

<worktree_preservation>
Begin by capturing git status --short --branch as a read-only baseline. The
worktree is intentionally dirty. It includes activation changes, an unrelated
tracked R1-P06 meeting-guide DOCX, and pre-existing untracked UX/Postman assets.

Do not stop merely because the worktree is dirty, and do not modify, stage,
move, delete, regenerate, format, or absorb unrelated files. At every major
checkpoint, compare the current status with the baseline and investigate any
unexpected path before continuing. Never use a cleanup command to make the
status easier to read.

The checked-out branch is
r1-p08-catalog-localization-service-requirements. Stay on this branch; do not
create or switch to any other branch.
</worktree_preservation>

<workflow>
Step 0 — Preflight

- Confirm docs/product/current.md names R1-P08 as the sole active phase.
- Confirm activation.md exists and no R1-P08 spec.md, plan.md, or tasks.md
  exists before the workflow begins.
- Confirm .specify/feature.json still points to the completed R1-P07 directory;
  this is expected before R1-P08 specify and must be replaced only by the
  official specify workflow.
- Read .specify/extensions.yml. Mandatory Companion after-specify, after-plan,
  and after-tasks hooks must actually execute and be verified; emitting an
  EXECUTE_COMMAND marker is not evidence that the hook ran.
- Do not initialize or replace .specify/, and do not hand-create generated
  internals that the official Spec Kit workflow owns.

Step 1 — Specify

- Run speckit-specify for the exact feature directory
  specs/R1-P08-catalog-localization-service-requirements.
- Use the locked product baseline above as the feature description.
- Preserve activation.md.
- Produce a technology-agnostic spec.md focused on actors, user value, behavior,
  requirements, edge cases, failure semantics, and measurable success criteria.
- Create and fully validate checklists/requirements.md.
- Use stable FR-### and SC-### identifiers and make every item testable.
- Keep at most three genuine NEEDS CLARIFICATION markers. Do not hide a material
  product choice as an assumption or technical detail.
- Update .specify/feature.json to the exact R1-P08 directory.
- Execute the mandatory Companion after-specify hook and verify R1-P08
  .spec-context.json records currentStep=specify and status=specified.

Step 2 — Clarify

- Run speckit-clarify only after specify validation passes.
- Ask exactly one material owner question at a time, in the owner's current
  language, with two to four mutually exclusive numbered options and the
  reasoned recommendation after the options, following
  docs/ai/decision-question-format.md.
- Wait for the answer. Persist the accepted decision immediately, reconcile all
  conflicting wording, and rerun the relevant spec/checklist validation before
  asking the next question.
- Never reveal a future question queue during the formal session.
- Ask no more than five questions per formal clarification session. If further
  material blockers remain, end that session cleanly and start another only
  after reporting why it is necessary.
- Never let an AI agent answer on behalf of the human owner.

Prioritize only decisions that materially affect behavior, including where
still unresolved: localized-content completeness/fallback, catalog lifecycle
and deletion/history, exact Admin authority/audit/reason rules, service-field
types and validation/option behavior, price-unit governance, Egypt seed truth,
media attachment semantics, consumer/read contracts, and snapshot-ready data.
Do not ask about implementation details that the technical plan can decide.

Do not proceed to planning while any material product ambiguity, unresolved
NEEDS CLARIFICATION marker, or canonical contradiction remains.

Step 3 — Plan

- Run speckit-plan after clarification is complete.
- Produce plan.md plus the smallest complete set of research, data-model,
  contracts, authorization/audit, migration, security/privacy, test-strategy,
  quickstart/operations, and implementation-prompt artifacts required by the
  phase.
- Define the Catalog modular-monolith boundary, public contracts, dependency
  direction, transaction ownership, failure modes, concurrency/idempotency,
  authorization, privileged audit, localization behavior, media interaction,
  downstream snapshot contract, and test strategy explicitly.
- Plan an incremental forward-only Prisma migration named
  r1_p08_catalog_localization_service_requirements unless a repository naming
  constraint proves a different name is required. Do not edit Prisma or create
  the migration during planning.
- Separate Catalog-owned persistence from Media-, Authentication-, Admin-,
  Configuration-, Providers-, Eligibility-, and Bookings-owned behavior.
- Keep provider offerings/prices, bookings, orders, frontend applications,
  Docker/cloud, deployment, and production work out of scope.
- Create the focused implementation prompt from
  docs/ai/templates/implementation-prompt.md, but do not execute it.
- Run the Constitution Check before and after design.
- Execute the mandatory Companion after-plan hook and verify
  currentStep=plan and status=planned.

Step 4 — Focused checklists

- Run speckit-checklist as many times as needed to create focused requirement-
  quality checklists, not implementation test results.
- At minimum cover:
  1. scope, localization, country, and catalog lifecycle;
  2. authorization, privileged audit, privacy, and Media boundaries;
  3. data model, migration, seed, concurrency, and snapshot compatibility;
  4. API/contract, service-field/price-unit, UX, errors, and observability;
  5. testability, traceability, and forbidden future-phase scope.
- Resolve every incomplete checklist item in the artifacts or report a true
  owner blocker. Do not mark an item complete without evidence.

Step 5 — Tasks

- Run speckit-tasks only after the plan and focused checklists are complete.
- Generate one continuous, dependency-ordered task list with unique T### IDs,
  exact file paths, user-story phases, independent test criteria, and explicit
  requirement references.
- Cleanora requires implementation tests and evidence tasks; do not treat tests
  as optional. Include unit, contract, integration, migration/seed, security,
  authorization/audit, localization, concurrency/idempotency, error/redaction,
  phase-scoped coverage, full-repository gates, documentation, Postman/OpenAPI
  where applicable, and final handoff evidence.
- Map every FR and every build-verifiable SC to at least one implementation,
  test, or evidence task. Do not create orphan tasks.
- Include explicit tasks for schema design, the phase-owned migration, SQL
  review, clean chronological installation, populated previous-phase upgrade,
  double-seed idempotency, and live constraints, but do not execute them now.
- Execute the mandatory Companion after-tasks hook and verify
  currentStep=tasks and status=ready-to-implement.

Step 6 — Analyze and remediate

- Run speckit-analyze strictly read-only after tasks.md exists.
- Report all findings, coverage metrics, unmapped requirements/tasks, and
  Constitution issues. Do not misrepresent a report as a completed remediation.
- This prompt authorizes artifact-only remediation for findings that clearly
  reconcile already approved scope and do not choose new product behavior.
- If a finding needs a product decision, return to the one-question owner
  format and wait. Do not invent the answer.
- After authorized artifact remediation, rerun all affected checklist and task
  validation, rerun the mandatory tasks Companion capture if tasks changed,
  and rerun speckit-analyze.
- Continue until the final report is CLEAN: zero CRITICAL/HIGH actionable
  findings, no unresolved material ambiguity or contradiction, no Constitution
  conflict, 100% FR/SC traceability, and no orphan task.

Step 7 — Final readiness validation

- Run npm run docs:check and git diff --check. Fix only issues caused by R1-P08
  preparation.
- Validate every generated JSON, YAML, and design OpenAPI artifact with the
  repository-appropriate parser or validator without changing product code.
- Recheck the worktree against the captured baseline and list every intended
  R1-P08/canonical file touched and every preserved unrelated path group.
- Verify .specify/feature.json points to R1-P08.
- Verify R1-P08 .spec-context.json ends at currentStep=tasks and
  status=ready-to-implement.
- Verify no source, test, Prisma, migration, seed, database, additional branch,
  staging, commit, push, merge, deployment, or production action occurred.
- Update the R1-P08 activation/current-phase preparation status only to reflect
  evidence actually completed. Do not mark the phase implemented or Complete.
</workflow>

<cursor_delegate_mode>
If this prompt is dispatched through the headless cursor-delegate relay, Cursor
cannot obtain live human clarification answers during one run. At the first
material owner question, stop cleanly without guessing, return the exact single
question in the required format, identify the Cursor session ID, and leave all
validated work uncommitted. After the owner answers, resume that exact session
with a delta brief containing only the approved answer and instruction to
persist/validate it and continue until the next decision or stop gate.

Do not attempt to complete the entire interactive clarification loop in one
headless run by selecting recommended answers yourself.
</cursor_delegate_mode>

<verification_loop>
Before the final report, run and make green:

- npm run docs:check
- git diff --check
- all artifact-specific JSON/YAML/OpenAPI validation required by the generated
  plan/contracts

Do not run implementation, test, build, Prisma, migration, seed, or database
commands merely to claim pre-implementation readiness. If a planning artifact
defines future commands, record them as future tasks rather than executing them.
</verification_loop>

<action_safety>
Keep all changes scoped to R1-P08 preparation and narrowly necessary canonical
reconciliation. Preserve the intentionally dirty worktree. No unrelated
refactors, renames, formatting, cleanup, or generated asset changes.

Stay on r1-p08-catalog-localization-service-requirements. Do NOT run git add,
commit, push, merge, create or switch another branch, stash, reset, restore,
checkout, or clean. Leave all intended preparation changes unstaged and
uncommitted for Codex and human-owner review.
</action_safety>

<structured_output_contract>
End with a report in this exact shape:

1. Final workflow state and explicit statement that speckit-implement was NOT run
2. Owner decisions accepted, with canonical locations
3. Artifacts created or changed, grouped by specify/clarify/plan/checklist/tasks
4. FR count, SC count, user-story count, task count, checklist totals, and
   requirement-to-task coverage
5. Final speckit-analyze result and all remaining findings, if any
6. Companion and .specify/feature.json state
7. Validation commands with exact exit results and artifact counts
8. Intended files touched and unrelated dirty-worktree assets preserved
9. Blockers, deviations, defensible-but-unasked design decisions, and minor notes
10. Exact next command: speckit-implement — unexecuted and awaiting separate
    human-owner authorization

Do not claim READY_TO_IMPLEMENT unless every required artifact, decision,
checklist, traceability, Companion, validation, and CLEAN-analysis gate above is
actually satisfied.
</structured_output_contract>
```

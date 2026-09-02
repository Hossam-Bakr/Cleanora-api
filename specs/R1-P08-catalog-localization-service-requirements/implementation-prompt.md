# Cursor Auto Implementation Prompt — R1-P08

<task>
Implement the active Cleanora phase
`R1-P08 — Catalog, Localization & Service Requirements` by executing
`/speckit-implement` against the frozen, analyzed-clean task list
`specs/R1-P08-catalog-localization-service-requirements/tasks.md`.

The current branch is
`r1-p08-catalog-localization-service-requirements`. Specification,
clarification, planning, checklists, tasks, and cross-artifact analysis are
complete. The planning gate is CLEAN: 64/64 requirements map to 156/156
continuous tasks, all 113 checklist items pass, and the design OpenAPI validates
with 12 protected-management paths and 16 protected operations.

Execute the implementation in task/dependency order, tests first within each
story, and mark only genuinely completed tasks `[X]`. Work through every
implementation and safe validation task that can be completed from the current
repository state. Do not reinterpret or expand the frozen product behavior.
</task>

<required_context>
Read and obey, in this order:

1. `AGENTS.md`
2. `docs/ai/context-router.md`
3. `docs/product/current.md`
4. `.specify/memory/constitution.md`
5. `specs/R1-P08-catalog-localization-service-requirements/spec.md`
6. `specs/R1-P08-catalog-localization-service-requirements/plan.md`
7. `specs/R1-P08-catalog-localization-service-requirements/tasks.md`
8. The R1-P08 `research.md`, `data-model.md`,
   `authorization-matrix.md`, `migration-plan.md`, `test-strategy.md`,
   `quickstart.md`, `contracts/`, and `checklists/`.

Treat DEC-041 through DEC-044 as approved owner decisions. Preserve OQ-002
neutrality.
</required_context>

<frozen_product_decisions>
- Incomplete localized records may be saved only while inactive. Activation and
  selectability require complete Arabic and English content. Exact-locale reads
  never fall back.
- Release 1 supports exactly six field kinds: `INFORMATION`, `TEXT`,
  `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, and `MULTI_SELECT`, with only the
  constraints specified in DEC-042 and the phase artifacts.
- Only an active `staff_admin` receives
  `catalog.management.read` and `catalog.management.write`; every privileged
  write requires the approved reason and atomic Admin-owned audit evidence.
- The seed is the minimal complete Egypt housekeeping catalog in DEC-044. The
  bedroom and bathroom number fields are optional non-negative integers with no
  invented maximum.
- A service may have zero active fields; if fields exist, their full graph must
  be valid. It still requires at least one active price unit to become
  selectable.
- Full service-configuration replacement retains omitted stable units, fields,
  and options as inactive, makes omitted countries unavailable, and preserves
  translation locale identities with nullable draft content. It never
  hard-deletes those stable child identities. Removing a Catalog-owned
  service-media association remains the explicit non-identity exception and
  never deletes the Media-owned file.
- R1-P08 exposes protected staff-management HTTP only. Selectable list/current
  definition access is the composition-injected module contract
  `CatalogDefinitionReader`. Do not create or document any anonymous or
  customer `/api/v1/catalog/services*` route. R1-P12 owns Browse HTTP.
</frozen_product_decisions>

<architecture_and_scope>
- Keep one deployable TypeScript/Express/Prisma/PostgreSQL modular monolith.
- Catalog owns Catalog behavior, its nine planned tables, aggregate transaction,
  versioning, idempotency, and service-media association/order.
- Authentication owns principals, permissions, protected operations, and
  privileged-reason truth; Configuration owns countries; Media owns files and
  delivery; Admin owns audit records.
- Use only named module-public seams. Do not import another module's internal
  repository, controller, Prisma adapter, raw model, or transaction internals.
- Add exactly one forward-only phase migration after R1-P07 and never edit an
  applied migration.
- Do not add Provider offerings/prices, eligibility, Browse HTTP, Booking,
  customer answers, snapshots/history ownership, notifications, frontend,
  Docker/Testcontainers, cloud, deployment, production configuration, or
  production migration.
- Do not introduce a new event bus, cache, worker, microservice boundary,
  environment secret, generic business shared layer, or speculative
  abstraction.
</architecture_and_scope>

<execution_contract>
- Follow `tasks.md` phase-by-phase: Setup, Foundation, US1, US2, US3, US4,
  US5, then cross-cutting validation.
- Use TDD where the task list says tests first. Make each story checkpoint green
  before moving forward.
- Reuse established R1-P07 repository patterns only where they match the frozen
  R1-P08 design; do not copy future behavior or duplicate large systems.
- Keep controllers thin, domain/policy code framework-neutral, repository access
  Catalog-owned, and transaction ownership explicit.
- Update runtime OpenAPI, generated R1-P08 Postman collection, Zod schemas,
  documentation, migration review, and implementation evidence as their tasks
  require.
- Preserve strict error/redaction, safe audit allowlists, durable idempotency,
  deterministic lock/order behavior, one-snapshot reader semantics, and Media
  compensation paths.
- Report progress by task/checkpoint. Mark a checkbox only when its required
  code, test, and evidence actually exist and any required gate has run.
</execution_contract>

<database_safety>
No isolated R1-P08 PostgreSQL target is approved in this dispatch.

- Do not connect to or inspect the repository `.env` database, the historical
  `Cleanora` database, an unknown target, or production.
- Do not reset, drop, clean, migrate, seed, or run DB-coupled integration tests
  against any unapproved target.
- A future proof target must be explicitly approved and match:
  `^cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$`.
- Implement and unit-test the guarded migration/upgrade validation machinery,
  but leave T144–T146 and any database-coupled gate unchecked with an explicit
  blocker until the human approves exact disposable targets.
- If any other task requires a live database to be truthful, leave only that
  evidence portion unchecked and report the exact command/target needed. Do not
  substitute mocks for required live PostgreSQL proof.
</database_safety>

<role_and_completion_boundaries>
- Cursor Auto implements; Codex independently reviews and verifies.
- Do not perform or mark T153/T154 as the independent Codex architecture and
  security verdict.
- Do not perform or mark T155 as the independent Cursor Claude review from this
  implementation session.
- Do not mark T156 complete, do not set the phase to Complete, and do not run
  the terminal Companion completion step. Human-owner completion approval is
  still required.
- You may update implementation-progress evidence truthfully, but never claim
  gates or task completion that did not occur.
- If a new material product decision is required, stop at that task and report
  one concise blocker. Do not invent the answer.
</role_and_completion_boundaries>

<dirty_worktree_and_action_safety>
The repository was intentionally dirty before dispatch. Preserve all existing
work. Do not stage, commit, push, merge, switch branches, stash, reset, restore,
clean, rewrite history, deploy, or perform a destructive action.

Do not touch these unrelated paths:

- `docs/meeting-guides/Cleanora-R1-P06-API-Meeting-Guide-AR.docx`
- `.mcp.json`
- existing untracked directories under `docs/design/r1-p05/`,
  `docs/design/r1-p06/`, and `docs/design/r1-p07/`
- existing untracked P05/P06 meeting-guide DOCX files
- `postman/.postman/` and `postman/postman/`

R1-P08 may add only its canonical generated Postman artifact directly under
`postman/`. Do not modify unrelated phase artifacts while generating it.
Keep all work uncommitted for Codex review.
</dirty_worktree_and_action_safety>

<verification_loop>
Use `npm.cmd` on this Windows host. Run, fix, and report the safe gates that do
not require an unapproved live database:

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run openapi:validate
npm.cmd run postman:validate
npm.cmd run docs:check
npm.cmd run test:unit
npm.cmd run test:r1-p08
npm.cmd run test:coverage:r1-p08
npm.cmd audit --audit-level=high
git diff --check
```

Run `npm.cmd run test:integration`, `npm.cmd run test:coverage`, migration,
seed, or upgrade commands only if they provably do not access a live database
or an exact target has been separately approved. Otherwise record them as
blocked, not passed.

Before finishing, inspect `git status --short`, `git diff`, and every new
untracked R1-P08 file. Confirm no test is skipped/todo/quarantined and no
assertion was weakened to make a gate pass.
</verification_loop>

<structured_output_contract>
End with this exact report structure:

1. Completed task ranges and story checkpoints.
2. What changed and why, grouped by module/API/schema/tests/docs.
3. Every file touched or created.
4. Exact gate commands, exits, test counts, and coverage percentages.
5. Tasks left unchecked, each with the precise blocker.
6. Any design turn, deviation, assumption, or owner decision needed.
7. Confirmation that no Git publication, destructive, database, production,
   deployment, frontend, Docker, or cloud action occurred.
</structured_output_contract>

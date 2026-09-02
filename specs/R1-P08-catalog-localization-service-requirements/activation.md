# R1-P08 Activation — Catalog, Localization & Service Requirements

**Activated:** 2026-08-30
**Authorized by:** Human product owner in the active Codex task
**Status:** **Active — specification, clarification, and technical plan complete; checklists/tasks in progress**
**Feature directory:** `specs/R1-P08-catalog-localization-service-requirements`
**Feature branch:** `r1-p08-catalog-localization-service-requirements`

## Activation evidence

- R1-P08 depends on R1-P01 and R1-P03. Both are Complete by recorded
  human-owner approvals and closure evidence.
- R1-P07 is Complete: its completion report records T001–T156, all required
  evidence gates, explicit human-owner completion, and no unresolved BLOCKER
  or MAJOR finding.
- Immediately before activation, `docs/product/current.md` recorded no active
  phase. No R1-P08 branch, feature directory, Spec Kit feature pointer,
  specification, plan, task list, contracts, Prisma migration, or code existed.
- The checked-out `main` commit is `c187aa4`; its local `origin/main` tracking
  ref matches it.
- `npm run docs:check` passed with `{"ok":true,"checked":13}` during the
  readiness review.
- The worktree is intentionally dirty with one unrelated tracked R1-P06 meeting
  guide and existing untracked UX/Postman assets. Activation preserved every
  existing item: nothing was reverted, reset, staged, committed, pushed,
  removed, or overwritten.
- R1-P08 is now the sole active roadmap phase.

## Exact authorization

The human message was:

```text
activate it
```

It follows the readiness report's proposed instruction to activate R1-P08 for
specification preparation only. For this activation record, the authorization
is applied narrowly to:

1. Record R1-P08 as the sole active phase in the repository-local phase
   pointer.
2. Reconcile stale repository-local phase-pointer wording in `docs/README.md`
   and the R1-P07 historical closure note.
3. Create this activation evidence record.

The initial activation alone did not authorize a phase branch,
`.specify/feature.json` change, Companion lifecycle capture, specification,
clarification, plan, tasks, checklist, implementation prompt, product code,
test, schema, migration, seed, database operation, staging, commit, push,
merge, deployment, or production operation.

## Expanded preparation and implementation authorization — 2026-08-30

The human owner subsequently instructed Codex to:

1. create a dedicated R1-P08 feature branch;
2. act as project manager and planner, understand the existing project logic,
   and avoid over-engineering;
3. run the Spec Kit preparation workflow through specification,
   clarification, technical planning, checklists, tasks, and analysis;
4. use Cursor as the bounded writer/implementer for reviewed R1-P08 tasks;
5. have Codex independently review Cursor's changes and quality evidence.

This expanded authorization created
`r1-p08-catalog-localization-service-requirements` from `c187aa4` while
preserving the intentionally dirty worktree. Product decisions remain with the
human owner and must be asked one at a time. Cursor may implement only frozen,
reviewed R1-P08 tasks; Codex remains responsible for architecture, scope,
review, and gates.

The expanded authorization does not authorize staging, commit, push, merge,
deployment, production configuration or migration, destructive cleanup,
phase completion, or future-phase work. The exact message `commit and push`
remains the only authorization for the guarded Git publication workflow.

## Approved product baseline

- The platform owns the service catalog. Categories contain services; catalog
  names and descriptions support Arabic and English.
- R1-P08 scope is categories and services, localized names/descriptions, price
  units, service requirements and booking fields, service media, display order,
  country availability, active/inactive status, the Egypt housekeeping seed,
  Admin CRUD, and snapshot-ready catalog data.
- The R1-P08 creating tables are `service_categories`, `services`,
  `service_translations`, `service_price_units`, `service_fields`,
  `service_field_options`, and `service_country_availability`. `media_files`
  remains Media-owned; Catalog must use an explicit Media public contract.
- The Catalog module owns the R1-P08 business records. Provider offerings and
  provider prices are deferred to R1-P09; booking selection and booking
  snapshots are deferred to R1-P13.
- Launch is Egypt-only, but country-sensitive behavior must use `countryCode`;
  business code must not hard-code Egypt.
- R1-P08 Done When is that the catalog is manageable without deployment,
  localized content is complete, disabled services cannot be selected, and
  country and price-unit rules are validated.

## Open-question boundary

OQ-002 remains unresolved: whether cleaning materials are provider-supplied or
customer-supplied per service. It is not permission to invent a policy. Any
later R1-P08 specification may store configurable service notes and
requirements but must not enforce a universal materials-supply rule until the
owner approves one.

## Current workflow gate

The expanded authorization above supersedes the earlier preparation-only stop
points. The current authorized workflow is specification, sequential owner
clarification, technical planning, focused checklists, tasks, analysis, and
then bounded Cursor implementation from the reviewed task contract. It does
not authorize Cursor to choose owner product behavior or begin from an
unresolved draft.

As of 2026-08-30:

- `speckit-specify` produced the draft specification and requirements
  checklist, and `.specify/feature.json` points to this phase;
- the `speckit-clarify` prerequisite resolves to this phase and the canonical
  authority audit is complete;
- the human owner approved strict Arabic/English completeness before activation
  or selectability with no cross-locale fallback, now recorded in DEC-041;
- the human owner approved the closed six-kind Release 1 service-field model,
  now recorded in DEC-042;
- the human owner approved active-`staff_admin`-only protected Catalog
  management, now recorded in DEC-043;
- the human owner approved the minimal complete selectable Egypt housekeeping
  seed, now recorded in DEC-044;
- all four material owner decisions are resolved, the requirements checklist is
  fully passing, and the specification is in technical planning;
- the mandatory Companion after-specify capture records `currentStep=specify`
  and `status=specified`;
- `speckit-plan` produced the validated plan, research, data model,
  authorization/migration/test designs, quickstart, and three contracts;
- Companion records `currentStep=plan` and `status=planned`;
- focused checklists, `speckit-tasks`, `speckit-analyze`, and
  `speckit-implement` have not run; and
- no implementation command has run.

Planning cannot select a product answer for an unresolved marker. After the
owner answers each question, Codex must persist and validate it before asking
the next question. Any phase-owned schema change still requires the approved
forward-only R1-P08 migration and an explicitly authorized disposable
validation target for database proof.

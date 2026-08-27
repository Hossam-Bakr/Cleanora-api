# R1-P07 Activation — Worker, Team & Crew Management

**Activated:** 2026-08-22
**Authorized by:** Human product owner in the active Codex task
**Status:** **Completed 2026-08-24 — this file preserves the original activation scope; later owner authorization completed implementation and closure**
**Feature directory:** `specs/R1-P07-worker-team-crew-management`

## Activation evidence

- R1-P06 is Complete by explicit human-owner approval and is merged into
  `origin/main` through PR #6 at
  `5d466f09ba1b61ad2a840ee4c5fe54e4663e2764`.
- `docs/product/current.md` recorded `Current Phase = None` immediately before
  this activation.
- No R1-P07 branch, feature directory, specification, plan, or tasks existed
  before this run.
- DEC-038 records 27 approved Worker and Team product decisions, and the
  preparation handoff reports no known remaining material product question.
- `docs/product/open-questions.md` contains no unresolved R1-P07 blocker.
- The worktree was intentionally preserved while dirty. It contained the
  previously authorized decision-question/DEC-038 documentation changes and 36
  pre-existing untracked files; none was reverted, reset, reformatted, staged,
  or overwritten by activation.
- R1-P07 is now the sole active roadmap phase.

## Exact authorization

The human message was:

```text
ACTIVATE R1-P07 AND RUN SPECKIT SPECIFY ONLY
```

It authorizes only:

1. Canonical reconciliation required to record R1-P07 as active.
2. Creation of this activation artifact.
3. Creation and specification-stage validation of `spec.md`.
4. Creation and validation of `checklists/requirements.md`.
5. Updating `.specify/feature.json` to this exact feature directory.
6. Running the mandatory SpecKit Companion `after_specify` hook.
7. Reporting the specify-only result and stopping.

## Expanded pre-implementation authorization

The owner subsequently instructed Codex to create a new phase branch, use the
specification-driven workflow, and continue until the next step is
`speckit-implement`. The approved execution plan authorizes:

1. Creation of `r1-p07-worker-team-crew-management` from the current
   `origin/main` file tree while preserving all local changes.
2. One clarification session that persists the five already approved decisions
   in DEC-039 and reconciles the specification and canonical product documents.
3. `speckit-plan`, specialized requirement-quality checklists,
   `speckit-tasks`, read-only `speckit-analyze`, and artifact remediation until
   the analysis is clean.
4. Companion lifecycle capture through `tasks / ready-to-implement`.

This expanded authorization supersedes the earlier specify-only stop gate only
for the listed pre-implementation artifacts and validations. It does not
authorize `speckit-implement`, product code or tests, Prisma/schema or migration
changes, database operations, staging, commit, push, merge, deployment, or
production work.

## Approved product baseline

- Worker Profile data is separate from Authentication identity and can precede
  account completion.
- Email invitations, independent Worker and login-access lifecycles, exact
  Provider authority, operational-phone privacy, and private avatar rules follow
  DEC-038.
- Provider Admin authority comes only from explicit active
  `provider_members.ADMIN` membership; no Worker field grants it.
- Worker type, Supervisor capability, and membership-level `cleans` are separate
  concepts.
- A Worker may have only one current Provider engagement and one active Team
  membership, with history retained across removal, departure, and rehire.
- Team lifecycle, primary-Supervisor validity, last-cleaner atomic impact, and
  `workersReady` behavior follow DEC-038 exactly.
- Version-aware commands, idempotent retries, safe conflicts, reason policy,
  immutable history, privacy-safe evidence, and localized notification intents
  are mandatory.
- DEC-039 locks the exact primary-Supervisor scope, strict Escort
  `cleans=false` invariant, Supervisor last-cleaner conflict, action-specific
  reason catalogs, and invitation/post-acceptance email-locale resolution.

## Inherited boundaries

- Providers owns Worker engagements, Worker operational profiles, skills, Team
  lifecycle and membership, Supervisor assignment, domain history, and the
  `workersReady` projection.
- Authentication continues to own identities, passwords, global roles,
  sessions, account activity, and recent re-authentication proofs.
- Provider membership remains distinct from Worker engagement. Exact-Provider
  `OWNER` and `ADMIN` authority must be consumed through the Provider-owned
  membership contract rather than inferred from Worker profile data.
- Media continues to own private avatar upload, processing, storage, and
  delivery behavior.
- Notifications continue to own durable email delivery; accepted Provider
  business truth must not depend on successful email delivery.
- Booking owns any later assignment snapshot. R1-P07 defines only the Team-
  membership cleaning fact that a later phase may snapshot.

## Specify result

- `spec.md` contains the complete technology-agnostic R1-P07 behavior derived
  from DEC-038, the R1-P07 roadmap section, and relevant vision rules.
- The requirements checklist is complete with no unresolved
  `[NEEDS CLARIFICATION]` marker.
- `.specify/feature.json` points to this feature directory.
- The mandatory Companion `after_specify` hook records the pipeline state after
  specification validation.

## Clarification result

- One session dated 2026-08-22 persisted the five owner-approved DEC-039
  refinements without reopening any DEC-038 decision.
- The specification, lifecycle controls, canonical documents, requirements
  checklist, contradiction scans, and documentation validation are reconciled.
- Companion records the five decisions and the completed `clarify` span. No
  material product question remains before technical planning.

## Technical-plan result

- `speckit-plan` produced `plan.md`, research, data model, design OpenAPI,
  module/transaction contracts, authorization matrix, migration plan, test
  strategy, quickstart, and implementation prompt.
- Constitution Check passed before research and after design. The design keeps
  workforce ownership in Providers and crosses Authentication, Media, and Admin
  only through explicit public contracts.
- The OpenAPI 3.1 design parses successfully with 20 paths and 25 operations.
  Companion records `currentStep=plan` and `status=planned`.

## Checklist, task, and analysis result

- The requirements checklist remains complete at 16/16, and the four focused
  authorization/privacy, lifecycle/concurrency, data/migration, and
  API/UX/notification checklists are complete at 80/80 combined.
- `tasks.md` contains continuous, unique tasks `T001` through `T156`, grouped
  into Setup, Foundational, all eight User Stories, and final proof. Every
  `FR-001` through `FR-088` and `SC-001` through `SC-014` maps to at least one
  implementation, test, or evidence task.
- The final read-only consistency analysis is **CLEAN**: zero unresolved
  critical, high, medium, or low findings; zero unmapped requirements or tasks;
  and zero Constitution conflicts. Its remediation clarified Worker activation
  versus login readiness, DRAFT Team membership, version ownership, concrete
  role-safe response DTOs, onboarding/access/Admin version fields, and one
  logger task path without changing product scope.
- Companion is restored to `currentStep=tasks` and
  `status=ready-to-implement` after analysis. The only next workflow step is
  `speckit-implement`, which remains unexecuted.

## Explicitly unauthorized after the expanded authorization

- `speckit-implement` or any product implementation.
- Product code, product tests, Prisma/schema changes, migrations, seeds, or any
  database operation.
- Any further Git action after the authorized phase-branch creation: staging,
  commit, push, merge, force-push, or history rewriting.
- Deployment, production migration, credentials, production configuration, or
  external-provider operations.
- R1-P08 or later-phase preparation or implementation.

## Historical activation stop gate

Stop after clarification, planning, checklists, tasks, analysis/remediation, and
final documentation validation have completed, when Companion records
`currentStep=tasks` and `status=ready-to-implement`. The next step must be
`speckit-implement`. That original stop was honored. The owner subsequently
authorized implementation and, on 2026-08-24, explicitly instructed Codex to
complete R1-P07 and mark it completed. The final completion evidence is in
`implementation-summary.md` and `completion-report.md`; Git publication remains
separately gated by the exact message `commit and push`.

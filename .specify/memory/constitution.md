<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.0.1 PATCH (2026-09-10)
- Modified principles:
  - VIII. Human-Controlled Decisions and Operations: complete working-tree
    staging; second exact Git trigger `commit and push plus` for leftover
    files directly to main
- Templates requiring updates: none (Git trigger text lives in AGENTS.md,
  docs/ai workflows, and commit-and-push skills)
- Follow-up TODOs: none

- Prior version change: pre-ratification draft labeled 1.0.0 -> 1.0.0 ratified baseline
- Modified principles:
  - Standalone Greenfield Boundary -> I. Standalone Greenfield Product
  - One Active Phase and Minimal Context -> II. One Active Phase and Complete Traceability
  - Modular Monolith Boundaries -> III. Modular Monolith Ownership
  - Incremental Prisma Migrations -> IV. Global Design, Local Implementation,
    Incremental Migration; and X. Immutable Migrations and Phase-Owned Data
  - Testing Accompanies Behavior -> VII. Risk-Proportional Testing and Evidence
- Added principles:
  - V. Canonical Product Truth and No AI Invention
  - VI. Backend Authority, Integrity, and Security
  - VIII. Human-Controlled Decisions and Operations
  - IX. Locked Release and Product Boundaries
- Added sections:
  - Authority and Delivery Controls
  - Phase Workflow and Quality Gates
- Removed sections:
  - Locked Constraints; content moved into Principles V, VIII, and IX
  - Roles, Context, and Delivery; content moved into Authority and Delivery Controls
    and Phase Workflow and Quality Gates
- Templates requiring updates:
  - .specify/templates/plan-template.md: updated
  - .specify/templates/spec-template.md: updated
  - .specify/templates/tasks-template.md: updated
  - .specify/templates/constitution-template.md: reviewed; no update required
  - .specify/templates/checklist-template.md: reviewed; no update required
- Installed Spec Kit command definitions: reviewed; no stale agent-specific authority
  references found
- Follow-up TODOs: none
-->

# Cleanora Constitution

## Core Principles

### I. Standalone Greenfield Product

Cleanora is a standalone greenfield product. Every artifact and implementation
MUST be understandable, buildable, testable, and deployable from the Cleanora
repository, its repository-local documentation, its own schema and migration
history, and explicitly documented external services.

Cleanora MUST NOT depend on another repository, schema, migration history,
database, production dataset, undocumented API, undocumented service, or
unavailable system. Compatibility tables, imports, adapters, or migration
scripts for an unapproved external application MUST NOT be introduced. Missing
repository-local authority MUST be reported as a gap.

**Rationale**: A clean project boundary keeps the system reproducible,
auditable, and independent of unavailable technical history.

### II. One Active Phase and Complete Traceability

Exactly one roadmap phase MAY be active. `docs/product/current.md` is the live
phase pointer, and implementation MUST remain inside that phase's approved
scope. No future phase may be implemented early.

Before implementation, the active phase MUST have a `spec.md`, `plan.md`, and
`tasks.md` whose requirements and tasks trace to canonical source rules,
acceptance criteria, and the phase Definition of Done. Implementation, review,
verification, and completion evidence MUST remain traceable across those
artifacts. A phase MUST NOT be marked complete until its Definition of Done is
satisfied with evidence and the human owner approves completion.

**Rationale**: Single-phase focus prevents hidden scope expansion and makes
every delivered change reviewable against approved intent.

### III. Modular Monolith Ownership

The backend is one deployable modular monolith using one PostgreSQL database.
Each business module MUST own its behavior, use cases, authorization-sensitive
workflows, repositories, and persistence mapping. Each module MUST expose a
narrow, explicit public contract through its approved public entry point.

Cross-module callers MUST use public contracts only. Direct access to another
module's internal repository, controller, route, Prisma implementation, raw
Prisma model, or other internal file is prohibited. Shared code MUST remain
business-neutral. Circular dependencies, global God services or repositories,
microservice networking inside the monolith, and undocumented transaction
ownership are prohibited.

**Rationale**: Explicit ownership preserves domain boundaries while retaining
the operational simplicity of one deployable application.

### IV. Global Design, Local Implementation, Incremental Migration

Database work MUST follow: **design globally, implement locally, migrate
incrementally**. The Master ERD describes the global direction; each active
phase implements only the persisted data required by its approved vertical
slice.

`R1-P00 — Product & Database Architecture` is architecture-only. It MUST
produce the approved architecture deliverables and MUST NOT add product Prisma
models or create migrations. Every later database-changing phase MUST own its
incremental `prisma/schema.prisma` changes, clearly named migration, generated
SQL review, Prisma Client generation, seed or backfill changes, database tests,
and migration evidence.

**Rationale**: Global coherence is preserved without prematurely coupling the
schema to future-phase assumptions.

### V. Canonical Product Truth and No AI Invention

Locked product behavior MUST NOT be weakened, reinterpreted, or changed for
implementation convenience. Unresolved product questions MUST be recorded
against `docs/product/open-questions.md` and escalated for human approval.
Developers and AI systems MUST NOT invent an answer, encode an unapproved
default, or turn a technical choice into a product decision.

Canonical product documents remain authoritative over generated Spec Kit
artifacts. A `spec.md`, `plan.md`, `tasks.md`, checklist, prompt, or generated
design artifact MUST be corrected when it conflicts with a higher-precedence
repository authority.

**Rationale**: Product intent belongs to approved sources and the human owner,
not to implementation convenience or model inference.

### VI. Backend Authority, Integrity, and Security

The backend MUST be authoritative wherever business integrity is at risk.
Applicable phases MUST provide server-side validation, deny-by-default
authorization, ownership and state checks, auditable privileged writes,
idempotent side effects, and explicit state-transition enforcement.

Money MUST use decimal-safe handling and server-calculated totals. Confirmed
business records MUST preserve required historical snapshots. Payment and
other replayable external callbacks MUST be authenticated and idempotent.
Credentials, tokens, OTPs, signatures, cookies, payment payloads, and other
sensitive data MUST be securely stored, transmitted, redacted, and excluded
from logs and source control as applicable.

**Rationale**: Client input, retries, concurrency, and privileged access cannot
be allowed to compromise financial, operational, or security invariants.

### VII. Risk-Proportional Testing and Evidence

Automated tests and quality gates are mandatory and MUST be proportional to the
risks introduced by the active phase. Every behavior change MUST have
appropriate unit and integration evidence. E2E, migration, authorization,
ownership, invalid-transition, payment, webhook authenticity, replay,
idempotency, concurrency, queue, cache, notification, and regression tests
MUST be included when the phase introduces those risks.

Database-changing phases MUST prove clean migration application and
earlier-phase compatibility. Release 1 tests MUST NOT depend on Docker or
Testcontainers. External providers MUST use contract fakes, and production
credentials MUST NOT be used in tests. Coverage thresholds are guardrails, not
a substitute for acceptance and invariant testing.

**Rationale**: Completion requires reproducible evidence against the real
failure modes of the phase, not test counts alone.

### VIII. Human-Controlled Decisions and Operations

Human-owner approval is required for product decisions, resolution of open
questions, phase completion, Git commits and pushes, merges, deployments,
production migrations, destructive actions, credentials, and production
configuration. Approval for one action MUST NOT be inferred as approval for a
different action.

Exact human messages are the only authorization for the guarded Git
workflows. `commit and push` authorizes validation, complete staging of the
remaining working tree (including skills, docs, specs, and Cursor/Codex
artifacts), one conventional commit, and a safe feature-branch push.
`commit and push plus` authorizes the same complete staging for leftover or
tiny follow-up files and a direct non-force push to `main` without a pull
request. Neither message authorizes merge of a feature branch, deployment,
production migration, force-push, or history rewriting.

**Rationale**: Material product and operational consequences remain under
explicit human control.

### IX. Locked Release and Product Boundaries

Docker and cloud work are deferred until Release 3 and MUST NOT be planned or
implemented earlier without an approved amendment to the governing product
documents. Cleanora customer, provider, and marketer stored-value wallets are
prohibited.

External payment and payout rails, external mobile-wallet destinations,
gateway accounts, provider or marketer dues, settlements, and payout records
are allowed when introduced by their approved phases. They MUST NOT be modeled
or described as reusable Cleanora-held user balances.

**Rationale**: These boundaries are approved product and sequencing decisions,
not discretionary technical tradeoffs.

### X. Immutable Migrations and Phase-Owned Data

Applied migrations are immutable and MUST NOT be edited, deleted, reordered,
or reset. Corrections MUST use a new forward migration. Destructive operations,
defaults, backfills, indexes, constraints, seed changes, and compatibility
effects MUST be explicitly reviewed and tested by the owning phase.

Future-phase or future-release product models MUST NOT be created early. An
early compatibility field is permitted only when a documented active-phase
dependency proves it necessary and the plan records its ownership and impact.
Financial and other append-only historical records MUST NOT be hard-deleted.

**Rationale**: An append-only, phase-owned migration history protects clean
database creation, production safety, and delivery traceability.

## Authority and Delivery Controls

Repository authority MUST be applied in this order:

1. `AGENTS.md`.
2. `docs/product/vision.md` for locked product behavior.
3. `docs/product/decision-log.md` for approved decisions.
4. `docs/product/open-questions.md` for unresolved decisions that block
   invention.
5. `docs/product/roadmap.md` for delivery order.
6. `docs/product/current.md` for the one active phase.
7. `docs/ai/context-router.md`, this constitution, and applicable repository
   engineering standards.

Spec Kit artifacts are derived delivery contracts. They MUST cite the
applicable canonical rules and MUST NOT override them. When a conflict is
found, work MUST stop at the affected decision, the conflict MUST be recorded,
and the higher-precedence authority MUST be followed or amended by the human
owner.

Role ownership is:

- Cursor Auto implements the active specification and tests.
- Cursor Claude reviews the complete Git diff against the active artifacts and
  repository rules.
- Codex plans phases, protects architecture, diagnoses defects, verifies
  review findings, runs quality gates, and manages the guarded Git workflow.
- The human owner approves product and operational decisions reserved by
  Principle VIII.

Agents MUST use `docs/ai/context-router.md` to load the smallest sufficient
active-phase context and MUST report missing repository-local authority rather
than substituting another project or an invented rule.

## Phase Workflow and Quality Gates

The required delivery sequence is:

Roadmap phase → specification → technical plan → tasks → implementation →
review → finding resolution → validation → Definition of Done evidence →
human phase approval → guarded Git workflow.

Every phase plan MUST pass a documented Constitution Check before
implementation. The check MUST be repeated after material design changes and
MUST verify all ten principles, the current phase pointer, applicable canonical
rules, open questions, database ownership, security and integrity risks,
testing obligations, and required human approvals.

Phase completion requires:

- acceptance criteria and every Definition of Done item mapped to evidence;
- all applicable tests and repository quality gates passing;
- schema and migration evidence when persisted data changes;
- review findings resolved or rejected with file-and-line evidence;
- no unresolved constitutional violation, invented product decision, or
  unapproved future-phase work; and
- explicit human-owner approval.

Complexity or boundary exceptions MUST be documented in the plan with the
reason, the simpler alternative considered, ownership, and human or
architecture approval when required. An undocumented exception fails the
Constitution Check.

## Governance

This constitution governs Cleanora engineering and delivery subject to the
repository authority order above. Informal practice, generated artifacts, and
tool prompts cannot waive a constitutional requirement or a higher-precedence
canonical product rule.

Amendments require explicit human-owner approval. Each amendment MUST:

1. describe the affected principles and dependent artifacts;
2. use semantic versioning: MAJOR for incompatible governance or principle
   removals or redefinitions, MINOR for a new principle or materially expanded
   obligation, and PATCH for non-semantic clarification;
3. update the Sync Impact Report, version, and Last Amended date;
4. synchronize affected Spec Kit templates and repository guidance; and
5. preserve an auditable rationale for the change.

Compliance is mandatory in planning, implementation, review, and phase
completion. Every plan MUST pass the Constitution Check before implementation,
and every completed phase MUST present evidence against its Definition of Done
before human approval. Reviewers MUST treat violations of a constitutional
MUST as blocking until corrected or the constitution is formally amended.

**Version**: 1.0.1 | **Ratified**: 2026-07-24 | **Last Amended**: 2026-09-10

# Implementation Plan: Product & Database Architecture

**Branch**: `R1-P00-product-database-architecture` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/R1-P00-product-database-architecture/spec.md`

**Note**: This is the historical R1-P00 plan record. During R1-P00 it authorized
documentation/architecture work only and froze the implementation contract for
later phases. R1-P00 is now Complete; this plan does not describe the current
active phase or authorize runtime application behavior.

## Summary

R1-P00 produces the global Cleanora data architecture contract before any
product Prisma models or migrations. This plan (with `tasks.md`) authorizes
documentation-only implementation of four canonical architecture documents
(`master-erd.md`, `database-conventions.md`, `entity-ownership.md`,
`status-machine-draft.md`), validates the existing standalone project boundary,
assigns every planned table to exactly one module/release/phase/lifecycle
owner, and defines provisional status-transition design without resolving
OQ-010 (owned by R1-P13). It does not authorize runtime code, Prisma schema
changes, migrations, Git operations, deployment, or future-phase
implementation.

Technical approach: derive all content from repository-local canonical product
documents and the active specification; use the modular-monolith ownership
catalog and convention baselines in [research.md](./research.md); validate with
objective checklists in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: Documentation (Markdown). No application language change
in this phase. Existing backend target remains Node.js/TypeScript modular
monolith for future phases only.

**Primary Dependencies**: None new. No package installs in R1-P00.

**Storage**: Conceptual only. One future PostgreSQL database and one
`prisma/schema.prisma` are assumed for later phases; R1-P00 MUST NOT modify
schema or create migrations.

**Testing**: Documentation validation checklists and reviewer sampling
([quickstart.md](./quickstart.md)). No runtime tests, Docker, or Testcontainers.

**Target Platform**: Repository documentation consumed by humans and AI agents
preparing later phases.

**Project Type**: Architecture documentation for a modular-monolith marketplace
backend.

**Performance Goals**: N/A for documentation. Reviewer sampling target: ≥10
entities traced to owner/phase/consumers/source in ≤2 minutes each (SC-010).

**Constraints**:

- Documentation-only; zero product schema/migration/src/test/dependency work
- Standalone repository boundary (DEC-012)
- No stored-value wallets (DEC-003)
- Docker/cloud deferred to Release 3
- OQ-010 remains open; resolution owner R1-P13
- Historical preparation state: R1-P00 was the one active phase

**Scale/Scope**: Complete three-release conceptual model and planned-table
ownership map; four architecture deliverables; no runtime surface.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against `.specify/memory/constitution.md` v1.0.0:

### Pre-research (Phase 0 entry)

- [x] **I. Standalone Greenfield Product** — plan uses only Cleanora
      repository-local sources; no external app/schema/history dependency
- [x] **II. One Active Phase and Complete Traceability** — during this historical
      planning check, the active pointer was R1-P00; artifacts trace to
      FR/SC/DEC/OQ/roadmap
- [x] **III. Modular Monolith Ownership** — module catalog and ownership rules
      defined; no cross-module repository access authorized
- [x] **IV. Global Design, Local Implementation, Incremental Migration** —
      architecture-only; no product models/migrations in R1-P00
- [x] **V. Canonical Product Truth and No AI Invention** — OQ-001–OQ-014
      contained; OQ-010 assigned to R1-P13; no invented product answers
- [x] **VI. Backend Authority, Integrity, and Security** — authority, audit,
      money, snapshot, and transition integrity preserved as architecture rules
- [x] **VII. Risk-Proportional Testing and Evidence** — documentation evidence
      only; runtime tests deferred to owning phases; no Docker/Testcontainers
- [x] **VIII. Human-Controlled Decisions and Operations** — no commit/push/
      phase-status/completion claims in this plan execution
- [x] **IX. Locked Release and Product Boundaries** — no wallets; no
      Docker/cloud; R2/R3 entities labeled, not implemented
- [x] **X. Immutable Migrations and Phase-Owned Data** — future migration
      strategy defined; applied migrations immutable; no schema edits now

**Pre-research gate result**: PASS

### Post-design (Phase 1 exit)

- [x] `research.md` resolves planning unknowns without inventing product
      decisions
- [x] `data-model.md` covers entity families, cardinality, lifecycle, ownership
      without creating Prisma models
- [x] `quickstart.md` provides objective validation for all Done When / SC
      evidence classes
- [x] `contracts/` intentionally skipped (no runtime interface)
- [x] Four later deliverable paths and acceptance mapping remain explicit
- [x] OQ-010 still provisional and owned by R1-P13
- [x] No constitution violation requiring Complexity Tracking justification

**Post-design gate result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/R1-P00-product-database-architecture/
├── spec.md                 # Active specification (existing)
├── plan.md                 # This file
├── research.md             # Phase 0 decisions
├── data-model.md           # Conceptual model + ownership/cardinality plan
├── quickstart.md           # Objective validation guide
├── checklists/
│   └── requirements.md     # Spec quality checklist (existing)
└── tasks.md                # Phase 2 output (/speckit-tasks — not created here)
```

`contracts/` is intentionally absent for R1-P00.

### Canonical architecture deliverables (later implementation of this plan)

```text
docs/architecture/
├── master-erd.md                 # CREATE in implementation tasks
├── database-conventions.md       # CREATE in implementation tasks
├── entity-ownership.md           # CREATE in implementation tasks
└── status-machine-draft.md       # CREATE in implementation tasks

docs/product/
└── standalone-project-boundary.md  # VALIDATE/REFERENCE only — do not duplicate
```

### Source Code (repository root)

```text
# R1-P00 does not modify application source, Prisma, migrations, or tests.
# Existing layout (future phases only; do not create modules now):
src/
├── modules/         # Phase-owned business capabilities (later)
├── core/            # Business-neutral ports
├── integrations/    # Adapters
└── shared/          # Business-neutral utilities
prisma/              # One schema + migrations (unchanged in R1-P00)
tests/               # Unchanged in R1-P00
docs/architecture/   # Target for the four new deliverables
docs/product/        # Canonical product authority (read/validate)
```

**Structure Decision**: Documentation-only feature under
`specs/R1-P00-product-database-architecture/` with later writes limited to the
four `docs/architecture/*` deliverables and validation of the existing product
standalone boundary. No `src/`, `prisma/`, or `tests/` changes.

## Implementation work packages (for later `/speckit-tasks`)

### WP-A — Master ERD (`docs/architecture/master-erd.md`)

- Cover all entity families in spec Key Entities / FR-009–FR-023
- Group by planned modules from research Decision 3
- Label owning release and implementation phase; never mark R1-P00 as table
  implementation owner
- Legend for authoritative, historical snapshot, immutable financial,
  configuration, audit, external integration reference
- Show direction, cardinality, lifecycle boundaries for important relationships
- Explicit booking vs order boundary (FR-024) and Browse/Recommended convergence
  (FR-025)
- Negative proof: zero stored-value wallets; destinations ≠ dues/settlements
- Mark OQ-affected relationships provisional

**Accepts when**: Master ERD deliverable criteria in spec + SC-001, SC-003,
SC-006, SC-007, SC-011.

### WP-B — Entity ownership (`docs/architecture/entity-ownership.md`)

- Reconcile every roadmap `### Tables` inventory item across R1/R2/R3
- One row per planned table: module, release, phase, lifecycle owner,
  consumers, classifications
- Explicit conceptual/derived non-table list
- Zero orphan/duplicate/multi-owner rows; expose conflicts as blockers
- R1-P00 listed only as architecture-contract phase

**Accepts when**: Entity Ownership criteria + SC-002, SC-005, SC-010.

### WP-C — Database conventions (`docs/architecture/database-conventions.md`)

- Encode research Decision 5 topics: naming, IDs, FKs, timestamps, deletion,
  status/enum evolution, money, country/currency, localization, snapshots,
  financial immutability, indexes/constraints, audit fields, migration naming,
  seed/backfill ownership, public-contract persistence boundary
- Define incremental phase-owned Prisma migration strategy for future phases
- Leave OQ-010 enum names and emergency modeling open

**Accepts when**: Database Conventions criteria + SC-008.

### WP-D — Status-machine draft (`docs/architecture/status-machine-draft.md`)

- Seven-field transition format + authority/ownership/stale/idempotency rules
- Sample provisional transitions: provider lifecycle, booking/order progression,
  completion, cancellation, privileged override, emergency-related
- Distinguish rejected vs successful transitions
- Trace OQ-010 to R1-P13; keep labels provisional

**Accepts when**: Status-Machine Draft criteria + SC-012.

### WP-E — Standalone boundary validation + open-question audit

- Reference `docs/product/standalone-project-boundary.md` from all four
  deliverables
- Reconcile OQ-001–OQ-014 against deliverables (SC-004)
- Architecture review checklist evidence for SC-014 / roadmap Done When

**Accepts when**: Standalone Boundary Validation + R1-P00 Architecture Review
criteria.

## Traceability matrix (plan → authority)

| Plan decision / work package | Primary FR / SC | User stories | DEC / OQ / other |
|---|---|---|---|
| Docs-only phase | FR-007, SC-013 | US1–US5 | DEC-014, constitution IV |
| Four deliverable paths | FR-002, SC-009 | US1–US4 | roadmap R1-P00 |
| Standalone boundary reference | FR-003, SC-009 | US1 | DEC-012 |
| Module ownership catalog | FR-010, FR-031–FR-039 | US2 | ADR-0001 |
| Planned-table inventory | FR-034–FR-039, SC-002/005 | US2 | roadmap §3 tables |
| Conventions + migrations | FR-040–FR-056, SC-008 | US3 | DEC-014, database-prisma.md |
| Status-machine format | FR-057–FR-061, SC-012 | US4 | OQ-010 → R1-P13 |
| Wallet / payout separation | FR-028–FR-029, SC-006/007 | US1 | DEC-003 |
| Open-question containment | FR-005, FR-062–FR-065, SC-004 | US5 | open-questions.md |
| Objective review evidence | FR-008, FR-066, SC-014 | US1 | roadmap Done When |

## Persistence and migration impact (this phase)

| Item | R1-P00 action |
|---|---|
| `prisma/schema.prisma` | Do not modify |
| Migrations | Do not create or edit |
| Seeds/backfills | Do not create |
| Future migration strategy | Document in `database-conventions.md` |
| Module source / APIs / tests | Do not create |

## Complexity Tracking

> No constitution violations require justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

# Quickstart Validation: R1-P00 Architecture Contract

This quickstart is historical validation context for the completed R1-P00
phase. References to its active pointer describe the R1-P00 preparation period,
not the current repository state; `docs/product/current.md` remains the canonical
live phase authority.

**Date**: 2026-07-24
**Phase**: R1-P00 — Product & Database Architecture
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Purpose

Objective, repeatable validation for the R1-P00 architecture documentation
phase. This is not an application runbook. There is no server start, migration,
or API call in this phase.

## Prerequisites

- Historical validation prerequisite: the active phase pointer was R1-P00 in
  `docs/product/current.md` during R1-P00 preparation
- Spec Kit artifacts present under `specs/R1-P00-product-database-architecture/`
- Canonical sources available: `docs/product/vision.md`, `decision-log.md`,
  `open-questions.md`, `roadmap.md`, `standalone-project-boundary.md`
- Constitution: `.specify/memory/constitution.md`
- After implementation tasks complete, the four deliverables exist:
  - `docs/architecture/master-erd.md`
  - `docs/architecture/database-conventions.md`
  - `docs/architecture/entity-ownership.md`
  - `docs/architecture/status-machine-draft.md`

## Validation stages

### Stage 0 — Pre-implementation plan gate (now)

Run before `/speckit-tasks` / documentation implementation.

| # | Check | Expected | Evidence |
|---|---|---|---|
| 0.1 | Historical active-phase snapshot | `R1-P00` was Not Started / active pointer only during preparation | historical `docs/product/current.md` evidence |
| 0.2 | OQ-010 owner | `R1-P13`, not R1-P12 | `open-questions.md`, `spec.md` |
| 0.3 | Material blockers | No OQ blocks R1-P00 | spec Open Questions table |
| 0.4 | Plan artifacts | `plan.md`, `research.md`, `data-model.md`, `quickstart.md` present | this directory |
| 0.5 | Contracts skipped | No `contracts/` directory required | directory listing |
| 0.6 | Schema untouched | `prisma/schema.prisma` unchanged by this phase work | git status / diff |
| 0.7 | Constitution gates | Pre- and post-design checks PASS in `plan.md` | `plan.md` |

**Stage 0 result**: record PASS/FAIL. FAIL blocks task generation only if a
real product decision or constitution violation appears.

### Stage 1 — Deliverable presence and non-duplication

| # | Check | Expected | Maps to |
|---|---|---|---|
| 1.1 | Four new architecture files exist | Exactly the four paths above | FR-002, SC-009 |
| 1.2 | Standalone boundary | Existing `docs/product/standalone-project-boundary.md` referenced; no architecture duplicate | FR-003 |
| 1.3 | No runtime artifacts added | No new product models, migrations, `src` modules, APIs, tests, dependency locks for R1-P00 scope | FR-007, SC-013 |

### Stage 2 — Master ERD coverage (SC-001, SC-003, SC-006, SC-007, SC-011)

| # | Check | Method | Pass criteria |
|---|---|---|---|
| 2.1 | Entity family coverage | Trace every Key Entities family in `spec.md` into Master ERD or derived/non-persisted list | 100% |
| 2.2 | Module grouping | Every entity grouped under planned module or explicit shared technical area | No ungrouped entities |
| 2.3 | Release/phase labels | Each entity labeled; R1-P00 not marked as table implementation owner | 100% |
| 2.4 | Relationship review | Sample ≥15 important relationships for direction, cardinality, owner, lifecycle boundary | 0 ambiguous ownership transfers |
| 2.5 | Wallet negative scan | Search deliverables for wallet/balance/top-up/transfer user-store concepts | 0 stored-value wallet entities |
| 2.6 | Payout separation | For provider and marketer finance, destinations ≠ dues/settlements/payouts/ledger | 100% structural separation |
| 2.7 | Boundary answers | FR-024–FR-033 each have one unambiguous architecture answer | 10/10 |

### Stage 3 — Entity ownership map (SC-002, SC-005, SC-010)

| # | Check | Method | Pass criteria |
|---|---|---|---|
| 3.1 | Inventory reconciliation | Union all roadmap `### Tables` lists; match ownership rows | 0 missing planned tables |
| 3.2 | Unique ownership | Each planned table has one module, release, phase, lifecycle owner | 0 duplicates / multi-owners |
| 3.3 | Consumers listed | Cross-module readers listed without ownership transfer | Present where applicable |
| 3.4 | Classifications | Applicable authoritative/historical/immutable/configurable/auditable/external flags visible | Complete |
| 3.5 | Derived entities | Non-table concepts explicitly listed | No fake tables invented only for completeness |
| 3.6 | Sampling exercise | Pick ≥10 entities spanning R1/R2/R3; trace owner, phase, consumers, source in ≤2 minutes each | 10/10 unambiguous |

### Stage 4 — Database conventions (SC-008)

For each FR-040–FR-056 topic, confirm one explicit rule, exception boundary, and
future-phase responsibility:

- [ ] Naming
- [ ] Primary/business/external identifiers
- [ ] Foreign keys and cross-module references
- [ ] Timestamps (`createdAt` / `updatedAt` rules)
- [ ] Hard delete vs soft delete / deactivation
- [ ] Status representation and enum evolution (**OQ-010 still open**)
- [ ] Decimal money + currency + server calculation
- [ ] Country/currency + `countryCode`
- [ ] AR/EN localization
- [ ] Historical snapshots
- [ ] Immutable financial records + compensating entries
- [ ] Indexes and unique constraints policy
- [ ] Audit fields
- [ ] Phase-owned migration naming + SQL review
- [ ] Applied migration immutability / forward-only fixes
- [ ] Seed/backfill ownership
- [ ] Raw Prisma types barred from public contracts

Pass = 17/17 explicit with no unresolved contradiction.

### Stage 5 — Status-machine draft (SC-012)

| # | Check | Pass criteria |
|---|---|---|
| 5.1 | Transition format | All seven required fields present on 100% of samples |
| 5.2 | Categories covered | Normal, cancellation, failure, privileged override, completion, emergency-related |
| 5.3 | Rejection semantics | Rejected ≠ successful; sensitive failures auditability stated |
| 5.4 | OQ-010 | Final enum names and emergency representation visibly unresolved; owner = R1-P13 |
| 5.5 | Authority | Backend authority, ownership checks, stale-state rejection, idempotent side effects documented |

### Stage 6 — Open questions (SC-004)

| # | Check | Pass criteria |
|---|---|---|
| 6.1 | Coverage | OQ-001–OQ-014 each linked to entities, blocker status, owner/unassigned, containment |
| 6.2 | No silent resolution | Deliverables, legends, examples do not invent answers |
| 6.3 | Unassigned exclusions | OQ-003, OQ-004, OQ-006, OQ-008 remain excluded until roadmap assignment |

### Stage 7 — Architecture review recommendation (SC-014)

Reviewer completes an approve/reject checklist against roadmap Done When:

- [ ] Every major entity present in Master ERD (or derived list)
- [ ] Every planned table has release and phase owner
- [ ] Internal stored-value wallets absent
- [ ] External payout destinations separate from financial dues
- [ ] Open product questions visibly marked
- [ ] Clean-slate / standalone boundary respected

**Output**: written approve or reject with file/section evidence. Human owner
alone may approve phase completion.

## Negative checks (must remain true through the phase)

| Forbidden change | Verification |
|---|---|
| Edit `prisma/schema.prisma` | `git diff -- prisma/` empty for R1-P00 work |
| Create migrations | No new `prisma/migrations/*` from R1-P00 |
| Add `src` product modules / APIs | No R1-P00 implementation commits for runtime |
| Install dependencies | No package.json lock churn for this phase |
| Docker / cloud work | No compose/cloud infra added |
| Change `docs/product/current.md` status | Unchanged unless human separately approves |
| Resolve OQ-010 | Still open; owner R1-P13 |

## Suggested commands (documentation evidence only)

```powershell
# Confirm historical R1-P00 pointer evidence and OQ-010 owner
Select-String -Path docs/product/current.md -Pattern "R1-P00"
Select-String -Path docs/product/open-questions.md -Pattern "OQ-010"

# Confirm deliverables after implementation
Get-Item docs/architecture/master-erd.md,
         docs/architecture/database-conventions.md,
         docs/architecture/entity-ownership.md,
         docs/architecture/status-machine-draft.md

# Confirm no duplicate boundary doc
Test-Path docs/architecture/standalone-project-boundary.md  # expect False

# Wallet negative scan (adjust if false positives on external "mobile wallet")
Select-String -Path docs/architecture/master-erd.md,
                    docs/architecture/entity-ownership.md `
  -Pattern "stored-value|user wallet|wallet top-up|in-platform balance"
```

## Exit criteria for “ready for task generation”

Stage 0 PASS and no unresolved material product decision.

## Exit criteria for “ready for architecture review”

Stages 1–7 PASS with recorded evidence. Runtime tests are N/A.

# Tasks: Product & Database Architecture

**Input**: Design documents from `/specs/R1-P00-product-database-architecture/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `.specify/memory/constitution.md`

**Phase type**: Documentation and architecture only. No Prisma, migrations, `src`, runtime tests, endpoints, dependency installs, Docker/cloud, Git, or automatic phase completion.

**Tests**: Documentation validation via `quickstart.md` Stages 1–7 (not runtime tests). Include validation tasks where the spec requires objective evidence (FR-008, FR-066, SC-014).

**Organization**: Tasks follow user stories US1–US5 from `spec.md`.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (different files; no unfinished dependency)
- **[USn]**: User-story tasks only
- Setup / Foundational / Polish: no story label

## Path Conventions

- Spec Kit: `specs/R1-P00-product-database-architecture/`
- Deliverables: `docs/architecture/`
- Canonical boundary: `docs/product/standalone-project-boundary.md`
- Phase pointer: `docs/product/current.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Mark the phase active and confirm implementation scope before writing deliverables.

- [X] T001 Mark R1-P00 status `In Progress`, set `Started At` and `Last Updated` in `docs/product/current.md` (constitution II; do not set Complete)
- [X] T002 Confirm OQ-010 resolution owner is R1-P13 in `docs/product/open-questions.md` and `specs/R1-P00-product-database-architecture/spec.md` (FR-060; stop if mismatched)
- [X] T003 Confirm FR-001 canonical source set (`AGENTS.md`, `docs/product/*` vision/decision-log/open-questions/roadmap/current, `.specify/memory/constitution.md`, `docs/product/standalone-project-boundary.md`) and confirm no OQ blocks R1-P00 using the classification table in `specs/R1-P00-product-database-architecture/spec.md` (FR-001, FR-062–FR-063)
- [X] T004 Create scaffold `docs/architecture/master-erd.md` with title, purpose, source list, legend placeholders, and acceptance criteria section (FR-002, FR-066; WP-A)
- [X] T005 [P] Create scaffold `docs/architecture/entity-ownership.md` with title, row-schema, inventory method, and acceptance criteria section (FR-002, FR-066; WP-B)
- [X] T006 [P] Create scaffold `docs/architecture/database-conventions.md` with title, convention topic outline from research Decision 5, and acceptance criteria section (FR-002, FR-066; WP-C)
- [X] T007 [P] Create scaffold `docs/architecture/status-machine-draft.md` with title, seven-field format stub, OQ-010 provisional notice → R1-P13, and acceptance criteria section (FR-002, FR-057, FR-060, FR-066; WP-D)
- [X] T008 Create stub `specs/R1-P00-product-database-architecture/implementation-summary.md` with sections for files changed, decisions, exclusions, validations, and open risks (FR-008)

**Checkpoint**: Phase pointer In Progress; four architecture scaffolds and summary stub exist; no Prisma/`src` changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared vocabulary, module catalog, standalone-boundary rules, and OQ containment rules required by every deliverable.

**⚠️ CRITICAL**: No user-story body content until this phase completes.

- [X] T009 Document shared vocabulary (conceptual entity, planned table, authoritative, historical snapshot, immutable financial, configuration, audit, external integration reference, owner, lifecycle owner, consumer) in `docs/architecture/master-erd.md` (FR-006)
- [X] T010 Mirror the shared vocabulary from `docs/architecture/master-erd.md` and record the planned module catalog from research Decision 3 in `docs/architecture/entity-ownership.md`; add a cross-reference from `docs/architecture/master-erd.md` to that catalog (FR-006, FR-010, FR-031; constitution III)
- [X] T011 Add standalone-boundary validation section referencing only `docs/product/standalone-project-boundary.md` in `docs/architecture/master-erd.md` (FR-003, DEC-012; constitution I; do not create `docs/architecture/standalone-project-boundary.md`)
- [X] T012 [P] Add the same canonical standalone-boundary reference section in `docs/architecture/entity-ownership.md` (FR-003, SC-009)
- [X] T013 [P] Add the same canonical standalone-boundary reference section in `docs/architecture/database-conventions.md` (FR-003, SC-009)
- [X] T014 [P] Add the same canonical standalone-boundary reference section in `docs/architecture/status-machine-draft.md` (FR-003, SC-009)
- [X] T015 Embed OQ-001–OQ-014 containment table (blocker=no, entities, owner/unassigned, temporary boundary) in `docs/architecture/entity-ownership.md` with OQ-010 → R1-P13 (FR-005, FR-062, SC-004; constitution V)
- [X] T016 Document record-classification legend (authoritative / historical / immutable financial / configurable / auditable / external integration) in `docs/architecture/master-erd.md` (FR-012, FR-037)
- [X] T017 State explicit R1-P00 exclusions (no schema, migrations, src, runtime tests, Docker/cloud, wallet invention) in `specs/R1-P00-product-database-architecture/implementation-summary.md` (FR-007, SC-013; constitution IV, IX)

**Checkpoint**: Shared foundations ready; user-story documentation can proceed.

---

## Phase 3: User Story 1 - Approve the Global Conceptual Model (Priority: P1) 🎯 MVP

**Goal**: Produce a reviewable Master ERD covering the three-release conceptual model with ownership labels, cardinalities, lifecycle boundaries, and prohibited-wallet proof.

**Independent Test**: Review `docs/architecture/master-erd.md` against vision, decisions, R1-P00 scope, entity coverage, and open questions (US1 Independent Test; SC-001, SC-003, SC-006, SC-007, SC-011).

### Documentation validation for User Story 1

- [X] T018 [US1] Add US1 acceptance checklist mapped to SC-001/SC-003/SC-006/SC-007/SC-011 in `docs/architecture/master-erd.md` (FR-066, FR-008)

### Implementation for User Story 1

- [X] T019 [US1] Document Identity & Access entity family with release/phase labels in `docs/architecture/master-erd.md` (FR-009, FR-014; data-model §1)
- [X] T020 [US1] Document Customer entity family with textual address and R3 geo extension note in `docs/architecture/master-erd.md` (FR-009, FR-014; data-model §2)
- [X] T021 [US1] Document Provider Supply entity family including external payout destinations in `docs/architecture/master-erd.md` (FR-009, FR-015, FR-028)
- [X] T022 [US1] Document Catalog & Localization entity family in `docs/architecture/master-erd.md` (FR-009, FR-016, FR-027)
- [X] T023 [US1] Document shared Eligibility domain (V1 inputs + V2 extensions, one domain) in `docs/architecture/master-erd.md` (FR-009, FR-017; DEC-005)
- [X] T024 [US1] Document Booking & Recommended commercial entities with provisional status labels and OQ-010 → R1-P13 note in `docs/architecture/master-erd.md` (FR-009, FR-018, FR-060)
- [X] T025 [US1] Document Order Execution entities including assignment evidence vs provider teams in `docs/architecture/master-erd.md` (FR-009, FR-018, FR-026)
- [X] T026 [US1] Document Payments & Finance entities with no stored-value wallets and destination≠due separation in `docs/architecture/master-erd.md` (FR-009, FR-019, FR-028, FR-029; DEC-003; SC-006, SC-007)
- [X] T027 [US1] Document Trust & Support entities (basic ratings only; OQ-005/OQ-012 contained) in `docs/architecture/master-erd.md` (FR-009, FR-020)
- [X] T028 [US1] Document Notifications entities without in-order chat (OQ-006) in `docs/architecture/master-erd.md` (FR-009, FR-020)
- [X] T029 [US1] Document Administration & Audit entities in `docs/architecture/master-erd.md` (FR-009, FR-020)
- [X] T030 [US1] Document Country & Configuration entities with `countryCode` scope in `docs/architecture/master-erd.md` (FR-009, FR-021, FR-030)
- [X] T031 [US1] Document Media ownership (business auth vs technical storage) in `docs/architecture/master-erd.md` (FR-009, FR-021, FR-032)
- [X] T032 [US1] Document Marketer & Growth (R2) entities without marketer wallets in `docs/architecture/master-erd.md` (FR-009, FR-022; DEC-003, DEC-007)
- [X] T033 [US1] Document Geo & Realtime (R3) extensions as attachments to earlier entities in `docs/architecture/master-erd.md` (FR-009, FR-023; DEC-004)
- [X] T034 [US1] Document important relationships with direction, cardinality, authoritative owner, and lifecycle boundaries in `docs/architecture/master-erd.md` (FR-013, FR-033; SC-003)
- [X] T035 [US1] Document booking vs order boundary and confirmation/activation invariant without freezing OQ-010 enums in `docs/architecture/master-erd.md` (FR-024; SC-011)
- [X] T036 [US1] Document Browse and Recommended convergence into shared booking/order/finance paths with preserved source history in `docs/architecture/master-erd.md` (FR-025; SC-011)
- [X] T037 [US1] Explicitly list conceptual/derived non-persisted concepts in `docs/architecture/master-erd.md` (FR-034 edge case; SC-001)
- [X] T038 [US1] Reconcile three-release Master ERD completeness (FR-009), run Stage 2 checks from `specs/R1-P00-product-database-architecture/quickstart.md` against `docs/architecture/master-erd.md`, and record results in `specs/R1-P00-product-database-architecture/implementation-summary.md` (FR-009; SC-001, SC-003, SC-006, SC-007, SC-011)

**Checkpoint**: Master ERD independently reviewable for US1.

---

## Phase 4: User Story 2 - Assign Every Planned Table to a Future Phase (Priority: P1)

**Goal**: Exhaustive ownership map: every planned table has one module, release, phase, and lifecycle owner plus consumers and classifications.

**Independent Test**: Pick any planned table and find exactly one complete ownership row (US2; SC-002, SC-005, SC-010).

### Documentation validation for User Story 2

- [X] T039 [US2] Add US2 acceptance checklist mapped to SC-002/SC-005/SC-010 in `docs/architecture/entity-ownership.md` (FR-066)

### Implementation for User Story 2

- [X] T040 [US2] Extract and list all roadmap `### Tables` inventory candidates from `docs/product/roadmap.md` into `docs/architecture/entity-ownership.md` (FR-034; research Decision 4)
- [X] T041 [US2] Fill ownership rows for Release 1 planned tables (module, release, phase, lifecycle owner, important cross-module consumers with purpose, classifications, OQ links) in `docs/architecture/entity-ownership.md` (FR-035–FR-037, FR-036)
- [X] T042 [US2] Fill ownership rows for Release 2 planned tables (including consumers per FR-036) in `docs/architecture/entity-ownership.md` (FR-035–FR-037, FR-036)
- [X] T043 [US2] Fill ownership rows for Release 3 planned tables (including consumers per FR-036) in `docs/architecture/entity-ownership.md` (FR-035–FR-037, FR-036)
- [X] T044 [US2] Add explicit conceptual/derived non-table inventory in `docs/architecture/entity-ownership.md` (FR-034)
- [X] T045 [US2] Reconcile Master ERD entities to ownership rows and mark R1-P00 as architecture-contract only (never creating phase) in `docs/architecture/entity-ownership.md` (FR-011, FR-039)
- [X] T046 [US2] Run orphan/duplicate/multi-owner scan and record zero-conflict result or FR-064 blockers in `docs/architecture/entity-ownership.md` (FR-038; SC-005)
- [X] T047 [US2] Document sampling worksheet (≥10 entities spanning R1/R2/R3) for SC-010 in `docs/architecture/entity-ownership.md` (SC-010)
- [X] T048 [US2] Run Stage 3 checks from `specs/R1-P00-product-database-architecture/quickstart.md` and record results in `specs/R1-P00-product-database-architecture/implementation-summary.md` (SC-002, SC-005, SC-010)

**Checkpoint**: Ownership map independently reviewable for US2.

---

## Phase 5: User Story 3 - Apply Consistent Database Conventions (Priority: P2)

**Goal**: One conventions document so future phases make consistent local data decisions without reopening global rules.

**Independent Test**: For representative authoritative, snapshot, configurable, auditable, and financial records, resolve every FR-040–FR-056 topic without inventing product rules (US3; SC-008).

### Documentation validation for User Story 3

- [X] T049 [US3] Add US3 acceptance checklist mapped to FR-040–FR-056 and SC-008 in `docs/architecture/database-conventions.md` (FR-066)

### Implementation for User Story 3

- [X] T050 [US3] Write naming, identifier (including FR-041 primary vs business/external IDs), and relationship/FK conventions in `docs/architecture/database-conventions.md` (FR-040, FR-041, FR-042)
- [X] T051 [US3] Write timestamp and deletion/deactivation conventions in `docs/architecture/database-conventions.md` (FR-043–FR-044)
- [X] T052 [US3] Write status/enum-evolution conventions leaving OQ-010 booking/order/emergency enums provisional to R1-P13 in `docs/architecture/database-conventions.md` (FR-045, FR-060)
- [X] T053 [US3] Write money, country/currency (`countryCode` per FR-047), and localization conventions in `docs/architecture/database-conventions.md` (FR-046, FR-047, FR-048; constitution VI)
- [X] T054 [US3] Write historical-snapshot and immutable-financial conventions (compensating entries; no hard-delete) in `docs/architecture/database-conventions.md` (FR-049–FR-050; DEC-003)
- [X] T055 [US3] Write index/unique-constraint and audit-field conventions in `docs/architecture/database-conventions.md` (FR-051–FR-052)
- [X] T056 [US3] Write phase-owned Prisma migration strategy (naming `r{rel}_p{nn}_{slug}`, SQL review, applied-migration immutability per FR-054, forward-only fixes, seed/backfill ownership) in `docs/architecture/database-conventions.md` (FR-053, FR-054, FR-055; constitution IV, X; DEC-014)
- [X] T057 [US3] Write public-contract persistence boundary (no raw Prisma types across modules) in `docs/architecture/database-conventions.md` (FR-056; constitution III)
- [X] T058 [US3] Run Stage 4 checklist (17/17 topics) from `specs/R1-P00-product-database-architecture/quickstart.md` and record results in `specs/R1-P00-product-database-architecture/implementation-summary.md` (SC-008)

**Checkpoint**: Conventions independently usable for future database-changing phases.

---

## Phase 6: User Story 4 - Review State-Transition Safety Without Inventing Statuses (Priority: P2)

**Goal**: Reusable transition design with seven required fields while OQ-010 remains unresolved under R1-P13.

**Independent Test**: Review sample provisional transitions for provider lifecycle, booking/order progression, completion, cancellation, privileged override, and emergency handling; confirm enums remain open (US4; SC-012).

### Documentation validation for User Story 4

- [X] T059 [US4] Add US4 acceptance checklist mapped to FR-057–FR-061 and SC-012 in `docs/architecture/status-machine-draft.md` (FR-066)

### Implementation for User Story 4

- [X] T060 [US4] Define transition record format (actor, from, to, preconditions, side effects, audit, failure/rejection) plus backend authority, ownership checks, stale-state rejection, and idempotent side effects in `docs/architecture/status-machine-draft.md` (FR-057–FR-058, FR-061)
- [X] T061 [US4] Add sample provisional transitions for provider lifecycle using conceptual labels only in `docs/architecture/status-machine-draft.md` (FR-059)
- [X] T062 [US4] Add sample provisional transitions for booking/order progression and completion in `docs/architecture/status-machine-draft.md` (FR-059; OQ-010 provisional)
- [X] T063 [US4] Add sample provisional transitions for cancellation and failure without fee invention (OQ-001) in `docs/architecture/status-machine-draft.md` (FR-059)
- [X] T064 [US4] Add sample privileged-override transition with permission, reason, before/after, actor, timestamp, audit expectations in `docs/architecture/status-machine-draft.md` (FR-058–FR-059)
- [X] T065 [US4] Add emergency-related transition samples marked provisional; state emergency final form undecided under OQ-010 → R1-P13 in `docs/architecture/status-machine-draft.md` (FR-059–FR-060; SC-012)
- [X] T066 [US4] Run Stage 5 checks from `specs/R1-P00-product-database-architecture/quickstart.md` and record results in `specs/R1-P00-product-database-architecture/implementation-summary.md` (SC-012)

**Checkpoint**: Status-machine draft independently reviewable; OQ-010 still open.

---

## Phase 7: User Story 5 - Contain Open Product Questions (Priority: P2)

**Goal**: Every OQ visibly classified so architecture can be approved without invented product behavior.

**Independent Test**: Reconcile every ID in `docs/product/open-questions.md` with deliverables (US5; SC-004).

### Documentation validation for User Story 5

- [X] T067 [US5] Add US5 acceptance checklist mapped to FR-062–FR-065 and SC-004 in `specs/R1-P00-product-database-architecture/implementation-summary.md` (FR-066)

### Implementation for User Story 5

- [X] T068 [US5] Audit `docs/architecture/master-erd.md` for silent OQ resolutions and fix language to remain provisional where required (FR-005, FR-065)
- [X] T069 [P] [US5] Audit `docs/architecture/entity-ownership.md` for silent OQ resolutions and align with `docs/product/open-questions.md` (FR-065; SC-004)
- [X] T070 [P] [US5] Audit `docs/architecture/database-conventions.md` for silent OQ resolutions, especially OQ-010 (FR-065, FR-060)
- [X] T071 [P] [US5] Audit `docs/architecture/status-machine-draft.md` for silent OQ resolutions, especially OQ-010 emergency/enum wording (FR-065, FR-060)
- [X] T072 [US5] Verify OQ-003, OQ-004, OQ-006, and OQ-008 remain explicitly unassigned/excluded in `docs/architecture/entity-ownership.md` (FR-062; spec open-questions note)
- [X] T073 [US5] Run Stage 6 open-question checks from `specs/R1-P00-product-database-architecture/quickstart.md` and record PASS/FAIL in `specs/R1-P00-product-database-architecture/implementation-summary.md` (SC-004)

**Checkpoint**: Open questions contained across all deliverables; nothing invented.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, link/placeholder hygiene, Definition of Done evidence, and implementation summary — without marking the phase Complete.

- [X] T074 Map each Edge Case from `specs/R1-P00-product-database-architecture/spec.md` to a concrete section in `docs/architecture/master-erd.md` or `docs/architecture/entity-ownership.md` and record the mapping in `specs/R1-P00-product-database-architecture/implementation-summary.md` (spec Edge Cases; FR-008)
- [X] T075 Cross-check module names, entity names, and OQ IDs for consistency across `docs/architecture/master-erd.md`, `docs/architecture/entity-ownership.md`, `docs/architecture/database-conventions.md`, and `docs/architecture/status-machine-draft.md` (FR-004, FR-006)
- [X] T076 Verify each of the four deliverables references `docs/product/standalone-project-boundary.md` and that `docs/architecture/standalone-project-boundary.md` does not exist (FR-003; SC-009; quickstart Stage 1)
- [X] T077 Run broken-link check for relative markdown links inside `docs/architecture/master-erd.md`, `docs/architecture/entity-ownership.md`, `docs/architecture/database-conventions.md`, `docs/architecture/status-machine-draft.md`, and `specs/R1-P00-product-database-architecture/implementation-summary.md` (FR-008)
- [X] T078 Scan the four architecture deliverables and `specs/R1-P00-product-database-architecture/implementation-summary.md` for unresolved placeholders (`TODO`, `TBD`, `[NEEDS CLARIFICATION]`, empty scaffold sections) and resolve or convert to explicit OQ-linked deferrals (FR-005; constitution V)
- [X] T079 Confirm negative exclusions: no edits to `prisma/schema.prisma`, no new migrations, no `src` product modules, no dependency installs, no Docker/cloud files — record proof in `specs/R1-P00-product-database-architecture/implementation-summary.md` (FR-007, SC-013; constitution IV, IX)
- [X] T080 Execute roadmap Done When / Stage 7 checklist from `specs/R1-P00-product-database-architecture/quickstart.md` and record an objective approve/reject recommendation (not human completion) in `specs/R1-P00-product-database-architecture/implementation-summary.md` (SC-014; FR-008; constitution VIII — do not mark Complete)
- [X] T081 Finalize `specs/R1-P00-product-database-architecture/implementation-summary.md` with files changed, traceability to FR/SC, validation evidence, remaining human approval points, and explicit statement that phase Complete requires separate human approval (constitution II, VIII)
- [X] T082 Update `Last Updated` in `docs/product/current.md` after documentation work; leave Status as `In Progress` pending human completion approval (constitution VIII)

**Checkpoint**: Deliverables consistent and evidence-backed; ready for human architecture review — not auto-complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start here (includes In Progress)
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user stories
- **Phase 3 (US1 / Master ERD)**: Depends on Phase 2 — MVP documentation increment
- **Phase 4 (US2 / Ownership)**: Depends on Phase 2; should follow US1 entity coverage for reconciliation (T045)
- **Phase 5 (US3 / Conventions)**: Depends on Phase 2; can proceed after Phase 2 in parallel with US1/US2 if staffed, but prefer after US1 legend exists
- **Phase 6 (US4 / Status machine)**: Depends on Phase 2; booking/order samples should align with US1 boundary text (T035)
- **Phase 7 (US5 / OQ containment)**: Depends on Phases 3–6 deliverable bodies existing
- **Phase 8 (Polish)**: Depends on Phases 3–7

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational; T045 depends on US1 entity list
- **US3 (P2)**: After Foundational; independent of US2 content
- **US4 (P2)**: After Foundational; align with US1 booking/order boundary
- **US5 (P2)**: After US1–US4 bodies exist

### Parallel Opportunities

- T005, T006, T007 after T004 pattern known (scaffolds on **different files**)
- T012, T013, T014 boundary reference sections on **different files**
- T069, T070, T071 OQ audits on **different files**
- Same-file body tasks (Master ERD, ownership rows, conventions subsections, status samples) are **sequential** — no `[P]`

---

## Parallel Example: Foundational boundary refs

```text
Task: "Add standalone-boundary reference in docs/architecture/entity-ownership.md"
Task: "Add standalone-boundary reference in docs/architecture/database-conventions.md"
Task: "Add standalone-boundary reference in docs/architecture/status-machine-draft.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup (In Progress + scaffolds)
2. Complete Phase 2 Foundational
3. Complete Phase 3 US1 Master ERD + Stage 2 validation
4. **STOP and VALIDATE**: Architecture reviewer can assess global model direction

### Incremental Delivery

1. US1 Master ERD → reviewable conceptual model
2. US2 Ownership map → incremental migration planning unblocked
3. US3 Conventions → future Prisma phases unblocked
4. US4 Status-machine draft → transition safety without OQ-010 freeze
5. US5 OQ audit → invention control
6. Polish → DoD evidence + implementation summary for human review

### Forbidden during all tasks

- Editing `prisma/schema.prisma` or creating migrations
- Creating `src` application code, APIs, auth, or runtime tests
- Installing dependencies
- Implementing R1-P01 or any future phase
- Docker or cloud work
- Git commit, push, merge, or deployment
- Setting `docs/product/current.md` Status to `Complete`
- Resolving OQ-010 or inventing other open product decisions

---

## Notes

- Traceability: each task cites FR/SC/DEC/OQ/constitution in its description
- OQ-010 remains provisional; resolution owner is R1-P13
- Format: all tasks use `- [X] T### ...` with paths; `[P]` only when different files
- Analysis remediations applied: invalid same-file `[P]` removed; FR-001/009/036/041/047/054 cited; edge-case mapping added
- Total tasks: **82** (T001–T082)

---

## Phase 9: Convergence

**Purpose**: Close gaps found by `/speckit-converge` against the completed R1-P00 documentation deliverables. Documentation-only; do not touch Prisma, `src`, or phase Complete.

- [X] T083 Replace the generic consumer placeholder on every ownership row in `docs/architecture/entity-ownership.md` with important cross-module consumers and the business purpose of each consumption (or an explicit “none beyond owner” note) per FR-036, SC-002 (partial)
- [X] T084 Add an explicit Consumer column (module + purpose) to every important relationship row in `docs/architecture/master-erd.md` Important relationships table per FR-033, SC-003 (partial)
- [X] T085 Document marketer external payout destinations as structurally separate from marketer dues, settlements, and payout records in `docs/architecture/master-erd.md` §14 (and cross-check ownership rows) per FR-028, SC-007 (partial)

# Research: R1-P00 — Product & Database Architecture

**Date**: 2026-07-24  
**Phase**: `R1-P00` (documentation and architecture only)  
**Spec**: [spec.md](./spec.md)

## Research purpose

Resolve planning unknowns for a documentation-only phase that freezes the
implementation contract before product migrations. No runtime stack choice for
application behavior is required in this phase.

## Pre-flight confirmations

| Check | Result |
|---|---|
| Active phase | `R1-P00 — Product & Database Architecture` (`docs/product/current.md`) |
| OQ-010 resolution owner | `R1-P13` (confirmed in `open-questions.md` and `spec.md`) |
| Material product blockers for R1-P00 | None — OQ-001–OQ-014 are deferred with containment rules |
| Runtime implementation in R1-P00 | Forbidden by FR-007, constitution IV/X, DEC-014 |

---

## Decision 1 — Phase classification and artifact set

**Decision**: Treat R1-P00 as an architecture-documentation phase. Planning and
later implementation produce only Spec Kit plan artifacts plus four new
canonical deliverables under `docs/architecture/`. Do not create product Prisma
models, migrations, seeds, source modules, APIs, or runtime tests.

**Rationale**: DEC-014, constitution Principle IV, roadmap R1-P00, and FR-007
require design-globally / implement-locally / migrate-incrementally. The Master
ERD is an architectural map, not the first production migration.

**Alternatives considered**:

- Creating a bootstrap Prisma schema now — rejected; invents future-phase tables.
- Deferring architecture docs to R1-P01 — rejected; roadmap Done When requires
  the architecture contract before product migrations.

**Trace**: FR-001–FR-008, SC-013, DEC-014, roadmap §3 / R1-P00.

---

## Decision 2 — Canonical deliverable paths and standalone boundary

**Decision**: Later implementation creates exactly:

- `docs/architecture/master-erd.md`
- `docs/architecture/database-conventions.md`
- `docs/architecture/entity-ownership.md`
- `docs/architecture/status-machine-draft.md`

Validate and reference the existing
`docs/product/standalone-project-boundary.md`. Do **not** create
`docs/architecture/standalone-project-boundary.md` or any competing boundary
document. The roadmap R1-P00 database-output list matches this split: four new
architecture files under `docs/architecture/`, plus validate/reference of the
existing product boundary file.

**Rationale**: FR-002 and FR-003 require exactly four new architecture files and
one canonical standalone boundary already present under `docs/product/`.

**Alternatives considered**:

- Copying a second boundary file under `docs/architecture/` — rejected; FR-003
  and SC-009 forbid duplication.
- Leaving boundary unreferenced — rejected; FR-003 requires validation/reference.

**Trace**: FR-002, FR-003, SC-009, DEC-012, standalone-project-boundary.md.

---

## Decision 3 — Modular-monolith module catalog for ownership mapping

**Decision**: Use a planned business-module catalog derived from the
specification entity families and existing modular-monolith ADRs. Modules are
ownership labels for the Master ERD and entity-ownership map. No module source
tree is created in R1-P00.

Planned modules (architecture labels):

| Module label | Primary entity families | First creating phases (indicative) |
|---|---|---|
| `identity` | User, auth links, verification, roles/permissions, bans | R1-P02, R1-P03 |
| `customers` | Customer profile/type, preferences, textual address | R1-P04 |
| `providers` | Provider, workers, teams, verification, coverage, payout destinations | R1-P05–R1-P07, R1-P09–R1-P10 |
| `catalog` | Categories, services, localization, requirements, units | R1-P08 |
| `eligibility` | Shared Browse/Recommended eligibility inputs/results | R1-P11; R3-P03 extends |
| `bookings` | Booking draft/confirmation, Recommended commercial path, snapshots | R1-P12–R1-P13; R3 booking path extensions |
| `orders` | Executable order, assignment evidence, completion, cancellation events, emergency records | R1-P16–R1-P19 |
| `payments` | Payment methods/attempts, deposits, ledger, dues, settlements, payouts, refunds/adjustments | R1-P14–R1-P15, R1-P20–R1-P21 |
| `ratings` | Provider/team ratings, reviews, aggregates | R1-P22 |
| `notifications` | Templates, localizations, deliveries | R1-P23 |
| `support` | Tickets, replies, assignments, dossiers links | R1-P24 |
| `admin` | Staff controls, privileged actions, operational/finance control surfaces | R1-P25 |
| `configuration` | Country, currency, locale, global/country configs | R1-P01 |
| `media` | Protected object references and attachment metadata (business-neutral storage) | consumed by owning phases |
| `marketers` | Marketer identity, referrals, commissions, settlements, premium | R2-P01–R2-P07 |
| `geo` | Coordinates, zones, distance, consent, live location | R3-P01–R3-P02, R3-P09–R3-P11 |

Shared technical areas (`core`, `integrations`, `shared`) remain business-neutral
and MUST NOT own business lifecycle tables.

**Rationale**: FR-010, FR-031, FR-035, and modular-monolith rules require one
lifecycle owner per planned table and module grouping on the Master ERD.

**Alternatives considered**:

- One mega-domain module — rejected; violates modular ownership.
- Microservice split — rejected; ADR-0001 / constitution III.
- Inventing runtime folder layout now — rejected; FR-007 / overview.md create
  modules only when owning phases begin.

**Trace**: FR-010, FR-031–FR-039, ADR-0001, modular-monolith.md, overview.md.

---

## Decision 4 — Planned-table inventory source of truth

**Decision**: The complete planned-table inventory for entity-ownership.md is
the union of every roadmap phase `### Tables` list across R1/R2/R3, plus any
conceptual entity the Master ERD proves must be persisted, explicitly marked
conceptual/derived when no table is required. Roadmap table names are
inventory candidates, not frozen Prisma model names.

**Rationale**: Spec assumptions and roadmap §3 state exact model names follow
approved Prisma conventions during the owning phase. R1-P00 assigns ownership;
it does not freeze final Prisma identifiers.

**Alternatives considered**:

- Treating roadmap table names as final schema — rejected; roadmap itself says
  not to copy blindly.
- Inventing tables for every conceptual entity — rejected; derived entities may
  remain non-persisted (FR-034, edge cases).

**Trace**: FR-034–FR-039, SC-002, SC-005, roadmap §3, spec Assumptions.

---

## Decision 5 — Database convention baseline (for later conventions doc)

**Decision**: Future `database-conventions.md` MUST encode these locked
baselines without inventing product enum values:

| Topic | Baseline rule |
|---|---|
| Naming | snake_case tables/columns in DB; Prisma models follow existing repo Prisma conventions when introduced; relation and snapshot fields use explicit suffixes (`_id`, `_snapshot`, `_at`) |
| Identifiers | Opaque surrogate primary keys; business/external identifiers are distinct unique fields when needed |
| Timestamps | `created_at` required on persisted records; `updated_at` only on mutable authoritative records; immutable/event/financial records omit mutability-implying `updated_at` |
| Money | Decimal-safe types, explicit currency, server-calculated totals; no float money |
| Country | `country_code` for country-sensitive rules; no hidden Egypt-only business defaults |
| Localization | Arabic/English content with explicit ownership, uniqueness scope, and fallback rules |
| Soft delete | Prefer deactivation/status for live authoritative records; never hard-delete financial, audit, or confirmed historical business records |
| Addresses | R1 textual address owned by customer/booking contexts; R3 geo extensions attach to the same address concept rather than a competing identity |
| Indexes/constraints | Added in the same phase that introduces the query or invariant; unique constraints for identities, idempotency keys, and ownership invariants |
| Enum evolution | Use provisional conceptual labels until owning phase freezes values; OQ-010 booking/order/emergency enums freeze in R1-P13 via transition matrix |
| Migrations | Phase-owned name `r{release}_p{nn}_{short_description}`; SQL review mandatory; applied migrations immutable; corrections forward-only |
| Public contracts | Raw Prisma types never cross module public APIs |

**Rationale**: FR-040–FR-056, constitution VI/X, database-prisma.md, DEC-014.

**Alternatives considered**:

- Freezing booking/order enum names in R1-P00 — rejected; OQ-010 / FR-060.
- Editing applied migrations for hotfixes — rejected; constitution X.
- Soft-deleting ledger entries — rejected; DEC-003 financial immutability /
  FR-050.

**Trace**: FR-040–FR-056, SC-008, OQ-010 → R1-P13, DEC-014.

---

## Decision 6 — Booking/order boundary and status-machine format

**Decision**:

1. **Booking** = commercial intent, configuration, pricing snapshot, and
   confirmation boundary.
2. **Order** = executable fulfillment lifecycle after the confirmation/activation
   invariant documented in the Master ERD and status-machine draft.
3. Browse and accepted Recommended offers converge into the same confirmed
   booking/order and financial paths while preserving path source history.
4. Status-machine draft uses a reusable transition record format with seven
   required fields: actor, from state, to state, preconditions, side effects,
   audit requirement, failure/rejection outcome — plus backend authority,
   ownership checks, stale-state rejection, and idempotent side-effect notes.
5. Sample transitions use **provisional conceptual labels** only. Final
   booking/order enum names and emergency representation remain open under
   OQ-010, owned by **R1-P13**.

**Rationale**: FR-024–FR-025, FR-057–FR-061, SC-012, User Story 4, OQ-010.

**Alternatives considered**:

- Treating Browse and Recommended as separate execution domains — rejected;
  FR-018/FR-025.
- Resolving emergency as a state vs parallel concern now — rejected; OQ-010.
- Assigning OQ-010 to R1-P12 — rejected; approved correction to R1-P13
  (Browse vs Booking Draft/Status Machine).

**Trace**: FR-024, FR-025, FR-057–FR-061, SC-012, OQ-010, roadmap R1-P13.

---

## Decision 7 — Financial and wallet boundary

**Decision**: Model external payment/payout rails, payout destinations, dues,
settlements, payouts, refunds, adjustments, and append-only ledger entries.
Prohibit customer/provider/worker/marketer stored-value wallets and reusable
Cleanora-held balances. Keep external destinations structurally separate from
dues/settlements/payouts/ledger history.

**Rationale**: DEC-003, vision §16, FR-028–FR-029, SC-006–SC-007, constitution IX.

**Alternatives considered**:

- Interpreting “mobile wallet” as internal balance — rejected; DEC-003.
- Collapsing destination and due into one table — rejected; FR-028/SC-007.

**Trace**: DEC-003, FR-028, FR-029, FR-050, SC-006, SC-007.

---

## Decision 8 — Evidence and testing strategy for R1-P00

**Decision**: R1-P00 evidence is documentation validation only (see
quickstart.md): coverage, ownership uniqueness, convention completeness,
open-question reconciliation, wallet/payout negative checks, transition-format
completeness, and standalone-boundary reference checks. Runtime unit/
integration/E2E/migration tests are assigned to later phases that introduce
those risks. Release 1 evidence MUST NOT require Docker or Testcontainers.

**Rationale**: Spec risk-proportional obligations, constitution VII, FR-007.

**Alternatives considered**:

- Writing runtime tests now — rejected; no runtime behavior.
- Deferring all validation to human judgment without checklists — rejected;
  FR-008/FR-066/SC-014 require objective evidence.

**Trace**: FR-008, FR-066, SC-013, SC-014, constitution VII.

---

## Decision 9 — Skip Spec Kit `contracts/`

**Decision**: Do not create `specs/R1-P00-product-database-architecture/contracts/`.
R1-P00 exposes no runtime interface.

**Rationale**: User planning directive and FR-007. Interface contracts belong to
future phase APIs and module public `index.ts` exports.

**Alternatives considered**: Documenting fake OpenAPI stubs — rejected; implies
runtime scope.

**Trace**: FR-007, SC-013.

---

## Decision 10 — Open-question handling during architecture writing

**Decision**: Carry the spec classification table into every deliverable that
touches affected entities. Mark provisional language visibly. Do not encode fee
matrices, materials-supply rules, chat, coupons, InstaPay specifics, final
booking/order enums, emergency final form, payout production values, review
destruction rules, premium production limits, or Google audience enablement.

**Rationale**: FR-005, FR-062–FR-065, constitution V, open-questions.md.

**Alternatives considered**: Inventing temporary concrete enums “just for the
ERD” — rejected; would silently resolve OQ-010.

**Trace**: OQ-001–OQ-014, FR-005, FR-060, FR-062–FR-065, SC-004.

---

## Unresolved items requiring human product decisions

None for R1-P00 planning. Deferred OQs remain open for their owning phases and
do not block task generation for architecture documentation.

If implementation of the four deliverables discovers an ownership, cardinality,
or locked safety conflict that cannot be contained, stop and raise an R1-P00
blocker per FR-064 — do not invent an answer.

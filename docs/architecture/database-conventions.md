# Database Conventions

**Phase**: R1-P00 — Product & Database Architecture  
**Status**: Architecture contract for future phase-owned Prisma work  
**Date**: 2026-07-24  
**Canonical standalone boundary**: [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md)

## Purpose

Give every future database-changing phase one consistent rule set for naming, identity, relationships, history, money, indexes, audit, and migrations — without inventing open product decisions.

R1-P00 does **not** edit `prisma/schema.prisma` or create migrations.

## Standalone boundary validation

Conventions apply only to the Cleanora repository schema and migration history. See [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md). Do not create a duplicate boundary file here.

## Acceptance criteria (US3 / FR-040–FR-056 / SC-008)

- [x] Naming, identifiers, FKs
- [x] Timestamps and deletion
- [x] Status/enum evolution (OQ-010 open → R1-P13)
- [x] Money, country/currency, localization
- [x] Snapshots and immutable financial records
- [x] Indexes/uniques and audit fields
- [x] Phase-owned migration strategy + immutability
- [x] Public-contract persistence boundary

---

## 1. Naming (FR-040)

- Database tables/columns: `snake_case`.
- Prisma model names follow existing Cleanora Prisma conventions when introduced by the owning phase.
- Foreign keys: `<entity>_id`.
- Snapshot fields/tables: explicit `snapshot` in the name.
- Timestamp columns: `*_at`.
- External references: explicit `external_*` or provider-prefixed fields.
- Status fields: `status` or domain-specific status column; values follow enum-evolution rules below.

## 2. Identifiers (FR-041)

- Every persisted row has an opaque surrogate primary key.
- Business identifiers (phone, email, public codes) and external provider IDs are **distinct** unique fields when needed — not the primary key unless an approved exception is documented in the owning phase plan.
- Idempotency keys for replayable operations are unique where introduced.

## 3. Relationships and foreign keys (FR-042)

- Required vs optional relationships are explicit in schema nullability.
- Ownership-side placement: the owning module’s table holds the FK to another module’s authoritative id when the relationship is owned there; otherwise document the owner.
- Cross-module references store only identifiers and consume public contracts — never join another module’s repository internals.
- On-delete behavior: restrict or soft-deactivate for authoritative parents; never cascade-delete financial, audit, or confirmed historical records.

## 4. Timestamps (FR-043)

- `created_at` required on persisted records.
- `updated_at` only on mutable authoritative records.
- Immutable/event/financial/audit records MUST NOT imply mutability via `updated_at`.

## 5. Deletion and deactivation (FR-044)

- Prefer status/deactivation for live authoritative records.
- **Never hard-delete** financial, audit, or confirmed historical business records.
- Hard delete allowed only for pure technical/ephemeral data when the owning phase proves no audit/financial/history obligation.

## 6. Status representation and enum evolution (FR-045)

- Decision criteria: use enums when the set is closed and owned by the phase; use lookup/config tables when product must edit values without migration; document the choice in the phase plan.
- **OQ-010**: Final booking/order enum names and emergency modeling remain **provisional** until **R1-P13** freezes them via an approved transition matrix. R1-P00 and interim docs use conceptual labels only (e.g., `draft`, `awaiting_deposit`, `confirmed`, `in_progress`, `completed`, `cancelled`, `emergency_related`) marked provisional.
- Evolving an enum after ship requires a forward migration and compatibility evidence in the owning phase.

## 7. Money (FR-046)

- Decimal-safe types only (no float).
- Explicit currency on monetary amounts.
- Server-authoritative calculations; clients may propose, never finalize totals.
- Preserve calculation inputs and results where history must not rewrite.

## 8. Country and currency (FR-047)

- Represent country and currency as reference data.
- Country-sensitive rules require `country_code` (or equivalent) scope.
- Prohibit hidden Egypt-only assumptions in business data; Egypt may be seeded as configuration, not hard-coded into rules.

## 9. Localization (FR-048)

- Arabic and English content with explicit ownership.
- Define uniqueness scope (e.g., per parent + locale).
- Document fallback expectations (do not invent unapproved locales).

## 10. Historical snapshots (FR-049)

- Confirmed booking/order commercial values that must survive catalog/provider changes require snapshots distinguishable from live authoritative catalog/provider/customer/config records.
- Snapshots are historical; live tables remain authoritative for new work.

## 11. Immutable financial records (FR-050)

- Ledger and money movement history is append-only (or equivalently immutable).
- Corrections use traceable compensating refunds/adjustments.
- No hard delete or in-place rewrite of financial history.
- External destinations ≠ dues ≠ settlements ≠ payout results (FR-028/029).

## 12. Indexes and unique constraints (FR-051)

- Add indexes/uniques in the **same phase** that introduces the query or invariant.
- Expect uniques for identities, ownership pairs, external idempotency keys, and country-scoped business keys where required.
- Do not pre-create future-phase tables “for convenience.”

## 13. Audit fields (FR-052)

Sensitive/privileged actions require, as applicable:

- actor, timestamp, reason, target, action, before/after evidence

## 14. Phase-owned Prisma migration strategy (FR-053–FR-055)

For every later database-changing phase:

1. Inspect current `schema.prisma` and all migrations.
2. Add only active-phase models/changes.
3. Create migration named `r{release}_p{nn}_{short_description}` (example: `r1_p02_complete_authentication`).
4. Review generated SQL: defaults, backfills, indexes, constraints, destructive ops, compatibility.
5. Regenerate client; validate clean apply on an empty chronological history and earlier-phase compatibility.
6. Own seed/backfill definition, review, and evidence in the same phase.

### Applied migration immutability (FR-054)

- Do not edit, delete, reorder, or reset applied migrations.
- Corrections use a **new forward migration**.

## 15. Public-contract persistence boundary (FR-056)

- Raw Prisma models and persistence-specific types MUST NOT cross module public APIs.
- Map to stable contracts at the module boundary (constitution III).

## Exception process

Any deviation requires plan Complexity Tracking / architecture note with owner approval when it changes dependency direction or locked financial/security rules.

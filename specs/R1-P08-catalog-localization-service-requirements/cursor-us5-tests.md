# R1-P08 US5 — Snapshot-ready Catalog tests first

You are the bounded Cursor implementer for the **test-first half only** of R1-P08 User Story 5. Follow `AGENTS.md`, the active R1-P08 `spec.md`, `plan.md`, `tasks.md` (T119–T124), `test-strategy.md`, and the existing Catalog implementation/tests. Preserve the intentionally dirty worktree.

## Fixed architecture and scope

- `catalog` owns current service/category/configuration/availability/media-association truth and provides a **module-public** `CatalogDefinitionReader` only through `src/modules/catalog/catalog.public.ts`.
- A later module owns any copied historical snapshot. R1-P08 must create no Booking, Provider-price, answer, or snapshot persistence and must add no anonymous/customer Browse HTTP or router.
- Cross-module users get DTOs/public contracts only: no Prisma record, repository, controller, transaction type, storage key, uploader, provider payload, or signed delivery URL.
- Exact `AR` or `EN` is required. Never fall back to the other locale or a stable code for a missing localized label/content. An unselectable/missing item returns safe `null` or is omitted, without draft leakage.
- A snapshot-ready definition is one current service aggregate revision: stable service/category identities, service version, exact localized service/category content, country context, active price units with decimal values preserved as strings, ordered active fields/options including requiredness and applicable validation rules, ordered READY safe media references, and the lifecycle/selectability truth necessary to establish that it is current/selectable.
- Catalog keeps transaction ownership. No Media infrastructure import; no calls to Media delivery for selectable/snapshot data. No database connection, migration, seed, commit, task-marker, summary, or Companion-context change.

## Current incomplete seams to target

The existing public interface/service contains a partial reader. In particular, the current snapshot projection returns `fields: []`, has cross-locale/code fallback in price-unit labels, and Composition does not publish a narrow internal reader factory. Tests must expose the required contract rather than normalize these gaps away.

## Tests to add or extend — no production source changes in this pass

1. **T119** Extend `tests/unit/modules/r1-p08-public-contracts.test.ts` with compile/shape assertions for `CatalogDefinitionReader`, `SnapshotReadyCatalogServiceDefinition`, field option/rule structure, decimal-string values, stable Media refs, and public-contract hygiene (no Prisma/repository/HTTP types).
2. **T120** Create `tests/integration/catalog/catalog-definition.repository.test.ts`: repository projection expectations for a complete active aggregate, deterministic nested order, filtered inactive child/media facts, and one current version. Use safe fakes for executable source-level behavior; add a guarded live Prisma proof only if it has a strict `CLEANORA_R1_P08_DATABASE_URL` phase-name guard and plainly records that a skip is not completion evidence.
3. **T121** Create `tests/integration/catalog/catalog-definition-concurrency.test.ts`: fake/transaction-seam tests that prove the reader never combines an old aggregate version with new child/association facts. A guarded real PostgreSQL concurrent proof is allowed but must skip without the same approved phase-name target; do not run it.
4. **T122** Create `tests/integration/catalog/catalog-selectable-definition.test.ts`: service-reader tests for exact AR/EN (including no-fallback), active `EG`, unavailable/inactive/draft omission, stable deterministic ordering and bounded pagination, full active price-unit/field/option DTOs, and safe READY Media references only. No HTTP request is involved.
5. **T123** Create `tests/integration/catalog/catalog-snapshot-boundary.test.ts`: copying the returned plain definition preserves the copied fixture after a later live Catalog object is changed, and the reader creates no Booking/provider price/customer answer/historical snapshot records.
6. **T124** Extend `tests/unit/modules/r1-p08-module-boundaries.test.ts` so Catalog consumers can use only `catalog.public`, while Catalog itself continues to use foreign module public contracts only.

## Test design rules

- Tests must be meaningful and should fail for the current partial US5 behavior where it is incomplete; do not weaken assertions to fit `fields: []` or locale fallback.
- Reuse existing fixture/policy helpers where they fit. Keep fakes focused; do not invent product behavior.
- Explicitly verify no public route such as `/api/v1/catalog/services` is mounted/documented; do not add routes.
- Avoid requiring a configured database. Guarded live tests are not counted as passing evidence.

## Completion boundary and verification

Do **not** edit production code, Prisma schema/migrations, seed, OpenAPI/Postman generation, `tasks.md`, `implementation-summary.md`, `.spec-context*`, docs, or Git state in this test-first pass.

Run and report exact output for:

```powershell
npm.cmd run typecheck
npm.cmd run test:r1-p08 -- tests/unit/modules/r1-p08-public-contracts.test.ts tests/integration/catalog/catalog-definition.repository.test.ts tests/integration/catalog/catalog-definition-concurrency.test.ts tests/integration/catalog/catalog-selectable-definition.test.ts tests/integration/catalog/catalog-snapshot-boundary.test.ts tests/unit/modules/r1-p08-module-boundaries.test.ts
```

Expected outcome is a useful red suite for the missing US5 implementation; if some tests pass because partial behavior already exists, report exactly which ones and why. Stop after the test-first checkpoint.

# R1-P08 US5 recovery — finish the existing partial implementation

The preceding Cursor run stopped partway through US5. Work from the current worktree; do not restart or redesign US5. This is a narrowly scoped recovery.

## Current verified partial state

- `CatalogUnitOfWork.runInReadSnapshot` was added correctly in `catalog.repository.ts` using PostgreSQL `RepeatableRead`.
- New local helpers exist in `catalog.definition-projection.ts` and `catalog.definition-reader.ts`.
- `catalog.service.ts` now imports the new reader helpers but its original reader methods are only partly wired; `typecheck` fails from missing public DTO imports plus implicit-any test callbacks.
- The DEC-041 test was not fully corrected yet: `catalog-selectable-definition.test.ts` still expects an active English-incomplete price unit to be removed while retaining a selectable service.
- The last actual `npm.cmd run typecheck` output failed only with missing `SelectableCatalogServiceSummary`, `SnapshotReadyCatalogServiceDefinition`, and `CatalogMediaReference` imports in `catalog.service.ts`, plus the two new test implicit-any diagnostics. Confirm and correct any newer error too.

## Required final shape — keep it lean

1. **One reader implementation, no duplicate app service**
   - Keep `CatalogService` as the management-neutral internal reader use-case implementation: tests already construct it and its `listSelectable` / `getSnapshotReadyDefinition` must implement correct US5 behavior.
   - Keep/reuse the pure local `catalog.definition-projection.ts` only if useful.
   - Do **not** retain a duplicate `CatalogDefinitionReaderService` that can drift from `CatalogService`. Remove the unused duplicate `catalog.definition-reader.ts` implementation or reduce it so it has no separate reader logic.
   - `catalog.public.ts` must export the small `createCatalogDefinitionReader(source: CatalogDefinitionReader)` wrapper returning only the two reader methods. It may not import Prisma/repositories/controllers/routes or expose `CatalogService`.

2. **Finish `CatalogService` correctly**
   - Fix the missing DTO imports/types and remove stale imports.
   - Use `unitOfWork.runInReadSnapshot` for internal selectable/snapshot reads. Keep write paths on `runInTransaction`.
   - Keep all candidate/configuration/association reads in that one repeatable snapshot, so an old service version cannot mix with later fields/media. Do not add a table or cache.
   - Use the exact-locale projection helper (or equivalent) to return all active fields/options and active price units, ordered, decimal bounds as strings, and READY safe Media references only.
   - No locale/code fallback. Any active price unit/field/option missing the requested required locale makes the whole service unselectable, yielding omitted list item / `null` definition. Optional help text can be null but never falls back.
   - Do not issue Media delivery URLs and do not add any route.

3. **Composition**
   - Create `catalogDefinitionReader` in `src/composition.ts` via the public factory and return it for future module wiring only. Do not mount it as HTTP.
   - It must not force Media/Cloudinary setup just to compose the reader. The existing protected staff image behavior stays as-is.

4. **Faithful test completion**
   - Correct the DEC-041 test case: with the active `PER_HOUR` price unit missing `labelEn`, `listSelectable` is empty and both requested-locale snapshot definitions are `null`; no partial service is emitted. Preserve the real no-fallback assertion.
   - Update only fakes needed to provide `runInReadSnapshot`. For the concurrency fake, simulate a frozen read snapshot across aggregate/media reads; keep the assertion that no old/new mixed version is possible and prove the reader selected the read-snapshot seam.
   - Add explicit types to the callback parameters causing implicit-any failures. Do not weaken failing requirements or remove guarded live test placeholders.

## Prohibited

No DB execution, migrations, seed, controller/route/OpenAPI/Postman changes, Booking/Provider/answer persistence, docs/tasks/summary/context changes, commit, or unrelated cleanup.

## Verification and stop

Run exactly:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08 -- tests/unit/modules/r1-p08-public-contracts.test.ts tests/integration/catalog/catalog-definition.repository.test.ts tests/integration/catalog/catalog-definition-concurrency.test.ts tests/integration/catalog/catalog-selectable-definition.test.ts tests/integration/catalog/catalog-snapshot-boundary.test.ts tests/unit/modules/r1-p08-module-boundaries.test.ts
```

Report files changed and exact results. Stop after this recovery; do not commit.

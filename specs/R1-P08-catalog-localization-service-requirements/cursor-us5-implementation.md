# R1-P08 US5 — Implement snapshot-ready internal Catalog reader

You are the bounded Cursor implementer for R1-P08 User Story 5, tasks T119–T132. Follow `AGENTS.md` and the active R1-P08 spec/plan/tasks/test strategy. Preserve unrelated dirty work.

## Architectural decision (fixed)

- Catalog owns one current, versioned service aggregate and transaction boundaries. It publishes current facts via `catalog.public.ts`; later phases own historical snapshots.
- `CatalogDefinitionReader` is composition-injected, module-public, management-neutral, and has **no HTTP route**, controller, or public Browse surface.
- Consumer direction is `later module -> catalog.public`; no consumer may import Catalog repository/service/Prisma. Catalog imports other modules only through their named public contracts.
- Media retains lifecycle/delivery/storage. The reader returns stable READY references only, never a URL or Media internals.
- No Booking/Provider-price/answer/historical snapshot persistence, schema/migration/seed, anonymous/customer Browse, frontend, commit, or database connection.

## Start with this verified test correction

The new `catalog-selectable-definition.test.ts` currently models an active `PER_HOUR` price unit with a missing `labelEn` and expects it to disappear while the service remains selectable. That contradicts owner decision DEC-041 and FR-009/FR-011/FR-025: every active selectable content element needs complete Arabic and English content. Correct this test case so a service with any active price unit/field/option missing the requested required locale is omitted from `listSelectable` and `getSnapshotReadyDefinition` returns `null`; do **not** silently filter an invalid active configuration to keep a partial service selectable. This is a correctness correction, not test weakening.

Keep inactive children omitted as before. Optional help text may remain `null`; it must never fall back to a different locale.

## Implement the red US5 behavior

1. **Public surface and factory (T119, T125, T128)**
   - Keep `catalog.public.ts` DTO-only and free of Prisma/repository/controller/route types.
   - Export a small explicit `createCatalogDefinitionReader` factory over management-neutral reader use cases. It must return only `listSelectable` and `getSnapshotReadyDefinition`, not a broad `CatalogService` object.
   - Keep fields/options ordered, numeric bounds decimal strings, and Media refs stable/safe. Do not invent extra snapshots or future capabilities.

2. **Consistency (T120–T121, T126)**
   - A `getSnapshotReadyDefinition` read must observe one real PostgreSQL repeatable-read snapshot for active-country resolution, service/category/configuration, and Media associations: complete old or complete new service version, never a mix.
   - Add the smallest Catalog-unit-of-work read-snapshot seam needed; keep write transaction behavior unchanged. It may use a repeatable-read transaction for this internal read only.
   - Reuse the existing aggregate/configuration repository data and service-version rule; do not create a second snapshot table or hard-copy data. If a test harness needs the new seam, update only its fake to faithfully model the read snapshot; preserve the test's mixed-version assertions and guarded live proof.

3. **Projection and exact selection (T122, T127, T132)**
   - Map every active field and active option into `CatalogFieldDefinition`: exact selected-locale `label`, exact selected-locale `helpText` (or `null` if legitimately absent), explicit `required`, kind-compatible text/number/selection rules, decimal min/max strings, and deterministic order.
   - Map active price units in deterministic order with the exact selected-locale label; no AR↔EN/code fallback anywhere in selectable or snapshot results.
   - A missing required selected-locale value on a category/service, active price unit, active field, or active option fails selection safely (`null`/omitted). Do not leak incomplete drafts and do not return a partial definition.
   - Include only READY safe Media refs, all from the Catalog association view; never issue delivery URLs from internal reads.
   - Preserve pagination/order and current exact-country behavior. Unknown/inactive countries or unavailable/inactive/draft services must fail safely.

4. **Composition (T129–T130)**
   - Instantiate the narrow internal reader in `src/composition.ts` and expose it only as a composition result for future module wiring. Do not mount a new router in `src/routes/index.ts` and do not create any `/api/v1/catalog/*` Browse operation.
   - Do not force Media storage configuration merely to compose the internal reader. Staff media routes retain their existing protected behavior.

5. **Boundary/safety (T123–T124, T130–T132)**
   - Keep returned definitions ordinary copyable DTO values; later mutation must not mutate a caller's already copied value.
   - Keep current explicit no Booking/provider-price/answer/history ownership assertion true.
   - Retain/extend no-Browse and public-only import checks. Do not change unrelated OpenAPI/Postman artifacts in this pass unless a compilation dependency genuinely requires it.

## Do not do

- Do not weaken the meaningful red assertions except for the DEC-041 test correction above.
- Do not make guarded PostgreSQL tests look passed or run any database command.
- Do not alter `tasks.md`, `implementation-summary.md`, `.spec-context*`, `docs/product/current.md`, migrations, seeds, generated Postman, or unrelated files.
- Do not add cache tables, historical snapshots, events, controllers, routes, authentication roles, or future-phase modules.

## Required verification

Run and report raw results:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08 -- tests/unit/modules/r1-p08-public-contracts.test.ts tests/integration/catalog/catalog-definition.repository.test.ts tests/integration/catalog/catalog-definition-concurrency.test.ts tests/integration/catalog/catalog-selectable-definition.test.ts tests/integration/catalog/catalog-snapshot-boundary.test.ts tests/unit/modules/r1-p08-module-boundaries.test.ts
```

Stop after the bounded US5 implementation and report files changed, green counts, skipped live proofs, and any residual risk. Do not commit.

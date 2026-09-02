# R1-P08 US5 — Two post-review boundary corrections

The current US5 focused suite is green, but Codex source review found two concrete correctness issues. Fix only these; preserve the verified reader/projection/read-snapshot work.

## 1. Internal reader must not depend on HTTP Authentication composition

`src/composition.ts` currently creates `catalogDefinitionReader` inside the `authentication === undefined ? undefined : ...` staff-router conditional and returns `staffCatalogRouter?.catalogDefinitionReader`.

The R1-P08 `CatalogDefinitionReader` is a module-public internal contract, not an actor/HTTP capability. Create its repository/service/factory outside the staff router conditional and return it regardless of whether the protected HTTP router is assembled. Keep protected Catalog HTTP itself conditional on Authentication exactly as it is. Do not eagerly build the Media/Cloudinary image port merely to compose the reader.

Extend `tests/unit/modules/r1-p08-module-boundaries.test.ts` with a narrow static/source assertion that the internal reader is composed independently before the staff-router conditional and remains no-Browse HTTP.

## 2. Exact missing category locale must fail safely

`CatalogService.toSelectableSummary` calls `resolveExactLocaleContent` for category content after selection validation. A stored active category missing requested-locale name/description can throw instead of returning the contract's safe `null`/omission.

Ensure any `CatalogError` from exact service or category locale resolution results in `null` from the summary, so:
- `listSelectable` omits that service;
- `getSnapshotReadyDefinition` returns `null`;
- no other locale or stable code becomes fallback;
- no exception leaks to a later module.

Extend `tests/integration/catalog/catalog-selectable-definition.test.ts` with an active category missing EN (and, where useful, AR) content proof that list/detail fail safely. Do not weaken the DEC-041 active-child missing-label test; it must continue to make the whole service unselectable.

## Boundaries

No schema/migration/seed/database execution, Media changes, routes/controllers/OpenAPI/Postman/docs/tasks/summary/context/Git changes, Booking/Provider/answer data, or broad refactor.

## Verify

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08 -- tests/unit/modules/r1-p08-public-contracts.test.ts tests/integration/catalog/catalog-definition.repository.test.ts tests/integration/catalog/catalog-definition-concurrency.test.ts tests/integration/catalog/catalog-selectable-definition.test.ts tests/integration/catalog/catalog-snapshot-boundary.test.ts tests/unit/modules/r1-p08-module-boundaries.test.ts
```

Report exact results and stop; do not commit.

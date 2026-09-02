# R1-P08 Cursor delta: restore one coherent US1 API

Continue the existing R1-P08 implementation session. Work directly in the current worktree and preserve all existing unrelated dirty files.

## Hard boundaries

- Do not commit, push, stage, stash, reset, restore, clean, merge, or rewrite Git history.
- Do not connect to any database and do not run migration/seed/live-database proof.
- Do not add public or customer Browse HTTP. R1-P08 HTTP remains protected staff management only.
- Do not move beyond the currently implemented Foundation/US1 surface until every command below passes independently.
- Do not spawn another Cursor subagent/task for this correction. Make the focused edits in this same session.
- Never use a semicolon, pipe, or command chain in a way that can hide an earlier failing exit code.

## Independent failure evidence

`npm.cmd run typecheck` currently exits 1 with these real failures:

1. `PrismaCatalogRepository` implements the new `CatalogRepository` API, while `CatalogService` still calls the abandoned names `findCategoryById`, `createCategory`, `updateCategoryContent`, `setCategoryLifecycle`, `bumpChildServiceVersions`, `findServiceById`, `createService`, `moveService`, and `setServiceLifecycle`.
2. Create-category and create-service runtime bodies correctly omit `displayOrder` per the canonical design contract, but the service still reads `body.displayOrder`.
3. Move-service calls require an internally computed target-category display order.
4. Controller list calls violate `exactOptionalPropertyTypes` by passing present properties whose value may be `undefined`.
5. The denied-authorization test mock widens `denialCode` to plain `string`.
6. Runtime OpenAPI incorrectly requires `displayOrder` in create commands, contradicting `specs/R1-P08-catalog-localization-service-requirements/contracts/catalog-api.openapi.yaml`, where `CreateCategoryCommand` requires only `code` plus content and `CreateServiceCommand` requires `categoryId`, `code`, and `translations`.

## Required correction

Keep the single repository interface/class now present in `catalog.repository.ts` and align all consumers to it:

- `findCategoryById` -> `findCategory`
- create category: call `nextCategoryDisplayOrder(tx)`, then `insertCategory(...)`
- category content update: call `updateCategory(...)` with `content`
- category lifecycle: call `updateCategory(...)` with `isActive`
- where child versions must be bumped, call `lockChildServiceIds(...)` then `bumpServiceVersions(...)`
- `findServiceById` -> `findService`
- create service: call `nextServiceDisplayOrder(tx, categoryId)`, then `insertService(...)`
- move service: call `nextServiceDisplayOrder(tx, targetCategoryId)`, then `updateService(...)` with `categoryId` and computed `displayOrder`
- service lifecycle: call `updateService(...)` with `isActive`

Do not add `displayOrder` back to create request schemas. Remove it from runtime OpenAPI create command requirements/properties so runtime matches the canonical design contract. Responses may and should retain `displayOrder`.

For controller query inputs, build objects that omit absent optional keys rather than assigning `undefined`. Narrow the test denial code using the real authorization decision type or an `as const` literal; do not weaken production types.

Preserve the existing idempotency, authorization recheck, audit, version-CAS, localization, and no-Browse-HTTP behavior.

## Verification — each command must run separately

Run and report the exit code for each command independently:

1. `npm.cmd run typecheck`
2. `npm.cmd run lint`
3. `npm.cmd run test:r1-p08`
4. `git diff --check`

If any command fails, fix it and rerun that exact command. Do not mark any additional task complete unless its implementation exists and all prerequisite checks relevant to it pass. Leave live DB proof tasks blocked because no safe R1-P08 database target has been approved.

After the four checks are green, stop and report:

- exact files changed in this correction;
- exact exit code and test count for every check;
- which T-numbers you believe now have implementation evidence;
- remaining open T-numbers and blockers.

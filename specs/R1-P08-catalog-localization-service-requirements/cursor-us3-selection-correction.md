# Cursor correction brief — R1-P08 US3 selectability and availability determinism

This is a narrow correction to the just-implemented US3 slice. Do not expand
scope or modify unrelated dirty files.

Read `AGENTS.md`, the active R1-P08 `spec.md`, and the current Catalog source
before editing. DEC-041 through DEC-044 remain binding. Do not run migrations,
seed a database, modify Prisma schema/migrations, add public/anonymous Browse
HTTP, or edit task/status files.

## Correct these two issues

1. **Defensive full configuration validation for internal selectability**

   `CatalogService.toSelectableSummary` currently calls `isServiceSelectable`
   with a label-only projection. It must also deny a candidate when an *active*
   stored field violates any DEC-042 kind/constraint/options rule—even if that
   data predates or bypassed the normal management validation. Reuse the
   existing `assertActiveServiceStoredConfiguration` with the actual stored
   candidate graph; map a `CatalogError` caused by invalid/incomplete catalog
   data to `null` (not a draft-leaking distinction or an HTTP surface). Do not
   suppress unexpected non-Catalog errors. Keep exact locale and active child
   filtering behavior intact.

2. **Reject duplicated availability country codes at the HTTP schema boundary**

   `replaceServiceAvailabilityBodySchema` represents a full country
   replacement. It must reject duplicate normalized `countryCode` entries
   deterministically rather than let last-write-win happen in the repository.
   Preserve the allowed body as exactly `{ countryCode, isAvailable }` per item;
   do not accept `countryId`, `active`, or `isActive` client facts.

## Allowed files

- `src/modules/catalog/catalog.service.ts`
- `src/modules/catalog/catalog.schema.ts`
- `tests/integration/http/catalog-availability-lifecycle.test.ts`
- one focused Catalog unit test only if it is necessary to prove the
  selectability regression

No other files unless an existing typed import requires it. If so, stop and
report why.

## Required tests

- Add a regression proving an invalid active persisted field graph does not
  produce a selectable result, while a valid graph still can.
- Add a boundary regression that duplicate country codes produce a validation
  failure before `replaceServiceAvailability` is invoked.
- Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog-lifecycle.policy.test.ts tests/integration/http/catalog-availability-lifecycle.test.ts
```

Report files changed, exact results, and any skipped DB proof. Do not commit or
change task checkboxes/implementation summary.

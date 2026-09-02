# Cursor delegation — R1-P08 US2 active-service invariant only

Work in the current R1-P08 workspace. Preserve every existing change and the intentional dirty worktree. Do not reset, restore, delete, stage, commit, push, run migrations, connect to a database, or touch US3+.

## Defect to correct

`CatalogService.replaceServiceConfiguration` validates active child labels and active-service translations, but an **already active** service can currently submit a configuration with zero active price units. That violates the canonical phase rule: an active service requires at least one active, complete price unit. The command must not leave an active aggregate invalid.

## Bounded correction

1. In `src/modules/catalog/catalog.service.ts`, after normalizing/validating the configuration graph and before repository mutation, enforce for `current.isActive === true`:
   - complete AR/EN service translations as already required;
   - at least one `graph.priceUnits` item has `isActive === true`.
   - Throw the existing safe Catalog activation/configuration error appropriate to incomplete activation. Do not invent another lifecycle state or error taxonomy.
   - An inactive service remains a draft and may still save zero/incomplete price units and fields.
   - Failure must happen before `replaceServiceConfiguration`, audit append, receipt completion, and service version bump.

2. Extend the focused non-DB service test suite (the existing Catalog service test or a narrowly named US2 test) to prove:
   - active service + zero active price units is rejected and makes no persistence/audit/receipt mutation;
   - active service + one bilingual active price unit reaches the repository path;
   - inactive service can save an incomplete/no-active-unit draft.

3. Update no task checkboxes or implementation summary in this turn. Do not alter OpenAPI/Postman/controller/routes/repository/migration.

Run only:
```powershell
npm.cmd run typecheck
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog.service.test.ts tests/unit/catalog/catalog-output-redaction.test.ts
```

Report changed files and exact results. Do not claim live DB/race evidence.

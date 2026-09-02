# Cursor delegation — R1-P08 US2 repository correction only

Work in the current R1-P08 workspace. Preserve all prior work and the intentional dirty worktree. Do not reset, delete, restore, stage, commit, push, run migrations, connect to a database, or touch US3+ scope.

## Why this correction is required

The current partial `PrismaCatalogRepository.replaceServiceConfiguration` was written from a stale delta and **deletes omitted units, fields, and options**. That conflicts with the canonical frozen phase decision in `specs/R1-P08-catalog-localization-service-requirements/implementation-prompt.md` lines 56–59:

- Full configuration replacement retains omitted stable units, fields, and options **as inactive**.
- It preserves their stable identities and never hard-deletes those Catalog children.
- Omitted countries are US3; do not add them here.

Correct the repository to that canonical behavior.

## Exact bounded work

1. Modify only the configuration-related implementation in `src/modules/catalog/catalog.repository.ts` as necessary:
   - Existing child IDs remain intact when their stable `code`/`value` is present or omitted.
   - For an omitted price unit, set `isActive: false`; retain its labels/code/ID.
   - For an omitted field, set `isActive: false`; retain its labels/code/ID. Its stored options must also be inactive because they are omitted with the field.
   - For a present select field, omitted existing options become inactive while retaining IDs/value/labels. Existing input identities update in place; new identities create.
   - Do **not** use `delete`, `deleteMany`, cascade assumptions, or a hard-delete endpoint in this replacement path.
   - Make management reads deterministic: translations by locale, units/fields/options by display order then ID (sorting after retrieval is acceptable if current mapper is the deterministic boundary).
   - Safely handle a reordered full graph under the existing unique `(parent, display_order)` indexes and non-negative checks. Existing rows must be moved to a collision-free non-negative temporary range before final contiguous request-order positions are assigned. Omitted retained rows should receive deterministic trailing positions. Do not change migration SQL or relax the database constraints.
   - Preserve the existing service `FOR UPDATE` lock and one parent CAS version bump. Keep all writes in the caller's transaction.
   - Full configuration translations must not be hard deleted. Preserve existing locale identities; any translation semantics you retain must keep drafts nullable and never provide locale fallback.

2. Add `tests/integration/catalog/catalog-configuration.repository.test.ts` (database-free recording/fake transaction seam is acceptable) proving at least:
   - unchanged unit/field/option stable identities preserve their IDs;
   - omitted unit/field/option identities are retained but inactive, never deleted;
   - request ordering is normalized deterministically without unique-position collisions;
   - stale `expectedVersion` leaves the replacement unapplied.

3. Run only:
   ```powershell
   npm.cmd run typecheck
   npm.cmd run test:r1-p08 -- tests/integration/catalog/catalog-configuration.repository.test.ts tests/unit/catalog/service-field.policy.test.ts tests/unit/catalog/service-price-unit.policy.test.ts tests/unit/catalog/catalog-configuration.schema.test.ts
   ```

Do not modify service/controller/routes/OpenAPI/Postman/tasks/implementation-summary in this delegation. Report changed files, test count, and any limitation without claiming live-database or race proof.

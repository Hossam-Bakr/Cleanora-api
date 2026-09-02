# Cursor delegation — R1-P08 US3 pure policy implementation only

Work in the existing R1-P08 workspace. Preserve all current work and the intentionally dirty worktree. Do not reset, restore, delete, stage, commit, push, run migrations/seeds, connect to a database, or touch repository/service/controller/routes/OpenAPI/Postman/`prisma/seed.ts`.

## Scope

Make only US3 pure-policy tests pass: T075, T076, T077, T081. Implement the missing exports in `src/modules/catalog/catalog.policy.ts`, using existing `CatalogError`, DEC-041–044, active-field/price-unit validation, and order-vector helpers. Keep the helpers small, typed, and generic; do not build a rules engine.

The existing four test files are the executable acceptance surface. Preserve their assertions unless an assertion conflicts with the active spec/plan/research; if so, stop and report the conflict rather than weakening it.

Implement exactly these behaviors:

1. **Lifecycle / selectable (T075):**
   - `assertServiceActivationPolicy`: `DEACTIVATE` permits incomplete drafts. `ACTIVATE` requires active parent category, complete AR/EN service translations, at least one active complete price unit, and every active field/option bilingual and valid; zero active fields is allowed.
   - `listSelectableChildren`: return only active units/fields (and active options on selected fields), preserving input order; do not expose inactive drafts.
   - `resolveExactLocaleContent`: find only the requested AR/EN translation, require trimmed name/description, fail safely (`CatalogError`) if absent/incomplete; never fallback.
   - `isServiceSelectable`: return boolean rather than throw; require authoritative active country, active category/service, available service-country relation, an exact valid locale, active complete unit, and valid active child graph. A no-field service remains selectable.
2. **Country ownership (T076):**
   - `resolveCatalogCountryForAvailability(reader, countryCode)`: use only `ActiveCountryReader.resolveActiveCountry`, map inactive/unknown reader failures to safe `CATALOG_COUNTRY_UNAVAILABLE`; never create/upsert Country truth.
   - `assertNoClientInventedCountryFacts`: allow only a stable country code; reject request-supplied country ID or active/inactive status facts.
3. **Full exact orders (T077):**
   - `contiguousDisplayOrders(count)` produces zero-based positions.
   - `assertExactOrderReplacement` validates exact current IDs, no duplicates/missing/foreign, exact expected versions, and returns ordered IDs plus contiguous positions. Use `CATALOG_VERSION_CONFLICT` for stale version; use an existing safe validation error for invalid vectors.
4. **Seed fact policy (T081):**
   - `EGYPT_HOUSEKEEPING_SEED` is a readonly DEC-044 fact constant exactly matching the approved content in the test; no Media or OQ-002 materials claim.
   - `decideCatalogSeedRowAction` returns `CREATE` only when `existing` is null, otherwise `PRESERVE`; it never rewrites, reactivates, or overwrites existing owner-managed facts.

Update no task markers or implementation-summary in this turn.

Run separately and report exact results:
```powershell
npm.cmd run typecheck
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog-lifecycle.policy.test.ts tests/unit/catalog/catalog-country.policy.test.ts tests/unit/catalog/catalog-order.policy.test.ts tests/unit/catalog/catalog-seed.test.ts
```

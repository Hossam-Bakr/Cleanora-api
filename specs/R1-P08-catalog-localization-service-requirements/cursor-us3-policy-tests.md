# Cursor delegation — R1-P08 US3 tests first, pure/non-DB only

Work in the existing R1-P08 workspace. Preserve all changes and the intentionally dirty worktree. Do not reset, restore, delete, stage, commit, push, run migrations/seeds, connect to any database, or implement US4/US5.

## This delegation is tests only

Implement only the non-database US3 tests: T075, T076, T077, and T081. Do not change runtime source, schema, repository, controller/routes, OpenAPI/Postman, `prisma/seed.ts`, tasks, or implementation summary in this turn.

Load the active US3 spec/plan/research/DEC-041 through DEC-044 before writing assertions. Tests must define the approved behavior without inventing it.

1. `tests/unit/catalog/catalog-lifecycle.policy.test.ts` (T075)
   - Category/service activation and selectability truth tables: category, service, and country availability gates; bilingual requirement before activation/selectability; no third draft state; a service can have zero active fields; active service requires an active complete price unit; inactive children are not selectable.
   - Exact-locale rule: missing requested locale fails safely and does not fall back to the other language.
2. `tests/unit/catalog/catalog-country.policy.test.ts` (T076)
   - Use fake `ActiveCountryReader` facts only. Cover active `EG`, inactive country, unknown country, and no duplicated Country persistence/acceptance of client-invented country facts.
3. `tests/unit/catalog/catalog-order.policy.test.ts` (T077)
   - Exact-set full replacement / order-vector validation for categories, services, children, and media: same current ID set, no duplicate, no missing, no foreign, stable contiguous positions, and stale/exact version vector checks as specified.
4. Extend `tests/unit/catalog/catalog-seed.test.ts` (T081)
   - Exact DEC-044 approved identities/content direction (Home Cleaning, Standard Home Cleaning, `PER_VISIT`, `PER_HOUR`, representative five field types, `EG`) and create-if-missing / preserve later owner changes policy. Do not invoke a database or `prisma/seed.ts`.

If the tests fail because US3 runtime behavior has not yet been implemented, that is expected: report the exact failures and leave them failing. Do not weaken expectations or implement production code to make them pass in this turn.

Run exactly:
```powershell
npm.cmd run typecheck
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog-lifecycle.policy.test.ts tests/unit/catalog/catalog-country.policy.test.ts tests/unit/catalog/catalog-order.policy.test.ts tests/unit/catalog/catalog-seed.test.ts
```

Report changed files, each passing/failing test count, and the concrete source capabilities required next. No task markers or evidence status changes.

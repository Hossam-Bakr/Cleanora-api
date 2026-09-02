<task>
Repair the two pre-existing R1-P08 test fakes affected by the deliberate addition of CatalogUnitOfWork.runInReadSnapshot.

Only edit these two files:
- tests/integration/catalog/catalog-selectable-media.test.ts
- tests/unit/catalog/catalog-selectability-defensive.test.ts

Each fake unitOfWork currently supplies runInTransaction only. Add a type-compatible runInReadSnapshot fake alongside it. It must invoke the supplied callback with the exact same uowDeps, matching the existing in-memory fake behavior.

Do not add a production fallback from runInReadSnapshot to runInTransaction: production repeatable-read semantics are intentional and must remain enforced. Do not change source modules, phase artifacts, database/migrations, seeds, Postman, Swagger, or unrelated tests. Do not loosen assertions or skip tests.
</task>

<verification_loop>
Run and make green before finishing:
  npm.cmd run test:r1-p08 -- tests/integration/catalog/catalog-selectable-media.test.ts tests/unit/catalog/catalog-selectability-defensive.test.ts
  npm.cmd run typecheck
Confirm the two named test files are the only files you changed in this run.
</verification_loop>

<action_safety>
Keep this a two-file test-double maintenance fix. No unrelated refactors, renames, cleanup, git add, or git commit. Leave edits uncommitted for the orchestrator's review.
</action_safety>

<structured_output_contract>
End with:
1. What changed and why
2. Files touched
3. Exact test and typecheck outcomes
4. Any deviation, open item, or needed decision
</structured_output_contract>

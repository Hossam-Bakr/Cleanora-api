<task>
Complete R1-P08 task T134 by raising phase coverage to the existing thresholds, using behavior-focused non-DB tests only.

Current independently observed phase coverage is failing despite 42 passing test files:
- statements 43.64% (need >=80)
- branches 42.80% (need >=75)
- functions 45.93% (need >=80)
- lines 44.00% (need >=80)

The principal gaps are CatalogService (36.74% lines), PrismaCatalogRepository (0%), and composition.ts (0%). Existing guarded live PostgreSQL suites must remain skipped when no approved `CLEANORA_R1_P08_DATABASE_URL` is present; they are not a substitute for test coverage.

Write focused unit tests using safe in-memory Prisma/transaction doubles to cover actual R1-P08 behavior and error/branch paths. Cover production behavior rather than private implementation trivia: repository persistence/query mappings and transaction boundaries; service management/lifecycle/configuration/media compensation/idempotency/error paths; and composition variants including CatalogDefinitionReader remaining internal and independent of staff HTTP authentication. Reuse existing factories/patterns. Add test files under the existing R1-P08 test locations as necessary.
</task>

<non_negotiable_constraints>
- Do NOT lower, remove, or scope around coverage thresholds.
- Do NOT exclude any R1-P08 source from vitest.r1-p08.config.ts and do not edit its include or threshold configuration.
- Do NOT weaken, skip, or delete assertions/tests.
- Do NOT change production source, Prisma schema/migrations, seed logic, API/OpenAPI/Postman/docs, package scripts, or phase task artifacts in this run. If tests reveal a real implementation defect, stop and report the exact defect rather than changing source.
- Do not use, create, connect to, or infer any database target. No Docker/Testcontainers.
- No anonymous Catalog Browse HTTP route or public delivery URLs.
- Do not git add, commit, stash, reset, checkout, or clean.
</non_negotiable_constraints>

<verification_loop>
Iterate on tests until this is green before finishing:
  npm.cmd run test:coverage:r1-p08

Then run:
  npm.cmd run test:r1-p08
  npm.cmd run typecheck
  npm.cmd run lint

The final coverage output must meet or exceed the existing thresholds (statements 80%, branches 75%, functions 80%, lines 80%). Report exact final percentages and test counts. Confirm your changes are confined to test files.
</verification_loop>

<action_safety>
This is a test-coverage task, not a redesign. Favor compact scenario tables / helper doubles over broad fixtures. Do not refactor merely to make testing easier. Leave every edit uncommitted for Codex review.
</action_safety>

<structured_output_contract>
End with:
1. Test scenarios added and behavior each proves
2. Files touched
3. Exact coverage percentages, suite counts, typecheck, and lint outcomes
4. Any real defect found, deviation, or unresolved blocker
</structured_output_contract>

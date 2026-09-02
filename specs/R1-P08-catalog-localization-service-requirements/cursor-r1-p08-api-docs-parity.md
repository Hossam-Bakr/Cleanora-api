<task>
Complete the narrowly scoped R1-P08 API-documentation parity work (US5 T130–T131 and cross-cutting T139) after the collection was generated.

Known observed facts:
- Runtime Swagger imports and composes `buildImplementedR1P08SwaggerFragments()`.
- R1-P08 documentation must expose only protected staff Catalog management under `/api/v1/staff/catalog`; it must never document anonymous/customer Catalog Browse HTTP.
- The internal `CatalogDefinitionReader` is module-public TypeScript only, not an HTTP endpoint, and must not appear in OpenAPI/Postman.
- `src/config/env.ts` defaults PORT to 8000 and runtime Swagger advertises `http://localhost:8000/api/v1`. The R1-P08 generator currently declares the Postman `baseUrl` as localhost:3000; correct it to localhost:8000 and regenerate only `postman/Cleanora-R1-P08-Catalog-Management.postman_collection.json`.
</task>

<changes>
1. In `src/swagger/openapi.document.ts`, make the OpenAPI info metadata accurately describe the R1-P08 runtime document: update the version/summary and add concise R1-P08 Staff Catalog text explaining protected-only management, bilingual activation with no locale fallback, and no anonymous Browse. Do not alter path behavior, server URLs, auth schemes, or any operation schemas.
2. In `scripts/generate-r1-p08-postman.ts`, change only the `baseUrl` default from 3000 to 8000. Regenerate the single R1-P08 collection using its existing npm script.
3. Add exactly these behavior-focused tests, borrowing the R1-P07 Swagger test style:
   - `tests/unit/swagger/r1-p08-openapi-parity.test.ts`: every source R1-P08 path/method equals the composed runtime document; every operation uses bearer security; runtime has no non-staff `/catalog/services*` path; info metadata describes R1-P08.
   - `tests/unit/swagger/r1-p08-openapi-fragments.test.ts`: fragments expose the Staff Catalog tag, protected operations/components, and no anonymous Browse route.
   - `tests/unit/catalog/r1-p08-postman-schema-parity.test.ts`: parse the committed generated collection; flatten nested items; verify its baseUrl is localhost:8000, every request is an R1-P08 staff Catalog path with bearer auth, every write has idempotency key/reason code (raw or form-data), its distinct method/path pairs are represented by the source contract, and the serialized file has no anonymous Browse URL or obvious secret/long-lived delivery values.

The existing `tests/unit/catalog/r1-p08-openapi-source.test.ts` may remain; do not move or weaken it.
</changes>

<non_negotiable_constraints>
- Touch only the listed documentation source/generator/generated R1-P08 collection and the three new test files. Do not modify existing test files.
- No production behavior, routes, Catalog service/repository, Prisma schema/migrations, seeds, DB targets, package scripts, docs markdown, or unrelated Postman assets.
- Do not lower coverage thresholds, skip/only tests, loosen assertions, stage, commit, reset, stash, or clean.
- No anonymous Browse route, no public storage/delivery URLs, no generated secret example.
</non_negotiable_constraints>

<verification_loop>
Run and make green before finishing:
  npm.cmd run postman:generate:r1-p08
  npm.cmd run test:r1-p08 -- tests/unit/swagger/r1-p08-openapi-parity.test.ts tests/unit/swagger/r1-p08-openapi-fragments.test.ts tests/unit/catalog/r1-p08-postman-schema-parity.test.ts
  npm.cmd run openapi:validate
  npm.cmd run postman:validate
  npm.cmd run typecheck
  npm.cmd run lint

Report exact test counts and results. Confirm only the named narrow files changed in this run.
</verification_loop>

<action_safety>
This is an API documentation parity task. No refactors or scope expansion. Leave work uncommitted for Codex review.
</action_safety>

<structured_output_contract>
End with:
1. What changed and why
2. Files touched
3. Exact gate/test outcomes
4. Any deviation, real defect, or remaining blocker
</structured_output_contract>

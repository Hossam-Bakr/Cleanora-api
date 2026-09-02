<task>
Review follow-up for the just-added `tests/unit/catalog/r1-p08-postman-schema-parity.test.ts` only.

The test currently proves that every distinct Postman method/path pair belongs to the R1-P08 OpenAPI source. Strengthen it to prove two-way parity: the collection represents every R1-P08 source method/path pair exactly (set equality, after normalizing Postman `{{pathVar}}` to OpenAPI `{pathVar}` and ignoring query strings). Keep the existing tests and assertions; do not weaken anything.

Do not edit any other source, generator, collection, or test file. No database, no Git action.
</task>

<verification_loop>
Run:
  npm.cmd run test:r1-p08 -- tests/unit/catalog/r1-p08-postman-schema-parity.test.ts
  npm.cmd run typecheck
  npm.cmd run lint
</verification_loop>

<structured_output_contract>
Report the exact assertion added, files touched, and each gate result. Leave work uncommitted.
</structured_output_contract>

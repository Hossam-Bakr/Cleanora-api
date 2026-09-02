# Cursor delegation — R1-P08 US2 policy/schema tests only

Work in the existing R1-P08 workspace state. A prior Cursor session partially implemented policy/schema/repository work, then hit a transport failure. **Do not reset, delete, restore, stage, commit, or touch existing US1 work.**

## This delegation is intentionally tiny

Implement **only** the three test-first artifacts below for US2. Do not modify repository persistence, application service, controller, routes, OpenAPI, Postman, migration, task checkboxes, or implementation summary in this turn.

1. `tests/unit/catalog/service-field.policy.test.ts` — exhaustive DEC-042 matrix tests for the exact closed kinds: `INFORMATION`, `TEXT`, `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, `MULTI_SELECT`; reject wrong constraint/option combinations, duplicate option values, invalid bounds, unavailable kinds, and incomplete AR/EN only when the relevant child is activated. Confirm inactive drafts can remain incomplete.
2. `tests/unit/catalog/service-price-unit.policy.test.ts` — stable price-unit codes; draft versus activated AR/EN behavior; duplicate rejection; exact request order through the graph helper where appropriate; reject provider price/amount/currency data. No provider values or amounts are ever persisted/exposed.
3. `tests/unit/catalog/catalog-configuration.schema.test.ts` — parse a full versioned US2 configuration containing all six valid kinds; reject duplicate unit/field/option identities; reject invalid discriminated-kind combinations; reject extra price/currency fields; reject unknown `countries` because availability is US3, deliberately outside this US2 endpoint.

Use existing test style and public policy/schema APIs. Tests must not require database connectivity.

Run exactly:
```powershell
npm.cmd run typecheck
npm.cmd run test:r1-p08 -- tests/unit/catalog/service-field.policy.test.ts tests/unit/catalog/service-price-unit.policy.test.ts tests/unit/catalog/catalog-configuration.schema.test.ts
```

Report changed files and exact test result. Do not continue to other tasks after the two commands.

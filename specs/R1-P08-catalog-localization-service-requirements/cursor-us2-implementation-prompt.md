# R1-P08 Cursor: US2 configuration implementation

Continue the existing R1-P08 Cursor session in the current worktree. Implement **only User Story 2, T055–T074**: service-scoped price units and the ordered six-kind service field/option graph. Use tests-first, then implementation, then independent verification.

## Non-negotiable boundaries

- Do not stage, commit, push, stash, reset, restore, clean, merge, or rewrite Git history.
- Do not connect to a database, run migration application, run the seed, or use any `.env` database target.
- Do not add public/customer/anonymous Catalog Browse HTTP.
- Do not begin US3 availability/country lifecycle/ordering/seed, US4 Media, or US5 selectable/snapshot behavior.
- Do not alter intentionally unrelated dirty paths listed in the implementation summary.
- Do not spawn a nested Cursor task/subagent. Work in this same session.
- Each verification command must run separately. Never chain commands in a way that hides a failed exit code.

## Authoritative US2 requirements

Implement the exact R1-P08 US2 scope from `spec.md` FR-013–FR-021 and DEC-042:

1. Price units belong to one Service. They have stable code, AR/EN labels, explicit active state, deterministic contiguous order, and **never** contain provider price amounts, minimum charges, discounts, or price history.
2. The permitted field kinds are exactly:
   `INFORMATION`, `TEXT`, `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, `MULTI_SELECT`.
3. Exact constraints:
   - INFORMATION: display-only, `isRequired: false`, no options and no text/number/selection constraints.
   - TEXT: optional non-negative min/max length; min <= max; no number/selection constraints/options.
   - NUMBER: explicit `INTEGER` or `DECIMAL` mode; optional decimal-string min/max; min <= max; no text/selection constraints/options. INTEGER bounds must be canonical integer decimal strings if present.
   - BOOLEAN: no options and no text/number/selection constraints.
   - SINGLE_SELECT: ordered options, no text/number bounds, no selection min/max; reject duplicate option values.
   - MULTI_SELECT: ordered options, optional non-negative min/max selection counts, min <= max, no text/number bounds; reject duplicate option values.
4. Field and option stable codes/values and price-unit codes must be immutable when their existing identity is retained; replacing a graph preserves child IDs by stable code/value. New identities are inserted. Omitted identities are removed only as part of the one atomic **configuration-replacement** graph, not standalone hard-delete endpoints.
5. Inactive price units, fields, and options may be incomplete; activated entries must pass Arabic/English completeness and kind compatibility. Current US2 may configure them while the parent service remains inactive.
6. Full configuration replacement is one protected, versioned mutation with expected version, idempotency, fresh authorization recheck, exactly one Admin-owned privileged audit record with safe before/after facts, safe request-scoped logging, and one service version bump. A validation/audit/CAS failure leaves no partial graph or completion receipt.
7. Preserve OQ-002 neutrality: no universal materials-supply flag/rule/requirement; localized content, answers, provider pricing, URLs, Media data, ids of commands, and secrets are excluded from logs/audit safe facts.

## US2 API scope / future boundary

Add the protected `PUT /api/v1/staff/catalog/services/:serviceId/configuration` for the US2 price-unit + fields/options replacement. It may include current service translations only if required for a consistent management DTO, but **do not implement countries/availability yet**: country persistence, country input acceptance, lifecycle/order commands, and selectability are US3. Keep runtime OpenAPI/schema/Postman explicit to the implemented US2 surface and do not claim the final contract's country section is live yet.

Management DTOs may return units/fields/options with localized management values. Module-public DTOs preserve decimal values as strings and never include customer answers or prices. No client-managed display order should be accepted: replacement array order determines contiguous zero-based persistence order.

## Required work (T055–T074)

- T055–T057: exhaustive executable policy/schema tests for every kind, all incompatible combinations, localizations, blank trim, duplicate codes/options, bounds, integer/decimal constraints, and no price amount fields.
- T058, T060, T071: replace misleading static/no-op proof with useful fakes; leave a true Prisma/repository/constraint/two-writer live test guarded by the exact approved target regex. A skipped test is not completion evidence and must be visibly unfinished (no `expect(true)` no-op).
- T061–T068: policy, repository replacement/read persistence, one service configuration use case, management/public DTOs, Zod discriminated union, controller/routes, runtime OpenAPI, Postman.
- T069: reconcile the existing migration SQL constraint names/expressions with the executable kind/bounds policy matrix in `migration-review.md`; do not modify an existing migration.
- T070: actual accepted replay/different-payload conflict coverage with fakes if no DB; real persistence proof stays guarded.
- T072: OQ-002 and redaction assertions using executable logger/audit fakes.
- T073–T074: update `implementation-summary.md` with exact test counts and an honest distinction between safe evidence and live DB evidence.

## Task-marker rules

Mark only exact, implemented, verified tasks. Expected defaults without approved DB:

- You may mark T055–T057, T061, T063–T069, T072–T074 only if exact evidence exists.
- Leave T058, T060, T062, T070, T071 open unless their full persistence/constraint/race wording is truly proven without a database.
- Leave any aggregate task depending on unproven live tasks open. Do not backfill or change US1 markers except correcting an objectively false one.
- T144–T146 remain blocked. T153–T156 remain reserved.

## Required independent verification

After implementation, run separately and report exact exit codes and test counts:

1. `npm.cmd run prisma:validate`
2. `npm.cmd run typecheck`
3. `npm.cmd run lint`
4. `npm.cmd run test:r1-p08`
5. `npm.cmd run openapi:validate`
6. `git diff --check`

Stop after US2. Report files changed, task markers changed, all test counts, open/blocked tasks, and any concern instead of silently expanding to US3.

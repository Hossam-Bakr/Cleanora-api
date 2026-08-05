# Implementation Prompt — R1-P02B

## Objective

Implement R1-P02B so a developer can start in `src/server.ts` and immediately
follow application creation and route mounting through `src/app.ts` and
`src/routes/index.ts`, while preserving every existing behavior and contract.

## Required context

Read `AGENTS.md`, `docs/ai/context-router.md`, `docs/product/current.md`, and
this phase's `spec.md`, `plan.md`, `tasks.md`, and requirements checklist. Read
only the directly affected architecture rules and source/tests. Treat
`D:/new_repos/ecommerce-api.rar` as a readability reference only; never copy
its Git data, configuration, uploads, MongoDB models, response formats, or
authentication implementation.

## Acceptance criteria

- `server.ts -> app.ts -> routes/index.ts -> module routes` is obvious.
- All FR/SC items and T001–T019 are satisfied with evidence.
- Before/after route inventories match exactly.
- All required quality gates pass.

## In scope

Only startup composition, `app.ts`, top-level/system routing, directly affected
tests, and navigation documentation defined in the phase plan.

## Out of scope

Authentication/configuration business logic, API or frontend contracts,
Prisma/schema/migrations/seeds, dependencies, and every future-phase feature.

## Module ownership and public contracts

Keep business behavior in its current module. `composition.ts` may construct
existing adapters and module factories but owns no business rules or
persistence. Keep the visible route map explicit and prohibit dynamic
discovery, a DI container, circular imports, or cross-module repository access.

## Database and migration work

None. Do not edit `prisma/schema.prisma`, `prisma/migrations/`, or seeds. Do not
run a production migration.

## Authorization, audit, and security

Preserve all existing authentication, verification, account-state, trusted
origin, cookie, JWT, session, rate-limit, audit, redaction, CORS, Helmet,
request ID, and error behavior.

## Tests and quality gates

Record baseline evidence before edits. Implement tasks in order with focused
tests, then run Prisma validation, typecheck, lint, unit, integration, OpenAPI,
docs, build, startup smoke, boundary checks, route comparison, and
`git diff --check`. Do not weaken assertions or coverage.

## Required handoff

Update tasks/checklist, write the implementation summary, and report exact
commands/results, changed files, unchanged contracts, and remaining risks.
Do not commit, push, merge, deploy, or run production migrations.

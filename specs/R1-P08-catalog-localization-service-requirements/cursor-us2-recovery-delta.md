# Cursor recovery delta — R1-P08 / US2 only

The previous US2 turn stopped while editing. **Resume the same workspace; do not restart, reset, discard, or rewrite the approved US1 work.** Inspect the partial US2 changes first. `npm.cmd run typecheck` currently passes, but the feature is not connected yet.

## Strict scope and prohibitions

Finish only US2 tasks T055–T074: service price units and the exact six service-field kinds. Preserve all US1 behavior.

- Do not run Prisma migrations, `prisma migrate`, deploy/reset/push/commit/stage Git commands, or connect to a database.
- Do not implement US3 countries/availability/seed, US4 media, US5 selectable reader/snapshot, anonymous/customer Browse endpoints, provider pricing amounts, or wider refactors.
- The US2 configuration route deliberately excludes `countries`; that comes in US3.
- Do not change existing migration SQL or task completion markers that lack real proof.

## What partial work already exists

The prior pass added partial policy functions, DTO mappings, validation schema, and repository-only types. It did **not** finish a repository implementation, a service command, controller/routes, OpenAPI/Postman, or meaningful US2 tests. Keep good partial code only if it supports the required contract; remove unused declarations only where necessary for a correct small implementation.

## Finish in this bounded order

1. **Repository and policy first.**
   - Complete the `CatalogRepository` public interface and `PrismaCatalogRepository` implementation for an atomic full replacement of a single service configuration.
   - It must load the service configuration, preserve price-unit, field, and option IDs for unchanged stable `code`/`value`, retain omitted children as inactive (never hard-delete those Catalog identities), apply request order as `displayOrder`, and bump the parent service version through the existing CAS pattern.
   - If raw `FOR UPDATE` is appropriate for the service graph, use a minimal, safe implementation consistent with current repository conventions. Do not create a new persistence abstraction.
   - Use the current policy helpers to enforce only these exact kinds: `INFORMATION`, `TEXT`, `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, `MULTI_SELECT`; compatible constraint rules; exact stable identities; AR/EN activation validity; and no silent locale fallback.
   - Add focused pure policy/schema tests now (T055–T057) before HTTP work.

2. **Command surface.**
   - Implement `CatalogService.replaceServiceConfiguration` in the existing idempotency/authorization/audit/optimistic-version conventions.
   - Add the protected staff-admin route:
     `PUT /api/v1/staff/catalog/services/:serviceId/configuration`
   - Use the existing version-header/idempotency/error response conventions. Publish only management data; do not expose provider answers or values.
   - Route/controller/service tests should run without a live DB, using the project’s existing fake repository/UOW patterns.

3. **Contract and evidence.**
   - Update the R1-P08 OpenAPI and Postman collection narrowly for the route/response and all six kinds. It must be protected staff-only; no public Browse path.
   - Add a repository-oriented test that demonstrates ID preservation and deletion-by-omission with a fake/recording persistence seam if an actual Prisma DB test is unavailable. Do not mark the real migration/race tasks complete without their required live proof.
   - Include idempotent replay, audit redaction, stale-version behavior, malformed payload, forbidden, and unauthenticated coverage where the current test architecture supports it.

4. **Task state and gates.**
   - Mark only US2 tasks truly covered. Leave T058, T060, T062, T070, T071 unchecked unless the matching test genuinely proves it. Do not claim a DB proof from a skipped test.
   - Run separately and report exact results:
     ```powershell
     npm.cmd run prisma:validate
     npm.cmd run typecheck
     npm.cmd run lint
     npm.cmd run test:r1-p08
     npm.cmd run openapi:validate
     git diff --check
     ```

## Required final report

List changed files; exact task markers marked; tests/gates and counts; files/tests skipped because they require an authorized DB; scope deliberately deferred; and any remaining issue. Do not attempt any Git handoff.

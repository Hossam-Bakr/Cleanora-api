# R1-P02B — Technical Plan

## Summary

Refactor only the startup/composition/routing surface. Preserve the normal
module request path and all runtime behavior.

Repository automation is removed by owner decision. Local validation commands
and their focused tests remain part of the implementation safety net.

## Target structure

```text
src/
├── server.ts              # visible startup sequence and process entry
├── app.ts                 # Express + global middleware + terminal handlers
├── composition.ts         # construct existing database/providers/modules
├── server-lifecycle.ts    # focused listen/shutdown helpers when needed
├── routes/
│   ├── index.ts           # concise public route-group map
│   └── system.routes.ts   # system endpoints and readiness-only limiter
└── modules/
    └── authentication/
        └── auth.routes.ts # existing endpoint map, unchanged behavior
```

`server-lifecycle.ts` is optional: create it only if the resulting
`server.ts` cannot remain readable while preserving its tested shutdown seams.

## Approved reading path

```text
server.ts
  -> createRuntimeDependencies(environment) in composition.ts
  -> createApp(runtime.routes) in app.ts
  -> mountRoutes(app, routes) in routes/index.ts
  -> createAuthenticationRouter() in modules/authentication/auth.routes.ts
```

## Responsibilities

### `server.ts`

- Load and validate environment.
- Call `createRuntimeDependencies(environment)` directly.
- Connect and bind the database explicitly.
- Call `createApp(runtime.routes)` directly.
- Create/listen on the Node HTTP server.
- Register `SIGINT` and `SIGTERM` directly beside the shutdown operation.
- Do not expose production factory overrides or test-only switches.

### `composition.ts`

- Construct the existing logger, database lifecycle, rate limiter, email
  adapter, cryptography/token adapters, Google adapters, and authentication
  module.
- Return small named dependency groups; do not start the server, mount routes,
  or contain business decisions.
- Use the concrete approved implementations directly; no override bag.

### `app.ts`

- Create Express.
- Register global middleware in the frozen order.
- Call `mountRoutes(app, routeDependencies)` directly.
- Invoke the existing focused test-route hook when supplied.
- Register not-found and error middleware last.

### `routes/index.ts`

- Display direct registrations for docs, system, and authentication groups.
- Delegate readiness-only rate limiting into `system.routes.ts` so the public
  map remains concise.
- Do not construct business services or access Prisma.

## Dependency direction

```text
server -> composition
server -> app
server -> routes
app -> global middleware/shared errors
routes -> system router/swagger router/module routers
composition -> database/integrations/module composition
```

`app.ts`, `routes/index.ts`, and business modules do not import `server.ts`.
No circular imports or cross-module repository access are permitted.

## Frozen contracts and invariants

- Same 17 authentication and 3 health method/path pairs, plus docs endpoints.
- Same API prefix behavior.
- Same middleware order and endpoint-specific rate-limit semantics.
- Same trusted-origin, cookies, JWT claims, session rotation, OTP/recovery,
  Google, audit, error, logging-redaction, and shutdown behavior.
- Same environment variable requirements and optional-provider behavior.
- Same Prisma schema, migration history, and generated-client contract.

## Data and migration work

None. Do not edit `prisma/schema.prisma`, `prisma/migrations/`, or seeds. No
migration is permitted for this phase.

## Testing strategy

1. Record baseline route inventory and current focused/full gate results.
2. Add or align unit tests for visible route mounting, middleware order,
   runtime composition, listen behavior, startup failure, signal idempotency,
   graceful shutdown timeout, and database disconnect-on-failure.
3. Preserve all existing authentication and integration suites.
4. Compare final route inventory against baseline.
5. Verify schema and migrations have no diff.

## Rejected alternatives

- Copy the reference `route -> request-aware service -> model` pattern: it
  mixes HTTP and business logic and would weaken Cleanora contracts.
- Put all dependency construction back into `server.ts`: this is the current
  readability problem.
- Hide route discovery in dynamic scanning or a DI container: navigation would
  become less explicit.
- Rewrite authentication services/repositories in this phase: outside the
  approved problem and too risky for a routing-only maintenance change.

## Constitution Check

- Standalone repository: PASS; the archive is reference-only.
- One active phase: PASS after R1-P02B activation; R1-P03 remains inactive.
- Modular ownership: PASS; no business ownership changes.
- Incremental migration: PASS; no data change.
- No product invention: PASS; behavior is frozen.
- Backend/security authority: PASS; all guards remain.
- Risk-proportional tests: REQUIRED before and after.
- Human-controlled operations: PASS; no Git/deploy/migration authorization.
- Release boundaries: PASS; no future capability.
- Applied migration immutability: PASS; schema/history frozen.

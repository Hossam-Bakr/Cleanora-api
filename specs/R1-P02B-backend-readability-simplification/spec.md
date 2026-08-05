# R1-P02B — Backend Readability Simplification

**Status**: Complete  
**Type**: Behavior-preserving maintenance phase between completed R1-P02A and inactive R1-P03  
**Activated At**: `2026-08-02` by explicit human-owner approval
**Completed At**: `2026-08-03` after independent review `PASS` and explicit human-owner approval

## Owner decisions

- **2026-08-03 — repository automation removed**: R1-P02B contains no hosted
  workflow or deployment automation. Local validation commands remain required
  because they protect the behavior-preserving refactor.
- **2026-08-03 — junior-readable startup**: Production startup must use direct
  calls and ordinary local names. `server.ts` must not expose factory override
  bags, conditional dependency selection, route-mount callbacks, or test-only
  switches. Testability must live in focused helpers and lifecycle units rather
  than making the production entry point harder to read.

## Goal

Make the Cleanora startup and HTTP routing path immediately understandable to
a developer starting at `src/server.ts`, while preserving every implemented
behavior and frontend-facing contract.

The desired reading path is:

```text
server.ts -> app.ts -> routes/index.ts -> module routes -> controller -> service -> repository
```

The supplied `ecommerce-api.rar` demonstrates the desired navigational
simplicity. It is a readability reference only. Cleanora remains standalone
and retains its stronger authentication, security, transaction, validation,
response, and testing guarantees.

## User stories

### US1 — Follow application startup (P1)

As a backend developer, I can open `server.ts` and quickly see environment
loading, runtime composition, Express creation, route mounting, HTTP startup,
and shutdown ownership without reading provider-specific construction inline.

**Acceptance scenarios**:

1. Starting at `server.ts`, the developer reaches the explicit public route
   map in no more than two named jumps.
2. `server.ts` contains process lifecycle orchestration, not email, Google,
   token, hashing, cookie, or module-construction details.
3. Database connection and shutdown ownership remain explicit.

### US2 — Discover all route groups (P1)

As a backend developer, I can open `routes/index.ts` and see every mounted
public route group and prefix as a short explicit list comparable to the
reference application's route map.

**Acceptance scenarios**:

1. Documentation, system, and authentication groups are visible as direct
   `app.use` registrations.
2. Endpoint-specific middleware stays with the owning router instead of
   obscuring the top-level route map.
3. No dynamic discovery, registrar framework, decorators, or dependency
   injection container is introduced.

### US3 — Preserve all behavior (P1)

As the frontend team and existing API consumer, I observe no change to any
request, response, authentication, or runtime contract after the refactor.

**Acceptance scenarios**:

1. The before/after method-and-path inventory is identical.
2. Existing unit and integration suites pass without weakened assertions.
3. Cookies, tokens, OTP/email behavior, Google redirects, rate limits, CORS,
   security headers, request IDs, error envelopes, startup, and graceful
   shutdown remain unchanged.

## Functional requirements

- **FR-001**: `server.ts` MUST be the obvious process entry and show the order:
  load environment, create runtime dependencies, connect the database, create
  Express, mount routes, listen, install shutdown handlers.
- **FR-002**: Provider-specific dependency construction MUST move behind one
  named composition function or file without creating a container/framework.
- **FR-003**: `app.ts` MUST own Express construction and global middleware
  ordering, and MUST ensure route handlers precede not-found/error handlers.
- **FR-004**: Route mounting MUST be invoked directly by `app.ts` so a reader
  can navigate from `server.ts` to `app.ts` and then `routes/index.ts` without
  following an injected callback.
- **FR-005**: `routes/index.ts` MUST show one concise explicit registration per
  public route group.
- **FR-006**: Readiness rate limiting MUST remain scoped to the same endpoint,
  even if its registration moves into the system router.
- **FR-007**: Production `server.ts` MUST NOT expose dependency-factory or
  test-switch plumbing. Focused tests MAY use app options and lifecycle helpers
  outside the production startup sequence.
- **FR-008**: All existing public endpoint methods, paths, request validation,
  response envelopes, status codes, cookies, headers, redirects, and error
  codes MUST remain byte-for-byte or semantically contract-equivalent as
  applicable.
- **FR-009**: Authentication and configuration business logic, repositories,
  Prisma schema, seeds, migrations, and integrations MUST NOT change.
- **FR-010**: The implementation MUST preserve request ID, Morgan safe-URL
  logging, Helmet, CORS, JSON limits, cookie parsing, route, 404, and error
  middleware order.
- **FR-011**: The archive's MongoDB models, CommonJS structure, request-aware
  services, response formats, environment files, Git history, uploads, and
  authentication implementation MUST NOT be copied.
- **FR-012**: Architecture documentation MUST state the final startup and route
  navigation path using the actual filenames.
- **FR-013**: `server.ts` MUST use the direct sequence
  `loadEnvironment(process.env)` → `createRuntimeDependencies(environment)` →
  `database.connect()` → `createApp(routes)` → `createServer(app)` → `listen`.
- **FR-014**: `server.ts` MUST contain short comments explaining database
  startup, route/application creation, listening, and shutdown signals.
- **FR-015**: `server.ts` MUST NOT contain `StartApplicationDependencies`,
  `dependencies.create*`, runtime factory fallbacks, or conditional object
  spreads used only for testing.

## Scope

### In scope

- `src/server.ts`
- `src/app.ts`
- `src/routes/index.ts`
- `src/routes/system.routes.ts` only to colocate its endpoint-specific
  readiness limiter
- One small composition file for existing runtime dependency construction
- One small server-lifecycle helper only if required to keep `server.ts`
  readable without losing shutdown tests
- Directly affected unit/integration tests and architecture documentation

### Out of scope

- Authentication use cases, controller behavior, schemas, policies,
  repositories, token/cookie logic, Google flow, OTP/recovery, or email content
- Configuration business behavior
- Prisma schema, migrations, seeds, or database data
- New endpoints, modules, integrations, dependencies, or product behavior
- R1-P03 roles/permissions/audit implementation
- Provider, worker, finance, support, payments, notifications, queues, cache,
  Socket.IO, Docker, or cloud work
- Hosted workflows or deployment automation
- Removing safety checks merely to resemble the reference project

## Success criteria

- **SC-001**: A developer can identify every public route group by reading
  `server.ts`, `app.ts`, and `routes/index.ts` in sequence.
- **SC-002**: `routes/index.ts` contains a concise direct route-group map with
  no endpoint-specific policy construction obscuring it.
- **SC-003**: The before/after route inventory reports zero additions,
  removals, or method/path changes.
- **SC-004**: All required quality gates pass with existing coverage
  thresholds and no disabled or weakened tests.
- **SC-005**: `prisma/schema.prisma` and every applied migration remain
  byte-for-byte unchanged.
- **SC-006**: No new runtime dependency or framework is added.

## Definition of Done

- Every FR and SC has task and test evidence.
- Startup and route navigation match the approved reading path.
- Existing API, authentication, database, and frontend contracts are unchanged.
- Unit, integration, typecheck, lint, build, OpenAPI, docs, boundary, startup,
  and route-contract checks pass.
- Prisma schema and migrations are unchanged.
- Independent review reports no unresolved BLOCKER or MAJOR finding.
- Human owner explicitly approves phase completion.

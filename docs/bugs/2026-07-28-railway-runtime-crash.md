# Bug Report — Railway Edge Proxy cannot reach the API

## Observed behavior

Railway applied all migrations, ran the idempotent seed, and logged
`HTTP server listening`. It then stopped the container with `SIGTERM`, while
the public domain returned Railway's `Application failed to respond` page.

## Expected behavior

The API must remain reachable through the Railway public domain, and the
liveness endpoint must return HTTP `200`.

## Reproduction

- Deploy through Railpack with the configured production environment.
- Use a public domain with an explicit target port while leaving `PORT`
  environment-owned.
- Request `/api/v1/system/health/live` through the public domain.

## Environment

- Local Windows development
- Railway Railpack / Node.js 24 runtime
- PostgreSQL through Prisma 7 and the `pg` adapter

## Evidence and root cause

The application startup path succeeded. Migration, seed, database connection,
environment validation, application composition, and `listen` all completed
before Railway sent `SIGTERM`.

The `npm warn config production` line and the PostgreSQL SSL compatibility
message are warnings, not application failures. The final npm error is the npm
wrapper reporting Railway's external `SIGTERM`; it is not the initiating
failure.

Railway documents `Application failed to respond` as an Edge Proxy connection
failure. Its required contract is an HTTP listener on `0.0.0.0` and the
injected `PORT`, with any public-domain target port matching that same value.
The prior server used the correct environment port but relied on Node's
implicit host binding. The service configuration also showed an explicit
public target port while no matching `PORT` value was supplied by the owner,
leaving the proxy and listener ports unproven to match.

## Fix

The HTTP listener now explicitly binds to `0.0.0.0` and continues to use the
validated environment `PORT`. Its safe startup log records host and port.
Railway guidance now uses `node dist/server.js` directly so lifecycle signals
reach Node without npm-wrapper error noise.

The service owner must also make the public-domain target port and `PORT`
identical and configure the liveness health-check path.

## Regression test

`tests/unit/server/http-binding.test.ts` proves that the listener receives the
environment port and the exact `0.0.0.0` host.

## Validation

- Unit suite — 52 files and 200 tests PASS
- Typecheck — PASS
- Changed-file ESLint — PASS
- Production build — PASS
- Prisma generation before build — PASS
- Prisma schema validation — PASS
- OpenAPI and documentation checks — PASS
- Local and production-shaped environment parsing — PASS
- Production-shaped HTTP lifecycle smoke — HTTP `200`, bound to `0.0.0.0`,
  graceful `SIGTERM` shutdown PASS

## Remaining risk

The code cannot change Railway's public-domain target port or health-check
settings. Hosted acceptance remains open until the owner aligns the target
port, sets the liveness health-check, redeploys, and receives HTTP `200`.

The database URL should use `sslmode=verify-full` to remove the forward-looking
`pg` compatibility warning. This warning does not block service availability.

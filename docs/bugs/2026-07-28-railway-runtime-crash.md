# Bug Report — Railway runtime crash diagnosis

## Observed behavior

The local terminal returned to its prompt after logging `HTTP server listening`.
Railway completed the build and later marked the service as crashed.

## Expected behavior

The HTTP process must remain available after startup, and startup failures must
identify a safe actionable error category without exposing environment values.

## Reproduction

- Start locally with `npm run dev`.
- Inspect port `8000` and call `/api/v1/system/health/live`.
- Deploy the same revision to Railway and inspect the runtime log after the
  successful build.

## Environment

- Local Windows development
- Railway Node.js 24 runtime
- PostgreSQL through Prisma 7 and the `pg` adapter

## Evidence and root cause

The local API was not crashed: Node PID `27164` remained bound to port `8000`,
and the liveness endpoint returned HTTP `200`. The terminal had detached from
the server process.

A controlled startup using a fake database also remained alive until the
diagnostic command timed out, confirming that the HTTP lifecycle keeps the Node
event loop active.

The Railway root cause remains unclassified because only deployment status was
provided, not its runtime log. Likely startup categories include environment
validation, database connectivity, a health-check termination, or another
runtime error. Build-time Prisma generation is already fixed separately.

## Fix

Startup failure logging now includes a strictly validated machine error code
when one exists, such as `P1001`, `P2022`, `EACCES`, or `ECONNREFUSED`. Raw
messages, database URLs, hosts, and credentials remain excluded.

## Regression test

`tests/unit/config/env.test.ts` proves that a valid machine code is logged and a
code containing unsafe free-form text is rejected.

## Validation

- Unit suite — 52 files and 205 tests PASS
- Typecheck — PASS
- Changed-file ESLint — PASS
- Production build — PASS
- Prisma generation before build — PASS
- Local liveness — HTTP 200

## Remaining risk

Railway runtime log text is still required to identify and repair the actual
deployment failure. No deployment settings, environment variables, database,
or production migration were changed.

# Bug Report — Swagger route served by stale runtime

## Observed behavior

`GET http://localhost:8000/api/v1/docs` returned
`HTTP_ROUTE_NOT_FOUND` even though the Swagger router is mounted in the current
application source.

## Expected behavior

The endpoint returns the Cleanora interactive Swagger HTML, and
`GET /api/v1/docs/openapi.json` returns the OpenAPI 3.1 document.

## Reproduction

1. Request `/api/v1/docs` from the process listening on port 8000.
2. Observe HTTP 404.
3. Run the focused Swagger integration tests against the current application
   factory and observe HTTP 200 for both documentation routes.

## Environment

- Windows development workstation
- Port `8000`
- Active R1-P02 working tree

## Evidence and root cause

The current source mounts `createSwaggerRouter` at `/api/v1/docs`, and its
focused tests pass. `netstat` identifies PID `13660` as the listener on both
IPv4 and IPv6, but the live process returns 404 for both Swagger routes. Windows
denies this non-elevated session permission to stop that PID. The listener is
therefore an older elevated/orphaned Node process running code from before the
Swagger route was added.

## Fix

Stop PID `13660` from an Administrator terminal, then start the current
repository server again.

## Regression test

`tests/integration/swagger-docs.test.ts` verifies the interactive HTML endpoint,
OpenAPI JSON endpoint, security headers, and documented paths.

## Validation

After restart, request `/api/v1/docs`, `/api/v1/docs/openapi.json`, and
`/api/v1/system/health/live`; all three must return HTTP 200.

## Remaining risk

The process replacement requires Administrator permission because the existing
listener is elevated. No source-code change can replace that already-running
process.

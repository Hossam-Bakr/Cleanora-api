# R1-P02A — Backend Structure Simplification

**Status**: Complete  
**Type**: Maintenance phase between completed R1-P02 and inactive R1-P03  
**Completed At**: `2026-08-01` by explicit human-owner completion approval  
**Note**: R1-P03 remains inactive; this approval does not authorize commit, push, merge, deployment, or production migration.

## Goal

Simplify the existing TypeScript/Express backend into a readable modular
monolith without changing its API, authentication, security, persistence, or
provider behavior.

## Requirements

- Keep every existing endpoint, method, request, response, status, cookie,
  token, OTP, email, Google callback, and database contract unchanged.
- Preserve DEC-028 email-only verification. Phone ownership remains deferred
  to R1-P26; no Google phone gate is restored.
- Make `src/routes/index.ts` the visible route map and remove module
  registrars/dynamic discovery.
- Keep `app.ts` free of business logic and `server.ts` as the small composition
  root using `createServer(app)`.
- Use Morgan for HTTP access logging, silence it in tests, and retain only a
  small secret-redacting application logger for lifecycle/provider messages.
- Remove confirmed placeholder modules, empty folders, one-line barrels, dead
  abstractions, and generated coverage artifacts.
- Keep only unit and integration tests; move any unique E2E assertions into
  integration tests before removing the E2E suite.
- Do not change the Prisma schema or migration history.
- Do not add Redis, Socket.IO, notifications, Paymob, queues, or other future
  modules.

## Done When

- A developer can follow route → controller → service → repository directly.
- Baseline and final API contracts match.
- Prisma generation/validation, typecheck, lint, unit, integration, build,
  startup smoke, OpenAPI validation, and boundary checks pass.
- No E2E tests, empty future folders, module registrars, or Pino HTTP logging
  remain.


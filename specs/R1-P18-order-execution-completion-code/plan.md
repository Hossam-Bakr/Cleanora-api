# Implementation Plan: R1-P18 — Order Execution & Client Completion Code

**Branch**: `r1-p18-order-execution-completion-code` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)
**Authority**: DEC-100 activation; awaiting Codex preparation acceptance of MVB holdings in spec Clarifications

## Summary

Scaffold a new `orders` module that creates a 1:1 operational order from an
ASSIGNED booking with an ACTIVE assignment, enforces a frozen fulfillment
status matrix, issues hashed six-digit completion codes with TTL/attempts,
records SMS delivery intents (no P23 send), supports optional completion
media/notes, and exposes a consistent multi-actor timeline. No panic,
remaining/COD, live sockets, GPS, fees, wallets, Docker, or cloud.

## Technical Context

**Language/Version**: TypeScript (repo Node/Express stack)
**Primary Dependencies**: Express, Zod, Prisma/PostgreSQL, Auth, Bookings
public readers (booking + ACTIVE assignment), Media attachment ids, existing
OTP/hash utilities if present
**Storage**: Seven roadmap tables + optional actor-command / notification
intent tables; migration `r1_p18_order_execution_completion_code`
**Testing**: New `vitest.r1-p18.config.ts` + `npm run test:r1-p18` and
`npm run test:coverage:r1-p18`; unit + HTTP/integration; authz, matrix,
code hash/TTL/attempts, media visibility, timeline, cancel coordination,
idempotency, module boundaries
**Target Platform**: Existing modular-monolith backend
**Performance Goals**: One orders-owned transaction per transition/complete
(status + history + events + intents + code rows)
**Constraints**: EX-01–EX-04; OQ-001 no fees; Docker/cloud deferred; no
foreign Prisma
**Scale/Scope**: Egypt Browse bookings already ASSIGNED under P17

## Constitution Check

- Standalone repository-local behavior only.
- One deployable modular monolith; `orders` owns P18 persistence.
- Cross-module access only through named public contracts / composition.
- Zod at HTTP and public-command boundaries; deny by default.
- Traceability: FR/SC → tasks with tests.
- Do not edit applied migrations.
- Human-controlled Complete / Git publication.

## Architecture and Ownership

### Orders (new module)

Owns ensure-order, status transitions, completion code lifecycle, media/note
attach, timeline reads, cancel-from-booking coordination entrypoint, Prisma
models, routes/controllers, OpenAPI/Postman, notification intent persistence.

Transaction owner: Orders unit of work. Must not open Bookings/Providers/
Payments Prisma.

### Bookings

Expose/extend named public readers:

- Booking facts needed for ensure-order (id, status, providerId, customerId,
  schedule window labels already entitled)
- ACTIVE assignment + member user/worker ids for authz
- Cancel coordination: call Orders public `cancelOrderForBooking` when
  booking cancels (or Orders polls via injected port — prefer Bookings
  invokes Orders public cancel on successful booking cancel)

### Providers / Auth / Media / Configuration

- Auth: session + role checks
- Providers: only if needed for OWNER/ADMIN membership via existing auth/
  providers public checks (prefer Authz already used by bookings)
- Media: validate media file ownership/ids through media public contract
- Configuration: read TTL/maxAttempts keys with defaults

### Composition

Inject Bookings readers, clock, hasher, media validator into Orders services.
Mount `/api/v1/orders` routes. Wire Bookings cancel path to Orders cancel
hook.

## Module file plan (indicative)

```text
src/modules/orders/
  orders.errors.ts
  orders.schema.ts
  orders.matrix.ts
  orders.public.ts
  orders.ensure.service.ts
  orders.transition.service.ts
  orders.completion.service.ts
  orders.timeline.service.ts
  orders.media.service.ts
  orders.cancel.service.ts
  orders.controller.ts
  orders.routes.ts
  infrastructure/prisma-orders.repository.ts
  domain/completion-code.ts
  domain/order-authz.ts
```

## Data / Migration

See [data-model.md](./data-model.md). Migration folder:
`prisma/migrations/r1_p18_order_execution_completion_code/`.

Indexes: unique `orders.booking_id`; status; completion_codes active per
order partial unique; attempts by code id.

## API

See [contracts/http-api.md](./contracts/http-api.md). Artifact:
`docs/apis/openapi/r1-p18-order-execution-completion-code.yaml` + Postman
collection updates via repo generators.

## Test strategy

Thresholds 80/75/80/80 on phase-owned files (include unimported). Cover:

- Matrix positives and illegal jumps
- Authz matrix (member, OWNER/ADMIN, customer deny write, other provider)
- Code issue hash-only persistence; verify success/fail/expiry/lockout/resend
- Media visibility pre/post COMPLETED
- Timeline consistency
- Booking cancel → order CANCELLED
- Idempotency keys
- Module boundary (no foreign Prisma)

## Quality commands (discovered)

- `npm run typecheck`
- `npm run lint` (if present)
- `npm run test:r1-p18` / `npm run test:coverage:r1-p18`
- `npm run docs:check`
- `npm run openapi:validate`
- `npm run postman:validate` (if present)
- Prisma validate + disposable migration proofs

## Implementation prompt

Cursor implements accepted tasks T001+ after Codex prep-accept. Do not mark
complete or publish Git.

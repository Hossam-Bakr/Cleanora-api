# Implementation Plan: R1-P17 — Worker & Team Assignment

**Branch**: `r1-p17-worker-team-assignment` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)
**Authority**: DEC-098 activation; awaiting Codex preparation acceptance of MVB holdings in spec Clarifications

## Summary

Extend the existing `bookings` module so the selected provider can assign an
eligible team or workers to an ACCEPTED booking, replace assignments with
full history, enforce crew/`cleans`/schedule/overlap rules, expose worker
order visibility, and add booking status `ASSIGNED`. No order execution,
completion codes, panic, fees, wallets, or P23 delivery.

## Technical Context

**Language/Version**: TypeScript (repo Node/Express stack)
**Primary Dependencies**: Express, Zod, Prisma/PostgreSQL, Auth, Providers
workforce + availability public readers, existing Bookings command/status
matrix
**Storage**: `booking_assignments`, `booking_assignment_members`,
`booking_assignment_history`; BookingStatus `ASSIGNED`; actor command types
for assign/replace; notification template keys; migration
`r1_p17_worker_team_assignment`
**Testing**: New `vitest.r1-p17.config.ts` + `npm run test:r1-p17` and
`npm run test:coverage:r1-p17`; unit + HTTP/integration; authz, crew,
schedule, overlap, replace history, worker visibility, idempotency
**Target Platform**: Existing modular-monolith backend
**Performance Goals**: One bookings-owned transaction per assign/replace
(status + assignment + members + history + intents)
**Constraints**: EX-01 teamId lock; EX-02 intents only; EX-03 no staff
write; OQ-001 no fees; Docker/cloud deferred
**Scale/Scope**: Egypt Browse bookings already ACCEPTED under P16

## Constitution Check

- Standalone repository-local behavior only.
- One deployable modular monolith; `bookings` owns P17 persistence.
- Cross-module access only through named public contracts / composition.
- Zod at HTTP and public-command boundaries; deny by default.
- Traceability: FR/SC → tasks with tests.
- Do not edit applied migrations.
- Human-controlled Complete / Git publication.

## Architecture and Ownership

### Bookings (extend)

Owns application services for assign-team, assign-workers, replace, current
assignment read, history read, worker my-assignments, dossier projection
extensions, Prisma models, status transition seeds, routes/controllers,
OpenAPI/Postman, notification intent persistence.

Transaction owner: Bookings unit of work. Must not open Providers Prisma.
Must not import providers repositories.

### Providers

Extend/reuse public readers:

- `getBookingSafeTeamFacts` for team assign
- New or extended worker facts-by-ids reader
- Worker calendar coverage check for booking window

### Configuration / Payments / Orders

No P17 writes. Cancel-from-ASSIGNED reuses P16 cancellation services with
added transition rows only.

### Composition

Inject Providers readers + clock into Bookings assignment services. Mount
provider assignment routes under `/api/v1/providers` and worker visibility
under `/api/v1/workers` (or `/api/v1/me/assignments` — prefer
`/api/v1/workers/me/assignments` for clarity). Extend existing dossier
handlers.

## Module file plan (indicative)

```text
src/modules/bookings/
  bookings.assignment.service.ts
  bookings.assignment.policy.ts
  bookings.assignment.routes.ts
  bookings.assignment.controller.ts
  bookings.assignment.schema.ts
  bookings.worker-visibility.routes.ts
  infrastructure/prisma-booking-assignment.repository.ts
  bookings.matrix.ts                         # ASSIGNED + seeds docs
  bookings.public.ts                         # extend types
  bookings.response.service.ts               # dossier include assignment
  bookings.cancellation.service.ts           # ASSIGNED → CANCELLED rows
```

## HTTP surface (locked)

| Method | Path | Actor |
|---|---|---|
| POST | `/api/v1/providers/:providerId/bookings/:bookingId/assignments/team` | OWNER/ADMIN |
| POST | `/api/v1/providers/:providerId/bookings/:bookingId/assignments/workers` | OWNER/ADMIN |
| POST | `/api/v1/providers/:providerId/bookings/:bookingId/assignments/team/replace` | OWNER/ADMIN |
| POST | `/api/v1/providers/:providerId/bookings/:bookingId/assignments/workers/replace` | OWNER/ADMIN |
| GET | `/api/v1/providers/:providerId/bookings/:bookingId/assignments/current` | OWNER/ADMIN |
| GET | `/api/v1/providers/:providerId/bookings/:bookingId/assignments/history` | OWNER/ADMIN |
| GET | `/api/v1/workers/me/assignments` | authenticated worker (self) |
| GET | existing provider/customer/staff booking dossier | include assignment summary |

Idempotency-Key required on all POST assignment commands.
Body includes `expectedBookingVersion` (or existing version field pattern).

## Status matrix additions

| Actor | From | To | Category |
|---|---|---|---|
| PROVIDER | ACCEPTED | ASSIGNED | NORMAL |
| CUSTOMER | ASSIGNED | CANCELLED | CANCELLATION |
| PROVIDER | ASSIGNED | CANCELLED | CANCELLATION |
| STAFF_ADMIN | ASSIGNED | CANCELLED | PRIVILEGED_OVERRIDE |

## Test strategy

- Unit: policy (crew, escort, composition, overlap window math)
- Unit/integration: assign team/workers, replace history, idempotency
- Integration: authz selected provider only; worker visibility isolation
- Boundary: no payments imports; no fee columns
- Coverage gate: `test:coverage:r1-p17` 80/75/80/80
- Migration proofs on disposable DB URL

## Quality commands (discovered)

From `package.json` patterns used by P16 (create P17 equivalents):

- `npm run typecheck`
- `npm run lint`
- `npm run test:r1-p17`
- `npm run test:coverage:r1-p17`
- `npm run docs:check`
- `npm run openapi:validate`
- `npm run postman:validate`

## Risks

- Overlap query performance → index (providerId, status, startsAt, endsAt)
- Providers reader gaps → extend public contract early in foundation tasks
- Cancel-from-ASSIGNED must update P16 cancel services carefully without
  fee invention

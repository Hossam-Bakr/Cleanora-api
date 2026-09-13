# Implementation Plan: R1-P16 — Provider Booking Response & Cancellation Events

**Branch**: `r1-p16-provider-booking-response-cancellation-events` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)
**Authority**: DEC-096 activation; awaiting Codex preparation acceptance of MVB holdings in spec Clarifications

## Summary

Extend the existing `bookings` module so the selected provider can accept or
reject a confirmed standard request, expire unanswered responses, and record
customer/provider/staff cancellations without inventing fees. Persist
responses, cancellations, reasons, and notification intents. Add booking
status `ACCEPTED`. No counteroffer, assignment, orders, wallets, or P23
delivery.

## Technical Context

**Language/Version**: TypeScript (repo Node/Express stack)
**Primary Dependencies**: Express, Zod, Prisma/PostgreSQL, existing Auth,
Providers membership facts (OWNER/ADMIN), Configuration country config,
existing Bookings command/status matrix
**Storage**: `booking_responses`, `booking_cancellations`,
`cancellation_reasons`, `booking_notification_intents`,
`booking_actor_commands`; BookingStatus `ACCEPTED`; StatusTransitionActor
`PROVIDER`; migration `r1_p16_provider_booking_response_cancellation_events`.
Egypt seed `commercial.provider_response_hours` = 24 and cancellation reasons.
**Testing**: New `vitest.r1-p16.config.ts` + `npm run test:r1-p16` and
`npm run test:coverage:r1-p16`; unit + HTTP/integration; authz, expiry,
idempotency, no-fee proofs
**Target Platform**: Existing modular-monolith backend
**Performance Goals**: One bookings-owned transaction per accept/reject/
cancel/expiry side-effect set (status + response/cancellation + history +
intent)
**Constraints**: OQ-001 no fees; no counteroffer; no P23 delivery; Docker/
cloud deferred
**Scale/Scope**: Egypt-seeded expiry hours and reasons; standard Browse
bookings only

## Constitution Check

- Standalone repository-local behavior only.
- One deployable modular monolith; `bookings` owns P16 persistence.
- Cross-module access only through named public contracts / composition.
- Zod at HTTP and public-command boundaries; deny by default.
- Traceability: FR/SC → tasks with tests.
- Do not edit applied migrations.
- Human-controlled Complete / Git publication.

## Architecture and Ownership

### Bookings (extend)

Owns:

- Application services for inbox, dossier, accept, reject, lazy expiry,
  customer/provider/staff cancel, reason listing
- Prisma models for the four P16 tables and BookingStatus/actor enum
  extensions
- Status transition rules seed for new executable rows
- Extension of `confirmDepositPayment` to insert PENDING response + expiry
- Routes/controllers: provider-scoped bookings router, staff cancel router,
  extensions to existing customer cancel/get
- OpenAPI + Postman for P16 HTTP
- Notification intent persistence (not delivery)

Transaction owner: Bookings unit of work. Must not open Payments Prisma.
Must not import providers repositories; read membership through Providers
public contract already used by other modules (or a narrow bookings-facing
reader injected at composition).

Does **not** own: assignment, orders, payment capture, fee engine, FCM.

### Providers

Expose (reuse) active OWNER/ADMIN membership facts for
`providerId + actorUserId`. Bookings must not query provider membership
tables directly.

### Configuration

Add `commercial.provider_response_hours` to the config-key catalog and
Egypt seed. Bookings reads it through the existing Configuration public
reader pattern used for `commercial.deposit_percent`. Fail closed if
absent.

### Payments

No P16 writes. Existing deposit/ledger rows remain. Do not call
`createRefundRequest`. A boundary test asserts P16 command paths do not
import payments internals or write refund/ledger.

### Composition

- Inject Providers membership reader, Configuration hours reader, and clock
  into Bookings response services.
- Extend `confirmDepositPayment` factory with hours reader + clock.
- Mount provider bookings router under `/api/v1/providers` and staff
  bookings cancel under `/api/v1/staff/bookings`.
- Do not add a notifications module.

## Module file plan (indicative)

```text
src/modules/bookings/
  bookings.public.ts                         # extend types + seams
  bookings.matrix.ts                         # ACCEPTED + provider rows (docs seed)
  bookings.response.service.ts               # inbox/accept/reject/expiry
  bookings.cancellation.service.ts           # customer/provider/staff cancel
  bookings.response.routes.ts
  bookings.response.controller.ts
  bookings.response.schema.ts
  bookings.staff.routes.ts
  infrastructure/confirm-deposit-payment.ts  # create PENDING response
  infrastructure/prisma-bookings.repository.ts  # extend
  infrastructure/prisma-booking-response.repository.ts
```

## HTTP surface (locked)

| Method | Path | Actor |
|---|---|---|
| GET | `/api/v1/providers/:providerId/bookings/inbox` | provider OWNER/ADMIN |
| GET | `/api/v1/providers/:providerId/bookings/:bookingId` | provider OWNER/ADMIN of selected provider |
| POST | `/api/v1/providers/:providerId/bookings/:bookingId/accept` | same |
| POST | `/api/v1/providers/:providerId/bookings/:bookingId/reject` | same |
| POST | `/api/v1/providers/:providerId/bookings/:bookingId/cancel` | same; ACCEPTED only |
| GET | `/api/v1/bookings/cancellation-reasons` | authenticated; filter by actor |
| POST | `/api/v1/bookings/:bookingId/cancel` | owning customer; extend to CONFIRMED/ACCEPTED |
| GET | `/api/v1/bookings/:bookingId` | owning customer; include response/cancellation |
| POST | `/api/v1/staff/bookings/:bookingId/cancel` | staff_admin |
| GET | `/api/v1/staff/bookings/:bookingId` | staff_admin dossier read |

Idempotency-Key required on accept/reject/provider-cancel/staff-cancel.
Customer cancel keeps existing body+version pattern and adds idempotency
if the existing P13 cancel already uses commands table.

## Status matrix additions

| Actor | From | To | Category |
|---|---|---|---|
| PROVIDER | CONFIRMED | ACCEPTED | NORMAL |
| PROVIDER | CONFIRMED | CANCELLED | CANCELLATION (reject) |
| SYSTEM | CONFIRMED | CANCELLED | CANCELLATION (expiry) |
| CUSTOMER | CONFIRMED | CANCELLED | CANCELLATION |
| CUSTOMER | ACCEPTED | CANCELLED | CANCELLATION |
| PROVIDER | ACCEPTED | CANCELLED | CANCELLATION |
| STAFF_ADMIN | CONFIRMED | CANCELLED | PRIVILEGED_OVERRIDE |
| STAFF_ADMIN | ACCEPTED | CANCELLED | PRIVILEGED_OVERRIDE |

P13 rows remain. SYSTEM AWAITING_DEPOSIT → CONFIRMED remains and gains the
pending-response side effect.

## Data / migration

See [data-model.md](./data-model.md). Review SQL in `migration-review.md`.
Never edit applied migrations. Live proofs on disposable
`CLEANORA_R1_P16_DATABASE_URL` when available.

## Test strategy

See [test-strategy.md](./test-strategy.md). Thresholds 80/75/80/80 on all
phase-owned executable files including unimported adapters/routes.

## Complexity Tracking

| Item | Why needed | Rejection of simpler alternative |
|---|---|---|
| ACCEPTED status | P17 assigns accepted bookings; reject/expiry share CANCELLED | Encoding accept only in booking_responses would force P17 to join unofficially and weaken the status matrix |
| booking_notification_intents | Roadmap notification events; P23 does not exist | Calling a missing NotificationPort would invent P23 |
| Lazy expiry | No queue/Docker in R1 | A worker would add infrastructure out of phase |

Named exceptions EX-01, EX-02, EX-03 as in spec Clarifications.

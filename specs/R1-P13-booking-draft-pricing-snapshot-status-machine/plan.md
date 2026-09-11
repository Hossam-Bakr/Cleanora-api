# Implementation Plan: R1-P13 — Booking Draft, Pricing Snapshot & Status Machine

**Branch**: `codex/r1-p13-booking-draft-pricing-snapshot-status-machine` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)
**Authority**: DEC-090 activation; awaiting Codex preparation acceptance of MVB holdings in spec Clarifications

## Summary

Extend the existing `bookings` module (Browse HTTP stays) with customer booking
mutation: idempotent draft create, draft updates, submit-for-deposit, cancel
without fees, self-only list/get, and a seeded status-transition matrix that
freezes OQ-010. Price and deposit are server-authoritative. Snapshots freeze at
`AWAITING_DEPOSIT`. Payments, ledger, assignment, and order tables stay out.

## Technical Context

**Language/Version**: TypeScript (repo Node/Express stack)
**Primary Dependencies**: Express, Zod, Prisma/PostgreSQL, existing
Auth/Catalog/Providers/Eligibility/Media/Configuration/Customers public contracts
**Storage**: New booking tables + `status_transition_rules` +
`commercial.deposit_percent` country config. Migration
`r1_p13_booking_draft_pricing_snapshot_status_machine`.
**Testing**: New `vitest.r1-p13.config.ts` + `npm run test:coverage:r1-p13` and
`npm run test:r1-p13`; unit + HTTP integration; money/idempotency/transition
tests; OpenAPI/Postman
**Target Platform**: Existing modular-monolith backend
**Performance Goals**: One explicit Eligibility evaluation per create/submit;
no N+1 Prisma across items (single item MVB)
**Constraints**: No wallets; no payment capture; no fee invention; Docker/cloud deferred
**Scale/Scope**: Egypt-seeded deposit percent; one item per booking

## Constitution Check

- Standalone repository-local behavior only.
- One deployable modular monolith; `bookings` owns booking persistence and HTTP.
- Cross-module access only through named public contracts / composition.
- Zod at HTTP boundary; deny-by-default except explicit verified-customer booking.
- Decimal-safe money; snapshots immutable; no stored-value wallets.
- Traceability: FR/SC → tasks with tests.
- Do not edit applied migrations.

## Architecture and Ownership

### Bookings (extend)

Owns: booking application services, routes, Zod, errors, repositories/UoW,
matrix enforcement, snapshot persistence, command idempotency, HTTP under
`/api/v1/bookings`. Continues to own `/api/v1/browse`.

Transaction owner for create/submit/cancel: Bookings unit of work.

### Configuration

Add public reader for `commercial.deposit_percent` by country code. Seed Egypt
25. Bookings must not query `country_configs` Prisma directly.

### Customers

Add public `CustomerAddressSnapshotReader.readOwnedAddress({ userId, addressId })`
returning textual fields + country/city/district identity needed to compare with
eligibility locality. Bookings must not import customers repositories.

### Media

Add owner type `BOOKING_ATTACHMENT` and a public attach/list/sign seam for
booking images. Storage remains Media-owned.

### Catalog / Providers / Eligibility / Authentication

Reuse snapshot-ready catalog definition, provider service snapshot reader,
`evaluateEligibility({ mode: "explicit", providerIds: [id], ... })`, and
required-auth middleware (not optional browse auth).

### Composition / routes

Wire booking command service + router at `/api/v1/bookings`. Keep browse router
mounted. Update `BOOKING_PREREQUISITES` for verified customers.

## HTTP surface (planned)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/bookings` | verified customer | Create draft (Idempotency-Key required) |
| GET | `/api/v1/bookings` | verified customer | List self bookings (cursor) |
| GET | `/api/v1/bookings/:bookingId` | verified customer | Get self booking |
| PATCH | `/api/v1/bookings/:bookingId` | verified customer | Mutate draft answers/notes/address/media refs |
| POST | `/api/v1/bookings/:bookingId/submit-for-deposit` | verified customer | DRAFT → AWAITING_DEPOSIT |
| POST | `/api/v1/bookings/:bookingId/cancel` | verified customer | Cancel draft/awaiting-deposit |
| POST | `/api/v1/bookings/:bookingId/media` | verified customer | Attach READY booking image (draft only) |

No Staff booking routes. No payment routes.

## Persistence

See [data-model.md](./data-model.md). Money columns: minor-unit `Decimal(65,0)`
plus currency code and decimalPlaces, matching P09. Snapshots/history have
`created_at` only.

## Test strategy

See [test-strategy.md](./test-strategy.md). Thresholds 80/75/80/80 on:

- `src/modules/bookings/**/*.ts` (including new command files)
- new Configuration deposit-percent reader
- new Customers address snapshot reader
- new Media booking-attachment adapter surface added this phase

Do not drop global coverage gate; do not hide unimported P13 files.

## Quality commands (discovered)

- `npm run typecheck`
- `npm run lint` (phase-owned files if whole-tree is inherited-fail; record honestly)
- `npm run test:r1-p13` / `npm run test:coverage:r1-p13`
- `npm run prisma:validate`
- `npm run docs:check`
- `npm run openapi:validate`
- `npm run postman:validate`
- `npm run build`
- `npx prisma migrate diff` / reviewed SQL
- disposable `npm run db:validate-clean-migration` and P13 upgrade validator when URL exists

## Risks

- Missing `CLEANORA_R1_P13_DATABASE_URL` → migration proofs BLOCKED not PASS.
- Eligibility explicit evaluation cost on submit — accept one extra evaluation.
- Media owner-type enum expansion requires migration + Media tests.

## Implementation prompt

Cursor executes accepted tasks continuously after Codex PM
`ACCEPT_IMPLEMENTATION`. Do not commit or push.

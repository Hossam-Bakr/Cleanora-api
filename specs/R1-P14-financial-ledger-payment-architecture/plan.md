# Implementation Plan: R1-P14 — Financial Ledger & Payment Architecture

**Branch**: `codex/r1-p14-financial-ledger-payment-architecture` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)
**Authority**: DEC-093 activation; awaiting Codex preparation acceptance of MVB holdings in spec Clarifications

## Summary

Create the `payments` module as the financial source of truth before collecting
money. Persist system ledger accounts, append-only balanced journals, booking
links, idempotency keys, snapshots, and adjustments. Expose in-process posting
and reconciliation. Add **zero** new HTTP. Do not collect deposits, confirm
bookings, or create stored-value wallets.

## Technical Context

**Language/Version**: TypeScript (repo Node/Express stack)
**Primary Dependencies**: Zod (in-process command validation), Prisma/PostgreSQL,
existing Bookings and Configuration public contracts
**Storage**: Six payments tables. Migration
`r1_p14_financial_ledger_payment_architecture`. Egypt system-account seed.
**Testing**: New `vitest.r1-p14.config.ts` + `npm run test:r1-p14` and
`npm run test:coverage:r1-p14`; unit + in-process integration; money,
idempotency, immutability, wallet-rejection, no-HTTP tests
**Target Platform**: Existing modular-monolith backend
**Performance Goals**: One payments-owned transaction per post/adjust/snapshot;
indexed account and booking-link lookups
**Constraints**: No wallets; no payment capture; no fee invention; Docker/cloud deferred
**Scale/Scope**: Egypt-seeded system accounts; booking-linked journals only

## Constitution Check

- Standalone repository-local behavior only.
- One deployable modular monolith; `payments` owns ledger persistence.
- Cross-module access only through named public contracts / composition.
- Zod at the public-command boundary; deny unknown types and wallet-shaped accounts.
- Decimal-safe money; entries immutable; no stored-value wallets.
- Traceability: FR/SC → tasks with tests.
- Do not edit applied migrations.

## Architecture and Ownership

### Payments (new)

Owns: ledger application service, money helpers, errors, repository/UoW,
immutability SQL, Egypt account seed, public contract in
`src/modules/payments/payments.public.ts`.

Transaction owner for post/adjust/snapshot: Payments unit of work.

Does **not** own: booking commercial quotes, payment methods, gateway adapters,
payout destinations, orders, staff HTTP.

### Bookings

Add public `BookingFinancialSnapshotReader.readById({ bookingId })` returning
id, status, country id, currency, decimal places, gross/deposit/remainder
minor units, provider id. Payments must not import bookings repositories or
Prisma booking models.

### Configuration

Reuse country/currency public reads already used by Bookings. Payments must
not query `country_configs` Prisma directly.

### Composition

Construct the payments application service. Do not mount a payments router.
Bookings command services do **not** call `postJournal` in this phase.

## HTTP surface (planned)

None. Existing OpenAPI and Postman remain valid. Do not add
`docs/apis/openapi/r1-p14-*.yaml` payment operations. Document the internal
contract in `contracts/payments-public-contract.md` and prove no new Express
path is registered.

## Persistence

See [data-model.md](./data-model.md). Money columns: minor-unit `Decimal(65,0)`
plus currency code and decimalPlaces, matching P09/P13. Entries, links, and
snapshots have `created_at` only and SQL rewrite guards.

## Test strategy

See [test-strategy.md](./test-strategy.md). Thresholds 80/75/80/80 on
phase-owned executable files, including unimported payments files and the
Bookings financial snapshot reader.

## Quality commands (discovered)

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run prisma:validate`
- `npm run docs:check`
- `npm run openapi:validate`
- `npm run postman:validate`
- `npm run test:r1-p14` (to add)
- `npm run test:coverage:r1-p14` (to add)
- `git diff --check` on P14-owned paths
- Live clean/upgrade validators on an authorized disposable URL when available

## Named exceptions pending PM

EX-01 zero HTTP; EX-02 no capture/`CONFIRMED`; EX-03 reserved ORDER link and
rejected marketer posting / no user accounts.

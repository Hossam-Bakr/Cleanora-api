# Implementation Plan: R1-P15 — Deposit Payments, Methods & Webhooks

**Branch**: `codex/r1-p15-deposit-payments-methods-webhooks` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)
**Authority**: DEC-094 activation; awaiting Codex preparation acceptance of MVB holdings in spec Clarifications

## Summary

Extend the existing `payments` module to collect the configured booking deposit
through Paymob CARD/WALLET only. Persist methods, attempts, payments, gateway
events, receipts, and refund-request foundation rows. Browser return never
marks paid. Verified webhook is sole authority to succeed payment, post
`DEPOSIT` via existing `postJournal`, create receipt, and call Bookings
`confirmDepositPayment`. No wallets. No invented InstaPay.

## Technical Context

**Language/Version**: TypeScript (repo Node/Express stack)
**Primary Dependencies**: Express, Zod, Prisma/PostgreSQL, existing Auth,
Bookings financial snapshot reader, Configuration country/currency, P14
payments ledger/`postJournal`/money helpers
**Storage**: Six P15 tables + existing ledger. Migration
`r1_p15_deposit_payments_methods_webhooks`. Egypt method seed (Paymob CARD +
WALLET enabled; other rails disabled config only).
**Testing**: New `vitest.r1-p15.config.ts` + `npm run test:r1-p15` and
`npm run test:coverage:r1-p15`; unit + HTTP/integration; webhook signature,
idempotency, redirect-not-proof, retry, boundary, money tests
**Target Platform**: Existing modular-monolith backend
**Performance Goals**: One payments-owned transaction for success pipeline
(event → payment SUCCEEDED → journal → receipt); Bookings confirm called
through public seam after durable payment success facts are written (exact
ordering documented in transaction notes below)
**Constraints**: No wallets; no InstaPay invention; no fee invention;
Docker/cloud deferred
**Scale/Scope**: Egypt-seeded methods; deposit purpose only

## Constitution Check

- Standalone repository-local behavior only.
- One deployable modular monolith; `payments` owns P15 persistence + ledger.
- Cross-module access only through named public contracts / composition.
- Zod at HTTP and public-command boundaries; deny by default.
- Decimal-safe money; webhook authenticity + idempotency required.
- Traceability: FR/SC → tasks with tests.
- Do not edit applied migrations.

## Architecture and Ownership

### Payments (extend)

Owns:

- Application services for methods list, initiate deposit, browser return
  status, webhook processing, receipt read, staff method toggle, refund
  request foundation
- `PaymentGatewayPort` + Paymob adapter + test fake
- Routes/controllers under payments HTTP paths (see contracts)
- Repository/UoW for the six P15 tables
- Existing ledger posting via `postJournal` (same module)
- Money helpers reuse (no JS number money math)
- OpenAPI + Postman ownership for P15 payment endpoints

Transaction owner for initiate and webhook success pipeline: Payments unit of
work. Bookings confirm is invoked through the public seam; Payments must not
open Bookings Prisma.

Does **not** own: booking commercial quotes, status matrix definition,
provider accept, assignment, payouts, remaining/COD collection.

### Bookings

Add public `confirmDepositPayment` (name locked) that:

- Accepts trusted internal input: bookingId, paymentId, actor/system reason,
  expected deposit minor units / currency (as needed for fail-closed checks)
- Transitions only `AWAITING_DEPOSIT` → `CONFIRMED` under existing matrix rules
- Records status history / audit as Bookings already does for transitions
- Rejects if booking is not awaiting deposit or amounts do not match policy

Expose/keep `BookingFinancialSnapshotReader` for deposit amount/currency reads.
Payments must not import bookings repositories or Prisma booking models.

### Configuration / Auth

- Country/currency via existing Configuration public reads where needed.
- Customer auth + verified customer category for customer payment routes.
- `staff_admin` for method enable/disable and staff receipt read.
- Webhook route is unauthenticated but signature-verified (raw body).

### Composition

- Construct Paymob adapter from env (fail closed on initiate if incomplete).
- Wire payments deposit services + mount payments routes.
- Inject Bookings `confirmDepositPayment` and financial snapshot reader into
  payments success processing.
- Do not let Bookings import payments internals; only public contracts.

## Module file plan (indicative)

```text
src/modules/payments/
  payments.public.ts              # extend: deposit/receipt/method types + port types
  payments.service.ts             # extend: deposit workflows
  payments.money.ts               # reuse
  payments.errors.ts              # extend codes
  payments.routes.ts              # new
  payments.controller.ts          # new
  payments.schemas.ts             # Zod HTTP schemas
  adapters/payment-gateway.port.ts
  adapters/paymob.gateway.ts
  adapters/fake.payment-gateway.ts
  infrastructure/prisma-payments.repository.ts  # extend P15 tables
  infrastructure/payments.unit-of-work.ts       # extend

src/modules/bookings/
  bookings.public.ts              # add confirmDepositPayment
  ...confirmDepositPayment service/seam implementation
```

Exact filenames may match existing module conventions discovered at implement
time; ownership and public seams above are normative.

## HTTP surface (planned)

See [contracts/http-api.md](./contracts/http-api.md).

OpenAPI: `docs/apis/openapi/r1-p15-deposit-payments-methods-webhooks.yaml`
Postman: matching collection folder under `postman/` per repo convention.

## Persistence

See [data-model.md](./data-model.md). Money columns: minor-unit `Decimal(65,0)`
plus currency code and decimalPlaces, matching P14. Uniqueness:

- Gateway event idempotency key unique
- Attempt initiation idempotency unique per actor/booking scope
- At most one SUCCEEDED payment per booking deposit purpose

## Success pipeline (normative ordering)

1. Verify webhook raw-body signature; reject otherwise.
2. Upsert/claim `payment_gateway_events` by idempotency key.
3. On verified success matching pending attempt/payment:
   - Mark payment `SUCCEEDED` (and attempt terminal success) if not already
   - `postJournal` DEPOSIT balanced lines linked to booking
   - Create `payment_receipts` row
   - Call Bookings `confirmDepositPayment`
4. Replay of same event returns original outcome with no second side effects.

If confirm fails after SUCCEEDED+journal, fail closed with durable evidence and
tests documenting recovery/ops expectation — do not silently mark unpaid.

## Test strategy

See [test-strategy.md](./test-strategy.md). Thresholds 80/75/80/80 on
phase-owned executable files including Paymob adapter (with secrets mocked),
webhook handlers, Bookings confirm seam, and unimported P15 files.

## Quality commands (to add / run)

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run prisma:validate`
- `npm run docs:check`
- `npm run openapi:validate`
- `npm run postman:validate`
- `npm run test:r1-p15` (**add**)
- `npm run test:coverage:r1-p15` (**add**)
- `git diff --check` on P15-owned paths
- Live clean/upgrade validators on an authorized disposable URL when available
  (P14→P15 upgrade + clean install), mirroring P14 migration evidence pattern

## npm scripts to add

| Script | Purpose |
|---|---|
| `test:r1-p15` | `vitest.r1-p15.config.ts` run |
| `test:coverage:r1-p15` | same config with coverage thresholds 80/75/80/80 |

Also add any phase migration proof scripts if the repo pattern for P14
validators has a reusable disposable-DB entry — record exact command names in
`migration-evidence.md` at implement time.

## Named exceptions pending PM

EX-01 refund foundation only; EX-02 disabled non-Paymob rails only;
EX-03 browser return never proves payment.

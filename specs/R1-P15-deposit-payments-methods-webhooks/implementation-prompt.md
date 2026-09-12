# Implementation Prompt — R1-P15 Deposit Payments, Methods & Webhooks

## Objective

Implement deposit collection on the existing `payments` module: country methods,
idempotent initiate, browser return (status only), verified Paymob webhooks as
sole paid authority, DEPOSIT ledger via `postJournal`, receipts, Bookings
`confirmDepositPayment`, and refund-request foundation. Reach
READY_FOR_OWNER_REVIEW. Do not mark complete or publish Git unless the owner
sends an exact authorized phrase.

## Required context

- `docs/product/current.md`, vision §7, DEC-003, DEC-006, DEC-094, OQ-009
- `specs/R1-P15-deposit-payments-methods-webhooks/` spec, plan, tasks,
  data-model, http-api, payments-deposit-public-contract, test-strategy
- Existing P14 `payments.public.ts` (`postJournal`, money helpers) and Bookings
  `BookingFinancialSnapshotReader`

## Acceptance criteria

FR-001–FR-018 and SC-001–SC-012 as specified. Tasks T001–T036.

## In scope

Extend `payments`; six roadmap tables; Egypt Paymob CARD/WALLET seed; gateway
port + Paymob adapter + fake; required HTTP; webhook raw-body verify; success
pipeline; Bookings `confirmDepositPayment`; OpenAPI/Postman; coverage
80/75/80/80.

## Out of scope

Wallets, InstaPay invention, cancel fees (OQ-001), coupons (OQ-008), provider
accept (P16), assignment, payout execution, remaining/COD collection, gateway
refund execution, REFUND ledger post, Docker, cloud, commit/push,
mark-complete.

## Module ownership and public contracts

`payments` owns P15 persistence, HTTP, adapters, and continues to own ledger.
Bookings exposes `confirmDepositPayment` and the financial snapshot reader.
No cross-module Prisma/repository imports.

## Database and migration work

Additive `r1_p15_deposit_payments_methods_webhooks`. Review SQL. Never edit
applied migrations. Prove clean install and populated P14→P15 upgrade on an
authorized disposable target when available.

## Authorization, audit, and security

Verified customer for methods/initiate/return/receipt; staff_admin for method
toggle and staff receipt read; webhook signature-gated; redirect never proves
payment; secrets from env; fail closed when misconfigured on initiate.

## Tests and quality gates

`npm run test:r1-p15` and `test:coverage:r1-p15` at 80/75/80/80 plus typecheck,
lint, build, prisma, docs, openapi, postman, boundary, and migration proofs.

## Required handoff

Do not commit or push. Do not invent unresolved product behavior (especially
InstaPay). Do not mark P15 Complete.

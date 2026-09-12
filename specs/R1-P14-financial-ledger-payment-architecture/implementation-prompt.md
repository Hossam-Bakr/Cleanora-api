# Implementation Prompt — R1-P14 Financial Ledger & Payment Architecture

## Objective

Implement the accepted `payments` ledger: system accounts, append-only balanced
journals, booking links, idempotency, snapshots, adjustments, and in-process
reconciliation. Reach READY_FOR_OWNER_REVIEW. Do not mark complete or publish Git.

## Required context

- `docs/product/current.md`, vision §7, DEC-003, DEC-006, DEC-007, DEC-093
- `specs/R1-P14-financial-ledger-payment-architecture/` spec, plan, tasks, data-model, contract
- Existing P13 booking money columns and public-contract patterns from Eligibility

## Acceptance criteria

FR-001–FR-015 and SC-001–SC-010 as specified. Tasks T001–T032.

## In scope

New `payments` module, six roadmap tables, Egypt account seed, Bookings
financial snapshot reader, composition wiring without HTTP.

## Out of scope

Payment capture, webhooks, CONFIRMED-from-money, wallets, fees, InstaPay,
coupons, orders table, staff finance HTTP, Docker, cloud, commit/push.

## Module ownership and public contracts

`payments` owns persistence and `payments.public.ts`. Bookings exposes only
`BookingFinancialSnapshotReader`. Configuration stays country/currency owner.

## Database and migration work

Additive `r1_p14_financial_ledger_payment_architecture`. Review SQL. Never
edit applied migrations. Prove clean install and populated P13→P14 upgrade
on an authorized disposable target when available.

## Authorization, audit, and security

Trusted actor kinds only. Adjustments require STAFF_FINANCE + reason. No
customer-facing ledger HTTP. No wallet APIs.

## Tests and quality gates

`npm run test:r1-p14` and `test:coverage:r1-p14` at 80/75/80/80 plus
typecheck, lint, build, prisma, docs, openapi, postman, boundary, and
migration proofs.

## Required handoff

Do not commit or push. Do not invent unresolved product behavior.

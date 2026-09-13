# Implementation Prompt — R1-P16

## Objective

Implement every accepted R1-P16 acceptance criterion in the existing
`bookings` module: provider inbox, dossier, accept, reject with reason,
lazy response expiry, customer/provider/staff cancellation events,
notification intents, Prisma migration, tests at 80/75/80/80, OpenAPI and
Postman. Stop at READY_FOR_OWNER_REVIEW. Do not mark complete, commit, or
push.

## Required context

- `docs/product/current.md` (DEC-096 active)
- `specs/R1-P16-provider-booking-response-cancellation-events/spec.md`
- `plan.md`, `tasks.md`, `data-model.md`, `test-strategy.md`, `contracts/`
- OQ-001, DEC-003, existing bookings command HTTP and `confirmDepositPayment`

## Acceptance criteria

Spec user stories US1–US10 and FR-001–FR-016 / SC-001–SC-012.

## In scope

Roadmap R1-P16 bullets; tables and intent rows; ACCEPTED status; HTTP in
contracts/http-api.md.

## Out of scope

Fees, refund execution, counteroffer, assignment, orders, wallets,
InstaPay invention, P23 delivery, Docker, cloud, Git publication.

## Module ownership and public contracts

`bookings` owns persistence. Providers membership and Configuration hours
via public contracts. Payments unchanged.

## Database and migration work

`r1_p16_provider_booking_response_cancellation_events`. Review SQL. Do
not edit applied migrations.

## Authorization, audit, and security

Deny by default. Selected provider OWNER/ADMIN only for respond. Staff
reason required. Audit via status history + cancellation rows.

## Tests and quality gates

`npm run test:r1-p16` and `npm run test:coverage:r1-p16` after scripts
exist; typecheck, lint, openapi/postman validate, docs check as in
package.json.

## Required handoff

READY_FOR_OWNER_REVIEW evidence. Do not commit or push. Do not invent
unresolved product behavior.

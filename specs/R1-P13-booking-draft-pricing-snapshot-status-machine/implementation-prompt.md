# Implementation Prompt — R1-P13

## Objective

Implement every accepted R1-P13 acceptance criterion in the existing `bookings`
module: draft, awaiting-deposit, server quote/deposit, immutable snapshots,
status matrix freeze, cancel without fees. Stop at READY_FOR_OWNER_REVIEW.

## Required context

- `docs/product/current.md`
- `specs/R1-P13-booking-draft-pricing-snapshot-status-machine/spec.md`
- `plan.md`, `tasks.md`, `data-model.md`, `contracts/http-api.md`

## Acceptance criteria

FR-001–FR-018 and SC-001–SC-010 in spec.md.

## In scope

Roadmap §R1-P13 browse-path booking draft and awaiting-deposit.

## Out of scope

Payments, ledger, wallets, assignment, order HTTP, Recommended, Docker, cloud,
Git publication, phase Complete.

## Module ownership and public contracts

Bookings owns persistence and HTTP. Configuration deposit percent, Customers
address snapshot, Media `BOOKING_ATTACHMENT`, Eligibility explicit evaluate,
Providers/Catalog snapshots via public files only.

## Database and migration work

`r1_p13_booking_draft_pricing_snapshot_status_machine`. Never edit applied
migrations.

## Authorization, audit, and security

Verified customer only. Self-only. Idempotency. Status history on transitions.

## Tests and quality gates

`npm run test:coverage:r1-p13` 80/75/80/80 plus discovered repo gates.

## Required handoff

Do not commit or push. Do not invent unresolved product behavior.

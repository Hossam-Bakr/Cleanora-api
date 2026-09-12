# R1-P15 Activation — Deposit Payments, Methods & Webhooks

Date: 2026-09-12
Status: **Active** — sole active phase under DEC-094
Authority: Owner `/work-on-next-phase` with instruction to finish phase 15
after R1-P14 Complete (DEC-094).

## Owner authorization

The human owner sent `/work-on-next-phase` with an explicit instruction to
finish phase 15 (review path, then later exact `commit and push` when
separately authorized).

Authorized:

- Activation of R1-P15 as the sole active phase.
- Spec Kit specify / clarify / plan / checklist / tasks / analyze.
- Cursor implementation of accepted in-scope work, tests, Prisma, HTTP,
  OpenAPI/Postman, and internal-contract documentation.
- Bounded Codex consultations for preparation acceptance and final review
  (`gpt-5.6-sol`, `xhigh`, `service_tier=priority`) when those dials are
  actually available on the `hossa` Codex home.
- Progress through gates to **READY_FOR_OWNER_REVIEW**.

Not authorized:

- Mark R1-P15 Complete (requires separate human `mark complete`).
- Stage, commit, push, merge, deploy, or production migration unless the
  owner later sends the exact Git phrase.
- Activate R1-P16 or later.
- Stored-value wallets, invented InstaPay workflows (OQ-009), Docker, or
  cloud.

## Readiness

| Gate | Evidence |
|---|---|
| Prior phase Complete | R1-P14 Complete under DEC-094 after READY_FOR_OWNER_REVIEW / Codex T031 PASS |
| Dependency | Ledger + `postJournal` + booking financial snapshot reader shipped |
| Canonical docs | Vision §7, roadmap R1-P15, DEC-003/DEC-006/DEC-094, OQ-009, entity ownership for payment tables |
| One active phase | P14 closed; this activation makes P15 sole active |

Local feature branch: `codex/r1-p15-deposit-payments-methods-webhooks`.
Inherited unpublished P13/P14 work may remain on the branch history and is
not P15 scope unless it blocks P15 gates.

## Approved roadmap scope (source)

From `docs/product/roadmap.md` §R1-P15:

- Payment-method configuration by country
- Deposit payment initiation
- Gateway session/reference
- Browser return handling
- Idempotent webhook
- Payment verification
- Retry and failed payment
- Payment receipt
- Deposit ledger entries
- Booking transition to confirmed
- Refund record foundation
- Payment abstraction for Paymob and approved Egypt rails
- No invented InstaPay workflow

Tables: `payment_methods`, `payment_attempts`, `payments`,
`payment_gateway_events`, `payment_receipts`, `refund_requests`.
Uses ledger and booking tables.

Done when: redirect success alone never marks payment paid; duplicate
webhooks are harmless; booking confirms only after verified deposit;
payment and ledger states reconcile; unsupported rails remain disabled by
configuration.

## Execution boundary

Out of scope:

- Stored-value user wallets (DEC-003)
- Invented InstaPay behavior (OQ-009) — other rails may exist only as
  disabled config rows
- Cancellation fee matrix (OQ-001 / P16)
- Coupons (OQ-008)
- Provider accept/reject (P16), assignment (P17), order execution
- Remaining/COD collection (P20), payout execution (P21)
- Gateway refund execution or REFUND ledger posts in this phase
- Docker, cloud

## Role assignment

| Role | Actor |
|---|---|
| Implementer | Cursor |
| Bounded PM / reviewer | Codex CLI via `/codex-delegate` on `C:\Users\hossa\.codex` when locked dials are present |
| Material undecidable product/UX/security | Human owner (Arabic decision format) |
| Phase Complete / Git publication | Human owner (`mark complete` / `commit and push`) |

## Progress file

`work-on-next-phase-progress.md`

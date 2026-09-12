# R1-P14 Activation — Financial Ledger & Payment Architecture

Date: 2026-09-11
Status: Active — **READY_FOR_OWNER_REVIEW** (Codex T031 PASS 2026-09-12); not Complete.
Authority: Owner `/work-on-next-phase` plus explicit instruction to activate
phase 14 (DEC-093), after R1-P13 Complete.

## Owner authorization

The human owner sent `/work-on-next-phase` with an explicit instruction to
activate and work on phase 14.

Authorized:

- Activation of R1-P14 as the sole active phase.
- Spec Kit specify / clarify / plan / checklist / tasks / analyze.
- Cursor implementation of accepted in-scope work, tests, Prisma, and
  internal-contract documentation.
- Bounded Codex consultations for preparation acceptance and final review
  (`gpt-5.6-sol`, `xhigh`, `service_tier=priority`) when those dials are
  actually available on the `hossa` Codex home.
- Progress through gates to **READY_FOR_OWNER_REVIEW**.

Not authorized:

- Mark R1-P14 Complete.
- Stage, commit, push, merge, deploy, or production migration.
- Activate R1-P15 or later.
- Payment capture, webhooks, `CONFIRMED` from money, stored-value wallets,
  Docker, or cloud.

## Readiness

| Gate | Evidence |
|---|---|
| Prior phase Complete | R1-P13 Complete under DEC-093 after PASS review |
| Dependency | Booking draft + server quote/deposit + snapshots shipped |
| Canonical docs | Vision §7, roadmap R1-P14, DEC-003/DEC-006, architecture entity ownership for `payments` |
| One active phase | P13 closed; this activation makes P14 sole active |

Local feature branch: `codex/r1-p14-financial-ledger-payment-architecture`.
Inherited unpublished P13 work is preserved and is not P14 scope unless it
blocks P14 gates.

## Approved roadmap scope (source)

From `docs/product/roadmap.md` §R1-P14:

- Append-only ledger
- Financial account/reference model
- Order-level financial entries (booking-linked now; order table is later)
- Deposit/platform-fee entry types
- Provider-share entry types
- COD remaining
- Payout, refund, and adjustment entry types
- Balance calculation from entries where needed
- Idempotency keys
- Financial snapshots
- Reconciliation interfaces
- No stored-value user wallet

Tables: `ledger_accounts`, `ledger_entries`, `ledger_entry_links`,
`financial_idempotency_keys`, `financial_snapshots`, `financial_adjustments`.

Done when: financial totals derive from controlled server records; records are
immutable or corrected through new entries; decimal safety and idempotency
are tested; user wallet functionality does not exist.

## Execution boundary

Out of scope:

- Deposit payment capture, methods, webhooks, confirmed-from-payment (P15)
- Cancellation fee matrix (OQ-001 / P16)
- Assignment, orders HTTP, remaining/COD collection, payout execution
- Staff finance control UI/HTTP (later admin/finance phases)
- InstaPay invention (OQ-009), coupons (OQ-008)
- Stored-value wallets, Docker, cloud

## Role assignment

| Role | Actor |
|---|---|
| Implementer | Cursor |
| Bounded PM / reviewer | Codex CLI via `/codex-delegate` on `C:\Users\hossa\.codex` when locked dials are present |
| Material undecidable product/UX/security | Human owner (Arabic decision format) |
| Phase Complete / Git publication | Human owner (`mark complete` / `commit and push`) |

## Progress file

`work-on-next-phase-progress.md`

# Cleanora — Current Work

| Field | Value |
|---|---|
| Current Release | Release 1 — Core Marketplace |
| Current Phase | none (R1-P17 Complete; next not activated) |
| Status | **Complete** — R1-P17 under DEC-099; no active phase |
| Backend Owner | Cursor (implementer); Codex CLI bounded PM/review |
| Local Checkout | `r1-p17-worker-team-assignment` |
| Verified Main | `origin/main` includes R1-P16 (DEC-097) |
| Started At | 2026-09-14 |
| Completed At | 2026-09-14 |
| Last Updated | 2026-09-14 — R1-P17 Complete (DEC-099) |

## Active phase

None. Owner `mark complete` closed R1-P17 under DEC-099. R1-P18 is not
activated. Start the next phase only with an explicit owner instruction such
as `/work-on-next-phase`.

## Previously completed phase — R1-P17

R1-P17 Worker & Team Assignment is **Complete** under DEC-099. Assign/replace
team or workers on accepted bookings, `ASSIGNED` status, history, worker
visibility, cancel-from-ASSIGNED, intents only. Closure:
`specs/R1-P17-worker-team-assignment/completion-report.md`.

## Previously completed phase — R1-P16

R1-P16 Provider Booking Response & Cancellation Events is **Complete** under
DEC-097. Selected-provider inbox/dossier, idempotent accept/reject, lazy
expiry, customer/provider/staff cancellation events, and notification
intents only. Closure:
`specs/R1-P16-provider-booking-response-cancellation-events/completion-report.md`.

## Previously completed phase — R1-P15

R1-P15 Deposit Payments, Methods & Webhooks is **Complete** under DEC-095.
Deposit initiate, Paymob webhook, ledger DEPOSIT post, booking confirm,
receipts, staff method toggle, refund-request foundation. Closure:
`specs/R1-P15-deposit-payments-methods-webhooks/completion-report.md`.

## Previously completed phase — R1-P14

R1-P14 is **Complete** under DEC-094. In-process ledger module only. Closure:
`specs/R1-P14-financial-ledger-payment-architecture/completion-report.md`.

## Locked constraints

No stored-value wallets, invented InstaPay (OQ-009), unapproved cancellation
fees (OQ-001), counteroffers, Docker, or cloud. Git publication still requires
exact `commit and push` / `commit and push plus`. Phase Complete requires
exact `mark complete`. Next-phase activation requires an explicit owner
instruction (for example `/work-on-next-phase`).

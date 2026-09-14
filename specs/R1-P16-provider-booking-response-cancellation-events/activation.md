# R1-P16 Activation — Provider Booking Response & Cancellation Events

Date: 2026-09-13
Status: **Complete** — DEC-097 (2026-09-14); prior READY_FOR_OWNER_REVIEW /
Codex call 7 PASS after five MAJOR repairs.
Authority: Owner `/work-on-next-phase` plus `/goal` to finish phase 16 and
achieve accepted coverage after R1-P15 Complete (DEC-095). Closed by DEC-097.

## Owner authorization

The human owner sent `/work-on-next-phase` with `/goal` to finish phase 16
and achieve the accepted coverage.

Authorized:

- Activation of R1-P16 as the sole active phase.
- Spec Kit specify / clarify / plan / checklist / tasks / analyze.
- Cursor implementation of accepted in-scope work, tests, Prisma, HTTP,
  OpenAPI/Postman, and internal-contract documentation.
- Bounded Codex consultations for preparation acceptance and final review
  (`gpt-5.6-sol`, `xhigh`, `service_tier=priority`) via `/codex-delegate`.
- Progress through gates to **READY_FOR_OWNER_REVIEW**.

Not authorized:

- Mark R1-P16 Complete (requires separate human `mark complete`).
- Stage, commit, push, merge, deploy, or production migration unless the
  owner later sends the exact Git phrase.
- Activate R1-P17 or later.
- Stored-value wallets, invented InstaPay workflows (OQ-009), unapproved
  cancellation fees (OQ-001), counteroffers, Docker, or cloud.

## Readiness

| Gate | Evidence |
|---|---|
| Prior phase Complete | R1-P15 Complete under DEC-095 |
| Dependency | Confirmed bookings after verified deposit; Bookings `confirmDepositPayment`; status history |
| Canonical docs | Vision §8 journey; roadmap R1-P16; OQ-001; DEC-003; entity ownership for `booking_responses`, `booking_cancellations`, `cancellation_reasons` |
| One active phase | P15 closed; this activation makes P16 sole active |

Local feature branch: `r1-p16-provider-booking-response-cancellation-events`.

## Approved roadmap scope (source)

From `docs/product/roadmap.md` §R1-P16:

- Provider booking inbox
- View booking dossier
- Accept
- Reject with reason
- Response expiry
- Customer cancellation event
- Provider cancellation event
- Admin cancellation hook
- Status transition validation
- Notification events
- No counteroffer or dynamic price
- No unapproved cancellation fee calculation

Tables: `booking_responses`, `booking_cancellations`, `cancellation_reasons`.
Uses booking status history and audit.

Done when: only the selected provider can respond; expired or cancelled
requests cannot be accepted; cancellation is recorded and auditable;
financial side effects use approved rules only.

## Execution boundary

Out of scope:

- Stored-value user wallets (DEC-003)
- Cancellation/reschedule fee matrix and deposit-fate calculation (OQ-001)
- Counteroffer or dynamic price
- Worker/team assignment (P17)
- Order execution / completion code (P18)
- Remaining/COD collection (P20), payouts (P21)
- Full notification delivery templates/FCM/SMS (P23)
- Docker, cloud

## Role assignment

| Role | Actor |
|---|---|
| Implementer | Cursor |
| Bounded PM / reviewer | Codex CLI via `/codex-delegate` locked to `gpt-5.6-sol` / `xhigh` / `service_tier=priority` |
| Material undecidable product/UX/security | Human owner (Arabic decision format) |
| Phase Complete / Git publication | Human owner (`mark complete` / `commit and push`) |

## Closure

Owner instruction `mark complete` on 2026-09-14 closes this phase under
DEC-097. No next phase is activated by that instruction. Companion
`mark-complete` succeeded after sanctioned implement task sync (33/33);
`.spec-context.json` is `status=completed`. Cleanora Complete is DEC-097
plus `completion-report.md`.

## Progress file

`work-on-next-phase-progress.md`

# R1-P13 Activation — Booking Draft, Pricing Snapshot & Status Machine

Date: 2026-09-10
Status: Active — **READY_FOR_OWNER_REVIEW** (fresh Codex re-review PASS; DEC-092 retained as historical context); not Complete.
Authority: Owner `/work-on-next-phase` + `/goal` to activate and complete
phase 13 (DEC-090), after R1-P12 Complete.

## Owner authorization

The human owner sent `/work-on-next-phase` with an explicit goal to activate
and complete R1-P13, and required Codex review through `/codex-delegate` on
the Windows user `hossa` Codex account (not `alyoser`).

Authorized:

- Activation of R1-P13 as the sole active phase.
- Spec Kit specify / clarify / plan / checklist / tasks / analyze.
- Cursor implementation of accepted in-scope work, tests, Prisma, OpenAPI, Postman.
- Bounded Codex consultations for preparation acceptance and final review
  (`gpt-5.6-sol`, `xhigh`, `service_tier=priority`).
- Progress through gates to **READY_FOR_OWNER_REVIEW**.

Not authorized:

- Mark R1-P13 Complete.
- Stage, commit, push, merge, deploy, or production migration.
- Activate R1-P14 or later.
- Payment capture, ledger posting, wallets, Docker, cloud.

## Readiness

| Gate | Evidence |
|---|---|
| Prior phase Complete | R1-P12 Complete under DEC-090 after DEC-089 PASS |
| Dependency | Browse HTTP + Eligibility explicit evaluate + Provider/Catalog snapshots |
| Canonical docs | Vision §3/§7/§8, roadmap R1-P13, OQ-001/OQ-010, architecture entity ownership |
| One active phase | P12 closed; this activation makes P13 sole active |

Local feature branch: `codex/r1-p13-booking-draft-pricing-snapshot-status-machine`.
Inherited unpublished P12/P11-follow-up files are preserved and are not P13
scope unless they block P13 gates.

## Approved roadmap scope (source)

From `docs/product/roadmap.md` §R1-P13:

- Booking path: `browse` only
- Customer, provider, service, schedule, address
- Crew preference
- Service-specific answers
- Notes and permitted media
- Server-side price and deposit calculation
- Provider/service/price snapshot
- Booking draft and awaiting-deposit
- Idempotent booking creation
- Actor × from × to × prerequisites matrix
- Emergency modeling decision
- Cancellation event foundation without unapproved fee rules

Tables: `bookings`, `booking_items`, `booking_answers`, `booking_addresses`,
`booking_media`, `booking_snapshots`, `booking_price_breakdowns`,
`booking_status_history`, `status_transition_rules`.

Done when: final enum names and transition matrix are approved; draft and
awaiting-deposit work; pricing is server-authoritative; historical snapshots
cannot be silently rewritten; cancellation fees are not invented.

## Execution boundary

Out of scope:

- Ledger / financial accounts (P14)
- Deposit payment capture, webhooks, confirmed-from-payment (P15)
- Cancellation fee matrix (OQ-001 / P16)
- Assignment execution (P17)
- Order fulfillment HTTP and completion codes (later orders phases)
- Recommended booking path
- Maps, premium, wallets, Docker, cloud

## Role assignment

| Role | Actor |
|---|---|
| Implementer | Cursor |
| Bounded PM / reviewer | Codex CLI via `/codex-delegate` on `C:\Users\hossa\.codex` |
| Material undecidable product/UX/security | Human owner (Arabic decision format) |
| Phase Complete / Git publication | Human owner (`mark complete` / `commit and push`) |

## Progress file

`work-on-next-phase-progress.md`

# R1-P18 Activation — Order Execution & Client Completion Code

Date: 2026-09-14
Status: **Active** — Spec Kit preparation in progress; not Complete
Authority: Owner `/work-on-next-phase` after R1-P17 Complete (DEC-099).
Activation decision: DEC-100.

## Owner authorization

The human owner sent `/work-on-next-phase` (with Codex via `/codex-delegate`
and `/test-guard`). R1-P17 is Complete under DEC-099 and no next phase was
active. That instruction activates R1-P18 as the sole active phase.

Authorized:

- Activation of R1-P18 as the sole active phase.
- Spec Kit specify / clarify / plan / checklist / tasks / analyze.
- Cursor implementation of accepted in-scope work, tests, Prisma, HTTP,
  OpenAPI/Postman, and internal-contract documentation.
- Bounded Codex consultations for preparation acceptance and final review
  (`gpt-5.6-sol`, `xhigh`, `service_tier=priority`) via `/codex-delegate`
  read-only.
- Progress through gates to **READY_FOR_OWNER_REVIEW**.

Not authorized:

- Mark R1-P18 Complete (requires separate human `mark complete`).
- Stage, commit, push, merge, deploy, or production migration unless the
  owner later sends the exact Git phrase.
- Activate R1-P19 or later.
- Stored-value wallets, invented InstaPay (OQ-009), unapproved cancellation
  fees (OQ-001), panic/emergency (P19), remaining/COD (P20), live socket or
  GPS tracking, Docker, or cloud.

## Readiness

| Gate | Evidence |
|---|---|
| Prior phase Complete | R1-P17 Complete under DEC-099 |
| Dependency | ASSIGNED bookings with ACTIVE assignment; Bookings public readers; Providers workforce membership; Media attachment contract; Auth |
| Canonical docs | Vision §8 / §8.2; roadmap R1-P18; entity ownership `orders` tables; status-machine-draft completion category |
| One active phase | P17 closed; this activation makes P18 sole active |

Local feature branch: `r1-p18-order-execution-completion-code`.

## Approved roadmap scope (source)

From `docs/product/roadmap.md` §R1-P18:

- Create operational order from confirmed/assigned booking
- Assigned / pending-scheduled / on the way / in progress / ready to complete
- Six-digit completion code
- SMS delivery request
- Code hash, TTL, attempts
- Worker or supervisor completion
- Optional completion media
- Completion notes
- Timeline
- No live socket status or GPS tracking

Tables: `orders`, `order_status_history`, `completion_codes`,
`completion_code_attempts`, `order_media`, `order_notes`, `order_events`.

Done when: illegal status jumps fail; order cannot complete without valid
code; supervisor proxy follows the same proof rules; completion media
visibility is controlled; timeline is consistent for all actors.

## Execution boundary

Out of scope:

- Panic / emergency incidents (P19)
- Remaining payment / COD (P20)
- Settlements (P21), ratings (P22)
- Notification delivery FCM/SMS/email (P23) — intents only
- Cancellation fee matrix (OQ-001), wallets (DEC-003), InstaPay invention
- Live sockets, GPS, maps
- Docker, cloud

## Coverage target

Phase-owned executable files: 80% statements / 75% branches / 80% functions /
80% lines (default unless Codex prep-accept names a stricter exception).

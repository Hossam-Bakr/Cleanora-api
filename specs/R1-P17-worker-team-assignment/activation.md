# R1-P17 Activation — Worker & Team Assignment

Date: 2026-09-14
Status: **Active** — Spec Kit preparation in progress; not Complete
Authority: Owner `/work-on-next-phase` after R1-P16 Complete (DEC-097).
Activation decision: DEC-098.

## Owner authorization

The human owner sent `/work-on-next-phase` (with Codex via `/codex-delegate`
and `/test-guard`). R1-P16 is Complete under DEC-097 and no next phase was
active. That instruction activates R1-P17 as the sole active phase.

Authorized:

- Activation of R1-P17 as the sole active phase.
- Spec Kit specify / clarify / plan / checklist / tasks / analyze.
- Cursor implementation of accepted in-scope work, tests, Prisma, HTTP,
  OpenAPI/Postman, and internal-contract documentation.
- Bounded Codex consultations for preparation acceptance and final review
  (`gpt-5.6-sol`, `xhigh`, `service_tier=priority`) via `/codex-delegate`
  read-only.
- Progress through gates to **READY_FOR_OWNER_REVIEW**.

Not authorized:

- Mark R1-P17 Complete (requires separate human `mark complete`).
- Stage, commit, push, merge, deploy, or production migration unless the
  owner later sends the exact Git phrase.
- Activate R1-P18 or later.
- Stored-value wallets, invented InstaPay (OQ-009), unapproved cancellation
  fees (OQ-001), order execution / completion code (P18), panic (P19),
  remaining/COD (P20), Docker, or cloud.

## Readiness

| Gate | Evidence |
|---|---|
| Prior phase Complete | R1-P16 Complete under DEC-097 |
| Dependency | Accepted bookings (`ACCEPTED`); Providers workforce + availability public readers; Bookings status history |
| Canonical docs | Vision §8.1; roadmap R1-P17; entity ownership for assignment tables; P07 crew/`cleans` rules |
| One active phase | P16 closed; this activation makes P17 sole active |

Local feature branch: `r1-p17-worker-team-assignment`.

## Approved roadmap scope (source)

From `docs/product/roadmap.md` §R1-P17:

- Assign worker
- Assign multiple workers
- Assign existing team
- Ownership checks
- Active-state checks
- Schedule/capacity checks
- Crew-gender checks
- Escort and `cleans` assignment flag
- Replace assignment according to status rules
- Assignment history
- Worker order visibility

Tables: `booking_assignments`, `booking_assignment_members`,
`booking_assignment_history`.

Done when: only valid provider workers can be assigned; crew preference is
enforced; conflicts and invalid team composition are blocked; historical
assignments are preserved.

## Execution boundary

Out of scope:

- Order execution / on_the_way / in_progress / completion code (P18)
- Panic / emergency (P19)
- Remaining payment / COD (P20)
- Settlements (P21), ratings (P22)
- Notification delivery FCM/SMS/email (P23) — intents only if needed
- Cancellation fee matrix (OQ-001), wallets (DEC-003), InstaPay invention
- Docker, cloud

## Coverage target

Phase-owned executable files: 80% statements / 75% branches / 80% functions /
80% lines (default unless Codex prep-accept names a stricter exception).

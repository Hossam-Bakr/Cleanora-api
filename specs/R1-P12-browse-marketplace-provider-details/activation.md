# R1-P12 Activation — Browse Marketplace & Provider Details

Date: 2026-09-10  
Status: Active — **READY_FOR_OWNER_REVIEW** (DEC-087 owner review substitution); not Complete.  
Authority: Owner command `/work-on-next-phase` after R1-P11 Complete (DEC-085).

## Owner authorization

The human owner sent `/work-on-next-phase`, which authorizes:

- Activation of the next dependency-ready roadmap phase (R1-P12).
- Spec Kit preparation, clarification, planning, tasks, analysis.
- Cursor implementation of accepted in-scope work and tests.
- Bounded Codex consultations for preparation/decision acceptance and final review.
- Progress through gates to **READY_FOR_OWNER_REVIEW**.

This authorization does **not**:

- Mark the phase Complete.
- Stage, commit, push, merge, deploy, or run a production migration.
- Activate R1-P13 or any later phase.
- Grant P11-style unlimited Codex product-completion authority (DEC-062 does not carry forward).
- Authorize Docker/cloud work or stored-value user wallets.

The exact-message `commit and push` rule remains in force for later publication only.

## Readiness

| Gate | Evidence |
|---|---|
| Prior phase Complete | R1-P11 Complete under DEC-085 |
| Dependency | Eligibility Browse facade `getStandardBrowseCandidates` shipped |
| Canonical docs | Vision, roadmap R1-P12, decisions, architecture repository-local |
| One active phase | Pointer was Complete / no next phase; this activation makes P12 sole active |

Local feature branch: `codex/r1-p12-browse-marketplace-provider-details` from `main` (P11 merged). Inherited dirty-tree files from post-P11 local edits are preserved and are **not** P12 scope unless they block P12 gates.

## Approved roadmap scope (source)

From `docs/product/roadmap.md` §R1-P12:

- Browse categories and services
- Guest Browse
- Eligible provider list
- Provider profile, gallery, contacts
- Services and prices
- Team size and crew summary
- Rating summary when available
- Filters, pagination, search
- Standard sorting
- No premium boost before Release 2
- No map, distance, or socket behavior

Tables: reads catalog, provider, team, rating, and eligibility tables; `provider_view_events` and `search_events` optional.

Done when: only eligible live providers appear; guest Browse works; verified account required before booking/payment; search and filters use server rules.

## Execution boundary

Out of scope for this phase:

- Booking draft / status machine (P13)
- Payments, ledger, wallets
- Ratings module creation (omit summary until module exists)
- Premium boost / Recommended path
- Coordinates, radius, maps, sockets
- Docker / cloud (Release 3)
- Flipping Providers `eligibleForPublicBrowse` readiness placeholder as a substitute for Eligibility

## Role assignment

| Role | Actor |
|---|---|
| Implementer | Cursor Auto |
| Bounded PM / reviewer | Codex (`gpt-5.6-sol`, `xhigh`) |
| Material undecidable product/UX/security | Human owner (Arabic decision format) |
| Phase Complete / Git publication | Human owner (`mark complete` / `commit and push`) |

## Progress file

`specs/R1-P12-browse-marketplace-provider-details/work-on-next-phase-progress.md`

# Cleanora — Decision Log

> This file records approved project decisions that clarify delivery timing or terminology.  
> It does not silently rewrite locked product behavior in `vision.md`.

---

## DEC-001 — Three-release delivery model

**Date:** 2026-07-23  
**Status:** Approved

The product will be delivered through three releases:

1. Release 1 — Core Marketplace
2. Release 2 — Marketers & Growth
3. Release 3 — Smart Marketplace

Bassam's P0–P5 labels remain useful as historical product prioritization, but the implementation roadmap uses these three releases.

---

## DEC-002 — Release 1 is a large end-to-end marketplace

**Date:** 2026-07-23  
**Status:** Approved

Release 1 contains the complete normal marketplace journey:

- Identity
- Provider and worker management
- Catalog
- Standard Browse
- Booking
- Deposit
- Order execution
- Completion code
- Basic panic/emergency
- Money closure
- Ratings/reviews
- Notifications
- Support
- Admin/operations controls

A real user must be able to complete the journey without manual database edits.

---

## DEC-003 — No internal Cleanora wallets

**Date:** 2026-07-23  
**Status:** Approved

Cleanora will not hold reusable customer, provider, or marketer balances.

Allowed:

- External mobile-wallet number
- Bank/card payout destination
- Gateway payout account
- Provider or marketer due
- Settlement and payout records

Not allowed:

- Stored-value user wallet
- Reusable in-platform balance
- Wallet top-up or wallet transfer feature

Any source-document reference to a provider or marketer “wallet” must be interpreted as an external payout method unless product explicitly changes this decision.

---

## DEC-004 — Maps and WebSockets are deferred to Release 3

**Date:** 2026-07-23  
**Status:** Approved

Release 1 uses normal REST APIs and textual/configured coverage areas.

Release 1 excludes:

- Map pin
- Latitude/longitude
- Radius matching
- WebSockets
- Live offers
- Live team tracking
- Admin live map

These remain part of the product vision and are delivered in Release 3.

---

## DEC-005 — Eligibility engine is built in two versions

**Date:** 2026-07-23  
**Status:** Approved

Release 1 implements Eligibility Engine V1 using:

- Service
- Provider status
- Textual coverage
- Availability
- Crew gender
- Capacity and team rules

Release 3 extends the same domain into V2 using:

- Coordinates
- Zone geometry
- Radius
- Distance
- Real-time candidate distribution
- Smart ranking inputs

The engine must not be duplicated.

---

## DEC-006 — Money closure moves into Release 1

**Date:** 2026-07-23  
**Status:** Approved

Although Bassam's phased delivery separates P0 trust and P1 money closure, the approved Release 1 includes:

- Deposit
- Immutable financial records
- COD cash confirmation
- Online provider dues
- Provider settlements
- Refund/adjustment foundation
- Reconciliation

This is required for an end-to-end production release.

---

## DEC-007 — Marketers and Premium are Release 2

**Date:** 2026-07-23  
**Status:** Approved

Release 2 includes:

- Marketer accounts and activation fee
- Referral links and attribution
- Commission engine
- Marketer reporting
- Marketer settlement
- Fraud/admin controls
- Premium provider listing and rank boost

Coupons are excluded until their stacking and accounting rules are approved.

---

## DEC-008 — Basic ratings and reviews are Release 1

**Date:** 2026-07-23  
**Status:** Approved

Release 1 supports:

- Provider rating
- Assigned-team rating
- Written review
- One review per completed order
- Aggregate score

Advanced dimensions, edit windows, publication rules, and richer moderation remain open or later.

---

## DEC-009 — Panic core is Release 1; live location is Release 3

**Date:** 2026-07-23  
**Status:** Approved

Release 1 provides emergency state, alerts, dossier, audit, and controlled clearing.

Release 3 adds:

- Consent-based live location
- Realtime emergency updates
- Live map visualization

---

## DEC-010 — Admin control is split by dependency

**Date:** 2026-07-23  
**Status:** Approved

Release 1 includes all admin actions that do not require maps or marketer modules.

Release 2 adds marketer and premium administration.

Release 3 adds live map and realtime operations.

---

## DEC-011 — Google sign-in is part of complete authentication

**Date:** 2026-07-23  
**Status:** Approved product addition

Google sign-in is included in Release 1 authentication.

It does not replace the actor-specific verification rules. Required phone or email verification still applies based on account type.

---

## DEC-012 — Cleanora is a standalone greenfield project

**Date:** 2026-07-23  
**Status:** Approved

Cleanora is implemented as a completely standalone project.

It has its own:

- Repository
- Application architecture
- Master ERD
- Prisma schema
- Migration history
- Seed data
- Modules
- APIs
- Tests
- Documentation
- Deployment configuration

There is no external application, repository, schema, migration history, or production dataset that Cleanora must read, preserve, import, migrate, or remain compatible with.

Rules:

- Design every domain from the approved Cleanora vision and roadmap.
- Create the Cleanora Prisma schema incrementally, phase by phase.
- Create Cleanora migrations from the first project migration onward.
- Do not add compatibility tables, compatibility fields, adapters, imports, or migration scripts for an unavailable system.
- Do not refer to unavailable repositories or undocumented external code.
- All implementation instructions must be executable using the Cleanora repository alone.
- Every dependency on an external service must be explicitly documented and configured.

The rule is:

> Cleanora must be understandable, buildable, testable, and deployable from its own repository and documentation only.


---

## DEC-013 — Product sources remain traceable

**Date:** 2026-07-23  
**Status:** Approved

Bassam's four documents remain unchanged source references.

`vision.md` is the consolidated canonical implementation vision.  
`decision-log.md` records approved timing and terminology decisions.  
`roadmap.md` controls delivery order.  
`open-questions.md` blocks invention.

---

## DEC-014 — Prisma schema and migrations evolve phase by phase

**Date:** 2026-07-23  
**Status:** Approved

R1-P00 creates the Master ERD and database conventions, but does not fully create every release table.

Every later phase owns its required Prisma work:

- Inspect the current schema and migrations.
- Update `prisma/schema.prisma`.
- Create a clearly named phase migration.
- Review generated SQL.
- Add required constraints, indexes, seeds, and data backfills.
- Regenerate Prisma Client.
- Run database and compatibility tests.
- Document all new and changed models.

Applied production migrations must not be edited or deleted. Corrections use forward migrations.

Future-release models must not be created early without a documented dependency.

---

## DEC-015 — Release 1 Google sign-in is individual-only

**Date:** 2026-07-24
**Status:** Approved

Google sign-in is enabled only for `INDIVIDUAL` accounts in Release 1.

The identity architecture remains extensible for other account types, but
company, engineer, provider-owner, worker, and other audiences are not enabled
for Google authentication in R1-P02.

Google authentication and account linking never bypass required phone
verification or any actor-specific verification gate. A new or linked
individual account remains restricted until its required phone verification is
complete.

This decision resolves OQ-014.

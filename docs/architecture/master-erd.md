# Master ERD — Cleanora Conceptual Model

**Phase**: R1-P00 — Product & Database Architecture  
**Status**: Architecture contract (documentation only — no Prisma models)  
**Date**: 2026-07-24  
**Module catalog**: see [`entity-ownership.md`](./entity-ownership.md)  
**Canonical standalone boundary**: [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md)

## Purpose

Provide one traceable conceptual model for all three approved releases before any product migration. This is an architectural map, not a production schema.

## Sources

- `AGENTS.md`, `.specify/memory/constitution.md`
- `docs/product/vision.md`, `decision-log.md`, `open-questions.md`, `roadmap.md`, `current.md`
- `docs/product/standalone-project-boundary.md`
- Spec Kit: `specs/R1-P00-product-database-architecture/{spec,plan,research,data-model}.md`

## Standalone boundary validation

Cleanora is a standalone greenfield product. This ERD MUST NOT depend on another repository, schema, migration history, database, or undocumented service. Validate against [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md). Do **not** create a duplicate boundary document under `docs/architecture/`.

## Shared vocabulary

| Term | Meaning |
|---|---|
| Conceptual entity | Domain concept required by vision/roadmap |
| Planned table | Candidate persistence unit (see ownership map) |
| Authoritative record | Current live business truth |
| Historical snapshot | Confirmed values preserved against later live changes |
| Immutable financial record | Append-only money history; corrections via compensating entries |
| Configuration | Global or country-scoped settings |
| Audit record | Privileged/sensitive action evidence |
| External integration reference | Provider/gateway/object-store identifier — never a Cleanora user balance |
| Owner / lifecycle owner | Module authoritative for create/update/transition |
| Consumer | Module reading via public contract only |

## Record-classification legend

| Symbol / label | Meaning |
|---|---|
| **A** Authoritative | Live mutable business truth |
| **H** Historical snapshot | Confirmed values that must not rewrite after confirmation |
| **I** Immutable financial | Append-only money history |
| **C** Configurable | Settings/types/templates |
| **U** Auditable | Privileged/sensitive action evidence |
| **E** External integration | External rail/object reference |

Classifications may combine.

## Acceptance criteria (US1)

- [x] SC-001: Entity families covered or marked derived
- [x] SC-003: Important relationships show direction, cardinality, owner, consumer, lifecycle boundary
- [x] SC-006: Zero stored-value wallets / reusable Cleanora-held balances
- [x] SC-007: Payout destinations structurally separate from dues/settlements/payouts/ledger
- [x] SC-011: FR-024–FR-033 boundaries answered

---

## 1. Identity & Access — module `identity` — R1 / R1-P02–P03

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| User | R1 / R1-P02 | A | Singular identity |
| Auth credential / session / OTP / password reset / social link | R1 / R1-P02 | A/E | Social audience enablement gated (OQ-014) |
| Role, Permission, RoleGrant | R1 / R1-P03 | A/C | Locked roles: customer, provider owner, worker, marketer, admin, operations, support, finance |
| Scoped staff / provider permission | R1 / R1-P03 | A | Supervisor & provider-admin are scoped capabilities, not new auth systems |
| Ban / suspension | R1 / R1-P02 | A/U | Conceptual control: **R1-P02** owns identity enforcement at login and protected endpoints; **R1-P25** is an administrative consumer/control surface (ban/unban, suspend/reinstate). No dedicated roadmap table; persistence representation deferred to owning implementation phases (may use approved user state/history/audit structures). |
| Security / auth event | R1 / R1-P02 | U | |

**Relationships**: User 1—* RoleGrant; User 1—* AuthLink. Multi-role over time without forking identity.

## 2. Customer — module `customers` — R1 / R1-P04; geo R3

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| CustomerProfile (individual/company/engineer) | R1 / R1-P04 | A | Share customer role; no separate identity stacks |
| Preferences | R1 / R1-P04 | C/A | |
| TextAddress | R1 / R1-P04 | A | |
| GeoAddress extension | R3 / R3-P01 | A/E | Extends address; does not create second identity |

## 3. Provider Supply — module `providers` — R1 / R1-P05–P07, P09–P10

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| Provider, profile, contacts, members | R1 / R1-P05 | A | |
| Worker, skills, status history | R1 / R1-P07 | A | |
| Team, TeamMembership | R1 / R1-P07 | A | Provider-owned; ≠ order assignment evidence |
| Verification case, document types/documents | R1 / R1-P06 | A/C | OQ-007: no frozen production checklist |
| Offering, price, price history | R1 / R1-P09 | A/H | Provider-owned prices |
| Coverage, schedules, capacity | R1 / R1-P10 | A | Textual coverage in R1 |
| **ExternalPayoutDestination** | R1 / R1-P06 | E | **Separate from dues/settlements/payouts** (FR-028) |

## 4. Catalog & Localization — module `catalog` — R1 / R1-P08

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| Category, Service | R1 / R1-P08 | A | Platform-owned catalog truth |
| Translations (AR/EN) | R1 / R1-P08 | A | |
| Price units, service fields/options | R1 / R1-P08 | C | OQ-002: notes only; no universal materials rule |
| Country availability | R1 / R1-P08 | C/A | |

**Boundary**: Catalog ≠ provider offerings/prices (FR-027).

## 5. Eligibility — module `eligibility` — R1-P11; R3-P03 extends

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| Rule versions, evaluations, candidate results | R1 / R1-P11 | A/H | One shared domain for Browse & Recommended |
| Geo results / performance metrics | R3 / R3-P03 | H | V2 extends same domain (DEC-005) |

## 6. Booking & Recommended commercial path — module `bookings` — R1-P12–P13; R3 path

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| Browse view/search events | R1 / R1-P12 | U/H | |
| Booking, items, answers, addresses, media | R1 / R1-P13 | A/H | Commercial intent |
| Snapshots, price breakdowns | R1 / R1-P13 | H | Confirmed values |
| Status history, transition rules | R1 / R1-P13 | U/C | **Status labels provisional — OQ-010 → R1-P13** |
| Responses, cancellations, reasons | R1 / R1-P16 | A/U | OQ-001: no fee matrix |
| Assignments / members / history | R1 / R1-P17 | H | Order/booking assignment evidence |
| Recommended request/offer/negotiation entities | R3 | A/H | Converge into same booking/order/finance paths |

## 7. Order Execution — module `orders` — R1-P18–P19

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| Order, status history, notes, events | R1 / R1-P18 | A/U | Executable fulfillment |
| Completion codes/attempts, order media | R1 / R1-P18 | A/H | |
| Emergency incidents/actions/history | R1 / R1-P19 | A/U | **Emergency final form provisional — OQ-010 → R1-P13** |

## 8. Payments & Finance — module `payments` — R1-P14–P15, P20–P21

| Entity | Release/Phase | Class | Notes |
|---|---|---|---|
| Ledger accounts/entries/links/snapshots/adjustments | R1 / R1-P14 | I | Append-only; compensating entries |
| Payment methods/attempts/payments/gateway events | R1 / R1-P15 | A/E/I | OQ-009: no InstaPay invention |
| Remaining payment / COD | R1 / R1-P20 | A/I | |
| Provider dues, settlements, payouts | R1 / R1-P21 | I | Destinations remain on provider module |

### Prohibited (SC-006)

- Customer / provider / worker / marketer **stored-value wallets**
- Reusable Cleanora-held user balances, wallet top-ups, or in-platform transfers

External “mobile wallet” means an **external payout/payment destination only** (DEC-003).

## 9. Trust & Support — modules `ratings`, `support` — R1-P22, R1-P24

| Entity | Module | Release/Phase | Class | Notes |
|---|---|---|---|---|
| Reviews, targets, ratings, summaries | ratings | R1 / R1-P22 | A | Basic only (OQ-005/012) |
| Support tickets, messages, assignments | support | R1 / R1-P24 | A/U | No free chat (OQ-006) |

## 10. Notifications — module `notifications` — R1 / R1-P23

Templates, translations, notifications, deliveries, preferences — A/C/U. No in-order chat entity.

## 11. Administration & Audit — module `admin` — R1-P01 foundation / R1-P25

Audit logs, admin actions/exports, system incidents — U. Does not absorb other modules’ lifecycle ownership.

## 12. Country & Configuration — module `configuration` — R1 / R1-P01

Country, currency, locale, global/country configs — C/A. Country-sensitive rules keyed by `countryCode` (FR-030). No hidden Egypt-only business defaults.

## 13. Media — module `media` (technical) + business owners

`media_files` / object references — E. Business modules retain authorization and lifecycle meaning (FR-032).

## 14. Marketer & Growth — module `marketers` — R2

Marketer identity, referrals, commissions, settlements, premium plans/enrollment — A/I/C.

**Payout destination separation (FR-028 / SC-007):** Marketer **external payout destinations** (`marketer_payout_destinations`) are structurally separate from:

- Marketer **dues / commission obligations** (`marketer_commissions` and related obligation records)
- Marketer **settlement** records (`marketer_settlements`, `marketer_settlement_items`)
- Marketer **payout execution/history** (`marketer_payouts`, `marketer_payout_attempts`, `marketer_payout_documents`)

Destinations are external rails only. **No Cleanora stored-value marketer wallet**, top-up, or transferable in-platform balance (DEC-003).

Premium cannot bypass eligibility (DEC-007). OQ-008 coupons excluded. OQ-013 production premium limits open.

## 15. Geo & Realtime — module `geo` — R3

Coordinates, zones, distance, consent, tracking, admin map, realtime audit — A/E/U. Extend earlier entities; do not create competing identity/eligibility truth (DEC-004/005).

---

## Important relationships (direction · cardinality · owner · consumer · lifecycle)

| From → To | Card. | Owner | Consumer | Lifecycle boundary |
|---|---|---|---|---|
| User → RoleGrant | 1—* | identity | `admin` (authorization decisions); `providers` (scoped capability checks) | Grants accumulate; identity singular |
| User → CustomerProfile | 1—0..1 | customers | `bookings` (commercial party); `support`/`payments` (context) | Profile ≠ auth identity |
| Provider → Worker/Team | 1—* | providers | `bookings` (assignment source); `orders` (fulfillment context) | Membership mutable |
| BookingAssignment → Workers/Team evidence | 1—* | bookings | `orders` (committed crew for execution) | Historical; not rewritten by team changes |
| Catalog Service → Provider Offering | 1—* | catalog (service def) / providers (offering) | `bookings` (selection/snapshots); `eligibility` (filters) | Live catalog ≠ confirmed snapshots |
| Booking → Order | 1—1 (after activation) | bookings → orders | `payments` (deposit/remaining); `ratings`/`support` (post-order) | See boundary below |
| ProviderPayoutDestination → Due/Settlement/Payout | 1—* refs | providers (destination) / payments (due/settlement/payout) | `payments` reads destination for execution only | Destination ≠ obligation/result |
| MarketerPayoutDestination → Commission/Settlement/Payout | 1—* refs | marketers (destination & marketer money records) | `admin` (ops); execution rows reference destination without owning it | Destination ≠ dues/settlement/payout history; no wallet |
| LedgerEntry → compensating Adjustment/Refund | 1—* | payments | `admin` (finance control); `marketers` (platform-share commission context) | Never hard-delete originals |
| Eligibility evaluation → Browse/Recommended | * | eligibility | `bookings` (candidate lists / path conversion) | One domain; V2 extends inputs |
| MediaAsset → business parent | *—1 | media (storage) + business owner (authz) | Parent modules (`providers`, `catalog`, `bookings`, `orders`, `customers`, `support`) | Storage ≠ authorization owner |

## Booking vs order boundary (FR-024)

- **Booking** = commercial intent, configuration, pricing/service snapshots, and confirmation boundary.
- **Order** = executable fulfillment lifecycle after activation.
- **Activation invariant (conceptual)**: when a booking reaches the confirmed/activated commercial state required to start fulfillment, exactly one Order is created or activated for that booking. Exact enum names remain **provisional under OQ-010 → R1-P13**.

## Browse / Recommended convergence (FR-025)

Browse path and accepted Recommended offers converge into the **same** confirmed booking → order → financial paths while preserving `BookingSource` / path history. They are not separate execution domains.

## Conceptual / derived (non-persisted or optional)

- Ephemeral eligibility decision views (when not using evaluation tables)
- Effective configuration merge
- Ledger balances derived from entries
- Live team membership vs historical assignment composition

## Edge-case mapping (spec Edge Cases)

| Edge case | ERD / ownership handling |
|---|---|
| Multi-role user | Singular User + RoleGrants; profiles separate |
| Supervisor / provider-admin | Scoped permissions, not new auth |
| Team changes after assignment | Team A; assignment H retained |
| Catalog/price change after confirm | Snapshots H on booking |
| Computed vs persisted | Listed in derived section / ownership non-table list |
| Multi-module reads | One lifecycle owner; consumers via contracts |
| “Mobile wallet” wording | External destination only |
| Financial correction | Compensating entries; no hard delete |
| Global vs country values | Precedence + countryCode |
| Media on many parents | media technical + business auth owner |
| R3 distance/realtime | Extends eligibility/address/order |
| Open question changes later relation | Marked provisional / OQ-linked |

## Wallet / payout negative review

| Check | Result |
|---|---|
| Stored-value user wallet entities | **None** |
| Reusable Cleanora-held balances | **None** |
| Destination ≠ due/settlement/payout/ledger | **Separated** (provider and marketer) |

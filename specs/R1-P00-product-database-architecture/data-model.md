# Data Model: R1-P00 Conceptual Architecture

**Date**: 2026-07-24  
**Phase**: R1-P00 (documentation only — no Prisma models)  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

## Purpose

Define the conceptual data model, ownership, cardinality, and lifecycle
boundaries that the later Master ERD and entity-ownership map must implement.
This file is a planning artifact. It does **not** authorize schema or migration
work.

## Vocabulary

| Term | Meaning |
|---|---|
| Conceptual entity | Domain concept required by vision/roadmap |
| Planned table | Candidate persistence unit from roadmap inventory or proven necessity |
| Authoritative record | Current live business truth |
| Historical snapshot | Confirmed values preserved against later live changes |
| Immutable financial record | Append-only money history; corrections via compensating entries |
| Configuration | Global or country-scoped settings |
| Audit record | Privileged/sensitive action evidence |
| External integration reference | Provider/gateway/object-store identifier, not Cleanora balance |
| Lifecycle owner | Module/service authoritative for create/update/transition |
| Consumer | Module that reads via public contract without owning the table |

## Planned module ownership

See research Decision 3. Every planned table gets exactly one of:

`identity` · `customers` · `providers` · `catalog` · `eligibility` · `bookings` ·
`orders` · `payments` · `ratings` · `notifications` · `support` · `admin` ·
`configuration` · `media` · `marketers` · `geo`

Shared technical areas (`core`, `integrations`, `shared`) do not own business
lifecycle tables.

## Entity families and relationships

Cardinalities below are architecture requirements for the Master ERD. Final
table names follow owning-phase Prisma conventions.

### 1. Identity & Access (`identity`) — R1 / R1-P02–P03

| Entity | Notes | Key relationships |
|---|---|---|
| User | Singular identity | 1 User → * RoleGrant; 1 User → 0..* AuthLink |
| AuthLink / credential / session / OTP | Auth mechanics | Owned by identity; no separate identity stack per actor |
| Role / Permission / RoleGrant | Locked roles: customer, provider owner, worker, marketer, admin, operations, support, finance | *:* via grants |
| Scoped staff / provider permission | Supervisor & provider-admin are scoped capabilities, not new auth systems | Belong to provider scope when applicable |
| Ban / suspension | Lifecycle control | 1 User → 0..* control states |
| Security / audit event | Auditable | References actor + target |

**Lifecycle**: Identity owns authentication and role grants. Actor profiles in
other modules reference User; they do not fork identity.

### 2. Customer (`customers`) — R1 / R1-P04; geo extension R3

| Entity | Notes | Key relationships |
|---|---|---|
| CustomerProfile | Individual / company / engineer types share customer role | 1 User → 0..1 CustomerProfile (per product rules) |
| CustomerType / preferences | Configuration-like attributes | Owned by customers |
| TextAddress | R1 address | 1 Customer → *; booking may snapshot address |
| GeoAddress extension | R3 | Extends address concept; does not create second identity |

### 3. Provider Supply (`providers`) — R1 / R1-P05–P07, P09–P10

| Entity | Notes | Key relationships |
|---|---|---|
| Provider | Supply org | 1 Provider → * Worker; * Team; * Offering; * PayoutDestination |
| ProviderOwner / membership | Ownership | User ↔ Provider |
| Worker | Capability, gender, lifecycle | May belong to teams |
| Team / TeamMembership | Provider-owned | Distinct from order assignment evidence |
| Supervisor / provider-admin scope | Flags/permissions | Not separate auth |
| VerificationCase / DocumentType / ProviderDocument | Configurable types (OQ-007) | Do not freeze production checklist |
| Offering / Price / Coverage / Availability / Capacity | Provider-owned commercial supply | Catalog service is referenced, not owned |
| ExternalPayoutDestination | External rail only | Separate from dues/settlements (FR-028) |

**Lifecycle boundary**: Team membership changes do not rewrite historical order
assignment composition.

### 4. Catalog & Localization (`catalog`) — R1 / R1-P08

| Entity | Notes | Key relationships |
|---|---|---|
| Category / Service | Platform-owned catalog truth | 1 Category → * Service |
| LocalizedContent | AR/EN | Owned with uniqueness/fallback rules |
| PriceUnit / ServiceRequirement | Configurable notes (OQ-002: no universal materials rule) | Attached to service |

**Boundary**: Catalog definitions ≠ provider offerings/prices (FR-027).

### 5. Eligibility (`eligibility`) — R1-P11; R3-P03 extends

| Entity | Notes | Key relationships |
|---|---|---|
| EligibilityPolicy / Input / Result | One shared domain for Browse & Recommended | Consumes provider/catalog/coverage/capacity |
| V1 inputs | Service, provider state, textual coverage, availability, crew preference, capacity | |
| V2 inputs | Geo, distance, radius, realtime, smart ranking | Extensions, not a competing truth (DEC-005) |

**Derived note**: Some eligibility results may be computed/ephemeral; ownership
map must mark non-persisted concepts explicitly.

### 6. Booking & Recommended commercial path (`bookings`) — R1-P12–P13; R3 path

| Entity | Notes | Key relationships |
|---|---|---|
| BookingDraft / Booking | Commercial intent + confirmation boundary | References customer, provider, service snapshots |
| BookingSource | `browse` vs recommended path history | Preserved on convergence |
| Service/Price/Address snapshots | Historical | Immutable after confirmation needs |
| RecommendedSession / Request / Offer / Counteroffer | R3 commercial negotiation | Converges into same booking/order paths (FR-025) |
| DepositRequirement (commercial) | Calculation inputs | Actual money movement owned by payments |

**OQ-010**: Status labels provisional until R1-P13 transition matrix.

**Booking → Order invariant** (FR-024): Master ERD and status-machine draft must
state the exact confirmation/activation event that creates or activates the
Order without freezing enum names.

### 7. Order Execution (`orders`) — R1-P16–P19

| Entity | Notes | Key relationships |
|---|---|---|
| Order | Executable fulfillment lifecycle | 1 Booking confirmation → 1 Order (invariant to document) |
| Transition / status history | Auditable | Uses transition format; enums provisional (OQ-010) |
| Assignment / assigned worker-team evidence | Order-owned history | Separate from provider TeamMembership |
| Completion challenge/code / evidence / media | Order-owned | Media mechanics via `media` |
| Cancellation / failure event | Capability + audit; no fee matrix (OQ-001) | |
| Emergency flag/event / dossier | Representation provisional (OQ-010) | May be state or parallel concern — undecided |

### 8. Payments & Finance (`payments`) — R1-P14–P15, P20–P21; R2 marketer money

| Entity | Notes | Key relationships |
|---|---|---|
| PaymentMethod / PaymentAttempt / ExternalPaymentReference | External rails (OQ-009: no InstaPay invention) | |
| Deposit / COD confirmation | Server-authoritative | Linked to booking/order |
| LedgerAccount / LedgerEntry / links / snapshots | Append-only | Corrections via refund/adjustment entries |
| ProviderDue / Settlement / Payout | Obligations and results | Destinations remain separate |
| Refund / Adjustment / Reconciliation | Compensating / control | Never rewrite original financial rows |
| Idempotency keys | Required for replayable callbacks | |

**Prohibited**: stored-value user wallet, reusable Cleanora-held balance,
wallet top-up/transfer (DEC-003, SC-006).

### 9. Trust & Support (`ratings`, `support`) — R1-P22, R1-P24

| Entity | Notes | Key relationships |
|---|---|---|
| ProviderRating / AssignedTeamRating / WrittenReview / Aggregate | Basic only (OQ-005/OQ-012) | Per completed order constraints |
| SupportTicket / Reply / Assignment | Links to order/emergency/refund dossiers | |

### 10. Notifications (`notifications`) — R1-P23

| Entity | Notes | Key relationships |
|---|---|---|
| Template / LocalizedTemplate / Notification / DeliveryAttempt | Admin-editable templates | Channel references external |

**OQ-006**: No free-form in-order chat entity in three-release inventory.

### 11. Administration & Audit (`admin`, plus emitting modules) — R1-P03, R1-P25

| Entity | Notes | Key relationships |
|---|---|---|
| PrivilegedAction / AuditRecord | Actor, timestamp, reason, target, before/after | Required for sensitive transitions |
| Operational / finance control records | Staff surfaces | Do not absorb other modules' lifecycle ownership |

### 12. Country & Configuration (`configuration`) — R1-P01

| Entity | Notes | Key relationships |
|---|---|---|
| Country / Currency / Locale | Reference data | |
| GlobalConfig / CountryConfig | Precedence explicit | Country-sensitive rules keyed by `countryCode` |

### 13. Media (`media` technical + business owners) — consumed across phases

| Entity | Notes | Key relationships |
|---|---|---|
| MediaAsset / ObjectReference / AttachmentLink | Storage mechanics business-neutral | Business module owns authorization & lifecycle meaning (FR-032) |

### 14. Marketer & Growth (`marketers`) — R2

| Entity | Notes | Key relationships |
|---|---|---|
| MarketerProfile / Activation / Referral / Attribution | R2 | |
| Commission / Settlement / PayoutDestination | From Cleanora share; external destination | No marketer wallet |
| PremiumPlan / Benefit / Enrollment / RankingInput | Configurable (OQ-013); cannot bypass eligibility | |
| Fraud / clawback actions | Admin growth ops | |

**OQ-008**: Coupons/promo stacking excluded from three-release inventory.

### 15. Geo & Realtime (`geo` + extensions on earlier entities) — R3

| Entity | Notes | Key relationships |
|---|---|---|
| Coordinates / Zone / DistanceCoverage / Consent / LiveLocation | Extensions | Attach to existing address/order/eligibility concepts |
| Realtime distribution / live tracking / admin live map | R3 only | DEC-004 |

## Critical lifecycle boundaries (must appear on Master ERD)

1. **User multi-role**: one identity; many grants/profiles over time.
2. **Catalog vs provider price**: live catalog ≠ confirmed snapshots.
3. **Provider team vs order assignment**: membership mutable; assignment evidence retained.
4. **Booking vs order**: commercial confirmation vs fulfillment execution.
5. **Browse vs Recommended**: distinct source history; shared execution/finance path.
6. **Payout destination vs due/settlement/payout/ledger**: structural separation.
7. **Financial correction**: compensating entries; no hard delete / in-place rewrite.
8. **Eligibility V1/V2**: one domain; V2 extends inputs.
9. **Media**: technical storage ≠ business authorization owner.
10. **Emergency / booking-order enums**: provisional until R1-P13 (OQ-010).

## Record classification guide

A planned table may carry multiple classifications:

- Authoritative
- Historical snapshot
- Immutable financial
- Configurable
- Auditable
- External integration reference

Entity-ownership.md must show all applicable flags.

## Planned-table ownership row schema (for entity-ownership.md)

Every roadmap inventory table and every proven additional table MUST have:

| Field | Requirement |
|---|---|
| Planned table candidate name | From roadmap or justified addition |
| Conceptual entity | Link to Master ERD |
| Owning module | Exactly one |
| Owning release | R1 / R2 / R3 |
| Owning roadmap phase | Exactly one creating phase |
| Lifecycle owner | Module/service name |
| Important consumers | Modules + purpose |
| Classifications | As applicable |
| OQ linkages | If provisional |
| Notes | Non-persisted? early-compat field? |

R1-P00 is never the creating phase for product tables.

## Status-transition record format (provisional labels only)

Every sample transition in `status-machine-draft.md` MUST include:

1. Actor
2. From state (provisional label)
3. To state (provisional label)
4. Preconditions
5. Side effects
6. Audit requirement
7. Failure or rejection outcome

Plus: backend authority, permission/ownership checks, stale-state/concurrency
rejection, idempotent side-effect expectations, transition owner.

**Open (OQ-010 → R1-P13)**: final booking/order enum names; whether emergency
is a state or parallel concern.

## Explicit non-goals for this data model

- No Prisma model definitions
- No migration SQL
- No final enum literals for OQ-010
- No fee, coupon, chat, InstaPay, or premium production values
- No Docker/cloud persistence topology

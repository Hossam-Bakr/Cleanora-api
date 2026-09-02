# Entity Ownership Map

**Phase**: R1-P00 — Product & Database Architecture  
**Status**: Architecture contract (documentation only)  
**Date**: 2026-07-24  
**Sources**: `docs/product/roadmap.md` table inventories, `specs/R1-P00-product-database-architecture/data-model.md`, research Decision 3–4  
**Canonical standalone boundary**: [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md)

## Purpose

Assign every planned table exactly one owning business module, release, creating roadmap phase, and lifecycle owner. R1-P00 is the architecture-contract phase only — it never creates product tables.

## Acceptance criteria (US2 / FR-034–FR-039 / SC-002 / SC-005 / SC-010)

- [x] Every roadmap `### Tables` candidate reconciled
- [x] Exactly one module, release, creating phase, lifecycle owner per unique planned table
- [x] Important consumers listed without ownership transfer
- [x] Classifications visible
- [x] Conceptual/derived non-tables listed
- [x] Zero orphan / duplicate / multi-owner conflicts (unique names; later phases listed as modifiers only)
- [x] Sampling worksheet present for SC-010

## Shared vocabulary

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
| Owner / lifecycle owner | Module authoritative for create/update/transition |
| Consumer | Module that reads via public contract without owning the table |

## Planned module catalog (architecture labels)

Frozen for R1-P00 ownership mapping from research Decision 3. These are architecture labels, not runtime folders created in this phase.

`identity` · `customers` · `providers` · `catalog` · `eligibility` · `bookings` · `orders` · `payments` · `ratings` · `notifications` · `support` · `admin` · `configuration` · `media` · `marketers` · `geo`

Shared technical areas (`core`, `integrations`, `shared`) MUST NOT own business lifecycle tables.

## Standalone boundary validation

Cleanora remains a standalone greenfield product. This ownership map depends only on repository-local roadmap and product docs. Validate against [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md). Do **not** create `docs/architecture/standalone-project-boundary.md`.

## Open-question containment (OQ-001–OQ-014)

| ID | Blocks R1-P00? | Affected entities | Resolution owner | Temporary boundary |
|---|---|---|---|---|
| OQ-001 | No | Booking, cancellation, deposit, refund | R1-P16 | Cancellable states + audit; no fee matrix |
| OQ-002 | No | Service requirements, snapshots | R1-P08 | Configurable notes; no universal materials rule |
| OQ-003 | No | Recurring/package | Unassigned | Excluded from three-release inventory |
| OQ-004 | No | Order, payment, adjustment | Unassigned | No automatic post-start price increase |
| OQ-005 | No | Reviews/ratings | R1-P22 | Basic rating + written review only |
| OQ-006 | No | Order communication | Unassigned | No free-form in-order chat |
| OQ-007 | No | Provider documents | R1-P06 | Configurable types; no frozen production checklist |
| OQ-008 | No | Coupons/stacking | Unassigned | Coupons excluded |
| OQ-009 | No | Payment methods | R1-P15 | Provider-neutral methods; no InstaPay invention |
| OQ-010 | No | Booking/order enums, emergency | **R1-P13** | Provisional conceptual labels only until transition matrix |
| OQ-011 | No | Payout schedules/rails | R1-P21 | Configurable; no production values |
| OQ-012 | No | Review moderation | R1-P22 / R1-P25 | No unapproved destructive review behavior |
| OQ-013 | No | Premium plans | R2-P06 | Configurable; no production price/limits |
| OQ-014 | No | Google sign-in audiences | R1-P02 | Linking supported; audiences gated |

Unassigned exclusions (must remain excluded until roadmap assignment): **OQ-003, OQ-004, OQ-006, OQ-008**.

## Inventory method

1. Extract every backtick table under each roadmap phase `### Tables`.
2. Deduplicate by table name; first listing = creating phase; later listings = modifiers only.
3. Assign module from the planned catalog; one lifecycle owner = owning module.
4. Mark OQ linkages where provisional.

**Roadmap appearance count**: 198 · **Unique planned tables**: 193 · **Creating-phase conflicts**: 0

## Ownership rows
| Planned table | Module | Release | Creating phase | Lifecycle owner | Later phase modifiers | Classifications | Important consumers | OQ |
|---|---|---|---|---|---|---|---|---|
| `countries` | `configuration` | R1 | R1-P01 | `configuration` | — | authoritative | `bookings` (country/currency on commercial records); `payments` (money scope); `providers`/`catalog`/`customers` (country-scoped rules) |  |
| `currencies` | `configuration` | R1 | R1-P01 | `configuration` | — | authoritative | `bookings` (country/currency on commercial records); `payments` (money scope); `providers`/`catalog`/`customers` (country-scoped rules) |  |
| `country_configs` | `configuration` | R1 | R1-P01 | `configuration` | — | configurable / authoritative | `bookings`, `payments`, `providers`, `notifications`, `eligibility` (read effective configuration by countryCode) |  |
| `app_configs` | `configuration` | R1 | R1-P01 | `configuration` | — | configurable / authoritative | `bookings`, `payments`, `providers`, `notifications`, `eligibility` (read effective configuration by countryCode) |  |
| `audit_logs` | `admin` | R1 | R1-P01 | `admin` | R1-P03 | historical / auditable | None beyond owner |  |
| `users` | `identity` | R1 | R1-P02 | `identity` | — | authoritative | `customers`, `providers`, `bookings`, `orders`, `payments`, `marketers`, `support`, `ratings`, `notifications`, `admin` (identity reference only) |  |
| `user_credentials` | `identity` | R1 | R1-P02 | `identity` | — | authoritative | None beyond owner |  |
| `user_sessions` | `identity` | R1 | R1-P02 | `identity` | — | authoritative | None beyond owner |  |
| `otp_codes` | `identity` | R1 | R1-P02 | `identity` | — | authoritative | None beyond owner |  |
| `password_reset_tokens` | `identity` | R1 | R1-P02 | `identity` | — | authoritative | None beyond owner |  |
| `social_accounts` | `identity` | R1 | R1-P02 | `identity` | — | external integration / technical | None beyond owner | OQ-014 |
| `auth_events` | `identity` | R1 | R1-P02 | `identity` | — | historical / auditable | None beyond owner |  |
| `roles` | `identity` | R1 | R1-P03 | `identity` | — | authoritative | `admin` (staff authorization); `providers` (scoped supervisor/provider-admin checks via grants) |  |
| `permissions` | `identity` | R1 | R1-P03 | `identity` | — | authoritative | `admin` (staff authorization); `providers` (scoped supervisor/provider-admin checks via grants) |  |
| `role_permissions` | `identity` | R1 | R1-P03 | `identity` | — | authoritative | `admin` (staff authorization); `providers` (scoped supervisor/provider-admin checks via grants) |  |
| `user_roles` | `identity` | R1 | R1-P03 | `identity` | — | authoritative | `admin` (staff authorization); `providers` (scoped supervisor/provider-admin checks via grants) |  |
| `privileged_action_reasons` | `identity` | R1 | R1-P03 | `identity` | — | configurable / authoritative | `admin` (privileged override reason codes) |  |
| `customer_profiles` | `customers` | R1 | R1-P04 | `customers` | — | authoritative | `bookings` (commercial party); `support` (ticket context); `payments` (payer context) |  |
| `company_profiles` | `customers` | R1 | R1-P04 | `customers` | — | authoritative | `bookings` (commercial party); `support` (ticket context); `payments` (payer context) |  |
| `engineer_profiles` | `customers` | R1 | R1-P04 | `customers` | — | authoritative | `bookings` (commercial party); `support` (ticket context); `payments` (payer context) |  |
| `user_addresses` | `customers` | R1 | R1-P04 | `customers` | — | authoritative | `bookings` (address snapshot source); `geo` (R3 geo extension attachment) |  |
| `user_preferences` | `customers` | R1 | R1-P04 | `customers` | — | configurable / authoritative | `bookings` (crew/service preferences); `eligibility` (matching inputs) |  |
| `account_deletion_requests` | `customers` | R1 | R1-P04 | `customers` | — | authoritative | `identity` (auth lifecycle coordination); `admin` (review) |  |
| `media_files` | `media` | R1 | R1-P04 | `media` | R1-P05, R1-P06, R1-P08 | external integration / technical | `providers`, `catalog`, `bookings`, `orders`, `customers`, `support` (attachment authorization/lifecycle meaning; storage owned by `media`) |  |
| `providers` | `providers` | R1 | R1-P05 | `providers` | — | authoritative | `bookings` (commercial counterparty); `eligibility` (supply matching); `payments` (dues/payouts linkage); `ratings` (ratee); `admin` (ops) |  |
| `provider_profiles` | `providers` | R1 | R1-P05 | `providers` | — | authoritative | `bookings` (browse/provider detail display) |  |
| `provider_contacts` | `providers` | R1 | R1-P05 | `providers` | — | authoritative | `bookings` (browse/provider detail display) |  |
| `provider_members` | `providers` | R1 | R1-P05 | `providers` | R1-P07 | authoritative | `admin` (membership oversight) |  |
| `provider_gallery_items` | `providers` | R1 | R1-P05 | `providers` | — | authoritative | `bookings` (browse/provider detail display) |  |
| `provider_status_history` | `providers` | R1 | R1-P05 | `providers` | — | historical / auditable | `eligibility` (active-state inputs); `admin` (audit review) |  |
| `verification_document_types` | `providers` | R1 | R1-P06 | `providers` | — | configurable / authoritative | `admin` (verification ops) | OQ-007 |
| `provider_documents` | `providers` | R1 | R1-P06 | `providers` | — | authoritative | `admin` (verification ops) |  |
| `provider_document_reviews` | `providers` | R1 | R1-P06 | `providers` | — | authoritative | `admin` (verification ops) | OQ-007 |
| `provider_verification_history` | `providers` | R1 | R1-P06 | `providers` | — | historical / auditable | `admin` (verification ops) |  |
| `payout_method_types` | `providers` | R1 | R1-P06 | `providers` | — | configurable / authoritative | `payments` (allowed external rail types for payout execution) | OQ-011 |
| `provider_payout_destinations` | `providers` | R1 | R1-P06 | `providers` | — | external destination (not due/settlement/payout) | `payments` (read external destination for payout execution only; does not own destination lifecycle) | OQ-011 |
| `workers` | `providers` | R1 | R1-P07 | `providers` | — | authoritative | `bookings` (assignment eligibility); `orders` (fulfillment crew context) |  |
| `worker_profiles` | `providers` | R1 | R1-P07 | `providers` | — | authoritative | `bookings` (assignment eligibility); `orders` (fulfillment crew context) |  |
| `worker_skills` | `providers` | R1 | R1-P07 | `providers` | — | authoritative | `bookings` (assignment eligibility); `orders` (fulfillment crew context) |  |
| `provider_teams` | `providers` | R1 | R1-P07 | `providers` | — | authoritative | `bookings` (assignment composition source); `orders` (fulfillment context) |  |
| `provider_team_members` | `providers` | R1 | R1-P07 | `providers` | — | authoritative | `bookings` (assignment composition source); `orders` (fulfillment context) |  |
| `worker_status_history` | `providers` | R1 | R1-P07 | `providers` | — | historical / auditable | `bookings` (assignment eligibility); `orders` (fulfillment crew context) |  |
| `service_categories` | `catalog` | R1 | R1-P08 | `catalog` | — | authoritative | `providers` (offerings against catalog); `bookings` (service selection/snapshots); `eligibility` (service filters) |  |
| `services` | `catalog` | R1 | R1-P08 | `catalog` | — | authoritative | `providers` (offerings against catalog); `bookings` (service selection/snapshots); `eligibility` (service filters) |  |
| `service_translations` | `catalog` | R1 | R1-P08 | `catalog` | — | authoritative | `providers` (offerings against catalog); `bookings` (service selection/snapshots); `eligibility` (service filters) |  |
| `service_price_units` | `catalog` | R1 | R1-P08 | `catalog` | — | authoritative | `providers` (offerings against catalog); `bookings` (service selection/snapshots); `eligibility` (service filters) |  |
| `service_fields` | `catalog` | R1 | R1-P08 | `catalog` | — | authoritative | `providers` (offerings against catalog); `bookings` (service selection/snapshots); `eligibility` (service filters) | OQ-002 |
| `service_field_options` | `catalog` | R1 | R1-P08 | `catalog` | — | configurable / authoritative | `providers` (offerings against catalog); `bookings` (service selection/snapshots); `eligibility` (service filters) | OQ-002 |
| `service_country_availability` | `catalog` | R1 | R1-P08 | `catalog` | — | authoritative | `providers` (offerings against catalog); `bookings` (service selection/snapshots); `eligibility` (service filters) |  |
| `service_media_associations` | `catalog` | R1 | R1-P08 | `catalog` | — | authoritative | `media` (file lifecycle only); `bookings` (presentation snapshot consumers) |  |
| `catalog_command_requests` | `catalog` | R1 | R1-P08 | `catalog` | — | technical / authoritative | `admin` (audit correlation via request IDs only) |  |
| `provider_services` | `providers` | R1 | R1-P09 | `providers` | — | authoritative | `bookings` (pricing/offering selection); `eligibility` (service availability) |  |
| `provider_service_prices` | `providers` | R1 | R1-P09 | `providers` | — | authoritative | `bookings` (pricing/offering selection); `eligibility` (service availability) |  |
| `provider_service_price_history` | `providers` | R1 | R1-P09 | `providers` | — | historical / auditable | `admin` (history review) |  |
| `provider_service_status_history` | `providers` | R1 | R1-P09 | `providers` | — | historical / auditable | `admin` (history review) |  |
| `cities` | `configuration` | R1 | R1-P10 | `configuration` | — | authoritative | `providers` (textual coverage); `bookings` (address locality); `eligibility` (coverage matching) |  |
| `districts` | `configuration` | R1 | R1-P10 | `configuration` | — | authoritative | `providers` (textual coverage); `bookings` (address locality); `eligibility` (coverage matching) |  |
| `provider_coverage_areas` | `providers` | R1 | R1-P10 | `providers` | — | authoritative | `eligibility` (match inputs); `bookings` (schedule feasibility) |  |
| `provider_schedules` | `providers` | R1 | R1-P10 | `providers` | — | authoritative | `eligibility` (match inputs); `bookings` (schedule feasibility) |  |
| `provider_schedule_exceptions` | `providers` | R1 | R1-P10 | `providers` | — | authoritative | `eligibility` (match inputs); `bookings` (schedule feasibility) |  |
| `worker_schedules` | `providers` | R1 | R1-P10 | `providers` | — | authoritative | `eligibility` (match inputs); `bookings` (schedule feasibility) |  |
| `worker_schedule_exceptions` | `providers` | R1 | R1-P10 | `providers` | — | authoritative | `eligibility` (match inputs); `bookings` (schedule feasibility) |  |
| `provider_capacity_rules` | `providers` | R1 | R1-P10 | `providers` | — | configurable / authoritative | `eligibility` (match inputs); `bookings` (schedule feasibility) |  |
| `eligibility_rule_versions` | `eligibility` | R1 | R1-P11 | `eligibility` | — | configurable / authoritative | `bookings` (Browse/Recommended candidate lists) |  |
| `eligibility_evaluations` | `eligibility` | R1 | R1-P11 | `eligibility` | — | historical / auditable | `bookings` (Browse/Recommended candidate lists) |  |
| `eligibility_candidate_results` | `eligibility` | R1 | R1-P11 | `eligibility` | — | historical / auditable | `bookings` (Browse/Recommended candidate lists) |  |
| `provider_view_events` | `bookings` | R1 | R1-P12 | `bookings` | — | historical / auditable | `admin` (marketplace analytics read) |  |
| `search_events` | `bookings` | R1 | R1-P12 | `bookings` | — | historical / auditable | `admin` (marketplace analytics read) |  |
| `bookings` | `bookings` | R1 | R1-P13 | `bookings` | — | authoritative | `orders` (activation/fulfillment); `payments` (deposit/totals) | OQ-010->R1-P13 |
| `booking_items` | `bookings` | R1 | R1-P13 | `bookings` | — | authoritative | `orders` (activation/fulfillment); `payments` (deposit/totals) | OQ-010->R1-P13 |
| `booking_answers` | `bookings` | R1 | R1-P13 | `bookings` | — | authoritative | `orders` (activation/fulfillment); `payments` (deposit/totals) | OQ-010->R1-P13 |
| `booking_addresses` | `bookings` | R1 | R1-P13 | `bookings` | — | authoritative | `orders` (activation/fulfillment); `payments` (deposit/totals) | OQ-010->R1-P13 |
| `booking_media` | `bookings` | R1 | R1-P13 | `bookings` | — | authoritative | `orders` (activation/fulfillment); `payments` (deposit/totals) | OQ-010->R1-P13 |
| `booking_snapshots` | `bookings` | R1 | R1-P13 | `bookings` | — | historical / auditable | `orders` (activation/fulfillment); `payments` (deposit/totals) | OQ-010->R1-P13 |
| `booking_price_breakdowns` | `bookings` | R1 | R1-P13 | `bookings` | — | authoritative | `orders` (activation/fulfillment); `payments` (deposit/totals) | OQ-010->R1-P13 |
| `booking_status_history` | `bookings` | R1 | R1-P13 | `bookings` | — | historical / auditable | `orders` (transition coordination); `admin` (override/audit) | OQ-010->R1-P13 |
| `status_transition_rules` | `bookings` | R1 | R1-P13 | `bookings` | — | configurable / authoritative | `orders` (transition coordination); `admin` (override/audit) | OQ-010->R1-P13 |
| `ledger_accounts` | `payments` | R1 | R1-P14 | `payments` | — | immutable financial / external ref as applicable | `admin` (finance control); `marketers` (commission from platform share context, not wallet) |  |
| `ledger_entries` | `payments` | R1 | R1-P14 | `payments` | — | immutable financial / external ref as applicable | `admin` (finance control); `marketers` (commission from platform share context, not wallet) |  |
| `ledger_entry_links` | `payments` | R1 | R1-P14 | `payments` | — | immutable financial / external ref as applicable | `admin` (finance control); `marketers` (commission from platform share context, not wallet) |  |
| `financial_idempotency_keys` | `payments` | R1 | R1-P14 | `payments` | — | immutable financial / external ref as applicable | `admin` (finance control / replay investigation); not a commission input |  |
| `financial_snapshots` | `payments` | R1 | R1-P14 | `payments` | — | immutable financial / external ref as applicable | `admin` (finance control); `marketers` (commission from platform share context, not wallet) |  |
| `financial_adjustments` | `payments` | R1 | R1-P14 | `payments` | — | immutable financial / external ref as applicable | `admin` (finance control); `marketers` (commission from platform share context, not wallet) |  |
| `payment_methods` | `payments` | R1 | R1-P15 | `payments` | — | authoritative / external integration | `bookings` (deposit method selection); `orders` (remaining payment method selection); `admin` (method configuration review) | OQ-009 |
| `payment_attempts` | `payments` | R1 | R1-P15 | `payments` | — | immutable financial / external ref as applicable | `bookings` (deposit state); `orders` (remaining balance context); `admin` (reconciliation) |  |
| `payments` | `payments` | R1 | R1-P15 | `payments` | — | immutable financial / external ref as applicable | `bookings` (deposit state); `orders` (remaining balance context); `admin` (reconciliation) |  |
| `payment_gateway_events` | `payments` | R1 | R1-P15 | `payments` | — | external integration / technical | `bookings` (deposit state); `orders` (remaining balance context); `admin` (reconciliation) | OQ-009 |
| `payment_receipts` | `payments` | R1 | R1-P15 | `payments` | — | immutable financial / external ref as applicable | `bookings` (deposit state); `orders` (remaining balance context); `admin` (reconciliation) |  |
| `refund_requests` | `payments` | R1 | R1-P15 | `payments` | — | immutable financial / external ref as applicable | `bookings` (deposit state); `orders` (remaining balance context); `admin` (reconciliation) |  |
| `booking_responses` | `bookings` | R1 | R1-P16 | `bookings` | — | authoritative | `payments` (deposit/refund events without inventing fees); `orders` (fulfillment impact); `notifications` (status notices) | OQ-010->R1-P13 |
| `booking_cancellations` | `bookings` | R1 | R1-P16 | `bookings` | — | authoritative | `payments` (deposit/refund events without inventing fees); `orders` (fulfillment impact); `notifications` (status notices) | OQ-001 |
| `cancellation_reasons` | `bookings` | R1 | R1-P16 | `bookings` | — | configurable / authoritative | `payments` (deposit/refund events without inventing fees); `orders` (fulfillment impact); `notifications` (status notices) | OQ-001 |
| `booking_assignments` | `bookings` | R1 | R1-P17 | `bookings` | — | authoritative | `orders` (crew committed to fulfillment) | OQ-010->R1-P13 |
| `booking_assignment_members` | `bookings` | R1 | R1-P17 | `bookings` | — | authoritative | `orders` (crew committed to fulfillment) | OQ-010->R1-P13 |
| `booking_assignment_history` | `bookings` | R1 | R1-P17 | `bookings` | — | historical / auditable | `orders` (crew committed to fulfillment) | OQ-010->R1-P13 |
| `orders` | `orders` | R1 | R1-P18 | `orders` | — | authoritative | `payments` (remaining/COD); `ratings` (completed-order reviews); `support` (ticket linkage); `notifications` (status notices); `admin` |  |
| `order_status_history` | `orders` | R1 | R1-P18 | `orders` | — | historical / auditable | `payments` (remaining/COD); `ratings` (completed-order reviews); `support` (ticket linkage); `notifications` (status notices); `admin` | OQ-010->R1-P13 |
| `completion_codes` | `orders` | R1 | R1-P18 | `orders` | — | authoritative | `payments` (remaining/COD); `ratings` (completed-order reviews); `support` (ticket linkage); `notifications` (status notices); `admin` |  |
| `completion_code_attempts` | `orders` | R1 | R1-P18 | `orders` | — | historical / auditable | `payments` (remaining/COD); `ratings` (completed-order reviews); `support` (ticket linkage); `notifications` (status notices); `admin` |  |
| `order_media` | `orders` | R1 | R1-P18 | `orders` | — | authoritative | `payments` (remaining/COD); `ratings` (completed-order reviews); `support` (ticket linkage); `notifications` (status notices); `admin` |  |
| `order_notes` | `orders` | R1 | R1-P18 | `orders` | — | authoritative | `payments` (remaining/COD); `ratings` (completed-order reviews); `support` (ticket linkage); `notifications` (status notices); `admin` |  |
| `order_events` | `orders` | R1 | R1-P18 | `orders` | — | historical / auditable | `payments` (remaining/COD); `ratings` (completed-order reviews); `support` (ticket linkage); `notifications` (status notices); `admin` |  |
| `emergency_incidents` | `orders` | R1 | R1-P19 | `orders` | — | authoritative | `support` (dossier linkage); `admin` (ops); `notifications` (alerts) | OQ-010->R1-P13 |
| `emergency_status_history` | `orders` | R1 | R1-P19 | `orders` | — | historical / auditable | `support` (dossier linkage); `admin` (ops); `notifications` (alerts) | OQ-010->R1-P13 |
| `emergency_actions` | `orders` | R1 | R1-P19 | `orders` | — | historical / auditable | `support` (dossier linkage); `admin` (ops); `notifications` (alerts) | OQ-010->R1-P13 |
| `remaining_payment_choices` | `payments` | R1 | R1-P20 | `payments` | — | immutable financial / external ref as applicable | `orders` (fulfillment payment state); `bookings` (commercial closure) |  |
| `cod_cash_confirmations` | `payments` | R1 | R1-P20 | `payments` | — | immutable financial / external ref as applicable | `orders` (fulfillment payment state); `bookings` (commercial closure) |  |
| `remaining_payment_attempts` | `payments` | R1 | R1-P20 | `payments` | — | immutable financial / external ref as applicable | `orders` (fulfillment payment state); `bookings` (commercial closure) |  |
| `remaining_payments` | `payments` | R1 | R1-P20 | `payments` | — | immutable financial / external ref as applicable | `orders` (fulfillment payment state); `bookings` (commercial closure) |  |
| `provider_dues` | `payments` | R1 | R1-P21 | `payments` | — | immutable financial / external ref as applicable | `providers` (read obligation status); `admin` (finance ops) |  |
| `provider_settlements` | `payments` | R1 | R1-P21 | `payments` | — | immutable financial / external ref as applicable | `providers` (read obligation status); `admin` (finance ops) |  |
| `provider_settlement_items` | `payments` | R1 | R1-P21 | `payments` | — | immutable financial / external ref as applicable | `providers` (read obligation status); `admin` (finance ops) |  |
| `provider_payouts` | `payments` | R1 | R1-P21 | `payments` | — | immutable financial / external ref as applicable | `providers` (read payout results); `admin` (ops) | OQ-011 |
| `provider_payout_attempts` | `payments` | R1 | R1-P21 | `payments` | — | immutable financial / external ref as applicable | `providers` (read payout results); `admin` (ops) | OQ-011 |
| `provider_payout_documents` | `payments` | R1 | R1-P21 | `payments` | — | immutable financial / external ref as applicable | `providers` (read payout results); `admin` (ops) | OQ-011 |
| `reviews` | `ratings` | R1 | R1-P22 | `ratings` | — | authoritative | `bookings` (provider detail display); `admin` (moderation) | OQ-005/012 |
| `review_targets` | `ratings` | R1 | R1-P22 | `ratings` | — | authoritative | `bookings` (provider detail display); `admin` (moderation) | OQ-005/012 |
| `review_ratings` | `ratings` | R1 | R1-P22 | `ratings` | — | authoritative | `bookings` (provider detail display); `admin` (moderation) | OQ-005/012 |
| `rating_summaries` | `ratings` | R1 | R1-P22 | `ratings` | — | authoritative | `bookings` (provider detail display); `admin` (moderation) |  |
| `review_reports` | `ratings` | R1 | R1-P22 | `ratings` | — | authoritative | `admin` (moderation handling) | OQ-005/012 |
| `notification_templates` | `notifications` | R1 | R1-P23 | `notifications` | — | configurable / authoritative | `admin` (template administration) |  |
| `notification_template_translations` | `notifications` | R1 | R1-P23 | `notifications` | — | configurable / authoritative | `admin` (template administration) |  |
| `notifications` | `notifications` | R1 | R1-P23 | `notifications` | — | authoritative | None beyond owner |  |
| `notification_deliveries` | `notifications` | R1 | R1-P23 | `notifications` | — | authoritative | None beyond owner |  |
| `notification_preferences` | `notifications` | R1 | R1-P23 | `notifications` | — | configurable / authoritative | `admin` (template administration) |  |
| `support_tickets` | `support` | R1 | R1-P24 | `support` | — | authoritative | `admin` (staff handling); `orders`/`payments` (linked case context via contracts) |  |
| `support_ticket_messages` | `support` | R1 | R1-P24 | `support` | — | authoritative | `admin` (staff handling); `orders`/`payments` (linked case context via contracts) |  |
| `support_ticket_attachments` | `support` | R1 | R1-P24 | `support` | — | authoritative | `admin` (staff handling); `orders`/`payments` (linked case context via contracts) |  |
| `support_ticket_assignments` | `support` | R1 | R1-P24 | `support` | — | authoritative | `admin` (staff handling); `orders`/`payments` (linked case context via contracts) |  |
| `support_status_history` | `support` | R1 | R1-P24 | `support` | — | historical / auditable | `admin` (staff handling); `orders`/`payments` (linked case context via contracts) |  |
| `support_internal_notes` | `support` | R1 | R1-P24 | `support` | — | authoritative | `admin` (staff handling); `orders`/`payments` (linked case context via contracts) |  |
| `admin_actions` | `admin` | R1 | R1-P25 | `admin` | — | historical / auditable | None beyond owner |  |
| `admin_exports` | `admin` | R1 | R1-P25 | `admin` | — | historical / auditable | None beyond owner |  |
| `system_incidents` | `admin` | R1 | R1-P25 | `admin` | — | authoritative | None beyond owner |  |
| `marketers` | `marketers` | R2 | R2-P01 | `marketers` | — | authoritative | `admin` (growth ops); `payments` (activation payment linkage without wallet) |  |
| `marketer_profiles` | `marketers` | R2 | R2-P01 | `marketers` | — | authoritative | `admin` (growth ops); `payments` (activation payment linkage without wallet) |  |
| `marketer_status_history` | `marketers` | R2 | R2-P01 | `marketers` | — | historical / auditable | `admin` (growth ops); `payments` (activation payment linkage without wallet) |  |
| `marketer_terms_acceptances` | `marketers` | R2 | R2-P01 | `marketers` | — | authoritative | `admin` (growth ops); `payments` (activation payment linkage without wallet) |  |
| `marketer_payout_destinations` | `marketers` | R2 | R2-P01 | `marketers` | — | external destination (not due/settlement/payout; not a wallet) | `admin` (ops read for payout execution references); not a stored-value wallet | OQ-011 |
| `marketer_keys` | `marketers` | R2 | R2-P02 | `marketers` | — | authoritative | `customers` (attribution at signup/booking); `admin` (fraud/ops) |  |
| `referral_links` | `marketers` | R2 | R2-P02 | `marketers` | — | authoritative | `customers` (attribution at signup/booking); `admin` (fraud/ops) |  |
| `referral_visits` | `marketers` | R2 | R2-P02 | `marketers` | — | authoritative | `customers` (attribution at signup/booking); `admin` (fraud/ops) |  |
| `referral_attributions` | `marketers` | R2 | R2-P02 | `marketers` | — | authoritative | `customers` (attribution at signup/booking); `admin` (fraud/ops) |  |
| `referral_attribution_history` | `marketers` | R2 | R2-P02 | `marketers` | — | historical / auditable | `customers` (attribution at signup/booking); `admin` (fraud/ops) |  |
| `commission_rules` | `marketers` | R2 | R2-P03 | `marketers` | — | configurable / authoritative | `payments` (platform-share funding context); `admin` (finance review) |  |
| `commission_rule_versions` | `marketers` | R2 | R2-P03 | `marketers` | — | configurable / authoritative | `payments` (platform-share funding context); `admin` (finance review) |  |
| `marketer_commissions` | `marketers` | R2 | R2-P03 | `marketers` | — | immutable financial (dues/obligation; not a payout destination) | `payments` (platform-share funding context); `admin` (finance review) |  |
| `commission_adjustments` | `marketers` | R2 | R2-P03 | `marketers` | — | immutable financial / external ref as applicable | `payments` (platform-share funding context); `admin` (finance review) |  |
| `commission_status_history` | `marketers` | R2 | R2-P03 | `marketers` | — | immutable financial / external ref as applicable | `payments` (platform-share funding context); `admin` (finance review) |  |
| `marketer_report_exports` | `marketers` | R2 | R2-P04 | `marketers` | — | historical / auditable | None beyond owner |  |
| `marketer_settlements` | `marketers` | R2 | R2-P05 | `marketers` | — | immutable financial (settlement; not a payout destination) | `admin` (finance ops) |  |
| `marketer_settlement_items` | `marketers` | R2 | R2-P05 | `marketers` | — | immutable financial (settlement line; not a payout destination) | `admin` (finance ops) |  |
| `marketer_payouts` | `marketers` | R2 | R2-P05 | `marketers` | — | immutable financial (execution/history; not a destination; not a wallet) | `admin` (ops); execution/history distinct from destinations | OQ-011 |
| `marketer_payout_attempts` | `marketers` | R2 | R2-P05 | `marketers` | — | immutable financial (execution attempt; not a destination; not a wallet) | `admin` (ops); execution/history distinct from destinations | OQ-011 |
| `marketer_payout_documents` | `marketers` | R2 | R2-P05 | `marketers` | — | immutable financial / external ref (execution artifact; not a destination; not a wallet) | `admin` (ops); execution/history distinct from destinations | OQ-011 |
| `premium_plans` | `marketers` | R2 | R2-P06 | `marketers` | — | configurable / authoritative | `eligibility`/`bookings` (ranking inputs cannot bypass eligibility); `providers` (enrollment status); `payments` (premium payment records) | OQ-013 |
| `provider_premium_subscriptions` | `marketers` | R2 | R2-P06 | `marketers` | — | authoritative | `eligibility`/`bookings` (ranking inputs cannot bypass eligibility); `providers` (enrollment status); `payments` (premium payment records) | OQ-013 |
| `premium_payments` | `marketers` | R2 | R2-P06 | `marketers` | — | immutable financial / external ref as applicable | `eligibility`/`bookings` (ranking inputs cannot bypass eligibility); `providers` (enrollment status); `payments` (premium payment records) | OQ-013 |
| `premium_status_history` | `marketers` | R2 | R2-P06 | `marketers` | — | historical / auditable | `eligibility`/`bookings` (ranking inputs cannot bypass eligibility); `providers` (enrollment status); `payments` (premium payment records) | OQ-013 |
| `premium_benefits` | `marketers` | R2 | R2-P06 | `marketers` | — | authoritative | `eligibility`/`bookings` (ranking inputs cannot bypass eligibility); `providers` (enrollment status); `payments` (premium payment records) | OQ-013 |
| `referral_risk_flags` | `marketers` | R2 | R2-P07 | `marketers` | — | authoritative | `admin` (growth fraud ops) |  |
| `growth_admin_actions` | `marketers` | R2 | R2-P07 | `marketers` | — | historical / auditable | `admin` (growth fraud ops) |  |
| `geo_addresses` | `geo` | R3 | R3-P01 | `geo` | — | authoritative | `customers` (address extension); `bookings` (job location); `eligibility` (geo matching) |  |
| `geo_points` | `geo` | R3 | R3-P01 | `geo` | — | external integration / technical | `customers` (address extension); `bookings` (job location); `eligibility` (geo matching) |  |
| `geocoding_cache` | `geo` | R3 | R3-P01 | `geo` | — | external integration / technical | `customers` (address extension); `bookings` (job location); `eligibility` (geo matching) |  |
| `service_zones` | `geo` | R3 | R3-P02 | `geo` | — | authoritative | `eligibility` (distance/radius inputs); `providers` (coverage maintenance) |  |
| `service_zone_boundaries` | `geo` | R3 | R3-P02 | `geo` | — | authoritative | `eligibility` (distance/radius inputs); `providers` (coverage maintenance) |  |
| `provider_geo_coverage` | `geo` | R3 | R3-P02 | `geo` | — | authoritative | `eligibility` (distance/radius inputs); `providers` (coverage maintenance) |  |
| `distance_calculation_cache` | `geo` | R3 | R3-P02 | `geo` | — | external integration / technical | `eligibility` (distance/radius inputs); `providers` (coverage maintenance) |  |
| `eligibility_geo_results` | `eligibility` | R3 | R3-P03 | `eligibility` | — | historical / auditable | `bookings` (R3 ranking/distribution inputs) |  |
| `provider_performance_metrics` | `eligibility` | R3 | R3-P03 | `eligibility` | — | authoritative | `bookings` (R3 ranking/distribution inputs) |  |
| `realtime_audit_events` | `geo` | R3 | R3-P04 | `geo` | — | external integration / technical | `admin` (realtime ops audit) |  |
| `recommended_requests` | `geo` | R3 | R3-P05 | `geo` | — | authoritative | `bookings` (conversion into confirmed booking path) |  |
| `recommended_request_candidates` | `geo` | R3 | R3-P05 | `geo` | — | authoritative | `bookings` (conversion into confirmed booking path) |  |
| `recommended_request_deliveries` | `geo` | R3 | R3-P05 | `geo` | — | authoritative | `bookings` (conversion into confirmed booking path) |  |
| `recommended_request_status_history` | `geo` | R3 | R3-P05 | `geo` | — | historical / auditable | `bookings` (conversion into confirmed booking path) |  |
| `provider_offers` | `geo` | R3 | R3-P06 | `geo` | — | authoritative | `bookings` (offer acceptance to shared booking/order path) |  |
| `provider_offer_versions` | `geo` | R3 | R3-P06 | `geo` | — | authoritative | `bookings` (offer acceptance to shared booking/order path) |  |
| `provider_offer_status_history` | `geo` | R3 | R3-P06 | `geo` | — | historical / auditable | `bookings` (offer acceptance to shared booking/order path) |  |
| `offer_selection_attempts` | `geo` | R3 | R3-P06 | `geo` | — | historical / auditable | `bookings` (offer acceptance to shared booking/order path) |  |
| `dynamic_pricing_rules` | `geo` | R3 | R3-P07 | `geo` | — | configurable / authoritative | `bookings` (negotiated commercial totals); `payments` (deposit basis) |  |
| `dynamic_pricing_rule_versions` | `geo` | R3 | R3-P07 | `geo` | — | configurable / authoritative | `bookings` (negotiated commercial totals); `payments` (deposit basis) |  |
| `request_price_ranges` | `geo` | R3 | R3-P07 | `geo` | — | authoritative | `bookings` (negotiated commercial totals); `payments` (deposit basis) |  |
| `price_proposals` | `geo` | R3 | R3-P07 | `geo` | — | authoritative | `bookings` (negotiated commercial totals); `payments` (deposit basis) |  |
| `negotiated_prices` | `geo` | R3 | R3-P07 | `geo` | — | authoritative | `bookings` (negotiated commercial totals); `payments` (deposit basis) |  |
| `pricing_decision_logs` | `geo` | R3 | R3-P07 | `geo` | — | historical / auditable | `bookings` (negotiated commercial totals); `payments` (deposit basis) |  |
| `ranking_rules` | `geo` | R3 | R3-P08 | `geo` | — | configurable / authoritative | `bookings` (offer ordering); must not bypass `eligibility` |  |
| `ranking_rule_versions` | `geo` | R3 | R3-P08 | `geo` | — | configurable / authoritative | `bookings` (offer ordering); must not bypass `eligibility` |  |
| `offer_ranking_results` | `geo` | R3 | R3-P08 | `geo` | — | historical / auditable | `bookings` (offer ordering); must not bypass `eligibility` |  |
| `tracking_sessions` | `geo` | R3 | R3-P09 | `geo` | — | authoritative | `orders` (live fulfillment context); `admin` (ops map) |  |
| `tracking_points` | `geo` | R3 | R3-P09 | `geo` | — | authoritative | `orders` (live fulfillment context); `admin` (ops map) |  |
| `tracking_status_history` | `geo` | R3 | R3-P09 | `geo` | — | historical / auditable | `orders` (live fulfillment context); `admin` (ops map) |  |
| `location_permission_events` | `geo` | R3 | R3-P09 | `geo` | — | historical / auditable | `orders` (live fulfillment context); `admin` (ops map) |  |
| `emergency_location_consents` | `geo` | R3 | R3-P10 | `geo` | — | authoritative | `orders` (emergency live updates); `admin` | OQ-010->R1-P13 |
| `admin_map_preferences` | `geo` | R3 | R3-P11 | `geo` | — | configurable / authoritative | None beyond owner |  |

## Conceptual / derived non-persisted concepts

| Concept | Why not a table in R1-P00 inventory | Owning concern |
|---|---|---|
| Eligibility V1/V2 effective result (ephemeral) | May be computed per request; persisted evaluation tables exist when needed | `eligibility` |
| Browse/Recommended shared domain (conceptual) | Domain boundary, not a table | `eligibility` / `bookings` |
| Effective configuration merge | Derived from global + country configs | `configuration` |
| Ledger balance | Derived from immutable entries | `payments` |
| Provider team live membership vs assignment evidence | Membership mutable; assignment is order/booking history | `providers` vs `bookings`/`orders` |
| Emergency final representation | Provisional under OQ-010 → R1-P13 | `orders` / status machine |
| Ban / suspension | Roadmap defines no dedicated ban/suspension table. **R1-P02** owns identity enforcement at login and protected endpoints. **R1-P25** is an administrative consumer/control surface (ban/unban, suspend/reinstate). Exact persistence representation is deferred to those owning implementation phases and may use approved user state, history, or audit structures — no fields, enums, tables, or migrations invented here. | `identity` (R1-P02); `admin` consumer/control (R1-P25) |
| Coupon / chat / recurring package entities | Excluded by OQ-003/004/006/008 | N/A |

## Master ERD reconciliation

- Every Master ERD entity family maps to modules above.
- R1-P00 is **never** the creating phase for product tables.
- Cross-module consumers use public contracts only (constitution III).

## Orphan / duplicate / multi-owner scan (FR-038 / SC-005)

| Check | Result |
|---|---|
| Unique planned tables with one creating phase | PASS (193) |
| Duplicate table names with conflicting modules | PASS (none; modifiers only) |
| Orphan roadmap tables without a row | PASS |
| Multi-owned tables | PASS (zero) |
| FR-064 blockers raised | None |

## SC-010 sampling worksheet (≥10 entities across R1/R2/R3)

| # | Entity / table | Module | Phase | Consumers (purpose) | Source |
|---|---|---|---|---|---|
| 1 | `users` | identity | R1-P02 | all modules (identity reference) | vision §4 |
| 2 | `providers` | providers | R1-P05 | bookings, eligibility, payments | vision §5 |
| 3 | `services` | catalog | R1-P08 | providers, bookings, eligibility | vision §6 |
| 4 | `bookings` | bookings | R1-P13 | orders, payments | FR-024 |
| 5 | `orders` | orders | R1-P18 | payments, ratings, support | FR-024 |
| 6 | `ledger_entries` | payments | R1-P14 | settlements, admin | DEC-003 |
| 7 | `provider_payout_destinations` | providers | R1-P06 | payments (payout execution) | FR-028 |
| 8 | `reviews` | ratings | R1-P22 | admin moderation | OQ-005 |
| 9 | `marketers` | marketers | R2-P01 | commissions, settlements | DEC-007 |
| 10 | `geo_addresses` | geo | R3-P01 | customers, bookings, eligibility | DEC-004 |
| 11 | `eligibility_evaluations` | eligibility | R1-P11 | browse, recommended | DEC-005 |
| 12 | `emergency_incidents` | orders | R1-P19 | support, admin | OQ-010 provisional |

## Edge-case ownership notes

See Master ERD edge-case mapping and implementation-summary for the twelve spec edge cases.


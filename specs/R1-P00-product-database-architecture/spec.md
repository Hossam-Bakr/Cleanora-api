# Feature Specification: Product & Database Architecture

**Feature Branch**: `Not created (no before_specify hook configured)`

**Created**: 2026-07-24

**Status**: Historical specification record — R1-P00 was completed on
2026-07-24; this document preserves its approved scope and decisions

**Input**: Freeze Cleanora's global product and database architecture for all three approved releases before any product models or migrations are created.

## Canonical Sources & Phase Boundary *(mandatory)*

**Historical phase snapshot**: During R1-P00 specification preparation,
`R1-P00 — Product & Database Architecture` was the repository's active phase
pointer. R1-P00 is now Complete; `docs/product/current.md` is the canonical live
phase authority.

**Phase Goal and Definition of Done**: `docs/product/roadmap.md`, section `R1-P00 — Product & Database Architecture`. The phase freezes the implementation contract and global data model before product migrations. It is done only when every major entity is present, every planned table has one release and phase owner, internal stored-value wallets are absent, payout destinations are separated from financial dues, open questions are visible, and architecture review approves the clean-slate model.

**Canonical standalone boundary**: `docs/product/standalone-project-boundary.md` is the existing and only standalone-project boundary document. R1-P00 MUST validate and reference it; R1-P00 MUST NOT create a duplicate or competing boundary document.

**Locked Product Rules**:

- `docs/product/vision.md` §1.1 and DEC-012: Cleanora is a standalone greenfield product with no dependency on another repository, schema, migration history, database, dataset, or undocumented service.
- `docs/product/vision.md` §§2–3: Cleanora is a controlled multi-sided marketplace; the backend is authoritative for eligibility, price, payments, state transitions, and financial records; Browse and Recommended share one eligibility domain.
- `docs/product/vision.md` §4: one identity system supports multi-role users, actor-specific verification, staff permissions, and scoped supervisor/provider-administrator capabilities.
- `docs/product/vision.md` §§5–6: providers, workers, teams, catalog services, provider-owned prices, coverage, capacity, localization, and confirmed historical snapshots have distinct lifecycle and ownership concerns.
- `docs/product/vision.md` §§7–8: deposits, payments, provider dues, settlements, payouts, refunds, adjustments, reconciliation, assignments, completion evidence, and emergencies require explicit boundaries, immutable financial history, and auditable state changes.
- `docs/product/vision.md` §§9–14: reviews, notifications, support, marketer growth, premium-provider ranking, and privileged staff control remain part of the three-release global design.
- `docs/product/vision.md` §15: country-sensitive behavior uses `countryCode`; monetary amounts are decimal-safe; sensitive operations are audited; media uses protected external object storage; open product rules are not invented.
- `docs/product/vision.md` §16 and DEC-003: customer, provider, and marketer stored-value wallets are prohibited. External payment and payout rails, payout destinations, dues, settlements, and payout records are allowed.
- DEC-004 and DEC-005: maps, coordinates, radius matching, WebSockets, live offers, and live tracking are Release 3 extensions; Eligibility V2 extends rather than duplicates Eligibility V1.
- DEC-014: design globally, implement locally, and migrate incrementally. R1-P00 creates no product model or migration; applied migrations are immutable and corrections are forward-only.

**Approved Decisions**:

- DEC-001, DEC-002, DEC-006, DEC-008, DEC-009, and DEC-010 define the three-release scope and require an end-to-end Release 1 marketplace, money closure, basic trust, emergency core, and dependency-based staff controls.
- DEC-003 prohibits internal Cleanora user wallets and distinguishes allowed external destinations and financial obligations.
- DEC-004 and DEC-005 defer geo/realtime behavior to Release 3 and preserve one eligibility domain across both eligibility versions.
- DEC-007 assigns marketers, referrals, commissions, marketer settlements, fraud controls, and premium providers to Release 2.
- DEC-011 includes Google sign-in in Release 1 without overriding actor-specific verification rules.
- DEC-012 and DEC-013 establish the standalone boundary and the precedence and traceability of repository-local product sources.
- DEC-014 requires phase-owned incremental schema and migration work after R1-P00 and forbids creating future-release models early.

**Open Questions**:

All current questions are relevant to the global architecture because R1-P00 must prevent later phases from inventing answers. None blocks R1-P00 while its recorded temporary boundary is preserved.

| ID | Blocks R1-P00? | Affected conceptual entities | Resolution owner | Temporary architecture boundary |
|---|---|---|---|---|
| OQ-001 | No | Booking, Order, Cancellation Event, Deposit, Refund, Financial Record | R1-P16, before any fee-bearing cancellation behavior is introduced | Represent cancellation/reschedule capability and audit history, but define no fee calculation or deposit-fate rule. |
| OQ-002 | No | Catalog Service, Service Requirement, Booking/Order Service Snapshot | R1-P08 | Permit configurable service notes and requirements; do not encode a universal materials-supply rule. |
| OQ-003 | No | Potential Recurring Booking and Package concepts | Unassigned future roadmap phase requiring human approval | Exclude recurring/package entities and relationships from the approved three-release table inventory. |
| OQ-004 | No | Order, Payment, Adjustment, Financial Record | Unassigned future roadmap phase requiring human approval | Do not model an automatic post-start price increase workflow; retain only the approved refund/adjustment foundation. |
| OQ-005 | No | Review, Provider Rating, Assigned-Team Rating, Rating Aggregate | R1-P22 | Model only one basic provider/team rating and written review per completed order; leave advanced dimensions and publishing/edit rules open. |
| OQ-006 | No | Order Communication, Notification | Unassigned future roadmap phase requiring human approval | Do not introduce free-form in-order chat; use structured statuses and approved notifications only. |
| OQ-007 | No | Provider Document Type, Provider Document, Verification Review | R1-P06 | Allow configurable document types; do not freeze or seed a required production checklist. |
| OQ-008 | No | Coupon, Referral Attribution, Marketer Commission, Financial Record | Unassigned future roadmap phase requiring human approval | Exclude coupons and stacking relationships from the current three releases. |
| OQ-009 | No | Payment Method, Payment Attempt, External Payment Reference | R1-P15 | Preserve a provider-neutral external payment-method boundary; define no InstaPay-specific workflow. |
| OQ-010 | No | Booking, Order, Status Transition, Emergency | R1-P13 | Use conceptual lifecycle labels only. Do not freeze database enum names or decide whether emergency is a state or parallel concern before the approved transition-matrix decision. |
| OQ-011 | No | Provider Payout Destination, Provider Due, Settlement, Payout | R1-P21 | Keep schedules and supported external rails configurable; define no production values. |
| OQ-012 | No | Review, Review Moderation Action, Audit Record | R1-P22, with later staff controls consumed by R1-P25 | Do not add unapproved destructive deletion, provider-response, or abuse-report behavior. |
| OQ-013 | No | Premium Plan, Premium Benefit, Provider Premium Enrollment | R2-P06 | Make plans and benefits configurable in concept; define no production price, duration, or gallery limits. |
| OQ-014 | No | User, External Identity Link, Role/Profile Verification | R1-P02 | Allow one identity to link approved sign-in methods; do not enable Google sign-in for an account audience until approved. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve the Global Conceptual Model (Priority: P1)

As the architecture reviewer, I need one traceable conceptual model covering all approved releases so I can approve or reject Cleanora's global data direction before any product table is implemented.

**Why this priority**: A missing entity, ambiguous lifecycle, or invented relationship would propagate into every later phase and migration.

**Independent Test**: Review the future `master-erd.md` against the vision, approved decisions, R1-P00 scope, entity coverage in this specification, and the open-question register. The review delivers value even without any other architecture document by exposing missing entities, incorrect cardinalities, release leakage, and prohibited wallet concepts.

**Acceptance Scenarios**:

1. **Given** the approved three-release vision, **When** the reviewer traces each required conceptual entity to the Master ERD, **Then** every entity is present, grouped by its owning business area, and labeled with its owning release and implementation phase.
2. **Given** a relationship between entities, **When** the reviewer inspects it, **Then** its direction, important cardinality, lifecycle boundary, authoritative owner, and cross-module use are understandable without consulting another project.
3. **Given** any customer, provider, worker, or marketer concept, **When** the reviewer searches the model, **Then** no Cleanora-held stored-value wallet or reusable user balance exists.
4. **Given** provider payout and finance concepts, **When** the reviewer follows their relationships, **Then** external payout destinations are separate from provider dues, settlements, payouts, and immutable financial records.

---

### User Story 2 - Assign Every Planned Table to a Future Phase (Priority: P1)

As a future phase planner, I need every planned table to have one module, release, phase, and lifecycle owner so that incremental implementation never relies on guesswork or transfers ownership to a consumer.

**Why this priority**: Cleanora's global-design/local-implementation rule depends on an exhaustive, non-overlapping ownership map.

**Independent Test**: Select any planned table from the approved three-release inventory and locate exactly one ownership row containing every required ownership and classification field.

**Acceptance Scenarios**:

1. **Given** any planned table, **When** its ownership row is reviewed, **Then** exactly one owning business module, owning release, owning roadmap phase, and lifecycle owner are identified.
2. **Given** a table read by multiple modules, **When** cross-module consumers are reviewed, **Then** consumers are listed without being mistaken for owners and access is described through explicit public contracts.
3. **Given** the complete planned-table inventory, **When** it is reconciled with the ownership map, **Then** there are zero missing, orphaned, duplicate, or multi-owned tables.
4. **Given** an entity planned for a later phase, **When** its row is inspected, **Then** R1-P00 is identified only as the architecture-contract phase and not as the phase that creates the product table.

---

### User Story 3 - Apply Consistent Database Conventions (Priority: P2)

As a backend implementer, I need one approved conventions document so that each future phase can make consistent local data decisions without reopening global rules.

**Why this priority**: Consistent naming, identity, relationships, history, finance, indexing, audit, and migration rules prevent incompatible phase-owned migrations.

**Independent Test**: For a representative authoritative entity, historical snapshot, configurable record, auditable operation, and immutable financial record, determine the required convention for every applicable category without inventing a product rule.

**Acceptance Scenarios**:

1. **Given** a future database-changing phase, **When** the implementer consults the conventions, **Then** naming, keys, relationships, timestamps, deletion, statuses, money, country/currency, localization, snapshots, indexes, uniqueness, and audit expectations are explicit.
2. **Given** an applied migration that requires correction, **When** the conventions are followed, **Then** the correction is assigned to a new forward migration and the applied migration remains unchanged.
3. **Given** a module's public contract, **When** it exposes data to another module, **Then** the contract does not leak raw persistence models or persistence-specific types.
4. **Given** seed or backfill work needed by a future phase, **When** responsibility is identified, **Then** the same phase that introduces or changes the data owns its review, evidence, and compatibility impact.

---

### User Story 4 - Review State-Transition Safety Without Inventing Statuses (Priority: P2)

As an architecture reviewer and future order planner, I need a reusable transition design approach so state changes can be authorized, auditable, and failure-safe while OQ-010 remains unresolved.

**Why this priority**: The transition structure is a global integrity concern, but premature enum naming would turn an open product decision into an accidental schema contract.

**Independent Test**: Review sample conceptual transitions for provider lifecycle, booking/order progression, completion, cancellation, privileged override, and emergency handling using the required transition fields while confirming that final booking/order enum names remain open.

**Acceptance Scenarios**:

1. **Given** a proposed state change, **When** it is documented in the status-machine draft, **Then** actor, from state, to state, preconditions, side effects, audit requirement, and failure or rejection outcome are all present.
2. **Given** a privileged forced transition, **When** its design is reviewed, **Then** permission, reason, before/after state, actor, timestamp, and audit expectations are explicit.
3. **Given** OQ-010 remains open, **When** booking/order states and emergency are described, **Then** conceptual labels are visibly provisional and the decision is traced to R1-P13 rather than silently finalized.
4. **Given** a failed precondition or concurrent stale request, **When** the transition design is reviewed, **Then** no side effect is treated as successful and the rejection outcome is observable and auditable where sensitive.

---

### User Story 5 - Contain Open Product Questions (Priority: P2)

As the human product owner, I need every open question visibly classified so I can approve the architecture without having deferred product behavior invented on my behalf.

**Why this priority**: A global model must leave intentional extension points without turning unknown behavior into tables, statuses, or financial rules.

**Independent Test**: Reconcile every ID in `docs/product/open-questions.md` with the classification table and the affected future architecture deliverables.

**Acceptance Scenarios**:

1. **Given** an open product question, **When** its R1-P00 classification is inspected, **Then** blocker status, affected conceptual entities, future resolution owner, and temporary boundary are present.
2. **Given** a deliberately deferred question, **When** architecture review occurs, **Then** the question does not block R1-P00 if its containment rule prevents accidental invention.
3. **Given** a question assigned to no approved roadmap phase, **When** it is reviewed, **Then** it remains explicitly unassigned and excluded until a human-approved roadmap change occurs.

### Edge Cases

- A user accumulates multiple roles over time: identity remains singular, role grants remain explicit, and actor-specific profiles and verification lifecycles are not collapsed into one overloaded record.
- Supervisor and provider-administrator capabilities overlap with worker identity: they remain provider-scoped permissions or flags, not separate authentication systems.
- A provider team changes after an order is assigned: provider team membership remains provider-owned while the order preserves the assignment and composition evidence required for history.
- A catalog service or provider price changes after confirmation: the confirmed booking/order retains the required service, price, unit, currency, and calculation snapshots.
- A concept is computed rather than persisted: the ownership artifact explicitly records it as conceptual/derived and does not invent a table merely to satisfy the table inventory.
- A table is operationally read by several modules: exactly one lifecycle owner remains authoritative and all other modules are named consumers.
- An external rail is called a "mobile wallet": the architecture treats it only as an external payment or payout destination and never as Cleanora-held reusable value.
- A financial error needs correction: the original immutable record remains and the correction is represented by a traceable compensating refund or adjustment.
- Global and country-specific values share a subject: precedence and country scope are explicit, and country-sensitive business behavior never relies on a hard-coded Egypt default.
- Media is attached to different business entities: the technical media facility owns storage metadata and protection mechanics while the relevant business owner retains authorization and lifecycle meaning.
- Release 3 adds distance and real-time inputs: it extends the shared eligibility and marketplace concepts rather than creating a competing eligibility truth.
- An open question changes a later relationship: the affected relationship remains provisional or bounded, and no final table, enum, seed value, or automatic behavior is inferred during R1-P00.

## Requirements *(mandatory)*

### Functional Requirements

#### Architecture contract and traceability

- **FR-001**: R1-P00 MUST produce a repository-local, reviewable architecture contract derived only from `AGENTS.md`, the canonical product documents, the active R1-P00 roadmap section, the constitution, and `docs/product/standalone-project-boundary.md`.
- **FR-002**: The later implementation of this specification MUST create exactly these new canonical architecture deliverables: `docs/architecture/master-erd.md`, `docs/architecture/database-conventions.md`, `docs/architecture/entity-ownership.md`, and `docs/architecture/status-machine-draft.md`.
- **FR-003**: The later implementation MUST validate and reference the existing `docs/product/standalone-project-boundary.md` as canonical and MUST NOT create a conflicting standalone-boundary document.
- **FR-004**: Every architecture rule in the deliverables MUST trace to a locked vision section, approved decision, R1-P00 roadmap obligation, constitutional principle, or explicitly identified implementation-neutral convention.
- **FR-005**: Every unresolved product-dependent statement MUST cite its OQ identifier and containment rule; architecture language MUST NOT imply that the question has been answered.
- **FR-006**: The deliverables MUST use a common vocabulary for conceptual entity, planned table, authoritative record, historical snapshot, immutable financial record, configuration, audit record, external integration reference, owner, lifecycle owner, and consumer.
- **FR-007**: R1-P00 MUST remain documentation-only and MUST introduce no product schema model, migration, seed, backfill, source module, API, route, job, or runtime test.
- **FR-008**: Architecture review MUST have objective evidence that can approve or reject every R1-P00 roadmap Done When condition and every success criterion in this specification.

#### Master conceptual model

- **FR-009**: The Master ERD MUST cover the complete approved three-release conceptual model, including Release 1 core marketplace, Release 2 marketers and growth, and Release 3 smart-marketplace extensions.
- **FR-010**: The Master ERD MUST group every major entity by its owning business module or explicitly identified shared technical infrastructure area.
- **FR-011**: Every entity in the Master ERD MUST be labeled with its owning release and owning implementation phase; R1-P00 MUST NOT be mislabeled as the implementation phase for future product tables.
- **FR-012**: The Master ERD MUST distinguish authoritative records, historical snapshots, configuration, external integration references, immutable financial records, and auditable records through a documented legend.
- **FR-013**: Every important relationship MUST show its direction and cardinality and MUST identify lifecycle boundaries where parent deletion, historical retention, or independent lifecycle makes simple containment misleading.
- **FR-014**: The model MUST cover identity, users, roles, permissions, multi-role grants, authentication links, customer profiles/types, provider ownership/membership, staff permissions, and privileged audit records without creating separate identity stacks for each actor.
- **FR-015**: The model MUST cover providers, provider owners, workers, teams, team membership, supervisors, provider administrators, provider verification, document types/documents, services, prices, coverage, availability, capacity, payout destinations, and lifecycle controls.
- **FR-016**: The model MUST cover catalog categories, catalog services, Arabic/English localization, service requirements, price units, provider offerings, provider-owned prices, and confirmed historical service/price snapshots.
- **FR-017**: The model MUST represent one shared eligibility domain used by Browse and Recommended, with Release 1 inputs and Release 3 geo/realtime extensions visibly belonging to that same domain.
- **FR-018**: The model MUST cover booking drafts, recommended request sessions, recommended requests, offers/counteroffers, confirmed bookings, executable orders, assignments, assigned workers/teams, completion codes/evidence, cancellation/failure history, and emergencies without treating the two booking paths as separate execution domains.
- **FR-019**: The model MUST cover payment methods/attempts, deposits, immutable financial records, provider dues, settlements, payouts, COD confirmation, refunds, adjustments, reconciliation, external payment references, and external payout references.
- **FR-020**: The model MUST cover basic provider/team ratings, written reviews, rating aggregates, notification templates/localizations/deliveries, support tickets/replies/assignments, operational dossiers, staff control, and audit history.
- **FR-021**: The model MUST cover country, currency, locale, global configuration, country-scoped configuration, and media ownership while preserving the distinction between business meaning and shared technical infrastructure.
- **FR-022**: The model MUST cover Release 2 marketer identity/profile, activation, referral keys/links, customer attribution, commission, settlement, payout destination, fraud controls, premium plans/benefits, and premium-provider enrollment/ranking inputs.
- **FR-023**: The model MUST cover Release 3 address coordinates, zones/geometry, distance/radius coverage, Eligibility V2 inputs, real-time recommended distribution, offers, consent-based location, live tracking, emergency updates, and operational live-map concepts as extensions to earlier authoritative entities.

#### Required domain boundaries

- **FR-024**: The architecture MUST define a booking as the commercial intent/configuration and confirmation boundary and an order as the executable fulfillment lifecycle, including the exact event or invariant that creates or activates the order without prematurely fixing OQ-010 enum names.
- **FR-025**: The architecture MUST define how Browse and an accepted Recommended offer converge into the same confirmed booking/order and financial paths while preserving each path's source history.
- **FR-026**: Provider-owned teams and membership MUST remain separate from order-owned assignments; assignment records MUST preserve which workers or team composition were committed to an order.
- **FR-027**: Catalog-owned service definitions and units MUST remain separate from provider-owned offerings and prices; confirmed records MUST preserve the historical values needed to prevent later catalog or price changes from rewriting history.
- **FR-028**: External provider or marketer payout destinations MUST remain separate from provider/marketer dues, settlements, payout instructions/results, and immutable financial records.
- **FR-029**: External payment/payout rails and gateway funding references MUST be modeled as integrations or destinations, never as Cleanora user balances, top-ups, transfers, or reusable stored-value wallets.
- **FR-030**: Global configuration MUST be separated from country-scoped configuration, with explicit precedence and `countryCode` scope for every country-sensitive rule.
- **FR-031**: Business modules MUST own the meaning, authorization, and lifecycle of their entities; shared technical infrastructure MAY provide neutral storage, delivery, or audit mechanics but MUST NOT absorb business lifecycle ownership.
- **FR-032**: Media ownership MUST identify the business entity and authorization owner for each attachment while keeping protected-object storage mechanics and external object references in a business-neutral technical boundary.
- **FR-033**: Important cross-module relationships MUST name authoritative owner and consumer without authorizing direct access to another module's internal repository or raw persistence representation.

#### Entity and table ownership

- **FR-034**: The entity-ownership deliverable MUST reconcile the complete planned-table inventory for all three approved releases with the conceptual model, including explicit identification of conceptual/derived entities that do not require a table.
- **FR-035**: Every planned table MUST have exactly one owning business module, one owning release, one owning roadmap phase, and one lifecycle owner.
- **FR-036**: Every planned table MUST list important cross-module consumers and the business purpose of each consumption without transferring ownership.
- **FR-037**: Every planned table MUST be classified, as applicable, as authoritative, historical, immutable, configurable, auditable, or an external integration reference; multiple applicable characteristics MUST remain visible.
- **FR-038**: The ownership map MUST contain zero missing, orphaned, duplicate, or ambiguously multi-owned planned tables and MUST expose any unresolved ownership conflict as an R1-P00 architecture blocker.
- **FR-039**: Ownership rows MUST identify the future phase that creates the table; R1-P00 owns only the global architecture decision and documentation.

#### Database conventions for future phases

- **FR-040**: Database conventions MUST establish one consistent table- and field-naming policy, including relation names, identifiers, timestamps, status fields, external-reference fields, and snapshot fields.
- **FR-041**: Database conventions MUST establish a primary-key strategy and rules for when a business identifier or external identifier is distinct from the primary key.
- **FR-042**: Database conventions MUST define foreign-key requirements, optional and required relationship semantics, ownership-side placement, deletion behavior, and how cross-module references preserve module boundaries.
- **FR-043**: Database conventions MUST define when `createdAt` is required, when `updatedAt` is meaningful, and which immutable/event records MUST NOT imply mutability through an `updatedAt` field.
- **FR-044**: Database conventions MUST define when hard deletion is allowed, when soft deletion or deactivation is appropriate, and which historical, financial, audit, or confirmed business records MUST never be hard-deleted.
- **FR-045**: Database conventions MUST define the decision criteria for status representation and enum evolution while explicitly leaving final booking/order enum names and emergency modeling open under OQ-010.
- **FR-046**: Database conventions MUST require decimal-safe monetary amounts, explicit currency, server-authoritative calculations, and preservation of calculation inputs and results where later changes must not rewrite history.
- **FR-047**: Database conventions MUST define country and currency representation, require `countryCode` for country-sensitive rules, and prohibit hidden Egypt-only assumptions in business data.
- **FR-048**: Database conventions MUST define Arabic/English localization representation, fallback expectations, uniqueness scope, and ownership for catalog content, templates, and other localized business text.
- **FR-049**: Database conventions MUST define which confirmed business values require historical snapshots and how snapshots remain distinguishable from authoritative live catalog, provider, customer, or configuration records.
- **FR-050**: Database conventions MUST require append-only or equivalently immutable financial records, traceable compensating entries, and prohibition of hard deletion or in-place rewriting of financial history.
- **FR-051**: Database conventions MUST define evidence-based index and unique-constraint expectations for identities, ownership, external idempotency keys/references, lifecycle lookups, country scope, and business invariants, without pre-creating future tables.
- **FR-052**: Database conventions MUST define required audit fields for sensitive and privileged actions, including actor, timestamp, reason, target, action, and before/after evidence where applicable.
- **FR-053**: Database conventions MUST define phase-owned migration naming, ownership, SQL review, compatibility evidence, and traceability back to the phase requirement.
- **FR-054**: Database conventions MUST prohibit editing, deleting, reordering, or resetting applied migrations and MUST require a new forward migration for every correction.
- **FR-055**: Database conventions MUST assign seed and backfill definition, review, execution evidence, and compatibility responsibility to the phase that introduces or changes the relevant data.
- **FR-056**: Database conventions MUST prevent raw persistence models and persistence-specific types from crossing module public contracts.

#### Initial status-machine design

- **FR-057**: The status-machine draft MUST define every transition record using actor, from state, to state, preconditions, side effects, audit requirement, and failure or rejection outcome.
- **FR-058**: The status-machine draft MUST define backend authority, permission and ownership checks, stale-state/concurrency rejection, idempotent side-effect expectations, and the owner of each state transition.
- **FR-059**: The status-machine draft MUST address normal, cancellation, failure, privileged override, completion, and emergency-related transition categories without inventing open fee, enum, or emergency-model decisions.
- **FR-060**: Final booking/order enum names and the final emergency representation MUST remain visibly open, traced to OQ-010, and assigned to R1-P13 for resolution before migration.
- **FR-061**: Failure and rejection outcomes MUST distinguish a rejected transition from a successful state change and MUST state whether sensitive failures require audit evidence.

#### Open-question control and review

- **FR-062**: Every question in `docs/product/open-questions.md` relevant to the three-release model MUST state whether it blocks R1-P00, the entities it affects, its future resolution phase or explicit unassigned status, and its temporary containment boundary.
- **FR-063**: Deliberately deferred questions MUST NOT block R1-P00 when their containment boundary permits a coherent global model without a product answer.
- **FR-064**: Any newly discovered question that prevents unique ownership, cardinality, lifecycle separation, or a locked financial/security boundary MUST be recorded as an R1-P00 blocker rather than answered by assumption.
- **FR-065**: Architecture review MUST verify 100% open-question coverage and confirm that no deliverable, example, legend, or naming convention silently resolves an open question.
- **FR-066**: Each of the four new architecture deliverables MUST contain explicit acceptance criteria, source references, and enough objective evidence for the architecture reviewer to approve or reject it.

### Deliverable Acceptance Criteria

- **Master ERD**: Passes only when FR-009 through FR-033 and SC-001, SC-003, SC-006, SC-007, and SC-011 are satisfied; its legend, release/phase labels, module grouping, cardinalities, lifecycle boundaries, record classifications, and prohibited-wallet review must be complete.
- **Entity Ownership**: Passes only when FR-034 through FR-039 and SC-002, SC-005, and SC-010 are satisfied; every planned table must reconcile to exactly one complete ownership row and every non-persisted conceptual entity must be explicitly identified.
- **Database Conventions**: Passes only when FR-040 through FR-056 and SC-008 are satisfied; all required convention categories must have one explicit rule, exception boundary, and future-phase responsibility with no contradiction.
- **Status-Machine Draft**: Passes only when FR-057 through FR-061 and SC-012 are satisfied; all required transition fields and rejection semantics must be present while OQ-010 decisions remain provisional and traceable.
- **Standalone Boundary Validation**: Passes only when the four new deliverables consistently reference `docs/product/standalone-project-boundary.md`, introduce no external-project dependency, and create no duplicate boundary document.
- **R1-P00 Architecture Review**: Passes only when FR-001 through FR-066 and SC-001 through SC-014 have evidence, every open question is contained, no architecture blocker remains, and the reviewer records an objective approve/reject recommendation for human consideration.

### Key Entities

These are required conceptual entity families, not permission to create product tables during R1-P00. The Master ERD and ownership map will refine names, cardinalities, classifications, and table necessity without changing locked product behavior.

- **Identity & Access**: User, authentication identity/link, verification challenge/result, role, permission, user-role grant, scoped staff/provider permission, ban/suspension state, and security/audit event. One user can hold multiple roles and actor profiles over time. The locked roles are customer, provider owner, worker, marketer, admin, operations, support, and finance.
- **Customer**: Customer profile, customer type, preferences, textual address, and later geo-address extension. Individual, company, and engineer customer types share the customer role and do not create separate identity systems.
- **Provider Supply**: Provider, provider owner/membership, provider lifecycle, worker, worker capability and gender, team, team membership, supervisor/provider-administrator scope, verification case, document type, provider document, service offering, price, coverage, availability, capacity, and external payout destination.
- **Catalog & Localization**: Category, service, localized content, price unit, and configurable service requirement. Catalog truth is platform-owned; provider prices and offerings are provider-owned.
- **Eligibility**: Shared eligibility policy/input/result concepts for Browse and Recommended. V1 uses service, provider state, textual coverage, availability, crew preference, and capacity; V2 extends these with geo, distance, radius, realtime distribution, and smart ranking inputs.
- **Booking & Recommended**: Booking draft, booking source, service/price snapshot, Recommended request/session, provider offer/counteroffer, offer selection, deposit requirement, confirmation, and conversion history.
- **Order Execution**: Executable order, transition/event history, crew preference, assignment, assigned worker/team evidence, cleaning/non-cleaning participation, completion challenge/code, completion evidence/media, cancellation/failure event, emergency flag/event, and emergency dossier.
- **Payments & Finance**: Payment method, payment attempt, external payment reference, configurable deposit/share calculation, deposit, immutable financial record, platform fee, provider share/due, marketer commission, COD confirmation, settlement, payout, refund, adjustment, reconciliation, and external gateway/payout reference. None is a stored-value user wallet.
- **Trust & Support**: Provider rating, assigned-team rating, written review, rating aggregate, support ticket, support reply, ticket assignment, and links to order, emergency, refund, and operational dossiers.
- **Notifications**: Notification template, localized template content, notification, delivery attempt/result, channel reference, and recipient context.
- **Administration & Audit**: Staff role/permission, privileged action, reason, before/after evidence, actor, target, timestamp, operational action, and finance-control audit.
- **Country & Configuration**: Country, currency, locale, global configuration, country-scoped configuration, and effective configuration. Country-sensitive rules are keyed by `countryCode`.
- **Media**: Protected media asset/object reference, attachment/ownership link, purpose, uploader, and lifecycle/access evidence. Business modules retain authorization and lifecycle meaning.
- **Marketer & Growth (Release 2)**: Marketer profile/lifecycle, activation payment relationship, referral key/link, customer attribution, commission funded from Cleanora's share, clawback/fraud action, settlement, external payout destination, premium plan/benefit, provider enrollment, and ranking input that can never bypass eligibility.
- **Geo & Realtime (Release 3)**: Coordinates, geo address, zone/geometry, radius/distance coverage, consent record, live-location sample/session, realtime request distribution, offer updates, emergency updates, and admin live-map projection. These extend earlier authoritative entities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the major conceptual entity families and entities listed in this specification are represented in the Master ERD or explicitly documented as derived/non-persisted.
- **SC-002**: 100% of planned tables have exactly one owning module, release, roadmap phase, and lifecycle owner, plus important consumers and applicable record classifications.
- **SC-003**: 100% of important cross-module relationships document direction, cardinality, authoritative owner, and lifecycle boundary, with zero ownership transfers implied by consumption.
- **SC-004**: 100% of OQ-001 through OQ-014 are linked to affected architecture areas, blocker status, a future resolution phase or explicit unassigned status, and a temporary containment boundary.
- **SC-005**: The ownership review reports zero orphan, duplicate, or ambiguously multi-owned planned tables.
- **SC-006**: The architecture contains zero customer, provider, worker, or marketer stored-value wallet entities and zero reusable Cleanora-held user-balance behavior.
- **SC-007**: Payout-destination review finds 100% structural separation between external destinations and dues, settlements, payout records, and immutable financial history.
- **SC-008**: All required convention categories in FR-040 through FR-056 have an explicit, reviewable rule with no unresolved contradiction.
- **SC-009**: All four new architecture deliverables have explicit acceptance criteria and the existing standalone boundary is referenced as canonical rather than duplicated.
- **SC-010**: In a reviewer sampling exercise, each of at least 10 entities spanning all three releases can be traced to its owner, phase, consumers, and governing source in no more than two minutes, with zero ambiguous answers.
- **SC-011**: Every required boundary in FR-024 through FR-033 produces one unambiguous architecture answer and passes all related acceptance scenarios.
- **SC-012**: The status-machine draft includes all seven required transition fields for 100% of its sample transitions while final booking/order enum names and emergency modeling remain visibly unresolved under OQ-010.
- **SC-013**: R1-P00 produces only its approved specification and architecture documentation outcomes, with zero runnable product behavior, persisted product data, deployment work, or future-phase implementation.
- **SC-014**: Architecture review reports no unresolved blocker and can issue an objective approve/reject result against every R1-P00 Done When condition before the human owner considers phase completion.

## Assumptions

- The short feature name is `product-database-architecture`; the user-provided directory `specs/R1-P00-product-database-architecture` is authoritative and independent of any Git branch name.
- The three approved releases and R1-P00 scope are fixed by DEC-001 and the active roadmap. A later implementation may inspect the approved roadmap's planned-table inventory to complete the ownership map, but it may not implement those tables during R1-P00.
- "Planned table" means a table explicitly required by the approved roadmap or proven necessary by the canonical three-release conceptual model. A conceptual or derived entity does not require a table solely to make the inventory appear complete.
- Record classifications such as authoritative, historical, immutable, configurable, auditable, and external integration reference are not assumed to be mutually exclusive.
- A future implementation phase owns creation and migration of its tables. R1-P00 owns only the global architecture contract, traceability, and review outcome.
- OQ-001 through OQ-014 do not block R1-P00 because each has a repository-approved temporary rule or an exclusion boundary that permits architecture without deciding the open behavior. If review proves a unique ownership, cardinality, or locked safety boundary cannot be defined, FR-064 converts that discovered gap into a blocker.
- The existing `docs/product/standalone-project-boundary.md` is complete enough to serve as the canonical standalone boundary and requires validation/reference, not replacement.
- Exact table names, fields, enum values, and implementation representations belong to the R1-P00 architecture deliverables or the owning implementation phase unless a canonical source already locks them.
- Spec Kit artifacts (`spec.md`, then `plan.md` / `tasks.md`) authorize documentation-only creation of the four architecture deliverables. They do not authorize runtime code, Prisma schema/migration work, Git operations, deployment, or future-phase implementation.

## Constitution & Locked Constraints *(mandatory)*

### In scope for this phase

- Consolidate the locked vision, DEC-001 through DEC-014, OQ-001 through OQ-014, and the R1-P00 roadmap contract into requirements for the global three-release conceptual model.
- Specify acceptance for the later creation of `master-erd.md`, `database-conventions.md`, `entity-ownership.md`, and `status-machine-draft.md`.
- Validate and reference `docs/product/standalone-project-boundary.md` as the canonical standalone boundary.
- Define the required entity coverage, relationships, cardinalities, lifecycle boundaries, record classifications, ownership fields, database-convention topics, transition-design fields, open-question containment, and architecture review evidence.
- Preserve one deployable modular monolith in which business modules own behavior and persistence and expose explicit public contracts.

### Explicitly out of scope

- Editing `prisma/schema.prisma`, creating or applying a migration, generating product persistence artifacts, or adding future product tables.
- Creating seeds or backfills.
- Implementing source code, modules, public contracts, APIs, routes, jobs, runtime behavior, or tests.
- Implementing R1-P01 country-configuration tables, R1-P02 authentication, or any future-phase behavior.
- Implementing the four architecture deliverables belongs to the later documentation implementation authorized by `plan.md` and `tasks.md`, not to the specify-only drafting pass that first wrote this `spec.md`.
- Creating a duplicate of `docs/product/standalone-project-boundary.md`.
- Docker, Testcontainers, cloud implementation, deployment, or production migration.
- Final production configuration values or integration credentials.
- Resolving any open product question without human approval.
- Internal customer, provider, worker, or marketer stored-value wallets.
- Dependencies on another repository, schema, migration history, database, dataset, or undocumented service.
- Commits, pushes, merges, phase-status changes, or phase-completion approval.

### Open questions (must not invent)

- OQ-001 through OQ-014 are classified in the canonical-source section. All are deferred rather than blocking R1-P00 under their stated containment boundaries.
- OQ-010 specifically prevents R1-P00 from freezing final booking/order enum names or the final emergency representation; R1-P13 owns that decision before migration.
- OQ-003, OQ-004, OQ-006, and OQ-008 have no approved implementation phase and remain excluded until a human-approved roadmap change assigns one.
- Any newly discovered blocker MUST be added to the canonical open-question process and approved by the human owner; it MUST NOT be encoded as an architecture assumption.

### Architecture and data ownership

- **Owning module(s)**: R1-P00 spans the planned business modules only to assign architecture ownership. Each planned entity/table has one business lifecycle owner; shared technical facilities remain business-neutral.
- **Cross-module interactions**: Consumers use narrow public contracts. Cross-module reads do not confer ownership, and no caller may depend on another module's internal repository or raw persistence representation.
- **Persistence impact**: None. This phase produces specification and, later, architecture documentation only.
- **R1-P00 guard**: No product models, migrations, seeds, backfills, or future-phase tables may be created.
- **Migration ownership**: Each future database-changing phase owns its local schema change, named migration, SQL review, constraints/indexes, generated artifacts, seed/backfill changes, compatibility evidence, and database tests. Applied migrations are immutable.

### Integrity, security, and historical behavior

- **Backend authority and validation**: The architecture must preserve backend authority for eligibility, price, payment, state transitions, and financial records.
- **Authorization, state, and audit**: Sensitive and privileged actions require deny-by-default permissions, ownership/state checks, reason where applicable, actor/timestamp, before/after evidence, and auditable outcomes.
- **Idempotency and concurrency**: The architecture and transition approach must identify replayable financial/integration side effects, stale-state rejection, and idempotency expectations; no runtime behavior is implemented in R1-P00.
- **Money and snapshots**: Monetary data is decimal-safe, currency-explicit, server-calculated, immutable where financial, and historically snapshotted where confirmed business records must not change.
- **Sensitive data**: Architecture must distinguish protected credentials, verification data, external references, media access, and audit redaction needs without defining production secrets or provider payloads.

### Risk-proportional test obligations

- R1-P00 evidence is documentation-focused: canonical-source traceability, complete entity coverage, cardinality review, ownership uniqueness, open-question reconciliation, convention completeness, negative wallet review, payout/dues separation, and objective architecture-review checklists.
- Runtime unit, integration, E2E, migration, authorization, payment, replay, concurrency, queue, cache, notification, and regression tests are not applicable because this phase introduces no runtime behavior or persistence change. Their future obligations must remain assigned to the phases that introduce those risks.
- Changed-file evidence must confirm that no product schema, migration, seed, source, test, Docker, cloud, product document, current-phase status, or unapproved architecture-deliverable file changed during this specification task.
- Release 1 planning and evidence MUST NOT depend on Docker or Testcontainers.

### Human approval points

- The human owner approves any product decision, open-question resolution, architecture exception, phase completion, commit, push, merge, deployment, production migration, destructive action, credential, and production configuration.
- The architecture reviewer may recommend approval or rejection using objective evidence, but only the human owner can approve R1-P00 completion.
- This `spec.md` alone does not authorize Git operations, deployment, production migration, or future-phase runtime work. Documentation-only implementation of the four architecture deliverables and related Spec Kit artifacts is authorized by the companion `plan.md` and `tasks.md` after `/speckit-plan` and `/speckit-tasks`.

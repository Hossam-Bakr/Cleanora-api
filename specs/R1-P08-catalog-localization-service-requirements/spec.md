# Feature Specification: Catalog, Localization & Service Requirements

**Feature Branch**: `r1-p08-catalog-localization-service-requirements`

**Created**: 2026-08-30

**Status**: Specified — clarification complete; ready for technical planning

**Input**: Create the platform-owned Arabic/English service catalog for R1-P08,
including categories, services, configurable price units, service requirements
and booking fields, media associations, ordering, country availability,
activation controls, Egypt housekeeping seed data, authorized staff management,
and snapshot-ready catalog facts. Preserve Catalog ownership, Media ownership of
files, future Provider pricing and Booking boundaries, and all Cleanora phase and
human-approval gates.

## Clarifications

### Session 2026-08-30

- Q: Before a localized catalog record is activated or made selectable, must
  both Arabic and English be complete, and may a missing requested locale fall
  back? → A: Records may be saved incomplete while inactive, which is their
  draft form in R1-P08; activation and selectability require all required Arabic
  and English content, localized reads never fall back to another locale, and
  missing requested-locale content fails safely.
- Q: What minimum service-field kinds and kind-specific constraints must
  Release 1 support? → A: R1-P08 supports exactly `INFORMATION`, `TEXT`,
  `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, and `MULTI_SELECT`, with only their
  approved display, length, numeric-mode/bound, option, and selection-count
  constraints; dates, times, uploads, conditional logic, and answer persistence
  are excluded.
- Q: Which staff roles may access protected Catalog management reads and
  writes? → A: Only an active `staff_admin` receives
  `catalog.management.read` and `catalog.management.write`; no other staff role
  receives protected Catalog access, and selectable reads remain a separate
  safe module-internal contract with no R1-P08 anonymous/customer Browse HTTP.
- Q: What initial Egypt housekeeping catalog must the idempotent seed create? →
  A: Create one complete active `HOME_CLEANING` category, one complete active
  `STANDARD_HOME_CLEANING` service, `PER_VISIT` and `PER_HOUR` price units, a
  small representative set of preparation, room-count, pet, and special-
  instruction fields, and active `EG` availability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage the Localized Service Catalog (Priority: P1)

An authorized staff administrator creates and maintains platform-owned service
categories and services with Arabic and English customer-facing content, stable
identities, and a clear parent/category relationship. The catalog can evolve
without requiring a new deployment.

**Why this priority**: Categories, services, and localized content are the
minimum usable catalog truth required by every later provider, eligibility,
browse, and booking phase.

**Independent Test**: Starting from an empty catalog, an authorized staff
administrator can create one category and one service, supply the required
localized content, read them back in each supported locale, update the content,
and observe the same stable category/service identities throughout.

**Acceptance Scenarios**:

1. **Given** no matching category exists, **When** an authorized staff
   administrator creates a category with valid localized content, **Then** one
   platform-owned category with a stable identity is available for subsequent
   service creation.
2. **Given** an existing category, **When** an authorized staff administrator
   creates a service with valid localized content, **Then** the service belongs
   to exactly that category and is returned with the requested locale's content.
3. **Given** an existing category or service, **When** an authorized staff
   administrator changes localized text, **Then** current catalog reads use the
   accepted update while the stable entity identity is unchanged.
4. **Given** a duplicate locale entry or conflicting stable code, **When** staff
   submits the change, **Then** it is rejected without a partial catalog update.

---

### User Story 2 - Configure Price Units and Service Booking Fields (Priority: P1)

An authorized staff administrator defines which configurable price units and
structured service requirements or booking questions belong to each service
using the six approved field kinds, including ordered options and validation
rules that later consumers can render and snapshot consistently.

**Why this priority**: A service name alone is insufficient for provider pricing
or customer booking. Later phases need stable definitions of how a service may
be priced and which service-specific facts must be collected.

**Independent Test**: For one service, staff can assign valid price units and
create ordered service fields with localized labels and options; a consumer can
read a deterministic, validation-ready definition without any provider price or
booking record being created.

**Acceptance Scenarios**:

1. **Given** an existing service, **When** staff assigns one or more valid price
   units, **Then** the service exposes exactly those units in deterministic
   display order.
2. **Given** an existing service, **When** staff creates a required structured
   field with valid localized labels and validation rules, **Then** the field is
   returned in its configured order and can be validated without free-form
   interpretation.
3. **Given** a field that uses selectable options, **When** staff supplies
   localized ordered options, **Then** every option has a stable identity and is
   exposed only for that field.
4. **Given** inconsistent constraints, duplicate positions, or an option for an
   incompatible field kind, **When** staff submits the change, **Then** the whole
   change is rejected without partial state.

---

### User Story 3 - Control Availability, Status, and Display Order (Priority: P2)

An authorized staff administrator controls category/service display order,
active or inactive state, and country availability using authoritative country
codes. A consumer sees only catalog entries that are currently selectable for
the requested country.

**Why this priority**: Country and lifecycle controls prevent disabled or
unavailable services from being offered while allowing staff administrators to
manage the catalog without deployment.

**Independent Test**: Staff can activate, deactivate, reorder, and scope a
service to Egypt; selection reads include it only while the complete category,
service, and country-availability chain is active and eligible.

**Acceptance Scenarios**:

1. **Given** an otherwise valid service available for `EG`, **When** every
   required ancestor and availability record is active, **Then** the service is
   selectable for `EG` and appears at the configured position.
2. **Given** an active service, **When** staff deactivates the service or its
   category or country availability, **Then** it is immediately excluded from
   selectable results without deleting its identity.
3. **Given** a country code that is not authoritative and active, **When** staff
   attempts to make a service available there, **Then** the change is rejected.
4. **Given** two concurrent ordering or lifecycle changes based on the same old
   version, **When** both are submitted, **Then** at most one succeeds and the
   other receives a safe conflict without partial reordering.
5. **Given** an empty database with authoritative Egypt configuration, **When**
   the approved housekeeping seed runs, **Then** one bilingual Home Cleaning
   category and one bilingual Standard Home Cleaning service become selectable
   for `EG` with their approved price units and representative fields.

---

### User Story 4 - Manage Service Media Safely (Priority: P2)

An authorized staff administrator associates ready Media-owned assets with a
service, orders them for presentation, and removes an association
without changing the Media-owned file lifecycle.

**Why this priority**: Catalog visuals are in scope, but file upload, processing,
storage, and delivery must remain with the established Media owner.

**Independent Test**: With an existing ready Media asset, staff can attach it to
one service, reorder it, read the resulting media presentation metadata,
and detach it without mutating or deleting the underlying Media record.

**Acceptance Scenarios**:

1. **Given** a valid ready Media asset, **When** an authorized staff
   administrator associates it with a service, **Then** the catalog exposes the
   association in deterministic order through a Media-safe reference.
2. **Given** a missing, failed, private-for-another-purpose, or otherwise
   ineligible Media asset, **When** staff attempts an association, **Then** the
   request is rejected without changing Catalog or Media state.
3. **Given** an existing association, **When** staff removes it, **Then** the
   catalog no longer presents the asset and the Media-owned file remains
   untouched.

---

### User Story 5 - Consume Snapshot-Ready Catalog Facts (Priority: P3)

Authorized downstream Cleanora modules can obtain a stable, current catalog
definition for provider selection, eligibility, browse, and future booking
snapshots without owning or directly querying Catalog persistence.

**Why this priority**: R1-P08 must prepare reliable catalog truth for later
phases while deliberately not implementing provider offerings, prices,
eligibility, bookings, or orders early.

**Independent Test**: A downstream consumer can request a service definition
and receive its stable identity, localized content, eligible price units,
ordered fields/options, current country availability, status, and media
references; changing the live catalog later does not mutate a previously copied
consumer snapshot fixture.

**Acceptance Scenarios**:

1. **Given** a selectable service, **When** an authorized consumer requests its
   snapshot-ready definition for a country and locale, **Then** one internally
   consistent versioned definition is returned.
2. **Given** an inactive or unavailable service, **When** a selection consumer
   requests validation, **Then** the catalog denies current selection while
   still allowing an authorized administrative read of the entity.
3. **Given** a live catalog change, **When** a later-phase consumer has already
   copied an approved snapshot, **Then** no R1-P08 operation rewrites that
   external historical snapshot.

### Edge Cases

- A category is active while one of its services is inactive, or the reverse.
- A service is active globally but has no active country availability.
- A country is deactivated after services were made available for it.
- Arabic or English text is missing, blank after trimming, duplicated, or
  updated concurrently; incomplete localized records remain inactive drafts,
  and an exact-locale read with missing content fails safely without fallback.
- Two categories or services attempt to use the same stable code.
- Staff reorders items using duplicate, missing, negative, or stale positions.
- A price unit is deactivated while currently assigned to one or more services.
- A service field changes kind after options or validation constraints exist.
- Staff submits a field kind outside the six-kind Release 1 catalog or attaches
  a constraint that the chosen kind does not support.
- Selectable options contain duplicate stable values or incomplete localized
  labels.
- A field or option is inactive while the parent service remains active.
- A Media asset is still processing, failed, deleted, or already associated in
  a conflicting role.
- A category or service is deactivated while a downstream consumer is reading
  its snapshot-ready definition.
- OQ-002 remains unresolved while staff configures neutral requirements or
  notes; the system must not infer who supplies cleaning materials.
- A retry repeats an already accepted privileged mutation.
- A stale or competing mutation must change zero catalog, audit, ordering, or
  media-association state.

## Requirements *(mandatory)*

### Functional Requirements

#### Catalog ownership and taxonomy

- **FR-001**: The platform MUST own the authoritative service catalog.
- **FR-002**: Catalog MUST own category, service, translation, price-unit,
  service-field, field-option, and country-availability business lifecycles.
- **FR-003**: Each service MUST belong to exactly one category.
- **FR-004**: Every category and service MUST have a stable, unique,
  human-readable code that does not change when display text changes.
- **FR-005**: Category and service identities MUST remain stable across content,
  order, availability, and lifecycle changes.
- **FR-006**: Catalog definitions MUST remain separate from provider offerings,
  provider-owned prices, eligibility results, bookings, and orders.
- **FR-007**: Shared technical areas MUST NOT own catalog business records.

#### Localization

- **FR-008**: Category and service customer-facing names and descriptions MUST
  support Arabic and English as distinct localized values.
- **FR-009**: Service-field labels/help text, field-option labels, and any
  customer-facing price-unit labels MUST support Arabic and English.
- **FR-010**: Localized values MUST reject blank-after-trimming content and more
  than one value for the same entity and locale.
- **FR-011**: A localized catalog record MAY remain incomplete only while
  inactive; that incomplete inactive record is its draft form and does not add
  a separate lifecycle state. Activation and selectability MUST require all of
  its required Arabic and English content, and an exact-locale read with missing
  requested-locale content MUST fail safely without falling back to another
  locale.
- **FR-012**: A localized update MUST affect current catalog reads without
  changing the stable category, service, field, option, or price-unit identity.

#### Price units and service fields

- **FR-013**: An authorized staff administrator MUST be able to manage a finite
  catalog of configurable price units, including examples such as flat, hourly,
  per room, and per square metre without hard-coding those examples as the only
  permanent set.
- **FR-014**: A service MUST declare one or more allowed active price units
  before it can be selectable.
- **FR-015**: Catalog MUST NOT store provider-owned price amounts, minimum
  charges, discounts, or price history in R1-P08.
- **FR-016**: An authorized staff administrator MUST be able to create, update,
  order, activate, and deactivate structured service fields and their
  applicable validation rules.
- **FR-017**: R1-P08 MUST support exactly six service-field kinds:
  `INFORMATION` is display-only, never required, and accepts no answer
  constraints or options; `TEXT` accepts optional minimum and maximum length;
  `NUMBER` accepts optional minimum and maximum values plus an explicit
  integer-or-decimal mode; `BOOLEAN` accepts no options, length bounds, numeric
  bounds, or selection bounds; `SINGLE_SELECT` accepts ordered options and one
  selected value; and `MULTI_SELECT` accepts ordered options plus optional
  minimum and maximum selection counts.
- **FR-018**: Fields using selectable options MUST have stable option identities,
  deterministic order, localized labels, and duplicate-value rejection within
  the owning field.
- **FR-019**: Requiredness MUST be explicit per service field and included in
  snapshot-ready definitions.
- **FR-020**: The system MUST reject internally inconsistent field kinds,
  constraints, options, order, or requiredness without partial persistence.
- **FR-021**: Service requirements and notes MUST remain neutral under OQ-002
  and MUST NOT enforce a universal materials-supply rule.

#### Country availability, status, and order

- **FR-022**: Country-sensitive catalog behavior MUST use authoritative
  `countryCode` facts and MUST NOT hard-code Egypt in business rules.
- **FR-023**: A service MUST have an explicit country-availability record before
  it is selectable in that country.
- **FR-024**: Category, service, price-unit, field, option, and country-
  availability records MUST expose explicit active/inactive lifecycle truth
  where their selection or rendering eligibility can change.
- **FR-025**: A service MUST be selectable only when its category, service,
  country availability, assigned price unit, required localized content, and
  applicable field/option configuration all satisfy current policy.
- **FR-026**: Deactivating any required ancestor or availability fact MUST deny
  new selection without deleting stable catalog identity.
- **FR-027**: Catalog entities and their child collections MUST support
  deterministic display order with duplicate-position rejection or an
  equivalent deterministic normalization rule.
- **FR-028**: Ordering and lifecycle mutations MUST be concurrency-safe and MUST
  not leave partial order or activation state.
- **FR-029**: R1-P08 MUST NOT hard-delete category or service identity through
  ordinary Admin CRUD; lifecycle removal is represented by inactive state.

#### Administration, authorization, and audit

- **FR-030**: Protected Catalog management MUST declare separate
  `catalog.management.read` and `catalog.management.write` permissions and map
  both only to an active `staff_admin`. `staff_operations`, `staff_support`,
  `staff_finance`, provider roles, workers, and customers MUST receive neither
  permission. Internal selectable reads remain separate and MUST NOT expose
  inactive drafts or protected management detail; they are not an R1-P08
  actor-facing HTTP surface.
- **FR-031**: Every catalog mutation MUST deny by default when the authenticated
  actor lacks the required active capability.
- **FR-032**: Every privileged write MUST require a valid reason and record
  before/after audit data, actor identity, and timestamp.
- **FR-033**: R1-P08 MUST use the Admin-owned business-neutral audit record as
  privileged mutation evidence and MUST NOT add Catalog-specific mutation
  history solely to duplicate the same actor, reason, before/after, and time
  evidence. Current Catalog entities retain their own version truth.
- **FR-034**: Mutating commands MUST use explicit optimistic version checks or an
  equivalent conflict-safe precondition.
- **FR-035**: Retried accepted commands MUST be idempotent, while stale or
  competing commands MUST fail safely with zero partial catalog or audit state.
- **FR-036**: Routine validation failures MUST expose safe, stable error outcomes
  without leaking internal persistence or Media details.
- **FR-037**: Catalog management MUST be possible through supported application
  behavior without direct database edits or deployment.

#### Media and public contracts

- **FR-038**: Media MUST retain ownership of file upload, processing, storage,
  deletion, and delivery lifecycles.
- **FR-039**: Catalog MUST consume Media eligibility and safe reference facts
  only through a Media-owned public contract.
- **FR-040**: Only an eligible ready Media asset MAY be associated with a
  service for catalog presentation.
- **FR-041**: Catalog MUST support deterministic ordering and removal of media
  associations without deleting or mutating the Media-owned file.
- **FR-042**: Catalog MUST expose protected HTTP management views plus narrow
  module public contracts for selectable catalog reads and snapshot-ready
  service definitions. R1-P08 MUST NOT expose anonymous/customer Browse HTTP;
  that surface belongs to R1-P12.
- **FR-043**: Cross-module consumers MUST NOT query Catalog persistence or
  receive raw persistence records.
- **FR-044**: A snapshot-ready definition MUST include stable service/category
  identity, selected locale content, allowed price units, ordered fields and
  options, requiredness/validation facts, country context, lifecycle/version
  truth, and safe media references.
- **FR-045**: R1-P08 MUST NOT create booking records or own a later consumer's
  copied historical snapshot.
- **FR-046**: Changes to live catalog truth MUST NOT rewrite any historical
  snapshot already owned by a later phase.

#### Seed, scope, and evidence

- **FR-047**: The phase MUST provide an idempotent Egypt housekeeping seed using
  the same validation rules as managed catalog truth. It creates exactly one
  active `HOME_CLEANING` category, one active `STANDARD_HOME_CLEANING` service,
  active `PER_VISIT` and `PER_HOUR` price units, active `EG` availability, and
  the approved representative fields: localized preparation information,
  integer bedroom count, integer bathroom count, optional pet presence, and
  optional special instructions.
- **FR-048**: Re-running the seed MUST not duplicate, silently reactivate, or
  overwrite owner-managed catalog changes unless an explicitly approved seed
  ownership rule permits that exact field.
- **FR-049**: Seeded catalog content MUST remain manageable through the same
  authorized application behavior as other catalog content after creation.
- **FR-050**: R1-P08 MUST NOT implement provider service enrollment/pricing,
  eligibility decisions, browsing, booking, ordering, payment, frontend
  applications, notifications, Docker/cloud, deployment, or production work.
- **FR-051**: Any R1-P08 persisted data MUST be introduced through one additive,
  forward-only phase-owned migration without editing an applied migration.
- **FR-052**: Phase evidence MUST prove clean chronological installation,
  populated earlier-phase upgrade compatibility, seed idempotency, live
  constraints, authorization, audit, lifecycle, localization, concurrency,
  Media boundaries, and snapshot-contract behavior before completion approval.

### Key Entities

- **Service Category**: Platform-owned grouping with stable code, localized
  presentation, lifecycle state, display order, and contained services.
- **Service**: Platform-owned service definition with stable code, category,
  localized presentation, lifecycle/version truth, allowed price units,
  requirements/fields, country availability, and media associations.
- **Localized Content**: Arabic or English customer-facing values for a catalog
  entity, unique within the entity and locale.
- **Price Unit**: Configurable platform definition of how a provider may later
  express a price, separate from any provider price amount.
- **Service Field**: Ordered structured requirement or booking question owned by
  one service, using exactly `INFORMATION`, `TEXT`, `NUMBER`, `BOOLEAN`,
  `SINGLE_SELECT`, or `MULTI_SELECT`, with applicable requiredness, localized
  text, kind-compatible validation, lifecycle, and optional choices.
- **Service Field Option**: Stable ordered selectable value owned by one
  compatible service field, with localized labels and lifecycle state.
- **Service Country Availability**: Current country-scoped selection eligibility
  for a service using an authoritative country code.
- **Service Media Association**: Ordered Catalog-owned reference from a service
  to an eligible Media-owned asset; it does not own the file lifecycle.
- **Snapshot-Ready Service Definition**: Versioned current catalog facts that a
  later owning module may copy into its own historical record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An active `staff_admin` with both Catalog management permissions
  can create a valid localized category and service and make the service
  selectable for Egypt without a deployment or direct database edit.
- **SC-002**: 100% of active selectable services and their applicable localized
  catalog records contain all required Arabic and English values, have no
  duplicate locale record, and require no cross-locale fallback.
- **SC-003**: 100% of selectable services have at least one active allowed price
  unit and an internally valid ordered service-field definition.
- **SC-004**: 100% of selection attempts for inactive or country-unavailable
  services are denied with a safe deterministic outcome.
- **SC-005**: Repeating the Egypt seed twice produces the same stable identities
  for exactly one `HOME_CLEANING` category, one `STANDARD_HOME_CLEANING`
  service, two approved price units, five representative fields, and one `EG`
  availability record, with zero duplicates and no overwrite of later owner-
  managed values.
- **SC-006**: Concurrent conflicting lifecycle, ordering, or structural updates
  result in at most one accepted change and zero partial business/audit state.
- **SC-007**: Every accepted privileged catalog write has permission, reason,
  actor, timestamp, and before/after audit evidence; unauthorized attempts make
  zero catalog changes.
- **SC-008**: 100% of catalog media associations reference eligible Media-owned
  assets, and detaching one changes no Media-owned file state.
- **SC-009**: A snapshot-ready service definition is internally consistent to
  one accepted catalog version and contains every field required by FR-044.
- **SC-010**: Every FR and build-verifiable SC maps to at least one executable
  implementation, test, or evidence task before implementation begins.
- **SC-011**: Clean-install and populated-upgrade proofs preserve all prior
  phase truth while introducing only the approved R1-P08 schema and seed.
- **SC-012**: All phase-specific and repository quality gates pass with no
  unresolved BLOCKER, MAJOR, Constitution conflict, privacy/security failure,
  or forbidden future-phase behavior before owner completion approval.

## Assumptions

- `AR` and `EN` are the only R1-P08 catalog content locales. An inactive record
  is the draft form and may be incomplete; activation and selectability require
  both locales, and requested-locale reads never fall back to the other locale
  under DEC-041. No separate `DRAFT` lifecycle state is introduced.
- The six DEC-042 service-field kinds are the closed Release 1 set. R1-P08
  defines renderable and validation-ready field metadata but stores no customer
  answers; date, time, upload, conditional-logic, and arbitrary-schema fields
  require a later approved phase.
- The approved seed uses the localized names `Home Cleaning` / `تنظيف المنازل`,
  `Standard Home Cleaning` / `تنظيف منزلي قياسي`, `Per visit` / `لكل زيارة`,
  and `Per hour` / `لكل ساعة`. Supporting descriptions and field labels remain
  concise, neutral, bilingual, and must not decide OQ-002.
- Protected Catalog management is active-`staff_admin`-only under DEC-043.
  Other staff roles receive no protected read-only view; safe selectable reads
  for later consumers are a separate contract and expose no inactive draft.
- Ordinary Catalog presentation text contains no private personal data. Media access
  still follows the Media-owned eligibility and delivery contract.
- R1-P08 selectable and snapshot-ready reads are module public contracts, not
  anonymous/customer Browse HTTP. R1-P12 owns that future HTTP experience.
- Stable codes are application-visible identities suitable for references and
  seed idempotency; internal storage identifiers remain implementation details.
- Category/service hard deletion is outside R1-P08 because the approved roadmap
  defines active/inactive lifecycle and later phases require stable references.
- Egypt seed content is baseline platform catalog truth, not provider offering
  or pricing data.
- Provider selection of catalog services and provider-owned prices begin in
  R1-P09. Booking snapshot persistence begins only in its approved later phase.
- No frontend application is part of R1-P08.

## Dependencies and Boundaries

- **R1-P01 Configuration**: authoritative active-country and country-code facts.
- **R1-P03 Authentication/Admin Audit**: authenticated staff capabilities,
  privileged reason validation, and business-neutral audit recording.
- **R1-P04 Media**: file eligibility, processing, storage, and safe delivery.
- **R1-P07 Providers**: optional future Worker-skill mapping only; R1-P08 does
  not rewrite existing normalized Worker skill tags.
- **R1-P09 Providers**: future catalog selection and provider pricing consumer.
- **R1-P11 Eligibility / R1-P12 Browse / R1-P13 Bookings**: future consumers of
  current or snapshot-ready catalog public contracts.

## Explicitly Out of Scope

- Provider service enrollment, price amounts, minimum charges, duration, price
  history, approval, or provider-service lifecycle.
- Customer booking drafts, answers, service selection persistence, confirmed
  snapshots, availability matching, provider discovery, or orders.
- Date/time scheduling fields, answer uploads, conditional question graphs,
  executable expressions, or a generic form-builder/schema engine.
- Mapping or migrating existing Provider Worker skill tags.
- Free-form chat, payments, ledger, settlement, payout, rating, support,
  notification delivery, or admin behavior unrelated to Catalog.
- Frontend implementation, Docker, cloud, deployment, production configuration,
  production migration, or future-release behavior.

## Open Product Question Containment

- **OQ-002**: Cleaning-material responsibility remains unresolved. R1-P08 may
  store neutral localized requirements or notes, but it cannot infer, default,
  or enforce provider-supplied or customer-supplied materials.

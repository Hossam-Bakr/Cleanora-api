# Feature Specification: Provider Services, Pricing & Historical Snapshots

**Feature Branch**: `codex/r1-p09-provider-services-pricing-historical-snapshots`

**Created**: 2026-09-05

**Status**: Specified and clarified; implementation is present and under the
owner-authorized Codex review-and-fix pass. Technical evidence is recorded in
`implementation-evidence.md`; human phase-completion approval remains separate.

**Input**: Allow approved Providers to select currently selectable Catalog
services for their country, configure server-authoritative decimal-safe prices,
retain price and status history, make `servicesReady` meaningful, and expose
copy-ready current facts for a later Booking phase without implementing Browse,
Booking persistence, or client-calculated totals.

## Context and Product Boundary

R1-P09 turns Catalog services into Provider-specific offerings. Catalog remains
the authority for the service definition, localized content, country
availability, and allowed price units. Providers owns each Provider's offering,
current effective price, service notes, estimated duration, status and price
history, approval state when configured, and the `servicesReady` contribution.

This phase prepares reliable current facts that later Browse and Booking phases
can consume. It does not publish anonymous or customer Browse behavior, create a
booking, accept customer answers, calculate a booking total, or persist a
booking snapshot. Any monetary total supplied by a client is non-authoritative
and must be rejected wherever it appears in an R1-P09 command.

## Clarifications

### Session 2026-09-05

- Q: Which Provider membership levels may view and manage Provider-service offerings for their exact Provider? → A: Active OWNER and ADMIN members may both list, read, create, edit, enable, and disable offerings for their exact Provider; ownership and membership administration remain OWNER-only.
- Q: How is optional Provider-price approval configured and applied? → A: Approval is configured per country, active staff_admin is the sole approver, an initial pending price is not effective, an approved price remains effective while its replacement is pending or rejected, approval atomically replaces it, and Provider OWNER/ADMIN disablement never requires price approval.
- Q: What currency, decimal, minimum-charge, maximum, and duration rules govern an offering? → A: Currency is the Provider country's active default currency; plain decimal strings use that currency's configured scale with no silent rounding; price and minimum charge are positive, minimum charge is at least the price, both are bounded by a required country setting, and duration is a whole number of minutes from 1 through 1440.
- Q: Which price submissions enter history, how are pending replacements handled, and which version serializes concurrent changes? → A: Every authorized and valid accepted proposal is retained with all later state transitions; invalid, unauthorized, stale, or idempotency-conflicting attempts do not enter price history; one Provider Service aggregate version guards every mutation; a newer accepted proposal supersedes an older pending proposal; and approval-disabled scopes activate the new price immediately while superseding the preceding effective price.
- Q: What makes servicesReady true, how do later Catalog changes affect an offering, how are notes localized, and what exact snapshot-ready facts are exposed? → A: At least one currently usable enabled offering is required; later Catalog unavailability makes it temporarily unusable without deleting or changing Provider state/history and restoration requalifies it automatically; optional notes must be a complete 1–1000-character AR/EN pair with exact-locale reads; and the internal reader returns one consistent current Provider/offering/effective-price/full Catalog-definition value or a safe unavailable/conflict outcome without Booking persistence.

### Actors

- **Provider Owner**: the active OWNER member for the exact approved Provider;
  may view and manage that Provider's offerings and retains all existing
  ownership and membership-administration authority.
- **Provider Admin**: an active ADMIN member for the exact approved Provider;
  may view and manage that Provider's offerings but gains no ownership or
  membership-administration authority.
- **Staff Approver**: an active `staff_admin` who may decide Provider-price
  proposals only for countries whose current configuration requires approval.
- **Internal Consumer**: a later authorized Cleanora module that reads safe
  current Provider-offering facts through the Providers-owned contract.

## User Scenarios & Testing

### User Story 1 - Configure a Provider Offering (Priority: P1)

An authorized member of an approved Provider selects a currently selectable
Catalog service for that Provider's country and configures the smallest
complete offering: an allowed price unit, a decimal-safe price, a minimum
charge, an estimated duration, and service notes.

**Why this priority**: A Provider cannot offer a service or become service-ready
without a valid Provider-specific offering and authoritative price.

**Independent Test**: Use an approved Provider and one selectable Catalog
service to create and retrieve an offering, then prove that invalid Catalog
choices, invalid decimals, client totals, and cross-Provider access are denied
without partial state.

**Acceptance Scenarios**:

1. **Given** an approved Provider and a Catalog service that is active,
   complete, and available in the Provider's country, **when** an authorized
   member supplies a valid allowed price unit, price, minimum charge, estimated
   duration, and notes, **then** one disabled Provider-scoped offering is
   accepted at aggregate version 1 and returned with authoritative readiness
   facts; enablement remains a separate command.
2. **Given** a service that is inactive, incomplete, unavailable in the
   Provider's country, or uses a disallowed price unit, **when** creation is
   attempted, **then** the request fails deterministically and no offering,
   price, history, readiness, or audit state is partially changed.
3. **Given** an otherwise valid request containing a caller-computed subtotal,
   total, fee, discount, tax, or payable amount, **when** it is submitted,
   **then** the monetary input is rejected and never becomes authoritative.
4. **Given** an actor scoped to Provider A, **when** that actor attempts to
   create, read, or change Provider B's offering, **then** access fails closed
   without revealing Provider B's private management state.
5. **Given** two concurrent attempts to create the same Provider/service
   offering, **when** both are processed, **then** at most one offering identity
   is created and the loser receives a stable conflict outcome.

---

### User Story 2 - Maintain Effective Price and Offering Status (Priority: P2)

An authorized Provider member changes the commercial configuration or enables
or disables an existing offering while Cleanora preserves a complete,
chronological account of accepted price and status changes.

**Why this priority**: Current price correctness is useful only when changes are
conflict-safe, disablement is reliable, and historical commercial truth is not
silently overwritten.

**Independent Test**: Starting from one configured offering, update price
details, enable and disable it, retry commands, race two writers, and confirm
that current truth and immutable history agree after every accepted outcome.

**Acceptance Scenarios**:

1. **Given** an existing offering and its current version, **when** an
   authorized actor submits a valid commercial change, **then** the accepted
   current state and its price history reflect the same actor, time, reason,
   version, and before/after commercial facts.
2. **Given** an enabled offering, **when** an authorized actor disables it with
   the required command facts, **then** it is excluded from safe current
   selection, a status-history entry is retained, and prior price history is
   unchanged.
3. **Given** a disabled but otherwise valid offering, **when** it is enabled,
   **then** it becomes effective only if every current Catalog, price, and
   approval condition is satisfied.
4. **Given** a stale expected version, **when** a mutation is attempted, **then**
   it fails without changing the offering, effective price, histories,
   readiness, or audit evidence.
5. **Given** the same command is retried with the same idempotency identity and
   identical content, **when** the retry is processed, **then** the original
   safe result is returned without duplicate current state or history.
6. **Given** the same idempotency identity is reused with different content,
   **when** it is processed, **then** it fails as a conflict and changes
   nothing.

---

### User Story 3 - Apply Configured Price Approval (Priority: P3)

Where Cleanora has an approved configuration requiring Provider price approval,
a permitted actor proposes a price and the designated Staff authority makes an
auditable decision without exposing an unapproved price as current truth.

**Why this priority**: The roadmap requires an approval rule when configured,
but the policy must remain dormant where it is not configured and must never
silently replace an effective approved price.

**Independent Test**: Exercise approval-disabled and approval-required scopes,
including initial price, replacement price, approval, rejection, stale Staff
decisions, retries, and continued use of the correct effective price.

**Acceptance Scenarios**:

1. **Given** a scope where approval is not required, **when** a valid price is
   accepted, **then** it becomes effective according to the clarified price
   transition rule without a Staff decision.
2. **Given** a scope where approval is required, **when** a valid price is
   proposed, **then** its pending state is distinguishable from the current
   effective price and is unavailable to safe current consumers.
3. **Given** a pending price proposal, **when** the designated Staff authority
   approves it with valid reason, version, and retry facts, **then** it becomes
   the effective price atomically and the decision is auditable.
4. **Given** a pending price proposal, **when** the designated Staff authority
   rejects it, **then** it never becomes effective and the correct preceding
   effective truth is preserved according to the clarified policy.
5. **Given** an unauthorized, stale, duplicate, or cross-scope approval
   attempt, **when** it is processed, **then** it fails safely without altering
   current price, proposal, history, readiness, or audit truth.

---

### User Story 4 - Supply Readiness and Snapshot-Ready Facts (Priority: P4)

Cleanora can determine whether the Provider has usable service configuration
and can provide a later authorized consumer with one internally consistent,
localized, country-scoped copy of the current Provider offering, Catalog
definition, and effective price facts.

**Why this priority**: Provider readiness and later confirmed-booking snapshots
must be based on server-authoritative current truth without moving ownership of
Catalog data or creating Booking data early.

**Independent Test**: Read readiness and snapshot-ready facts across configured,
disabled, pending-approval, stale-Catalog, wrong-country, and exact-locale cases,
then prove that no Booking persistence or anonymous HTTP behavior exists.

**Acceptance Scenarios**:

1. **Given** a Provider with the clarified minimum set of usable offerings,
   **when** readiness is evaluated, **then** `servicesReady` is satisfied and
   the other readiness gates and `eligibleForPublicBrowse=false` remain under
   their existing owners.
2. **Given** no usable offering, **when** readiness is evaluated, **then**
   `servicesReady` is not satisfied and stable blocker facts explain why
   without exposing private management or approval metadata.
3. **Given** a usable offering and exact supported locale/country input,
   **when** an authorized internal consumer requests snapshot-ready facts,
   **then** the result contains a mutually consistent Provider offering,
   current effective price, and current Catalog definition suitable for the
   consumer to copy later.
4. **Given** a disabled offering, a non-effective price, or Catalog truth that
   is no longer selectable for the requested country and locale, **when** the
   safe current contract is read, **then** it returns a deterministic
   unavailable outcome and does not leak draft or approval detail.
5. **Given** Catalog or Provider truth changes during a snapshot-ready read,
   **when** consistency cannot be guaranteed, **then** the operation fails or
   retries deterministically rather than returning a mixed-version result.

### Edge Cases

- A Provider tries to select the same Catalog service twice.
- A Catalog service is selectable when an offering is created but becomes
  inactive, incomplete, or unavailable in the Provider's country later.
- An allowed Catalog price unit is deactivated after it is referenced by an
  existing offering.
- The Provider's configured country changes after offerings exist.
- Decimal input uses exponent notation, signs, extra scale, locale separators,
  leading or trailing whitespace, or a numerically equivalent alternate form.
- Price or minimum-charge input is zero, negative, exceeds the accepted bound,
  or violates the clarified relationship between the two values.
- Estimated duration is missing, zero, negative, fractional, or exceeds the
  accepted business bound.
- Notes are blank after trimming, exceed the accepted limit, omit a required
  locale, or attempt to encode an unapproved materials-supply rule.
- Two actors update the same offering, price proposal, or status from the same
  starting version.
- A retried command arrives after a newer accepted mutation.
- Approval configuration changes while a proposal is pending.
- A disabled offering has a still-valid historical price.
- A rejected or superseded price is requested as current truth.
- A suspended Provider manages configuration under its existing remediation
  rights but remains ineligible for public Browse.
- A snapshot-ready read receives an unsupported locale, wrong country,
  inactive Provider, or Catalog/Provider version drift.

## Requirements

### Functional Requirements

#### Ownership, scope, and Catalog authority

- **FR-001**: The system MUST allow only an approved Provider to hold
  Provider-service offerings.
- **FR-002**: Each offering MUST belong to exactly one Provider and reference
  exactly one Catalog service; a Provider MUST have at most one offering for
  the same Catalog service.
- **FR-003**: Creation and enablement MUST use the Catalog's current selectable
  definition for the Provider's authoritative country and MUST reject inactive,
  incomplete, wrong-country, or otherwise unavailable services.
- **FR-004**: A Provider price unit MUST be one of the active units allowed by
  the referenced Catalog service.
- **FR-005**: Catalog MUST remain authoritative for service definition,
  localization, country availability, price units, fields, options, and media;
  Provider behavior MUST NOT create competing mutable copies of that truth.
- **FR-006**: Providers MUST remain authoritative for Provider offerings,
  Provider prices, minimum charges, estimated durations, service notes,
  offering status, histories, applicable approval state, and `servicesReady`.

#### Authorization and isolation

- **FR-007**: Provider-service reads and mutations MUST enforce active identity,
  required global capability, and active membership for the exact Provider;
  caller-supplied actor or Provider scope MUST NOT be authoritative.
- **FR-008**: Active OWNER and ADMIN members MAY both list, read, create, edit,
  enable, and disable offerings for their exact Provider, subject to the same
  trusted-identity, global-capability, Provider-state, version, idempotency,
  and audit checks; this authority MUST NOT grant an ADMIN ownership transfer
  or membership-administration powers.
- **FR-009**: Cross-Provider access MUST fail closed and MUST NOT reveal another
  Provider's private offering, pending price, notes, history, or approval data.
- **FR-010**: R1-P09 MUST NOT introduce anonymous or customer Provider-service
  management, Browse, or Provider Details behavior.

#### Offering configuration and monetary authority

- **FR-011**: An accepted offering configuration MUST include an allowed price
  unit, Provider price, minimum charge, estimated duration, and a valid service-
  note state: either no notes or the complete localized pair defined by FR-017.
- **FR-012**: The authoritative currency MUST be the active default currency of
  the Provider's authoritative country. A caller MUST NOT select or override
  currency. Provider price and minimum charge MUST both be greater than zero,
  minimum charge MUST be greater than or equal to the Provider price, and both
  MUST be less than or equal to the required country-configured Provider-
  service price maximum. A missing, inactive, or invalid country, currency, or
  maximum-price configuration MUST fail closed.
- **FR-013**: Every authoritative monetary value MUST enter and leave as a
  canonical plain decimal string using the authoritative currency's configured
  decimal places. Exponent notation, grouping separators, explicit plus signs,
  non-canonical syntax, and precision beyond the configured scale MUST be
  rejected; accepted input MAY be normalized by appending required trailing
  zeros, but MUST never be silently rounded or processed with binary floating-
  point arithmetic.
- **FR-014**: R1-P09 commands MUST reject caller-supplied subtotals, totals,
  taxes, fees, discounts, commissions, deposits, or payable amounts.
- **FR-015**: Estimated duration MUST be expressed as a whole number of minutes
  from 1 through 1440 inclusive and MUST never represent Provider capacity or
  availability.
- **FR-016**: Service notes MUST preserve Provider-provided requirements while
  remaining neutral on OQ-002; they MUST NOT enforce a universal rule about who
  supplies cleaning materials.
- **FR-017**: Service notes MAY be omitted. If either localized note is supplied,
  both Arabic and English notes MUST be present, contain 1 through 1000
  characters after trimming, and remain management-visible as a pair. A safe
  localized consumer receives only the exact requested-locale note or `null`
  when the pair is omitted; locale fallback is prohibited.

#### Current state, status, history, and concurrency

- **FR-018**: The system MUST maintain one authoritative current offering state
  and distinguish enabled from disabled offerings. A newly created offering
  MUST start disabled at aggregate version 1; enablement MUST be a separate
  versioned and idempotent command.
- **FR-019**: An offering MUST NOT become enabled without a selectable Catalog
  service, compatible active price unit, valid effective price configuration,
  and any required approval.
- **FR-020**: Disabling an offering MUST make it unavailable to safe current
  consumers without deleting its price or status history. A later Catalog
  service, country-availability, or price-unit deactivation MUST make an
  affected enabled offering temporarily unusable without rewriting its
  Provider-controlled enabled state or appending a false Provider status
  transition; restoration of the same qualifying Catalog truth MUST
  automatically make the unchanged offering usable again when every other
  condition remains satisfied.
- **FR-021**: Accepted price changes MUST preserve append-only chronological
  price history; accepted enable/disable changes MUST preserve append-only
  chronological status history. The Provider Service Status History entity MAY
  also retain internal creation/configuration command-receipt evidence required
  for durable idempotency, but those rows MUST remain phase-specific and MUST
  NOT be represented or returned as enable/disable transitions.
- **FR-022**: History MUST identify the Provider and offering, event, safe
  before/after facts, actor, time, reason when required, request correlation,
  and resulting version without storing secrets or private contacts. Provider
  price-proposal and enable/disable commands MUST supply a trimmed reason of 1
  through 1000 characters; creation and configuration use stable system action
  codes without soliciting free text, and Staff-decision reasons follow FR-031.
- **FR-023**: Every price proposal that passes authorization, validation,
  expected-version, and idempotency checks MUST be accepted as a retained
  Provider Service Price and MUST produce append-only price-history evidence
  for creation and every later pending, effective, approved, rejected, or
  superseded transition. Invalid, unauthorized, stale, or idempotency-
  conflicting attempts MUST NOT enter price history.
- **FR-024**: One Provider Service aggregate version MUST serialize offering,
  configuration, price-proposal, enable/disable, and Staff price-decision
  mutations. Every such command MUST provide the current expected aggregate
  version; each accepted mutation increments it exactly once, and stale writers
  fail without partial change.
- **FR-025**: Replay-sensitive mutations MUST be idempotent; identical retries
  return the original safe outcome and key reuse with different content fails.
  Durable receipts MUST use the authorized Provider Service Price History or
  Provider Service Status History rows and MUST NOT introduce a fifth command
  or workflow entity.
- **FR-026**: Each accepted mutation MUST atomically align current state,
  append-only history, readiness effects, and required audit evidence. At most
  one pending price proposal MAY exist for an offering; a newer authorized,
  valid, accepted proposal MUST atomically supersede the preceding pending
  proposal. Where country approval is disabled, the accepted proposal becomes
  effective immediately and atomically supersedes the preceding effective
  price.
- **FR-027**: Hard deletion of Provider offerings, current-price truth, price
  history, and status history MUST NOT be introduced in R1-P09.

#### Configurable approval

- **FR-028**: Price approval MUST be enabled or disabled by the authoritative
  configuration for the Provider's country; when enabled, only an active
  `staff_admin` may approve or reject a pending Provider-price proposal.
- **FR-029**: Where approval is not configured, the approval workflow MUST stay
  dormant and MUST NOT manufacture Staff work or hidden pending state; an
  accepted valid price follows the clarified effective-price transition rule.
- **FR-030**: Where approval is configured, no pending, rejected, or superseded
  price MUST be exposed as the current effective price. An initial proposal has
  no effective price until approval and therefore cannot support enablement or
  `servicesReady`. While a replacement is pending, the preceding approved
  price remains effective; rejection preserves it, and approval atomically
  replaces it and supersedes the preceding effective price. A later approval-
  policy change MUST NOT auto-transition an existing price: enabling approval
  affects later proposals, while disabling it creates no new Staff work and
  does not auto-activate an older pending amount. A later valid Provider
  proposal under the disabled policy supersedes any older pending proposal and
  follows the normal immediate-effective rule; a fresh Staff decision is
  permitted only while current country policy requires approval.
- **FR-031**: Staff approval actions MUST require an active `staff_admin`, a
  permitted reason, current expected version, idempotency, and atomic
  privileged audit evidence.
- **FR-032**: Provider management projections MUST distinguish current
  effective commercial truth from pending or rejected proposals without
  exposing privileged internal audit metadata. OWNER or ADMIN disablement MUST
  take effect without price approval and retain status history and audit
  evidence; subsequent enablement requires a still-valid current effective
  price and all current Catalog conditions but does not create a new price-
  approval decision.

#### Readiness and internal snapshot-ready facts

- **FR-033**: `servicesReady` MUST be satisfied when an approved Provider has at
  least one currently usable offering: Provider-enabled, currently selectable
  for the Provider's country, using a currently allowed active price unit, with
  a valid current effective price, configured currency and maximum, valid
  estimated duration, and either no notes or a complete valid AR/EN note pair.
  It MUST NOT calculate coverage, scheduling availability, capacity,
  operational LIVE state, or final public eligibility.
- **FR-034**: `eligibleForPublicBrowse` MUST remain false throughout R1-P09.
- **FR-035**: When no usable offering exists, readiness MUST expose only the
  applicable stable blocker codes `NO_PROVIDER_SERVICES`,
  `NO_ENABLED_PROVIDER_SERVICE`, `CATALOG_SERVICE_UNAVAILABLE`,
  `PRICE_UNIT_UNAVAILABLE`, `NO_EFFECTIVE_PRICE`,
  `PRICE_APPROVAL_PENDING`, or `OFFERING_CONFIGURATION_INVALID`, and MUST
  update consistently after offering, price, approval, configuration, or
  Catalog-selectability changes are observed.
- **FR-036**: Providers MUST expose a narrow internal current-facts contract for
  a later authorized Booking consumer to copy into its own persisted snapshot.
  The input MUST be Provider ID, Catalog service code, country code, and exact
  supported locale.
- **FR-037**: The internal contract MUST return only a currently usable enabled
  offering with: Provider ID; Provider Service ID and aggregate version;
  Catalog service ID, code, and version; estimated duration minutes; the exact-
  locale service note or `null`; Provider Service Price ID; canonical price and
  minimum-charge strings; currency code; effective-at time; the selected price-
  unit ID, code, and exact-locale label; and the complete exact-locale,
  country-scoped current Catalog snapshot-ready definition including category,
  fields, options, and media references.
- **FR-038**: Snapshot-ready output MUST contain no raw persistence records,
  private Provider contacts, secrets, internal database data, pending/rejected/
  superseded price values, Staff reason text, or hidden approval metadata. A
  disabled or currently unusable offering MUST produce one safe unavailable
  outcome without distinguishing private management causes.
- **FR-039**: A snapshot-ready read MUST provide one mutually consistent view or
  a deterministic unavailable/conflict outcome. If Catalog, offering, or price
  truth changes during the read, the operation MUST retry within a bounded
  policy or fail with a stable conflict outcome; it MUST NOT return mixed
  versions.
- **FR-040**: R1-P09 MUST NOT create Booking records, customer answers, booking
  price breakdowns, booking snapshot persistence, or Booking HTTP operations.

#### Audit, errors, and phase boundaries

- **FR-041**: Every Provider-service mutation and Staff decision MUST produce
  safe audit evidence with actor, action, target, time, reason when applicable,
  request correlation, and safe before/after facts.
- **FR-042**: Failure outcomes MUST distinguish validation, authorization,
  Provider state, Catalog unavailability, approval state, stale version,
  idempotency conflict, and unexpected dependency failure without leaking
  internal details.
- **FR-043**: All rejected operations MUST be atomic and leave current state,
  history, readiness, and audit truth unchanged except for separately approved
  denial/security evidence.
- **FR-044**: R1-P09 MUST introduce only the four roadmap entities: Provider
  Service, Provider Service Price, Provider Service Price History, and Provider
  Service Status History.
- **FR-045**: The phase MUST extend the existing Providers capability and MUST
  NOT create a Pricing, Offerings, ProviderServices, Booking, Browse, generic
  Workflow, generic approval, or generic state-machine capability.
- **FR-046**: No Provider offerings or Provider-specific prices MUST be created
  as production seed data.

### Key Entities

- **Provider Service**: The Provider-owned current offering linking one approved
  Provider to one Catalog service, with enablement, notes, estimated duration,
  current-state version, and current-price relationship.
- **Provider Service Price**: A retained Provider-owned commercial proposal
  associated with one offering, including allowed Catalog price unit,
  authoritative currency, decimal-safe Provider price, minimum charge, state,
  and its relationship to current effective or pending truth. Its commercial
  values are not overwritten by a later proposal.
- **Provider Service Price History**: Append-only evidence of accepted price or
  price-proposal creation and every later accepted state transition; rejected
  and superseded accepted proposals remain visible to authorized management
  history readers.
- **Provider Service Status History**: Append-only evidence of accepted offering
  enable/disable transitions and their actor, time, reason, and version facts.
  It may also carry internal, non-status creation/configuration receipt rows so
  late idempotent retries remain durable without a fifth table; management
  status history exposes only real enable/disable transitions.

## In Scope

- Protected management of Provider-specific Catalog-service offerings.
- Decimal-safe current Provider price and minimum-charge truth.
- Estimated duration and service notes that remain neutral on OQ-002.
- Enable/disable behavior, optimistic concurrency, idempotency, and audit.
- Configured price approval only as resolved by the human owner.
- Append-only price and offering-status history.
- The R1-P09 `servicesReady` contribution and blocker facts.
- A Providers-owned internal current-facts contract suitable for a later
  Booking owner to copy.
- Planning for one additive, forward-only R1-P09 migration and its evidence.

## Out of Scope

- Catalog management or direct access to Catalog-owned persistence.
- Anonymous/customer Browse, Provider Details, or public presentation.
- Eligibility, coverage, schedules, holidays, availability, or capacity.
- Booking drafts or confirmations, customer field answers, orders, assignments,
  or any Booking-owned table or snapshot.
- Payments, deposits, taxes, discounts, coupons, commissions, payouts, currency
  conversion, additional charges, or stored-value wallets.
- Dynamic, negotiated, surge, formula, tiered, package, recurring, or
  subscription pricing.
- A pricing engine, rules language, reusable approval engine, event sourcing,
  CQRS, event bus, cache, queue, worker, cron job, or new external service.
- Frontend, Docker, cloud, deployment, production configuration, production
  migration, and every future phase.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In 100% of accepted offering-creation scenarios, exactly one
  Provider/service offering exists and its returned price unit is allowed by
  the current Catalog definition for that Provider's country.
- **SC-002**: In 100% of tested invalid Catalog, country, unit, decimal,
  duration, notes, and caller-total scenarios, no partial offering, price,
  history, readiness, or audit mutation occurs.
- **SC-003**: In 100% of tested cross-Provider and unauthorized scenarios, the
  operation fails closed and reveals no other Provider's private management or
  approval facts.
- **SC-004**: Every accepted price-changing operation produces exactly the
  clarified current-price outcome and the required append-only chronological
  price-history evidence.
- **SC-005**: Every accepted enable/disable operation produces exactly one
  status transition and append-only status-history entry; retries never create
  duplicates.
- **SC-006**: In two-writer tests, no stale command overwrites a newer accepted
  offering, price, proposal, or approval decision.
- **SC-007**: Every authoritative monetary value round-trips in canonical
  decimal form with no binary floating-point drift across supported boundary
  and persistence scenarios.
- **SC-008**: In every approval-required scenario, only the correct effective
  approved price is returned to safe current consumers; pending, rejected, and
  superseded values are never substituted.
- **SC-009**: `servicesReady` is satisfied in every clarified qualifying case,
  is unsatisfied with stable blocker facts in every non-qualifying case, and
  never changes `eligibleForPublicBrowse` from false.
- **SC-010**: Every successful snapshot-ready read returns one internally
  consistent Provider/Catalog/effective-price view for the requested country
  and exact locale; every unavailable or mixed-version case fails
  deterministically.
- **SC-011**: All four R1-P09 entity families have one Providers owner, no
  competing Catalog or Booking ownership, and no hard-delete path for history.
- **SC-012**: Every functional requirement and buildable success criterion maps
  to at least one independently verifiable implementation task before
  implementation authorization.

## Assumptions and Dependencies

- R1-P08 is Complete and the current Catalog reader supplies exact-locale,
  country-selectable, snapshot-ready definitions.
- R1-P05's approved Provider identity, membership, remediation access, and
  structured readiness model remain authoritative.
- Existing Authentication and Admin capabilities remain the owners of trusted
  identity/permissions and privileged audit persistence respectively.
- OQ-002 remains unresolved; notes are preserved without structured materials
  enforcement. OQ-004 remains unresolved and no post-start additional-charge
  behavior is introduced.
- A later Booking phase owns persisted booking snapshots and server-calculated
  booking totals; R1-P09 provides current copy-ready facts only.
- Product decisions explicitly marked for clarification are not assumptions and
  block planning until accepted by the human owner.

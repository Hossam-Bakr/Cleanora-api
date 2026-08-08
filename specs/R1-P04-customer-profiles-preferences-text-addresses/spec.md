# Feature Specification: R1-P04 — Customer Profiles, Preferences & Text Addresses

**Feature Branch**: No branch created; specification preparation only

**Created**: 2026-08-05

**Status**: Specification preparation complete and frozen — independent
specification re-review `PASS` with no BLOCKER, MAJOR, or MINOR finding and no
owner product decision remaining open. Owner **DEC-030** (2026-08-07) supersedes
the prior authorization-provisioning blocker and any earlier requirement that
customer self-service hold an explicit R1-P04 permission or
`resource.self.read`/`resource.self.write` grant. R1-P04 does **not** require
customer-role grants from R1-P03A. Customer self-service authorizes directly from
trusted `AuthenticationPrincipal` facts plus `SELF` ownership and the category
eligibility rules below. A historical `customer` user-role grant does not affect
eligibility. R1-P03A is Complete. As of `2026-08-07`, R1-P04 is the sole active
phase for **technical planning only**; this specification text remains the
authoritative product contract and is not being rewritten.

**Input**: User description: "Prepare the R1-P04 business specification for individual, company, and engineer customer profiles, profile image, contact display and verification state, language and notification preferences, customer-owned text addresses, account-deactivation and account-deletion requests, and data-export foundation, with explicit ownership, authorization, privacy, audit, boundaries, and measurable acceptance."

**Activation**: R1-P04 was activated on 2026-08-05 for specification preparation
only, paused during R1-P03A, and reactivated on 2026-08-07 for technical
planning only (`activation.md`). The approved specification does not authorize
tasks, implementation, schema or migration work, changes to applied migrations
or completed authentication contracts, Git actions, deployment, or production
database actions until separately authorized after planning review.

## Scope and Canonical Basis

### In scope

- Self-service customer profiles for verified `individual`, `company`,
  and `engineer` customer categories
- A protected profile image with safe replacement and removal behavior
- Read-only display of the authenticated identity's phone, email, and
  authoritative verification state
- Arabic/English language preference and a notification-preference foundation
- Customer-owned text-address management using country, city, district,
  address text, building, floor, and notes
- Customer-owned account-deactivation, account-deletion, and data-export
  request foundations
- Deny-by-default authorization, self-ownership, privacy, redaction, and audit
  expectations for every new operation

### Out of scope

- Coordinates, latitude/longitude, map pins, maps, geocoding, zones, radius,
  distance, coverage geometry, or any other geospatial dependency
- Provider-owner profiles, provider onboarding, provider verification,
  provider lifecycle, provider documents, worker management, teams, or any
  R1-P05 behavior
- Individual birth date or gender, company trade name, registration or tax
  identifiers, engineer discipline or license identifiers, profile biographies,
  or other unapproved identity, verification, or onboarding fields
- Changing phone or email identifiers, proving phone ownership, sending
  verification challenges, or changing any existing authentication request,
  response, route, session, cookie, token, account-state, or frontend contract
- Booking creation, booking address snapshots, provider coverage matching, or
  notification delivery and templates from later phases
- Staff profile-management, privacy-case processing, or privileged customer-data
  access surfaces
- Changing account status, deactivating or reactivating an identity, revoking
  sessions because of a request, deleting or anonymizing customer data,
  generating an export archive, or delivering an export file
- Technical planning, implementation, schema changes, migrations, seeds,
  backfills, commits, pushes, merges, deployments, or production data actions

### Canonical rules carried forward

- All three supported customer types use one identity system and the CUSTOMER
  role concept; a user may hold multiple categories over time.
- R1-P02 remains authoritative for identity, normalized phone/email values,
  category verification, account state, and sessions.
- DEC-028 makes email the existing verification and recovery channel and
  defers real phone ownership verification to R1-P26. A stored phone value
  must not be presented as verified without authoritative evidence.
- DEC-004 excludes maps and geospatial behavior from Release 1.
- Customer-facing localized content supports Arabic and English.
- The backend is authoritative, sensitive actions are auditable, media uses
  protected storage, and no unresolved product rule may be invented.
- R1-P03 requires new business operations to declare deny-by-default
  permission and ownership rules while leaving completed authentication
  endpoints unchanged.

## Clarifications

### Session 2026-08-05

- Q: Which complete profile-field and image-association model should R1-P04
  adopt? → A: Option A — Individual requires full name; Company requires
  company name and representative full name; Engineer requires full name and
  professional title. Required text is trimmed and non-blank. One optional
  identity-wide profile image is shared across customer categories. All fields
  are owner-private; phone and email remain separate read-only identity facts.

- Q: Which notification preference policy should R1-P04 adopt? → A: Option A
  — SMS and push are the configurable customer channels. Account
  security/verification and active-service operational notices are mandatory
  and cannot be disabled; authentication email remains governed by R1-P02.
  Service reminders and promotional messages are optional, default off, and
  may be enabled per channel. Every new optional category defaults off.

- Q: What privacy-operation scope boundary should R1-P04 adopt? → A: Option A
  — Deactivation, deletion, and data export are request-only foundations.
  Customers may submit and track owned requests, but R1-P04 does not change
  account status, delete data, or generate an export file. Later authorized
  privacy operations own processing and fulfillment.

- Q: Which privacy-request lifecycle and concurrency model should R1-P04
  adopt? → A: Option A — States are PENDING, PROCESSING, COMPLETED, REJECTED,
  and CANCELLED. One active request per identity and purpose is allowed, and a
  repeat returns the existing request. Customers may cancel only PENDING
  requests. Different purposes may coexist without supersession. Only a later
  authorized processor may start processing or set completed/rejected
  outcomes. Customers see status and timestamps, with no R1-P04 completion
  deadline.

### Session 2026-08-06

- Q: Which request-retention and processor-ownership policy should close
  R1-P04? → A: Option A — R1-P04 retains request-record and lifecycle
  ownership. Later privacy processors use an explicit contract while identity
  and business modules retain their own data ownership. Requests store only
  identifiers, purpose, state, applicable timestamps, processor ID, and a
  standardized outcome/reason code—no free-form rationale or export content.
  Active requests remain until terminal. Terminal requests remain
  customer-visible for a required owner-approved retention period with no
  default, then operational metadata is purged while separately governed
  redacted audit evidence remains.

- Q: What identity and category eligibility rule should govern every R1-P04
  customer operation? → A: Option B — Every R1-P04 customer operation requires
  an active identity with at least one verified supported customer category.
  Category-specific profiles additionally require that matching category to be
  verified. Pending-only, suspended, banned, and deactivated identities receive
  no R1-P04 access. A multi-category identity may use identity-wide operations
  when another supported category is verified, while its pending category
  remains unavailable.

- Q: When an identity or customer category loses R1-P04 eligibility after data
  already exists, what should happen to that data? → A: Option A — Existing
  R1-P04 data remains unchanged but inaccessible while the identity or relevant
  category is ineligible. Access automatically returns if eligibility is
  restored. Only a later authorized privacy processor may delete or anonymize
  the data.

- Q: Should R1-P04 support a default or primary address within the customer's
  address book? → A: Option A — R1-P04 has no default or primary address. All
  saved addresses are peers, and later consumers must require explicit customer
  selection unless a future approved rule defines otherwise.

- Q: Which privacy-processor claim, reassignment, and resolution policy should
  R1-P04 adopt? → A: Option A — A PENDING to PROCESSING claim is exclusive and
  atomic and records claimant processor ID and processing timestamp together.
  Only the recorded claimant may resolve the request. Repeated claimant claims
  are idempotent; competing claims receive a stable conflict. Privileged
  reassignment is allowed only while PROCESSING through the explicit audited
  R1-P04 contract, by an actor holding the dedicated R1-P03 permission and an
  approved reason; it atomically replaces claimant ID and processing timestamp
  and preserves before/after audit evidence. It introduces no staff UI or
  privacy processor in R1-P04. Stale work never automatically returns to
  PENDING. COMPLETED and REJECTED are legal only from PROCESSING, terminal
  transitions require a timestamp and standardized outcome/reason code, and
  every terminal state is immutable.

- Q: Which technology-agnostic acceptance workload should define SC-008's
  two-second target? → A: Option A — Measure exactly 1,000 completed
  interactions during a 10-minute steady-state window with exactly 25
  concurrent automated execution lanes. The mix is 20% profile operations, 15%
  contact-state reads, 15% preference operations, 30% address operations, and
  20% privacy-request operations, with representative successful and safe-
  failure outcomes.
  Protected-media byte transfer is excluded, but R1-P04 media authorization and
  association results are included. SMS/push delivery and unavailable future-
  provider latency are excluded. At least 95% must complete within two seconds.

- Q: Which deterministic operation/outcome distribution should SC-008 use
  inside its approved workload classes? → A: Option A — Use the exact matrix
  now encoded in SC-008: profile 50/70/20/30/30; contact state 90/30/30;
  preferences 45/60/30/15; addresses 60/60/60/30/45/45; and customer privacy
  requests 50/50/30/20/25/25. Complete all setup outside measurement and
  measure only customer-facing R1-P04 interactions, not future processor
  execution.

- Q: Which repeatable participant cohort and starting condition should SC-005
  use? → A: Option A — Use 20 eligible participants: five Individual-only,
  five Company-only, five Engineer-only, and five with at least two verified
  supported categories. Each begins authenticated, with no applicable R1-P04
  profile, no explicit language preference, and an empty address book. At
  least 19 of 20 must create the applicable profile, select Arabic or English,
  and save one valid text address correctly within five minutes without
  assistance.

- Q: Which leaf-level operation and outcome matrix should make SC-008 fully
  repeatable? → A: Option A — Use the exact balanced leaf counts now encoded in
  SC-008 for profile, contact-state, preference, address, and customer privacy-
  request interactions while preserving the approved 1,000 total, 10-minute
  window, exactly 25 concurrent automated execution lanes, exclusions, and 95%
  under two seconds target.

- Q: Which execution-lane and scenario-manifest model should make SC-008's
  approved workload coherent? → A: Option A — Use exactly 25 concurrent
  automated execution lanes, not 25 eligible customer identities. Each lane
  executes exactly 40 interactions during the 10-minute window, totaling
  exactly 1,000. Before measurement, prepare one canonical 1,000-row scenario
  manifest from the approved SC-008 leaf matrix. Every row fixes caller
  context, target ownership, operation, expected outcome, execution lane, and
  measurement slot. Caller context is the eligible authenticated owner,
  eligible wrong-owner, category-ineligible, permission-denied, ineligible
  customer, or unauthenticated context required by that approved leaf. All
  identities, states, permissions, ownership relations, fixtures, and
  assignments are prepared outside measurement and remain unchanged during
  measurement. Repeated acceptance runs use the same canonical manifest and
  lane assignment. All approved leaf counts, exclusions, and the 95%-within-
  two-seconds target remain unchanged.

- Q: Which exact category holdings and single applicable-profile assignment
  should SC-005 use for all 20 participants? → A: Option A — P01–P05 are
  Individual-only and create Individual profiles; P06–P10 are Company-only and
  create Company profiles; P11–P15 are Engineer-only and create Engineer
  profiles; P16 holds Individual+Company and creates Individual; P17 holds
  Individual+Company and creates Company; P18 holds Individual+Engineer and
  creates Engineer; P19 holds Company+Engineer and creates Company; and P20
  holds Individual+Company+Engineer and creates Engineer. Each participant
  creates exactly the assigned single applicable profile during measurement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage the correct customer profile (Priority: P1)

As an authenticated customer, I need to view and maintain the profile for each
verified customer category I hold so that Cleanora has the correct
identity-adjacent information without changing my authentication identity.

**Why this priority**: Valid profiles for all three customer types are the
phase's primary outcome and a prerequisite for later customer journeys.

**Independent Test**: Use accounts with individual-only, company-only,
engineer-only, multiple verified categories, and a pending category; exercise
profile creation, viewing, editing, missing or blank required text, image
replacement, and image removal while checking category eligibility, field
isolation, the shared-image rule, privacy, and the frozen identity contract.

**Acceptance Scenarios**:

1. **Given** an active authenticated user with a verified individual category,
   **When** the user supplies a non-blank full name, **Then** only that user's
   owner-private individual profile changes and authentication identifiers and
   verification evidence remain unchanged.
2. **Given** an active authenticated user with a verified company category,
   **When** the user supplies a non-blank company name and representative full
   name, **Then** only that user's owner-private company profile changes without
   creating provider-onboarding or company-verification data.
3. **Given** an active authenticated user with a verified engineer category,
   **When** the user supplies a non-blank full name and professional title,
   **Then** only that user's owner-private engineer profile changes without
   creating provider-onboarding or professional-verification data.
4. **Given** one identity with two verified customer categories, **When** the
   user manages one category profile, **Then** the other category profile and
   shared identity facts do not change.
5. **Given** an enrolled but unverified category, **When** the user attempts to
   create or update that category's profile, **Then** the operation is denied
   without promoting or verifying the category.
6. **Given** a valid owned profile, **When** the user replaces or removes the
   profile image, **Then** the identity has one unambiguous optional image state
   shared by every customer category, and inaccessible or rejected media does
   not replace the prior state.

---

### User Story 2 - Maintain a customer-owned text address book (Priority: P1)

As an authenticated customer, I need to add, view, edit, and remove my textual
addresses so that later Release 1 booking can use a complete address without
maps or coordinates.

**Why this priority**: The roadmap Definition of Done requires usable Release 1
text addresses with enforced ownership.

**Independent Test**: Create multiple addresses for one eligible customer;
update and remove them; attempt the same operations as another customer; submit
missing, blank, unsupported-country, and geospatial input; and confirm that
only complete owned text addresses are accepted and none is designated or
inferred as a default or primary address.

**Acceptance Scenarios**:

1. **Given** an active authenticated customer, **When** the customer supplies
   a supported country plus non-blank city, district, and address text, with
   optional building, floor, and notes, **Then** an owned text address is
   available in that customer's address book.
2. **Given** an owned address, **When** its owner edits textual fields, **Then**
   the address changes as one consistent unit and retains the same owner.
3. **Given** an owned address, **When** its owner removes it, **Then** it is no
   longer selectable for future use and any future immutable business snapshot
   is not rewritten by that removal.
4. **Given** Customer A's address identifier, **When** Customer B attempts to
   view, edit, or remove it, **Then** access is denied without revealing the
   address contents or confirming more than the public failure semantics allow.
5. **Given** an address request containing coordinates, map data, zone data,
   radius, or another geospatial attribute, **When** it is evaluated, **Then**
   the geospatial input is not accepted as R1-P04 address data.
6. **Given** a customer has multiple saved addresses, **When** R1-P04 returns
   the address book or a later consumer requests an address, **Then** every
   saved address remains a peer and the consumer requires explicit customer
   selection unless a future approved rule defines otherwise.

---

### User Story 3 - Understand contact state and control preferences (Priority: P2)

As an authenticated customer, I need to see my current phone and email with
truthful verification labels and save language and notification preferences so
that my account experience reflects my choices without overstating identity
assurance.

**Why this priority**: Accurate assurance display protects trust, while
language and notification choices establish the customer preference foundation.

**Independent Test**: Use identities with verified email, unverified phone,
missing optional contact data, and multiple customer categories; read contact
state, switch Arabic/English preference, inspect first-use defaults, enable
optional notification choices per channel, attempt to disable mandatory
notices, and confirm that no identity or verification field changes.

**Acceptance Scenarios**:

1. **Given** an identity with a stored phone but no authoritative phone
   verification timestamp, **When** contact state is displayed, **Then** the
   phone is labeled unverified and no phone-ownership claim is made.
2. **Given** an identity with authoritative email verification evidence,
   **When** contact state is displayed, **Then** the email is labeled verified
   from the identity source of truth.
3. **Given** a customer selects Arabic or English, **When** the language
   preference is saved and read again, **Then** the explicit selection is
   preserved for that identity across its customer categories.
4. **Given** a new or existing customer has no explicit notification
   preferences, **When** the preference state is read, **Then** account
   security/verification and active-service operational notices remain
   mandatory while service reminders and promotional messages are off.
5. **Given** a customer enables service reminders or promotional messages for
   SMS, push, or both, **When** the preference set is saved, **Then** the
   accepted optional choices are returned consistently for that identity.
6. **Given** a customer attempts to disable an account security/verification
   or active-service operational notice, **When** the preference update is
   evaluated, **Then** the whole update is rejected and the prior preference
   state remains unchanged.
7. **Given** a request attempts to change contact values or verification state
   through this feature, **When** it is evaluated, **Then** it is rejected or
   ignored according to the public input contract and the identity remains
   unchanged.

---

### User Story 4 - Request deactivation, deletion, or data export safely (Priority: P2)

As an authenticated customer, I need a safe way to request account
deactivation, deletion, or data export so that privacy operations can be
tracked without exposing another customer's data or prematurely changing my
identity or data.

**Why this priority**: The roadmap requires these privacy foundations, while
identity changes, irreversible processing, and export fulfillment remain owned
by later explicitly authorized privacy operations.

**Independent Test**: Submit each of the three request types as an eligible
customer, read only owned request state, attempt cross-customer access, and
confirm that account status, sessions, customer data, and export-file state do
not change; exercise repeat, cancellation, suspended-account, processor
transition, coexistence, and concurrent-request cases against the five-state
lifecycle, then exercise exclusive atomic claim, repeat and competing claims,
claimant-only resolution, privileged audited reassignment, stale and failed
transitions, terminal immutability, processor-contract ownership, allowed
metadata, a configured terminal-retention period, expiry, and operational purge.

**Acceptance Scenarios**:

1. **Given** an eligible authenticated customer, **When** the customer submits
   an account-deactivation request, **Then** an owned, auditable request state
   is returned without changing account status or revoking sessions.
2. **Given** an eligible authenticated customer, **When** the customer submits
   an account-deletion request, **Then** an owned, auditable request state is
   returned without deleting, anonymizing, or otherwise changing customer data.
3. **Given** an eligible authenticated customer, **When** the customer submits
   a data-export request, **Then** an owned, auditable request state is returned
   without claiming that an archive or download is ready.
4. **Given** one customer's privacy-request identifier, **When**
   another customer attempts to access it, **Then** the attempt is denied
   without exposing request contents or customer data.
5. **Given** a privacy-request mutation, **When** it succeeds or is
   denied for a security-relevant reason, **Then** the required redacted audit
   evidence is produced without storing exported content, credentials, or
   contact values in audit details.
6. **Given** an active request of one purpose, **When** the owner repeats that
   purpose or concurrent submissions arrive, **Then** the existing active
   request is returned and no second active request is created.
7. **Given** an owned PENDING request, **When** the customer cancels it before
   processing begins, **Then** it becomes CANCELLED with a cancellation
   timestamp and no processing effect occurs.
8. **Given** an owned request is PROCESSING or terminal, **When** the customer
   attempts cancellation, **Then** cancellation is denied and the state does
   not change.
9. **Given** active deactivation, deletion, and export requests for the same
   identity, **When** they are tracked, **Then** they coexist independently and
   none automatically cancels, replaces, or supersedes another.
10. **Given** a later actor has a trusted processor identity and the explicit
    processor capability, **When** it claims or resolves a request through the
    R1-P04 contract, **Then** authorization does not require customer `SELF` or
    customer-category eligibility, the customer remains the request owner, and
    the customer sees the new state and timestamps without R1-P04 promising a
    completion deadline.
11. **Given** a later privacy processor claims or resolves a request, **When**
    it acts through the explicit request contract, **Then** R1-P04 remains the
    request-record and lifecycle owner while identity and business-data owners
    retain authority over their data.
12. **Given** one PENDING request and concurrent claims from two authorized
    processors, **When** both claims are evaluated, **Then** exactly one atomic
    PENDING to PROCESSING transition records its claimant ID and processing
    timestamp; a repeat by that claimant is idempotent and the competitor
    receives a stable conflict.
13. **Given** a PROCESSING request, **When** a non-claimant attempts resolution
    or the claimant attempts COMPLETED or REJECTED, **Then** only the claimant's
    legal terminal transition may succeed and it atomically records the terminal
    timestamp and required standardized outcome/reason code.
14. **Given** a PROCESSING request is stale or its claimant cannot continue,
    **When** an authenticated privileged actor with the dedicated R1-P03
    permission and approved reason invokes reassignment through the audited
    R1-P04 contract, **Then** authorization does not require customer `SELF` or
    customer-category eligibility, the customer remains the request owner,
    claimant ID and processing timestamp change atomically with preserved
    before/after audit evidence, and no staff UI, automatic rollback to PENDING,
    or R1-P04 privacy processor is introduced.
15. **Given** a terminal request and an owner-approved retention period,
    **When** the period expires, **Then** the request disappears from customer
    history and its operational metadata is purged while separately governed
    redacted audit evidence remains.

---

### User Story 5 - Protect and trace customer-data changes (Priority: P1)

As a customer and data subject, I need every new customer-data operation to
enforce my ownership, minimize exposure, and leave appropriate audit evidence
so that profile convenience does not create privacy or authorization leaks.

**Why this priority**: Ownership and privacy failures would expose personal
data even if all primary profile and address flows otherwise worked.

**Independent Test**: Exercise every customer self-service read and mutation
with the owner, an unrelated authenticated user, a pending-category user, a
suspended or banned identity, and crafted owner identifiers; inspect public
failures and redacted audit evidence. Separately exercise processor claim and
resolution plus privileged reassignment with trusted and untrusted actor
contexts.

**Acceptance Scenarios**:

1. **Given** a client-supplied owner identifier that differs from the
   authenticated principal, **When** any customer self-service R1-P04 operation
   is evaluated, **Then** the supplied identifier never overrides authoritative
   ownership.
2. **Given** a suspended, banned, deactivated, unauthenticated, unauthorized, or
   wrong-owner customer caller, **When** any customer self-service R1-P04
   operation is requested, **Then** access fails closed without sensitive-data
   leakage. A pending-only enrolled caller is denied category-profile and shared
   image/address operations, but retains the already-approved limited access to
   contact-state reads, language/notification preferences, and privacy-request
   submit/track/pending-cancel for `SELF` resources.
3. **Given** a successful profile, preference, address, deactivation-request,
   deletion-request, or export-request mutation, **When** audit evidence is
   reviewed through an
   authorized audit path, **Then** it identifies the actor, action, time,
   outcome, and affected opaque resource without exposing secret or excessive
   personal content.
4. **Given** an ordinary successful self-read, **When** operational evidence is
   recorded, **Then** no unnecessary business audit entry containing personal
   data is required and any access logging remains redacted.
5. **Given** an active multi-category identity with one verified supported
   category and another pending category, **When** the customer uses an
   identity-wide operation and then attempts the pending category's profile
   operation, **Then** the identity-wide operation remains available while the
   pending category's profile operation is denied.
6. **Given** R1-P04 data exists before an identity or relevant category becomes
   ineligible, **When** eligibility is lost and later restored, **Then** the data
   remains unchanged and inaccessible during ineligibility and becomes
   accessible again only under the restored eligibility rules, without an
   automatic delete or anonymization.

### Edge Cases

- One identity has multiple verified customer categories; category-specific
  profiles remain distinct while contacts, preferences, and address ownership
  remain identity-wide.
- An active identity has one verified supported customer category and another
  pending category; identity-wide operations remain available, but the pending
  category cannot gain or use a profile through R1-P04.
- An identity is suspended, banned, or deactivated; every R1-P04 customer
  operation is denied even when R1-P04 data already exists. The data remains
  unchanged and inaccessible, and eligible access resumes only under the
  restored eligibility rules.
- An identity is pending-only (ACTIVE, enrolled supported category, no verified
  supported category yet); category-profile and shared image/address operations
  are denied, while contact-state, preference, and privacy-request operations
  for `SELF` remain available under the already-approved limited-access rule.
- A category-specific profile already exists when that category loses verified
  status; the profile remains unchanged and inaccessible until the category is
  verified again. Losing eligibility never itself deletes or anonymizes data.
- No profile exists yet; the owner receives an explicit empty/not-created state
  rather than another customer's record or a fabricated default profile.
- The profile's external identity provides a display name or avatar claim;
  that provider metadata remains separate and does not silently become or
  overwrite the customer profile.
- A multi-category customer replaces or removes the profile image while using
  one category profile; the one identity-wide image state changes consistently
  for every customer category without changing category-specific text fields.
- A customer submits birth date, gender, trade name, registration/tax number,
  engineering discipline/license, biography, or another unapproved profile
  field; it is not accepted as R1-P04 profile data.
- A profile-image upload is missing, inaccessible, rejected as unsafe, or fails
  during replacement; the prior profile state remains intact.
- Phone or email is absent; contact display represents absence separately from
  the unverified state.
- The identity contains a phone value with no phone-verification evidence;
  every R1-P04 surface reports it as unverified.
- A preference update is empty, repeated, stale, or concurrent with another
  update; the stored preference set remains complete and is not partially
  combined from competing writes.
- A new or existing customer has no explicit notification preference record;
  mandatory categories remain effective and both optional categories are off.
- A new optional notification category is approved later; it remains off until
  the customer explicitly enables it. A category cannot become mandatory
  without a separate approved product rule.
- A customer attempts to disable a mandatory category while enabling an
  optional choice in the same update; the entire update is rejected rather
  than partially weakening mandatory policy.
- SMS or push is temporarily unavailable, or the customer has no reachable
  destination; the stored preference does not falsely claim delivery, and
  delivery/fallback behavior remains owned by the later notification phase.
- Country, city, district, or address text is blank after trimming; the address
  is rejected. Blank building, floor, and notes are treated as absent.
- A previously saved country becomes unavailable; the address is not silently
  rewritten or reassigned, and later booking eligibility remains outside this
  phase.
- Two customers use identical text for an address; each retains a distinct
  owned record and neither can infer the other record.
- A customer has one or many saved addresses; R1-P04 never marks, infers, or
  automatically promotes any address as default or primary.
- An address update or removal races with another mutation; the result is
  deterministic and never produces a mixture of two requests.
- A client submits coordinate-like values inside free text; the text is treated
  only as customer-provided address text and is never parsed or promoted into
  geospatial data.
- Repeated or concurrent submissions for the same identity and purpose find an
  existing PENDING or PROCESSING request; they return that request and do not
  create another active request.
- Different active privacy-request purposes coexist independently; none
  automatically supersedes, cancels, or changes another.
- Cancellation and processor claim race for one PENDING request; exactly one
  valid transition wins, so the request becomes either CANCELLED or PROCESSING
  and never both.
- A customer attempts to cancel a PROCESSING, COMPLETED, REJECTED, or CANCELLED
  request; cancellation is denied without changing the existing state.
- A request remains PENDING without a processor; its timestamps remain visible
  and R1-P04 does not fabricate a completion estimate or deadline.
- A later processor attempts to bypass the R1-P04 request contract or take
  request-record ownership; the operation is denied without a lifecycle change.
- Two processors claim the same PENDING request concurrently; exactly one
  exclusive atomic claim succeeds, the winning claimant's repeated claim is
  idempotent, and every competing claim receives a stable conflict.
- A non-claimant attempts to resolve a PROCESSING request, or an old claimant
  acts after reassignment; the stale transition fails without changing state,
  timestamps, claimant identity, or outcome metadata.
- A PROCESSING request becomes stale or its claimant fails; it remains
  PROCESSING until privileged reassignment is authorized through the explicit
  audited R1-P04 contract and never automatically returns to PENDING.
- A terminal request receives a repeat or conflicting transition; its terminal
  state, timestamp, standardized outcome/reason code, and resolving processor
  identity remain immutable.
- A request supplies a free-form rationale, export content, or outcome text
  instead of an approved standardized code; the extra sensitive content is not
  accepted as request metadata.
- The required owner-approved terminal-retention period is absent; readiness
  fails rather than selecting a silent duration or immediately purging data.
- A customer requests an expired terminal request after operational purge; it
  is absent from customer history, while separately governed redacted audit
  evidence is neither exposed nor deleted by that self-service read.
- A deactivation or deletion request is pending while the customer remains
  signed in; the request alone does not change account status, session state,
  authentication eligibility, or access to owned R1-P04 data.
- An export request is accepted while no export processor exists; the request
  remains request metadata and is never presented as a generated archive or
  downloadable file.
- A deletion request concerns an identity with audit or future immutable
  business history; the request does not silently hard-delete evidence whose
  retention is governed elsewhere.

## Requirements *(mandatory)*

### Functional Requirements

#### Customer profiles and media

- **FR-001**: The system MUST support customer profiles only for
  `individual`, `company`, and `engineer` customer categories in
  R1-P04.
- **FR-002**: A user MUST have the matching enrolled and verified customer
  category before creating or changing that category-specific profile.
- **FR-003**: A multi-category identity MUST keep category-specific text
  profiles distinct while preserving one authoritative identity, shared
  contact verification state, and one shared profile image.
- **FR-004**: Profile creation and update MUST NOT create or mutate a provider
  owner, provider profile, provider membership, worker, team, provider
  verification, or onboarding record.
- **FR-005**: The Individual profile MUST contain exactly one required full
  name; the Company profile MUST contain exactly one required company name and
  one required representative full name; and the Engineer profile MUST contain
  exactly one required full name and one required professional title. Each
  value MUST be trimmed, MUST be non-blank, and MUST remain owner-private in
  R1-P04. No additional category-specific profile field is in scope.
- **FR-006**: A customer MUST be able to view the explicit not-created state of
  each eligible profile without the system fabricating profile data.
- **FR-007**: A customer MUST be able to add, replace, and remove one optional
  identity-wide profile image shared across every customer category held by
  that identity; category-specific profile images are prohibited in R1-P04.
- **FR-008**: Rejected or failed image changes MUST leave the last accepted
  profile image association unchanged.
- **FR-009**: Profile media MUST remain protected against unauthorized access
  and MUST NOT create a provider gallery or other later-phase media behavior.

#### Contact display and preferences

- **FR-010**: R1-P02 identity data MUST remain the sole source of truth for
  phone, email, their presence, and their verification timestamps.
- **FR-011**: The feature MUST display only the authenticated customer's own
  safe phone and email values with separate states for absent, present but
  unverified, and verified.
- **FR-012**: A phone MUST be displayed as verified only when the identity
  source contains authoritative phone-verification evidence; the existence,
  formatting, or prior use of a phone value is not evidence of ownership.
- **FR-013**: This feature MUST NOT edit phone/email identifiers, set or clear
  verification evidence, send verification challenges, or change existing
  authentication behavior or contracts.
- **FR-014**: The system MUST store one identity-wide language preference
  selectable as Arabic or English and MUST preserve an explicit unset state
  when no selection has been made.
- **FR-015**: A language preference change MUST be visible consistently across
  every customer category held by the identity.
- **FR-016**: The notification-preference foundation MUST keep one coherent,
  identity-owned matrix in which SMS and push are the only configurable
  customer channels, and service reminders and promotional messages are the
  only user-configurable categories in R1-P04.
- **FR-017**: Account security/verification notices and active-service
  operational notices MUST be mandatory and MUST NOT be disabled by customer
  preferences. R1-P02 authentication email remains governed by the completed
  authentication contract and outside R1-P04 preference controls. Service
  reminders and promotional messages MUST default off for new and existing
  customers, MAY be enabled independently for SMS and push, and every newly
  approved optional category MUST default off. No category may become
  mandatory without an approved product rule.
- **FR-018**: Preference updates MUST either apply as one complete accepted set
  or leave the prior set unchanged. Any request that attempts to disable a
  mandatory category or contains an invalid choice MUST be rejected without
  partially applying otherwise valid optional choices.

#### Customer-owned text addresses

- **FR-019**: An active authenticated identity with at least one verified
  individual, company, or engineer category MUST be able to maintain its own
  address book.
- **FR-020**: Every accepted address MUST contain a supported country and
  non-blank city, district, and address text; building, floor, and notes MAY
  be absent.
- **FR-021**: Address validation MUST treat whitespace-only required values as
  missing and whitespace-only optional values as absent.
- **FR-022**: Every address MUST be owned by exactly one identity from the
  trusted authenticated principal, never from a client-asserted owner.
- **FR-023**: The owner MUST be able to add, view, edit, and remove multiple
  addresses without affecting another owned address. All saved addresses MUST
  remain peers: R1-P04 MUST NOT designate, infer, or automatically promote a
  default or primary address. A later consumer MUST require explicit customer
  selection unless a future approved product rule defines otherwise.
- **FR-024**: A removed address MUST no longer be available for future selection;
  removal MUST NOT rewrite any future immutable order or booking snapshot that
  copied the address while it was valid.
- **FR-025**: Address operations MUST reject or disregard, according to the
  documented public input contract, coordinates, latitude/longitude, map pins,
  zones, radius, distance, geocodes, or other geospatial attributes; none may
  become required or persisted R1-P04 address facts.
- **FR-026**: The feature MUST NOT infer coordinates, coverage, serviceability,
  provider eligibility, or booking eligibility from address text.
- **FR-027**: Conflicting address mutations MUST not silently merge partial
  field sets or change ownership.

#### Ownership, authorization, privacy, and audit

- **FR-028**: Every R1-P04 contract operation MUST authenticate its acting
  principal from trusted context and fail closed, using the authorization policy
  declared for its actor and operation family:
  - Customer self-service operations MUST authorize directly from trusted
    `AuthenticationPrincipal` facts and `SELF` ownership. They MUST NOT require
    a `customer` role grant, `resource.self.read`, `resource.self.write`, or any
    other R1-P04 customer permission derived from role grants. Apply these
    exact rules:
    - Category profile create/read/update: ACTIVE identity; matching
      `individual`, `company`, or `engineer` category is verified; resource
      belongs to `SELF`.
    - Shared profile image and address operations: ACTIVE identity; at least
      one supported `individual`, `company`, or `engineer` category is verified;
      resource belongs to `SELF`.
    - Contact-state reads, language preferences, notification preferences, and
      privacy-request submission/tracking/pending cancellation: ACTIVE identity;
      enrolled in a supported customer category (pending-only enrolled
      categories remain allowed for this family); resource/request belongs to
      `SELF`.
    - `SUSPENDED`, `BANNED`, and `DEACTIVATED` identities MUST receive no
      R1-P04 customer operations.
    - Losing eligibility suspends access but MUST NOT delete existing data.
    - Multi-category profile operations require the matching verified category;
      shared operations remain identity-wide when at least one verified
      supported category exists.
  - Processor claim and resolution operations MUST require a trusted processor
    identity and the explicit processor capability from trusted authorization
    context. They MUST NOT require customer `SELF` ownership or the customer's
    identity/category eligibility, and MUST preserve the customer as request
    owner.
  - Privileged reassignment MUST require an authenticated privileged actor, the
    dedicated R1-P03 permission, and an approved reason. It MUST NOT require
    customer `SELF` ownership or the customer's identity/category eligibility,
    and MUST preserve the customer as request owner.
- **FR-029**: Authorization MUST derive customer identity, ownership, and
  category eligibility; processor identity and capability; and privileged actor
  permission from their respective trusted authentication and authorization
  contexts plus server-held relationships. Client-supplied roles, permissions,
  capabilities, processor identifiers, category claims, owner identifiers, or
  scope MUST NOT grant authority.
- **FR-030**: Customer self-service cross-customer access MUST be denied for
  profiles, images, contacts, preferences, addresses, and all three privacy-
  request types without returning protected content or leaking avoidable
  existence information. A processor contract may expose only the minimized
  request metadata required by FR-046 and FR-047 to its authorized actor.
- **FR-031**: Provider actors, workers, marketers, and unauthenticated users MUST
  receive no R1-P04 customer-data access merely because they know an identifier;
  privileged staff access is outside this specification.
- **FR-032**: Customer-data responses MUST minimize personal information to
  fields required by the requested self-service operation and MUST exclude
  credentials, tokens, one-time codes, session material, internal authorization
  facts, and protected audit details.
- **FR-033**: Successful profile, image-association, preference, address,
  deactivation-request, deletion-request, and export-request mutations MUST
  produce auditable evidence
  containing actor, action, time, outcome, and opaque affected-resource identity
  with personal values minimized or redacted.
- **FR-034**: Security-relevant denials and privacy-request state transitions
  MUST be traceable without placing credentials, contact values, full addresses,
  profile-image contents, or exported customer data into logs or audit details.
- **FR-035**: Ordinary successful self-reads MUST NOT require a business audit
  record containing personal content; any operational access record MUST remain
  redacted and follow approved retention and access rules.
- **FR-036**: A future privileged write to R1-P04 data MUST require the R1-P03
  permission, approved reason, actor/time, and before/after audit contract, but
  R1-P04 MUST NOT create that staff surface during this phase.

#### Account deactivation, deletion, and data-export requests

- **FR-037**: An eligible authenticated customer MUST be able to submit and
  track identity-owned account-deactivation, account-deletion, and data-export
  requests as three distinct request purposes.
- **FR-038**: R1-P04 MUST remain request-only for all three purposes. It MUST
  NOT process or fulfill a request, change account status, deactivate or
  reactivate an identity, revoke sessions because of a request, delete or
  anonymize data, generate an export archive, or deliver an export file. Later
  authorized privacy processors own orchestration of processing and
  fulfillment while identity and business capabilities retain authority over
  their own state and data.
- **FR-039**: Every privacy request MUST use exactly PENDING, PROCESSING,
  COMPLETED, REJECTED, or CANCELLED. At most one PENDING or PROCESSING request
  may exist per identity and purpose; repeat or concurrent submission MUST
  return the existing active request. The customer MAY cancel only a PENDING
  request. Different purposes MUST coexist without automatic supersession.
  Only a later authorized processor MAY claim PENDING to PROCESSING, and that
  transition MUST be exclusive and atomic while recording claimant processor ID
  and processing timestamp together. A repeat claim by the recorded claimant
  MUST return the current request idempotently; a competing claimant MUST
  receive a stable conflict without changing state or metadata. Only the
  recorded claimant MAY resolve the request. COMPLETED and REJECTED MUST be
  legal only from PROCESSING; each successful resolution MUST atomically record
  terminal state, terminal timestamp, resolving processor ID, and a required
  approved standardized outcome/reason code. COMPLETED, REJECTED, and CANCELLED
  MUST be immutable. Stale, invalid, conflicting, or failed transitions MUST
  preserve the last accepted state and metadata. Customer-visible tracking MUST
  include state and applicable request, update, cancellation, processing, and
  terminal timestamps, and MUST promise no R1-P04 completion deadline.
- **FR-040**: Customer-facing privacy-request operations MUST NOT expose another
  customer's request state or data. Processor and privileged contract
  operations MUST expose only the minimized metadata required for their
  authorized transition, and no privacy-request operation may silently destroy
  immutable audit or future historical business evidence.
- **FR-041**: Deactivation, deletion, and export requests MUST use redacted
  audit evidence and MUST NOT place export payloads, full rationales,
  credentials, or contact values into general logs.

#### Failure and consistency rules

- **FR-042**: Invalid, unauthorized, wrong-owner, unsupported-category, stale,
  and conflicting mutations MUST leave the prior accepted business state
  unchanged. Loss of identity-wide or category-specific eligibility MUST NOT
  delete, anonymize, or otherwise mutate existing R1-P04 data. That data MUST
  remain inaccessible while ineligible and MUST become accessible again when
  the applicable eligibility requirements are restored. Only a later
  authorized privacy processor MAY delete or anonymize retained data because of
  identity or category ineligibility; separately approved self-service removal
  operations remain governed by their existing requirements.
- **FR-043**: Public failures MUST be deterministic enough for a customer to
  correct safe input while avoiding account, category, ownership, address,
  privacy-request, or media enumeration.
- **FR-044**: A successful mutation MUST return the resulting safe business
  state or a stable acknowledgement so the customer is not left uncertain
  whether the change was accepted.
- **FR-045**: Existing authentication endpoints and safe authenticated-user
  responses MUST preserve their approved behavior. R1-P04 customer self-service
  MUST NOT require a historical `customer` user-role grant, MUST NOT require
  `resource.self.read`/`resource.self.write` or other role-derived R1-P04
  customer permissions, and MUST authorize from trusted `AuthenticationPrincipal`
  facts plus `SELF` ownership and the FR-028 category eligibility rules
  (DEC-030).

#### Privacy-request retention and processor handoff

- **FR-046**: R1-P04 MUST remain the owner of privacy-request records,
  uniqueness, lifecycle validation, customer tracking, and pending-only
  cancellation throughout the request's life. A later authorized privacy
  processor MUST use an explicit R1-P04 contract to claim, reassign, or resolve
  a request and MUST NOT take request-record ownership or access R1-P04
  persistence directly. Reassignment MUST be allowed only from PROCESSING,
  through that explicit audited contract, by a privileged actor holding the
  dedicated R1-P03 permission and supplying an approved reason. The reassignment
  MUST atomically replace processor ID and processing timestamp, invalidate the
  former claimant's authority to resolve, and preserve before/after audit
  evidence. Stale work MUST NOT automatically return to PENDING. R1-P04 MUST NOT
  create a staff UI or implement a privacy processor. Identity and each business
  capability remain authoritative for their own account and customer data; the
  later processor owns orchestration only.
- **FR-047**: Privacy-request operational metadata MUST be limited to request
  identifier, owner identifier, purpose, state, applicable request/update/
  cancellation/processing/terminal timestamps, processor identifier, and an
  approved standardized outcome or reason code. Free-form rationales,
  credentials, contact values, customer business data, export content, and
  export files MUST NOT be request metadata.
- **FR-048**: Active requests MUST remain retained until they reach a terminal
  state. Each supported operating configuration MUST provide an explicit
  owner-approved terminal-retention period, with no built-in or silent default.
  A terminal request MUST remain visible to its owner until that period expires
  from its terminal timestamp; after expiry, its operational request metadata
  MUST be purged from customer history while separately governed redacted audit
  evidence remains under the audit capability's retention policy. Missing
  retention configuration MUST fail readiness validation.

### Key Entities *(include if feature involves data)*

- **Customer Profile**: The identity-owned, owner-private profile anchor for
  customer self-service, connecting the eligible category-specific text
  profiles to one optional identity-wide profile image.
- **Individual Profile**: Exactly one required, trimmed, non-blank full name
  for the verified individual customer category.
- **Company Profile**: Exactly one required, trimmed, non-blank company name
  and one required, trimmed, non-blank representative full name for the
  verified company category; it is not a provider profile, company
  verification record, or onboarding record.
- **Engineer Profile**: Exactly one required, trimmed, non-blank full name and
  one required, trimmed, non-blank professional title for the verified
  engineer category; it is not a provider profile, professional verification
  record, or onboarding record.
- **Profile Image**: One optional protected current image owned by the identity
  and shared across all of its customer categories; it is not category-specific
  and does not form a gallery.
- **Contact Verification View**: A read-only projection of the identity-owned
  phone/email presence and authoritative verification evidence; it never owns
  or changes those facts.
- **Customer Preferences**: One identity-wide Arabic/English selection plus
  an SMS/push matrix for the optional service-reminder and promotional
  categories. Optional choices default off; mandatory account
  security/verification and active-service operational categories are policy
  outcomes that customer preferences cannot disable.
- **Text Address**: An identity-owned address containing country, city,
  district, address text, and optional building, floor, and notes, with no
  geospatial facts. Every saved address is a peer; R1-P04 has no default or
  primary address designation.
- **Account-Deactivation Request**: An identity-owned request for later
  authorized processing; its existence does not change account or session
  state.
- **Account-Deletion Request**: An identity-owned request for later authorized
  processing; it is distinct from deletion, anonymization, or data removal.
- **Data-Export Request**: An identity-owned request for later authorized
  fulfillment; it is not an archive, download, or copy of exported customer
  data.
- **Privacy Request Lifecycle**: The purpose-specific, identity-owned tracking
  state PENDING, PROCESSING, COMPLETED, REJECTED, or CANCELLED. Operational
  metadata is limited to identifiers, purpose, state, applicable timestamps,
  processor identifier, and a standardized outcome/reason code. One PENDING
  or PROCESSING request per identity and purpose may exist at a time. A
  PROCESSING request has one exclusive current claimant. COMPLETED and REJECTED
  are legal only from PROCESSING, and every terminal state is immutable. Active
  metadata remains until terminal; terminal metadata is owner-visible for the
  required configured period and is then purged.
- **Privacy Processor**: A later authorized orchestrator that claims and
  resolves requests through the R1-P04 public contract. Only the current
  claimant may resolve. An approved reassignment uses that same contract and
  dedicated R1-P03 permission with before/after audit evidence. R1-P04 does not
  implement the processor or a staff UI, and the processor does not own request
  persistence, identity state, customer-domain data, or export content.
- **Audit Evidence**: Redacted change/security evidence linked by opaque
  identifiers; the existing audit capability owns its lifecycle while R1-P04
  owns when its business operations must request evidence.

## Ownership and Boundary Expectations

### Business-data ownership

- The authenticated customer is the data subject and sole self-service owner
  of their R1-P04 profiles, one identity-wide profile-image association,
  preferences, addresses, and deactivation, deletion, and export requests.
- The R1-P04 customer-profile capability owns the behavior and persistence
  access for those records and must expose only narrow public contracts to
  later booking, privacy, notification, and staff capabilities.
- R1-P04 retains request-record ownership when a later privacy processor claims
  or resolves a request. The processor owns orchestration only and must use the
  explicit request contract; identity and each business capability retain
  authority over their own state and data.
- The identity capability remains the sole owner of user identity, categories,
  account state, contacts, verification evidence, credentials, and sessions.
- The country-configuration capability remains authoritative for supported
  countries. R1-P04 does not own or duplicate country policy.
- Protected media handling owns file storage and safe media access; R1-P04 owns
  the customer-profile association and its authorization.
- The audit capability retains audit-record lifecycle ownership. R1-P04 supplies
  only minimized business change evidence through the approved audit contract.

### Authorization expectations

- Every customer self-service operation requires `SELF` ownership; resource
  existence never substitutes for ownership. Customer self-service does **not**
  declare or consume an R1-P04 permission, `resource.self.read`/`resource.self.write`,
  or any other role-derived customer permission.
- Category-profile operations require an ACTIVE identity with the matching
  verified supported category. Shared image/address operations require an ACTIVE
  identity with at least one verified supported category. Contact-state,
  preference, and privacy-request operations require an ACTIVE identity enrolled
  in a supported customer category and preserve pending-only limited access.
  Suspended, banned, and deactivated identities receive no R1-P04 customer access.
- Loss of identity or category eligibility suspends access but does not delete,
  anonymize, or mutate existing R1-P04 data. Eligible access resumes when the
  applicable identity and category requirements are restored. Deletion or
  anonymization because of ineligibility remains exclusive to a later authorized
  privacy processor and does not override approved self-service removals.
- Per **DEC-030**, eligible customer self-service operations authorize from
  trusted `AuthenticationPrincipal` facts, `SELF` ownership, and the FR-028
  category eligibility rules. Category arrays supply eligibility evidence only;
  they do not create role grants and do not require a historical `customer`
  user-role grant. Completed authentication contracts remain unchanged.
- Processor claim and resolution derive a trusted processor identity and
  explicit capability from trusted context, never require customer `SELF` or
  customer-category eligibility, preserve the customer as request owner, and
  use only the explicit R1-P04 request contract.
- Privileged reassignment derives the actor and dedicated R1-P03 permission from
  trusted context, requires an approved reason, never requires customer `SELF`
  or customer-category eligibility, and preserves the customer as request owner.
- No customer-facing R1-P04 operation grants privileged staff, provider,
  worker, or cross-customer access; the future processor and privileged
  contracts do not create a public staff or processor surface in this phase.

### Privacy expectations

- Personal data is returned only to its owner through the requested
  self-service use case and is excluded from generic errors and unrelated
  records.
- Verification labels represent evidence, not confidence inferred from a
  contact value.
- Profile images and text addresses are private customer data unless a later
  approved phase defines a purpose-limited consumer.
- Deactivation, deletion, and data-export requests expose only minimized
  metadata. Terminal request history remains customer-visible only for the
  required owner-approved configured period and is purged afterward; no
  default retention duration may be inferred.

### Audit expectations

- Mutations, privacy requests, security-relevant denials, and any future
  privileged access are traceable.
- Ordinary self-service reads do not create unnecessary personal-data audit
  copies.
- Audit evidence contains references and minimized change metadata, not raw
  profile images, credentials, full contact values, full address text, or
  export contents.
- Every privileged processor reassignment preserves redacted before/after
  evidence for claimant identity and processing timestamp, the authorizing
  actor, approved reason, time, and outcome without storing customer payloads.
- Purging expired operational request metadata does not purge separately
  governed redacted audit evidence, and audit retention does not keep expired
  request details visible through customer self-service.

## Product Decision and Review Resolution Status

- **BLOCKER-01 — Customer and processor authorization conflict — RESOLVED**:
  FR-028, FR-029, FR-030, FR-040, the acceptance scenarios, authorization
  expectations, and measurable outcomes now distinguish customer `SELF`,
  trusted processor claim/resolution, and privileged reassignment policies.
  Processor and privileged operations preserve the customer as request owner
  without inheriting customer identity/category eligibility requirements.

- **MAJOR-01 — Privacy-processor transitions — RESOLVED**: The fourth accepted
  answer defines exclusive atomic claim, claimant-only resolution, privileged
  audited reassignment, stale/conflict behavior, legal source states, required
  terminal metadata, and terminal immutability in FR-039 and FR-046.
- **MAJOR-02 — Deterministic acceptance workload — RESOLVED**: SC-008 now uses
  exactly 25 concurrent automated execution lanes rather than 25 eligible
  customer identities. Each lane executes exactly 40 interactions from the
  same canonical 1,000-row manifest, whose fixed caller contexts, ownership,
  operations, expected outcomes, lanes, and measurement slots preserve the
  approved leaf matrix across repeated runs while all prepared state remains
  unchanged during measurement.
- **MINOR-01 — Repeatable participant cohort — RESOLVED**: SC-005 now fixes the
  exact category holdings and one applicable-profile assignment for every
  participant P01–P20 while preserving the common starting condition, timed
  journey, and 19-of-20 threshold.

UD-001, UD-002, and UD-003 remain resolved by the five earlier owner-accepted
answers. The five answers in the continuing 2026-08-06 session resolved
identity/category eligibility, retention and restoration after eligibility
loss, peer-address selection, and MAJOR-01 while establishing SC-008's approved
top-level workload boundary. The two answers in the focused continuation fixed
SC-008's composite distribution and SC-005's repeatable participant cohort.
Independent re-review reopened SC-008 for leaf-level determinism; the owner-
accepted balanced matrix fixed those counts. A later re-review reopened the
SC-008 participant model and SC-005 multi-category assignment; the accepted
execution-lane and scenario-manifest decision resolves SC-008, and the accepted
P01–P20 category/profile assignment resolves SC-005. The independent
specification re-review returned `PASS` with no BLOCKER, MAJOR, or MINOR
finding. No owner clarification or product decision remains open. R1-P04
specification preparation is complete.

On 2026-08-06, technical planning paused before Phase 0 while the owner defined
R1-P03A as the prerequisite for production staff administration. Owner **DEC-030**
(2026-08-07) removes the prior **authorization-provisioning blocker** that required
customer-role grants before R1-P04 planning could proceed.

**Current gate (DEC-030 + DEC-031):**

- R1-P04 customer operations authorize via trusted `AuthenticationPrincipal`
  facts, `SELF` ownership, and the FR-028 category eligibility rules — **not**
  via a `customer` role grant, `resource.self.read`/`resource.self.write`, or
  any other role-derived R1-P04 customer permission.
- A historical `customer` user-role grant is **not** required and does not affect
  eligibility.
- R1-P03A (owner MVP) provisions `staff_admin` and non-customer role management
  only; it does not provision customer roles for R1-P04.
- **Historical pause note (resolved 2026-08-07):** Planning was paused until
  R1-P03A Complete for phase sequencing, not because customer permissions lacked
  a grant path. That Complete gate is now satisfied and planning is active.
- **DEC-031 (2026-08-07):** Privileged reassignment is `staff_admin` only;
  privacy outcomes are closed to `REQUEST_FULFILLED` / `REQUEST_REJECTED`;
  retention uses env `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` with a bounded
  customers-owned hourly sweep. These are planning/authority decisions recorded
  in `docs/product/decision-log.md` and integrated into Phase 0/1 artifacts
  without renumbering FR/SC requirements. Fresh independent final
  technical-planning re-review returned `PASS`. `tasks.md` is generated under
  tasks-generation authorization; implementation remains unauthorized until
  separate human-owner authorization.

Registration-time grants, category-derived role grants, bulk backfills, hidden
database edits, and changes to completed R1-P02 authentication contracts remain
prohibited.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of individual, company, engineer,
  multi-category, and pending-category scenarios enforce the exact required
  field matrix, owner-private visibility, and identity-wide image rule without
  changing identity or authentication facts.
- **SC-002**: In customer self-service ownership testing across every R1-P04
  resource type, 100% of cross-customer and client-forged-owner attempts are
  denied without returning protected content. In processor and privileged
  contract tests, 100% of client-forged processor identifiers, capabilities,
  permissions, reasons, owner identifiers, and scope fail to grant authority.
- **SC-003**: In verification-state testing, 100% of displayed phone and email
  labels match authoritative identity evidence; no stored but unverified phone
  is labeled verified.
- **SC-004**: In address acceptance testing, 100% of accepted addresses contain
  supported country, city, district, and address text, and 0 accepted address
  records require or expose a coordinate, map, zone, radius, or geospatial
  attribute.
- **SC-005**: In a repeatable cohort of 20 eligible participants, acceptance
  testing MUST use these fixed category holdings and single applicable-profile
  assignments: P01–P05 are Individual-only and each creates an Individual
  profile; P06–P10 are Company-only and each creates a Company profile; P11–P15
  are Engineer-only and each creates an Engineer profile; P16 holds verified
  Individual+Company categories and creates Individual; P17 holds verified
  Individual+Company categories and creates Company; P18 holds verified
  Individual+Engineer categories and creates Engineer; P19 holds verified
  Company+Engineer categories and creates Company; and P20 holds verified
  Individual+Company+Engineer categories and creates Engineer. Repeated runs
  MUST use these same P01–P20 holdings and assignments. Each participant MUST
  begin authenticated, with no R1-P04 profile for the assigned applicable
  category, no explicit language preference, and an empty address book. The
  timed journey MUST require the participant to create exactly the assigned
  single applicable profile, select Arabic or English, and save one valid text
  address. At least 19 of 20 participants MUST finish correctly within five
  minutes without assistance.
- **SC-006**: In mutation and failure testing, 100% of successful changes leave
  one complete resulting state, while rejected, unauthorized, or conflicting
  changes leave the prior accepted state intact.
- **SC-007**: 100% of audited R1-P04 mutations and security-relevant denials
  include actor, action, time, outcome, and opaque resource identity, and 0
  sampled audit/log records contain credentials, tokens, one-time codes, full
  addresses, profile-image contents, or export payloads.
- **SC-008**: During a 10-minute steady-state measurement window, the acceptance
  workload MUST use exactly 25 concurrent automated execution lanes, not 25
  eligible customer identities. Each lane MUST execute exactly 40 interactions,
  totaling exactly 1,000 customer-facing R1-P04 interactions. A canonical
  1,000-row scenario manifest MUST be prepared before measurement from the
  approved SC-008 leaf matrix. Every manifest row MUST fix caller context,
  target ownership, operation, expected outcome, execution lane, and measurement
  slot. Caller context MUST be the eligible authenticated owner, eligible wrong-
  owner, category-ineligible, permission-denied, ineligible customer, or
  unauthenticated context required by the approved leaf scenario. All identities,
  states, permissions, ownership relations, fixtures, and assignments MUST be
  prepared outside measurement and remain unchanged during measurement.
  Repeated acceptance runs MUST use the same canonical manifest and lane
  assignment. Future processor execution MUST NOT be measured. The deterministic
  distribution MUST be:
  - **Profile operations — 200 (20%)**:
    - **Reads — 50**: 35 existing-profile reads and 15 not-created-state reads.
    - **Successful profile mutations — 70**: 12 Individual creates, 12
      Individual updates, 12 Company creates, 11 Company updates, 11 Engineer
      creates, and 12 Engineer updates.
    - **Media results — 20**: 5 protected-access authorizations, 5 image
      additions, 5 image replacements, and 5 image removals.
    - **Input/state failures — 30**: 10 blank-required-value failures, 10
      invalid-category-field-shape failures, and 10 stale mutations.
    - **Authorization failures — 30**: 10 category-ineligible failures, 10
      permission-denied failures, and 10 wrong-owner failures.
  - **Contact-state reads — 150 (15%)**: 45 verified-email-state reads, 45
    present-unverified-phone-state reads, 30 absent-phone-state reads, 15
    unauthenticated failures, and 15 ineligible-customer failures.
  - **Preference operations — 150 (15%)**:
    - **Reads — 45**: 15 unset-language reads with all optional preferences off,
      15 Arabic reads with reminder SMS enabled only, and 15 English reads with
      promotion push enabled only.
    - **Language updates — 30**: 15 Arabic updates and 15 English updates.
    - **Optional-notification updates — 30**: reminder SMS has 4 enables and 4
      disables; reminder push has 4 enables and 4 disables; promotion SMS has 4
      enables and 3 disables; and promotion push has 4 enables and 3 disables.
    - **Mandatory-notice failures — 15**: 4 security-SMS disable attempts, 4
      security-push disable attempts, 4 active-service-SMS disable attempts, and
      3 active-service-push disable attempts.
    - **Invalid-choice failures — 15**: 5 unsupported-language choices, 5
      unsupported-channel choices, and 5 unknown-category choices.
    - **Concurrency failures — 15**: 8 stale updates and 7 conflicting updates.
  - **Address operations — 300 (30%)**:
    - **Reads — 60**: 30 address-book lists and 30 owned-address reads.
    - **Successful mutations — 150**: 60 creates, 60 updates, and 30 removals.
    - **Validation failures — 45**: 9 unsupported-country failures, 9 blank-city
      failures, 9 blank-district failures, 9 blank-address-text failures, and 9
      geospatial-input failures.
    - **Ownership/concurrency failures — 45**: 15 wrong-owner failures, 15 stale
      failures, and 15 conflicting failures.
  - **Customer privacy-request operations — 200 (20%)**:
    - **Submissions — 50**: 17 deactivation, 17 deletion, and 16 export.
    - **Tracking reads — 50**: 17 deactivation, 17 deletion, and 16 export.
    - **Repeat submissions — 30**: 10 per purpose, each returning the existing
      active request.
    - **PENDING cancellations — 20**: 7 deactivation, 7 deletion, and 6 export.
    - **Authorization failures — 25**: 13 wrong-owner and 12 unauthenticated.
    - **Invalid/state failures — 25**: 8 invalid-purpose failures, 8 stale
      cancellations, 3 PROCESSING cancellations, 2 COMPLETED cancellations, 2
      REJECTED cancellations, and 2 CANCELLED repeat cancellations.
  At least 95% of all measured interactions MUST return a visible result or safe
  failure within two seconds. Protected-media byte-transfer time and future
  SMS/push delivery latency are excluded.
- **SC-009**: In 100% of deactivation, deletion, and export-request acceptance
  scenarios, customers see only the documented owned request state and
  timestamps, with no request falsely described as processed or fulfilled and
  no R1-P04 completion deadline.
- **SC-010**: Review of the complete specification finds zero provider-onboarding
  behavior, zero geospatial dependency, and zero change to an existing
  authentication contract.
- **SC-011**: In 100% of notification-preference acceptance scenarios,
  mandatory account security/verification and active-service operational
  notices remain effective; reminders, promotions, and newly introduced
  optional categories default off; and R1-P02 authentication email remains
  unaffected by preference changes.
- **SC-012**: In 100% of accepted deactivation, deletion, and export-request
  scenarios, account status, sessions, customer data, and export-file state
  remain unchanged by R1-P04.
- **SC-013**: In 100% of repeat, concurrent, cancellation, processor-claim,
  resolution, and cross-purpose lifecycle tests, there is at most one active
  request per identity and purpose; a PENDING to PROCESSING claim is exclusive
  and atomic; a repeated claimant receives the current request idempotently; a
  competing claimant receives a stable conflict; only the current claimant may
  resolve; COMPLETED and REJECTED occur only from PROCESSING with required
  terminal timestamp and standardized outcome/reason code; terminal states are
  immutable; pending-only cancellation is enforced; and different purposes
  coexist without automatic supersession.
- **SC-014**: In 100% of sampled privacy requests, operational metadata is
  limited to the fields approved by FR-047, and 0 samples contain free-form
  rationale, credentials, contact values, customer business data, export
  content, or export files.
- **SC-015**: For every configured retention-policy test, active requests
  remain available until terminal, terminal requests remain owner-visible until
  the configured expiry, expired operational metadata disappears from customer
  history, and separately governed redacted audit evidence remains. A missing
  retention period fails readiness in 100% of configuration tests.
- **SC-016**: In 100% of processor-handoff tests, claim and resolution use the
  explicit R1-P04 contract and require trusted processor identity and explicit
  capability without customer `SELF` or customer-category eligibility. R1-P04
  retains request-record and lifecycle ownership, the customer remains request
  owner, and identity and business capabilities retain authority over their own
  state and data. Every reassignment occurs only from PROCESSING through that
  contract, authenticates a privileged actor, requires the dedicated R1-P03
  permission and an approved reason without customer `SELF` or category
  eligibility, atomically replaces processor ID and processing timestamp,
  invalidates the former claimant, and preserves before/after audit evidence;
  zero tests accept client-supplied authority or expose a staff UI, automatic
  rollback to PENDING, direct persistence access, or an R1-P04 privacy-processor
  implementation.
- **SC-017**: In 100% of customer self-service R1-P04 authorization-state tests,
  suspended, banned, and deactivated customer identities receive no access;
  pending-only enrolled ACTIVE identities retain limited contact/preference/
  privacy-request access for `SELF` while category-profile and shared
  image/address operations remain denied; an ACTIVE identity with at least one
  verified supported customer category may use shared image/address operations;
  and each category-specific profile operation is available only when its
  matching category is verified. Possessing or lacking a historical `customer`
  role grant MUST NOT change these outcomes.
- **SC-018**: In 100% of identity-wide and category-specific eligibility-loss
  tests, existing R1-P04 data remains unchanged and inaccessible while
  ineligible, becomes accessible again only when the applicable eligibility
  requirements are restored, and is never deleted or anonymized merely because
  eligibility changed.
- **SC-019**: In 100% of address-book tests with one or more saved addresses,
  R1-P04 exposes no default or primary designation, never promotes an address
  automatically, and requires explicit customer selection for a later consumer
  unless a future approved product rule defines otherwise.

## Assumptions

- R1-P01 country configuration, R1-P02 identity/authentication, and R1-P03
  authorization/audit capabilities remain completed upstream dependencies and
  are consumed without changing their public behavior.
- Arabic and English are the only language-preference values approved for this
  phase. The choice may remain unset until a customer selects one; this spec
  does not invent a product-wide default locale.
- Address country, city, district, and address text are required for Release 1
  usability; building, floor, and notes are optional because those details do
  not apply to every physical location.
- Address strings are customer-supplied text. Safe technical length and media
  upload limits may be selected during a later authorized technical plan as
  non-product safety constraints, but must not change the business field set.
- One identity may hold several customer categories. Type-specific profiles are
  category-scoped; the optional profile image, contacts, preferences, address
  ownership, and privacy requests are identity-scoped.
- Notification preferences are a storage and policy foundation only. Later
  notification phases own delivery, retry, fallback, templates, and proof of
  channel reachability; an enabled preference is not proof of delivery.
- Privacy requests are capture-and-tracking foundations only. R1-P04 retains
  request-record and lifecycle ownership. A later explicitly authorized
  privacy processor owns orchestration through the public request contract;
  identity and business capabilities retain their state and data ownership.
- The owner-approved terminal-retention period is required configuration, not
  a product duration invented by this specification. There is no fallback
  duration; readiness fails when the value is absent.
- Removing an address affects future selection only. Confirmed future business
  records preserve their own historical snapshots under the locked product
  rule.
- Provider-supplied contact, serviceability, booking, delivery, and notification
  execution behavior belongs to later phases.
- No external repository, legacy schema, undocumented service, map provider, or
  geospatial system is required.

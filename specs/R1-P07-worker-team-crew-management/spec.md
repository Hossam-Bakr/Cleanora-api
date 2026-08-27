# Feature Specification: Worker, Team & Crew Management

**Feature Branch**: `r1-p07-worker-team-crew-management`

**Created**: 2026-08-22

**Status**: Complete — implementation, migration proofs, tests, coverage, independent review, documentation, and explicit human-owner completion approval are complete as of 2026-08-24; Git publication remains separately gated

**Input**: Human-owner instruction `ACTIVATE R1-P07 AND RUN SPECKIT SPECIFY ONLY`,
followed by explicit authorization to continue the specification-driven workflow
through clarification, planning, checklists, tasks, and analysis while stopping
before `speckit-implement`; DEC-038 remains the approved product baseline.

## Clarifications

### Session 2026-08-22

- Q: What exact read and write authority does a Team's primary Supervisor have? → A: The primary Supervisor may read only their current Team and its current-member summaries and may modify only `cleans` on an existing current membership in that Team. They cannot add, remove, or move members; create or edit Worker Profiles, skills, Worker lifecycle, invitations, login access, or Admin membership; change Team name or lifecycle; or assign or clear the primary Supervisor. Full operational-phone access lasts only for current members of that Team while the primary-Supervisor assignment remains valid. R1-P07 adds no operational-notes field or other daily-operation write surface.
- Q: May an Escort ever have `cleans=true`, and what happens when a current cleaner changes type to Escort? → A: Every Team membership for `workerType=ESCORT` must have `cleans=false`. A request for `cleans=true` is rejected and never changes `workerType` automatically. Changing a `CLEANING_STAFF` Worker to `ESCORT` is rejected while the current membership still has `cleans=true`; the membership must be corrected explicitly first. Escorts never count as cleaning Workers or satisfy `workersReady`.
- Q: What happens when a primary Supervisor tries to set `cleans=false` for an active Team's final valid cleaning member? → A: The Supervisor command is rejected with a safe conflict directing the actor to an Owner or Admin. An Owner or Admin may proceed only after the exact impact is shown and explicitly confirmed; the membership change and Team transition to `INACTIVE` then commit atomically with separate history. Cancellation, stale version, or a competing command changes no business or side-effect state.
- Q: Which reason codes are valid for each privileged Worker or Provider-membership command, and when is a note required? → A: Each action accepts only its own closed catalog: Worker deactivation uses `TEMPORARILY_UNAVAILABLE`, `SCHEDULE_OR_LEAVE`, `PERFORMANCE_OR_POLICY`, `PROVIDER_OPERATIONAL_CHANGE`, or `OTHER`; Worker removal uses `ENGAGEMENT_ENDED`, `PERFORMANCE_OR_POLICY`, `DUPLICATE_OR_INCORRECT_RECORD`, or `OTHER`; login-access revocation uses `SECURITY_CONCERN`, `ACCESS_NO_LONGER_REQUIRED`, `ENGAGEMENT_ENDED`, or `OTHER`; Admin grant uses `OPERATIONAL_RESPONSIBILITY`, `COVERAGE_OR_BACKUP`, or `OTHER`; and Admin revocation uses `RESPONSIBILITY_ENDED`, `SECURITY_CONCERN`, `ENGAGEMENT_ENDED`, or `OTHER`. A meaningful note of at least 10 characters is required for every Worker removal and every action whose reason is `OTHER`.
- Q: How is the email locale chosen for invitation versions and later Worker notifications? → A: The Owner selects `AR` or `EN` for every invitation version, including resend, and that locale is stored with the exact version. After acceptance, notification email uses the recipient's `UserPreferences.language` when valid, otherwise the accepted invitation's locale for that Worker, otherwise `AR`. Locale is part of the idempotent notification intent, and delivery failure never changes accepted business truth.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Worker Profile and invite the person (Priority: P1)

An exact-Provider Owner or Admin creates a Provider-owned Worker Profile without
requiring the person to have completed a Cleanora account. The Owner then sends
a secure email invitation so the person can establish or connect login access
without the Provider choosing or learning the person's password.

**Why this priority**: A Provider cannot build an accountable workforce until
it can record the Worker, invite the correct person, and keep operational data
separate from Authentication credentials.

**Independent Test**: Create a complete draft Worker Profile for a person with
no Cleanora account, send an invitation as the exact Provider Owner, and verify
that the draft and invitation exist without a Provider-assigned password.

**Acceptance Scenarios**:

1. **Given** an active exact-Provider Owner and valid Worker data, **When** the
   Owner creates a Worker Profile, **Then** a `DRAFT` Worker engagement is
   recorded for that Provider without requiring an Authentication account.
2. **Given** an active exact-Provider Admin, **When** the Admin creates or edits
   a draft Worker Profile, **Then** the operational profile is saved but no
   login invitation or Provider Admin authority is granted.
3. **Given** a complete draft and an Owner with valid recent re-authentication,
   **When** the Owner sends the invitation, **Then** one current email
   invitation is issued for the exact engagement in the Owner-selected `AR` or
   `EN` locale and no password is selected by the Provider.
4. **Given** an actor without exact-Provider authority, **When** the actor tries
   to create, edit, or invite a Worker, **Then** the operation is denied without
   exposing another Provider's Worker or invitation data.

---

### User Story 2 - Accept, resend, expire, or revoke an invitation (Priority: P1)

An invited person uses the latest valid email invitation. A new user chooses a
password, while an existing user signs in and accepts without changing their
password. The person explicitly reviews the Provider's operational phone value,
and acceptance never rewrites Authentication phone data.

**Why this priority**: The invitation is the secure bridge between a
Provider-owned operational record and an Authentication-owned identity.

**Independent Test**: Accept one invitation as a new user and one as an existing
user, then verify the resulting identity link, Worker role, active login access,
operational-phone separation, and invalidation of expired, revoked, or replaced
links.

**Acceptance Scenarios**:

1. **Given** a new user with the latest unexpired invitation, **When** the user
   chooses a password, reviews the operational phone, and accepts, **Then** the
   Authentication identity is linked to the Worker engagement and Worker login
   access becomes `ACTIVE`.
2. **Given** an existing Cleanora user, **When** the user signs in and accepts a
   valid invitation, **Then** the existing password and any Customer role remain
   unchanged while the explicit Worker relationship is added.
3. **Given** an open invitation, **When** the Owner resends it, **Then** every
   earlier link becomes unusable, the replacement stores its newly selected
   `AR` or `EN` locale, and only the replacement invitation can be accepted.
4. **Given** an invitation older than 72 hours or revoked by the Owner, **When**
   anyone attempts to accept it, **Then** acceptance is denied with no partial
   identity, role, access, or engagement change.
5. **Given** an identity with a current Worker engagement at another Provider,
   **When** a competing invitation is accepted, **Then** the second engagement
   conflicts and the existing relationship is not disclosed beyond the safe
   conflict outcome.
6. **Given** an accepted Worker who later receives a lifecycle or access email,
   **When** a valid `UserPreferences.language` exists, **Then** that language is
   used; otherwise the last accepted invitation locale is used, and `AR` is the
   final fallback when neither source is valid.

---

### User Story 3 - Manage Worker lifecycle and access safely (Priority: P1)

The Owner and Admin manage the Worker's operational status without conflating it
with login access. The Owner alone controls high-risk access, removal, and
Provider Admin membership operations. Worker history remains durable through
deactivation and removal.

**Why this priority**: Provider operations need clear status and access control,
while historical records and shared Customer identities must remain safe.

**Independent Test**: Exercise every allowed Worker and login-access transition,
invalid transition, reason rule, recent-authentication rule, and last-cleaner
impact without changing unrelated Authentication or Provider membership truth.

**Acceptance Scenarios**:

1. **Given** a non-removed Worker, **When** the exact Provider Owner or Admin
   performs an allowed activation or deactivation with the required reason,
   **Then** only the Worker operational lifecycle changes and immutable history
   records the transition.
2. **Given** a Worker selected for removal, **When** the Owner supplies recent
   re-authentication, a valid reason code, and the required note, **Then** the
   engagement becomes terminal `REMOVED`, current Team membership and Worker
   access end, and historical facts remain available safely.
3. **Given** a Worker who also holds a Customer role or explicit Provider Admin
   membership, **When** Worker status changes, **Then** those separate
   relationships are not silently granted, revoked, or rewritten.
4. **Given** a stale expected version or competing lifecycle command, **When**
   the command is evaluated, **Then** it conflicts without a partial Worker,
   Team, access, history, readiness, audit, or notification change.
5. **Given** any reasoned command, **When** the supplied reason does not belong
   to that command's closed catalog or a required meaningful note is missing,
   **Then** the command is rejected with no business or side-effect change.

---

### User Story 4 - Create and maintain operational Teams (Priority: P1)

An Owner or Admin creates Teams, assigns Workers with an explicit cleaning fact,
activates valid Teams, and preserves membership history. Each Team may have one
eligible primary Supervisor, and each Worker may have only one current Team
membership.

**Why this priority**: Teams are the Provider's operational unit for evaluating
crew composition and scoped supervision.

**Independent Test**: Create an empty draft Team, add eligible members, activate
it, assign and clear a primary Supervisor, move a Worker between Teams, and
archive the Team while verifying every membership and lifecycle invariant.

**Acceptance Scenarios**:

1. **Given** an exact Provider, **When** an Owner or Admin creates a uniquely
   named Team with no members, **Then** the Team is saved as `DRAFT`.
2. **Given** a draft Team with a valid name and at least one active
   `CLEANING_STAFF` member whose membership records `cleans=true`, **When** an
   authorized actor activates it, **Then** the Team becomes `ACTIVE`.
3. **Given** an active Worker already assigned to one current Team, **When** an
   actor attempts a second current membership, **Then** the operation conflicts
   and neither Team is partially changed.
4. **Given** an active Team member with Supervisor capability, **When** that
   Worker is selected as primary Supervisor, **Then** the Team has exactly that
   one primary Supervisor.
5. **Given** a Team in `INACTIVE`, **When** it is archived, **Then** current
   memberships end, prior memberships remain historical, and the Team cannot
   leave `ARCHIVED`.

---

### User Story 5 - Preserve Team validity when Workers change (Priority: P1)

Before a Worker change would remove an active Team's final valid cleaning
Worker, the authorized user sees the exact operational impact and confirms it.
The Worker and Team changes then succeed or fail together.

**Why this priority**: Silent loss of an operational cleaning crew would create
misleading Team and readiness state.

**Independent Test**: Deactivate, remove, and accept departure of the final
valid cleaning Worker and prove that warning, confirmation, atomic Team
inactivation, readiness recalculation, and history all agree.

**Acceptance Scenarios**:

1. **Given** an active Team with one valid cleaning Worker, **When** that Worker
   is about to become inactive, removed, or departed, **Then** the user is shown
   that the Team will also become inactive before confirming.
2. **Given** the impact warning, **When** the authorized user confirms, **Then**
   the Worker change and Team transition to `INACTIVE` are committed atomically
   with separate history for both targets.
3. **Given** the same impact warning, **When** the user cancels or the command
   conflicts, **Then** neither the Worker nor Team lifecycle changes.
4. **Given** an inactive primary Supervisor who is not the final valid cleaner,
   **When** the Worker is deactivated, **Then** the primary-Supervisor assignment
   is cleared and the Team remains active because another valid cleaner remains.
5. **Given** a primary Supervisor and an active Team with one valid cleaning
   member, **When** the Supervisor requests `cleans=false` for that membership,
   **Then** the command returns a safe conflict directing the Supervisor to an
   Owner or Admin and changes nothing.
6. **Given** the same last-cleaner membership change requested by an Owner or
   Admin, **When** the exact Team impact is shown and explicitly confirmed,
   **Then** `cleans=false` and Team `INACTIVE` commit atomically with separate
   history for the membership and Team.

---

### User Story 6 - Enforce scoped authority and Worker privacy (Priority: P2)

Owners and explicit Provider Admins see and manage the exact Provider's
workforce. A primary Supervisor reads only their current Team and current-member
summaries and may edit only an existing current membership's `cleans` value in
that Team. A Worker sees only their own profile and operational context. Full
operational-phone values are revealed only to the approved roles.

**Why this priority**: Provider operations contain private contact and authority
data that must not leak across Providers, Teams, Workers, or Customers.

**Independent Test**: Run the same reads and writes as Owner, explicit Admin,
primary Supervisor, ordinary Worker, Customer, and cross-Provider actor and
compare the permitted scope and phone disclosure.

**Acceptance Scenarios**:

1. **Given** an explicit active exact-Provider Admin membership, **When** the
   member manages Worker Profiles, skills, Teams, membership, or operational
   states, **Then** the allowed operation succeeds without granting ownership or
   Admin authority to anyone else.
2. **Given** a primary Supervisor, **When** the Supervisor reads or manages a
   Worker outside the assigned Team, **Then** the operation is denied without
   disclosing that Worker's private data.
3. **Given** a primary Supervisor and an existing current membership in the
   assigned Team, **When** the Supervisor changes only that membership's
   `cleans` value without violating a Team invariant, **Then** the scoped change
   is permitted and attributed to the Supervisor.
4. **Given** a primary Supervisor, **When** the Supervisor attempts to add,
   remove, or move a member; edit a Worker Profile, skills, lifecycle,
   invitation, login access, or Admin membership; change Team name or lifecycle;
   assign or clear the primary Supervisor; or write an unapproved operational
   note, **Then** the operation is denied with no state change.
5. **Given** an ordinary Worker, **When** the Worker accesses the workforce,
   **Then** only the Worker's own profile and operational context are available
   and Provider-managed authority fields cannot be changed.
6. **Given** an Owner, explicit Admin, the Worker themself, or the exact Team's
   primary Supervisor, **When** the actor performs the authorized private read,
   **Then** the full operational phone may be shown.
7. **Given** another Worker or any Customer, **When** Worker data is presented,
   **Then** the other Worker never receives the full phone and the Customer
   receives no Worker phone value at all.

---

### User Story 7 - Classify Workers and evaluate crew composition (Priority: P2)

The Provider records a closed Worker type, optional title, normalized skills,
required gender, independent Supervisor capability, and membership-level
cleaning participation. Escorts remain fully auditable Workers without
qualifying as cleaning staff.

**Why this priority**: Cleanora must evaluate Team composition correctly without
turning temporary assignment facts or authority into permanent Worker types.

**Independent Test**: Create cleaning staff, Escort, and Other Workers; assign
skills, Supervisor capability, and Team memberships; then verify duplicate-skill
rejection and correct crew/readiness classification.

**Acceptance Scenarios**:

1. **Given** a Worker Profile, **When** the Provider selects a type, **Then** only
   `CLEANING_STAFF`, `ESCORT`, or `OTHER` is accepted.
2. **Given** a Worker of any type, **When** Supervisor capability is assigned or
   removed, **Then** the Worker type remains unchanged.
3. **Given** case- or spacing-equivalent skill tags on one Worker, **When** the
   Provider saves them, **Then** only one normalized skill association remains.
4. **Given** an Escort in a Team, **When** crew composition and
   `workersReady` are evaluated, **Then** the Escort remains visible as a Worker
   but is not counted as an eligible cleaning Worker.
5. **Given** an Escort membership, **When** any actor requests `cleans=true`,
   **Then** the command is rejected without changing `workerType`, membership,
   Team lifecycle, history, readiness, or notification truth.
6. **Given** a current `CLEANING_STAFF` membership with `cleans=true`, **When**
   an authorized actor attempts to change the Worker type to `ESCORT`, **Then**
   the type change conflicts until the membership is explicitly corrected to
   `cleans=false`.
7. **Given** Team membership with a `cleans` value, **When** the Worker moves or
   the membership ends, **Then** the value remains part of membership history
   and does not become a permanent Worker trait.

---

### User Story 8 - Leave, remove, and rehire without losing history (Priority: P2)

A Worker may leave the Provider and an Owner may remove the Worker. Either path
ends the current engagement safely and notifies the other party. A later rehire
creates a new linked engagement rather than reopening the terminal record.

**Why this priority**: Workforce turnover must preserve accountability and
historical bookings without blocking legitimate later re-employment.

**Independent Test**: Complete one Owner removal and one Worker departure, then
rehire the same identity and verify terminal history, new engagement identity,
single-current-engagement enforcement, and notifications.

**Acceptance Scenarios**:

1. **Given** an accepted current engagement, **When** the Worker leaves, **Then**
   Provider-scoped Worker access and current Team membership end, the Provider is
   notified, and the shared Authentication identity is not disabled.
2. **Given** a current engagement, **When** the Owner removes the Worker with all
   required high-risk controls, **Then** the Worker is notified and the removed
   engagement remains immutable history.
3. **Given** a previously removed Worker, **When** the Provider rehires the same
   identity, **Then** a new engagement links to the predecessor and the removed
   engagement is not reopened.
4. **Given** a person whose current engagement is merely `INACTIVE`, **When** a
   different Provider tries to engage that identity, **Then** the new engagement
   conflicts until the current relationship ends.

### Edge Cases

- A Provider creates a Worker Profile before any matching Authentication
  identity exists.
- An invitation is accepted exactly as it expires, is revoked, or is replaced
  by a resend; only one terminal outcome may win.
- Two Providers concurrently try to establish a current engagement for the same
  existing identity.
- An identical create, invitation, lifecycle, authority, or membership command
  is retried after its result is unknown.
- A reason code valid for one command type is submitted to a different command,
  or a Worker-removal/`OTHER` note is fewer than 10 meaningful characters.
- Two actors submit different commands against the same expected version.
- A Worker with both Customer and Worker roles leaves the Provider.
- A Worker also has explicit Provider Admin membership when the Worker
  engagement is deactivated or removed.
- A primary Supervisor loses Supervisor capability, leaves the Team, becomes
  inactive, or is removed.
- A primary Supervisor is also the final valid cleaning Worker in an active
  Team.
- A Worker is moved between Teams while another actor changes either Team.
- A normalized Team name collides by case or insignificant spacing with another
  non-archived Team.
- A previously archived Team name is reused by a new Team.
- A draft Team is activated with only Escorts, inactive Workers, or members with
  `cleans=false`.
- An actor requests `cleans=true` for an Escort, or changes a current cleaning
  member's Worker type to `ESCORT` before explicitly setting `cleans=false`.
- An active Team loses its final valid cleaner because of Worker departure,
  removal, deactivation, or membership change.
- A primary Supervisor attempts to clear `cleans` from the final valid cleaner
  while an Owner or Admin concurrently changes the Team or membership version.
- The final Provider Worker eligible for `workersReady` is deactivated or
  removed while active Teams still exist.
- An Owner creates an explicit Worker engagement for their own identity.
- An invitation is accepted, but a notification email later fails.
- An invitation resend selects a different locale, or a recipient has a missing
  or invalid preference and no valid accepted-invitation locale.
- An avatar is oversized, unsupported, malformed, incorrectly oriented, or
  contains unsafe metadata.
- A skill is added twice using different case or whitespace.
- A generic history, audit, log, notification, or error path attempts to include
  the full phone, invitation token, or credential material.

## Scope Boundaries

### In Scope

- Provider-owned Worker engagements and operational profiles.
- Secure email invitation and Worker login-access lifecycle coordination.
- Worker lifecycle, departure, removal, and linked rehire.
- Explicit Provider Owner, Admin, Supervisor, and Worker authorization scopes.
- Worker operational-phone privacy and private avatar behavior.
- Worker type, required gender, optional title, normalized skills, and
  independent Supervisor capability.
- Team lifecycle, unique naming, one current membership per Worker, primary
  Supervisor, membership-level `cleans`, and historical membership.
- Atomic last-cleaner impact behavior and the `workersReady` readiness gate.
- Version-aware commands, idempotent retries, reason policy, immutable history,
  safe audit evidence, and localized notification intents.

### Out of Scope

- Customer booking, Worker assignment to an order, assignment snapshots,
  schedules, shifts, availability, capacity, attendance, or time tracking.
- Customer-facing Worker contact details, public Worker directories, public
  avatars, direct booking, WhatsApp, social, or external contact paths.
- Service-catalog ownership or final mapping of Worker skills to R1-P08 catalog
  entries.
- Provider application, verification documents, payout destinations, payouts,
  payroll, compensation, settlements, or stored-value wallets.
- SMS phone verification, automatic synchronization with Authentication phone,
  or treating the operational phone as verified Authentication data.
- Ownership transfer, automatic Admin promotion, automatic Supervisor
  promotion, or automatic replacement of an ineligible Worker.
- HTTP endpoint names, transport request/response schemas, technical module
  contracts, persistence design, migrations, deployment, or implementation.

## Requirements *(mandatory)*

### Functional Requirements

#### Identity, engagement, and invitation

- **FR-001**: The system MUST maintain each Worker Profile and Worker engagement
  as Provider-owned operational truth separate from Authentication identity and
  credentials.
- **FR-002**: The system MUST allow an authorized exact-Provider Owner or Admin
  to create a Worker Profile before the invited person completes an
  Authentication account.
- **FR-003**: The system MUST permit one Authentication identity to hold both
  `CUSTOMER` and `WORKER` roles without merging their data or lifecycle.
- **FR-004**: The system MUST allow a person to have at most one current
  Provider Worker engagement across Cleanora.
- **FR-005**: The system MUST treat `DRAFT`, `ACTIVE`, and `INACTIVE`
  engagements as current and MUST make another Provider eligible to engage the
  same identity only after `REMOVED` or Worker departure ends the prior
  relationship.
- **FR-006**: The system MUST block competing current engagements without
  disclosing the other Provider or its private Worker data.
- **FR-007**: The system MUST create a new engagement linked to the prior
  terminal engagement when a removed Worker is rehired and MUST NOT reopen the
  `REMOVED` engagement.
- **FR-008**: The system MUST allow the exact Provider Owner to remove a Worker
  and an accepted Worker to leave the Provider, preserving history and notifying
  the other party in both cases.
- **FR-009**: Ending a Worker engagement MUST end only Provider-scoped Worker
  access and MUST NOT disable the shared Authentication identity or remove an
  unrelated Customer relationship.
- **FR-010**: Only an active exact-Provider Owner MAY initiate, resend, reset, or
  revoke Worker login access or its invitation.
- **FR-011**: Worker invitations MUST be delivered by email, MUST contain no
  Provider-selected password, and MUST store the Owner-selected locale `AR` or
  `EN` with each exact invitation version, including every resend.
- **FR-012**: A new invited user MUST choose their own password; an existing user
  MUST sign in and accept without changing the existing password.
- **FR-013**: An invitation MUST expire 72 hours after issuance if it has not
  already been accepted, revoked, expired, or replaced.
- **FR-014**: Resending an invitation MUST invalidate every prior invitation
  link for the exact engagement before the replacement can be accepted.
- **FR-015**: Revocation MUST make the outstanding invitation unusable without
  deleting the Worker Profile or its invitation history.
- **FR-016**: Only the latest valid, unexpired, unrevoked invitation MAY establish
  the identity link and active login access.
- **FR-017**: Invitation acceptance MUST require the Worker to review the
  Provider's operational phone value and MUST keep any confirmed or corrected
  value separate from Authentication phone data.
- **FR-018**: Successful acceptance MUST associate the exact Authentication
  identity, establish the Worker role, and make Worker login access `ACTIVE`
  without changing an existing Customer role.
- **FR-019**: Worker login access MUST use the distinct states `INVITED`,
  `ACTIVE`, `EXPIRED`, and `REVOKED` and MUST NOT be inferred from Worker
  operational status.
- **FR-020**: Failed, expired, revoked, stale, or competing invitation commands
  MUST leave identity, role, access, engagement, history, and notification truth
  free of partial changes.

#### Worker profile, privacy, and avatar

- **FR-021**: A Worker Profile MUST record the Worker's name, required gender,
  operational phone normalized to E.164, and one valid `workerType` before the
  profile is considered complete.
- **FR-022**: Required gender MUST use the approved values `male` or `female`.
- **FR-023**: Display title, avatar, and skill tags MUST remain optional Worker
  Profile content.
- **FR-024**: The operational phone MUST remain independent of Authentication
  phone and MUST NOT automatically update it or imply Authentication-phone
  verification.
- **FR-025**: The full operational phone MAY be revealed only to the exact
  Provider Owner, an explicit active exact-Provider Admin, the Worker themself,
  or the primary Supervisor of the Worker's current Team.
- **FR-026**: A primary Supervisor MUST lose full-phone access when the Worker is
  no longer a current member of that Supervisor's Team or the Supervisor
  assignment is no longer valid.
- **FR-027**: Other Workers MUST NOT receive the full operational phone, and
  Customers MUST receive no Worker phone value.
- **FR-028**: Generic responses, logs, history, audit evidence, errors, and
  notification content MUST exclude the full operational phone, invitation
  tokens, passwords, credentials, and equivalent secrets.
- **FR-029**: Worker avatar input MUST accept JPEG, PNG, or WebP up to 5 MiB and
  MUST reject unsupported, oversized, malformed, or unsafe input.
- **FR-030**: Avatar processing MUST correct orientation safely, remove unsafe
  metadata, and produce a private WebP rendition no larger than 1200 pixels on
  its longest edge.
- **FR-031**: Worker avatar bytes and delivery MUST remain private and
  Media-owned; R1-P07 MUST NOT introduce public avatar visibility.
- **FR-032**: No Worker type, title, skill, gender, Supervisor capability,
  avatar, phone, or other profile attribute MAY grant Provider Owner or Admin
  authority.

#### Authority and recent authentication

- **FR-033**: Provider Admin authority MUST come only from explicit active
  `provider_members.ADMIN` membership for the exact Provider.
- **FR-034**: The same identity MAY act as Worker and Provider Admin only when
  both the Worker engagement and explicit Admin membership exist independently.
- **FR-035**: Only the exact Provider Owner MAY grant or revoke Provider Admin
  membership, remove a Worker, revoke Worker access, or initiate or reset login
  access.
- **FR-036**: An explicit active Provider Admin MAY manage Worker Profiles,
  skills, Teams, Team memberships, primary-Supervisor assignment, and Worker and
  Team operational states but MUST NOT grant ownership or Admin authority.
- **FR-037**: A primary Supervisor MAY read only the exact current Team and its
  current-member summaries and MAY modify only `cleans` on an existing current
  membership in that Team. The Supervisor MUST NOT add, remove, or move members;
  create or edit Worker Profiles, skills, Worker lifecycle, invitations, login
  access, or Admin membership; change Team name or lifecycle; assign or clear
  the primary Supervisor; or write operational notes or any other unapproved
  daily-operation field.
- **FR-038**: A Worker MAY read only their own Worker Profile and operational
  context and MUST NOT change their Provider-managed authority, lifecycle, type,
  skill, or Team administration.
- **FR-039**: Worker lifecycle or Team-membership changes MUST NOT implicitly
  grant or revoke a separate Provider Admin membership.
- **FR-040**: Login-access creation or reset, Admin grant or revocation, Worker
  removal, and access revocation MUST require an Authentication-owned recent
  re-authentication proof no older than 10 minutes.
- **FR-041**: Ordinary name, title, phone, skill, avatar, Team-membership,
  Supervisor-assignment, and allowed operational-state edits MUST NOT require
  step-up authentication unless they also perform a separately listed high-risk
  action.

#### Worker lifecycle and departure

- **FR-042**: Worker operational lifecycle MUST be exactly
  `DRAFT → ACTIVE ↔ INACTIVE → REMOVED`, with removal also allowed from any
  non-removed current state by the authorized Owner.
- **FR-043**: `REMOVED` MUST be terminal and MUST NOT be reopened, overwritten,
  or hard-deleted through ordinary operations.
- **FR-044**: Only the exact Provider Owner or Admin MAY perform ordinary Worker
  activation, deactivation, and reactivation; only the Owner MAY remove.
- **FR-045**: Worker deactivation and removal MUST require a reason from the
  exact closed action catalog defined by FR-081; a code from another action's
  catalog MUST be rejected.
- **FR-046**: Worker removal and any action whose accepted reason is `OTHER`
  MUST also require a meaningful note of at least 10 characters.
- **FR-047**: Worker removal MUST end current Team membership and Worker login
  access while preserving historical engagement, membership, lifecycle, and
  booking references.
- **FR-048**: Worker departure MUST end the current engagement, Team membership,
  and Provider-scoped Worker access while preserving the shared Authentication
  identity and retained history.
- **FR-049**: Worker removal and departure MUST notify the other party through
  the durable notification workflow.
- **FR-050**: Before an Owner or Admin accepts a deactivation, removal,
  departure, or membership `cleans=false` change that removes an active Team's
  final valid cleaning Worker, the system MUST show the exact Team impact and
  require explicit confirmation.
- **FR-051**: A primary Supervisor's attempt to set `cleans=false` for the final
  valid cleaning member of an `ACTIVE` Team MUST return a safe conflict directing
  the actor to an Owner or Admin and MUST change no state or side effect. After
  an Owner or Admin confirms the impact required by FR-050, the Worker or
  membership change and Team transition to `INACTIVE` MUST commit atomically
  with separate history for every affected truth; cancellation, stale version,
  competing command, or failure MUST change nothing.

#### Worker classification, skills, Teams, and crew composition

- **FR-052**: `workerType` MUST accept exactly `CLEANING_STAFF`, `ESCORT`, or
  `OTHER`.
- **FR-053**: Supervisor capability MUST remain independent of `workerType` and
  MUST NOT change the Worker's type when granted or removed.
- **FR-054**: `cleans` MUST be recorded on Team membership, not as a permanent
  Worker attribute, and retained with membership history.
- **FR-055**: R1-P07 MUST expose the membership cleaning fact for later Booking
  assignment snapshotting but MUST NOT create or execute a Booking assignment.
- **FR-056**: An Escort MUST be represented as a complete auditable Worker;
  every current or new Team membership for an `ESCORT` MUST have `cleans=false`.
  A command requesting `cleans=true` for an Escort MUST be rejected without
  changing `workerType`. A change from `CLEANING_STAFF` to `ESCORT` MUST be
  rejected while the Worker's current membership has `cleans=true`, requiring
  an explicit membership correction first. An Escort MUST NOT qualify as an
  active cleaning Worker or satisfy `workersReady`.
- **FR-057**: Worker skills MUST be Provider-managed normalized tags and MUST
  reject duplicates within the same Worker after normalization.
- **FR-058**: Skill tags MAY be linked to the R1-P08 catalog later, but R1-P07
  MUST NOT depend on that catalog to manage current Worker skills.
- **FR-059**: A Worker MUST have at most one current Team membership at a time,
  and all ended memberships MUST remain historical.
- **FR-060**: Team lifecycle MUST be exactly
  `DRAFT → ACTIVE ↔ INACTIVE → ARCHIVED` and `ARCHIVED` MUST be terminal.
- **FR-061**: A Team name MUST be normalized and unique among the exact
  Provider's non-archived Teams; case- or spacing-equivalent names MUST conflict.
- **FR-062**: A `DRAFT` Team MAY contain no members.
- **FR-063**: Team activation MUST require a valid unique name and at least one
  current member who is an `ACTIVE` `CLEANING_STAFF` Worker with
  membership-level `cleans=true`.
- **FR-064**: Each Team MAY have at most one primary Supervisor, and the selected
  person MUST be an active Worker, a current member of that Team, and hold
  Supervisor capability.
- **FR-065**: When the primary Supervisor becomes inactive, removed, departed,
  loses capability, or leaves the Team, the primary assignment MUST be cleared.
- **FR-066**: Clearing or losing a primary Supervisor MUST NOT inactivate the
  Team when another valid active cleaning Worker remains.
- **FR-067**: Making a Team `INACTIVE` MUST NOT change the operational status of
  its Workers.
- **FR-068**: Archiving an `INACTIVE` Team MUST end every current membership,
  retain Team and membership history, and prevent any later lifecycle change.
- **FR-069**: Crew composition MUST be evaluable from current Worker gender,
  type, Team membership, and membership-level cleaning participation without
  counting Escorts as cleaning Workers.

#### `workersReady`

- **FR-070**: `workersReady` MUST be satisfied when at least one Worker has
  operational status `ACTIVE`, `workerType=CLEANING_STAFF`, a complete required
  profile, an Authentication account, the Worker role, and active login access.
- **FR-071**: Team membership MUST NOT be required for a qualifying Worker to
  satisfy `workersReady`.
- **FR-072**: A Provider Owner MAY count toward `workersReady` only when the same
  identity has an explicit qualifying Worker engagement.
- **FR-073**: An Escort, an `OTHER` Worker, a Supervisor who is not otherwise an
  eligible cleaning Worker, an incomplete profile, or an unaccepted invitation
  MUST NOT satisfy `workersReady`.
- **FR-074**: Before deactivating or removing the final Worker qualifying for
  `workersReady`, the system MUST show the readiness impact and require explicit
  confirmation.
- **FR-075**: After confirmed loss of the final qualifying Worker,
  `workersReady` MUST become unsatisfied in the same accepted business change
  and MUST NOT auto-promote or auto-activate another Worker.

#### Concurrency, history, reasons, and notifications

- **FR-076**: Every Worker lifecycle, login-access, invitation, Provider Admin
  membership, Team lifecycle, Team membership, and primary-Supervisor command
  MUST carry `expectedVersion` and `idempotencyKey`.
- **FR-077**: An identical retry with the same idempotency identity and command
  meaning MUST return the accepted prior outcome without duplicating state,
  history, audit, readiness, or notifications.
- **FR-078**: A stale expected version or competing command MUST return a safe
  conflict and MUST NOT leave partial state or side effects.
- **FR-079**: Immutable lifecycle and decision history MUST record actor,
  timestamp, target, exact target version, transition or action, and safe
  before/after facts.
- **FR-080**: History and audit evidence MUST preserve the relationship between
  a rehired engagement and its predecessor without exposing full operational
  phone, invitation tokens, credentials, or other secrets.
- **FR-081**: A reason code MUST be required and validated against only the
  command-specific closed catalog: Worker deactivation accepts
  `TEMPORARILY_UNAVAILABLE`, `SCHEDULE_OR_LEAVE`, `PERFORMANCE_OR_POLICY`,
  `PROVIDER_OPERATIONAL_CHANGE`, or `OTHER`; Worker removal accepts
  `ENGAGEMENT_ENDED`, `PERFORMANCE_OR_POLICY`,
  `DUPLICATE_OR_INCORRECT_RECORD`, or `OTHER`; login-access revocation accepts
  `SECURITY_CONCERN`, `ACCESS_NO_LONGER_REQUIRED`, `ENGAGEMENT_ENDED`, or
  `OTHER`; Provider Admin grant accepts `OPERATIONAL_RESPONSIBILITY`,
  `COVERAGE_OR_BACKUP`, or `OTHER`; and Provider Admin revocation accepts
  `RESPONSIBILITY_ENDED`, `SECURITY_CONCERN`, `ENGAGEMENT_ENDED`, or `OTHER`.
- **FR-082**: Every Worker removal, regardless of reason, and every command using
  reason `OTHER` MUST require a meaningful note of at least 10 characters; other
  accepted reasons MUST NOT require a note unless another requirement does.
- **FR-083**: Routine name, title, operational-phone, skill, avatar, and
  Team-membership edits MUST NOT require a reason unless combined with a
  separately reasoned action.
- **FR-084**: Invitation creation and each resend MUST use the Owner-selected
  `AR` or `EN` locale stored with that exact invitation version. After
  acceptance, access changes, Worker lifecycle changes, Provider Admin grant or
  revocation, Worker departure, and Worker removal MUST create durable email
  intents using the recipient's valid `UserPreferences.language`, otherwise the
  Worker's last accepted-invitation locale, otherwise final fallback `AR`.
- **FR-085**: Notification locale MUST be part of each intent's immutable
  meaning. Intents MUST be idempotent for the accepted business event and MUST
  contain only safe facts.
- **FR-086**: Notification delivery failure, retry, or terminal failure MUST NOT
  roll back, duplicate, or rewrite accepted Worker, Team, access, authority,
  history, readiness, or selected-locale truth.
- **FR-087**: Every allowed or denied high-risk operation MUST retain safe,
  attributable evidence without secrets or unnecessary personal data.
- **FR-088**: Cross-Provider reads and commands MUST fail closed without
  revealing whether a private Worker, Team, invitation, or engagement exists.

### Lifecycle Transition Matrices

#### Worker operational lifecycle

| From | To | Authorized actor | Required controls |
|---|---|---|---|
| `DRAFT` | `ACTIVE` | Exact Provider Owner or Admin | Exact version; idempotency |
| `ACTIVE` | `INACTIVE` | Exact Provider Owner or Admin | Exact version; idempotency; Worker-deactivation reason catalog; impact confirmation when applicable |
| `INACTIVE` | `ACTIVE` | Exact Provider Owner or Admin | Exact version; idempotency |
| `DRAFT`, `ACTIVE`, or `INACTIVE` | `REMOVED` | Exact Provider Owner | Exact version; idempotency; recent re-authentication; Worker-removal reason catalog and meaningful note; impact confirmation when applicable |
| Any current accepted state | `REMOVED` by departure | Exact Worker themself | Exact version; idempotency; impact confirmation when applicable |
| `REMOVED` | Any state | Nobody | Prohibited; rehire creates a linked new engagement |

#### Login-access lifecycle

| From | To | Cause | Required outcome |
|---|---|---|---|
| No access | `INVITED` | Owner initiates access | One current invitation; recent re-authentication |
| `INVITED` | `ACTIVE` | Invited person accepts latest valid invitation | Identity link, Worker role, active access, no Customer-role or Authentication-phone rewrite |
| `INVITED` | `EXPIRED` | 72-hour limit reached | Link unusable; history retained |
| `INVITED` | `REVOKED` | Owner revokes access | Link unusable; history retained |
| `ACTIVE` | `REVOKED` | Owner revokes access or engagement ends | Provider-scoped Worker access ends; shared identity remains |
| `EXPIRED` or `REVOKED` | `INVITED` | Owner issues a new invitation version | Prior link remains terminal; replacement is independently tracked |

#### Team lifecycle

| From | To | Authorized actor | Required controls |
|---|---|---|---|
| New | `DRAFT` | Exact Provider Owner or Admin | Unique normalized name when supplied; exact version; idempotency |
| `DRAFT` | `ACTIVE` | Exact Provider Owner or Admin | Valid unique name and at least one valid active cleaning member |
| `ACTIVE` | `INACTIVE` | Exact Provider Owner or Admin, including an atomic last-cleaner consequence | Exact Team and affected-target versions; idempotency; impact confirmation; Supervisor-only last-cleaner commands conflict |
| `INACTIVE` | `ACTIVE` | Exact Provider Owner or Admin | Activation invariants satisfied |
| `INACTIVE` | `ARCHIVED` | Exact Provider Owner or Admin | End current memberships; retain history |
| `ARCHIVED` | Any state | Nobody | Prohibited |

### Key Entities

- **Authentication Identity**: Authentication-owned person and credential
  identity that may hold Customer and Worker roles and is not owned by the
  Provider workforce domain.
- **Provider Membership**: The exact-Provider Owner or Admin relationship that
  grants Provider authority independently of Worker Profile data.
- **Worker Engagement**: The historical Provider-to-person relationship with a
  single current lifecycle, version, predecessor link when rehired, and exact
  Provider ownership.
- **Worker Profile**: Provider-managed operational facts including name, gender,
  operational phone, Worker type, optional title, private avatar association,
  skills, and Supervisor capability.
- **Worker Login Access**: The engagement-scoped invitation and access lifecycle
  that coordinates with Authentication without owning passwords or global
  account truth.
- **Worker Skill**: A normalized Provider-managed capability tag unique within
  one Worker and optionally linkable to a future catalog.
- **Provider Team**: A Provider-owned operational grouping with unique
  normalized name, lifecycle, optional primary Supervisor, version, and
  retained history.
- **Team Membership**: The historical relationship between one Worker and one
  Team, including its current/ended truth and contextual `cleans` value.
- **Worker and Team History**: Immutable actor-, time-, target-, version-, and
  transition-attributed safe evidence for lifecycle and material decisions.
- **Notification Intent**: A localized, idempotent, safe email-delivery request
  whose immutable locale follows the invitation-version or post-acceptance
  fallback rule and that is derived from accepted invitation, access,
  lifecycle, authority, departure, or removal truth.
- **`workersReady` Projection**: Provider readiness truth derived only from the
  current set of qualifying Workers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized Owner can create a complete Worker Profile and issue
  a valid invitation in no more than 3 minutes using valid information.
- **SC-002**: At least 95% of invited users with valid information can accept an
  invitation on their first attempt in no more than 2 minutes, excluding email
  delivery time.
- **SC-003**: 100% of expired, revoked, or superseded invitation links are
  rejected without establishing partial identity, role, access, or engagement
  state.
- **SC-004**: 100% of tested Worker, login-access, and Team lifecycle commands
  follow the approved transition matrices; invalid transitions change no state.
- **SC-005**: 100% of tested cross-Provider and out-of-scope Supervisor or Worker
  access attempts are denied without exposing private existence or contact data.
- **SC-006**: 100% of Customer-facing Worker representations omit Worker phone,
  and 100% of unauthorized Worker representations omit the full phone.
- **SC-007**: `workersReady` agrees with the qualifying-Worker rule after 100% of
  tested invitation, profile, role, access, activation, deactivation, removal,
  departure, and rehire changes.
- **SC-008**: 100% of tested primary-Supervisor final-cleaner commands are
  rejected with zero state change, and 100% of corresponding confirmed
  Owner/Admin commands atomically update the affected Worker or membership and
  Team or update neither target.
- **SC-009**: 100% of tested duplicate current Team memberships, normalized Team
  names, and normalized per-Worker skills are prevented without partial state.
- **SC-010**: 100% of matching idempotent retries reproduce the accepted outcome
  without duplicate history, audit evidence, readiness changes, or notification
  intents.
- **SC-011**: 100% of stale or competing tested commands return a safe conflict
  with no partial business or side-effect state.
- **SC-012**: 100% of tested history, audit, logs, errors, and notification
  content excludes full operational phone values, invitation tokens, passwords,
  and credentials.
- **SC-013**: 100% of accepted high-risk operations have valid recent
  re-authentication, required reasons or notes, actor attribution, exact target
  version, timestamp, and safe evidence.
- **SC-014**: Email-delivery failure changes 0% of already accepted Worker, Team,
  access, authority, history, or readiness outcomes.

## Assumptions

- DEC-038 is the approved product baseline and contains all currently known
  material R1-P07 decisions.
- A complete Worker Profile requires name, required gender, E.164 operational
  phone, and `workerType`; title, avatar, and skills are optional.
- The exact Provider Owner and explicit Provider Admin membership truth already
  exist from completed Provider phases and remain distinct from Worker data.
- Authentication already owns identities, passwords, roles, sessions, account
  status, and recent re-authentication proofs; R1-P07 consumes that truth without
  redefining it.
- Media already provides the approved private profile-image behavior reused for
  Worker avatars.
- Durable localized email delivery already follows the repository notification
  intent pattern; delivery may be delayed or fail without changing business
  truth.
- `UserPreferences.language` is the authoritative post-acceptance recipient
  preference when it contains supported `AR` or `EN`; the accepted invitation
  locale and then `AR` provide deterministic fallbacks.
- Team-name and skill-tag normalization treats case and insignificant
  surrounding or repeated spacing as equivalent; exact normalization mechanics
  are deferred to technical planning without changing the approved uniqueness
  behavior.
- Customer booking and assignment do not belong to R1-P07. A later Booking phase
  may copy the Team-membership `cleans` value as an assignment snapshot.
- No unresolved item in `docs/product/open-questions.md` blocks this
  specification. Any genuinely new material ambiguity requires a separately
  authorized clarification workflow and human approval.

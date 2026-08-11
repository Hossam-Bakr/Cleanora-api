# Feature Specification: Provider Onboarding, Profile & Lifecycle

**Feature Branch**: `n/a — no branch created for specification preparation`  
**Created**: 2026-08-10  
**Status**: **Complete** — clarified, planned, task-mapped, implemented,
independently reviewed, and closed through T159  
**Input**: Human-owner-approved R1-P05 provider onboarding, provider-kind,
staff-review, privacy, media, membership, completion/readiness, dashboard, and
settings decisions recorded in DEC-036.

## Clarifications

### Session 2026-08-10

- Q: How is the applicant authorized to edit and submit before Staff Admin
  approval if Provider OWNER membership is granted only on approval? → A: The
  creator acts as `Application Owner` with draft-scoped edit and submission
  rights only; approval atomically grants `PROVIDER_OWNER`, `provider_admin`,
  and active Provider `OWNER` membership.
- Q: What happens to application approval when OWNER or ADMIN changes permitted
  profile, contact, or media data after approval? → A: The application remains
  `APPROVED`; completion and readiness are recalculated and version/audit
  evidence is preserved, while public eligibility remains false in R1-P05.
- Q: Do Registered Company documents contribute to `profileCompletion` or stay
  as a separate readiness gate? → A: Documents are excluded from
  `profileCompletion` for every kind and remain a separate
  `marketplaceReadiness` gate; Individual Team is `NOT_REQUIRED`, while
  Registered Company stays blocked on R1-P06 without lowering profile
  completion.
- Q: What are the equal-weight atomic checks in profile-completion policy v1?
  → A: Ten checks, each worth 10%: eligible verified category, complete matching
  customer profile, Arabic display name, Arabic description, operational email,
  operational phone, active country, READY logo, READY cover, and at least three
  READY gallery images. The first two are evaluated for the selected provider
  kind.
- Q: What may OWNER and ADMIN do while a Provider is `SUSPENDED`, and where does
  Staff Admin reinstatement return it in R1-P05? → A: Authorized management and
  remediation remain available, but operational/public eligibility is denied;
  reinstatement returns the Provider to `INACTIVE` only and never automatically
  to `LIVE`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Individual Team Application (Priority: P1)

As a verified Individual with a completed Individual profile, I can start one
provider application as an `INDIVIDUAL_TEAM` so that my cleaning team can enter
Cleanora's controlled provider review process.

**Why this priority**: It represents Mahmoud's primary onboarding journey and
establishes the eligibility and single-provider invariants.

**Independent Test**: Use a verified Individual with a matching profile to
create and retrieve one draft, then prove an unverified Individual, an Engineer,
and a second owned-provider attempt cannot create another eligible draft.

**Acceptance Scenarios**:

1. **Given** a verified Individual with a complete matching profile and no owned
   Provider, **When** the user starts an application, **Then** one
   `INDIVIDUAL_TEAM` draft is created from authoritative identity facts and the
   creator becomes its draft-scoped `Application Owner` without receiving
   Provider membership or global provider authority.
2. **Given** an Individual category that is not verified or lacks its matching
   profile, **When** the user attempts to apply, **Then** the attempt is denied
   with a safe eligibility reason and no Provider is created.
3. **Given** an Engineer-only identity, **When** the user attempts to apply,
   **Then** the attempt is denied because Engineer is not an eligible provider
   applicant in R1-P05.
4. **Given** a user who already owns a Provider, **When** the user attempts to
   start another application, **Then** the existing Provider is returned or the
   duplicate attempt is denied without creating a second owned Provider.

---

### User Story 2 - Registered Company Application (Priority: P1)

As a verified Company with a completed Company profile, I can start one
provider application as a `REGISTERED_COMPANY` while keeping my Company account
identity separate from the marketplace Provider record.

**Why this priority**: Company onboarding is a co-equal approved entry path with
kind-specific readiness behavior.

**Independent Test**: Create a Company provider draft from verified Company
identity facts and verify Company name and representative context are resolved
without treating the Company category itself as the Provider.

**Acceptance Scenarios**:

1. **Given** a verified Company with its matching profile and no owned Provider,
   **When** the user starts an application, **Then** one
   `REGISTERED_COMPANY` draft is created.
2. **Given** a user with both verified Individual and Company categories,
   **When** the user chooses one eligible kind for the initial draft, **Then**
   the chosen kind is used and no second application is created.
3. **Given** a never-submitted draft and both eligible categories, **When** the
   owner changes the kind, **Then** the kind and authoritative identity context
   change together.
4. **Given** a draft that has been submitted at least once, **When** the owner
   attempts to change its kind, **Then** the change is denied.

---

### User Story 3 - Complete Profile and Private Contacts (Priority: P1)

As the `Application Owner` before approval, or an authorized Provider OWNER or
ADMIN after approval, I can complete the editable provider profile and private
operational contacts without exposing direct contact paths to customers.

**Why this priority**: Review needs an identifiable, complete provider while
Cleanora must prevent off-platform customer contact.

**Independent Test**: Complete the required Arabic profile, optional English
profile, active country, email, and phone, then inspect the protected preview
and confirm every direct contact field is absent.

**Acceptance Scenarios**:

1. **Given** an editable application, **When** its `Application Owner` supplies
   Arabic display name and description, an active country, and private
   operational email and phone, **Then** the accepted values contribute to
   profile completion.
2. **Given** English display name or description is omitted, **When** other
   applicable requirements are complete, **Then** the omission does not block
   completion.
3. **Given** missing Arabic content, inactive country, missing phone, or missing
   email, **When** completion is calculated, **Then** the corresponding required
   item remains incomplete.
4. **Given** a protected provider preview, **When** any authorized viewer reads
   it, **Then** email, phone, WhatsApp, social, website, and external-booking
   references are absent.
5. **Given** an approved inactive Provider, **When** OWNER or ADMIN makes a
   permitted profile or private-contact edit, **Then** application status
   remains `APPROVED`, completion and readiness are recalculated, and version
   and audit evidence are preserved.

---

### User Story 4 - Complete Provider Media (Priority: P1)

As the `Application Owner` before approval, or an authorized Provider OWNER or
ADMIN after approval, I can manage a safe logo, cover, gallery images, and
videos within fixed limits so that the provider has suitable marketplace
presentation material.

**Why this priority**: Required media is part of submission completeness and
future customer trust.

**Independent Test**: Add one ready logo, one ready cover, three ready gallery
images, and optional videos, then test every count, size, type, readiness, and
dimension boundary.

**Acceptance Scenarios**:

1. **Given** an editable application with a ready logo, ready cover, and three
   ready gallery images, **When** completion is recalculated, **Then** all
   required media checks are satisfied.
2. **Given** only two ready gallery images or processing media, **When** the
   owner attempts submission, **Then** submission remains blocked.
3. **Given** 12 gallery images, **When** an authorized actor attempts to add a
   13th, **Then** the attempt is denied without losing existing media.
4. **Given** two gallery videos, **When** an authorized actor attempts to add a
   third, **Then** the attempt is denied.
5. **Given** unsupported or oversized media, **When** it is supplied, **Then**
   it is rejected and never contributes to completion.
6. **Given** an approved inactive Provider, **When** OWNER or ADMIN makes a
   permitted media change, **Then** approval remains valid, completion and
   readiness reflect only READY media, and public eligibility remains false.

---

### User Story 5 - Application Owner Submission and Resubmission (Priority: P1)

As the draft's `Application Owner`, I can submit a complete draft for review
and resubmit it after addressing requested changes without receiving Provider
membership before approval.

**Why this priority**: Submission is the owner-controlled boundary between
editable content and staff review.

**Independent Test**: Submit a complete draft, prove it locks, request changes,
resume editing, and resubmit while retaining both review cycles.

**Acceptance Scenarios**:

1. **Given** every applicable R1-P05 submission requirement is complete,
   **When** the `Application Owner` submits, **Then** status becomes
   `PENDING_REVIEW`, a review cycle is recorded, and editable application,
   profile, contact, and media content locks.
2. **Given** any required profile or media item is incomplete, **When** the
   `Application Owner` submits, **Then** submission is denied with all current
   blockers.
3. **Given** any user other than the `Application Owner`, **When** that user
   attempts to edit, submit, or resubmit, **Then** the action is denied.
4. **Given** `CHANGES_REQUESTED`, **When** the `Application Owner` resumes
   editing, addresses blockers, and resubmits, **Then** a new pending review
   cycle is created and previous decisions remain visible.

---

### User Story 6 - Staff Approval (Priority: P1)

As a Staff Admin, I can review a pending application and approve it atomically
so that the applicant becomes the controlled owner of an approved but inactive
Provider.

**Why this priority**: Approval is the only path to Provider ownership and is a
privileged integrity boundary.

**Independent Test**: Approve one pending application and verify application
approval, internal Provider Owner category, global provider-admin authority,
OWNER membership, history, and audit succeed together while operational status
remains inactive.

**Acceptance Scenarios**:

1. **Given** an active Staff Admin and a pending application, **When** approval
   succeeds, **Then** every approved ownership effect succeeds together and the
   Provider remains `INACTIVE`.
2. **Given** a non-Staff user, **When** approval is attempted, **Then** no state,
   category, role, membership, history, or audit effect is created.
3. **Given** concurrent or repeated approval attempts, **When** they are
   processed, **Then** exactly one approved outcome exists and no duplicate
   ownership grant is created.
4. **Given** an approved application, **When** readiness is read, **Then**
   application approval is satisfied but downstream verification and operating
   gates are not falsely satisfied.

---

### User Story 7 - Request Changes and Resubmit (Priority: P1)

As a Staff Admin, I can return a pending application with a required reason so
that the owner can correct it and resubmit without losing review history.

**Why this priority**: Most review failures should be recoverable and auditable.

**Independent Test**: Request changes with a reason, verify owner editing
reopens, and verify resubmission creates a new review cycle.

**Acceptance Scenarios**:

1. **Given** a pending application and a non-empty reason, **When** Staff Admin
   requests changes, **Then** status becomes `CHANGES_REQUESTED` and the actor,
   reason, time, and review cycle are retained.
2. **Given** an empty reason, **When** Staff Admin requests changes, **Then** the
   decision is rejected without changing application state.
3. **Given** `CHANGES_REQUESTED`, **When** the `Application Owner` edits profile,
   contact, or media content and resubmits, **Then** the edit is accepted and a
   new review cycle is created; no Provider ADMIN exists before approval.

---

### User Story 8 - Terminal Rejection (Priority: P1)

As a Staff Admin, I can reject an unsuitable pending application with a reason
so that it cannot re-enter review while its audit evidence is preserved.

**Why this priority**: Terminal rejection protects marketplace control and must
have deterministic cleanup effects.

**Independent Test**: Reject a pending application, then prove resubmission,
Provider membership, global provider authority, and admin invitations remain
unavailable while history remains readable.

**Acceptance Scenarios**:

1. **Given** a pending application and a non-empty reason, **When** Staff Admin
   rejects it, **Then** status becomes terminal `REJECTED` with actor, reason,
   and time recorded.
2. **Given** terminal rejection, **When** the `Application Owner` attempts
   resubmission, **Then** the action is denied.
3. **Given** terminal rejection, **When** its authority effects are inspected,
   **Then** no Provider membership, global provider authority, or admin
   invitation exists and audit/history is preserved.

---

### User Story 9 - Understand Completion and Readiness (Priority: P1)

As an `Application Owner`, Provider OWNER, or Provider ADMIN, I can see profile
completion separately from marketplace readiness so that I understand what I
can complete now and which later phase owns each blocker.

**Why this priority**: A single percentage would mislead providers about
approval, verification, and operational readiness.

**Independent Test**: Evaluate both provider kinds across incomplete profile,
approved application, non-applicable documents, and later-phase blockers and
verify deterministic percentages, gate statuses, and owning phases.

**Acceptance Scenarios**:

1. **Given** applicable R1-P05 profile checks, **When** completion is calculated,
   **Then** the ten approved checks contribute 10% each under policy version 1,
   missing codes identify every incomplete check, and the percentage reaches
   100 only when all ten are complete.
2. **Given** an `INDIVIDUAL_TEAM`, **When** document readiness is read, **Then**
   it is `NOT_REQUIRED`, satisfied, and excluded from profile-completion
   denominators.
3. **Given** a `REGISTERED_COMPANY` before R1-P06 verification, **When** document
   readiness is read, **Then** it is not reported verified, cites R1-P06, and
   does not reduce `profileCompletion`.
4. **Given** either provider kind with every applicable R1-P05 profile and media
   check complete, **When** `profileCompletion` is calculated, **Then** it may
   reach 100 regardless of the separate document gate.
5. **Given** any R1-P05 Provider, **When** marketplace readiness is read during
   this phase, **Then** later gates are blocked or not started with owning-phase
   reasons and public Browse eligibility remains false.

---

### User Story 10 - Invite an Existing User as Admin (Priority: P2)

As the Provider OWNER, I can invite an existing Cleanora user by email to help
manage editable provider content without sharing ownership.

**Why this priority**: After approval, Mahmoud or a Company may delegate profile
management while retaining ownership and membership control.

**Independent Test**: Invite an existing user, accept once after authentication
and invited-email proof, and verify active ADMIN membership with no ownership.

**Acceptance Scenarios**:

1. **Given** an approved Provider whose membership changes are permitted,
   **When** OWNER invites a valid email, **Then** a single-use invitation
   expiring in 72 hours is issued without exposing its secret in retained
   records.
2. **Given** the matching existing user, **When** the user accepts a valid
   invitation, **Then** provider-admin authority and active ADMIN membership are
   granted exactly once.
3. **Given** an ADMIN or unrelated user, **When** that actor attempts to invite
   another admin, **Then** the action is denied.

---

### User Story 11 - Invitation-Only Onboarding for a New Admin (Priority: P2)

As a new invited administrator, I can create a restricted Cleanora identity
through the invitation without being forced into Individual customer signup.

**Why this priority**: Provider administrators may not already be Cleanora
customers and must not receive an invented customer identity.

**Independent Test**: Complete onboarding using the fixed invited email,
required phone/password, and email verification, then verify no customer
category was added and ADMIN membership was created once.

**Acceptance Scenarios**:

1. **Given** a valid invitation for an unknown email, **When** the invitee
   completes required phone, password, and email verification, **Then** the new
   identity receives provider-admin authority and active ADMIN membership but
   no customer category.
2. **Given** an attempt to change the invited email, **When** onboarding is
   submitted, **Then** the attempt is denied.
3. **Given** an expired, revoked, replaced, or previously consumed invitation,
   **When** onboarding or acceptance is attempted, **Then** no identity-linked
   provider authority or membership is granted.

---

### User Story 12 - Enforce Scope and Contact Privacy (Priority: P1)

As Cleanora, I must deny cross-provider access and omit private contact details
from every customer-facing or preview representation.

**Why this priority**: Provider isolation and marketplace contact control are
security and revenue-protection requirements.

**Independent Test**: Exercise OWNER, ADMIN, Staff Admin, unrelated user, and
anonymous contexts against two Providers and inspect every preview field.

**Acceptance Scenarios**:

1. **Given** an active ADMIN membership for Provider A, **When** the user
   attempts Provider B access, **Then** the request is denied even if the global
   provider-admin authority is enabled.
2. **Given** caller-supplied membership or provider identifiers, **When** they do
   not match authoritative membership facts, **Then** they provide no access.
3. **Given** any protected preview, **When** its data is inspected, **Then** it
   contains zero direct contact fields or external booking paths.
4. **Given** an anonymous user, **When** the user attempts public Provider Browse
   in R1-P05, **Then** no R1-P05 public Browse capability is available.

---

### User Story 13 - Recover Legacy Provider Owner Eligibility (Priority: P2)

As a legacy user holding only `PROVIDER_OWNER`, I can become eligible by first
enrolling and verifying an approved customer category rather than bypassing the
new application controls.

**Why this priority**: Existing historical identities must not become an
authorization loophole.

**Independent Test**: Deny an owner-only legacy identity, then enroll and verify
Individual or Company with its matching profile and allow the corresponding
application kind.

**Acceptance Scenarios**:

1. **Given** a user holding only legacy `PROVIDER_OWNER`, **When** the user
   starts an application, **Then** the attempt is denied with the required
   Individual-or-Company enrollment path.
2. **Given** that user later verifies Individual and completes its profile,
   **When** the user applies, **Then** `INDIVIDUAL_TEAM` becomes eligible.
3. **Given** that user later verifies Company and completes its profile,
   **When** the user applies, **Then** `REGISTERED_COMPANY` becomes eligible.

### Edge Cases

- Concurrent initial-application attempts by the same owner must resolve to one
  owned Provider and one application.
- A user with both eligible categories must not create one Provider of each
  kind.
- Provider kind cannot change after any prior submission, even after changes
  are requested.
- Whitespace-only required Arabic or contact values remain incomplete.
- An inactive or unknown country cannot satisfy profile completion.
- Processing, failed, or deleted media does not satisfy submission readiness.
- Logo and cover never consume the 12-image gallery allowance.
- Videos never satisfy the minimum of three gallery images.
- A 13th gallery image, third video, image over 5 MiB, video over 40 MiB,
  unsupported format, or video above 1080p is rejected.
- Sixty seconds remains video UX guidance and is not enforced as a hard maximum.
- `Application Owner` writes during `PENDING_REVIEW` are denied without partial
  changes, and Provider membership or admin invitations are unavailable before
  approval.
- Empty staff decision reasons do not transition state.
- Repeated approval cannot duplicate categories, roles, memberships, history,
  or audit effects.
- Terminal rejection cannot be converted into a new draft or resubmitted in
  R1-P05.
- Invitation resend invalidates all previously active tokens for that invite.
- Expired, revoked, replaced, consumed, replayed, or concurrently accepted
  invitation attempts cannot create duplicate authority or membership.
- A global provider-admin role without matching active membership grants no
  provider access.
- An active membership for a different Provider grants no access.
- Staff review access depends on active Staff Admin authority, not database
  insertion or caller claims.
- Individual Team document readiness remains satisfied as `NOT_REQUIRED`.
- Registered Company document readiness remains unsatisfied until R1-P06 and
  never invents the OQ-007 checklist.
- Application approval alone never sets `LIVE` or public Browse eligibility.
- Suspension and reinstatement cannot erase application or operational history.
- A suspended Provider cannot operate or become publicly eligible, but its
  active OWNER and ADMIN may continue authorized profile, media, membership,
  dashboard, and remediation work; reinstatement returns to `INACTIVE` only.
- No settings view or preview may expose direct contact information.

## Requirements *(mandatory)*

### Functional Requirements

#### Applicant identity and provider kind

- **FR-001**: The system MUST treat Provider as the marketplace supply entity
  and MUST keep Company customer identity distinct from the Provider record.
- **FR-002**: The system MUST allow only a verified Individual with its matching
  profile or a verified Company with its matching profile to apply in R1-P05.
- **FR-003**: The system MUST deny Engineer-only and otherwise ineligible
  identities from provider application.
- **FR-004**: The system MUST map Individual to `INDIVIDUAL_TEAM` and Company to
  `REGISTERED_COMPANY`.
- **FR-005**: A user with both eligible categories MUST choose one provider kind
  for the single initial draft.
- **FR-006**: Provider kind MUST be changeable only in a never-submitted initial
  draft when the owner holds the matching eligible category and profile.
- **FR-007**: Provider kind MUST be immutable after first submission.
- **FR-008**: One user MUST own at most one Provider.
- **FR-009**: Provider ADMIN membership MUST NOT confer Provider ownership.
- **FR-010**: Public self-signup and ordinary category self-enrollment MUST offer
  only Individual, Company, and Engineer and MUST exclude `PROVIDER_OWNER`.
- **FR-011**: `PROVIDER_OWNER` MUST be an internal verified category granted
  only as part of successful Staff Admin approval.
- **FR-012**: A legacy user holding only `PROVIDER_OWNER` MUST complete an
  eligible verified Individual or Company path before applying.

#### Application and review lifecycle

- **FR-013**: A new eligible application MUST begin in `DRAFT` and record its
  creator as the draft-scoped `Application Owner` without creating Provider
  membership or global provider authority.
- **FR-014**: Application status MUST use only `DRAFT`, `PENDING_REVIEW`,
  `CHANGES_REQUESTED`, `APPROVED`, and `REJECTED`.
- **FR-015**: The system MUST enforce only the approved application transitions
  and MUST deny every unspecified transition.
- **FR-016**: Only the draft's `Application Owner` MUST be able to edit, submit,
  or resubmit before approval.
- **FR-017**: Submission MUST require every applicable R1-P05 profile and media
  requirement and MUST return all current blockers.
- **FR-018**: Successful submission MUST create a review cycle, move to
  `PENDING_REVIEW`, and lock application, profile, private-contact, and media
  changes; Provider memberships and admin invitations MUST remain unavailable
  before approval.
- **FR-019**: Only active Staff Admin authority MUST permit queue access, dossier
  review, approval, changes request, rejection, suspension, or reinstatement.
- **FR-020**: The review queue MUST support deterministic pagination and filters
  for application status, provider kind, and submission time.
- **FR-021**: Changes request, rejection, suspension, and reinstatement MUST
  require a non-empty reason.
- **FR-022**: `CHANGES_REQUESTED` MUST allow the `Application Owner` to resume
  an editable draft and later resubmit without erasing prior review cycles.
- **FR-023**: `REJECTED` MUST be terminal in R1-P05.
- **FR-024**: R1-P05 MUST provide no application withdrawal, deletion, or
  rejected-application restart.
- **FR-025**: Every application and operational status transition MUST preserve
  prior status, next status, actor, reason where applicable, review cycle, and
  time.
- **FR-026**: Approval MUST produce application approval, verified internal
  Provider Owner category, enabled global provider-admin authority, active OWNER
  membership, status history, and privileged audit as one complete outcome or
  no outcome.
- **FR-027**: Approval MUST leave operational status `INACTIVE` and MUST NOT
  satisfy later-phase readiness gates. Permitted post-approval profile,
  private-contact, or media changes in R1-P05 MUST NOT reset application status
  from `APPROVED`; they MUST recalculate completion and readiness and preserve
  version and audit evidence.
- **FR-028**: Operational status MUST use only `INACTIVE`, `LIVE`, and
  `SUSPENDED`; `PAUSED` is prohibited.
- **FR-029**: R1-P05 MUST NOT permit a provider to become `LIVE` by bypassing
  downstream readiness.
- **FR-030**: Suspension and reinstatement MUST be Staff Admin-only, reasoned,
  and auditable without erasing history. `SUSPENDED` MUST deny operational and
  public eligibility while preserving authorized OWNER/ADMIN management and
  remediation access. Reinstatement in R1-P05 MUST return to `INACTIVE` only
  and MUST never restore or grant `LIVE` automatically.

#### Profile, contacts, privacy, and media

- **FR-031**: Provider profile MUST require Arabic display name, Arabic
  description, and an active configured country.
- **FR-032**: English display name and English description MUST be optional and
  MUST NOT reduce completion when absent.
- **FR-033**: Individual name or Company name and representative name MUST be
  resolved from authoritative verified customer-profile facts for private
  review context.
- **FR-034**: Caller-supplied applicant identity text MUST NOT replace the
  authoritative identity context.
- **FR-035**: Private operational email and phone MUST be required or securely
  prefilled from authoritative identity data.
- **FR-036**: Any WhatsApp, social, website, or external-booking reference MUST
  remain private operational/review data.
- **FR-037**: Private contacts MUST be accessible only to the Provider OWNER,
  authorized active ADMIN for assigned management, and Staff Admin for review or
  operations.
- **FR-038**: Every protected preview or later customer-facing provider
  representation MUST omit email, phone, WhatsApp, social, website, and
  external-booking information.
- **FR-039**: R1-P05 MUST expose no anonymous public Browse or Provider Details
  capability.
- **FR-040**: Provider media MUST allow one logo, one cover, at most 12 gallery
  images, and at most 2 gallery videos.
- **FR-041**: Submission media readiness MUST require a READY logo, READY cover,
  and at least three READY gallery images; videos MUST NOT count as images.
- **FR-042**: Each image MUST be at most 5 MiB and accept only JPEG, PNG, or
  WebP.
- **FR-043**: Accepted images MUST be safely oriented, stripped of unsafe
  metadata, and normalized for 600x600 logo, 1600x600 cover, or 1200x900 gallery
  presentation.
- **FR-044**: Each video MUST be at most 40 MiB, accept only MP4 or WebM, and be
  at most 1080p.
- **FR-045**: Sixty seconds MUST remain video UX guidance rather than a hard
  duration limit in R1-P05.
- **FR-046**: Every video MUST have a thumbnail and processing status, and only
  READY media MUST contribute to completion.
- **FR-047**: Media count, size, format, state, and presentation rules MUST be
  authoritative and MUST NOT rely on client calculations.

#### Membership and invitations

- **FR-048**: R1-P05 Provider membership MUST support only `OWNER` and `ADMIN`,
  and no Provider membership MUST exist before successful approval.
- **FR-049**: After approval, OWNER MUST be able to edit when permitted, manage
  admins, and view dashboard, status, completion, readiness, and history;
  pre-approval submission authority belongs only to `Application Owner`.
- **FR-050**: ADMIN MUST be able to edit profile, private contacts, and media
  only when editable and view dashboard, status, completion, and readiness.
- **FR-051**: ADMIN MUST NOT submit/resubmit, change provider kind, manage
  invitations or memberships, transfer ownership, or review applications.
- **FR-052**: Provider-scoped authorization MUST require active identity,
  required enabled global authority, active membership for the exact Provider,
  and required membership level.
- **FR-053**: Caller-supplied scope facts MUST NOT grant access, and
  cross-provider access MUST fail closed.
- **FR-054**: After approval, OWNER MUST be able to invite any valid email as
  Provider ADMIN while membership changes are permitted; admin invitations
  MUST NOT be available before approval.
- **FR-055**: An admin invitation MUST be single-use, expire after 72 hours, be
  revocable, and retain no reusable raw secret.
- **FR-056**: Resending an invitation MUST invalidate all previous active tokens
  for that invitation.
- **FR-057**: Matching existing users MUST authenticate, prove the invited email
  where required, and receive enabled provider-admin authority plus active ADMIN
  membership exactly once on acceptance.
- **FR-058**: A new invitee MUST onboard with fixed invited email, required phone
  and password, and email verification without receiving a customer category
  automatically.
- **FR-059**: Invitation acceptance MUST be idempotent and concurrency safe and
  MUST reject expired, revoked, replaced, consumed, replayed, or mismatched
  invitations.
- **FR-060**: Terminal application rejection MUST create no Provider membership,
  global provider authority, or admin invitation and MUST preserve
  audit/history.

#### Completion and marketplace readiness

- **FR-061**: The system MUST keep `profileCompletion` separate from
  `marketplaceReadiness`; document verification, payout, workers, services,
  coverage, availability, capacity, operational live status, and public Browse
  eligibility MUST NOT contribute to the profile-completion percentage.
- **FR-062**: Profile completion MUST be server-authoritative,
  provider-kind-specific, and recalculated after every relevant accepted
  change.
- **FR-063**: Policy version 1 MUST give equal weight to applicable required
  profile checks, exclude optional and `NOT_REQUIRED` checks, and return 100
  only when all applicable checks are complete. In R1-P05, exactly ten checks
  apply and each contributes 10 percentage points.
- **FR-064**: Profile completion MUST return policy version and all missing
  requirement codes.
- **FR-065**: R1-P05 profile-completion policy v1 MUST use exactly these stable
  missing-requirement codes: `ELIGIBLE_CATEGORY_VERIFIED`,
  `MATCHING_CUSTOMER_PROFILE_COMPLETE`, `ARABIC_DISPLAY_NAME`,
  `ARABIC_DESCRIPTION`, `OPERATIONAL_EMAIL`, `OPERATIONAL_PHONE`,
  `ACTIVE_COUNTRY`, `READY_LOGO`, `READY_COVER`, and
  `MIN_READY_GALLERY_IMAGES`. The first two checks MUST use the selected
  provider kind's matching verified category and customer profile.
- **FR-066**: Marketplace readiness MUST return structured gates containing
  gate key, applicability, status, satisfaction, blocker/reason codes, and
  owning phase.
- **FR-067**: Readiness gate status MUST use `SATISFIED`, `NOT_REQUIRED`,
  `NOT_STARTED`, or `BLOCKED`.
- **FR-068**: Readiness MUST include `profileComplete`,
  `applicationApproved`, `documentsVerified`, `payoutDestinationReady`,
  `workersReady`, `servicesReady`, `coverageReady`, `availabilityReady`,
  `capacityReady`, `operationalLive`, and `eligibleForPublicBrowse`.
- **FR-069**: `INDIVIDUAL_TEAM` document readiness MUST be `NOT_REQUIRED`,
  satisfied, and excluded from profile-completion denominators.
- **FR-070**: `REGISTERED_COMPANY` document readiness MUST remain unsatisfied
  until R1-P06 verifies the later configurable OQ-007 checklist, and this
  separate blocker MUST NOT lower `profileCompletion`.
- **FR-071**: R1-P05 MUST NOT invent or freeze the OQ-007 Company document list.
- **FR-072**: Later-phase gates MUST be `NOT_STARTED` or `BLOCKED` with explicit
  owning-phase reasons.
- **FR-073**: `eligibleForPublicBrowse` MUST remain false in R1-P05.

#### Dashboard, settings, interfaces, and integrity

- **FR-074**: Provider dashboard summary MUST show kind, application status,
  operational status, completion, missing requirements, readiness blockers,
  latest staff decision, media usage, active admin count, pending invitation
  count, and next owner action.
- **FR-075**: Provider settings MUST aggregate the existing owned account and
  security, profile, private contact, media, membership, status/history,
  privacy, and notification-status capabilities.
- **FR-076**: R1-P05 MUST NOT create a generic Provider settings store or
  unstructured settings object.
- **FR-077**: Mandatory application-review email notices MUST NOT be optional or
  disabled in R1-P05.
- **FR-078**: Optional Provider notification preferences MUST remain deferred.
- **FR-079**: The system MUST support later authenticated interface design for
  applicant/provider draft, profile, contacts, media, completion, readiness,
  submission, history, dashboard, and contact-free preview capabilities.
- **FR-080**: The system MUST support later Staff Admin interface design for a
  paginated/filterable queue, dossier, approval, changes request, rejection,
  suspension, and reinstatement.
- **FR-081**: The system MUST support later invitation/member interface design
  for invite, resend, revoke, list, disable/remove, safe invitation inspection,
  invitation-only onboarding, and acceptance.
- **FR-082**: Exact interface methods, paths, message shapes, status mappings,
  and transaction ownership MUST be deferred to technical planning while
  preserving Cleanora's established success/error and request-trace
  conventions.
- **FR-083**: Editable application resources MUST reject stale versions rather
  than silently overwrite accepted concurrent changes.
- **FR-084**: Initial application creation, approval, and invitation acceptance
  MUST remain correct under retries and concurrency and MUST not create
  duplicate authority or membership.
- **FR-085**: Privileged review and operational decisions plus invitation and
  membership mutations MUST be auditable.
- **FR-086**: Logs and safe failures MUST exclude credentials, raw invitation
  tokens, private contacts, storage identifiers, and other secrets.

### Key Entities

- **Provider**: The single marketplace supply entity owned by one user, with
  provider kind, application status, operational status, version, and lifecycle
  timestamps.
- **Provider Profile**: Arabic and optional English marketplace presentation
  content plus active country association.
- **Provider Contact**: Private operational email, phone, and any optional
  private direct-contact references; never a customer-facing contact source.
- **Provider Application Ownership**: Draft-scoped link between the creator and
  the application that authorizes pre-approval editing and submission only; it
  is not Provider membership or global provider authority.
- **Provider Member**: Post-approval Provider-scoped OWNER or ADMIN relationship
  with active or disabled lifecycle and no implicit ownership for ADMIN.
- **Provider Admin Invitation**: Single-use, expiring, revocable invitation for
  existing-user acceptance or invitation-only new-user onboarding.
- **Provider Gallery Item**: Ordered association of an approved provider media
  item as gallery image or video with readiness and thumbnail context.
- **Provider Status History**: Append-only evidence of application and
  operational transitions, review cycles, actors, reasons, and time.
- **Provider Media**: Logo, cover, gallery image, video, or video-thumbnail
  reference subject to fixed count, safety, size, format, and readiness rules.
- **Profile Completion Result**: Policy-versioned percentage, applicable checks,
  and missing requirement codes for the current provider kind.
- **Marketplace Readiness Result**: Structured cross-phase gate statuses,
  applicability, satisfaction, blockers, and owning phases.
- **Applicant Identity Context**: Server-resolved Individual name or Company
  name and representative context used privately during review.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of accepted provider applications originate from a verified
  eligible Individual or Company with its matching profile.
- **SC-002**: Zero users can own more than one Provider, including under
  concurrent application attempts.
- **SC-003**: 100% of Staff Admin review and operational decisions retain actor,
  reason where required, prior and next state, review cycle, and time.
- **SC-004**: 100% of protected preview and future customer-facing provider
  representations contain zero direct email, phone, WhatsApp, social, website,
  or external-booking fields.
- **SC-005**: 100% of attempts beyond 12 gallery images, 2 videos, 5 MiB per
  image, or 40 MiB per video are denied without removing accepted media.
- **SC-006**: Profile completion reports 100 only when every applicable R1-P05
  policy-v1 check is complete, reports 10 percentage points per satisfied
  check, and reports every missing stable requirement code otherwise.
- **SC-007**: 100% of Individual Team readiness results treat documents as
  satisfied `NOT_REQUIRED` and exclude them from profile-completion
  denominators.
- **SC-008**: 100% of Registered Company readiness results before R1-P06 avoid
  claiming document verification, identify R1-P06 as the owner, and do not
  reduce `profileCompletion` because of the document blocker.
- **SC-009**: Zero application approvals make a Provider `LIVE`, publicly
  browsable, or falsely ready for a later-phase gate; zero reinstatements in
  R1-P05 return a suspended Provider to anything other than `INACTIVE`.
- **SC-010**: 100% of cross-provider and unauthorized review attempts are
  denied even when the actor holds an unrelated global role or membership.
- **SC-011**: 100% of successful approvals create exactly one complete ownership
  outcome, and failed approvals create none of its component effects.
- **SC-012**: 100% of accepted invitations are consumed at most once, and
  expired, revoked, replaced, consumed, replayed, or mismatched invitations
  create no provider authority.
- **SC-013**: 100% of submitted applications meet the logo, cover, three READY
  gallery image, profile, contact, country, and eligible identity requirements.
- **SC-014**: 100% of `PENDING_REVIEW` application, profile, contact, and media
  mutation attempts are denied without partial writes, and 100% of
  pre-approval membership or invitation attempts are unavailable.
- **SC-015**: Every Provider dashboard identifies the next available owner
  action or the explicit blocker and owning phase, with no ambiguous single
  readiness percentage.

## Assumptions

- R1-P03's existing Staff Admin, provider-admin authority, privileged audit, and
  deny-by-default authorization capabilities remain available for later
  integration through their approved public contracts.
- R1-P04/R1-P04A provide verified Individual and Company categories and their
  matching profiles; R1-P05 does not recreate those identity profiles.
- `countryCode` uses Cleanora's existing active country configuration.
- Mandatory review notices use the account's authoritative email and remain
  non-optional; channel delivery design is technical-planning work.
- Sixty seconds is video UX guidance only; no hard duration limit is approved.
- Application and audit records remain preserved; no new time-based retention
  or destructive purge policy is introduced in this phase.
- OQ-007 intentionally remains open for the R1-P06 Registered Company document
  checklist and is not an R1-P05 blocker.

## Dependencies

- R1-P03 — Roles, Permissions & Privileged Audit: Complete.
- R1-P04 — Customer Profiles, Preferences & Text Addresses: Complete.
- R1-P04A — Category-Aware Customer Signup & Verification: Complete.
- DEC-036 — approved R1-P05 provider application and readiness policy.

## Out of Scope

- Provider document configuration, upload, review, and exact checklist
  (R1-P06).
- External payout destinations (R1-P06).
- Workers, supervisors, teams, crews, and assignments (R1-P07).
- Catalog selection, services, prices, and price history (R1-P09).
- Coverage, availability, schedules, and capacity (R1-P10).
- Eligibility engine (R1-P11).
- Anonymous public Browse and Provider Details (R1-P12).
- Booking, orders, payments, settlements, or internal stored-value wallets.
- Provider or Staff Admin frontend implementation.
- Public-profile change moderation after marketplace visibility begins; R1-P12
  MUST define that policy before anonymous Browse is enabled.
- Generic Provider settings persistence or optional notification preferences.
- Staff Admin provisioning changes.
- Provider ownership transfer or ownership of multiple Providers.
- Application withdrawal, deletion, rejected-application restart, or `PAUSED`.
- Direct `PROVIDER_OWNER` signup or ordinary self-enrollment.
- Docker, cloud, deployment, production configuration, or production data.
- Technical plan, interface contract, data model, task generation, code, tests,
  schema, or migration changes during this specification-only step.

## Canonical Traceability

- `docs/product/vision.md` sections 4 and 5.
- `docs/product/decision-log.md` DEC-036.
- `docs/product/open-questions.md` OQ-007.
- `docs/product/roadmap.md` R1-P05.
- `docs/product/current.md` active R1-P05 pointer.
- `.specify/memory/constitution.md` principles I–X.

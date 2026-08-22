# Feature Specification: Provider Verification & External Payout Destinations

**Feature Branch**: `codex/r1-p06-provider-verification-payout-destinations` (created on 2026-08-22 for the explicitly authorized Git handoff; the earlier documentation workflow ran without a dedicated branch)
**Created**: 2026-08-13
**Status**: **Complete — all T001–T137 implementation and evidence gates passed; explicit human-owner completion approval recorded on 2026-08-14**
**Input**: Human-owner-approved R1-P06 document-verification,
external-destination, privacy, readiness, and phase-boundary decisions recorded
in DEC-037.

## Clarifications

### Session 2026-08-13

**Session 1 (questions 1–5)**

- Q: Who may manage Registered Company documents, and who may decide their
  verification? → A: An active Provider `OWNER` or `ADMIN` with active exact-
  Provider membership may create drafts, enter metadata, upload, submit,
  replace, and view that Provider's documents and history. Only an active
  `STAFF_ADMIN` may approve, reject, request replacement, invalidate, or
  otherwise decide document verification. Provider members cannot review their
  own evidence. Every privileged Staff decision requires a meaningful non-empty
  reason and immutable evidence of the actor, timestamp, target document
  version, outcome, and safe audit/history meaning.
- Q: Which authority model governs external payout-destination management and
  verification? → A: Only an active exact-Provider `OWNER` may create, update,
  replace, remove, or select the primary payout destination. An active exact-
  Provider `ADMIN` may view masked destination status but cannot mutate
  sensitive destination details or primary truth. Only an active `STAFF_ADMIN`
  may verify, reject, or invalidate a destination; every such decision requires
  a meaningful non-empty reason and immutable evidence of actor, timestamp,
  target destination version, outcome, and safe audit/history meaning.
- Q: When do Provider-specific R1-P06 capabilities become available relative to
  the application lifecycle? → A: No Provider-specific document or payout-
  destination record may be created, submitted, reviewed, or mutated while the
  application is `DRAFT`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, or terminal
  `REJECTED`. After `APPROVED`, document verification and payout-destination
  readiness may progress independently under their approved authorities. If the
  Provider is later operationally `SUSPENDED`, authorized remediation and Staff
  review remain available, but R1-P06 cannot make the Provider operational or
  public.
- Q: How are Registered Company document requirements configured and changed?
  → A: Seed an Egypt (`EG`) policy for `REGISTERED_COMPANY` with exactly
  `COMMERCIAL_REGISTRATION` and `TAX_REGISTRATION`, both active and required.
  Only an active `STAFF_ADMIN` may create or edit a draft policy version and
  publish it with a meaningful non-empty reason. Published versions are
  immutable and effective-dated. Once effective, a version re-evaluates every
  approved Provider in its country-and-kind scope against the current policy.
  Existing eligible evidence for an unchanged stable type may continue to
  satisfy it; newly required types may make readiness incomplete, and retired
  requirements stop blocking current readiness. Historical policy versions,
  evidence, decisions, and prior readiness meaning remain preserved.
- Q: What structured metadata and evidence baseline applies to both launch
  document types? → A: Both `COMMERCIAL_REGISTRATION` and `TAX_REGISTRATION`
  require `countryCode`, `documentNumber`, `legalName`, `issuerName`, and
  `issueDate`; `expiresAt` is optional. `countryCode` must equal the Provider's
  authoritative active country, `issueDate` cannot be in the future, and any
  `expiresAt` must be later than `issueDate`. Omitted expiry means no automatic
  expiration. Evidence must represent the complete document; ordered additional
  private JPEG/PNG pages are allowed within the approved 10-page, 5-MiB-per-
  page, and 20-MiB-aggregate image limits.
  Each submission snapshots the policy-version metadata rules under which it
  was validated, even when later versions change future field requirements.

**Session 2 (questions 1–5)**

- Q: Which private-document upload contract applies? → A: One document version
  uses exactly one format: either one `application/pdf` file of at most 15 MiB
  and 10 pages, or 1–10 ordered JPEG/PNG images, each at most 5 MiB and at most
  20 MiB in aggregate. `image/jpeg` explicitly covers both `.jpg` and `.jpeg`;
  `image/png` covers `.png`. PDF and image evidence cannot be mixed. Media must
  verify file signatures and decoded content instead of trusting names or
  declared MIME; reject malformed, encrypted/password-protected, active-content,
  executable, mismatched, unsafe, or over-limit files; scan for malware;
  normalize image orientation; and remove unsafe image metadata. A draft may
  reference `PENDING_UPLOAD` or `PROCESSING` evidence, but submission, review,
  and verification credit require every page to be `READY`. Failed, missing,
  or reordered evidence creates no partial verification truth. The R1-P06 Media
  public contract and its Cloudinary adapter must later support validated
  `image/jpeg` (`.jpg`/`.jpeg`) in addition to the other approved types.
- Q: Which document lifecycle and replacement policy applies? → A: Use immutable
  linked versions with risk-aware continuity. A version moves from `DRAFT` to
  `SUBMITTED`, then to `APPROVED`, terminal `REJECTED`, or
  `REPLACEMENT_REQUESTED`; an approved version may later become `EXPIRED`,
  `INVALIDATED`, `REPLACEMENT_REQUESTED`, or `SUPERSEDED`. Submitted metadata and
  evidence are immutable, and every correction, resubmission, renewal, or
  replacement creates a linked successor version. During a voluntary renewal or
  replacement, the still-valid approved predecessor remains effective until the
  successor is approved, the predecessor expires, or Staff invalidates or
  requests replacement of it. Successor approval atomically makes it effective
  and supersedes the predecessor. Rejection of a voluntary successor leaves a
  still-valid predecessor effective; challenged, expired, or invalidated
  predecessors remain non-effective. Every command uses exact-version checks,
  matching retries are idempotent, competing commands conflict safely, history
  is immutable, and ordinary hard deletion is prohibited.
- Q: How is verification-badge truth granted and removed? → A: Only an approved
  `REGISTERED_COMPANY` is badge-eligible. Its protected badge truth is derived
  automatically as `EARNED` exactly while every active required document type
  under the current effective country-and-kind policy has an effective approved
  version; otherwise it is `NOT_EARNED`. A Staff replacement request,
  invalidation, authoritative expiry, or newly effective unmet requirement
  removes the badge immediately. A voluntary successor preserves it while its
  valid unchallenged predecessor remains effective, and successor approval
  preserves it through atomic supersession. `INDIVIDUAL_TEAM` remains
  `documentsVerified = NOT_REQUIRED` and satisfied but has badge truth
  `NOT_ELIGIBLE`, never `EARNED`. Operational `SUSPENDED` status does not rewrite
  document verification or protected badge truth, although operational and
  public eligibility remain denied. Anonymous badge rendering belongs to
  R1-P12, not R1-P06.
- Q: What Mobile Wallet schema and verification policy applies? → A: Only an
  active exact-Provider `OWNER` may create or update a Mobile Wallet payout-
  destination draft. The draft requires the Provider's authoritative active
  `countryCode`, the wallet number normalized to E.164, an `operatorCode`
  selected from the active country-scoped payout-operator registry, the wallet
  holder's full legal name, and holder relationship
  `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`. The operator is neither inferred
  from the phone prefix nor entered as free text. The wallet number need not
  match the Owner's Authentication phone and does not require `phoneVerified`.
  No wallet ownership/control evidence, screenshot, statement, contract, or
  other proof-of-ownership file is uploaded or required. Submission creates
  `PENDING_VERIFICATION` truth and cannot satisfy `payoutDestinationReady`.
  Only an active `STAFF_ADMIN` may approve, reject, or request correction or
  replacement after manually starting—but not completing—an external wallet
  transfer attempt or beneficiary lookup and comparing the displayed holder
  name with the authoritative Provider legal-entity name or exact active Owner
  legal name selected by the relationship. R1-P06 does not execute payouts,
  send verification money, integrate a wallet-transfer API, or record an actual
  settlement. Every Staff decision records a meaningful non-empty reason or
  verification note, Staff actor, timestamp, exact destination version,
  verification method such as `MANUAL_WALLET_TRANSFER_CHECK`, immutable history,
  and safe audit evidence. Commands use exact-version checks, matching retries
  are idempotent, and stale or competing commands conflict. Deduplication uses
  `countryCode` plus normalized E.164 number independently of `operatorCode`;
  duplicates within one Provider are prohibited and concurrent cross-Provider
  claims require `STAFF_ADMIN` resolution. After submission, Provider-facing
  responses and history expose only a masked number. The full number is
  available only in the narrowly authorized Staff verification workflow and is
  excluded from logs, audit payloads, generic history, and public responses.
  Only a current active `APPROVED` destination can satisfy
  `payoutDestinationReady`; all other Mobile Wallet states cannot.
- Q: Which Bank Account field schema and verification policy applies? → A: Use
  an IBAN-first manual-verification model without uploaded ownership evidence.
  Only an active exact-Provider `OWNER` may create or update a draft containing
  the Provider's authoritative active `countryCode`, configured payout
  `currencyCode` (`EGP` for the launch `EG` policy), active country-scoped
  `bankCode`, normalized IBAN, holder full legal name, and relationship
  `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`. Bank name is resolved from
  `bankCode`; R1-P06 does not request a separate account number, branch, or
  caller-entered SWIFT/BIC when the IBAN and registry supply the necessary
  identity. Submission creates `PENDING_VERIFICATION` truth and cannot satisfy
  `payoutDestinationReady`. Only an active `STAFF_ADMIN` may approve, reject, or
  request correction or replacement after manually performing a beneficiary
  lookup or starting—but not completing—a bank transfer and comparing the
  displayed beneficiary name with the authoritative Provider legal-entity or
  exact active Owner name selected by the relationship. No bank statement,
  account certificate, cheque image, contract, screenshot, or other ownership-
  evidence file is required or accepted. R1-P06 does not automate the lookup,
  integrate a bank-transfer API, move verification money, complete a transfer,
  or record a settlement. Every Staff decision records a meaningful non-empty
  reason or verification note, Staff actor, timestamp, exact destination
  version, verification method such as `MANUAL_BANK_BENEFICIARY_CHECK`,
  immutable history, and safe audit evidence. Commands use exact-version
  checks, matching retries are idempotent, and stale or competing commands
  conflict. Normalized IBAN is the duplicate identity within and across
  Providers; cross-Provider conflicts require `STAFF_ADMIN` resolution. After
  submission, ordinary responses expose only a masked IBAN; the full IBAN is
  available only in the narrowly authorized Staff verification workflow and is
  excluded from logs, audit payloads, generic history, errors, and public
  responses. Only a current active `APPROVED` destination can satisfy
  `payoutDestinationReady`.

**Session 3 (questions 1–2)**

- Q: Which complete payout-destination lifecycle, cardinality, primary,
  removal/replacement, re-authentication, and notification policy applies? → A:
  Allow at most five active destination chains across Mobile Wallet and Bank
  Account in any combination; terminal historical versions do not count, and a
  chain may have only one open successor. Versions use exactly `DRAFT`,
  `PENDING_VERIFICATION`, `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`,
  `REPLACEMENT_REQUESTED`, `INVALIDATED`, `SUPERSEDED`, and `REMOVED`.
  `DRAFT` moves to `PENDING_VERIFICATION` or `REMOVED`;
  `PENDING_VERIFICATION` moves to `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`,
  or Owner-withdrawn `REMOVED`; `APPROVED` moves to
  `REPLACEMENT_REQUESTED`, `INVALIDATED`, `SUPERSEDED`, or `REMOVED`; and
  `CHANGES_REQUESTED` or `REPLACEMENT_REQUESTED` moves to `SUPERSEDED` only
  when a linked successor is approved, or to `REMOVED` when the Owner abandons
  the chain. `REJECTED`, `INVALIDATED`, `SUPERSEDED`, and `REMOVED` are
  terminal. Submitted details are immutable, so corrections and replacements
  create linked successor drafts. A voluntary successor preserves its approved
  unchallenged predecessor and primary status through review; successor
  approval atomically supersedes it and inherits primary, while successor
  rejection or changes requested leaves the predecessor effective. A Staff
  replacement request or invalidation removes the predecessor from readiness
  immediately and clears its primary status; linked successor approval may
  restore the chain and its former primary status. There is at most one global
  primary across both types, and readiness requires that primary to be current,
  active, and `APPROVED`. The first approval becomes primary automatically;
  later unrelated approvals never replace it automatically. Owner primary
  changes are explicit. Removing a primary while another approved destination
  exists requires atomic selection of its replacement; removing the last
  approved primary is allowed only with explicit acknowledgement and an
  Authentication-owned re-authentication proof no more than 10 minutes old,
  then clears primary and readiness. Staff invalidation is never blocked by the
  absence of an alternative and never auto-promotes another destination.
  The same recent re-authentication is required for Owner initial or successor
  submission, primary change, withdrawal, and removal; masked reads and draft
  editing require only the active authorized session. Exact-version checks,
  idempotent matching retries, and conflicts govern every transition. Create
  durable idempotent localized-template email intents to the exact active Owner
  for submission, every Staff decision, primary change, removal, and successor
  approval/supersession; submission also creates the Staff review-queue effect.
  Notifications contain only destination type, masked identifier, safe status,
  and safe reason. Delivery is retried asynchronously and never rolls back an
  accepted business transition.
- Q: Which sensitive-data security contract applies to payout destinations? →
  A: Encrypt every recoverable full payout identifier and destination-holder
  legal name before database persistence with AES-256-GCM, a unique random
  nonce per encrypted field, and authenticated context binding Provider ID,
  destination ID, exact version, destination type, field name, and encryption-
  key version. Persist only ciphertext metadata, a non-secret key ID, the
  approved safe display suffix, and separately allowed routing/status fields in
  plaintext. Use a separate versioned HMAC-SHA-256 lookup key ring, never an
  encryption key, over the domain-separated canonical identities
  `MOBILE_WALLET | countryCode | normalized E.164` and
  `BANK_ACCOUNT | normalized IBAN`; lookup fingerprints exist only for equality
  and deduplication and are never returned, logged, or audited. Provider payout
  identifiers are write-only: create/update responses and every later read,
  including `DRAFT`, are masked, and changing a value requires complete re-
  entry. The active exact-Provider `OWNER` may see the configured bank/operator
  label, holder relationship, and current holder legal name in the authorized
  management view, but never the complete identifier after write; an `ADMIN`
  sees only destination type, approved mask, status, primary truth, and safe
  timestamps, with no holder name. Mobile Wallet masks preserve `+` and the
  country calling code, mask every national digit except the final four, and
  show those final four. IBAN masks preserve only the two-letter country prefix
  and final four characters, replace every intervening alphanumeric with `•`,
  and group the result in blocks of four. A holder name is either shown in full
  for an expressly authorized current-management or verification purpose or is
  omitted; it is never partially masked. Full identifier and holder-name reveal
  is limited to an active `STAFF_ADMIN` with the explicit payout-verification
  capability for one exact `PENDING_VERIFICATION` version, an Authentication-
  owned step-up no more than five minutes old, a meaningful reveal reason, and
  a purpose-bound grant scoped to actor, Provider, destination version, and
  request. There is no bulk reveal/export, Provider reveal, approved/terminal
  browsing, or reusable reveal grant. The non-cacheable reveal expires with its
  verification purpose. Every allowed or denied reveal attempt records safe
  audit evidence containing actor, target Provider and exact version, purpose,
  reason, timestamp, request ID, outcome, and applicable key versions, but never
  plaintext, ciphertext, nonce, tag, fingerprint, or key material. An accepted
  reveal audit must persist before plaintext is returned; audit, key, decrypt,
  authorization, step-up, or rate-limit failure fails closed. Accepted reveals
  are limited to five per Staff actor per rolling 10-minute window, and retries
  cannot bypass the limit. Release 1 uses separate externally supplied,
  versioned encryption and lookup key rings declared by
  `PAYOUT_DATA_ENCRYPTION_KEYS_JSON`,
  `PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID`,
  `PAYOUT_LOOKUP_HMAC_KEYS_JSON`, and
  `PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID`; decoded keys are independent and at least
  32 bytes, active key IDs are distinct, and no default is allowed. Startup and
  readiness fail closed for missing or malformed keys, reuse across purposes,
  or inconsistency with retained ciphertext or lookup-key versions. Rotation
  activates new encryption and lookup keys for new writes, keeps old keys
  decrypt/compare-only, checks duplicates across every enabled lookup-key
  version, runs bounded resumable re-encryption and re-fingerprinting, verifies
  zero retained references, and retires a key only after explicit human
  operational approval. A missing historical key never causes ciphertext,
  fingerprint, or a stored mask to be returned as plaintext. Cloud secret-
  manager integration remains deferred to Release 3. Private document files
  remain Media-owned and are unaffected by this payout-data contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Individual Team Has No Document Burden (Priority: P1)

As the owner or administrator of an `INDIVIDUAL_TEAM`, I can understand that
registered-company documents do not apply to my Provider so that I am not asked
to submit irrelevant legal-company evidence and my completed profile is not
penalized.

**Why this priority**: The kind-specific exemption is an approved product
boundary. Violating it would block legitimate Individual Teams and contradict
the inherited readiness model.

**Independent Test**: Inspect an Individual Team's document requirements,
completion, and readiness and verify that no document task is offered, the
document gate is `NOT_REQUIRED` and satisfied, and profile completion is
unchanged.

**Acceptance Scenarios**:

1. **Given** an `INDIVIDUAL_TEAM`, **When** its document requirements are
   evaluated, **Then** no provider document type is required.
2. **Given** an `INDIVIDUAL_TEAM` with no Provider documents, **When** readiness
   is viewed, **Then** `documentsVerified` is applicable as `NOT_REQUIRED`, is
   satisfied, and has no missing-document blocker.
3. **Given** two otherwise identical Individual Teams, one with unrelated media
   and one without it, **When** profile completion is calculated, **Then** no
   R1-P06 document fact changes either percentage.

---

### User Story 2 - Registered Company Submits Required Evidence (Priority: P1)

As an active `OWNER` or `ADMIN` of a `REGISTERED_COMPANY` Provider, I can view
its applicable checklist and submit private Commercial Registration and Tax
Registration evidence so that the Provider can enter verification review.

**Why this priority**: Registered Company verification is the primary purpose
of this phase and is required to satisfy the inherited document-readiness gate.

**Independent Test**: Use a Registered Company Provider, view the checklist,
submit evidence for both required types through the private-document flow, and
verify that each requirement has a visible, non-public review status without
premature approval.

**Acceptance Scenarios**:

1. **Given** a `REGISTERED_COMPANY`, **When** its initial checklist is viewed,
   **Then** it contains exactly `COMMERCIAL_REGISTRATION` and
   `TAX_REGISTRATION` as required configurable types.
2. **Given** an active Provider `OWNER` or `ADMIN` with active exact-Provider
   membership, **When** complete evidence and valid required common metadata are
   submitted for one type, **Then** that submission snapshots its policy-
   version rules and enters the applicable review workflow without satisfying
   the other type.
3. **Given** an upload that has not reached the Media-owned acceptable state,
   **When** submission or review is attempted, **Then** the Provider is not
   credited with approved evidence and receives a safe, actionable outcome.
4. **Given** a Company Provider with only one approved required type, **When**
   readiness is evaluated, **Then** `documentsVerified` remains unsatisfied and
   identifies the remaining requirement without exposing document contents.
5. **Given** an application in `DRAFT`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, or
   terminal `REJECTED`, **When** any Provider-specific document creation,
   submission, review, or mutation is attempted, **Then** it is denied without
   creating a document, review, history, audit, or readiness outcome.

---

### User Story 3 - Privileged Reviewer Decides Documents Safely (Priority: P1)

As an active `STAFF_ADMIN`, I can inspect a private document dossier and approve,
reject, request replacement of, or invalidate a submitted document with a
traceable decision so that verification truth is trustworthy and reviewable.

**Why this priority**: Upload alone is not verification. A controlled,
auditable review decision is essential to the value and security of the phase.

**Independent Test**: Review a submitted document as an authorized reviewer,
record an approval and a rejection in separate cases, and verify current state,
reason requirements, history, actor attribution, privacy, and replay behavior.

**Acceptance Scenarios**:

1. **Given** a reviewable document and an active `STAFF_ADMIN`, **When** the
   Staff actor makes a document-verification decision with a meaningful reason,
   **Then** the current document truth and immutable review history record the
   decision, actor, target document version, reason, and time.
2. **Given** any privileged document-verification decision, **When** the Staff
   reviewer omits a meaningful non-empty reason, **Then** no decision is
   recorded.
3. **Given** a Provider `OWNER` or `ADMIN`, **When** that member attempts to
   approve, reject, request replacement of, invalidate, or otherwise decide the
   Provider's evidence, **Then** the action is denied without changing truth.
4. **Given** a retry of an already completed matching decision, **When** it is
   processed, **Then** it does not create a conflicting current state or
   duplicate business outcome.

---

### User Story 4 - Replace, Renew, and Expire Evidence (Priority: P1)

As an active Provider `OWNER` or `ADMIN`, or as an active `STAFF_ADMIN` reviewer,
I can follow an evidence item within my authorized scope from its original
submission through replacement, renewal, rejection, or expiration without
erasing prior decisions so that current verification truth remains accurate and
historically explainable.

**Why this priority**: Legal evidence changes over time. Verification would be
unsafe if old evidence could be silently overwritten or if expired evidence
continued to count without an approved policy.

**Independent Test**: Start with approved evidence, submit a voluntary successor,
exercise approval, rejection, Staff replacement request, invalidation, and
authoritative expiry, and verify current-versus-historical records, readiness,
badge truth, exact-version conflicts, retries, and retained review history.

**Acceptance Scenarios**:

1. **Given** a still-valid approved document, **When** a voluntary replacement
   or renewal successor is submitted, **Then** the predecessor remains effective
   while the immutable linked successor is reviewed.
2. **Given** a voluntary successor that is approved, **When** the exact-version
   decision succeeds, **Then** the successor becomes effective and the prior
   approved version becomes `SUPERSEDED` atomically.
3. **Given** a voluntary successor that is rejected, **When** the predecessor is
   still approved, unexpired, and unchallenged, **Then** the predecessor remains
   effective and both versions and decisions remain historically visible.
4. **Given** two conflicting replacement or review actions, **When** they race,
   **Then** at most one valid current outcome is accepted and the other receives
   a safe conflict outcome.
5. **Given** an approved version, **When** Staff requests replacement or
   invalidates it, or its authoritative expiry boundary is reached, **Then** it
   immediately stops satisfying the requirement and the transition is
   historically traceable.
6. **Given** a rejected, replacement-requested, expired, invalidated, or
   superseded version, **When** a Provider corrects or renews it, **Then** a new
   linked `DRAFT` is created without editing or deleting the prior version.

---

### User Story 5 - Understand Verification Truth and Badge (Priority: P1)

As an active exact-Provider `OWNER` or `ADMIN`, or as an active `STAFF_ADMIN`
reviewer, I can see whether a Provider is verified, why it is or is not verified,
and whether a verification badge is currently earned so that remediation is
clear without confusing verification with application approval or operational
status.

**Why this priority**: Verification truth is a core output of R1-P06 and must
remain separate from the existing application, profile, and operational
lifecycles.

**Independent Test**: Evaluate Individual Team and Registered Company examples
across incomplete, approved, rejected, replaced, and expired evidence and
verify consistent verification state, badge truth, blockers, and unchanged
application/operational status.

**Acceptance Scenarios**:

1. **Given** an Individual Team, **When** verification truth is evaluated,
   **Then** `documentsVerified` is `NOT_REQUIRED` and satisfied while badge truth
   is `NOT_ELIGIBLE`, without awarding a false Company-document badge.
2. **Given** a Registered Company whose applicable required evidence is all
   currently approved, **When** verification truth is evaluated, **Then** the
   document gate is satisfied and protected badge truth is automatically
   `EARNED`.
3. **Given** a Registered Company missing or invalid under the approved policy,
   **When** verification truth is evaluated, **Then** safe blocker codes explain
   what remains, badge truth is `NOT_EARNED`, and no private metadata is exposed.
4. **Given** a Provider that satisfies R1-P06 gates, **When** its overall
   readiness is viewed, **Then** later-phase gates remain unchanged and the
   Provider is not made `LIVE` or publicly browseable by R1-P06.
5. **Given** an approved Provider that later becomes operationally `SUSPENDED`,
   **When** authorized document remediation or Staff review occurs, **Then** the
   work remains available and historically traceable while operational and
   public eligibility remain denied.
6. **Given** a new published policy version that becomes effective for the
   Provider's country and kind, **When** document truth is re-evaluated, **Then**
   the Provider uses the new current checklist, eligible evidence for unchanged
   stable types may continue to count, and all prior policy and decision meaning
   remains historically retrievable.
7. **Given** either launch document type with a future `issueDate`, an
   `expiresAt` not later than `issueDate`, a country different from the
   Provider's authoritative active country, or incomplete evidence, **When**
   submission is attempted, **Then** it fails without entering review or
   creating partial document, history, audit, or readiness truth.
8. **Given** a document upload using one valid PDF or an ordered valid JPEG/PNG
   image set within the approved limits, **When** every Media item becomes
   `READY`, **Then** the exact evidence set can be submitted without exposing a
   storage key or treating upload completion as review approval.
9. **Given** a file whose extension, declared MIME, signature, decoded content,
   safety result, size, page count, or evidence ordering violates policy,
   **When** Media processes it, **Then** submission is unavailable and no partial
   review, verification, history, audit, or readiness outcome is created.
10. **Given** an `EARNED` badge and a voluntary successor under review, **When**
    its valid unchallenged predecessor remains effective, **Then** the badge
    remains `EARNED`; if Staff challenges or invalidates the predecessor, it
    expires, or a new required policy item is unmet, **Then** the badge becomes
    `NOT_EARNED` immediately.

---

### User Story 6 - Register an External Payout Destination (Priority: P1)

As an active exact-Provider `OWNER`, I can register an external Mobile Wallet or
Bank Account destination with the required private details and type-specific
verification inputs so that the Provider can later receive settlements through
an approved external rail.

**Why this priority**: A valid external destination is the second R1-P06-owned
readiness capability and is necessary for later settlement, while actual money
movement remains out of scope.

**Independent Test**: Register one destination of each approved type, validate
type-specific input and privacy behavior, and verify that unsupported cards,
InstaPay, internal balances, and payout execution are unavailable.

**Acceptance Scenarios**:

1. **Given** an active exact-Provider `OWNER`, **When** a Mobile Wallet draft is
   created with the authoritative active country, normalized E.164 number,
   configured operator, legal holder name, and approved holder relationship,
   **Then** it is stored as an external destination without requesting an
   ownership-evidence file and is never represented as a Cleanora balance.
2. **Given** an active exact-Provider `OWNER`, **When** a Bank Account draft is
   created with the authoritative country, configured currency, active bank,
   normalized IBAN, legal holder name, and approved holder relationship,
   **Then** it is stored without requesting an ownership-evidence file and
   without initiating a payout.
3. **Given** a request for a card destination, InstaPay destination, or internal
   wallet, **When** it is attempted, **Then** it is rejected as unsupported by
   R1-P06 without creating a partial record.
4. **Given** malformed, inconsistent, or duplicate-sensitive values under the
   clarified policy, **When** registration is attempted, **Then** the outcome is
   safe, actionable, and contains no full sensitive value.
5. **Given** an active exact-Provider `ADMIN` or a Provider member other than the
   active `OWNER`, **When** that actor attempts to create or mutate a destination
   or primary truth, **Then** the action is denied without revealing or changing
   sensitive destination data.
6. **Given** an application that is not `APPROVED`, **When** any Provider-
   specific payout-destination creation, submission, review, or mutation is
   attempted, **Then** it is denied without creating a destination, history,
   audit, or readiness outcome.
7. **Given** a valid Mobile Wallet draft, **When** its active exact-Provider
   `OWNER` submits it, **Then** it becomes `PENDING_VERIFICATION`, exposes only a
   masked number to ordinary Provider views, and does not satisfy
   `payoutDestinationReady`.
8. **Given** a submitted Mobile Wallet, **When** an active `STAFF_ADMIN` performs
   the approved external transfer-attempt or beneficiary-lookup procedure,
   **Then** the Staff reviewer may narrowly access the full wallet number and
   must compare the displayed holder name with the authoritative name selected
   by the recorded holder relationship before deciding the exact version.
9. **Given** a successful or unsuccessful manual verification, **When** the
   `STAFF_ADMIN` approves, rejects, or requests correction or replacement,
   **Then** the immutable decision records the exact destination version,
   verification method, meaningful non-empty reason or note, Staff actor, and
   timestamp without storing the full wallet number in history or audit data.
10. **Given** any Mobile Wallet verification flow, **When** it is completed,
    **Then** Cleanora has not sent verification money, completed a transfer,
    integrated a wallet-transfer API, executed a payout, or recorded a
    settlement.
11. **Given** two wallet drafts with the same authoritative `countryCode` and
    normalized E.164 number, **When** the duplicate is detected regardless of
    `operatorCode`, **Then** a same-Provider duplicate is rejected and a cross-
    Provider claim is blocked pending active-`STAFF_ADMIN` resolution.
12. **Given** a valid Bank Account draft, **When** its active exact-Provider
    `OWNER` submits it, **Then** it becomes `PENDING_VERIFICATION`, exposes only
    a masked IBAN to ordinary views, and does not satisfy
    `payoutDestinationReady`.
13. **Given** a submitted Bank Account, **When** an active `STAFF_ADMIN` performs
    the approved beneficiary lookup or incomplete transfer-attempt procedure,
    **Then** the reviewer may narrowly access the full IBAN and must compare the
    displayed beneficiary name with the authoritative name selected by the
    holder relationship before deciding the exact version.
14. **Given** a Bank Account verification decision, **When** it is preserved,
    **Then** it records the verification method, meaningful non-empty reason or
    note, Staff actor, timestamp, and exact version without the full IBAN and
    without any uploaded bank-ownership document or settlement record.
15. **Given** two Bank Account drafts whose IBANs differ only by accepted
    formatting or case, **When** they normalize to the same IBAN, **Then** a
    same-Provider duplicate is rejected and a cross-Provider claim is blocked
    pending active-`STAFF_ADMIN` resolution.

---

### User Story 7 - Maintain Primary Destination Readiness (Priority: P1)

As an active exact-Provider `OWNER`, I can manage the Provider's primary external
payout destination according to the owner-approved policy, while an active
exact-Provider `ADMIN` can understand masked status without changing it, so that
`payoutDestinationReady` accurately reflects whether future settlement has a
usable destination.

**Why this priority**: The roadmap requires a primary-destination concept and a
missing-destination blocker. The approved bounded lifecycle prevents silent
verified-detail changes, surprise failover, and ambiguous readiness.

**Independent Test**: Exercise the complete state-transition matrix, five-chain
limit, linked-successor continuity, Staff challenge, primary selection and
removal, recent re-authentication, retries, concurrency, and notification
failure, then verify one deterministic readiness and history outcome.

**Acceptance Scenarios**:

1. **Given** no destination satisfying the clarified readiness policy, **When**
   readiness is viewed, **Then** `payoutDestinationReady` is unsatisfied with a
   safe missing-destination blocker.
2. **Given** a destination selected as primary under the approved policy,
   **When** it is current, active, and `APPROVED`, **Then** it may satisfy the
   gate without changing any later-phase gate; no other verification state may
   satisfy it.
3. **Given** the current primary destination, **When** it is removed,
   invalidated, or replaced under the approved lifecycle, **Then** primary truth
   and readiness change atomically and never point to an unusable record.
4. **Given** concurrent attempts to change primary truth, **When** they are
   processed, **Then** the system accepts only a policy-valid outcome and
   preserves an auditable history.
5. **Given** a destination eligible for Staff review, **When** an active
   `STAFF_ADMIN` verifies, rejects, or invalidates it with a meaningful non-empty
   reason, **Then** the exact destination version, decision, actor, reason, and
   timestamp are preserved immutably and readiness changes atomically.
6. **Given** a destination-verification decision without active `STAFF_ADMIN`
   authority or without a meaningful non-empty reason, **When** it is attempted,
   **Then** no destination, primary, verification, history, audit, or readiness
   truth changes.
7. **Given** an approved Provider that later becomes operationally `SUSPENDED`,
   **When** its active `OWNER` performs authorized destination remediation or an
   active `STAFF_ADMIN` performs authorized review, **Then** the work remains
   available and auditable while operational and public eligibility remain
   denied.
8. **Given** a Mobile Wallet that is submitted, `PENDING_VERIFICATION`, rejected,
   invalidated, removed, or replaced without successor approval, **When**
   readiness is derived, **Then** that destination does not satisfy
   `payoutDestinationReady`.
9. **Given** five active destination chains in any type combination, **When** the
   Owner attempts to create a sixth, **Then** the command is rejected without a
   partial draft; retained terminal history does not consume an active slot.
10. **Given** one chain already has an open successor, **When** another successor
    is attempted, **Then** it conflicts without changing either version.
11. **Given** no primary and the first destination becomes `APPROVED`, **When**
    approval commits, **Then** it becomes primary atomically; later unrelated
    approvals do not replace it automatically.
12. **Given** a voluntary successor under review, **When** its approved
    unchallenged predecessor is primary, **Then** the predecessor remains
    effective and primary; successor approval supersedes it and transfers
    primary atomically, while rejection or changes requested leaves it intact.
13. **Given** Staff requests replacement or invalidates the primary, **When** the
    decision commits, **Then** its readiness credit and primary status are
    removed immediately and no other destination is auto-promoted; approval of
    its linked successor may restore the chain's former primary status.
14. **Given** another approved destination exists, **When** the Owner removes the
    primary, **Then** a replacement primary must be selected in the same atomic
    command or the removal fails without change.
15. **Given** the primary is the last approved destination, **When** the Owner
    supplies explicit acknowledgement and a valid recent re-authentication,
    **Then** removal is allowed, primary becomes empty, and readiness becomes
    unsatisfied.
16. **Given** an Owner submission, successor submission, primary change,
    withdrawal, or removal, **When** re-authentication is absent or older than
    10 minutes, **Then** the command fails without business or notification
    effects; masked reads and draft edits remain available under the active
    authorized session.
17. **Given** a submission, Staff decision, primary change, removal, or successor
    approval/supersession, **When** the transition commits, **Then** one
    idempotent localized-template email intent for the exact active Owner is
    created with only safe masked content; submission also creates one Staff
    review-queue effect.
18. **Given** an accepted transition whose email delivery later fails, **When**
    retry processing occurs, **Then** delivery is retried asynchronously without
    duplicating the intent or rolling back destination, primary, or readiness
    truth.

---

### User Story 8 - Protect Private Documents and Payout Data (Priority: P1)

As a Provider or staff user, I can access only the private verification and
payout information allowed by my exact scope and purpose, while public users,
unrelated Providers, and general logs never receive sensitive data.

**Why this priority**: Verification documents and payout identifiers are highly
sensitive. Privacy failures would be a release-blocking breach of product and
constitutional rules.

**Independent Test**: Exercise write, masked own-Provider, Admin, cross-Provider,
purpose-bound Staff reveal, rotation, failure, and public paths; verify exact
masks, authorization, pre-return reveal audit, rate limits, cryptographic
separation, fail-closed behavior, and absence of forbidden contents from
responses, errors, histories, audit payloads, and logs.

**Acceptance Scenarios**:

1. **Given** a member of Provider A, **When** that actor requests Provider B's
   private document or payout record, **Then** access fails closed without
   confirming Provider B or the record exists.
2. **Given** any anonymous or public Provider representation, **When** it is
   viewed, **Then** it contains no private document, private metadata, storage
   key, full payout identifier, or private contact detail.
3. **Given** an ordinary permitted read after destination creation, **When**
   values are shown, **Then** the response follows the clarified masking/reveal
   policy and never includes more information than that policy authorizes.
4. **Given** any R1-P06 action or failure, **When** general logs and safe audit
   context are inspected, **Then** raw documents, full identifiers, encryption
   material, and storage keys are absent.
5. **Given** a submitted Mobile Wallet, **When** it is read outside the narrowly
   authorized Staff verification workflow, **Then** only the approved masked
   number is exposed and the full number is absent from Provider-facing
   responses, ordinary Staff views, generic history, audit payloads, logs, and
   public responses.
6. **Given** an Owner writes a valid wallet number or IBAN, **When** the write
   response or any later Provider read including `DRAFT` is returned, **Then**
   the identifier uses its exact approved mask and changing it requires full re-
   entry rather than revealing the stored value.
7. **Given** an active exact-Provider Owner and Admin inspect the same
   destination, **When** their authorized views are returned, **Then** the Owner
   may see the configured institution label, relationship, and current holder
   legal name but not the full identifier, while the Admin sees only type, mask,
   status, primary truth, and safe timestamps with no holder name.
8. **Given** an active Staff Admin with the payout-verification capability and a
   step-up no more than five minutes old, **When** that actor supplies a
   meaningful reason and requests one exact pending version for the approved
   verification purpose, **Then** one purpose-bound non-cacheable reveal may
   return the full identifier and holder name only after its safe accepted audit
   evidence persists.
9. **Given** a reveal request is unauthorized, out of state, bulk, stale,
   malformed, over the five-per-10-minute limit, missing a required key, unable
   to decrypt, or unable to persist audit evidence, **When** it is evaluated,
   **Then** it fails closed without returning plaintext or substituting stored
   ciphertext, a fingerprint, or a mask as the sensitive value.
10. **Given** a valid Mobile Wallet or Bank Account, **When** its ordinary mask
    is rendered, **Then** the wallet preserves `+` and its country calling code,
    masks every national digit except the final four, and the IBAN preserves
    only its two-letter country prefix and final four while replacing every
    intervening alphanumeric with `•` and grouping in blocks of four.
11. **Given** encryption or lookup-key rotation is in progress, **When** new and
    existing identifiers are written or compared, **Then** new writes use the
    active keys, duplicate detection checks every enabled lookup-key version,
    and retained old-key values remain safely recoverable only for authorized
    purposes until verified migration and human-approved retirement.

---

### User Story 9 - Review Complete Audit and Domain History (Priority: P1)

As an authorized auditor or staff reviewer, I can reconstruct document and
payout-destination changes from immutable business history and privileged audit
evidence so that disputes, retries, replacements, and access decisions are
explainable.

**Why this priority**: The phase contains privileged decisions and high-risk
data changes. Durable attribution is necessary for operational control and
review.

**Independent Test**: Perform uploads, decisions, replacements, expiry effects,
destination mutations, primary changes, allowed and denied reveal attempts, and
denied cross-scope access, then verify complete chronological history and
purpose-bound reveal audit with safe meaning and no sensitive payload leakage.

**Acceptance Scenarios**:

1. **Given** a privileged verification decision, **When** history is inspected,
   **Then** actor, action, target, decision, the mandatory document-decision
   reason or separately policy-required payout-decision reason, and timestamp
   are present without raw private values.
2. **Given** a payout-destination mutation, **When** history is inspected,
   **Then** the business change is attributable without storing the full
   destination identifier in audit content.
3. **Given** a denied cross-provider attempt, **When** denial evidence is
   reviewed, **Then** it is useful for security review but does not disclose the
   private target to the caller.
4. **Given** a retry or concurrency conflict, **When** history is inspected,
   **Then** it does not falsely report multiple successful business outcomes.
5. **Given** an allowed or denied full-value reveal attempt, **When** privileged
   audit evidence is inspected, **Then** it contains actor, target Provider and
   exact destination version, purpose, meaningful reason, timestamp, request ID,
   outcome, and applicable key versions, while excluding plaintext, ciphertext,
   nonce, tag, lookup fingerprint, and key material; an accepted reveal has no
   response-before-audit gap.

---

### User Story 10 - Manage Configurable Verification Policy (Priority: P2)

As an authorized policy administrator, I can work with configurable document
and destination type definitions according to the clarified authority and
retroactivity rules so that business policy can evolve without erasing prior
verification evidence or hard-coding every rule.

**Why this priority**: Configurability is required by the roadmap, but policy
administration must follow clarified country, authority, and retroactivity
decisions.

**Independent Test**: Apply the clarified policy-management rules to document
and destination types and verify stable codes, historical interpretation,
existing-Provider impact, and readiness behavior.

**Acceptance Scenarios**:

1. **Given** the initial policy, **When** configured types are enumerated,
   **Then** the two approved Company document codes and two approved payout
   destination codes are stable and unambiguous.
2. **Given** a policy change permitted by the clarified authority, **When** it
   takes effect, **Then** its impact on existing and new records follows the
   clarified retroactivity rule and is auditable.
3. **Given** historical evidence created under an earlier policy, **When** a
   definition changes, **Then** historical decisions remain interpretable and
   are not silently rewritten.

### Edge Cases

- A Provider changes no R1-P05 application or profile fact, but a required
  document becomes invalid or expires under the approved policy.
- A Registered Company submits two files that appear to represent the same
  document type or reuses one file for both required types.
- Media upload succeeds but finalization, safety validation, or readiness does
  not; the Provider must not receive document credit.
- A `.jpg` or `.jpeg` file declares `image/jpeg` but its signature or decoded
  content disagrees, or a differently named file contains valid JPEG content;
  server-detected content, not the extension alone, controls acceptance.
- A PDF is encrypted, password-protected, malformed, contains active content,
  exceeds 15 MiB or 10 pages, or is mixed with image pages in one version.
- An image set contains more than 10 pages, a page over 5 MiB, an aggregate over
  20 MiB, a non-JPEG/PNG page, a missing page, or a reordered page list.
- A document is replaced while a reviewer is deciding the prior version.
- A voluntary successor is rejected while its predecessor remains approved and
  unexpired; the predecessor continues to count unless Staff challenged it.
- Staff requests replacement of an approved version while a voluntary successor
  is already under review; the predecessor stops counting immediately and the
  successor still requires its own exact-version decision.
- Two reviewers attempt conflicting decisions against the same document
  version.
- A configuration change occurs while a document is under review or after it
  was approved.
- A document has no legal expiry date even though other documents of the same
  general kind may expire.
- A rejected or expired document is resubmitted with corrected metadata but the
  same underlying file.
- A Provider member is disabled or loses scope during an upload or destination
  mutation.
- A staff account becomes inactive or loses authority between dossier read and
  decision submission.
- Two destination records normalize to the same sensitive identifier under the
  clarified duplicate policy.
- Two Mobile Wallet drafts use the same country and normalized E.164 number but
  select different operators; the operator difference does not avoid the
  duplicate conflict.
- The active Owner changes after a `PROVIDER_OWNER` Mobile Wallet is submitted
  but before Staff verification; the externally displayed holder name no longer
  matches the exact active Owner and the version cannot be approved unchanged.
- A wallet transfer attempt or beneficiary lookup cannot display a reliable
  holder name; Staff must reject or request correction or replacement rather
  than approve on incomplete verification.
- A Bank Account IBAN contains spaces or lowercase letters, or two differently
  formatted values normalize to the same IBAN; canonical normalization controls
  validation and duplicate identity.
- A Bank Account uses an inactive bank code, a bank code outside the Provider's
  authoritative country, or a non-`EGP` currency under the launch `EG` policy.
- A bank beneficiary lookup cannot return a reliable beneficiary name, or the
  displayed name does not match the authoritative legal entity or exact active
  Owner selected by the relationship; Staff cannot approve the version.
- A primary destination is invalidated while another request attempts to make a
  different destination primary.
- Five active destination chains exist while retained rejected, invalidated,
  superseded, or removed versions remain in history; only active chains count
  against the limit.
- Two successor drafts are attempted concurrently for the same destination
  chain; at most one open successor may exist.
- A recent re-authentication expires between client confirmation and command
  authorization; the server-authoritative freshness check denies the command.
- A Staff invalidation clears the primary while other approved destinations
  exist; none is promoted automatically and readiness remains blocked until the
  Owner explicitly selects one.
- A notification provider is unavailable after the business transition commits;
  the durable intent retries without rewriting or reversing business truth.
- An encryption or reveal capability is unavailable; ordinary reads must fail
  safely without returning stored ciphertext or unmasked values.
- An encryption or lookup key ring is missing, malformed, reused across
  purposes, names an unknown active key, or cannot cover retained key versions;
  startup and readiness fail closed with no default key.
- A retained destination references a historical key that is unavailable;
  neither ciphertext, lookup fingerprint, nor stored mask is substituted as the
  sensitive plaintext.
- Encryption and lookup keys rotate while a destination write or duplicate
  check is concurrent; the write uses the active keys and equality checks every
  enabled lookup-key version without permitting a duplicate claim.
- A Staff reveal is otherwise authorized but the safe audit write fails; no
  plaintext is returned because accepted reveal audit precedes disclosure.
- A Staff actor retries a reveal with a new request ID after reaching five
  accepted reveals in 10 minutes; the retry remains rate-limited and cannot
  bypass the actor window.
- A caller requests a bulk reveal, a reusable export, an approved or terminal
  destination, or a Provider-side full-value view; the purpose-bound workflow
  denies it without sensitive disclosure.
- A client retries after an ambiguous timeout; the retry must not create
  duplicate reviews, destinations, histories, or primary outcomes.
- A caller supplies another Provider's identifier and a valid record identifier
  from that Provider; the response must not confirm either resource exists.
- An R1-P06 gate becomes satisfied while workers, services, coverage,
  availability, capacity, operational status, or public eligibility remain
  incomplete.

## Requirements *(mandatory)*

### Functional Requirements

#### Provider identity and applicability

- **FR-001**: The system MUST preserve Company account identity and Provider
  identity as separate concepts.
- **FR-002**: The system MUST recognize only `INDIVIDUAL_TEAM` and
  `REGISTERED_COMPANY` as the Provider kinds relevant to R1-P06.
- **FR-003**: The system MUST authorize Provider-owned document administration
  through active identity and active exact-Provider `OWNER` or `ADMIN`
  membership, and payout-destination mutation through active identity and
  active exact-Provider `OWNER` membership only; it MUST NOT depend on a
  `PROVIDER_OWNER` account category or global role.
- **FR-004**: The system MUST treat `INDIVIDUAL_TEAM` Provider documents as
  `NOT_REQUIRED` and satisfied.
- **FR-005**: The system MUST NOT offer, request, or require Registered Company
  documents from an `INDIVIDUAL_TEAM`.
- **FR-006**: The system MUST exclude all R1-P06 document requirements from the
  R1-P05 `profileCompletion` calculation for every Provider kind.
- **FR-007**: The system MUST apply the Registered Company document checklist
  only to `REGISTERED_COMPANY` Providers.
- **FR-008**: The system MUST NOT create a separate Service Provider account
  type or require a Company applicant to become an Individual.
- **FR-009**: The system MUST preserve R1-P05 application approval independently
  from document verification and payout-destination verification. No Provider-
  specific R1-P06 document or payout-destination record may be created,
  submitted, reviewed, or mutated while the application is `DRAFT`,
  `PENDING_REVIEW`, `CHANGES_REQUESTED`, or terminal `REJECTED`; those
  capabilities begin only after `APPROVED`.

#### Configurable document policy

- **FR-010**: The initial Registered Company checklist MUST contain exactly the
  active, required stable type codes `COMMERCIAL_REGISTRATION` and
  `TAX_REGISTRATION` under the launch Egypt (`EG`) policy.
- **FR-011**: `COMMERCIAL_REGISTRATION` MUST represent Commercial Registration
  evidence and MUST remain distinguishable from Tax Registration evidence.
- **FR-012**: `TAX_REGISTRATION` MUST represent an applicable Tax Registration,
  Tax Card, or Tax Certificate and MUST remain distinguishable from Commercial
  Registration evidence.
- **FR-013**: Document-type definitions MUST be configurable business records
  rather than rules hard-coded entirely into Provider behavior.
- **FR-014**: A document-type definition MUST have a stable code, a
  human-understandable name, applicability, requirement semantics, and
  versioned metadata-field requirements.
- **FR-015**: Document requirements MUST be grouped into country-code and
  Provider-kind policy versions that express required versus optional status,
  active versus retired availability, and an effective time. Country validity
  MUST come from Configuration-owned facts; business behavior MUST NOT hard-code
  Egypt even though the launch policy is for `EG`.
- **FR-016**: A published document-policy version MUST be immutable and
  effective-dated. When it becomes effective, every approved Provider in its
  country-and-kind scope MUST be re-evaluated against that current version while
  historical policy versions, submissions, decisions, and prior readiness
  meaning remain attributable and interpretable.
- **FR-017**: Only an active `STAFF_ADMIN` MUST be able to create or edit a draft
  document-policy version and publish it. Publication MUST require a meaningful
  non-empty reason and MUST preserve the actor, timestamp, exact published
  version, and safe before/after audit meaning. Published versions MUST NOT be
  edited in place.
- **FR-018**: Unknown, inactive, or inapplicable document-type codes MUST fail
  safely and MUST NOT create partial Provider evidence.

#### Private document submission and lifecycle

- **FR-019**: An active exact-Provider `OWNER` or `ADMIN` MUST be able to view
  that Provider's private, kind-specific document checklist, documents, and
  history; an active `STAFF_ADMIN` MUST be able to inspect the private dossier
  required for privileged review.
- **FR-020**: An active exact-Provider `OWNER` or `ADMIN` MUST be able to
  associate complete private uploaded evidence with that Provider and one
  applicable document type. Both launch types MUST require `countryCode`,
  `documentNumber`, `legalName`, `issuerName`, and `issueDate`, and MAY include
  `expiresAt`.
- **FR-021**: Provider verification MUST use Media-owned upload, storage,
  processing, status, and private-delivery capabilities through an explicit
  public contract. That contract and its configured storage adapter, including
  the Cloudinary adapter, MUST support validated `image/jpeg` content for both
  `.jpg` and `.jpeg`, validated `image/png`, and validated `application/pdf`
  without exposing storage keys.
- **FR-022**: Provider verification MUST NOT directly query or mutate
  Media-owned persistence.
- **FR-023**: A draft document MAY reference Media evidence in `PENDING_UPLOAD`
  or `PROCESSING`, but it MUST NOT be submitted, reviewed, or count toward
  verification until every item in its immutable ordered evidence set is
  `READY`. A `FAILED`, missing, deleted, or reordered item MUST fail safely and
  create no partial Provider truth.
- **FR-024**: Each document version MUST use exactly one complete-evidence
  format: either one validated `application/pdf` file of at most 15 MiB and 10
  pages, or 1–10 ordered validated `image/jpeg` or `image/png` files, each at
  most 5 MiB and at most 20 MiB in aggregate. `image/jpeg` MUST accept both
  `.jpg` and `.jpeg`; PDF and image evidence MUST NOT be mixed in one version.
  Media MUST verify signatures and decoded content rather than trust filenames
  or declared MIME, reject malformed, encrypted/password-protected, active-
  content, executable, mismatched, unsafe, or over-limit files, scan for
  malware, normalize image orientation, and remove unsafe image metadata before
  marking evidence `READY`.
- **FR-025**: A Provider-document record MUST identify the Provider, configured
  type, policy version, normalized required metadata, evidence reference and
  ordered page evidence, current lifecycle meaning, version, and relevant
  business dates without exposing storage keys to Provider-domain consumers.
- **FR-026**: An active exact-Provider `OWNER` or `ADMIN` MUST be able to create
  a `DRAFT`, enter metadata, attach upload evidence, and submit it as immutable
  `SUBMITTED` evidence. Every correction, resubmission, renewal, or replacement
  MUST create a linked successor version rather than mutate submitted evidence.
- **FR-027**: A document version MUST use only `DRAFT`, `SUBMITTED`, `APPROVED`,
  `REJECTED`, `REPLACEMENT_REQUESTED`, `EXPIRED`, `INVALIDATED`, or
  `SUPERSEDED`, and MUST permit only the owner-approved transitions. Rejected,
  replacement-requested, expired, invalidated, and superseded versions are
  terminal; remediation creates a successor.
- **FR-028**: The system MUST distinguish one current effective approved version
  per applicable Provider/type from candidate and historical versions. A
  voluntary submitted successor MUST leave a still-valid, unchallenged approved
  predecessor effective until successor approval, predecessor expiry, Staff
  invalidation, or Staff replacement request.
- **FR-029**: The system MUST NOT hard-delete document or review history through
  ordinary lifecycle operations, and every successor MUST retain its predecessor
  relation and chronological history.

#### Document review, verification, and badge truth

- **FR-030**: A `SUBMITTED` document version MUST support privileged approval,
  rejection, or replacement-request decisions by an active `STAFF_ADMIN`; an
  effective `APPROVED` version MUST additionally support later replacement
  request or invalidation. Successor approval MUST atomically make that version
  effective and change its effective approved predecessor to `SUPERSEDED`.
- **FR-031**: Only an active `STAFF_ADMIN` MUST be authorized to decide document
  verification. Provider `OWNER` and `ADMIN` membership MUST NOT grant approval,
  rejection, replacement-request, invalidation, or other review authority over
  the Provider's own evidence.
- **FR-032**: Every privileged document-verification decision MUST record the
  Staff actor, outcome, target evidence version, timestamp, and meaningful
  non-empty reason in immutable review and safe audit/history evidence.
- **FR-033**: A privileged document-verification decision without a meaningful
  non-empty reason MUST fail without changing document, review, verification,
  badge, or readiness truth.
- **FR-034**: A review decision MUST be based on the current eligible evidence
  version and expected lifecycle version and MUST reject stale, terminal, or
  conflicting attempts safely.
- **FR-035**: Matching retries MUST be idempotent, while non-matching retries or
  conflicting decisions MUST return a conflict without corrupting current
  truth.
- **FR-036**: Document review history MUST be immutable and chronologically
  retrievable by authorized actors.
- **FR-037**: `countryCode` MUST equal the Provider's authoritative active
  country, `issueDate` MUST NOT be in the future, and a supplied `expiresAt` MUST
  be later than `issueDate`. An omitted `expiresAt` MUST mean that the document
  does not expire automatically. At the authoritative expiry boundary, an
  effective approved version MUST become `EXPIRED` and stop satisfying its
  requirement; Staff may also make an approved version `INVALIDATED` or
  `REPLACEMENT_REQUESTED` with the required reason.
- **FR-038**: The effect of expiration, rejection, replacement, or policy change
  on current verification MUST be historically traceable. Rejection of a
  voluntary successor MUST leave a still-valid, unchallenged approved
  predecessor effective; Staff replacement request, invalidation, or expiry of
  the predecessor MUST make the requirement incomplete until an eligible
  successor is approved. For a newly effective policy version, eligible current
  evidence for an unchanged stable type MAY continue to satisfy the requirement,
  a newly required type MAY make `documentsVerified` incomplete, and a retired
  requirement MUST stop blocking current readiness without erasing prior
  meaning.
- **FR-039**: Provider verification truth MUST be derived from the applicable
  current effective country-and-kind policy version and current eligible
  evidence, not from a caller-supplied verified flag or a Provider's obsolete
  policy assignment.
- **FR-040**: R1-P06 MUST own protected verification-badge truth using only
  `NOT_ELIGIBLE`, `NOT_EARNED`, and `EARNED`. `INDIVIDUAL_TEAM` MUST always be
  `NOT_ELIGIBLE`; only an application-`APPROVED` `REGISTERED_COMPANY` is
  eligible. Anonymous badge rendering remains outside this phase and belongs to
  R1-P12.
- **FR-041**: An eligible Registered Company badge MUST be derived as `EARNED`
  exactly while `documentsVerified` is satisfied by effective approved evidence
  for every active required type under the current policy; otherwise it MUST be
  `NOT_EARNED`. Staff replacement request, invalidation, expiry, or an unmet new
  requirement MUST remove it immediately. A voluntary successor MUST preserve
  it while its valid unchallenged predecessor remains effective, and successor
  approval MUST preserve it through atomic supersession. Operational
  `SUSPENDED` status MUST NOT rewrite document or badge truth, although it
  continues to deny operational and public eligibility.
- **FR-042**: Safe blocker codes MUST explain incomplete Company verification
  without including private document metadata.

#### Readiness integration

- **FR-043**: R1-P06 MUST consume or extend the existing Provider readiness
  contract rather than replace it with a second readiness model.
- **FR-044**: `documentsVerified` MUST remain `NOT_REQUIRED` and satisfied for
  `INDIVIDUAL_TEAM`.
- **FR-045**: `documentsVerified` for `REGISTERED_COMPANY` MUST reflect the
  applicable current document policy and evidence truth.
- **FR-046**: R1-P06 MUST NOT alter the R1-P05 ten-check
  `profileCompletion` policy.
- **FR-047**: R1-P06 MAY satisfy only `documentsVerified` and
  `payoutDestinationReady` and MUST preserve every other gate and owning phase.
  After application approval, neither R1-P06-owned gate MUST be a prerequisite
  for starting authorized work on the other.
- **FR-048**: Satisfying both R1-P06-owned gates MUST NOT make a Provider
  operationally `LIVE`.
- **FR-049**: Satisfying both R1-P06-owned gates MUST NOT make a Provider
  eligible for anonymous public Browse.
- **FR-050**: Dashboard and readiness representations MUST show current R1-P06
  blockers consistently without exposing private evidence or payout details.

#### External payout destinations

- **FR-051**: R1-P06 MUST support exactly the destination type codes
  `MOBILE_WALLET` and `BANK_ACCOUNT`.
- **FR-052**: The system MUST reject card-based destinations, InstaPay
  integration, and any unsupported type in R1-P06.
- **FR-053**: A payout destination MUST represent an external settlement target
  and MUST NOT represent money, stored value, a Cleanora wallet, or a balance.
- **FR-054**: Creating or verifying a payout destination MUST NOT complete,
  schedule, authorize, or record an actual payout, send verification money,
  integrate an external transfer API, or record an actual settlement. A manual
  Staff transfer attempt or beneficiary lookup may be used only as the approved
  operational verification procedure and MUST stop before transfer completion.
- **FR-055**: Only an active exact-Provider `OWNER` MUST be able to create or
  update a Mobile Wallet payout-destination draft with its policy-defined
  private details.
- **FR-056**: Only an active exact-Provider `OWNER` MUST be able to create or
  update a Bank Account payout-destination draft with its policy-defined private
  details.
- **FR-057**: The Mobile Wallet country, field schema, normalization, Staff
  verification, masking, and duplicate rules MUST follow FR-089 through FR-103.
  The Bank Account country, field schema, normalization, Staff verification,
  masking, and duplicate rules MUST follow FR-104 through FR-117.
- **FR-058**: Destination types MUST remain configurable business definitions
  with stable codes and type-specific validation semantics.
- **FR-059**: The destination lifecycle MUST reserve creation, sensitive-detail
  updates, replacement, removal, and primary selection to the active exact-
  Provider `OWNER`; it MUST reserve verification, rejection, and invalidation to
  an active `STAFF_ADMIN` and MUST follow the exact state, cardinality,
  continuity, primary, re-authentication, and notification rules in FR-118
  through FR-139.
- **FR-060**: Only an active exact-Provider `OWNER` MUST be able to select or
  change primary-destination truth, subject to the clarified cardinality,
  verification, selection, and removal policy.
- **FR-061**: The system MUST NOT allow primary truth to reference a destination
  that is unusable under the approved readiness policy.
- **FR-062**: `payoutDestinationReady` MUST be derived from authoritative
  destination and primary-policy facts, not from a caller-supplied ready flag.
- **FR-063**: With no destination satisfying the approved readiness policy,
  `payoutDestinationReady` MUST be unsatisfied with a safe blocker.
- **FR-064**: Owner-authorized destination creation, primary changes,
  replacement, and removal, and Staff-authorized verification or invalidation,
  MUST update readiness atomically with the accepted business outcome.

#### Privacy, authorization, and audit

- **FR-065**: Provider private contacts, private documents, private document
  metadata, and full payout details MUST NOT appear in anonymous or public
  Provider representations.
- **FR-066**: Full sensitive payout identifiers, storage keys, raw tokens,
  encryption material, and private document contents MUST NOT appear in general
  logs, public errors, public interfaces, or safe audit context.
- **FR-067**: Ordinary and privileged private reads MUST follow the clarified
  masking and purpose-bound reveal contract in FR-140 through FR-166 and MUST
  return no more information than the actor's approved purpose authorizes. An
  active exact-Provider `ADMIN` may view only the explicitly allowed masked
  destination status projection and MUST NOT gain destination-mutation
  authority from that read access.
- **FR-068**: The system MUST protect sensitive destination values at rest and
  MUST use the authenticated-encryption and separate irreversible normalized-
  lookup mechanisms in FR-140 through FR-166 wherever recoverability and
  duplicate/equality policy respectively require them.
- **FR-069**: The system MUST apply the closed encryption, lookup-fingerprint,
  masking, reveal, audit, rate-limit, rotation, and Release 1 operational-
  configuration contract in FR-140 through FR-166 without implementation-time
  defaults that weaken it.
- **FR-070**: Every operation MUST authorize the active identity, exact Provider
  scope, membership or staff authority, resource state, and action capability
  from server-authoritative facts. Provider document administration requires
  active exact-Provider `OWNER` or `ADMIN` membership, while document decisions
  require active `STAFF_ADMIN` authority. Payout-destination mutation and
  primary selection require active exact-Provider `OWNER` membership, masked
  status viewing permits active exact-Provider `ADMIN` membership, and payout-
  destination verification decisions require active `STAFF_ADMIN` authority.
  Every Provider-specific R1-P06 action additionally requires an `APPROVED`
  application. Later operational `SUSPENDED` status MUST preserve authorized
  remediation and review while continuing to deny operational and public
  eligibility.
- **FR-071**: Cross-provider private reads and mutations MUST fail closed without
  confirming the Provider, document, review, or destination exists.
- **FR-072**: Authentication activity, session capability, and staff
  authorization MUST be consumed through an Authentication-owned public
  contract rather than direct Authentication persistence access.
- **FR-073**: Country validity and configuration facts MUST be consumed through
  a Configuration-owned public contract rather than direct Configuration
  persistence access.
- **FR-074**: Any Company profile fact required for review MUST be consumed
  through a Customers-owned public contract rather than direct Customers
  persistence access.
- **FR-075**: Every privileged document decision MUST preserve the Staff actor,
  target document version, outcome, meaningful non-empty reason, timestamp, and
  safe before/after meaning. Every payout-verification decision MUST likewise
  preserve the active `STAFF_ADMIN`, target destination version, outcome,
  meaningful non-empty reason or verification note, verification method,
  timestamp, and safe before/after meaning. Every Owner destination mutation
  MUST preserve actor, target, action, timestamp, and safe before/after meaning
  without exposing full sensitive values.
- **FR-076**: Provider-document and payout-destination lifecycle changes MUST
  preserve Provider-owned domain history distinct from general privileged audit
  evidence.
- **FR-077**: Denied high-risk access attempts MUST produce minimized security
  evidence without leaking private target facts to the caller.

#### Integrity and phase boundaries

- **FR-078**: Editable document, review, configuration, and destination
  resources MUST use version or equivalent concurrency protection where stale
  writes could corrupt current truth.
- **FR-079**: Concurrent document decisions, replacements, destination
  mutations, and primary changes MUST preserve at most one policy-valid current
  outcome.
- **FR-080**: Retried operations MUST not create duplicate documents, reviews,
  destinations, histories, audit outcomes, or readiness transitions.
- **FR-081**: A failed multi-record business operation MUST NOT expose a partial
  successful outcome.
- **FR-082**: Historical document, review, verification, and destination records
  MUST remain attributable and must not be silently overwritten by current
  values.
- **FR-083**: R1-P06 MUST NOT create or modify worker/team behavior owned by
  R1-P07.
- **FR-084**: R1-P06 MUST NOT create or modify service/pricing behavior owned by
  R1-P09.
- **FR-085**: R1-P06 MUST NOT create or modify coverage, availability, or
  capacity behavior owned by R1-P10.
- **FR-086**: R1-P06 MUST NOT grant final marketplace eligibility owned by
  R1-P11 or anonymous Browse behavior owned by R1-P12.
- **FR-087**: R1-P06 MUST NOT implement booking/customer payments, payout
  execution, settlement scheduling, ledger balances, internal wallets, card
  destinations, or InstaPay.
- **FR-088**: R1-P06 MUST preserve all applied migrations unchanged; any later
  authorized persisted-data implementation must be additive and phase-owned.
- **FR-089**: A Mobile Wallet draft MUST contain the Provider's authoritative
  active `countryCode`, wallet number normalized to E.164, `operatorCode`, wallet
  holder's full legal name, and exactly one holder relationship:
  `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`.
- **FR-090**: `operatorCode` MUST reference an active payout operator in the
  Provider's country-scoped registry. The system MUST NOT infer it from a phone
  prefix and MUST NOT accept a free-text operator.
- **FR-091**: The Mobile Wallet number MUST NOT be required to equal the active
  Owner's Authentication phone, and `phoneVerified` MUST NOT be a prerequisite
  for Mobile Wallet submission or verification.
- **FR-092**: Mobile Wallet creation, submission, verification, approval, or
  readiness MUST NOT require or accept an uploaded ownership/control-evidence
  file, screenshot, statement, contract, or other proof-of-ownership document.
- **FR-093**: Submitting a Mobile Wallet destination MUST move that exact version
  to `PENDING_VERIFICATION` and MUST NOT satisfy `payoutDestinationReady`.
- **FR-094**: Only an active `STAFF_ADMIN` MUST be able to approve, reject, or
  request correction or replacement of a submitted Mobile Wallet version.
- **FR-095**: Before approving a Mobile Wallet, the active `STAFF_ADMIN` MUST use
  a manual external wallet transfer attempt or beneficiary lookup that stops
  before transfer completion and MUST check the externally displayed registered
  holder name.
- **FR-096**: For `PROVIDER_LEGAL_ENTITY`, the displayed holder name MUST match
  the Provider's authoritative legal-entity name. For `PROVIDER_OWNER`, it MUST
  match the exact active Owner's authoritative legal name. A mismatch or an
  unverifiable name MUST result in rejection or a correction/replacement
  request, never approval.
- **FR-097**: Every Mobile Wallet Staff decision MUST record a meaningful non-
  empty reason or verification note, Staff actor ID, decision timestamp, exact
  payout-destination version, verification method such as
  `MANUAL_WALLET_TRANSFER_CHECK`, immutable lifecycle and decision history, and
  safe audit evidence without an uploaded ownership-evidence file.
- **FR-098**: Every Mobile Wallet command MUST target the exact expected version;
  a matching retry MUST be idempotent, while a stale or competing command MUST
  conflict without changing destination, decision, history, audit, or readiness
  truth.
- **FR-099**: Mobile Wallet uniqueness MUST use authoritative `countryCode` plus
  normalized E.164 wallet number independently of `operatorCode`. The same
  wallet MUST NOT be duplicated within a Provider or concurrently claimed by
  different Providers; a cross-Provider conflict MUST require active-
  `STAFF_ADMIN` resolution.
- **FR-100**: After Mobile Wallet submission, ordinary Provider-facing
  responses, lists, and history MUST expose only a masked wallet number.
- **FR-101**: The full Mobile Wallet number MUST be available only through the
  narrowly authorized active-`STAFF_ADMIN` verification workflow and MUST NOT
  appear in logs, audit payloads, generic history, ordinary Staff or Provider
  responses, errors, or public responses.
- **FR-102**: Only a current active `APPROVED` payout destination may satisfy
  `payoutDestinationReady`. A draft, submitted, `PENDING_VERIFICATION`, rejected,
  invalidated, removed, or replaced-but-not-approved destination MUST NOT
  satisfy the gate.
- **FR-103**: The Mobile Wallet manual verification procedure MUST remain a
  Staff operational action outside Cleanora; R1-P06 MUST NOT automate the
  transfer attempt or beneficiary lookup, integrate wallet-transfer execution,
  or persist an actual transfer, verification-money movement, or settlement.
- **FR-104**: Only an active exact-Provider `OWNER` MUST be able to create or
  update a Bank Account payout-destination draft.
- **FR-105**: A Bank Account draft MUST contain the Provider's authoritative
  active `countryCode`, configured payout `currencyCode`, active country-scoped
  `bankCode`, normalized IBAN, holder full legal name, and exactly one holder
  relationship: `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`. The launch `EG`
  policy MUST accept only `EGP` as its configured payout currency.
- **FR-106**: `bankCode` MUST reference an active bank in the Provider's country-
  scoped payout-bank registry, and bank name MUST be resolved from that record
  rather than accepted as caller-entered free text.
- **FR-107**: R1-P06 MUST validate and store one canonically normalized IBAN. For
  the launch IBAN-first policy, it MUST NOT request a separate domestic account
  number, branch, or caller-entered SWIFT/BIC when the normalized IBAN and bank
  registry provide the necessary destination identity.
- **FR-108**: Bank Account creation, submission, verification, approval, or
  readiness MUST NOT require or accept a bank statement, account certificate,
  cheque image, contract, screenshot, or other uploaded ownership/control-
  evidence document.
- **FR-109**: Submitting a Bank Account destination MUST move that exact version
  to `PENDING_VERIFICATION` and MUST NOT satisfy `payoutDestinationReady`.
- **FR-110**: Only an active `STAFF_ADMIN` MUST be able to approve, reject, or
  request correction or replacement of a submitted Bank Account version after
  a manual beneficiary lookup or bank-transfer attempt that stops before
  transfer completion.
- **FR-111**: For `PROVIDER_LEGAL_ENTITY`, the externally displayed beneficiary
  name MUST match the Provider's authoritative legal-entity name. For
  `PROVIDER_OWNER`, it MUST match the exact active Owner's authoritative legal
  name. A mismatch or unverifiable beneficiary name MUST result in rejection or
  a correction/replacement request, never approval.
- **FR-112**: The Bank Account manual verification procedure MUST remain a Staff
  operational action outside Cleanora; R1-P06 MUST NOT automate the lookup,
  integrate bank-transfer execution, move verification money, complete a
  transfer, or persist an actual transfer or settlement.
- **FR-113**: Every Bank Account Staff decision MUST record a meaningful non-
  empty reason or verification note, Staff actor ID, decision timestamp, exact
  payout-destination version, verification method such as
  `MANUAL_BANK_BENEFICIARY_CHECK`, immutable lifecycle and decision history, and
  safe audit evidence without an uploaded ownership-evidence file.
- **FR-114**: Every Bank Account command MUST target the exact expected version;
  a matching retry MUST be idempotent, while a stale or competing command MUST
  conflict without changing destination, decision, history, audit, or readiness
  truth.
- **FR-115**: Canonically normalized IBAN MUST be the Bank Account duplicate
  identity. The same IBAN MUST NOT be duplicated within a Provider or
  concurrently claimed by different Providers; a cross-Provider conflict MUST
  require active-`STAFF_ADMIN` resolution.
- **FR-116**: After Bank Account submission, ordinary Provider-facing responses,
  lists, and history MUST expose only a masked IBAN. The full IBAN MUST be
  available only through the narrowly authorized active-`STAFF_ADMIN`
  verification workflow and MUST NOT appear in logs, audit payloads, generic
  history, ordinary Staff or Provider responses, errors, or public responses.
- **FR-117**: Only a current active `APPROVED` Bank Account destination may
  satisfy `payoutDestinationReady`. A draft, submitted,
  `PENDING_VERIFICATION`, rejected, invalidated, removed, or replaced-but-not-
  approved Bank Account MUST NOT satisfy the gate.
- **FR-118**: One Provider MUST have at most five active payout-destination
  chains across `MOBILE_WALLET` and `BANK_ACCOUNT` in any combination. Retained
  terminal historical versions MUST NOT consume an active-chain slot.
- **FR-119**: Each destination chain MUST have at most one open linked successor
  at a time; a concurrent or later second successor MUST conflict without
  altering either version.
- **FR-120**: A payout-destination version MUST use exactly `DRAFT`,
  `PENDING_VERIFICATION`, `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`,
  `REPLACEMENT_REQUESTED`, `INVALIDATED`, `SUPERSEDED`, or `REMOVED`.
- **FR-121**: An active exact-Provider `OWNER` MAY move `DRAFT` to
  `PENDING_VERIFICATION` by submission or to `REMOVED` by abandonment.
- **FR-122**: Only an active `STAFF_ADMIN` MAY move
  `PENDING_VERIFICATION` to `APPROVED`, `CHANGES_REQUESTED`, or `REJECTED`; the
  active exact-Provider `OWNER` MAY withdraw it to `REMOVED` before a Staff
  decision, subject to exact-version conflict protection.
- **FR-123**: An `APPROVED` version MAY move to `REPLACEMENT_REQUESTED` or
  `INVALIDATED` only by an active `STAFF_ADMIN`, to `SUPERSEDED` only through
  linked-successor approval, or to `REMOVED` only through an authorized Owner
  removal.
- **FR-124**: `CHANGES_REQUESTED` or `REPLACEMENT_REQUESTED` MAY move to
  `SUPERSEDED` only when its linked successor is approved, or to `REMOVED` when
  the active exact-Provider `OWNER` abandons the chain.
- **FR-125**: `REJECTED`, `INVALIDATED`, `SUPERSEDED`, and `REMOVED` MUST be
  terminal. Every invalid actor, source-state, target-state, or prerequisite
  combination MUST fail without partial lifecycle, primary, history, audit,
  readiness, review-queue, or notification effects.
- **FR-126**: Submitted payout details MUST be immutable. Every correction,
  resubmission, or replacement MUST create a linked successor `DRAFT` rather
  than overwrite a submitted version, and ordinary hard deletion MUST be
  prohibited.
- **FR-127**: A voluntary successor MUST leave its still-approved unchallenged
  predecessor effective and primary during review. Successor approval MUST
  atomically supersede the predecessor and inherit primary status; successor
  rejection or `CHANGES_REQUESTED` MUST leave the predecessor effective.
- **FR-128**: A Staff `REPLACEMENT_REQUESTED` or `INVALIDATED` decision against
  an approved version MUST remove its readiness credit and primary status
  immediately. No other destination may be auto-promoted; an approved linked
  successor MAY restore that chain's former primary status.
- **FR-129**: A Provider MUST have at most one global primary destination across
  both types. `payoutDestinationReady` MUST require that primary to be current,
  active, and `APPROVED`.
- **FR-130**: The first approved destination MUST become primary atomically when
  no primary exists. Approval of an unrelated later destination MUST NOT replace
  the current primary automatically.
- **FR-131**: Only an active exact-Provider `OWNER` MAY explicitly select a
  different current active `APPROVED` destination as primary, using the exact
  expected monotonic Provider primary-state version and destination version;
  the primary-state version remains durable and advances even when the primary
  selection row is empty.
- **FR-132**: Removing a primary while another approved destination exists MUST
  require selecting the replacement primary in the same atomic command. Without
  a policy-valid replacement, the removal MUST fail without change.
- **FR-133**: Removing the last approved primary MUST require explicit Owner
  acknowledgement and valid recent re-authentication, then MUST atomically clear
  primary truth and make `payoutDestinationReady` unsatisfied. Staff invalidation
  MUST never be blocked by missing alternatives and MUST never auto-promote one.
- **FR-134**: Owner initial submission, successor submission, primary change,
  withdrawal, and removal MUST require an Authentication-owned re-authentication
  proof no more than 10 minutes old. Masked reads and `DRAFT` editing MUST
  require only the active authorized session.
- **FR-135**: Every lifecycle and primary command MUST target exact expected
  versions; a matching retry MUST be idempotent, while stale or competing
  commands MUST conflict and preserve one policy-valid current outcome.
- **FR-136**: Submission MUST create one Staff review-queue effect and one
  durable idempotent localized-template email intent to the exact active Owner.
- **FR-137**: Every Staff verification decision, primary change, removal, and
  successor approval/supersession MUST create one durable idempotent localized-
  template email intent to the exact active Owner.
- **FR-138**: Destination notifications MUST contain only destination type,
  approved masked identifier, safe status, and safe reason; they MUST NOT expose
  a full destination value, lookup hash, ciphertext, key identifier, private
  verification input, or unrelated Provider fact.
- **FR-139**: Notification delivery MUST occur asynchronously with durable retry.
  Delivery failure MUST NOT roll back, duplicate, or rewrite an accepted
  lifecycle, primary, history, audit, review-queue, or readiness outcome.

#### Sensitive payout-data security

- **FR-140**: Before database persistence, the system MUST encrypt every
  recoverable full payout identifier and destination-holder legal name with
  AES-256-GCM. This payout-data contract MUST NOT move private document files or
  their storage lifecycle out of Media ownership.
- **FR-141**: Every encrypted field MUST use a unique cryptographically random
  nonce and authenticated context binding the Provider ID, destination ID,
  exact destination version, destination type, field name, and encryption-key
  version so ciphertext cannot be replayed into another context undetected.
- **FR-142**: For protected fields, persistence MAY contain only the ciphertext
  envelope metadata, non-secret key ID, approved safe display suffix, and
  separately policy-allowed routing, registry, lifecycle, status, and timestamp
  fields in plaintext; it MUST NOT persist the recoverable full identifier or
  holder name in plaintext.
- **FR-143**: Equality and duplicate lookup MUST use a separate versioned HMAC-
  SHA-256 key ring over exactly these domain-separated canonical identities:
  `MOBILE_WALLET | countryCode | normalized E.164` and
  `BANK_ACCOUNT | normalized IBAN`.
- **FR-144**: Lookup fingerprints MUST exist only for equality and duplicate
  enforcement, MUST never be returned, logged, or audited, and MUST never use or
  reuse any payout-data encryption key.
- **FR-145**: Provider payout identifiers MUST be write-only. Create and update
  responses and every later Provider read, including `DRAFT`, MUST expose only
  the approved mask; changing an identifier MUST require full re-entry and MUST
  NOT prefill or reveal the recoverable stored value.
- **FR-146**: The active exact-Provider `OWNER` MAY view the configured bank or
  operator label, holder relationship, and current holder legal name in the
  authorized current-management view, but MUST never receive the complete
  identifier after write. An active exact-Provider `ADMIN` MAY receive only
  destination type, approved mask, status, primary truth, and safe timestamps
  and MUST NOT receive the holder legal name.
- **FR-147**: A Mobile Wallet mask MUST preserve `+` and the country calling code,
  replace every national-number digit except the final four with `•`, and
  display the final four digits.
- **FR-148**: An IBAN mask MUST preserve only the two-letter country prefix and
  final four characters, replace every intervening alphanumeric character with
  `•`, and group the displayed result in blocks of four.
- **FR-149**: A destination-holder legal name MUST be either returned in full
  for an expressly authorized current-management or verification purpose or
  omitted entirely; it MUST never be partially masked.
- **FR-150**: Full identifier and holder-name reveal MUST be limited to an active
  `STAFF_ADMIN` with the explicit payout-verification capability and MUST target
  exactly one `PENDING_VERIFICATION` destination version.
- **FR-151**: Every reveal MUST require an Authentication-owned step-up proof no
  more than five minutes old, a meaningful non-empty reveal reason, and a
  purpose-bound grant scoped to the Staff actor, Provider, exact destination
  version, and request.
- **FR-152**: The reveal workflow MUST NOT support bulk reveal, bulk export,
  Provider-side reveal, reusable grants, or reveal while browsing an approved
  or terminal destination.
- **FR-153**: A reveal response MUST be non-cacheable and its authorization MUST
  expire with the exact verification purpose; it MUST NOT authorize later or
  unrelated reads.
- **FR-154**: Every allowed and denied reveal attempt MUST create safe audit
  evidence containing the actor, target Provider and exact destination version,
  purpose, meaningful reason, timestamp, request ID, outcome, and applicable
  encryption and lookup key versions.
- **FR-155**: Reveal audit, domain history, errors, and logs MUST NOT contain the
  plaintext identifier or holder name, ciphertext, nonce, authentication tag,
  lookup fingerprint, or any key material.
- **FR-156**: Safe accepted-reveal audit evidence MUST persist before any
  plaintext is returned. Audit, key, decryption, authorization, step-up, or
  rate-limit failure MUST fail closed without sensitive disclosure.
- **FR-157**: Accepted reveals MUST be limited to at most five per Staff actor in
  a rolling 10-minute window. Retries, changed request IDs, or concurrent
  requests MUST NOT bypass or oversubscribe that actor-scoped limit.
- **FR-158**: Release 1 MUST use separate versioned payout-data encryption and
  lookup-HMAC key rings supplied externally through the repository-declared
  `PAYOUT_DATA_ENCRYPTION_KEYS_JSON`,
  `PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID`,
  `PAYOUT_LOOKUP_HMAC_KEYS_JSON`, and
  `PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID` configuration names. Decoded keys MUST be
  independently generated and at least 32 bytes, and the two active key IDs
  MUST be distinct.
- **FR-159**: No default payout-data key is permitted. Startup and readiness MUST
  fail closed when required configuration is absent or malformed, any key is
  reused across encryption and lookup purposes, an active key is invalid, or
  the configured rings are inconsistent with retained ciphertext or lookup-key
  versions.
- **FR-160**: Rotation MUST activate a new encryption key and a new lookup key
  for all new writes while retaining prior encryption keys as decrypt-only and
  prior lookup keys as compare-only until safe retirement.
- **FR-161**: During key overlap or migration, duplicate enforcement MUST compare
  the canonical identifier against every enabled lookup-key version so rotation
  cannot permit a same-Provider or cross-Provider duplicate claim.
- **FR-162**: Key rotation MUST use bounded, resumable re-encryption and re-
  fingerprinting of retained payout destinations with progress and retry
  behavior that does not expose plaintext or weaken lifecycle, duplicate, or
  readiness truth.
- **FR-163**: A prior key MUST NOT be retired until verification proves zero
  retained references to that version and a human explicitly approves the
  operational retirement.
- **FR-164**: Missing historical keys or failed protected-field recovery MUST
  fail closed and MUST never cause ciphertext, lookup fingerprints, or stored
  masks to be returned or treated as plaintext.
- **FR-165**: Release 1 MUST supply the declared key-ring configuration from
  external environment or secret injection. Cloud secret-manager integration
  is deferred to Release 3 and MUST NOT be introduced by R1-P06.
- **FR-166**: Private verification-document bytes, Media storage keys, Media
  processing, and private delivery MUST remain governed by the Media-owned
  contract and MUST NOT be copied into the payout-data cryptographic store.

### Key Entities

- **Verification Document Type**: A stable, configurable definition of a
  Provider document requirement, including its code and display meaning.
- **Verification Document Policy Version**: An immutable published or editable
  draft grouping of document-type applicability for one country code and
  Provider kind, with required/optional and active/retired semantics, effective
  time, version identity, publication actor, reason, and timestamp.
- **Provider Document**: A Provider-owned association between one exact
  Provider, one configured document type, private Media-owned evidence,
  snapshotted policy-version field rules, required `countryCode`,
  `documentNumber`, `legalName`, `issuerName`, and `issueDate`, optional
  `expiresAt`, ordered complete-document evidence, one approved lifecycle state,
  optimistic version, predecessor/successor relation, and current-effectiveness
  meaning. It does not own the stored file.
- **Provider Document Review**: An immutable privileged decision by one active
  `STAFF_ADMIN` against one exact document version, with outcome, actor,
  timestamp, and a meaningful non-empty reason.
- **Provider Verification History**: Chronological Provider-owned evidence of
  verification changes, including document, policy, expiry, replacement, and
  badge-truth effects without raw private payloads.
- **Provider Verification State**: The current authoritative result derived from
  the Provider kind, applicable configured requirements, and current effective
  evidence.
- **Verification Badge Truth**: A protected derived state of `NOT_ELIGIBLE`,
  `NOT_EARNED`, or `EARNED`. Individual Teams are not eligible; approved
  Registered Companies earn it exactly from current effective document truth.
  Operational status does not rewrite it, and anonymous presentation is not an
  R1-P06 entity or responsibility.
- **Payout Destination Type**: A stable configurable definition of an external
  destination type. The R1-P06 baseline contains only `MOBILE_WALLET` and
  `BANK_ACCOUNT`.
- **Provider Payout Destination**: A Provider-owned external settlement target
  containing protected type-specific values, policy-defined verification method
  and status, primary truth where applicable, lifecycle state, version, and safe
  display representation. Only its active exact-Provider `OWNER` mutates
  sensitive details or primary truth, active exact-Provider `ADMIN` members
  receive masked status only, and active `STAFF_ADMIN` users decide
  verification. It never contains a balance.
- **Payout Destination Chain**: One logical Mobile Wallet or Bank Account
  destination and its immutable linked versions, with at most one open
  successor and one policy-valid current version. At most five chains are active
  for one Provider; terminal versions remain historical without consuming the
  active-chain limit.
- **Mobile Wallet Destination**: A payout-destination version containing the
  authoritative active `countryCode`, normalized E.164 wallet number,
  configured `operatorCode`, holder legal name, and holder relationship
  `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`. It has no uploaded ownership-
  evidence file and exposes only a masked number outside the narrow Staff
  verification workflow.
- **Bank Account Destination**: An IBAN-first payout-destination version
  containing the authoritative active `countryCode`, configured payout
  `currencyCode`, active country-scoped `bankCode`, normalized IBAN, holder legal
  name, and holder relationship `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`. It
  has no uploaded ownership-evidence file and exposes only a masked IBAN outside
  the narrow Staff verification workflow.
- **Payout Destination Verification Decision**: An immutable active-
  `STAFF_ADMIN` decision against one exact destination version, containing the
  outcome, meaningful non-empty reason or verification note, Staff actor,
  timestamp, verification method, and safe before/after meaning without the full
  destination identifier or any actual transfer or settlement record.
- **Primary Destination Selection**: The version-protected Provider-owned
  reference to at most one current active approved destination, with explicit
  Owner changes, first-approval initialization, linked-successor inheritance,
  and no automatic failover after Staff challenge.
- **Payout Destination Notification Intent**: A durable idempotent localized-
  template email intent for the exact active Owner containing only destination
  type, masked identifier, safe status, and safe reason, delivered
  asynchronously without controlling the business transition.
- **Encrypted Payout Field**: One AES-256-GCM ciphertext envelope for a payout
  identifier or holder legal name, with its unique nonce, authentication tag,
  non-secret encryption-key ID, and authenticated destination/version/field
  context. Plaintext is never domain history or generic audit content.
- **Payout Lookup Fingerprint**: One non-reversible, versioned HMAC-SHA-256 value
  over a destination-type-specific canonical identity, used only for equality
  and duplicate enforcement and never returned, logged, or audited.
- **Payout Reveal Grant**: A short-lived, non-reusable authorization for one
  active Staff Admin with payout-verification capability, one Provider, one
  exact pending destination version, one request, and one verification purpose,
  backed by a step-up proof no more than five minutes old and a meaningful
  reason.
- **Payout Reveal Attempt**: Safe privileged audit evidence for an allowed or
  denied reveal request, including actor, target Provider and exact version,
  purpose, reason, timestamp, request ID, outcome, and applicable key versions,
  but no protected field, ciphertext detail, lookup fingerprint, or key.
- **Payout Key Ring**: Two distinct externally supplied versioned key sets—one
  for authenticated encryption and one for lookup HMAC—with explicit active
  key IDs, retained decrypt/compare-only versions during rotation, and human-
  approved retirement after zero-reference verification.
- **Readiness Projection**: The existing Provider marketplace-readiness view
  extended by R1-P06 truth for `documentsVerified` and
  `payoutDestinationReady` while preserving all later-phase gates.
- **Privileged Audit Evidence**: Safe actor/action/reason/time and before/after
  meaning for high-risk decisions, stored without raw documents or full payout
  identifiers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested `INDIVIDUAL_TEAM` cases, no Provider document is
  required, `documentsVerified` is `NOT_REQUIRED` and satisfied, and profile
  completion is unchanged.
- **SC-002**: In 100% of initial `REGISTERED_COMPANY` checklist cases, exactly
  the two active required type codes in the launch `EG` policy are present and
  no unapproved document type is required.
- **SC-003**: In 100% of accepted document decisions, the current outcome and
  immutable history agree on the exact evidence version, actor, outcome, time,
  and meaningful non-empty reason, and the actor is an active `STAFF_ADMIN`.
- **SC-004**: In replacement, renewal, rejection, and expiry scenarios, 100% of
  prior evidence and decisions remain historically retrievable to authorized
  actors while at most one policy-valid effective approved version is exposed.
- **SC-005**: Across all public representations, errors, logs, and safe audit
  payloads, zero private documents, storage keys, raw tokens, encryption
  material, full payout identifiers, or private contacts are exposed.
- **SC-006**: In 100% of cross-provider private-access tests, access fails closed
  without revealing whether the target Provider or private record exists.
- **SC-007**: R1-P06 accepts exactly two payout-destination types in all
  contract and behavior inventories: Mobile Wallet and Bank Account.
- **SC-008**: Across all R1-P06 flows, zero operations create stored value,
  expose an internal balance, initiate a payout, or choose a settlement
  schedule.
- **SC-009**: Every accepted document or destination lifecycle change produces
  the same R1-P06 gate result in every Provider readiness, dashboard, and
  settings representation that includes that gate.
- **SC-010**: In 100% of cases where both R1-P06 gates are satisfied, later
  readiness gates remain owned by their later phases and the Provider remains
  non-public unless those later phases independently satisfy their rules.
- **SC-011**: Under retry and concurrency tests for decisions, replacements,
  destination mutations, and primary changes, at most one valid current
  business outcome and one matching history effect are recorded.
- **SC-012**: Every invalid, unsupported, stale, or unauthorized R1-P06 action
  leaves no partial Provider, Media, review, destination, history, audit, or
  readiness outcome.
- **SC-013**: Authorized Provider managers and reviewers can identify every
  current document or payout-readiness blocker from safe codes and descriptions
  without viewing unrelated sensitive data.
- **SC-014**: In 100% of policy-publication tests, only an active `STAFF_ADMIN`
  can publish a reasoned immutable version; once effective, every approved
  Provider in scope is re-evaluated against it, eligible evidence for unchanged
  stable types is retained, new or retired requirements change current
  readiness as specified, and historical policy and decision meaning remains
  interpretable.
- **SC-015**: All clarification topics listed below have an owner-approved answer
  persisted in this specification before implementation authorization, with no
  unresolved product behavior silently defaulted.
- **SC-016**: In 100% of payout-authorization tests, only the active exact-
  Provider `OWNER` can mutate destination details or primary truth, an active
  exact-Provider `ADMIN` receives masked status without mutation capability, and
  only an active `STAFF_ADMIN` can decide verification with a meaningful non-
  empty reason; every denied attempt leaves all business truth unchanged.
- **SC-017**: In 100% of application-timing tests, Provider-specific R1-P06
  actions create no record before `APPROVED`, document and payout work can begin
  independently after approval, and a later operational `SUSPENDED` state
  preserves authorized remediation without granting operational or public
  eligibility.
- **SC-018**: In 100% of launch-document submission tests, both stable types
  enforce the five required common metadata fields, authoritative country and
  date ordering, optional-expiry semantics, complete ordered private evidence,
  and the snapshotted policy version; every invalid combination creates no
  partial business truth.
- **SC-019**: In 100% of upload-policy tests, valid PDF and ordered JPEG/PNG
  evidence—including `image/jpeg` supplied as `.jpg` or `.jpeg`—is accepted only
  within the exact file, page, and aggregate limits and only after every item is
  `READY`; MIME/signature mismatches, unsafe content, mixed formats, processing
  failures, missing/reordered pages, and all over-limit cases create no partial
  Provider truth.
- **SC-020**: In 100% of lifecycle-matrix tests, submitted versions remain
  immutable; remediation creates linked successors; voluntary successors
  preserve a still-valid unchallenged predecessor; successor approval
  supersedes it atomically; Staff challenge, invalidation, or expiry removes its
  credit immediately; matching retries are idempotent; and stale or competing
  commands produce no conflicting current truth.
- **SC-021**: In 100% of badge-matrix tests, an Individual Team is
  `NOT_ELIGIBLE`; an approved Registered Company is `EARNED` exactly when all
  current required document types have effective approved evidence; voluntary
  successor review preserves the badge only while its predecessor remains
  effective; challenge, invalidation, expiry, or a new unmet requirement removes
  it immediately; and suspension never grants or erases document-verification
  truth or operational/public eligibility.
- **SC-022**: In 100% of Mobile Wallet draft tests, only the active exact-
  Provider `OWNER` can supply the authoritative country, E.164-normalized wallet
  number, active configured operator, holder legal name, and approved holder
  relationship; zero flows require or accept an uploaded ownership-evidence
  file or require an Authentication-phone match or `phoneVerified`.
- **SC-023**: In 100% of Mobile Wallet verification tests, submission produces
  `PENDING_VERIFICATION`; only an active `STAFF_ADMIN` can decide the exact
  version after the approved manual external name check; and every accepted
  decision records the method, meaningful note or reason, actor, timestamp,
  immutable history, and safe audit evidence.
- **SC-024**: In 100% of Mobile Wallet duplicate, retry, and concurrency tests,
  country plus normalized E.164 identity detects same-Provider and cross-
  Provider conflicts regardless of operator, matching retries are idempotent,
  stale commands conflict, and at most one policy-valid current claim and
  decision outcome exist.
- **SC-025**: Across all Mobile Wallet tests, only a current active `APPROVED`
  destination can satisfy `payoutDestinationReady`; the full number appears
  only in the narrow Staff verification workflow; and zero flows send
  verification money, complete a transfer, integrate a wallet-transfer API,
  execute a payout, or record a settlement.
- **SC-026**: In 100% of Bank Account draft tests, only the active exact-Provider
  `OWNER` can supply the authoritative country, configured currency, active
  configured bank, normalized IBAN, holder legal name, and approved holder
  relationship; the launch `EG` policy uses `EGP`, bank name is registry-
  resolved, and zero flows request redundant account, branch, or caller-entered
  SWIFT/BIC fields under the IBAN-first contract.
- **SC-027**: In 100% of Bank Account verification tests, submission produces
  `PENDING_VERIFICATION`; only an active `STAFF_ADMIN` can decide the exact
  version after the approved manual beneficiary-name check; every accepted
  decision records the method, meaningful note or reason, actor, timestamp,
  immutable history, and safe audit evidence; and zero flows require or accept
  an uploaded bank-ownership document.
- **SC-028**: In 100% of Bank Account duplicate, retry, and concurrency tests,
  formatting-equivalent IBANs normalize to one duplicate identity, same-
  Provider and cross-Provider conflicts are detected, matching retries are
  idempotent, stale commands conflict, and at most one policy-valid current
  claim and decision outcome exist.
- **SC-029**: Across all Bank Account tests, only a current active `APPROVED`
  destination can satisfy `payoutDestinationReady`; the full IBAN appears only
  in the narrow Staff verification workflow; and zero flows automate the
  beneficiary lookup, move verification money, complete a transfer, integrate
  a bank-transfer API, execute a payout, or record a settlement.
- **SC-030**: In 100% of cardinality and state-matrix tests, at most five active
  destination chains and one open successor per chain exist; terminal history
  does not consume a slot; and only the exact approved transitions and actors
  succeed.
- **SC-031**: In 100% of replacement tests, a voluntary successor preserves its
  approved unchallenged predecessor and primary status until approval; approval
  supersedes and transfers primary atomically; rejection or changes requested
  preserves the predecessor; and Staff challenge removes credit and primary
  immediately without automatic failover.
- **SC-032**: In 100% of primary tests, at most one global primary exists, the
  first approval initializes it, later unrelated approval cannot replace it,
  alternative-primary removal is atomic, and acknowledged last-primary removal
  leaves readiness unsatisfied.
- **SC-033**: In 100% of Owner submission, successor submission, primary-change,
  withdrawal, and removal tests, a re-authentication proof no older than 10
  minutes is required; absent or stale proof creates no business or notification
  effect, while masked reads and draft edits remain available to the active
  authorized Owner.
- **SC-034**: Every accepted submission, Staff decision, primary change,
  removal, and successor approval/supersession creates exactly the approved safe
  idempotent review-queue or Owner-email effects; zero notification payloads
  expose full sensitive values, and delivery failure never reverses or
  duplicates business truth.
- **SC-035**: In 100% of protected-field persistence inspections, every
  recoverable payout identifier and holder legal name is represented only by an
  AES-256-GCM envelope with a unique nonce and bound destination/version/field
  context; zero plaintext values exist in payout persistence, logs, errors,
  generic history, or audit payloads.
- **SC-036**: In 100% of equality and deduplication tests, the exact domain-
  separated canonical Mobile Wallet or Bank Account identity is processed by a
  separate HMAC-SHA-256 lookup key, every enabled key version is checked during
  rotation, and zero lookup fingerprints are returned, logged, or audited.
- **SC-037**: In 100% of Provider read tests, identifiers are write-only and use
  the exact wallet or IBAN mask even in `DRAFT`; Owners receive only their
  expressly allowed current-management fields, Admins receive the narrower
  projection without holder name, and neither role receives a full identifier.
- **SC-038**: In 100% of Staff reveal tests, plaintext is returned only for one
  exact `PENDING_VERIFICATION` version to an active capable Staff Admin with a
  step-up no older than five minutes, a meaningful reason, and a request-scoped
  purpose grant; bulk, reusable, Provider, approved, and terminal reveals are
  denied.
- **SC-039**: Every allowed or denied reveal attempt records the exact approved
  safe audit fields and zero forbidden cryptographic or plaintext values; every
  accepted reveal audit persists before response, accepted reveals never exceed
  five per Staff actor per rolling 10 minutes, and every audit, auth, key,
  decryption, step-up, or limit failure returns no plaintext.
- **SC-040**: In 100% of startup and readiness configuration tests, the four
  repository-declared key-ring settings contain distinct, independently
  generated keys of at least 32 decoded bytes with valid active IDs and retained
  version coverage; missing, malformed, reused, or defaulted keys fail closed.
- **SC-041**: In 100% of key-rotation tests, new writes use the new active
  encryption and lookup keys, old keys remain decrypt/compare-only during a
  bounded resumable migration, duplicate protection remains complete, and no
  key retires before zero-reference verification and explicit human approval.
- **SC-042**: Across all recovery failures and ordinary interfaces, zero
  ciphertext, nonce, tag, lookup fingerprint, stored mask, or key material is
  substituted for plaintext, while private verification documents remain
  governed only by the Media-owned storage and delivery contract.

## Assumptions

- R1-P05 remains Complete and supplies the authoritative Provider record,
  `INDIVIDUAL_TEAM`/`REGISTERED_COMPANY` kind, application state, operational
  state, `OWNER`/`ADMIN` membership, profile completion, and structured
  marketplace-readiness model.
- R1-P06 does not reopen or replace the R1-P05 application-review workflow.
- Media continues to provide private upload/storage lifecycle through a public
  contract and remains the owner of stored files and storage keys.
- Authentication continues to provide authoritative account activity, session
  capability, and staff authorization facts through a public contract.
- Configuration continues to provide authoritative active-country facts and
  owns country configuration data.
- The initial baseline type codes in DEC-037 are approved. Company-document
  administration and review authority and payout-destination authority are
  resolved in the 2026-08-13 clarification session. Provider-specific R1-P06
  capabilities begin only after application approval and remain available for
  authorized remediation during operational suspension. Document policy uses
  Staff-published immutable effective-dated country-and-kind versions and
  re-evaluates all approved Providers in scope. The launch document metadata
  baseline, complete-evidence rule, and bounded PDF/JPEG/PNG upload policy are
  resolved. The immutable linked-version document lifecycle and risk-aware
  replacement continuity and derived Registered Company badge truth are also
  resolved. The Mobile Wallet schema, manual Staff verification without uploaded
  ownership evidence, duplicate identity, masking boundary, and readiness
  prerequisite are resolved. The IBAN-first Bank Account schema, manual Staff
  beneficiary-name verification without uploaded ownership evidence, duplicate
  identity, masking boundary, and readiness prerequisite are also resolved. The
  bounded immutable destination lifecycle, five-chain cardinality, single
  explicit primary, risk-aware replacement continuity, 10-minute Owner re-
  authentication, and safe durable notification policy are resolved. The
  authenticated-encryption, separate HMAC lookup, exact masking, purpose-bound
  Staff reveal, pre-return audit, rate-limit, key-ring configuration, and safe
  rotation contract is resolved. No material R1-P06 clarification decision
  remains open.
- R1-P06 creates verification and destination truth for future phases but does
  not make a Provider operationally live, publicly browseable, or payable.

## Dependencies

- **R1-P05 Provider contracts**: Provider identity, kind, application and
  operational states, exact membership scope, profile completion, readiness,
  dashboard/settings projection, and protected privacy behavior.
- **Media public contract**: Private evidence upload, status, storage lifecycle,
  and protected delivery without exposing Media-owned persistence.
- **Authentication public contract**: Active identity, session capability,
  payout-verification capability, Owner re-authentication, and Staff step-up
  facts.
- **Configuration public contract**: Active-country and applicable
  configuration facts.
- **Customers public contract**: Company profile facts if required for private
  review; no direct Customer persistence access.
- **Admin audit public contract**: Business-neutral privileged and denial-audit
  evidence that excludes private values and can persist accepted reveal audit
  before plaintext disclosure.
- **External secret configuration**: Release 1 environment/secret injection for
  the four repository-declared payout encryption and lookup key-ring settings,
  with no defaults; cloud secret-manager integration remains Release 3 scope.
- **DEC-003, DEC-014, DEC-036, and DEC-037**: External-destination boundary,
  incremental migration governance, inherited Provider readiness, and the
  approved R1-P06 baseline.

## Clarification Resolution

No material product decisions remain for R1-P06. Clarification Sessions 1–3
record all 12 owner-approved decisions. The separately authorized documentation
workflow has since produced and validated `plan.md`, focused checklists,
`tasks.md`, design artifacts, and the implementation handoff; no implementation
has started.

## Out of Scope

- Provider application creation, submission, approval, changes requests,
  rejection, suspension, or reinstatement.
- Provider profile, private-contact, logo, cover, gallery, membership, and
  invitation lifecycle completed by R1-P05.
- Worker, team, crew, or supervisor management owned by R1-P07.
- Service and pricing management owned by R1-P09.
- Coverage, availability, and capacity owned by R1-P10.
- Final marketplace eligibility owned by R1-P11.
- Anonymous public Browse, Provider Details, or public badge rendering owned by
  R1-P12.
- Booking payments, customer payments, payout execution, settlement scheduling,
  payout retries, reconciliation, provider dues, or financial ledger behavior.
- Internal Cleanora wallets, stored-value balances, ledger balances, wallet
  top-ups, or reusable account balances.
- Card payout destinations or InstaPay integration.
- Payout and settlement schedule resolution from OQ-011.
- Mobile Wallet ownership/control-evidence uploads, screenshots, statements,
  contracts, or other proof-of-ownership files.
- Automated Mobile Wallet verification, wallet-transfer or beneficiary-lookup
  API integration, verification-money movement, completed transfer attempts, or
  actual settlement records.
- Bank Account ownership/control-evidence uploads, bank statements, account
  certificates, cheque images, contracts, screenshots, or other proof-of-
  ownership files.
- Automated bank-beneficiary verification, bank-transfer API integration,
  verification-money movement, completed bank transfers, or actual settlement
  records.
- Automatic failover or promotion to an unrelated payout destination after
  Staff replacement request, invalidation, or removal of the primary.
- Provider or Provider-Admin post-write reveal of a complete payout identifier,
  bulk Staff reveal/export, reusable reveal grants, and full-value browsing of
  approved or terminal payout destinations.
- Cloud secret-manager integration before Release 3; Release 1 is limited to
  the declared externally supplied environment/secret-injection contract.
- Deployment, production configuration, production migration, credentials, or
  live external-provider actions.
- Docker or cloud work before Release 3.

## Canonical Traceability

- `AGENTS.md`: standalone greenfield boundary, modular-monolith ownership,
  one-active-phase rule, incremental migrations, and guarded Git authority.
- `docs/product/vision.md`: separate Provider verification, external
  payout-destination meaning, private Provider data, no internal stored-value
  wallets, and privileged-write audit requirements.
- `docs/product/decision-log.md`: DEC-003, DEC-014, DEC-036 completion baseline,
  and DEC-037 R1-P06 owner-approved decisions.
- `docs/product/open-questions.md`: OQ-007 resolved; OQ-009 remains out of scope;
  OQ-011 remains open only for payout/settlement scheduling.
- `docs/product/roadmap.md`: R1-P06 goal, scope, persistence concepts, and
  Definition of Done.
- `docs/product/current.md`: R1-P06 is the sole active phase; clarification,
  planning, focused checklists, tasks, analysis/remediation, and the
  implementation handoff are complete, while implementation remains
  unauthorized and unstarted.
- `.specify/memory/constitution.md`: canonical truth, public module contracts,
  backend authority, privacy, audit, concurrency, phase-owned migration, and
  human-controlled decision gates.

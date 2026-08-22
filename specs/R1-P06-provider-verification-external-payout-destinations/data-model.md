# Data Model — R1-P06 Provider Verification & External Payout Destinations

**Status**: Implemented and validated in `prisma/schema.prisma` and the additive R1-P06 migration; schema generation, static SQL review, disposable clean install, populated R1-P05 upgrade, double-seed idempotency, and live constraint probes pass.
**Owner**: Providers, except Media-owned `MediaFile`, Authentication-owned identities/proofs, Configuration-owned `Country`/`Currency`, Customers-owned legal profiles, and Admin-owned generic audit.

## Modeling Rules

- Submitted business versions, decisions, and history are append-only.
- Mutable aggregates carry positive integer `version` columns and all commands use `expectedVersion`.
- Human reasons are trimmed, non-empty, length-bounded, and stored only where required.
- `User`, `Country`, `Currency`, and `MediaFile` foreign keys use `ON DELETE RESTRICT` unless an existing ownership contract explicitly says otherwise.
- Times use UTC `DateTime`; authoritative expiry/effective-state queries receive one injected clock value.
- Full payout identifiers and holder names never occupy plaintext columns.
- HMAC fingerprints, ciphertext components, Media storage keys, proofs, and tokens never enter JSON history/audit/outbox payloads.
- Constraints Prisma cannot express are created and reviewed in the phase migration SQL.

## Planned Enums

### Document

```text
VerificationDocumentPolicyStatus = DRAFT | PUBLISHED
ProviderDocumentStatus = DRAFT | SUBMITTED | APPROVED | REJECTED |
                         REPLACEMENT_REQUESTED | EXPIRED | INVALIDATED | SUPERSEDED
ProviderDocumentEvidenceFormat = PDF | IMAGE_SET
ProviderDocumentDecisionOutcome = APPROVE | REJECT | REQUEST_REPLACEMENT | INVALIDATE
ProviderVerificationHistoryEvent = DOCUMENT_DRAFT_CREATED | DOCUMENT_SUBMITTED |
  DOCUMENT_APPROVED | DOCUMENT_REJECTED | DOCUMENT_REPLACEMENT_REQUESTED |
  DOCUMENT_EXPIRED | DOCUMENT_INVALIDATED | DOCUMENT_SUPERSEDED |
  POLICY_PUBLISHED | POLICY_BECAME_EFFECTIVE | VERIFICATION_TRUTH_CHANGED |
  BADGE_TRUTH_CHANGED
VerificationBadgeState = NOT_ELIGIBLE | NOT_EARNED | EARNED
```

### Payout

```text
PayoutDestinationKind = MOBILE_WALLET | BANK_ACCOUNT
PayoutHolderRelationship = PROVIDER_LEGAL_ENTITY | PROVIDER_OWNER
PayoutDestinationStatus = DRAFT | PENDING_VERIFICATION | CHANGES_REQUESTED |
  APPROVED | REJECTED | REPLACEMENT_REQUESTED | INVALIDATED | SUPERSEDED | REMOVED
PayoutVerificationMethod = MANUAL_WALLET_TRANSFER_CHECK |
  MANUAL_BANK_BENEFICIARY_CHECK
PayoutDecisionOutcome = APPROVE | REJECT | REQUEST_CHANGES |
  REQUEST_REPLACEMENT | INVALIDATE
PayoutIdentityClaimStatus = ACTIVE | RELEASED
PayoutConflictStatus = OPEN | CANDIDATE_REJECTED | RESOLVED_AFTER_RELEASE
PayoutHistoryEvent = DESTINATION_DRAFT_CREATED | DESTINATION_DRAFT_UPDATED |
  DESTINATION_SUBMITTED | DESTINATION_APPROVED | DESTINATION_REJECTED |
  DESTINATION_CHANGES_REQUESTED | DESTINATION_REPLACEMENT_REQUESTED |
  DESTINATION_INVALIDATED | DESTINATION_SUPERSEDED | DESTINATION_REMOVED |
  PRIMARY_INITIALIZED | PRIMARY_CHANGED | PRIMARY_CLEARED |
  IDENTITY_CONFLICT_OPENED | IDENTITY_CONFLICT_RESOLVED
PayoutKeyPurpose = ENCRYPTION | LOOKUP_HMAC
PayoutKeyRotationStatus = PLANNED | RUNNING | PAUSED | VERIFYING |
  READY_FOR_RETIREMENT | COMPLETED | FAILED | CANCELLED
```

Existing enums are extended additively:

- `MediaOwnerType`: add `PROVIDER_VERIFICATION_DOCUMENT_PAGE` (used for both one PDF and ordered images; canonical content type distinguishes them).
- `ProviderEmailTemplate`: add safe submission, Staff-decision, primary-change, removal, and successor-approval/supersession templates.

## Existing Model Changes

### `Provider`

No persisted verification booleans are added. Readiness and badge values remain derived. Relations are added for document chains, payout chains, verification/payout history, conflicts, and one optional primary-selection row.

The Provider row is the first serialization lock for document-policy application and payout cardinality/primary commands. No existing R1-P05 column meaning changes.

### `MediaFile`

Add only the opposite relation needed by `ProviderDocumentEvidence`. File bytes, `storageKey`, processing state, cleanup, and delivery remain Media-owned. R1-P06 never queries this model directly.

### `ProviderEmailOutbox`

Add nullable `verificationHistoryId` and `payoutHistoryId` references with a SQL shape check requiring at most one event source (`statusHistoryId`, `verificationHistoryId`, or `payoutHistoryId`). Existing R1-P05 rows remain valid. Add indexes for each nullable reference; retain unique `idempotencyKey` and current leasing index.

## Document Policy Tables

### 1. `VerificationDocumentType`

| Field | Meaning |
|---|---|
| `id` | Stable CUID primary key. |
| `code` | Unique immutable code; launch values `COMMERCIAL_REGISTRATION`, `TAX_REGISTRATION`. |
| `displayNameAr`, `displayNameEn` | Staff/Provider labels. |
| `descriptionAr`, `descriptionEn` | Safe explanatory text. |
| `isActive` | Availability for future draft policies; does not rewrite published policy/history. |
| `version` | Optimistic version for Staff edits. |
| `createdAt`, `updatedAt` | Audit support. |

Constraints/indexes: unique code; nonblank code/names; positive version; index `(isActive, code)`.

### 2. `VerificationDocumentPolicyVersion`

| Field | Meaning |
|---|---|
| `id` | Policy-version identity. |
| `countryId` | Configuration-owned active country at creation/publication. |
| `providerKind` | Scope; R1 launch publishes `REGISTERED_COMPANY`. |
| `policyVersion` | Positive scope-local integer. |
| `status` | `DRAFT` or immutable `PUBLISHED`. |
| `effectiveAt` | Required before publication; current policy uses latest eligible value. |
| `publishedByUserId`, `publishedAt`, `publishReason` | Required together for PUBLISHED. |
| `version` | Optimistic edit version; frozen after publish. |
| `createdByUserId`, `createdAt`, `updatedAt` | Provenance. |

Constraints/indexes:

- unique `(countryId, providerKind, policyVersion)`;
- unique partial `(countryId, providerKind, effectiveAt)` for PUBLISHED;
- queue/resolution index `(countryId, providerKind, status, effectiveAt DESC, id)`;
- shape checks for DRAFT vs PUBLISHED and nonblank publication reason;
- database trigger/permissions or repository enforcement prevents update/delete of PUBLISHED rows; tests prove immutability.

### 3. `VerificationDocumentPolicyItem`

| Field | Meaning |
|---|---|
| `id` | Item identity. |
| `policyVersionId` | Parent policy. |
| `documentTypeId` | Stable document type. |
| `isRequired`, `isActive` | Applicability in this immutable version. |
| `fieldRules` | Versioned allowlisted rule object for required metadata, date rules, and evidence policy. |
| `position` | Stable display order. |
| timestamps | Draft editing/provenance. |

Constraints/indexes: unique `(policyVersionId, documentTypeId)` and `(policyVersionId, position)`; position nonnegative; published-parent items become immutable. `fieldRules` is validated with a versioned server schema before persistence and publication.

### 3A. `ProviderPolicyActivationState`

Provider-owned singleton progress for the bounded document-policy activation sweep: stable state ID, last processed Provider cursor, positive optimistic version, and timestamps. The cursor advances only after a batch's idempotent policy-effective and actual verification/badge truth history writes complete. A crash may safely replay the last batch; operation-key uniqueness prevents duplicate history. Exact state-version updates prevent competing sweep workers from silently overwriting progress.

## Provider Document Tables

### 4. `ProviderDocumentChain`

| Field | Meaning |
|---|---|
| `id` | Logical document chain. |
| `providerId`, `documentTypeId` | Exact Provider requirement. |
| `effectiveVersionId` | Optional currently effective approved version. |
| `version` | Chain concurrency version. |
| timestamps | Lifecycle metadata. |

Constraints/indexes: unique `(providerId, documentTypeId)`; positive version; `effectiveVersionId` unique and validated to belong to the same chain. A Provider/type correction reuses the chain rather than creating a duplicate.

### 5. `ProviderDocumentVersion`

| Field | Meaning |
|---|---|
| `id`, `chainId`, `providerId` | Version identity and denormalized Provider for scoped indexes. |
| `sequence` | Positive chain-local immutable version number. |
| `predecessorVersionId` | Optional unique predecessor; enforces at most one linked successor. |
| `status`, `version` | Lifecycle plus optimistic DRAFT/command version. |
| `countryCode` | Snapshotted authoritative code. |
| `documentNumber`, `legalName`, `issuerName` | Private metadata; never public/log/audit/history/outbox. |
| `issueDate`, `expiresAt` | Validated dates. |
| `evidenceFormat` | One PDF or one image set. |
| `policyVersionId`, `policyItemId` | Rule authority at submission. |
| `policyRuleSnapshot` | Allowlisted immutable validation rules used for this submission. |
| `createdByUserId`, `submittedByUserId`, `submittedAt` | Provenance. |
| terminal/effect timestamps | `approvedAt`, `rejectedAt`, `replacementRequestedAt`, `expiredAt`, `invalidatedAt`, `supersededAt`. |
| `idempotencyKey`, timestamps | Retry/provenance. |

Constraints/indexes:

- unique `(chainId, sequence)`, `predecessorVersionId`, and command idempotency key;
- partial unique one open nonterminal draft/submission successor per chain where required;
- SQL date ordering requires expiry greater than issue; injected-clock service
  validation rejects a future issue date at submission because a stable database
  CHECK cannot compare historical command time safely;
- status/timestamp shape checks; positive versions/sequence;
- immutable metadata/evidence references after `SUBMITTED`;
- indexes for Provider lists and Staff queue: `(providerId, status, createdAt DESC, id)`, `(status, submittedAt, id)`, `(expiresAt, status)`.

### 6. `ProviderDocumentEvidence`

| Field | Meaning |
|---|---|
| `id`, `documentVersionId` | Ordered association. |
| `mediaFileId` | Unique opaque Media reference. |
| `position` | `0` for the single PDF or `0..9` for images. |
| `canonicalContentType` | `application/pdf`, `image/jpeg`, or `image/png`. |
| `byteSize`, `pageCount` | Safe validated facts returned by Media; PDF page count only. |
| `createdAt` | Association time. |

Constraints/indexes: unique media ID and `(documentVersionId, position)`; safe content-type enum/check; positive byte size/page count; aggregate limits are transactionally validated by service because SQL row checks cannot express them. No `storageKey` or signed URL is stored.

### 7. `ProviderDocumentReview`

| Field | Meaning |
|---|---|
| `id`, `providerId`, `documentVersionId` | Exact target. |
| `outcome`, `reason` | Immutable decision. |
| `actorUserId`, `decidedAt`, `requestId` | Staff evidence. |
| `expectedDocumentVersion`, `operationKey` | Exact-version/idempotency evidence. |

Constraints/indexes: unique `operationKey`; one final decision of each valid decision stage per exact document version; nonblank reason; Staff queue/history indexes. No document metadata or file value is copied.

### 8. `ProviderVerificationHistory`

Append-only safe event fields: `id`, `providerId`, optional document/policy IDs, event, from/to safe status, actor ID/type, meaningful safe reason code/text where authorized, request ID, exact version, `createdAt`, and unique `operationKey`. It never stores document number, legal/issuer names, file keys/URLs, or raw metadata.

Indexes: `(providerId, createdAt DESC, id)` and `(event, createdAt, id)`.

## Payout Registry Tables

### 9. `PayoutDestinationType`

Stable code, localized label/description, active flag, optimistic version, timestamps. Launch has exactly `MOBILE_WALLET` and `BANK_ACCOUNT`. Cards and InstaPay have no active records and are rejected even if caller-supplied.

### 10. `PayoutOperator`

Stable `code`, country FK, localized label, active flag, version, timestamps. Unique `(countryId, code)`; indexed `(countryId, isActive, code)`. Phone prefix rules are deliberately absent.

### 11. `PayoutBank`

Stable `code`, country FK, localized name, optional registry-owned routing display metadata, active flag, version, timestamps. Unique `(countryId, code)`; indexed `(countryId, isActive, code)`. Caller does not supply bank name, branch, domestic account, or SWIFT/BIC.

### 12. `PayoutCountryPolicy`

One versioned Providers-owned row per country for allowed destination types/currencies and IBAN/calling-code validation facts. Launch `EG` permits Bank Account currency `EGP`. Generic country/currency truth remains Configuration-owned. Unique active policy per country, exact version on Staff changes.

## Provider Payout Tables

### 13. `ProviderPayoutDestinationChain`

| Field | Meaning |
|---|---|
| `id`, `providerId`, `destinationTypeId` | Logical chain. |
| `currentVersionId` | Current policy-valid version for management display. |
| `effectiveApprovedVersionId` | Optional approved version that currently contributes truth. |
| `formerPrimaryEligible` | Safe flag used only for challenged-chain successor restoration. |
| `primaryRestorationStateVersion` | Primary-state version captured when Staff cleared this chain; restoration is allowed only if it still matches, so a later explicit Owner selection cannot be overwritten. |
| `version` | Chain concurrency version. |
| timestamps | Lifecycle. |

Constraints/indexes: current/effective pointers must belong to the same chain; positive version; active-chain count (max five) is enforced while locking Provider. Terminal-only chains do not count.

### 14. `ProviderPayoutIdentityClaim`

Represents one canonical identifier claim without plaintext: `id`, `providerId`, `chainId`, destination kind, country code where needed, exact safe mask fields, `status`, `claimedAt`, `releasedAt`, version, timestamps. A successor with the same canonical identifier reuses this claim; a replacement value creates another claim. Claim state changes occur with destination lifecycle in one transaction. A released historical claim remains discoverable for same-Provider equality, so the Provider cannot open a second logical chain for the same identity; any later reuse must continue the original chain through an eligible successor. Only global cross-Provider uniqueness is limited to simultaneously ACTIVE claims; a conflict case is not a claim state and never creates a second active claim.

The mask fields are:

- wallet: `callingCode` and `lastFour`;
- IBAN: `ibanCountryPrefix` and `lastFour`.

They are validated against the normalized plaintext before encryption and never accepted from callers.

### 15. `ProviderPayoutLookupFingerprint`

`id`, `claimId`, `lookupKeyId`, fixed-length HMAC-SHA-256 `fingerprint`, `createdAt`, optional `retiredAt`. Unique `(claimId, lookupKeyId)` and partial unique `(lookupKeyId, fingerprint)` for fingerprints whose claim is ACTIVE. Because PostgreSQL partial indexes cannot traverse a relation, implementation uses a denormalized `claimStatus` maintained atomically or an equivalent SQL-enforced active-claim table. Repository tests prove no active duplicate can survive concurrency.

No API/repository DTO outside the cryptographic lookup component returns this table.

### 16. `ProviderPayoutDestinationVersion`

Common fields:

| Field | Meaning |
|---|---|
| `id`, `chainId`, `providerId`, `identityClaimId` | Exact target and protected identity claim. |
| `sequence`, `predecessorVersionId` | Immutable linked version order. |
| `kind`, `status`, `version` | Type, lifecycle, expected version. |
| `countryId`, `countryCode`, `currencyCode?` | Authoritative routing facts. |
| `operatorId?`, `bankId?` | Exactly one type-appropriate registry FK. |
| `holderRelationship` | Legal-entity or Owner comparison source. |
| identifier encryption columns | `identifierCiphertext`, `identifierNonce`, `identifierTag`, `identifierEncryptionKeyId`. |
| holder encryption columns | `holderNameCiphertext`, `holderNameNonce`, `holderNameTag`, `holderNameEncryptionKeyId`. |
| `createdByUserId`, submission/terminal actors/timestamps | Provenance. |
| `idempotencyKey`, timestamps | Retry support. |

Type-shape checks require:

- Mobile Wallet: operator present, bank/currency absent (except country policy facts), canonical identity uses country + E.164.
- Bank Account: bank and configured currency present, operator absent, canonical identity uses normalized IBAN.
- nonce length 12 bytes, tag length 16 bytes, nonempty ciphertext/key IDs;
- no plaintext identifier or holder columns exist;
- submitted details immutable;
- unique `(chainId, sequence)` and predecessor; one open successor per chain;
- Staff queue index `(status, submittedAt, id)` and Provider list index `(providerId, status, updatedAt DESC, id)`.

### 17. `ProviderPayoutDecision`

Immutable fields: target Provider/version, outcome, verification method, meaningful note, Staff actor, decision timestamp, target expected version, request ID, unique operation key, safe before/after statuses, and applicable encryption/lookup key IDs. It stores no protected value, lookup result, transfer reference, actual transfer, or settlement.

Shape checks constrain wallet decisions to `MANUAL_WALLET_TRANSFER_CHECK`, bank decisions to `MANUAL_BANK_BENEFICIARY_CHECK`, and each outcome to a legal transition.

### 18. `ProviderPrimaryPayoutDestination`

One row per Provider: `providerId` primary key, `destinationVersionId` unique, positive `version`, `selectedByUserId`, `selectedAt`, `selectionReasonCode`, timestamps. The destination must belong to the same Provider and be current active APPROVED; service enforces the cross-row invariant while holding locks. Removing the last primary deletes/clears this row only after explicit acknowledgement and fresh re-authentication.

`Provider.payoutPrimaryStateVersion` is the durable nonnegative monotonic primary-state counter. Every initialize, change, clear, inherited transfer, and guarded restoration increments it. Owner commands compare `expectedPrimaryVersion` with this counter, including while no primary row exists. A challenged chain captures the post-clear counter and may restore only when the current counter still matches, preventing successor approval from overwriting an intervening Owner primary choice.

### 19. `ProviderPayoutConflict`

Safe cross-Provider conflict case: candidate Provider and idempotent command identity, requested destination kind/safe mask, incumbent claim ID, status, opened request/actor/time, resolution actor/time/reason/outcome, version. The colliding destination transaction does not create a second active claim; after the collision rolls back, one separate idempotent safe case is recorded for Staff resolution and the Owner must retry after release. The case contains no fingerprint or decrypted value. A partial unique operation key prevents duplicate OPEN cases. Resolution cannot bypass active fingerprint uniqueness.

### 20. `ProviderPayoutHistory`

Append-only safe events with Provider/chain/version/decision/primary/conflict references, safe from/to states, actor, reason, request, operation key, allowed mask, timestamp. No holder name, full identifier, ciphertext, nonce/tag, fingerprint, proof, or key material.

### 21. `ProviderPayoutKeyRotationRun`

| Field | Meaning |
|---|---|
| `id`, `purpose` | Encryption or lookup-HMAC run. |
| `fromKeyIds`, `toActiveKeyId` | Non-secret IDs only. |
| `status`, `batchSize`, `cursor` | Bounded resumable progress. |
| `scannedCount`, `updatedCount`, `failedCount`, `remainingReferenceCount` | Operational evidence. |
| `startedByUserId`, `startedAt`, `updatedAt` | Human origin/progress. |
| `verifiedAt`, `verifiedByUserId` | Zero-reference verification. |
| `retirementApprovedAt`, `retirementApprovedByUserId`, `retirementReason` | Required human approval. |
| `lastSafeErrorCode`, `version` | Fail-safe resume support. |

It never stores keys, plaintext, ciphertext, or fingerprints. Unique operation key prevents duplicate runs for the same transition.

## Non-Persisted Security Values

### Encrypted payout field

```text
{ ciphertext, nonce, authenticationTag, encryptionKeyId }
```

AAD is deterministically rebuilt from server-owned IDs/type/field/version. It is not caller-supplied.

### Payout reveal grant

A request-scoped application value object containing actor ID, session ID, Provider ID, exact destination version ID/version, purpose, request ID, reason, proof-issued time, and expiration. It is not serialized, stored, logged, or reusable.

### Payout reveal attempt

Admin Audit-owned safe evidence: actor, target Provider/version, purpose, reason, request ID, outcome, key IDs, timestamp. Accepted reveal rate is computed from durable Admin audit records (or an Admin-owned dedicated projection) so retries/process changes cannot bypass it.

## Document Lifecycle Matrix

| From | Command / actor | To | Continuity effect |
|---|---|---|---|
| DRAFT | submit; active exact OWNER/ADMIN | SUBMITTED | No credit until Staff approval; metadata/evidence freeze. |
| SUBMITTED | approve; Staff Admin | APPROVED | Becomes effective if no still-effective predecessor conflict; may satisfy policy. |
| SUBMITTED | reject; Staff Admin | REJECTED | Terminal; voluntary predecessor remains if still valid. |
| SUBMITTED | request replacement; Staff Admin | REPLACEMENT_REQUESTED | Target is not effective; successor required. |
| APPROVED | authoritative time | EXPIRED | Immediately non-effective. |
| APPROVED | invalidate; Staff Admin | INVALIDATED | Immediately non-effective. |
| APPROVED | request replacement; Staff Admin | REPLACEMENT_REQUESTED | Immediately non-effective. |
| APPROVED | successor approved | SUPERSEDED | Atomic pointer move; successor becomes effective. |

Every correction, resubmission, renewal, or replacement creates a DRAFT successor. Voluntary successor review leaves an unchallenged, unexpired approved predecessor effective. Rejection of that successor does not remove predecessor credit.

## Payout Lifecycle Matrix

| From | Command / actor | To | Primary/readiness effect |
|---|---|---|---|
| DRAFT | submit; Owner + fresh re-auth | PENDING_VERIFICATION | Never ready; queue/outbox created. |
| DRAFT | remove; Owner + fresh re-auth | REMOVED | Terminal; releases unused claim. |
| PENDING_VERIFICATION | approve; Staff | APPROVED | First approval initializes primary if absent; otherwise no auto-change. |
| PENDING_VERIFICATION | request changes; Staff | CHANGES_REQUESTED | Successor draft needed; no readiness. |
| PENDING_VERIFICATION | reject; Staff | REJECTED | Terminal; no readiness. |
| PENDING_VERIFICATION | withdraw/remove; Owner + fresh re-auth | REMOVED | Terminal; no readiness. |
| APPROVED | voluntary successor created/submitted; Owner | APPROVED | Predecessor and primary remain effective during review. |
| APPROVED | request replacement; Staff | REPLACEMENT_REQUESTED | Immediately non-effective; clear primary, remember former-primary eligibility. |
| APPROVED | invalidate; Staff | INVALIDATED | Terminal and immediately non-effective; clear primary, no failover. |
| APPROVED | successor approved | SUPERSEDED | Atomic successor effect and inherited primary when predecessor was primary/eligible. |
| APPROVED | remove; Owner + fresh re-auth | REMOVED | Replacement primary required if another approval exists; explicit acknowledgement if last. |
| CHANGES_REQUESTED | linked successor approved | SUPERSEDED | Successor becomes current; restores former challenged primary only when eligible. |
| CHANGES_REQUESTED | abandon; Owner + fresh re-auth | REMOVED | Terminal. |
| REPLACEMENT_REQUESTED | linked successor approved | SUPERSEDED | Successor becomes current; may restore former primary. |
| REPLACEMENT_REQUESTED | abandon; Owner + fresh re-auth | REMOVED | Terminal. |

`REJECTED`, `INVALIDATED`, `SUPERSEDED`, and `REMOVED` are terminal. No command may move a terminal version.

## Derived Projections

### `documentsVerified`

```text
INDIVIDUAL_TEAM -> { applicable: false, status: NOT_REQUIRED, satisfied: true }
REGISTERED_COMPANY + all current effective requirements met
  -> { applicable: true, status: SATISFIED, satisfied: true }
otherwise
  -> { applicable: true, status: BLOCKED or NOT_STARTED, satisfied: false,
       blockerCodes: allowlisted codes }
```

### Verification badge

```text
INDIVIDUAL_TEAM -> NOT_ELIGIBLE
approved REGISTERED_COMPANY + documentsVerified satisfied -> EARNED
approved REGISTERED_COMPANY otherwise -> NOT_EARNED
```

### `payoutDestinationReady`

Satisfied only when the primary-selection row points to the same Provider's current active APPROVED version. No other state or unselected approval satisfies it.

## Migration SQL Review Checklist

- [x] Applied migrations are byte-for-byte unchanged.
- [x] Enum additions occur before dependent tables and account for PostgreSQL enum visibility.
- [x] All new tables have primary keys, timestamps, explicit mappings, and ownership comments.
- [x] All FKs and `ON DELETE` behavior are reviewed.
- [x] Partial unique indexes cover effective policy timing, one open successor, active fingerprint claims, one open conflict, operation keys, and one primary.
- [x] Shape checks cover statuses/timestamps, type-specific payout fields, nonblank reasons, positive versions, and encryption metadata lengths.
- [x] No plaintext payout identifier/holder column exists.
- [x] No secret/key material is seeded or stored.
- [x] Existing Provider/outbox rows remain valid without backfill.
- [x] Clean install and populated R1-P05 upgrade both validate on the explicitly approved disposable R1-P06 database in separate isolated schemas.

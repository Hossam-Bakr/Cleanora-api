# Provider Verification HTTP API Contract — R1-P06

**Base**: `/api/v1`
**Envelope**: `docs/standards/api-response-and-errors.md`
**Public routes**: none
**Specification**: [spec.md](../spec.md)

## Common Rules

- Success: `{ "success": true, "data": ..., "requestId": "...", "meta"?: ... }`.
- Failure: `{ "success": false, "error": { "code": "...", "statusCode": n, "message": "...", "details"?: ... }, "requestId": "..." }`.
- JSON bodies are strict; unknown fields fail validation.
- Cursor lists default to 20 and max at 100 with stable time/ID order.
- All mutation bodies carry UUID `commandId` and the exact integer expected version(s).
- Opaque Authentication proofs appear only in bodies, are redacted, and are never persisted/logged by Providers.
- Cross-Provider scope failures use safe not-found/forbidden behavior without existence disclosure.
- No full payout identifier appears in a URL, query, error, ordinary response, audit, or history.
- Provider application must be APPROVED; operational suspension still permits authorized remediation.

## Core DTOs

### `VerificationOverview`

```text
providerId, providerKind, applicationStatus, operationalStatus,
documentsVerified, payoutDestinationReady,
badgeTruth: NOT_ELIGIBLE | NOT_EARNED | EARNED,
safeBlockerCodes[], capabilities
```

It never says `LIVE`, public, payable, or finally eligible.

### `ProviderDocumentSummary`

```text
documentVersionId, chainId, typeCode, typeLabel, sequence, status,
countryCode, issueDate, expiresAt?, evidenceFormat, evidenceCount,
effective, predecessorVersionId?, successorVersionId?, version,
createdAt, submittedAt?, decidedAt?, safeNextActions[]
```

Ordinary list omits document number, legal/issuer names, Media URLs/keys, and private review material. Authorized exact detail may return private metadata and short-lived Media delivery references appropriate to Owner/Admin or Staff review.

### `PayoutOwnerView`

```text
destinationVersionId, chainId, type, mask, institution { code, label },
holderRelationship, holderLegalName, status, primary, sequence,
predecessorVersionId?, successorVersionId?, version, primaryStateVersion,
createdAt, submittedAt?, decidedAt?, safeNextActions[]
```

### `PayoutAdminView`

```text
destinationVersionId, chainId, type, mask, status, primary,
createdAt, submittedAt?, decidedAt?
```

Admin receives no holder name, institution detail beyond what the spec permits, sensitive mutation capabilities, encryption data, or full identifier.

### `PayoutStaffSafeDossier`

Masked identifier, institution/relationship, status/version, predecessor/primary context, authoritative comparison-source availability, accepted-reveal requirement, and safe history. Holder name and full identifier are absent until exact reveal.

## Provider Verification Endpoints

### `GET /providers/{providerId}/verification`

Active exact Owner/Admin, or capable Staff dossier use. Returns `VerificationOverview` and capability-safe navigation facts. FR-039–050.

### `GET /providers/{providerId}/verification/document-requirements`

Returns current effective policy ID/version/effective time and ordered type requirements. Individual Teams receive `applicable: false`, `status: NOT_REQUIRED`, and no upload action. FR-004–018.

### `GET /providers/{providerId}/verification/documents?cursor&limit&status&typeCode`

Bounded authorized list. FR-019, FR-028–029, FR-036.

### `POST /providers/{providerId}/verification/documents`

Owner/Admin. Body:

```json
{
  "typeCode": "COMMERCIAL_REGISTRATION",
  "countryCode": "EG",
  "documentNumber": "synthetic-private-input",
  "legalName": "Synthetic Legal Name",
  "issuerName": "Synthetic Issuer",
  "issueDate": "2026-01-01",
  "expiresAt": null,
  "commandId": "00000000-0000-4000-8000-000000000001"
}
```

Server derives Provider/country/policy/actor. Returns 201 DRAFT detail. FR-019–027, FR-037.

### `GET|PUT /providers/{providerId}/verification/documents/{documentVersionId}`

GET returns role-authorized detail. PUT replaces DRAFT metadata only and requires all metadata plus `expectedVersion` and `commandId`. Submitted versions return 409. FR-025–029, FR-078–081.

### `POST /providers/{providerId}/verification/documents/{documentVersionId}/evidence`

Multipart `file`, `position`, `expectedVersion`, `commandId`. One item at a time through Media. Accepts validated PDF/JPEG/PNG; `image/jpeg` covers `.jpg` and `.jpeg`. Returns 202 with safe Media processing state. No payout destination uses this endpoint. FR-021–024, FR-166.

### `DELETE /providers/{providerId}/verification/documents/{documentVersionId}/evidence/{evidenceId}`

DRAFT only. Body `{ expectedVersion, commandId }`. Media cleanup is post-commit/compensated. Submitted evidence is immutable.

### `PUT /providers/{providerId}/verification/documents/{documentVersionId}/evidence-order`

DRAFT image set only. Body contains every evidence ID exactly once, `expectedVersion`, `commandId`.

### `POST /providers/{providerId}/verification/documents/{documentVersionId}/submit`

Body `{ expectedVersion, commandId }`. Rechecks complete READY evidence and current policy, snapshots rules, moves DRAFT to SUBMITTED. Matching retry returns prior result. FR-023–038.

### `POST /providers/{providerId}/verification/documents/{documentVersionId}/successors`

Creates a linked DRAFT correction/renewal/replacement from an eligible exact version. Body `{ expectedVersion, commandId }`; private values may be deliberately copied server-side only where policy permits, but evidence must be new/rebound according to Media rules. Returns 201.

### `GET /providers/{providerId}/verification/history?cursor&limit`

Safe chronological document/policy/truth/badge history. FR-036, FR-075–077.

## Staff Document and Policy Endpoints

All require active Staff Admin and the appropriate explicit permission.

### Document types

`GET /staff/providers/verification/document-types` returns the persisted active
and retired stable definitions available to policy authoring. R1-P06 seeds the
two approved launch definitions but does not add an unapproved generic type-
mutation endpoint. Type applicability, requirement semantics, and versioned
metadata rules are expressed by immutable policy items. FR-010–018.

### Document policies

```text
GET  /staff/providers/verification/document-policies?countryCode&providerKind&status&cursor&limit
POST /staff/providers/verification/document-policies
PUT  /staff/providers/verification/document-policies/{policyVersionId}
POST /staff/providers/verification/document-policies/{policyVersionId}/publish
```

Draft create/update bodies contain country/kind/effective time/items and exact version. Publish body contains `expectedVersion`, meaningful `reason`, and `commandId`. Published rows are immutable. FR-015–018, FR-038.

### Staff document queue/dossier/decision

```text
GET  /staff/providers/verification/documents?status=SUBMITTED&cursor&limit
GET  /staff/providers/{providerId}/verification/documents/{documentVersionId}
POST /staff/providers/{providerId}/verification/documents/{documentVersionId}/decisions
```

Decision body:

```json
{
  "outcome": "APPROVE",
  "reason": "Verified against the submitted complete evidence.",
  "expectedVersion": 3,
  "commandId": "00000000-0000-4000-8000-000000000002"
}
```

Other legal outcomes are `REJECT`, `REQUEST_REPLACEMENT`, and for an approved version `INVALIDATE`. Invalidation is not a SUBMITTED transition. FR-030–038, FR-075–080.

## Provider Payout Endpoints

### `GET /providers/{providerId}/payout-destination-options`

Owner receives authoritative country/configured currency and active type/operator/bank code-label choices. Caller cannot override country/currency or send free-text institution. Admin may receive labels needed for read-only display. FR-051–058, FR-089–090, FR-105–107.

### `GET /providers/{providerId}/payout-destinations?cursor&limit&status&type`

Owner gets `PayoutOwnerView`; Admin gets `PayoutAdminView`. Returns active slot use and primary version. Every identifier is masked from DRAFT onward. FR-055–067, FR-100–102, FR-116–118, FR-145–149.

### `POST /providers/{providerId}/payout-destinations`

Owner only. Wallet body:

```json
{
  "type": "MOBILE_WALLET",
  "countryCode": "EG",
  "walletNumber": "+201000000000",
  "operatorCode": "TEST_OPERATOR",
  "holderLegalName": "Synthetic Holder",
  "holderRelationship": "PROVIDER_OWNER",
  "commandId": "00000000-0000-4000-8000-000000000003"
}
```

Bank body:

```json
{
  "type": "BANK_ACCOUNT",
  "countryCode": "EG",
  "currencyCode": "EGP",
  "bankCode": "TEST_BANK",
  "iban": "EG38001900050000000026318002",
  "holderLegalName": "Synthetic Holder",
  "holderRelationship": "PROVIDER_LEGAL_ENTITY",
  "commandId": "00000000-0000-4000-8000-000000000004"
}
```

The examples are synthetic; production catalogs provide actual codes. Server normalizes, masks, encrypts, fingerprints, enforces five chains/dedup, and returns 201 DRAFT with mask only. No ownership-evidence field is accepted. FR-051–059, FR-089–117, FR-140–149.

### `GET|PUT /providers/{providerId}/payout-destinations/{destinationVersionId}`

GET uses Owner/Admin projection. PUT replaces complete type-specific DRAFT input plus `expectedVersion`/`commandId`; identifier changes require full re-entry. Response remains masked. Non-DRAFT is 409.

### `POST /providers/{providerId}/payout-destinations/{destinationVersionId}/submit`

Owner body:

```json
{
  "expectedVersion": 2,
  "reauthenticationProof": "opaque-authentication-owned-proof",
  "commandId": "00000000-0000-4000-8000-000000000005"
}
```

Fresh <=10-minute request-bound proof. Moves to PENDING_VERIFICATION, creates safe history/review visibility/Owner outbox. Never ready. FR-093, FR-109, FR-121, FR-134–139.

### `POST /providers/{providerId}/payout-destinations/{destinationVersionId}/successors`

Owner creates a linked DRAFT successor from an eligible version. The body is a
complete discriminated wallet or bank draft payload plus predecessor
`expectedVersion` and `commandId`; changing a protected value therefore requires
complete re-entry and no post-write reveal/copy shortcut. Submit remains a
separate proof-bound command. One open successor only. FR-119, FR-123–128,
FR-145.

### `POST /providers/{providerId}/payout-destinations/{destinationVersionId}/remove`

Owner body:

```json
{
  "expectedVersion": 4,
  "expectedPrimaryVersion": 2,
  "replacementPrimaryDestinationVersionId": null,
  "acknowledgeReadinessLoss": true,
  "reason": "Destination no longer used.",
  "reauthenticationProof": "opaque-authentication-owned-proof",
  "commandId": "00000000-0000-4000-8000-000000000006"
}
```

Fields are state-dependent. Another approved destination requires atomic replacement ID; last primary requires explicit acknowledgement. Handles legal DRAFT/PENDING withdrawal and removal states. FR-120–135.

### `PUT /providers/{providerId}/payout-destinations/primary`

Body `{ destinationVersionId, expectedDestinationVersion, expectedPrimaryVersion, reauthenticationProof, commandId }`. Target must be current active APPROVED. FR-129–135.

### `GET /providers/{providerId}/payout-destination-history?cursor&limit`

Owner/Admin role-specific safe masked history. No holder name in Admin/history and no crypto fields. FR-137–155.

## Staff Payout Endpoints

All require active Staff Admin plus `providers.payout-destinations.verify`.

### `GET /staff/providers/payout-destinations?status=PENDING_VERIFICATION&cursor&limit`

Masked queue, oldest eligible first. No holder name/full identifier.

### `GET /staff/providers/{providerId}/payout-destinations/{destinationVersionId}`

Safe dossier only; no implicit reveal.

### `POST /staff/providers/{providerId}/payout-destinations/{destinationVersionId}/reveal`

Body:

```json
{
  "expectedVersion": 3,
  "purpose": "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
  "reason": "Preparing the manual beneficiary-name verification.",
  "stepUpProof": "opaque-authentication-owned-proof",
  "commandId": "00000000-0000-4000-8000-000000000007"
}
```

Exact PENDING version, <=5-minute request-bound proof, actor-serialized max five accepted/10 minutes, accepted audit before response. Success data contains `destinationVersionId`, `revealAttemptId`, type, exact full identifier, full holder legal name, relationship, and non-secret institution facts for this response only. Headers: `Cache-Control: no-store, private`, `Pragma: no-cache`. No bulk/export/reuse/approved/terminal reveal. FR-150–157.

### `POST /staff/providers/{providerId}/payout-destinations/{destinationVersionId}/decisions`

```json
{
  "outcome": "APPROVE",
  "verificationMethod": "MANUAL_WALLET_TRANSFER_CHECK",
  "reasonCode": "VERIFIED_MATCH",
  "verificationNote": "Manual external beneficiary check completed without transferring funds.",
  "acceptedRevealAttemptId": "safe-attempt-id",
  "expectedVersion": 3,
  "commandId": "00000000-0000-4000-8000-000000000008"
}
```

Bank uses `MANUAL_BANK_BENEFICIARY_CHECK`. Legal outcomes: APPROVE, REJECT, REQUEST_CHANGES, REQUEST_REPLACEMENT, INVALIDATE depending on state. Approval requires same-actor/same-version accepted reveal evidence; all decisions require meaningful safe note/reason. No actual external result/name/transfer/settlement is stored. FR-094–103, FR-110–117, FR-122–139.

### Conflict queue/resolution

```text
GET  /staff/providers/payout-destination-conflicts?status=OPEN&cursor&limit
POST /staff/providers/{providerId}/payout-destination-conflicts/{conflictId}/resolve
```

Resolve body contains `outcome: CANDIDATE_REJECTED | RESOLVED_AFTER_RELEASE`, reason, expectedVersion, commandId. It never overrides uniqueness. Incumbent invalidation/release uses the ordinary exact-version decision workflow; candidate Owner retries after resolution. Ordinary Provider receives only a safe conflict code. FR-099, FR-115.

## Stable Error Families

```text
PROVIDER_NOT_APPROVED
PROVIDER_SCOPE_DENIED
PROVIDER_MEMBERSHIP_INACTIVE
VERIFICATION_POLICY_NOT_FOUND | POLICY_VERSION_CONFLICT | POLICY_IMMUTABLE
DOCUMENT_VERSION_CONFLICT | DOCUMENT_STATE_CONFLICT | DOCUMENT_EVIDENCE_NOT_READY
DOCUMENT_EVIDENCE_UNSUPPORTED | DOCUMENT_EVIDENCE_UNSAFE | DOCUMENT_EVIDENCE_LIMIT_EXCEEDED
PAYOUT_DESTINATION_UNSUPPORTED | PAYOUT_REGISTRY_INACTIVE | PAYOUT_IDENTIFIER_INVALID
PAYOUT_DESTINATION_VERSION_CONFLICT | PAYOUT_DESTINATION_STATE_CONFLICT
PAYOUT_DESTINATION_LIMIT_REACHED | PAYOUT_SUCCESSOR_CONFLICT
PAYOUT_DESTINATION_CONFLICT | PAYOUT_PRIMARY_CONFLICT
PAYOUT_REAUTHENTICATION_REQUIRED | PAYOUT_STEP_UP_REQUIRED
PAYOUT_REVEAL_RATE_LIMITED | PAYOUT_REVEAL_AUDIT_UNAVAILABLE
PAYOUT_KEY_CONFIGURATION_UNAVAILABLE | PAYOUT_PROTECTED_VALUE_UNAVAILABLE
```

Error details contain allowlisted issue paths/codes/expected-current versions only, never submitted or stored sensitive values or another Provider identity.

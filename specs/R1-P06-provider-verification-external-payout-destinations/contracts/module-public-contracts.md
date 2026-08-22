# Module Public Contracts — R1-P06

## Dependency Direction

```text
providers -> authentication.public
providers -> configuration.public
providers -> customers.public
providers -> media.public
providers -> admin.audit.public
providers -> injected crypto/email/clock adapters
composition root -> infrastructure factories
```

No foreign module imports Providers internals and Providers never queries another module's Prisma models.

## Authentication

```ts
type AuthenticationProofPurpose =
  | "PROVIDER_PAYOUT_SUBMIT"
  | "PROVIDER_PAYOUT_SUCCESSOR_SUBMIT"
  | "PROVIDER_PAYOUT_PRIMARY_CHANGE"
  | "PROVIDER_PAYOUT_WITHDRAW"
  | "PROVIDER_PAYOUT_REMOVE"
  | "STAFF_PAYOUT_REVEAL";

interface RecentAuthenticationProofVerifier {
  verify(input: {
    principalUserId: string;
    sessionId: string;
    opaqueProof: string;
    purpose: AuthenticationProofPurpose;
    providerId: string;
    destinationVersionId: string;
    requestId: string;
    maximumAgeSeconds: 600 | 300;
  }): Promise<{
    actorUserId: string;
    sessionId: string;
    authenticatedAt: Date;
    expiresAt: Date;
    proofId: string; // safe internal correlation only; never logged raw
  }>;
}

interface StaffCapabilityAuthorizer {
  authorize(input: {
    principal: TrustedAccessPrincipal;
    requiredPermission:
      | "providers.verification.documents.review"
      | "providers.verification.policies.manage"
      | "providers.payout-destinations.verify";
  }): Promise<{ actorUserId: string; active: true }>;
}
```

Authentication owns issuance/consumption and account/session activity. Providers supplies server-derived scope; it never receives a password, credential hash, OTP, or session row. Proofs are purpose/request-bound and not reusable. Exact Provider membership remains Providers-owned and cannot be replaced by a global role or historical account category.

## Configuration

```ts
interface ActiveCountryAndCurrencyReader {
  readCountry(input: {
    countryCode: string;
    transaction?: unknown;
  }): Promise<{
    countryId: string;
    countryCode: string;
    active: boolean;
    callingCodes: readonly string[];
  } | null>;

  readCurrency(input: {
    currencyCode: string;
    transaction?: unknown;
  }): Promise<{
    currencyId: string;
    currencyCode: string;
    active: boolean;
  } | null>;
}
```

Configuration supplies generic facts. Providers owns payout currency policy, operator/bank registries, and document policy.

## Customers

```ts
interface ProviderPayoutHolderAuthorityReader {
  readLegalNameFacts(input: {
    providerKind: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY";
    applicationOwnerUserId: string;
    activeOwnerUserId: string;
  }): Promise<{
    legalEntityName: string | null;
    ownerLegalName: string | null;
  }>;
}
```

Only those two names may cross this contract. If the selected relationship has no authoritative name, approval is unverifiable; Provider display name is not a fallback. No tax/registration/contact/address fields cross.

## Media

```ts
type VerificationEvidenceContentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

type VerificationEvidenceStatus =
  | "PENDING_UPLOAD"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "PENDING_DELETE"
  | "DELETED";

interface ProviderVerificationEvidencePort {
  reserve(input: {
    ownerUserId: string;
    providerId: string;
    documentVersionId: string;
    position: number;
    expectedContentType: VerificationEvidenceContentType;
    requestId: string;
  }): Promise<{ mediaFileId: string; reservationVersion: number }>;

  processPrivateUpload(input: {
    mediaFileId: string;
    reservationVersion: number;
    bytes: Uint8Array;
    declaredContentType: string;
    originalFilename: string;
  }): Promise<{
    mediaFileId: string;
    status: VerificationEvidenceStatus;
    detectedContentType?: VerificationEvidenceContentType;
    byteSize?: number;
    pageCount?: number;
    validationPolicyVersion?: string;
    safeFailureCode?: string;
  }>;

  readStatuses(input: {
    mediaFileIds: readonly string[];
    transaction?: unknown;
  }): Promise<readonly {
    mediaFileId: string;
    status: VerificationEvidenceStatus;
    detectedContentType: VerificationEvidenceContentType | null;
    byteSize: number;
    pageCount: number | null;
    validationPolicyVersion: string | null;
  }[]>;

  createPrivateDelivery(input: {
    mediaFileId: string;
    authorizedUserId: string;
    purpose: "PROVIDER_DOCUMENT_MANAGEMENT" | "STAFF_DOCUMENT_REVIEW";
  }): Promise<{ url: string; expiresAt: Date }>;

  requestCleanup(input: { mediaFileId: string; safeReasonCode: string }): Promise<void>;
}
```

The port never returns storage keys, Cloudinary IDs, credentials, or raw provider responses. `image/jpeg` covers validated `.jpg` and `.jpeg`; extension is never authoritative. Upload/scanner/Cloudinary work is outside Providers transactions. Submission re-reads every status and requires a successful Media validation receipt.

## Admin Audit and Reveal Gate

```ts
interface ProviderPrivilegedAuditWriter {
  append(input: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    providerId: string;
    exactVersion: number;
    reasonCode: string;
    reason?: string;
    requestId: string;
    safeBefore?: Record<string, string | number | boolean | null>;
    safeAfter?: Record<string, string | number | boolean | null>;
    transaction?: unknown;
  }): Promise<void>;
}

interface PayoutRevealAuditGate {
  appendAcceptedOrDeny(input: {
    actorUserId: string;
    providerId: string;
    destinationVersionId: string;
    exactVersion: number;
    purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION";
    reason: string;
    requestId: string;
    oneUseProofFingerprint: string;
    encryptionKeyIds: readonly string[];
    lookupKeyIds: readonly string[];
    now: Date;
    rollingWindowSeconds: 600;
    maximumAccepted: 5;
    transaction: unknown;
  }): Promise<
    | { accepted: true; revealAttemptId: string }
    | { accepted: false; safeCode: "PAYOUT_REVEAL_RATE_LIMITED" }
  >;

  appendDenied(input: {
    actorUserId?: string;
    providerId?: string;
    destinationVersionId?: string;
    purpose: string;
    safeOutcomeCode: string;
    requestId: string;
    occurredAt: Date;
  }): Promise<void>;
}
```

The accepted gate participates in the Providers-owned database transaction,
serializes per actor in PostgreSQL, counts committed accepted attempts in the
rolling window, and persists safe audit. The outer transaction holds the exact
destination-version lock and actor gate through its single commit; only the
post-commit acknowledgement permits disclosure. Input guards reject protected/
envelope/fingerprint/key material; non-secret key IDs are allowed only here.
Providers never reads `audit_logs` directly.

## Providers Public Contract

Extend safe Provider facts only:

```ts
interface ProviderVerificationPublicReader {
  getR1P06Readiness(input: { providerId: string }): Promise<{
    documentsVerified: MarketplaceReadinessGate;
    payoutDestinationReady: MarketplaceReadinessGate;
    badgeTruth: "NOT_ELIGIBLE" | "NOT_EARNED" | "EARNED";
  }>;
}
```

No document metadata/evidence URL, payout mask, holder name, decision, history, claim, or crypto metadata enters `providers.public.ts` unless a later phase authorizes a narrower purpose-specific contract.

## Injected Technical Ports

- `PayoutFieldCipher`: encrypt/decrypt explicit field envelopes with canonical AAD.
- `PayoutLookupFingerprinter`: compute all enabled HMAC fingerprints.
- `PayoutKeyRingProvider`: validated active/retained non-secret metadata and key handles.
- `Clock` and `RandomNonceSource`: deterministic tests, secure production sources.
- existing Provider email sender/outbox repository.

Controllers and DTO mappers never perform cryptography or access raw keys.

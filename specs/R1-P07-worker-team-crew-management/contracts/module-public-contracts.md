# R1-P07 Module Public Contracts

These are implementation contracts for the future R1-P07 implementation. They
do not change runtime during planning. Concrete adapters are composed in
`src/composition.ts`; business modules import public entry points only.

## Dependency direction

```text
HTTP routes -> Providers controllers -> ProviderWorkforceService
                                      -> Providers repositories/UoW
                                      -> authentication.public contracts
                                      -> media.public contracts
                                      -> admin/audit.public contracts

Later Booking -> providers.public safe readiness/crew reader
```

Providers never imports `authentication/infrastructure`, `media/infrastructure`,
`admin/infrastructure`, another module's controller/routes, or raw Prisma types.

## Authentication public additions

Planned in `src/modules/authentication/authentication.public.ts`.

```ts
export type WorkerSensitiveActionPurpose =
  | "WORKER_ACCESS_ISSUE"
  | "WORKER_ACCESS_RESET"
  | "WORKER_ACCESS_REVOKE"
  | "WORKER_REMOVE"
  | "PROVIDER_ADMIN_GRANT"
  | "PROVIDER_ADMIN_REVOKE";

export interface WorkerIdentitySnapshot {
  readonly userId: string;
  readonly status: "ACTIVE" | "SUSPENDED" | "BANNED";
  readonly isAccountActive: boolean;
  readonly emailNormalized: string | null;
  readonly workerRoleEnabled: boolean;
  readonly providerSupervisorRoleEnabled: boolean;
  readonly preferredLanguage: "AR" | "EN" | null;
}

export interface WorkerIdentityReader {
  getIdentity(userId: string): Promise<WorkerIdentitySnapshot | null>;
  findByEmailNormalized(email: string): Promise<WorkerIdentitySnapshot | null>;
}

export type TransactionalWorkerIdentityReaderFactory =
  (transaction: unknown) => WorkerIdentityReader;

export interface WorkerInvitationIdentityOnboarding {
  startNewUser(input: {
    readonly invitationId: string;
    readonly invitationVersion: number;
    readonly fixedEmailNormalized: string;
    readonly password: string;
  }): Promise<{ readonly userId: string; readonly challengeId: string; readonly maskedDestination: string }>;
  verifyEmail(input: {
    readonly challengeId: string;
    readonly code: string;
    readonly fixedEmailNormalized: string;
  }): Promise<{ readonly principal: AuthenticationPrincipal; readonly capability: "WORKER_INVITATION_ONBOARDING" }>;
}

export interface TransactionalWorkerIdentityAuthorityWriter {
  reconcileWorkerRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }): Promise<void>;
  reconcileProviderSupervisorRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }): Promise<void>;
  reconcileProviderAdminRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }): Promise<void>;
}

export type TransactionalWorkerIdentityAuthorityWriterFactory =
  (transaction: unknown) => TransactionalWorkerIdentityAuthorityWriter;

export interface WorkerRecentAuthenticationProofVerifier {
  verify(input: {
    readonly principalUserId: string;
    readonly sessionId: string;
    readonly opaqueProof: string;
    readonly purpose: WorkerSensitiveActionPurpose;
    readonly providerId: string;
    readonly workerId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600;
  }): Promise<{ readonly proofId: string; readonly authenticatedAt: Date; readonly expiresAt: Date }>;
}

export interface TransactionalWorkerProofUseAuthorizer {
  assertConsumed(input: {
    readonly proofId: string;
    readonly actorUserId: string;
    readonly purpose: WorkerSensitiveActionPurpose;
    readonly providerId: string;
    readonly workerId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600;
    readonly now: Date;
  }): Promise<boolean>;
}
```

Rules:

- Authentication owns password policy, OTP/email verification, restricted
  onboarding session, identity activity, and global role rows.
- The transactional writer joins the already-open Providers transaction and
  never opens its own transaction.
- Identity, role, and language reads used by accepted commands use the
  transaction-bound reader factory so the Providers transaction observes one
  consistent decision snapshot.
- Worker-role enablement reflects at least one accepted active Worker access
  relationship; revoke only when no qualifying relationship remains.
- Provider-Supervisor role is a coarse global capability only; exact Team scope
  is always rechecked from Providers.
- Provider Admin role reconciliation follows explicit active
  `provider_members.ADMIN`, never Worker fields.

## Media public additions

Planned in `src/modules/media/media.public.ts`.

```ts
export const WORKER_PROFILE_IMAGE = "WORKER_PROFILE_IMAGE" as const;

export interface WorkerAvatarReceipt {
  readonly mediaFileId: string;
  readonly ownerUserId: string;
  readonly state: "PROCESSING" | "READY" | "FAILED";
  readonly canonicalContentType: "image/jpeg" | "image/png" | "image/webp";
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly safeReceiptId: string;
}

export interface WorkerAvatarPort {
  ingest(input: {
    readonly ownerUserId: string;
    readonly declaredContentType: string;
    readonly bytes: Buffer;
  }): Promise<WorkerAvatarReceipt>;
  readValidationReceipt(mediaFileId: string): Promise<WorkerAvatarReceipt | null>;
  issuePrivateDelivery(input: {
    readonly mediaFileId: string;
    readonly actorUserId: string;
    readonly providerId: string;
    readonly workerId: string;
    readonly purpose: "WORKER_AVATAR_PRIVATE_READ";
  }): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  requestCleanup(input: { readonly mediaFileId: string; readonly safeReasonCode: string }): Promise<void>;
}

export interface TransactionalWorkerAvatarAuthorizer {
  assertReadyOwnedProfileImage(input: {
    readonly mediaFileId: string;
    readonly ownerUserId: string;
  }): Promise<boolean>;
}

export type TransactionalWorkerAvatarAuthorizerFactory =
  (transaction: unknown) => TransactionalWorkerAvatarAuthorizer;
```

Rules: Media accepts JPEG/PNG/WebP only, maximum 5 MiB, safely corrects
orientation/removes unsafe metadata, emits WebP up to 1200px, stores privately,
and never decides Provider authorization. Providers binds only a READY receipt
after exact Worker/profile authorization and CAS.

## Admin audit public use

Use the existing `GeneralTransactionalAuditWriter` and `PrivilegedAuditWriter`
exports from `src/modules/admin/audit.public.ts`. If a narrow workforce alias is
useful it may be added there, but no Providers-specific repository is exposed.

Accepted audit facts include actor, action code, Provider/target IDs, exact
target version, reason code, bounded note where required, request ID, timestamp,
and safe before/after state codes. They exclude full operational phone,
invitation email/proof, password/OTP/session, storage key, and notification body.

## Providers public additions

Planned in `src/modules/providers/providers.public.ts`.

```ts
export interface ProviderWorkersReadyFacts {
  readonly providerId: string;
  readonly workersReady: boolean;
  readonly qualifyingWorkerCount: number;
  readonly blockerCodes: readonly (
    | "NO_ACTIVE_CLEANING_WORKER"
    | "PROFILE_INCOMPLETE"
    | "WORKER_ACCOUNT_OR_ROLE_INACTIVE"
    | "WORKER_LOGIN_ACCESS_INACTIVE"
  )[];
}

export interface BookingSafeTeamMemberFact {
  readonly workerId: string;
  readonly gender: "male" | "female";
  readonly workerType: "CLEANING_STAFF" | "ESCORT" | "OTHER";
  readonly cleans: boolean;
}

export interface BookingSafeTeamFacts {
  readonly providerId: string;
  readonly teamId: string;
  readonly teamVersion: number;
  readonly active: boolean;
  readonly members: readonly BookingSafeTeamMemberFact[];
}

export interface ProviderWorkforcePublicReader {
  getWorkersReady(providerId: string): Promise<ProviderWorkersReadyFacts | null>;
  getBookingSafeTeamFacts(input: { readonly providerId: string; readonly teamId: string }): Promise<BookingSafeTeamFacts | null>;
}
```

The public contract never exposes phone, title, skills, avatar URL/storage key,
Supervisor authority, invitation/access details, Provider membership internals,
history, audit, or Prisma rows. R1-P07 does not change
`eligibleForPublicBrowse`.

## Providers internal ports

Providers domain/application ports include:

- `ProviderWorkforceRepositoryPort`: aggregate reads, versioned writes, locks,
  history, commands, notification intents.
- `ProvidersWorkforceUnitOfWorkPort`: one transaction callback receiving
  Providers repositories plus injected Authentication/Media/Admin public
  transaction participants.
- `ProviderWorkforceNotificationDeliveryPort`: safe template+locale delivery
  outside transaction.
- `WorkerInvitationProofPort`: domain-separated HMAC issue/verify built from the
  existing Authentication verifier secret; its raw secret never enters
  Providers services.

These are Providers-owned internal ports, not cross-module public APIs.

## Failure contract

Public HTTP adapters map domain errors to stable safe families:

| Stable code | HTTP | Meaning |
|---|---:|---|
| `WORKFORCE_VALIDATION_FAILED` | 400 | All independently detectable safe field issues |
| `WORKER_INVITATION_INVALID` | 400/409 | Malformed proof or terminal/stale invitation without secret detail |
| `AUTHENTICATION_REQUIRED` | 401 | Missing/invalid principal or onboarding capability |
| `WORKFORCE_PERMISSION_DENIED` | 403 | Actor lacks exact permitted scope |
| `WORKFORCE_RESOURCE_NOT_FOUND` | 404 | Safe same-scope absence |
| `WORKFORCE_STATE_CONFLICT` | 409 | Version/state/uniqueness/competing command conflict |
| `WORKFORCE_FINAL_CLEANER_CONFLICT` | 409 | Supervisor must refer change to Owner/Admin |
| `WORKFORCE_REAUTHENTICATION_REQUIRED` | 409 | High-risk proof missing/stale/wrong purpose |
| `WORKFORCE_DEPENDENCY_NOT_READY` | 503 | Required owned dependency unavailable |

Cross-Provider calls must not reveal which private resource exists. Matching
idempotent retries return the original accepted success envelope.

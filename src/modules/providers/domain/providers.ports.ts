import type {
  GeneralTransactionalAuditWriter,
  PrivilegedAuditWriter,
} from "#modules/admin/audit.public";

import type {
  ExpectedVersion,
  MarketplaceReadiness,
  ProviderAdminInvitationRecord,
  ProviderApplicationStatus,
  ProviderContactChannel,
  ProviderContactRecord,
  ProviderEmailOutboxRecord,
  ProviderEmailOutboxStatus,
  ProviderEmailTemplate,
  ProviderGalleryItemRecord,
  ProviderGalleryKind,
  ProviderKind,
  ProviderMemberRecord,
  ProviderMembershipLevel,
  ProviderMembershipStatus,
  ProviderOperationalStatus,
  ProviderProfileRecord,
  ProviderRecord,
  ProviderStatusDomain,
  ProviderStatusHistoryRecord,
  ProviderInvitationStatus,
} from "./providers.types.js";

/** Transaction-bound Authentication participant (composition injects). */
export interface ProviderIdentityAuthorityWriterPort {
  grantOwnerAuthority(userId: string): Promise<void>;
  reconcileProviderAdminRole(input: {
    readonly userId: string;
    readonly shouldBeEnabled: boolean;
  }): Promise<void>;
}

/** Safe identity facts Providers may read (no reverse Provider dependency). */
export interface ProviderIdentityReaderPort {
  getEligibilityFacts(userId: string): Promise<{
    /** Account status only; invitation acceptance may use this while capability is restricted. */
    readonly accountActive: boolean;
    readonly active: boolean;
    readonly verificationOnly: boolean;
    readonly enrolledCategories: readonly string[];
    readonly verifiedCategories: readonly string[];
    readonly emailNormalized: string | null;
    readonly emailVerified: boolean;
    readonly phoneE164: string | null;
    readonly phoneVerified: boolean;
    readonly providerAdminEnabled: boolean;
  } | null>;

  getAuthoritativeEmail(userId: string): Promise<string | null>;

  /** Lookup by normalized email for invitation inspect/onboarding branching. */
  findByEmailNormalized(emailNormalized: string): Promise<{
    readonly userId: string;
    readonly emailNormalized: string;
    readonly emailVerified: boolean;
    readonly accountActive: boolean;
    readonly active: boolean;
  } | null>;
}

/**
 * One-shot invitation email delivery. Raw token exists only in process memory
 * for this call and must never enter outbox/logs/audit/API responses.
 */
export interface ProviderInvitationEmailDeliveryPort {
  deliverInvitationOnce(input: {
    readonly invitationId: string;
    readonly recipientEmailNormalized: string;
    readonly rawToken: string;
  }): Promise<"DELIVERED" | "RESEND_REQUIRED">;
}

export interface ProviderApplicantProfileReaderPort {
  getMatchingApplicantContext(input: {
    readonly userId: string;
    readonly providerKind: ProviderKind;
  }): Promise<{
    readonly category: "INDIVIDUAL" | "COMPANY";
    readonly profileComplete: boolean;
    readonly individualFullName: string | null;
    readonly companyName: string | null;
    readonly representativeFullName: string | null;
  } | null>;
}

export interface ActiveCountryReaderPort {
  resolveActiveCountry(countryCode: string): Promise<{
    readonly id: string;
    readonly code: string;
  } | null>;
  getById(countryId: string): Promise<{
    readonly id: string;
    readonly code: string;
  } | null>;
}

/** Opaque Media facts only — never storage keys or provider payloads. */
export interface ProviderMediaReaderPort {
  getMediaStatus(mediaId: string): Promise<{
    readonly mediaId: string;
    readonly status:
      | "PENDING_UPLOAD"
      | "PROCESSING"
      | "READY"
      | "FAILED"
      | "PENDING_DELETE"
      | "DELETED";
    readonly contentType: string | null;
    readonly byteSize: number | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly hasReadyThumbnail: boolean;
  } | null>;
}

export interface ProviderMediaUsageReaderPort {
  getUsageSnapshot(providerId: string): Promise<{
    readonly logoMediaFileId: string | null;
    readonly coverMediaFileId: string | null;
    readonly logoStatus: import("./provider-media.policy.js").ProviderMediaCapacityStatus | null;
    readonly coverStatus: import("./provider-media.policy.js").ProviderMediaCapacityStatus | null;
    readonly gallery: readonly {
      readonly galleryItemId: string;
      readonly kind: ProviderGalleryKind;
      readonly mediaFileId: string;
      readonly status: import("./provider-media.policy.js").ProviderMediaCapacityStatus;
      readonly hasReadyThumbnail: boolean;
      readonly position: number;
    }[];
    readonly imageCount: number;
    readonly videoCount: number;
    readonly readyGalleryImageCount: number;
  }>;
}

export interface ProviderEmailDeliveryPort {
  sendTemplate(input: {
    readonly template: ProviderEmailTemplate;
    readonly to: string;
    readonly locale: "AR" | "EN";
    readonly variables: Readonly<Record<string, string>>;
    readonly idempotencyKey: string;
  }): Promise<void>;
}

export interface ProviderDenialAuditPort {
  append(input: {
    readonly actorType: "USER" | "SYSTEM" | "UNKNOWN";
    readonly actorId?: string;
    readonly action: string;
    readonly targetType: string;
    readonly targetId?: string;
    readonly outcome: string;
    readonly reason?: string;
    readonly context?: Readonly<Record<string, string | number | boolean>>;
    readonly requestId?: string;
  }): Promise<{ readonly id: string; readonly createdAt: string }>;
}

export type ProviderTransactionalAuditPort = GeneralTransactionalAuditWriter;
export type ProviderPrivilegedAuditPort = PrivilegedAuditWriter;

export interface CreateProviderInput {
  readonly applicationOwnerUserId: string;
  readonly kind: ProviderKind;
}

export interface UpdateProviderLifecycleInput {
  readonly providerId: string;
  readonly expectedVersion: ExpectedVersion;
  readonly kind?: ProviderKind;
  readonly applicationStatus?: ProviderApplicationStatus;
  readonly operationalStatus?: ProviderOperationalStatus;
  readonly ownerUserId?: string | null;
  readonly reviewCycle?: number;
  readonly firstSubmittedAt?: Date | null;
  readonly lastSubmittedAt?: Date | null;
  readonly applicationChangedAt?: Date;
  readonly operationalChangedAt?: Date;
  readonly approvedAt?: Date | null;
  readonly rejectedAt?: Date | null;
  readonly suspendedAt?: Date | null;
}

export interface UpsertProviderProfileInput {
  readonly providerId: string;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly countryId: string | null;
  readonly logoMediaFileId?: string | null;
  readonly coverMediaFileId?: string | null;
}

export interface UpsertProviderContactInput {
  readonly providerId: string;
  readonly operationalEmailNormalized: string | null;
  readonly operationalPhoneE164: string | null;
  readonly channels: readonly ProviderContactChannel[];
}

export interface AppendStatusHistoryInput {
  readonly providerId: string;
  readonly domain: ProviderStatusDomain;
  readonly fromApplicationStatus?: ProviderApplicationStatus | null;
  readonly toApplicationStatus?: ProviderApplicationStatus | null;
  readonly fromOperationalStatus?: ProviderOperationalStatus | null;
  readonly toOperationalStatus?: ProviderOperationalStatus | null;
  readonly reviewCycle?: number | null;
  readonly actorUserId: string;
  readonly reason?: string | null;
  readonly requestId?: string | null;
}

export interface UpsertProviderMemberInput {
  readonly providerId: string;
  readonly userId: string;
  readonly level: ProviderMembershipLevel;
  readonly status: ProviderMembershipStatus;
  readonly invitedByUserId: string | null;
  readonly enabledAt: Date;
  readonly disabledAt: Date | null;
}

export interface CreateProviderInvitationInput {
  readonly providerId: string;
  readonly emailNormalized: string;
  readonly tokenVerifier: string;
  readonly tokenVersion: number;
  readonly invitedByUserId: string;
  readonly expiresAt: Date;
  readonly version?: number;
}

export interface CreateGalleryItemInput {
  readonly providerId: string;
  readonly mediaFileId: string;
  readonly kind: ProviderGalleryKind;
  readonly position: number;
  readonly createdByUserId: string;
}

export interface CreateEmailOutboxIntentInput {
  readonly providerId: string;
  readonly template: ProviderEmailTemplate;
  readonly recipientUserId: string;
  readonly idempotencyKey: string;
  readonly reviewCycle?: number | null;
  readonly statusHistoryId?: string | null;
  readonly nextAttemptAt?: Date | null;
}

export interface ProviderRepositoryPort {
  findById(providerId: string): Promise<ProviderRecord | null>;
  findByApplicationOwnerUserId(
    userId: string,
  ): Promise<ProviderRecord | null>;
  listVisibleCandidatesForUser(input: {
    readonly userId: string;
    readonly includeMemberships: boolean;
    readonly limit: number;
    readonly cursorUpdatedAt?: Date;
    readonly cursorId?: string;
  }): Promise<readonly ProviderRecord[]>;
  lockById(providerId: string): Promise<ProviderRecord | null>;
  create(input: CreateProviderInput): Promise<ProviderRecord>;
  updateLifecycle(
    input: UpdateProviderLifecycleInput,
  ): Promise<ProviderRecord>;
  bumpVersion(input: {
    readonly providerId: string;
    readonly expectedVersion: ExpectedVersion;
  }): Promise<ProviderRecord>;

  getProfile(providerId: string): Promise<ProviderProfileRecord | null>;
  upsertProfile(
    input: UpsertProviderProfileInput,
  ): Promise<ProviderProfileRecord>;

  getContact(providerId: string): Promise<ProviderContactRecord | null>;
  upsertContact(
    input: UpsertProviderContactInput,
  ): Promise<ProviderContactRecord>;

  appendStatusHistory(
    input: AppendStatusHistoryInput,
  ): Promise<ProviderStatusHistoryRecord>;
  listStatusHistory(input: {
    readonly providerId: string;
    readonly limit: number;
    readonly cursorCreatedAt?: Date;
    readonly cursorId?: string;
  }): Promise<readonly ProviderStatusHistoryRecord[]>;
  countPendingInvitations(providerId: string): Promise<number>;

  findMember(input: {
    readonly providerId: string;
    readonly userId: string;
  }): Promise<ProviderMemberRecord | null>;
  listMembers(
    providerId: string,
  ): Promise<readonly ProviderMemberRecord[]>;
  upsertMember(
    input: UpsertProviderMemberInput,
  ): Promise<ProviderMemberRecord>;

  findInvitationById(
    invitationId: string,
  ): Promise<ProviderAdminInvitationRecord | null>;
  findInvitationByTokenVerifier(
    tokenVerifier: string,
  ): Promise<ProviderAdminInvitationRecord | null>;
  lockInvitationById(
    invitationId: string,
  ): Promise<ProviderAdminInvitationRecord | null>;
  findPendingInvitationByEmail(input: {
    readonly providerId: string;
    readonly emailNormalized: string;
  }): Promise<ProviderAdminInvitationRecord | null>;
  listInvitations(input: {
    readonly providerId: string;
    readonly status?: ProviderInvitationStatus;
    readonly limit: number;
    readonly cursorCreatedAt?: Date;
    readonly cursorId?: string;
  }): Promise<readonly ProviderAdminInvitationRecord[]>;
  createInvitation(
    input: CreateProviderInvitationInput,
  ): Promise<ProviderAdminInvitationRecord>;
  updateInvitation(input: {
    readonly invitationId: string;
    readonly expectedVersion: ExpectedVersion;
    readonly status?: ProviderInvitationStatus;
    readonly tokenVerifier?: string;
    readonly tokenVersion?: number;
    readonly expiresAt?: Date;
    readonly sentAt?: Date | null;
    readonly deliveryFailedAt?: Date | null;
    readonly lastSafeDeliveryErrorCode?: string | null;
    readonly acceptedByUserId?: string | null;
    readonly acceptedAt?: Date | null;
    readonly revokedAt?: Date | null;
    readonly expiredAt?: Date | null;
  }): Promise<ProviderAdminInvitationRecord>;
  countActiveAuthorityMemberships(userId: string): Promise<number>;
  /** Transaction-scoped per-user serialization for aggregate role reconciliation. */
  lockAuthorityReconciliationForUser(userId: string): Promise<void>;

  listGalleryItems(
    providerId: string,
  ): Promise<readonly ProviderGalleryItemRecord[]>;
  createGalleryItem(
    input: CreateGalleryItemInput,
  ): Promise<ProviderGalleryItemRecord>;
  deleteGalleryItem(input: {
    readonly providerId: string;
    readonly galleryItemId: string;
  }): Promise<void>;
  replaceGalleryPositions(input: {
    readonly providerId: string;
    readonly orderedGalleryItemIds: readonly string[];
  }): Promise<readonly ProviderGalleryItemRecord[]>;
}

export interface ProviderEmailOutboxRepositoryPort {
  insertIntent(
    input: CreateEmailOutboxIntentInput,
  ): Promise<ProviderEmailOutboxRecord>;
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ProviderEmailOutboxRecord | null>;
  claimBatch(input: {
    readonly now: Date;
    readonly batchSize: number;
    readonly leaseUntil: Date;
  }): Promise<readonly ProviderEmailOutboxRecord[]>;
  markSent(input: {
    readonly id: string;
    readonly sentAt: Date;
  }): Promise<ProviderEmailOutboxRecord>;
  markRetryOrFailed(input: {
    readonly id: string;
    readonly attemptCount: number;
    readonly status: Extract<ProviderEmailOutboxStatus, "PENDING" | "FAILED">;
    readonly nextAttemptAt: Date | null;
    readonly lastSafeErrorCode: string;
    readonly lockedUntil: Date | null;
  }): Promise<ProviderEmailOutboxRecord>;
}

export interface ProvidersUnitOfWorkPort {
  run<T>(
    work: (context: {
      readonly providers: ProviderRepositoryPort;
      readonly emailOutbox: ProviderEmailOutboxRepositoryPort;
      readonly identityAuthority: ProviderIdentityAuthorityWriterPort;
      readonly identityReader: ProviderIdentityReaderPort;
      readonly applicantProfiles: ProviderApplicantProfileReaderPort;
      readonly activeCountries: ActiveCountryReaderPort;
      readonly mediaReader: ProviderMediaReaderPort;
      readonly authorization: import("../../authentication/authentication.public.js").ProtectedOperationAuthorizer;
      readonly generalAudit: ProviderTransactionalAuditPort;
      readonly privilegedAudit: ProviderPrivilegedAuditPort;
    }) => Promise<T>,
  ): Promise<T>;
}

export interface StaffApplicationQueueFilters {
  readonly status?: ProviderApplicationStatus;
  readonly providerKind?: ProviderKind;
  readonly submittedFrom?: Date;
  readonly submittedTo?: Date;
  readonly cursor?: {
    readonly lastSubmittedAt: Date;
    readonly id: string;
  };
  readonly limit: number;
}

export interface StaffApplicationQueueItem {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: ProviderOperationalStatus;
  readonly reviewCycle: number;
  readonly version: number;
  readonly lastSubmittedAt: Date;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
}

export interface ProviderReviewRepositoryPort {
  listQueue(
    filters: StaffApplicationQueueFilters,
  ): Promise<readonly StaffApplicationQueueItem[]>;
}

export type { MarketplaceReadiness };

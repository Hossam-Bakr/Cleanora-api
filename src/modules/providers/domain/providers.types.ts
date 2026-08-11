/**
 * Provider domain enums and aggregate shapes for R1-P05.
 * Persistence mapping stays in infrastructure; services never return Prisma rows.
 */

export const PROVIDER_KINDS = ["INDIVIDUAL_TEAM", "REGISTERED_COMPANY"] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const PROVIDER_APPLICATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
] as const;
export type ProviderApplicationStatus =
  (typeof PROVIDER_APPLICATION_STATUSES)[number];

export const PROVIDER_OPERATIONAL_STATUSES = [
  "INACTIVE",
  "LIVE",
  "SUSPENDED",
] as const;
export type ProviderOperationalStatus =
  (typeof PROVIDER_OPERATIONAL_STATUSES)[number];

export const PROVIDER_STATUS_DOMAINS = ["APPLICATION", "OPERATIONAL"] as const;
export type ProviderStatusDomain = (typeof PROVIDER_STATUS_DOMAINS)[number];

export const PROVIDER_MEMBERSHIP_LEVELS = ["OWNER", "ADMIN"] as const;
export type ProviderMembershipLevel = (typeof PROVIDER_MEMBERSHIP_LEVELS)[number];

export const PROVIDER_MEMBERSHIP_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type ProviderMembershipStatus =
  (typeof PROVIDER_MEMBERSHIP_STATUSES)[number];

export const PROVIDER_INVITATION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
] as const;
export type ProviderInvitationStatus =
  (typeof PROVIDER_INVITATION_STATUSES)[number];

export const PROVIDER_GALLERY_KINDS = ["IMAGE", "VIDEO"] as const;
export type ProviderGalleryKind = (typeof PROVIDER_GALLERY_KINDS)[number];

export const PROVIDER_EMAIL_TEMPLATES = [
  "APPLICATION_SUBMITTED",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "REINSTATED",
] as const;
export type ProviderEmailTemplate = (typeof PROVIDER_EMAIL_TEMPLATES)[number];

export const PROVIDER_EMAIL_OUTBOX_STATUSES = [
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
] as const;
export type ProviderEmailOutboxStatus =
  (typeof PROVIDER_EMAIL_OUTBOX_STATUSES)[number];

export const PROVIDER_CONTACT_CHANNEL_TYPES = [
  "WHATSAPP",
  "SOCIAL",
  "WEBSITE",
  "EXTERNAL_BOOKING",
] as const;
export type ProviderContactChannelType =
  (typeof PROVIDER_CONTACT_CHANNEL_TYPES)[number];

export const PROFILE_COMPLETION_POLICY_VERSION = "r1-p05-v1" as const;

export const PROFILE_COMPLETION_CHECK_CODES = [
  "ELIGIBLE_CATEGORY_VERIFIED",
  "MATCHING_CUSTOMER_PROFILE_COMPLETE",
  "ARABIC_DISPLAY_NAME",
  "ARABIC_DESCRIPTION",
  "OPERATIONAL_EMAIL",
  "OPERATIONAL_PHONE",
  "ACTIVE_COUNTRY",
  "READY_LOGO",
  "READY_COVER",
  "MIN_READY_GALLERY_IMAGES",
] as const;
export type ProfileCompletionCheckCode =
  (typeof PROFILE_COMPLETION_CHECK_CODES)[number];

export const MARKETPLACE_READINESS_GATE_KEYS = [
  "profileComplete",
  "applicationApproved",
  "documentsVerified",
  "payoutDestinationReady",
  "workersReady",
  "servicesReady",
  "coverageReady",
  "availabilityReady",
  "capacityReady",
  "operationalLive",
  "eligibleForPublicBrowse",
] as const;
export type MarketplaceReadinessGateKey =
  (typeof MARKETPLACE_READINESS_GATE_KEYS)[number];

export const MARKETPLACE_READINESS_GATE_STATUSES = [
  "SATISFIED",
  "NOT_REQUIRED",
  "NOT_STARTED",
  "BLOCKED",
] as const;
export type MarketplaceReadinessGateStatus =
  (typeof MARKETPLACE_READINESS_GATE_STATUSES)[number];

/** Positive CAS token; callers must supply an integer >= 1. */
export type ExpectedVersion = number;

export interface ProviderContactChannel {
  readonly type: ProviderContactChannelType;
  readonly value: string;
}

export interface ProviderRecord {
  readonly id: string;
  readonly applicationOwnerUserId: string;
  readonly ownerUserId: string | null;
  readonly kind: ProviderKind;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: ProviderOperationalStatus;
  readonly reviewCycle: number;
  readonly version: number;
  readonly firstSubmittedAt: Date | null;
  readonly lastSubmittedAt: Date | null;
  readonly applicationChangedAt: Date;
  readonly operationalChangedAt: Date;
  readonly approvedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProviderProfileRecord {
  readonly id: string;
  readonly providerId: string;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly countryId: string | null;
  readonly logoMediaFileId: string | null;
  readonly coverMediaFileId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProviderContactRecord {
  readonly id: string;
  readonly providerId: string;
  readonly operationalEmailNormalized: string | null;
  readonly operationalPhoneE164: string | null;
  readonly channels: readonly ProviderContactChannel[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProviderStatusHistoryRecord {
  readonly id: string;
  readonly providerId: string;
  readonly domain: ProviderStatusDomain;
  readonly fromApplicationStatus: ProviderApplicationStatus | null;
  readonly toApplicationStatus: ProviderApplicationStatus | null;
  readonly fromOperationalStatus: ProviderOperationalStatus | null;
  readonly toOperationalStatus: ProviderOperationalStatus | null;
  readonly reviewCycle: number | null;
  readonly actorUserId: string;
  readonly reason: string | null;
  readonly requestId: string | null;
  readonly createdAt: Date;
}

export interface ProviderMemberRecord {
  readonly id: string;
  readonly providerId: string;
  readonly userId: string;
  readonly level: ProviderMembershipLevel;
  readonly status: ProviderMembershipStatus;
  readonly invitedByUserId: string | null;
  readonly enabledAt: Date;
  readonly disabledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProviderAdminInvitationRecord {
  readonly id: string;
  readonly providerId: string;
  readonly emailNormalized: string;
  readonly tokenVerifier: string;
  readonly tokenVersion: number;
  readonly status: ProviderInvitationStatus;
  readonly version: number;
  readonly invitedByUserId: string;
  readonly acceptedByUserId: string | null;
  readonly expiresAt: Date;
  readonly sentAt: Date | null;
  readonly deliveryFailedAt: Date | null;
  readonly lastSafeDeliveryErrorCode: string | null;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly expiredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProviderGalleryItemRecord {
  readonly id: string;
  readonly providerId: string;
  readonly mediaFileId: string;
  readonly kind: ProviderGalleryKind;
  readonly position: number;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProviderEmailOutboxRecord {
  readonly id: string;
  readonly providerId: string;
  readonly template: ProviderEmailTemplate;
  readonly status: ProviderEmailOutboxStatus;
  readonly recipientUserId: string;
  readonly reviewCycle: number | null;
  readonly statusHistoryId: string | null;
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly nextAttemptAt: Date | null;
  readonly lockedUntil: Date | null;
  readonly sentAt: Date | null;
  readonly lastSafeErrorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProfileCompletionCheck {
  readonly code: ProfileCompletionCheckCode;
  readonly satisfied: boolean;
}

export interface ProfileCompletion {
  readonly policyVersion: typeof PROFILE_COMPLETION_POLICY_VERSION;
  readonly percentage: number;
  readonly checks: readonly ProfileCompletionCheck[];
  readonly missingRequirementCodes: readonly ProfileCompletionCheckCode[];
}

export interface MarketplaceReadinessGate {
  readonly key: MarketplaceReadinessGateKey;
  readonly applicable: boolean;
  readonly status: MarketplaceReadinessGateStatus;
  readonly satisfied: boolean;
  readonly blockerCodes: readonly string[];
  readonly owningPhase: string;
}

export interface MarketplaceReadiness {
  readonly gates: readonly MarketplaceReadinessGate[];
  readonly eligibleForPublicBrowse: false;
}

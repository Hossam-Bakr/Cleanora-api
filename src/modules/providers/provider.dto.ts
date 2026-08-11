import type {
  MarketplaceReadiness,
  ProfileCompletion,
  ProviderContactChannel,
  ProviderContactRecord,
  ProviderKind,
  ProviderApplicationStatus,
  ProviderOperationalStatus,
  ProviderRecord,
  ProviderProfileRecord,
} from "./domain/providers.types.js";
import type { ProviderActorRelationship } from "./domain/provider-authorization.policy.js";

export interface ProviderSummaryDto {
  readonly id: string;
  readonly providerKind: ProviderKind;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: ProviderOperationalStatus;
  readonly version: number;
  readonly actorRelationship: Extract<
    ProviderActorRelationship,
    "APPLICATION_OWNER" | "OWNER" | "ADMIN"
  >;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
  readonly completionPercentage: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProviderApplicantContextDto {
  readonly category: "INDIVIDUAL" | "COMPANY";
  readonly individualFullName: string | null;
  readonly companyName: string | null;
  readonly representativeFullName: string | null;
}

/**
 * Private aggregate for authorized Application Owner / member / Staff reads.
 * Contacts, storage keys, and tokens are never included.
 */
export interface ProviderPrivateAggregateDto {
  readonly provider: ProviderSummaryDto;
  readonly applicantContext: ProviderApplicantContextDto;
  readonly completion: ProfileCompletion;
  readonly readiness: MarketplaceReadiness;
}

export function toIso(value: Date): string {
  return value.toISOString();
}

export function mapProviderSummary(input: {
  readonly provider: ProviderRecord;
  readonly profile: ProviderProfileRecord | null;
  readonly actorRelationship: Extract<
    ProviderActorRelationship,
    "APPLICATION_OWNER" | "OWNER" | "ADMIN"
  >;
  readonly completionPercentage: number;
}): ProviderSummaryDto {
  return {
    id: input.provider.id,
    providerKind: input.provider.kind,
    applicationStatus: input.provider.applicationStatus,
    operationalStatus: input.provider.operationalStatus,
    version: input.provider.version,
    actorRelationship: input.actorRelationship,
    displayNameAr: input.profile?.displayNameAr ?? null,
    displayNameEn: input.profile?.displayNameEn ?? null,
    completionPercentage: input.completionPercentage,
    createdAt: toIso(input.provider.createdAt),
    updatedAt: toIso(input.provider.updatedAt),
  };
}

export function mapApplicantContext(input: {
  readonly category: "INDIVIDUAL" | "COMPANY";
  readonly individualFullName: string | null;
  readonly companyName: string | null;
  readonly representativeFullName: string | null;
}): ProviderApplicantContextDto {
  return {
    category: input.category,
    individualFullName: input.individualFullName,
    companyName: input.companyName,
    representativeFullName: input.representativeFullName,
  };
}

export function mapPrivateAggregate(input: {
  readonly summary: ProviderSummaryDto;
  readonly applicantContext: ProviderApplicantContextDto;
  readonly completion: ProfileCompletion;
  readonly readiness: MarketplaceReadiness;
}): ProviderPrivateAggregateDto {
  return {
    provider: input.summary,
    applicantContext: input.applicantContext,
    completion: input.completion,
    readiness: input.readiness,
  };
}

/** Safe media slot/gallery projection — never includes storage ids or secrets. */
export interface ProviderMediaAssetDto {
  readonly mediaId: string;
  readonly purpose?: "LOGO" | "COVER";
  readonly galleryItemId?: string;
  readonly kind?: "IMAGE" | "VIDEO";
  readonly position?: number;
  readonly status: string;
  readonly contentType: string | null;
  readonly byteSize: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly deliveryUrl: string | null;
  readonly urlExpiresAt: string | null;
  readonly thumbnailUrl: string | null;
}

export interface ProviderMediaUsageDto {
  readonly galleryImageCount: number;
  readonly galleryVideoCount: number;
  readonly galleryImageLimit: number;
  readonly galleryVideoLimit: number;
  readonly readyGalleryImageCount: number;
}

export interface ProviderMediaProjectionDto {
  readonly providerId: string;
  readonly version: number;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly canEdit: boolean;
  readonly logo: ProviderMediaAssetDto | null;
  readonly cover: ProviderMediaAssetDto | null;
  readonly gallery: readonly ProviderMediaAssetDto[];
  readonly usage: ProviderMediaUsageDto;
  readonly completion: ProfileCompletion;
  readonly readiness: MarketplaceReadiness;
}

export function mapProviderMediaProjection(input: {
  readonly providerId: string;
  readonly version: number;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly canEdit: boolean;
  readonly logo: ProviderMediaAssetDto | null;
  readonly cover: ProviderMediaAssetDto | null;
  readonly gallery: readonly ProviderMediaAssetDto[];
  readonly usage: ProviderMediaUsageDto;
  readonly completion: ProfileCompletion;
  readonly readiness: MarketplaceReadiness;
}): ProviderMediaProjectionDto {
  return {
    providerId: input.providerId,
    version: input.version,
    applicationStatus: input.applicationStatus,
    canEdit: input.canEdit,
    logo: input.logo,
    cover: input.cover,
    gallery: input.gallery,
    usage: input.usage,
    completion: input.completion,
    readiness: input.readiness,
  };
}

export interface ProviderEditableProfileDto {
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly countryCode: string | null;
  readonly version: number;
}

export interface ProviderPrivateContactsDto {
  readonly operationalEmail: string | null;
  readonly operationalPhone: string | null;
  readonly channels: readonly ProviderContactChannel[];
  readonly version: number;
}

/**
 * Allowlisted contact-free preview. Never include email/phone/channels,
 * applicant identity names, members, storage ids, or secrets.
 */
export interface ProviderPreviewDto {
  readonly providerId: string;
  readonly providerKind: ProviderKind;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly countryCode: string | null;
  readonly logo: null;
  readonly cover: null;
  readonly gallery: readonly [];
}

/** Safe eligibility denial payload — codes and recovery hints only (FR-012, FR-086). */
export interface ProviderEligibilityDenialDto {
  readonly denialCodes: readonly string[];
  readonly recoveryHints: readonly string[];
}

export function mapEligibilityDenial(input: {
  readonly denialCodes: readonly string[];
  readonly recoveryHints: readonly string[];
}): ProviderEligibilityDenialDto {
  return {
    denialCodes: [...input.denialCodes],
    recoveryHints: [...input.recoveryHints],
  };
}

/** Stable allowlist used by inventory tests and public-contract projections. */
export const PROVIDER_PREVIEW_FIELD_ALLOWLIST = [
  "providerId",
  "providerKind",
  "displayNameAr",
  "displayNameEn",
  "descriptionAr",
  "descriptionEn",
  "countryCode",
  "logo",
  "cover",
  "gallery",
] as const;

export const PROVIDER_PREVIEW_FORBIDDEN_MARKERS = [
  "operationalEmail",
  "operationalPhone",
  "channels",
  "whatsapp",
  "WHATSAPP",
  "SOCIAL",
  "WEBSITE",
  "EXTERNAL_BOOKING",
  "applicantContext",
  "individualFullName",
  "companyName",
  "representativeFullName",
  "storageKey",
  "mediaFileId",
  "logoMediaFileId",
  "coverMediaFileId",
  "email",
  "phone",
] as const;

export function mapEditableProfile(input: {
  readonly profile: ProviderProfileRecord | null;
  readonly countryCode: string | null;
  readonly version: number;
}): ProviderEditableProfileDto {
  return {
    displayNameAr: input.profile?.displayNameAr ?? null,
    displayNameEn: input.profile?.displayNameEn ?? null,
    descriptionAr: input.profile?.descriptionAr ?? null,
    descriptionEn: input.profile?.descriptionEn ?? null,
    countryCode: input.countryCode,
    version: input.version,
  };
}

export function mapPrivateContacts(input: {
  readonly contact: ProviderContactRecord | null;
  readonly operationalEmail: string | null;
  readonly operationalPhone: string | null;
  readonly version: number;
}): ProviderPrivateContactsDto {
  return {
    operationalEmail: input.operationalEmail,
    operationalPhone: input.operationalPhone,
    channels: input.contact?.channels ?? [],
    version: input.version,
  };
}

/**
 * Single allowlisted contact-free preview mapper for protected preview and
 * future public-contract projections (FR-036–FR-039, FR-086; SC-004).
 */
export function mapProviderPreview(input: {
  readonly provider: {
    readonly id: string;
    readonly kind: ProviderKind;
  };
  readonly profile: {
    readonly displayNameAr: string | null;
    readonly displayNameEn: string | null;
    readonly descriptionAr: string | null;
    readonly descriptionEn: string | null;
  } | null;
  readonly countryCode: string | null;
}): ProviderPreviewDto {
  return {
    providerId: input.provider.id,
    providerKind: input.provider.kind,
    displayNameAr: input.profile?.displayNameAr ?? null,
    displayNameEn: input.profile?.displayNameEn ?? null,
    descriptionAr: input.profile?.descriptionAr ?? null,
    descriptionEn: input.profile?.descriptionEn ?? null,
    countryCode: input.countryCode,
    logo: null,
    cover: null,
    gallery: [],
  };
}

/** Alias kept for public-contract imports. */
export const mapContactFreeProviderPreview = mapProviderPreview;

const PRIVATE_CONTACT_DETAIL_KEYS = new Set([
  "operationalEmail",
  "operationalPhone",
  "channels",
  "email",
  "phone",
  "whatsapp",
  "value",
]);

/**
 * Strip private contact payloads from error details before logging/HTTP.
 */
export function redactPrivateContactDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  if (details === undefined) {
    return undefined;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (PRIVATE_CONTACT_DETAIL_KEYS.has(key)) {
      continue;
    }
    if (typeof value === "string" && /@|\+\d{6,}/u.test(value)) {
      continue;
    }
    redacted[key] = value;
  }
  return redacted;
}

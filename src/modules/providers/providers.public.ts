/**
 * Public cross-module contract for later approved phases.
 * Contact-free preview projections reuse the Providers allowlisted mapper.
 */
import {
  mapContactFreeProviderPreview,
  PROVIDER_PREVIEW_FIELD_ALLOWLIST,
  PROVIDER_PREVIEW_FORBIDDEN_MARKERS,
  type ProviderPreviewDto,
} from "./provider.dto.js";

export const PROVIDERS_PUBLIC_CONTRACT = "providers.public";

export interface ProviderR1P06ReadinessFacts {
  readonly providerId: string;
  readonly documentsVerified: {
    readonly applicable: boolean;
    readonly status: "NOT_REQUIRED" | "NOT_STARTED" | "BLOCKED" | "SATISFIED";
    readonly satisfied: boolean;
    readonly blockerCodes: readonly string[];
  };
  readonly payoutDestinationReady: boolean;
  readonly verificationBadge: "NOT_ELIGIBLE" | "NOT_EARNED" | "EARNED";
}

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
  getBookingSafeTeamFacts(input: {
    readonly providerId: string;
    readonly teamId: string;
  }): Promise<BookingSafeTeamFacts | null>;
}

export type ProviderApplicationStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED";

export type ProviderOperationalStatus = "INACTIVE" | "LIVE" | "SUSPENDED";

export type ProviderKind = "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY";

export type ProviderMembershipLevel = "OWNER" | "ADMIN";
export type ProviderMembershipStatus = "ACTIVE" | "DISABLED";

export interface MarketplaceReadinessGate {
  readonly code: string;
  readonly status: "SATISFIED" | "NOT_REQUIRED" | "NOT_STARTED" | "BLOCKED";
  readonly applicable: boolean;
  readonly satisfied: boolean;
  readonly blockerCodes: readonly string[];
  readonly owningPhase: string;
}

export interface MarketplaceReadiness {
  readonly gates: readonly MarketplaceReadinessGate[];
  readonly eligibleForPublicBrowse: false;
}

/**
 * Contact-free preview projection shared with later Browse/Details phases.
 * Never includes email, phone, WhatsApp, social, website, or booking paths.
 */
export type ProviderContactFreePreview = ProviderPreviewDto;

export {
  mapContactFreeProviderPreview,
  PROVIDER_PREVIEW_FIELD_ALLOWLIST,
  PROVIDER_PREVIEW_FORBIDDEN_MARKERS,
};

export function projectContactFreeProviderPreview(input: {
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
}): ProviderContactFreePreview {
  return mapContactFreeProviderPreview(input);
}

export interface ProviderPublicReader {
  getProviderIdentity(providerId: string): Promise<{
    providerId: string;
    kind: ProviderKind;
    ownerUserId: string | null;
    applicationStatus: ProviderApplicationStatus;
    operationalStatus: ProviderOperationalStatus;
  } | null>;

  getMembershipScope(input: {
    userId: string;
    providerId: string;
  }): Promise<{
    providerId: string;
    level: ProviderMembershipLevel;
    status: ProviderMembershipStatus;
  } | null>;

  getMarketplaceReadiness(
    providerId: string,
  ): Promise<MarketplaceReadiness | null>;

  /**
   * Optional protected/public projection hook. Implementations MUST use the
   * contact-free allowlisted mapper and MUST NOT expose private contacts.
   */
  getContactFreePreview?(
    providerId: string,
  ): Promise<ProviderContactFreePreview | null>;
}

/** Stub reader used until Provider repositories are composed. */
export function createUnavailableProviderPublicReader(): ProviderPublicReader {
  return {
    async getProviderIdentity() {
      return null;
    },
    async getMembershipScope() {
      return null;
    },
    async getMarketplaceReadiness() {
      return null;
    },
    async getContactFreePreview() {
      return null;
    },
  };
}

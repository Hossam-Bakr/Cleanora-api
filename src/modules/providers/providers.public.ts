/**
 * Public cross-module contract for later approved phases.
 * Contact-free preview projections reuse the Providers allowlisted mapper.
 */
import type { SnapshotReadyCatalogServiceDefinition } from "#modules/catalog/catalog.public";

import {
  mapBookingSafeTeamFactsToCrewSummary,
  mapContactFreeProviderPreview,
  PROVIDER_PREVIEW_FIELD_ALLOWLIST,
  PROVIDER_PREVIEW_FORBIDDEN_MARKERS,
  type ProviderPreviewDto,
  type ProviderCrewSummaryDto,
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

export type ProviderServicesReadyBlockerCode =
  | "NO_PROVIDER_SERVICES"
  | "NO_ENABLED_PROVIDER_SERVICE"
  | "CATALOG_SERVICE_UNAVAILABLE"
  | "PRICE_UNIT_UNAVAILABLE"
  | "NO_EFFECTIVE_PRICE"
  | "PRICE_APPROVAL_PENDING"
  | "OFFERING_CONFIGURATION_INVALID";

export interface ProviderServicesReadyFacts {
  readonly providerId: string;
  readonly servicesReady: boolean;
  readonly qualifyingOfferingCount: number;
  readonly blockerCodes: readonly ProviderServicesReadyBlockerCode[];
}

export interface ProviderServicesReadyFactsReader {
  getServicesReady(
    providerId: string,
  ): Promise<ProviderServicesReadyFacts | null>;
}

export type ProviderServiceExactLocale = "AR" | "EN";

export interface ProviderServiceSnapshotReadyValue {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServiceVersion: number;
  readonly catalogServiceId: string;
  readonly catalogServiceCode: string;
  readonly catalogServiceVersion: number;
  readonly estimatedDurationMinutes: number;
  readonly serviceNote: string | null;
  readonly providerServicePriceId: string;
  readonly price: string;
  readonly minimumCharge: string;
  readonly currencyCode: string;
  readonly effectiveAt: string;
  readonly priceUnit: {
    readonly id: string;
    readonly code: string;
    readonly label: string;
  };
  readonly catalogDefinition: SnapshotReadyCatalogServiceDefinition;
}

export type ProviderServiceSnapshotReadyResult =
  | {
      readonly status: "AVAILABLE";
      readonly value: ProviderServiceSnapshotReadyValue;
    }
  | { readonly status: "UNAVAILABLE" }
  | {
      readonly status: "CONFLICT";
      readonly code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT";
    };

export interface ProviderServiceSnapshotReader {
  getSnapshotReadyFacts(input: {
    readonly providerId: string;
    readonly catalogServiceCode: string;
    readonly countryCode: string;
    readonly locale: ProviderServiceExactLocale;
  }): Promise<ProviderServiceSnapshotReadyResult>;
}

/**
 * @desc Narrow public factory for composition-authorized servicesReady readers.
 * @access Public contract
 */
export function createProviderServicesReadyFactsReader(
  source: ProviderServicesReadyFactsReader,
): ProviderServicesReadyFactsReader {
  return {
    getServicesReady: (providerId) => source.getServicesReady(providerId),
  };
}

/**
 * @desc Narrow public factory for composition-authorized snapshot readers.
 * @access Public contract
 * @explanation Never exposes repositories, Prisma clients, or HTTP adapters.
 */
export function createProviderServiceSnapshotReader(
  source: ProviderServiceSnapshotReader,
): ProviderServiceSnapshotReader {
  return {
    getSnapshotReadyFacts: (input) => source.getSnapshotReadyFacts(input),
  };
}

export type ProviderOperationalAvailabilityBlockerCode =
  | "TEXTUAL_AREA_INACTIVE_OR_MISMATCH"
  | "PROVIDER_COVERAGE_MISMATCH"
  | "PROVIDER_NOT_LIVE"
  | "PROVIDER_SCHEDULE_CLOSED"
  | "SUSPENDED"
  | "PAUSE"
  | "CAPACITY_RULE_MISSING"
  | "PROVIDER_COUNTRY_MISSING"
  | "COUNTRY_TIME_ZONE_MISSING"
  | "WORKER_TEAM_UNAVAILABLE"
  | "INSUFFICIENT_TEAM_UNITS";

export interface ProviderOperationalAvailabilityLocationInput {
  readonly countryId: string;
  readonly cityId: string;
  readonly districtId?: string;
}

export interface ProviderOperationalAvailabilityEvaluation {
  readonly providerId: string;
  readonly timeZone: string | null;
  readonly coverageMatch: {
    readonly matched: boolean;
    readonly countryId: string | null;
    readonly cityId: string | null;
    readonly districtId: string | null;
    readonly matchedBy: "CITY" | "DISTRICT" | null;
  };
  readonly availability: {
    readonly available: boolean;
    readonly runtimeAvailable: boolean;
    readonly providerScheduleAvailable: boolean;
  };
  readonly capacity: {
    readonly availableUnits: number;
    readonly requiredCompleteTeamUnits: number;
    readonly sufficient: boolean;
  };
  readonly blockerCodes: readonly ProviderOperationalAvailabilityBlockerCode[];
  readonly versions: {
    readonly availability: number;
    readonly workforce: number;
    readonly capacity: number;
  };
}

export interface ProviderOperationalAvailabilityReader {
  findCandidateProviderIdsForActiveTextualArea(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
  }): Promise<readonly string[]>;

  evaluateOneProviderOperationalAvailability(input: {
    readonly providerId: string;
    readonly districtId?: string;
    readonly location?: ProviderOperationalAvailabilityLocationInput;
    readonly utcInterval: {
      readonly startsAt: string;
      readonly endsAt: string;
    };
    readonly requiredCompleteTeamUnits: number;
  }): Promise<ProviderOperationalAvailabilityEvaluation | null>;
}

/**
 * @desc Narrow public factory for internal candidate/evaluation readers.
 * @explanation Exposes only Provider ids and operational facts; no Worker
 * contacts, Provider settings, persistence rows, HTTP adapters, or Booking
 * reservation behavior cross the module boundary.
 */
export function createProviderOperationalAvailabilityReader(
  source: ProviderOperationalAvailabilityReader,
): ProviderOperationalAvailabilityReader {
  return {
    findCandidateProviderIdsForActiveTextualArea: (input) =>
      source.findCandidateProviderIdsForActiveTextualArea(input),
    evaluateOneProviderOperationalAvailability: (input) =>
      source.evaluateOneProviderOperationalAvailability(input),
  };
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
  mapBookingSafeTeamFactsToCrewSummary,
  mapContactFreeProviderPreview,
  PROVIDER_PREVIEW_FIELD_ALLOWLIST,
  PROVIDER_PREVIEW_FORBIDDEN_MARKERS,
};
export type { ProviderCrewSummaryDto };

export interface ProviderBrowseReader {
  getContactFreePreview(
    providerId: string,
    options?: { readonly includeMedia?: boolean },
  ): Promise<ProviderContactFreePreview | null>;
  getBookingSafeTeamFacts(input: {
    readonly providerId: string;
    readonly teamId: string;
  }): Promise<BookingSafeTeamFacts | null>;
}

/**
 * @desc Expose the narrow Providers read surface needed by Bookings Browse.
 * @access Composition-injected public contract
 */
export function createProviderBrowseReader(
  preview: Pick<ProviderPublicReader, "getContactFreePreview">,
  workforce: Pick<ProviderWorkforcePublicReader, "getBookingSafeTeamFacts">,
): ProviderBrowseReader {
  return {
    async getContactFreePreview(providerId, options) {
      return (await preview.getContactFreePreview?.(providerId, options)) ?? null;
    },
    getBookingSafeTeamFacts: (input) =>
      workforce.getBookingSafeTeamFacts(input),
  };
}

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
    options?: { readonly includeMedia?: boolean },
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

/** Opaque transaction handle shared with Eligibility (DEC-079). */
export type ProvidersEligibilityTransactionContext = unknown;

// --- R1-P11 Eligibility projections (DEC-084 / dependency-readers.md) ---

export type EligibilityPricingFacts =
  | {
      readonly status: "AVAILABLE";
      readonly providerId: string;
      readonly serviceId: string;
      readonly priceAmount: string;
      readonly minimumChargeAmount: string;
      readonly currencyCode: string;
      readonly priceUnitId: string;
      readonly estimatedDurationMinutes: number;
      readonly sourceVersion: string;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly providerId: string;
      readonly serviceId: string;
      readonly reason: "OFFERING_OR_PRICE_UNAVAILABLE";
      readonly sourceVersion: string | null;
    };

export interface EligibilityPricingReader {
  getEligibilityPricingFacts(input: {
    readonly providerId: string;
    readonly serviceId: string;
    readonly countryId: string;
  }): Promise<EligibilityPricingFacts>;
}

export type TransactionalEligibilityPricingReaderFactory = (
  tx: ProvidersEligibilityTransactionContext,
) => EligibilityPricingReader;

/**
 * @desc Narrow public factory for Eligibility pricing projections.
 * @access Public contract
 */
export function createEligibilityPricingReader(
  source: EligibilityPricingReader,
): EligibilityPricingReader {
  return {
    getEligibilityPricingFacts: (input) =>
      source.getEligibilityPricingFacts(input),
  };
}

/**
 * @desc Pass-through for composition-supplied tx-bound Eligibility pricing.
 * @access Public contract
 */
export function createTransactionalEligibilityPricingReaderFactory(
  createBoundReader: TransactionalEligibilityPricingReaderFactory,
): TransactionalEligibilityPricingReaderFactory {
  return (tx) => createEligibilityPricingReader(createBoundReader(tx));
}

export type EligibilityProviderLifecycleFacts =
  | {
      readonly status: "MISSING";
      readonly providerId: string;
    }
  | {
      readonly status: "PRESENT";
      readonly providerId: string;
      readonly approved: boolean;
      readonly live: boolean;
      readonly suspended: boolean;
      readonly verificationSatisfiedOrNotRequired: boolean;
      readonly aggregateVersion: string;
    };

export interface EligibilityProviderLifecycleReader {
  getLifecycleFacts(
    providerId: string,
  ): Promise<EligibilityProviderLifecycleFacts>;
}

export type TransactionalEligibilityProviderLifecycleReaderFactory = (
  tx: ProvidersEligibilityTransactionContext,
  context?: { readonly evaluatedAt: Date },
) => EligibilityProviderLifecycleReader;

/**
 * @desc Narrow public factory for Eligibility lifecycle projections.
 * @access Public contract
 */
export function createEligibilityProviderLifecycleReader(
  source: EligibilityProviderLifecycleReader,
): EligibilityProviderLifecycleReader {
  return {
    getLifecycleFacts: (providerId) => source.getLifecycleFacts(providerId),
  };
}

/**
 * @desc Pass-through for composition-supplied tx-bound Eligibility lifecycle.
 * @access Public contract
 */
export function createTransactionalEligibilityProviderLifecycleReaderFactory(
  createBoundReader: TransactionalEligibilityProviderLifecycleReaderFactory,
): TransactionalEligibilityProviderLifecycleReaderFactory {
  return (tx, context) =>
    createEligibilityProviderLifecycleReader(createBoundReader(tx, context));
}

export interface EligibilityTeamAvailabilityFacts {
  readonly teamId: string;
  readonly structurallyValid: boolean;
  readonly membersAvailableForWholeInterval: boolean;
  readonly cleanerGenderCounts: {
    readonly male: number;
    readonly female: number;
    readonly otherOrUnspecified: number;
  };
  readonly escortFacts: {
    readonly escortRequired: boolean;
    readonly escortPresentAndValid: boolean;
    readonly escortsAvailableForWholeInterval: boolean;
  };
}

export type EligibilityMissingConfigurationKind =
  | "COVERAGE"
  | "PROVIDER_SCHEDULE"
  | "CAPACITY_RULE";

export interface EligibilityReadableAvailabilityFacts {
  readonly providerId: string;
  readonly coverageMatch: boolean;
  readonly providerScheduleAvailable: boolean;
  readonly paused: boolean;
  readonly suspended: boolean;
  readonly simultaneousTeamLimit: number | null;
  readonly teams: readonly EligibilityTeamAvailabilityFacts[];
}

export type EligibilityProviderAvailabilityFacts =
  | ({
      readonly status: "MISSING_CONFIGURATION";
      readonly missingConfiguration: readonly EligibilityMissingConfigurationKind[];
    } & EligibilityReadableAvailabilityFacts)
  | ({
      readonly status: "AVAILABLE_FACTS";
      readonly simultaneousTeamLimit: number;
    } & Omit<EligibilityReadableAvailabilityFacts, "simultaneousTeamLimit">)
  | {
      readonly status: "OVERFLOW";
      readonly providerId: string;
      readonly acceptedTeams: readonly EligibilityTeamAvailabilityFacts[];
    };

export interface EligibilityAvailabilityReader {
  discoverProviderIds(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    readonly limit: number;
  }): Promise<
    | { readonly status: "OK"; readonly providerIds: readonly string[] }
    | { readonly status: "OVERFLOW" }
  >;

  getAvailabilityFacts(input: {
    readonly providerId: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    readonly remainingTeamBudget: number;
  }): Promise<EligibilityProviderAvailabilityFacts>;
}

export type TransactionalEligibilityAvailabilityReaderFactory = (
  tx: ProvidersEligibilityTransactionContext,
) => EligibilityAvailabilityReader;

/**
 * @desc Narrow public factory for Eligibility availability projections.
 * @access Public contract
 */
export function createEligibilityAvailabilityReader(
  source: EligibilityAvailabilityReader,
): EligibilityAvailabilityReader {
  return {
    discoverProviderIds: (input) => source.discoverProviderIds(input),
    getAvailabilityFacts: (input) => source.getAvailabilityFacts(input),
  };
}

/**
 * @desc Pass-through for composition-supplied tx-bound Eligibility availability.
 * @access Public contract
 */
export function createTransactionalEligibilityAvailabilityReaderFactory(
  createBoundReader: TransactionalEligibilityAvailabilityReaderFactory,
): TransactionalEligibilityAvailabilityReaderFactory {
  return (tx) => createEligibilityAvailabilityReader(createBoundReader(tx));
}

export { createBoundEligibilityPricingReader } from "./eligibility-pricing.reader.js";
export { createBoundEligibilityProviderLifecycleReader } from "./eligibility-lifecycle.reader.js";
export { createBoundEligibilityAvailabilityReader } from "./eligibility-availability.reader.js";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import type {
  CatalogDefinitionReader,
  CatalogLocale,
  SelectableCatalogServiceSummary,
  SnapshotReadyCatalogServiceDefinition,
} from "#modules/catalog/catalog.public";
import type {
  ActiveCityProjection,
  ActiveDistrictProjection,
  LocalityReader,
} from "#modules/configuration/configuration.public";
import type {
  BrowseSafeProjection,
  EligibilityApplicationService,
} from "#modules/eligibility/eligibility.public";
import type {
  ProviderContactFreePreview,
  ProviderCrewSummaryDto,
  ProviderServiceSnapshotReader,
} from "#modules/providers/providers.public";

import type { BrowseProvidersQuery } from "./bookings.schema.js";

export const BOOKINGS_PUBLIC_CONTRACT = "bookings.public" as const;

export const BOOKING_PREREQUISITES = {
  bookingAvailable: false,
  requiresVerifiedCustomer: true,
  phase: "R1-P13",
} as const;

export interface BrowseProviderListItem {
  readonly providerId: string;
  readonly teamId: string;
  readonly displayName: string | null;
  readonly thumb: ProviderContactFreePreview["logo"];
  readonly sortingFacts: BrowseSafeProjection["candidates"][number]["sortingFacts"];
}

export interface BrowseProviderListResult {
  readonly items: readonly BrowseProviderListItem[];
  readonly nextCursor: string | null;
  readonly metadata: {
    readonly resultHash: string;
    readonly ruleVersionId: string;
    readonly evaluatedAt: string;
  };
  /** EX-02: browse never creates bookings or payments. */
  readonly sideEffects: {
    readonly bookingCreated: false;
    readonly paymentInitiated: false;
  };
}

export interface BrowseProviderDetailResult {
  readonly providerId: string;
  readonly teamId: string;
  readonly profile: ProviderContactFreePreview;
  readonly crewSummary: ProviderCrewSummaryDto;
  readonly servicePrice:
    | {
        readonly status: "AVAILABLE";
        readonly priceAmount: string;
        readonly minimumChargeAmount: string;
        readonly currencyCode: string;
        readonly priceUnitId: string;
        readonly estimatedDurationMinutes: number;
      }
    | { readonly status: "UNAVAILABLE" };
  readonly ratingSummary: null;
  readonly bookingPrerequisites: {
    readonly bookingAvailable: boolean;
    readonly requiresVerifiedCustomer: true;
    readonly phase: "R1-P13";
  };
  readonly sideEffects: {
    readonly bookingCreated: false;
    readonly paymentInitiated: false;
  };
}

export interface BookingsBrowseReader {
  listServices(input: {
    readonly countryCode: string;
    readonly locale: CatalogLocale;
    readonly cursor?: string;
    readonly limit: number;
  }): Promise<{
    readonly items: readonly SelectableCatalogServiceSummary[];
    readonly nextCursor: string | null;
  }>;
  getService(input: {
    readonly serviceId: string;
    readonly countryCode: string;
    readonly locale: CatalogLocale;
  }): Promise<SnapshotReadyCatalogServiceDefinition>;
  listCities(countryCode: string): Promise<readonly ActiveCityProjection[]>;
  listDistricts(input: {
    readonly countryCode: string;
    readonly cityId: string;
  }): Promise<readonly ActiveDistrictProjection[]>;
  listEligibleProviders(
    query: BrowseProvidersQuery,
  ): Promise<BrowseProviderListResult>;
  getEligibleProviderDetail(input: {
    readonly providerId: string;
    readonly teamId: string;
    readonly query: BrowseProvidersQuery | Omit<
      BrowseProvidersQuery,
      "maxPriceAmount" | "q" | "limit" | "cursor"
    >;
    readonly principal?: AuthenticationPrincipal | null;
  }): Promise<BrowseProviderDetailResult>;
  getProviderPreview(
    providerId: string,
  ): Promise<ProviderContactFreePreview | null>;
  getCrewSummary(input: {
    readonly providerId: string;
    readonly teamId: string;
  }): Promise<ProviderCrewSummaryDto | null>;
}

export interface BookingsBrowseDependencies {
  readonly eligibility: Pick<
    EligibilityApplicationService,
    "getStandardBrowseCandidates"
  >;
  readonly catalog: CatalogDefinitionReader;
  readonly locality: Pick<
    LocalityReader,
    "listActiveCitiesForCountry" | "listActiveDistrictsForCity"
  >;
  readonly providers: {
    getContactFreePreview(
      providerId: string,
      options?: { readonly includeMedia?: boolean },
    ): Promise<ProviderContactFreePreview | null>;
    getBookingSafeTeamFacts(input: {
      readonly providerId: string;
      readonly teamId: string;
    }): Promise<import("#modules/providers/providers.public").BookingSafeTeamFacts | null>;
  };
  readonly serviceSnapshots?: ProviderServiceSnapshotReader;
  readonly activeCountries: {
    resolveActiveCountry(
      countryCode: string,
    ): Promise<{ readonly id: string; readonly code: string }>;
    getActiveCountryById(
      countryId: string,
    ): Promise<{ readonly id: string; readonly code: string } | null>;
  };
  readonly cursorSecret: string;
}

export interface BookingFinancialSnapshot {
  readonly bookingId: string;
  readonly status: "DRAFT" | "AWAITING_DEPOSIT" | "CONFIRMED" | "CANCELLED";
  readonly countryId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly providerId: string;
  readonly grossMinorUnits: string | null;
  readonly depositMinorUnits: string | null;
  readonly remainderMinorUnits: string | null;
}

export interface BookingFinancialSnapshotReader {
  readById(input: {
    readonly bookingId: string;
  }): Promise<BookingFinancialSnapshot | null>;
}

export { createPrismaBookingFinancialSnapshotReader } from "./infrastructure/prisma-booking-financial-snapshot.reader.js";

import { createPrismaActiveCountryReader } from "./infrastructure/prisma-active-country.reader.js";
import { createPrismaProviderServicePricingPolicyReader, createPrismaProviderServiceCountryIdentityReader } from "./infrastructure/prisma-provider-service-pricing-policy.reader.js";
import { createPrismaLocalityRepository } from "./infrastructure/prisma-locality.repository.js";
import { isRecognizedIanaTimeZone } from "./time-zone.js";

export interface ProviderServiceCountryIdentityReader {
  getCountryCodeById(countryId: string): Promise<string | null>;
}

/** Resolve identity only; current country/currency validity stays with the pricing policy. */
export function createTransactionalProviderServiceCountryIdentityReader(transaction: unknown): ProviderServiceCountryIdentityReader {
  return createPrismaProviderServiceCountryIdentityReader(transaction);
}

/**
 * Approved public surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * repositories or internal configuration helpers.
 */
export const CONFIGURATION_PUBLIC_CONTRACT = "configuration.public" as const;

export interface ActiveCountryAndCurrencyReader {
  readCountry(input: {
    readonly countryCode: string;
    readonly transaction?: unknown;
  }): Promise<{
    readonly countryId: string;
    readonly countryCode: string;
    readonly active: boolean;
    readonly callingCodes: readonly string[];
  } | null>;
  readCurrency(input: {
    readonly currencyCode: string;
    readonly transaction?: unknown;
  }): Promise<{
    readonly currencyId: string;
    readonly currencyCode: string;
    readonly active: boolean;
  } | null>;
}

export interface ActiveCountry {
  readonly id: string;
  readonly code: string;
}

/**
 * Resolves an active country by ISO code for FK persistence.
 * Inactive or unknown codes surface the existing domain COUNTRY_UNAVAILABLE error.
 */
export interface ActiveCountryReader {
  resolveActiveCountry(countryCode: string): Promise<ActiveCountry>;
  getActiveCountryById(countryId: string): Promise<ActiveCountry | null>;
}

/**
 * Configuration-owned factory. Reuses active-country lookups already owned by
 * the configuration service; does not expose repository or Prisma types.
 */
export function createActiveCountryReader(
  databaseContext?: unknown,
): ActiveCountryReader {
  return databaseContext === undefined
    ? createPrismaActiveCountryReader()
    : createPrismaActiveCountryReader(databaseContext);
}

/**
 * Transaction participant factory. The context stays opaque on the public
 * seam; Configuration alone interprets its persistence implementation.
 */
export function createTransactionalActiveCountryReader(
  transactionContext: unknown,
): ActiveCountryReader {
  return createPrismaActiveCountryReader(transactionContext);
}

/**
 * Country-bound provider service pricing policy resolved with the active
 * default currency. Never invents production approval or maximum values.
 */
export interface ProviderServicePricingPolicy {
  readonly countryId: string;
  readonly countryCode: string;
  readonly currency: {
    readonly id: string;
    readonly code: string;
    readonly decimalPlaces: number;
  };
  readonly approvalRequired: boolean;
  readonly maximumPrice: string;
}

export type ProviderServicePricingPolicyResult =
  | {
      readonly status: "AVAILABLE";
      readonly value: ProviderServicePricingPolicy;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly code:
        | "COUNTRY_UNAVAILABLE"
        | "CURRENCY_UNAVAILABLE"
        | "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE";
    };

export interface ProviderServicePricingPolicyReader {
  readForCountry(input: {
    readonly countryCode: string;
  }): Promise<ProviderServicePricingPolicyResult>;
}

export type TransactionalProviderServicePricingPolicyReaderFactory = (
  transactionContext: unknown,
) => ProviderServicePricingPolicyReader;

/**
 * @desc Create the non-transactional provider pricing-policy reader.
 * @explanation Composition and Providers receive only this interface; raw
 * config tables and Prisma types stay inside Configuration.
 */
export function createProviderServicePricingPolicyReader(): ProviderServicePricingPolicyReader {
  return createPrismaProviderServicePricingPolicyReader();
}

/**
 * @desc Bind the pricing-policy reader to an opaque shared transaction.
 * @explanation Mirrors createTransactionalActiveCountryReader so Providers UoW
 * can validate policy inside one serializable or repeatable-read snapshot.
 */
export function createTransactionalProviderServicePricingPolicyReader(
  transactionContext: unknown,
): ProviderServicePricingPolicyReader {
  return createPrismaProviderServicePricingPolicyReader(transactionContext);
}

/**
 * Narrow, read-only country IANA time-zone lookup (DEC-053). Providers and
 * other consumers receive only this interface; City/District management,
 * Staff writes and CountryConfig internals stay inside Configuration.
 */
export interface CountryTimeZoneReader {
  /** Resolve the active operating IANA time zone for a country, or `null` when unset. */
  getTimeZoneForCountry(countryId: string): Promise<string | null>;
}

/** @desc Create the non-transactional country time-zone reader. */
export function createCountryTimeZoneReader(): CountryTimeZoneReader {
  const repository = createPrismaLocalityRepository();
  return {
    async getTimeZoneForCountry(countryId: string): Promise<string | null> {
      const record = await repository.findCountryTimeZone(countryId);
      return record === null || !isRecognizedIanaTimeZone(record.timeZone)
        ? null
        : record.timeZone;
    },
  };
}

/** @desc Bind the country time-zone reader to an opaque shared transaction. */
export function createTransactionalCountryTimeZoneReader(
  transactionContext: unknown,
): CountryTimeZoneReader {
  const repository = createPrismaLocalityRepository(transactionContext);
  return {
    async getTimeZoneForCountry(countryId: string): Promise<string | null> {
      const record = await repository.findCountryTimeZone(countryId);
      return record === null || !isRecognizedIanaTimeZone(record.timeZone)
        ? null
        : record.timeZone;
    },
  };
}

/**
 * Narrow read-only city/district lookup for validating Provider textual
 * coverage selections (DEC-056). Providers never sees Configuration's
 * management snapshot shapes or repository — only these facts.
 */
export interface LocalityCityFact {
  readonly id: string;
  readonly countryId: string;
  readonly isActive: boolean;
  readonly countryActive: boolean;
}

export interface LocalityDistrictFact {
  readonly id: string;
  readonly cityId: string;
  readonly countryId: string;
  readonly isActive: boolean;
  readonly cityActive: boolean;
  readonly countryActive: boolean;
}

export interface ActiveCityProjection {
  readonly cityId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
}

export interface ActiveDistrictProjection {
  readonly districtId: string;
  readonly cityId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
}

export interface LocalityReader {
  findCityById(cityId: string): Promise<LocalityCityFact | null>;
  findDistrictById(districtId: string): Promise<LocalityDistrictFact | null>;
  /** Active district ids belonging to one city, for whole-city coverage expansion (DEC-056). */
  listActiveDistrictIdsForCity(cityId: string): Promise<readonly string[]>;
  /** Browse-safe active cities for an active ISO country; unavailable countries return an empty list. */
  listActiveCitiesForCountry(
    countryCode: string,
  ): Promise<readonly ActiveCityProjection[]>;
  /** Browse-safe active districts only when country and parent city are active and match. */
  listActiveDistrictsForCity(input: {
    readonly countryCode: string;
    readonly cityId: string;
  }): Promise<readonly ActiveDistrictProjection[]>;
}

function buildLocalityReader(transactionContext?: unknown): LocalityReader {
  const createRepository = () =>
    transactionContext === undefined
      ? createPrismaLocalityRepository()
      : createPrismaLocalityRepository(transactionContext);
  return {
    async findCityById(cityId: string): Promise<LocalityCityFact | null> {
      const repository = createRepository();
      const city = await repository.findCityById(cityId);
      if (city === null) {
        return null;
      }
      const country = await repository.findCountryById(city.countryId);
      return {
        id: city.id,
        countryId: city.countryId,
        isActive: city.isActive,
        countryActive: country?.isActive === true,
      };
    },
    async findDistrictById(
      districtId: string,
    ): Promise<LocalityDistrictFact | null> {
      const repository = createRepository();
      const district = await repository.findDistrictById(districtId);
      if (district === null) {
        return null;
      }
      const city = await repository.findCityById(district.cityId);
      if (city === null) {
        return null;
      }
      const country = await repository.findCountryById(city.countryId);
      return {
        id: district.id,
        cityId: district.cityId,
        countryId: city.countryId,
        isActive: district.isActive,
        cityActive: city.isActive,
        countryActive: country?.isActive === true,
      };
    },
    async listActiveDistrictIdsForCity(
      cityId: string,
    ): Promise<readonly string[]> {
      const repository = createRepository();
      const city = await repository.findCityById(cityId);
      if (city === null || !city.isActive) {
        return [];
      }
      const country = await repository.findCountryById(city.countryId);
      if (country?.isActive !== true) {
        return [];
      }
      const districts = await repository.listDistrictsByCity(cityId);
      return districts.filter((d) => d.isActive).map((d) => d.id);
    },
    async listActiveCitiesForCountry(
      countryCode: string,
    ): Promise<readonly ActiveCityProjection[]> {
      const repository = createRepository();
      const country = await repository.findCountryByCode(
        countryCode.trim().toUpperCase(),
      );
      if (country?.isActive !== true) {
        return [];
      }
      const cities = await repository.listCitiesByCountry(country.id);
      return cities
        .filter((city) => city.isActive)
        .map((city) => ({
          cityId: city.id,
          code: city.code,
          nameAr: city.nameAr,
          nameEn: city.nameEn,
        }));
    },
    async listActiveDistrictsForCity(
      input: {
        readonly countryCode: string;
        readonly cityId: string;
      },
    ): Promise<readonly ActiveDistrictProjection[]> {
      const repository = createRepository();
      const country = await repository.findCountryByCode(
        input.countryCode.trim().toUpperCase(),
      );
      const city = await repository.findCityById(input.cityId);
      if (
        country?.isActive !== true ||
        city === null ||
        !city.isActive ||
        city.countryId !== country.id
      ) {
        return [];
      }
      const districts = await repository.listDistrictsByCity(city.id);
      return districts
        .filter((district) => district.isActive)
        .map((district) => ({
          districtId: district.id,
          cityId: city.id,
          code: district.code,
          nameAr: district.nameAr,
          nameEn: district.nameEn,
        }));
    },
  };
}

/** @desc Create the non-transactional locality reader. */
export function createLocalityReader(databaseContext?: unknown): LocalityReader {
  return buildLocalityReader(databaseContext);
}

/** @desc Bind the locality reader to an opaque shared transaction. */
export function createTransactionalLocalityReader(
  transactionContext: unknown,
): LocalityReader {
  return buildLocalityReader(transactionContext);
}

export type {
  DepositPercentFacts,
  DepositPercentReader,
} from "./infrastructure/prisma-deposit-percent.reader.js";
export { createDepositPercentReader } from "./infrastructure/prisma-deposit-percent.reader.js";
export type { ProviderResponseHoursReader } from "./infrastructure/prisma-provider-response-hours.reader.js";
export { createProviderResponseHoursReader } from "./infrastructure/prisma-provider-response-hours.reader.js";

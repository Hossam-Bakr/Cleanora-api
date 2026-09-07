import { createPrismaActiveCountryReader } from "./infrastructure/prisma-active-country.reader.js";
import { createPrismaProviderServicePricingPolicyReader, createPrismaProviderServiceCountryIdentityReader } from "./infrastructure/prisma-provider-service-pricing-policy.reader.js";

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
export function createActiveCountryReader(): ActiveCountryReader {
  return createPrismaActiveCountryReader();
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

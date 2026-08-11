import { createPrismaActiveCountryReader } from "./infrastructure/prisma-active-country.reader.js";

/**
 * Approved public surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * repositories or internal configuration helpers.
 */
export const CONFIGURATION_PUBLIC_CONTRACT = "configuration.public" as const;

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

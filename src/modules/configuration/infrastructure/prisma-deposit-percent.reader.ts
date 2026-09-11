import { getPrismaClient } from "#database/prisma";
import type { Prisma, PrismaClient } from "#generated/prisma/client";

const DEPOSIT_KEY = "commercial.deposit_percent";

export interface DepositPercentFacts {
  readonly countryId: string;
  readonly countryCode: string;
  readonly currencyCode: string;
  readonly decimalPlaces: number;
  readonly percentCanonical: string;
}

export interface DepositPercentReader {
  readForCountryId(countryId: string): Promise<DepositPercentFacts | null>;
}

/**
 * @desc Configuration-owned deposit percent lookup (COUNTRY_REQUIRED).
 * @access Public contract consumer: Bookings
 */
export function createDepositPercentReader(
  databaseContext?: unknown,
): DepositPercentReader {
  const client = (databaseContext ?? getPrismaClient()) as
    PrismaClient | Prisma.TransactionClient;
  return {
    async readForCountryId(
      countryId: string,
    ): Promise<DepositPercentFacts | null> {
      const country = await client.country.findUnique({
        where: { id: countryId },
        include: { defaultCurrency: true },
      });
      if (
        country === null ||
        !country.isActive ||
        !country.defaultCurrency.isActive
      ) {
        return null;
      }
      const config = await client.countryConfig.findUnique({
        where: { countryId_key: { countryId, key: DEPOSIT_KEY } },
      });
      if (config === null || config.valueKind !== "NUMBER") {
        return null;
      }
      const percentCanonical = normalizePercent(config.value);
      if (percentCanonical === null) {
        return null;
      }
      return {
        countryId: country.id,
        countryCode: country.code,
        currencyCode: country.defaultCurrency.code,
        decimalPlaces: country.defaultCurrency.decimalPlaces,
        percentCanonical,
      };
    },
  };
}

function normalizePercent(configuredPercent: unknown): string | null {
  if (
    typeof configuredPercent === "number" &&
    Number.isFinite(configuredPercent) &&
    configuredPercent >= 0 &&
    configuredPercent <= 100
  ) {
    const canonical = String(configuredPercent);
    return /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(canonical) ? canonical : null;
  }
  if (
    typeof configuredPercent === "string" &&
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(configuredPercent)
  ) {
    const numeric = Number(configuredPercent);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) {
      return configuredPercent;
    }
  }
  return null;
}

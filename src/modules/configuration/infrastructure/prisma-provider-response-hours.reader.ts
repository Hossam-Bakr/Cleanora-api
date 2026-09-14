import { getPrismaClient } from "#database/prisma";
import type { Prisma, PrismaClient } from "#generated/prisma/client";

const HOURS_KEY = "commercial.provider_response_hours";

export interface ProviderResponseHoursReader {
  readHoursForCountryId(countryId: string): Promise<number | null>;
}

/**
 * @desc Configuration-owned provider response window lookup (COUNTRY_REQUIRED).
 * @access Public contract consumer: Bookings
 */
export function createProviderResponseHoursReader(
  databaseContext?: unknown,
): ProviderResponseHoursReader {
  const client = (databaseContext ?? getPrismaClient()) as
    PrismaClient | Prisma.TransactionClient;
  return {
    async readHoursForCountryId(countryId: string): Promise<number | null> {
      const country = await client.country.findUnique({
        where: { id: countryId },
        select: { id: true, isActive: true },
      });
      if (country === null || !country.isActive) {
        return null;
      } else {
      const config = await client.countryConfig.findUnique({
        where: { countryId_key: { countryId, key: HOURS_KEY } },
      });
      if (config === null || config.valueKind !== "NUMBER") {
        return null;
      } else {
        return normalizeHours(config.value);
      }
      }
    },
  };
}

function inHourRange(value: number): boolean {
  return value >= 1 && value <= 168;
}

function normalizeHours(configured: unknown): number | null {
  if (typeof configured === "number" && Number.isInteger(configured) && inHourRange(configured)) {
    return configured;
  }
  if (typeof configured === "string" && /^(?:[1-9]\d?|1[0-6]\d|168)$/u.test(configured)) {
    return Number(configured);
  }
  return null;
}

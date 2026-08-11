import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import { AppError } from "#shared/errors/app-error";

import type {
  ActiveCountry,
  ActiveCountryReader,
} from "../configuration.public.js";

type ConfigurationCountryDatabase = Pick<Prisma.TransactionClient, "country">;

class PrismaActiveCountryReader implements ActiveCountryReader {
  public constructor(private readonly database: ConfigurationCountryDatabase) {}

  public async resolveActiveCountry(countryCode: string): Promise<ActiveCountry> {
    const country = await this.database.country.findFirst({
      where: { code: countryCode, isActive: true },
      select: { id: true, code: true },
    });
    if (country === null) {
      throw new AppError({
        code: "COUNTRY_UNAVAILABLE",
        message: "Country is unavailable",
        statusCode: 400,
      });
    }
    return country;
  }

  public getActiveCountryById(countryId: string): Promise<ActiveCountry | null> {
    return this.database.country.findFirst({
      where: { id: countryId, isActive: true },
      select: { id: true, code: true },
    });
  }
}

export function createPrismaActiveCountryReader(): ActiveCountryReader;
export function createPrismaActiveCountryReader(
  transactionContext: unknown,
): ActiveCountryReader;
export function createPrismaActiveCountryReader(
  transactionContext?: unknown,
): ActiveCountryReader {
  const database =
    transactionContext === undefined
      ? getPrismaClient()
      : (transactionContext as ConfigurationCountryDatabase);
  return new PrismaActiveCountryReader(database);
}

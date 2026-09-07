import { getPrismaClient } from "#database/prisma";

import {
  createConfigurationRepositories,
  type ConfigurationDatabase,
} from "../configuration.repository.js";
import { readProviderServicePricingPolicyWith } from "../configuration.service.js";
import type { ProviderServicePricingPolicyReader } from "../configuration.public.js";

/** Country identity remains readable during remediation of inactive countries. */
export function createPrismaProviderServiceCountryIdentityReader(transaction: unknown) {
  const database = transaction as ConfigurationDatabase;
  return {
    async getCountryCodeById(countryId: string): Promise<string | null> {
      const country = await database.country.findUnique({ where: { id: countryId }, select: { code: true } });
      return country?.code ?? null;
    },
  };
}

/**
 * @desc Configuration-owned pricing-policy reader over shared or transactional DB.
 * @explanation Opaque transaction contexts are interpreted only here so the
 * public seam never exports Prisma types.
 */
class PrismaProviderServicePricingPolicyReader
  implements ProviderServicePricingPolicyReader
{
  public constructor(private readonly database: ConfigurationDatabase) {}

  public readForCountry(input: {
    readonly countryCode: string;
  }): ReturnType<ProviderServicePricingPolicyReader["readForCountry"]> {
    return readProviderServicePricingPolicyWith(
      createConfigurationRepositories(this.database),
      input.countryCode,
    );
  }
}

export function createPrismaProviderServicePricingPolicyReader(): ProviderServicePricingPolicyReader;
export function createPrismaProviderServicePricingPolicyReader(
  transactionContext: unknown,
): ProviderServicePricingPolicyReader;
export function createPrismaProviderServicePricingPolicyReader(
  transactionContext?: unknown,
): ProviderServicePricingPolicyReader {
  const database =
    transactionContext === undefined
      ? getPrismaClient()
      : (transactionContext as ConfigurationDatabase);
  return new PrismaProviderServicePricingPolicyReader(database);
}

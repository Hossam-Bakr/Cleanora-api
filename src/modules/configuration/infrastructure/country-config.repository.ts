import { getPrismaClient } from "#integrations/database/prisma-client-accessor";

import type { CountryConfigRecord } from "../domain/configuration.types.js";

/**
 * Read country-scoped configuration records without leaking Prisma models.
 */
export class CountryConfigRepository {
  async existsByKey(key: string): Promise<boolean> {
    const config = await getPrismaClient().countryConfig.findFirst({
      where: { key },
      select: { key: true }
    });

    return config !== null;
  }

  async findByCountryIdAndKey(
    countryId: string,
    key: string
  ): Promise<CountryConfigRecord | undefined> {
    const config = await getPrismaClient().countryConfig.findUnique({
      where: { countryId_key: { countryId, key } }
    });

    return config === null
      ? undefined
      : {
          key: config.key,
          value: config.value,
          valueKind: config.valueKind
        };
  }
}

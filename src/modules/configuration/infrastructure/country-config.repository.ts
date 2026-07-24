import { getPrismaClient } from "#integrations/database/prisma-client-accessor";

import type { CountryConfigRecord } from "../domain/configuration.types.js";

/**
 * Read country-scoped configuration records without leaking Prisma models.
 */
export class CountryConfigRepository {
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

import { getPrismaClient } from "#integrations/database/prisma-client-accessor";

import type { CountryRecord } from "../domain/configuration.types.js";

/**
 * Map configuration-owned country persistence into the public-safe DTO.
 */
export class CountryRepository {
  async findByCode(code: string): Promise<CountryRecord | undefined> {
    const country = await getPrismaClient().country.findUnique({
      where: { code },
      include: { defaultCurrency: true }
    });

    if (country === null) {
      return undefined;
    }

    return {
      code: country.code,
      nameEn: country.nameEn,
      nameAr: country.nameAr,
      defaultCurrencyCode: country.defaultCurrency.code,
      defaultLocale: country.defaultLocale,
      supportedLocales: country.supportedLocales as string[],
      isActive: country.isActive
    };
  }

  async findIdByCode(code: string): Promise<string | undefined> {
    const country = await getPrismaClient().country.findUnique({
      where: { code },
      select: { id: true }
    });

    return country?.id;
  }
}

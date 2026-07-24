import { getPrismaClient } from "#integrations/database/prisma-client-accessor";

import type { CurrencyRecord } from "../domain/configuration.types.js";

/**
 * Map configuration-owned currency persistence into the public-safe DTO.
 */
export class CurrencyRepository {
  async findByCode(code: string): Promise<CurrencyRecord | undefined> {
    const currency = await getPrismaClient().currency.findUnique({
      where: { code }
    });

    return currency === null
      ? undefined
      : {
          code: currency.code,
          nameEn: currency.nameEn,
          nameAr: currency.nameAr,
          decimalPlaces: currency.decimalPlaces,
          isActive: currency.isActive
        };
  }
}

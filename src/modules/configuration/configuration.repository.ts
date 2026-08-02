import { getPrismaClient } from "#database/prisma";

import type { ConfigResolutionPolicy } from "./config-key.catalog.js";

export interface CurrencyRecord {
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly decimalPlaces: number;
  readonly isActive: boolean;
}

export interface CountryRecord {
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly defaultCurrencyCode: string;
  readonly defaultLocale: string;
  readonly supportedLocales: string[];
  readonly isActive: boolean;
}

export interface AppConfigRecord {
  readonly key: string;
  readonly value: unknown | null;
  readonly valueKind: string;
  readonly resolutionPolicy: ConfigResolutionPolicy;
}

export interface CountryConfigRecord {
  readonly key: string;
  readonly value: unknown;
  readonly valueKind: string;
}

export interface EffectiveConfig<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly source: "global" | "country";
  readonly resolutionPolicy: ConfigResolutionPolicy;
  readonly countryCode?: string;
}

export interface ConfigurationRepositories {
  readonly currency: {
    findByCode(code: string): Promise<CurrencyRecord | undefined>;
  };
  readonly country: {
    findByCode(code: string): Promise<CountryRecord | undefined>;
    findIdByCode(code: string): Promise<string | undefined>;
  };
  readonly appConfig: {
    findByKey(key: string): Promise<AppConfigRecord | undefined>;
  };
  readonly countryConfig: {
    existsByKey(key: string): Promise<boolean>;
    findByCountryIdAndKey(
      countryId: string,
      key: string,
    ): Promise<CountryConfigRecord | undefined>;
  };
}

export class AppConfigRepository {
  async findByKey(key: string): Promise<AppConfigRecord | undefined> {
    const config = await getPrismaClient().appConfig.findUnique({
      where: { key },
    });
    return config === null
      ? undefined
      : {
          key: config.key,
          value: config.value,
          valueKind: config.valueKind,
          resolutionPolicy: config.resolutionPolicy,
        };
  }
}

class CountryConfigRepository {
  async existsByKey(key: string): Promise<boolean> {
    const config = await getPrismaClient().countryConfig.findFirst({
      where: { key },
      select: { key: true },
    });
    return config !== null;
  }

  async findByCountryIdAndKey(
    countryId: string,
    key: string,
  ): Promise<CountryConfigRecord | undefined> {
    const config = await getPrismaClient().countryConfig.findUnique({
      where: { countryId_key: { countryId, key } },
    });
    return config === null
      ? undefined
      : {
          key: config.key,
          value: config.value,
          valueKind: config.valueKind,
        };
  }
}

class CountryRepository {
  async findByCode(code: string): Promise<CountryRecord | undefined> {
    const country = await getPrismaClient().country.findUnique({
      where: { code },
      include: { defaultCurrency: true },
    });
    return country === null
      ? undefined
      : {
          code: country.code,
          nameEn: country.nameEn,
          nameAr: country.nameAr,
          defaultCurrencyCode: country.defaultCurrency.code,
          defaultLocale: country.defaultLocale,
          supportedLocales: country.supportedLocales as string[],
          isActive: country.isActive,
        };
  }

  async findIdByCode(code: string): Promise<string | undefined> {
    const country = await getPrismaClient().country.findUnique({
      where: { code },
      select: { id: true },
    });
    return country?.id;
  }
}

class CurrencyRepository {
  async findByCode(code: string): Promise<CurrencyRecord | undefined> {
    const currency = await getPrismaClient().currency.findUnique({
      where: { code },
    });
    return currency === null
      ? undefined
      : {
          code: currency.code,
          nameEn: currency.nameEn,
          nameAr: currency.nameAr,
          decimalPlaces: currency.decimalPlaces,
          isActive: currency.isActive,
        };
  }
}

export const configurationRepositories: ConfigurationRepositories = {
  currency: new CurrencyRepository(),
  country: new CountryRepository(),
  appConfig: new AppConfigRepository(),
  countryConfig: new CountryConfigRepository(),
};

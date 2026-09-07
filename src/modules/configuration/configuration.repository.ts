import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";

import type { ConfigResolutionPolicy } from "./config-key.catalog.js";

export interface CurrencyRecord {
  readonly id: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly decimalPlaces: number;
  readonly isActive: boolean;
}

export interface CountryRecord {
  readonly id: string;
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

/**
 * Prisma client surface Configuration repositories may use. Opaque transaction
 * participants from other modules satisfy this by structural typing.
 */
export type ConfigurationDatabase = Pick<
  Prisma.TransactionClient,
  "currency" | "country" | "appConfig" | "countryConfig"
>;

function resolveDatabase(
  database: ConfigurationDatabase | undefined,
): ConfigurationDatabase {
  return database ?? getPrismaClient();
}

/**
 * @desc Read AppConfig metadata/rows by stable key.
 * @explanation Construction stays Prisma-free so module import does not require
 * a bound client; default reads resolve the process client on first query.
 */
export class AppConfigRepository {
  public constructor(private readonly database?: ConfigurationDatabase) {}

  async findByKey(key: string): Promise<AppConfigRecord | undefined> {
    const config = await resolveDatabase(this.database).appConfig.findUnique({
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
  public constructor(private readonly database?: ConfigurationDatabase) {}

  async existsByKey(key: string): Promise<boolean> {
    const config = await resolveDatabase(this.database).countryConfig.findFirst(
      {
        where: { key },
        select: { key: true },
      },
    );
    return config !== null;
  }

  async findByCountryIdAndKey(
    countryId: string,
    key: string,
  ): Promise<CountryConfigRecord | undefined> {
    const config = await resolveDatabase(
      this.database,
    ).countryConfig.findUnique({
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
  public constructor(private readonly database?: ConfigurationDatabase) {}

  async findByCode(code: string): Promise<CountryRecord | undefined> {
    const country = await resolveDatabase(this.database).country.findUnique({
      where: { code },
      include: { defaultCurrency: true },
    });
    return country === null
      ? undefined
      : {
          id: country.id,
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
    const country = await resolveDatabase(this.database).country.findUnique({
      where: { code },
      select: { id: true },
    });
    return country?.id;
  }
}

class CurrencyRepository {
  public constructor(private readonly database?: ConfigurationDatabase) {}

  async findByCode(code: string): Promise<CurrencyRecord | undefined> {
    const currency = await resolveDatabase(this.database).currency.findUnique({
      where: { code },
    });
    return currency === null
      ? undefined
      : {
          id: currency.id,
          code: currency.code,
          nameEn: currency.nameEn,
          nameAr: currency.nameAr,
          decimalPlaces: currency.decimalPlaces,
          isActive: currency.isActive,
        };
  }
}

/**
 * @desc Build Configuration repositories against an explicit shared client or
 * opaque transaction participant.
 * @explanation Cross-module readers stay free of Prisma types by receiving
 * `unknown` and letting Configuration alone interpret the database surface.
 */
export function createConfigurationRepositories(
  database: ConfigurationDatabase,
): ConfigurationRepositories {
  return {
    currency: new CurrencyRepository(database),
    country: new CountryRepository(database),
    appConfig: new AppConfigRepository(database),
    countryConfig: new CountryConfigRepository(database),
  };
}

/**
 * Process-default repositories. Prisma is resolved on first query so importing
 * Configuration does not require a bound client at module evaluation time.
 */
export const configurationRepositories: ConfigurationRepositories = {
  currency: new CurrencyRepository(),
  country: new CountryRepository(),
  appConfig: new AppConfigRepository(),
  countryConfig: new CountryConfigRepository(),
};

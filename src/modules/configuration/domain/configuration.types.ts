import type { ConfigResolutionPolicy } from "./config-key-catalog.js";

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
      key: string
    ): Promise<CountryConfigRecord | undefined>;
  };
}

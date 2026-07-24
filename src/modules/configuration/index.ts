import type { ModuleRegistrar } from "#routes/register-modules";

import {
  assertCountryCurrencySupported as assertCountryCurrencySupportedWithRepositories,
  getCountryByCode as getCountryByCodeWithRepositories,
  getCurrencyByCode as getCurrencyByCodeWithRepositories
} from "./application/country-currency.js";
import { resolveEffectiveConfig as resolveWithRepositories } from "./application/resolve-effective-config.js";
import type {
  CountryRecord,
  CurrencyRecord,
  EffectiveConfig
} from "./domain/configuration.types.js";
import { AppConfigRepository } from "./infrastructure/app-config.repository.js";
import { CountryConfigRepository } from "./infrastructure/country-config.repository.js";
import { CountryRepository } from "./infrastructure/country.repository.js";
import { CurrencyRepository } from "./infrastructure/currency.repository.js";

const repositories = {
  currency: new CurrencyRepository(),
  country: new CountryRepository(),
  appConfig: new AppConfigRepository(),
  countryConfig: new CountryConfigRepository()
};

export type { CountryRecord, CurrencyRecord, EffectiveConfig };

export async function getCountryByCode(code: string): Promise<CountryRecord> {
  return getCountryByCodeWithRepositories(repositories, code);
}

export async function getCurrencyByCode(code: string): Promise<CurrencyRecord> {
  return getCurrencyByCodeWithRepositories(repositories, code);
}

export async function assertCountryCurrencySupported(
  countryCode: string
): Promise<void> {
  await assertCountryCurrencySupportedWithRepositories(repositories, countryCode);
}

export async function resolveEffectiveConfig<T = unknown>(
  key: string,
  countryCode?: string
): Promise<EffectiveConfig<T>> {
  return resolveWithRepositories<T>(repositories, key, countryCode);
}

/**
 * @desc Identify the configuration module at application composition time.
 * @access Public module entry
 * @explanation R1-P01 registers no configuration HTTP endpoints because
 * configuration behavior is introduced later through this module's public API.
 */
export const configurationModuleRegistrar: ModuleRegistrar = {
  name: "configuration",
  register: () => undefined
};

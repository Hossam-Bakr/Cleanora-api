import { AppError } from "#core/errors/app-error";

import type {
  ConfigurationRepositories,
  CountryRecord,
  CurrencyRecord
} from "../domain/configuration.types.js";

/**
 * Return an active country or surface the stable public unavailable error.
 */
export async function getCountryByCode(
  repositories: ConfigurationRepositories,
  code: string
): Promise<CountryRecord> {
  const country = await repositories.country.findByCode(code);
  if (country === undefined || !country.isActive) {
    throw new AppError({
      code: "COUNTRY_UNAVAILABLE",
      message: "Country is unavailable",
      statusCode: 400
    });
  }
  return country;
}

/**
 * Return an active currency or surface the stable public unavailable error.
 */
export async function getCurrencyByCode(
  repositories: ConfigurationRepositories,
  code: string
): Promise<CurrencyRecord> {
  const currency = await repositories.currency.findByCode(code);
  if (currency === undefined || !currency.isActive) {
    throw new AppError({
      code: "CURRENCY_UNAVAILABLE",
      message: "Currency is unavailable",
      statusCode: 400
    });
  }
  return currency;
}

/**
 * Ensure a country is active and its configured default currency is usable.
 */
export async function assertCountryCurrencySupported(
  repositories: ConfigurationRepositories,
  countryCode: string
): Promise<void> {
  const country = await getCountryByCode(repositories, countryCode);
  await getCurrencyByCode(repositories, country.defaultCurrencyCode);
}

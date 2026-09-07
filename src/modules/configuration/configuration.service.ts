import { AppError } from "#shared/errors/app-error";

import {
  assertConfigValueIsNotSecret,
  getConfigKeyDefinition,
} from "./config-key.catalog.js";
import {
  configurationRepositories,
  type ConfigurationRepositories,
  type CountryRecord,
  type CurrencyRecord,
  type EffectiveConfig,
} from "./configuration.repository.js";
import type {
  ProviderServicePricingPolicy,
  ProviderServicePricingPolicyResult,
} from "./configuration.public.js";

const PROVIDER_SERVICE_PRICING_POLICY_KEY = "providers.service_pricing_policy";
const MAX_MINOR_UNIT_DIGITS = 65;
const MAX_CURRENCY_DECIMAL_PLACES = 30;

function configurationError(code: string, message: string): AppError {
  return new AppError({ code, message, statusCode: 400 });
}

export async function getCountryByCodeWith(
  repositories: ConfigurationRepositories,
  code: string,
): Promise<CountryRecord> {
  const country = await repositories.country.findByCode(code);
  if (country === undefined || !country.isActive) {
    throw configurationError("COUNTRY_UNAVAILABLE", "Country is unavailable");
  }
  return country;
}

export async function getCurrencyByCodeWith(
  repositories: ConfigurationRepositories,
  code: string,
): Promise<CurrencyRecord> {
  const currency = await repositories.currency.findByCode(code);
  if (currency === undefined || !currency.isActive) {
    throw configurationError(
      "CURRENCY_UNAVAILABLE",
      "Currency is unavailable",
    );
  }
  return currency;
}

export async function assertCountryCurrencySupportedWith(
  repositories: ConfigurationRepositories,
  countryCode: string,
): Promise<void> {
  const country = await getCountryByCodeWith(repositories, countryCode);
  await getCurrencyByCodeWith(
    repositories,
    country.defaultCurrencyCode,
  );
}

export async function resolveEffectiveConfigWith<T = unknown>(
  repositories: ConfigurationRepositories,
  key: string,
  countryCode?: string,
): Promise<EffectiveConfig<T>> {
  const definition = getConfigKeyDefinition(key);
  const appConfig = await repositories.appConfig.findByKey(key);
  if (definition === undefined || appConfig === undefined) {
    throw configurationError(
      "CONFIG_KEY_UNKNOWN",
      `Unknown configuration key: ${key}`,
    );
  }
  if (
    appConfig.resolutionPolicy !== definition.resolutionPolicy ||
    appConfig.valueKind !== definition.valueKind
  ) {
    throw configurationError(
      "CONFIG_VALUE_INVALID",
      "Configuration policy is invalid",
    );
  }

  let countryId: string | undefined;
  if (countryCode !== undefined) {
    const country = await repositories.country.findByCode(countryCode);
    countryId = await repositories.country.findIdByCode(countryCode);
    if (country === undefined || !country.isActive || countryId === undefined) {
      throw configurationError(
        "COUNTRY_UNAVAILABLE",
        "Country is unavailable",
      );
    }
  }

  if (
    definition.resolutionPolicy === "GLOBAL_ONLY" &&
    (await repositories.countryConfig.existsByKey(key))
  ) {
    throw configurationError(
      "CONFIG_COUNTRY_OVERRIDE_REJECTED",
      "Country override is not permitted for this configuration key",
    );
  }

  const countryConfig =
    definition.resolutionPolicy === "GLOBAL_ONLY" || countryId === undefined
      ? undefined
      : await repositories.countryConfig.findByCountryIdAndKey(countryId, key);
  if (
    countryConfig !== undefined &&
    (countryConfig.valueKind !== definition.valueKind ||
      countryConfig.valueKind !== appConfig.valueKind)
  ) {
    throw configurationError(
      "CONFIG_VALUE_INVALID",
      "Configuration value kind is invalid",
    );
  }
  if (
    definition.resolutionPolicy === "COUNTRY_REQUIRED" &&
    countryId === undefined
  ) {
    throw configurationError(
      "CONFIG_COUNTRY_VALUE_REQUIRED",
      "Country code is required for this configuration key",
    );
  }

  const result =
    definition.resolutionPolicy === "GLOBAL_ONLY"
      ? appConfig.value === null
        ? undefined
        : { value: appConfig.value, source: "global" as const }
      : definition.resolutionPolicy === "COUNTRY_REQUIRED"
        ? countryConfig === undefined
          ? undefined
          : { value: countryConfig.value, source: "country" as const }
        : countryConfig === undefined
          ? appConfig.value === null
            ? undefined
            : { value: appConfig.value, source: "global" as const }
          : { value: countryConfig.value, source: "country" as const };
  if (result === undefined) {
    throw configurationError(
      definition.resolutionPolicy === "COUNTRY_REQUIRED"
        ? "CONFIG_COUNTRY_VALUE_REQUIRED"
        : "CONFIG_VALUE_MISSING",
      "Configuration value is missing",
    );
  }

  try {
    assertConfigValueIsNotSecret(key, result.value);
    return {
      key,
      value: definition.valueSchema.parse(result.value) as T,
      source: result.source,
      resolutionPolicy: definition.resolutionPolicy,
      ...(countryCode === undefined ? {} : { countryCode }),
    };
  } catch {
    throw configurationError(
      "CONFIG_VALUE_INVALID",
      "Configuration value is invalid",
    );
  }
}

export async function getCountryByCode(code: string): Promise<CountryRecord> {
  return getCountryByCodeWith(configurationRepositories, code);
}

/** Public Configuration contract for consumers persisting an active country FK. */
export async function getActiveCountryIdByCode(code: string): Promise<string> {
  await getCountryByCode(code);
  const id = await configurationRepositories.country.findIdByCode(code);
  if (id === undefined) {
    throw configurationError("COUNTRY_UNAVAILABLE", "Country is unavailable");
  }
  return id;
}

export async function getCurrencyByCode(code: string): Promise<CurrencyRecord> {
  return getCurrencyByCodeWith(configurationRepositories, code);
}

export async function assertCountryCurrencySupported(
  countryCode: string,
): Promise<void> {
  await assertCountryCurrencySupportedWith(
    configurationRepositories,
    countryCode,
  );
}

export async function resolveEffectiveConfig<T = unknown>(
  key: string,
  countryCode?: string,
): Promise<EffectiveConfig<T>> {
  return resolveEffectiveConfigWith<T>(
    configurationRepositories,
    key,
    countryCode,
  );
}

/**
 * @desc Convert a canonical decimal string into whole minor-unit digits.
 * @explanation Rejects excess fractional scale and values wider than 65 digits
 * so Configuration never invents a production maximum that Prisma/PostgreSQL
 * cannot store exactly as `numeric(65,0)`.
 */
export function convertCanonicalDecimalToMinorUnitDigits(
  decimal: string,
  decimalPlaces: number,
): string | null {
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > MAX_CURRENCY_DECIMAL_PLACES
  ) {
    return null;
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(decimal)) {
    return null;
  }
  if (/^0(?:\.0+)?$/u.test(decimal)) {
    return null;
  }

  const separatorIndex = decimal.indexOf(".");
  const whole =
    separatorIndex === -1 ? decimal : decimal.slice(0, separatorIndex);
  const fraction =
    separatorIndex === -1 ? "" : decimal.slice(separatorIndex + 1);
  if (fraction.length > decimalPlaces) {
    return null;
  }
  const paddedFraction = fraction.padEnd(decimalPlaces, "0");
  const combined = `${whole}${paddedFraction}`.replace(/^0+/u, "") || "0";
  if (combined === "0" || combined.length > MAX_MINOR_UNIT_DIGITS) {
    return null;
  }
  return combined;
}

type ProviderServicePricingPolicyValue = {
  readonly approvalRequired: boolean;
  readonly maximumPrice: string;
};

/**
 * @desc Resolve the country-required provider service pricing policy.
 * @explanation Returns explicit UNAVAILABLE codes instead of inventing defaults;
 * currency scale and maximum minor-unit width are validated before AVAILABLE.
 */
export async function readProviderServicePricingPolicyWith(
  repositories: ConfigurationRepositories,
  countryCode: string,
): Promise<ProviderServicePricingPolicyResult> {
  const country = await repositories.country.findByCode(countryCode);
  if (country === undefined || !country.isActive) {
    return { status: "UNAVAILABLE", code: "COUNTRY_UNAVAILABLE" };
  }

  const currency = await repositories.currency.findByCode(
    country.defaultCurrencyCode,
  );
  if (
    currency === undefined ||
    !currency.isActive ||
    !Number.isInteger(currency.decimalPlaces) ||
    currency.decimalPlaces < 0 ||
    currency.decimalPlaces > MAX_CURRENCY_DECIMAL_PLACES
  ) {
    return { status: "UNAVAILABLE", code: "CURRENCY_UNAVAILABLE" };
  }

  const definition = getConfigKeyDefinition(PROVIDER_SERVICE_PRICING_POLICY_KEY);
  const appConfig = await repositories.appConfig.findByKey(
    PROVIDER_SERVICE_PRICING_POLICY_KEY,
  );
  if (
    definition === undefined ||
    appConfig === undefined ||
    appConfig.resolutionPolicy !== definition.resolutionPolicy ||
    appConfig.valueKind !== definition.valueKind
  ) {
    return {
      status: "UNAVAILABLE",
      code: "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE",
    };
  }

  const countryConfig = await repositories.countryConfig.findByCountryIdAndKey(
    country.id,
    PROVIDER_SERVICE_PRICING_POLICY_KEY,
  );
  if (
    countryConfig === undefined ||
    countryConfig.valueKind !== definition.valueKind ||
    countryConfig.valueKind !== appConfig.valueKind
  ) {
    return {
      status: "UNAVAILABLE",
      code: "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE",
    };
  }

  let parsed: ProviderServicePricingPolicyValue;
  try {
    assertConfigValueIsNotSecret(
      PROVIDER_SERVICE_PRICING_POLICY_KEY,
      countryConfig.value,
    );
    parsed = definition.valueSchema.parse(
      countryConfig.value,
    ) as ProviderServicePricingPolicyValue;
  } catch {
    return {
      status: "UNAVAILABLE",
      code: "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE",
    };
  }

  if (
    convertCanonicalDecimalToMinorUnitDigits(
      parsed.maximumPrice,
      currency.decimalPlaces,
    ) === null
  ) {
    return {
      status: "UNAVAILABLE",
      code: "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE",
    };
  }

  const value: ProviderServicePricingPolicy = {
    countryId: country.id,
    countryCode: country.code,
    currency: {
      id: currency.id,
      code: currency.code,
      decimalPlaces: currency.decimalPlaces,
    },
    approvalRequired: parsed.approvalRequired,
    maximumPrice: parsed.maximumPrice,
  };

  return { status: "AVAILABLE", value };
}

export type { CountryRecord, CurrencyRecord, EffectiveConfig };

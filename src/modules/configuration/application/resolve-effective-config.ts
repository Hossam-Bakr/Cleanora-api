import { AppError } from "#core/errors/app-error";

import {
  assertConfigValueIsNotSecret,
  getConfigKeyDefinition
} from "../domain/config-key-catalog.js";
import type {
  ConfigurationRepositories,
  EffectiveConfig
} from "../domain/configuration.types.js";

/**
 * Resolve a declared configuration key according to its approved policy.
 * Invalid persistence is surfaced explicitly rather than silently bypassed.
 */
export async function resolveEffectiveConfig<T = unknown>(
  repositories: ConfigurationRepositories,
  key: string,
  countryCode?: string
): Promise<EffectiveConfig<T>> {
  const definition = getConfigKeyDefinition(key);
  const appConfig = await repositories.appConfig.findByKey(key);

  if (definition === undefined || appConfig === undefined) {
    throw configurationError("CONFIG_KEY_UNKNOWN", `Unknown configuration key: ${key}`);
  }

  if (appConfig.resolutionPolicy !== definition.resolutionPolicy) {
    throw configurationError("CONFIG_VALUE_INVALID", "Configuration policy is invalid");
  }

  let countryId: string | undefined;
  if (countryCode !== undefined) {
    const country = await repositories.country.findByCode(countryCode);
    if (country === undefined || !country.isActive) {
      throw configurationError("COUNTRY_UNAVAILABLE", "Country is unavailable");
    }

    countryId = await repositories.country.findIdByCode(countryCode);
    if (countryId === undefined) {
      throw configurationError("COUNTRY_UNAVAILABLE", "Country is unavailable");
    }
  }

  const countryConfig =
    countryId === undefined
      ? undefined
      : await repositories.countryConfig.findByCountryIdAndKey(countryId, key);

  if (
    definition.resolutionPolicy === "GLOBAL_ONLY" &&
    countryConfig !== undefined
  ) {
    throw configurationError(
      "CONFIG_COUNTRY_OVERRIDE_REJECTED",
      "Country override is not permitted for this configuration key"
    );
  }

  if (definition.resolutionPolicy === "COUNTRY_REQUIRED" && countryId === undefined) {
    throw configurationError(
      "CONFIG_COUNTRY_VALUE_REQUIRED",
      "Country code is required for this configuration key"
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
    const code =
      definition.resolutionPolicy === "COUNTRY_REQUIRED"
        ? "CONFIG_COUNTRY_VALUE_REQUIRED"
        : "CONFIG_VALUE_MISSING";
    throw configurationError(code, "Configuration value is missing");
  }

  try {
    assertConfigValueIsNotSecret(key, result.value);
    const value = definition.valueSchema.parse(result.value) as T;
    return {
      key,
      value,
      source: result.source,
      resolutionPolicy: definition.resolutionPolicy,
      ...(countryCode === undefined ? {} : { countryCode })
    };
  } catch {
    throw configurationError("CONFIG_VALUE_INVALID", "Configuration value is invalid");
  }
}

function configurationError(code: string, message: string): AppError {
  return new AppError({ code, message, statusCode: 400 });
}

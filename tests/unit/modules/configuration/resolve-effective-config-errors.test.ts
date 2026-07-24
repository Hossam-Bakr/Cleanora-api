import { describe, expect, it } from "vitest";

import { resolveEffectiveConfig } from "../../../../src/modules/configuration/application/resolve-effective-config.js";
import type {
  AppConfigRecord,
  ConfigurationRepositories,
  CountryConfigRecord
} from "../../../../src/modules/configuration/domain/configuration.types.js";

function createRepositories(
  appConfig: AppConfigRecord | undefined,
  countryConfig?: CountryConfigRecord
): ConfigurationRepositories {
  return {
    currency: { findByCode: async () => undefined },
    country: {
      findByCode: async () => ({
        code: "XX",
        nameEn: "Example",
        nameAr: "مثال",
        defaultCurrencyCode: "XXX",
        defaultLocale: "en-XX",
        supportedLocales: ["en-XX"],
        isActive: true
      }),
      findIdByCode: async () => "country-xx"
    },
    appConfig: { findByKey: async () => appConfig },
    countryConfig: { findByCountryIdAndKey: async () => countryConfig }
  };
}

describe("resolveEffectiveConfig failures", () => {
  it("fails explicitly for an unknown configuration key", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories(undefined),
        "unknown.configuration.key"
      )
    ).rejects.toMatchObject({ code: "CONFIG_KEY_UNKNOWN" });
  });

  it("rejects a country record for a GLOBAL_ONLY key", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories(
          {
            key: "platform.default_timezone",
            value: "UTC",
            valueKind: "STRING",
            resolutionPolicy: "GLOBAL_ONLY"
          },
          {
            key: "platform.default_timezone",
            value: "Africa/Cairo",
            valueKind: "STRING"
          }
        ),
        "platform.default_timezone",
        "XX"
      )
    ).rejects.toMatchObject({ code: "CONFIG_COUNTRY_OVERRIDE_REJECTED" });
  });

  it("rejects a secret-like configuration payload", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories({
          key: "country.display_name",
          value: null,
          valueKind: "OBJECT",
          resolutionPolicy: "COUNTRY_REQUIRED"
        }, {
          key: "country.display_name",
          value: { en: "Example", ar: "مثال", apiKey: "private" },
          valueKind: "OBJECT"
        }),
        "country.display_name",
        "XX"
      )
    ).rejects.toMatchObject({ code: "CONFIG_VALUE_INVALID" });
  });
});

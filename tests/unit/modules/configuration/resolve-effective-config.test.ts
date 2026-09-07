
import { resolveEffectiveConfigWith as resolveEffectiveConfig } from "../../../../src/modules/configuration/configuration.service.js";
import type {
  AppConfigRecord,
  ConfigurationRepositories,
  CountryConfigRecord
} from "../../../../src/modules/configuration/configuration.repository.js";

function createRepositories(
  appConfig: AppConfigRecord,
  countryConfig?: CountryConfigRecord,
  anyCountryOverride = false
): ConfigurationRepositories {
  return {
    currency: { findByCode: async () => undefined },
    country: {
      findByCode: async (code) =>
        code === "XX"
          ? {
              id: "country-xx",
              code: "XX",
              nameEn: "Example",
              nameAr: "مثال",
              defaultCurrencyCode: "XXX",
              defaultLocale: "en-XX",
              supportedLocales: ["en-XX"],
              isActive: true
            }
          : undefined,
      findIdByCode: async (code) => (code === "XX" ? "country-xx" : undefined)
    },
    appConfig: { findByKey: async () => appConfig },
    countryConfig: {
      existsByKey: async () => anyCountryOverride,
      findByCountryIdAndKey: async () => countryConfig
    }
  };
}

describe("resolveEffectiveConfig", () => {
  it("resolves GLOBAL_ONLY values from global configuration", async () => {
    const result = await resolveEffectiveConfig(
      createRepositories({
        key: "platform.default_timezone",
        value: "UTC",
        valueKind: "STRING",
        resolutionPolicy: "GLOBAL_ONLY"
      }),
      "platform.default_timezone"
    );

    expect(result).toEqual({
      key: "platform.default_timezone",
      value: "UTC",
      source: "global",
      resolutionPolicy: "GLOBAL_ONLY"
    });
  });

  it("reports a missing GLOBAL_ONLY global value explicitly", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories({
          key: "platform.default_timezone",
          value: null,
          valueKind: "STRING",
          resolutionPolicy: "GLOBAL_ONLY"
        }),
        "platform.default_timezone"
      )
    ).rejects.toMatchObject({ code: "CONFIG_VALUE_MISSING" });
  });

  it("prefers a country value for fallback-policy keys", async () => {
    const result = await resolveEffectiveConfig(
      createRepositories(
        {
          key: "country.supported_locales",
          value: ["en-XX"],
          valueKind: "ARRAY",
          resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
        },
        {
          key: "country.supported_locales",
          value: ["ar-XX", "en-XX"],
          valueKind: "ARRAY"
        }
      ),
      "country.supported_locales",
      "XX"
    );

    expect(result).toMatchObject({
      value: ["ar-XX", "en-XX"],
      source: "country",
      countryCode: "XX",
      resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
    });
  });

  it("falls back to global values when a country override is missing", async () => {
    const result = await resolveEffectiveConfig(
      createRepositories({
        key: "country.supported_locales",
        value: ["en-XX"],
        valueKind: "ARRAY",
        resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
      }),
      "country.supported_locales",
      "XX"
    );

    expect(result).toMatchObject({
      value: ["en-XX"],
      source: "global",
      countryCode: "XX"
    });
  });

  it("requires a country value for COUNTRY_REQUIRED keys", async () => {
    const result = await resolveEffectiveConfig(
      createRepositories(
        {
          key: "country.currency_code",
          value: null,
          valueKind: "STRING",
          resolutionPolicy: "COUNTRY_REQUIRED"
        },
        {
          key: "country.currency_code",
          value: "XXX",
          valueKind: "STRING"
        }
      ),
      "country.currency_code",
      "XX"
    );

    expect(result).toMatchObject({
      value: "XXX",
      source: "country",
      countryCode: "XX",
      resolutionPolicy: "COUNTRY_REQUIRED"
    });
  });
});

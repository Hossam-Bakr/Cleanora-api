
import { resolveEffectiveConfigWith as resolveEffectiveConfig } from "../../../../src/modules/configuration/configuration.service.js";
import type {
  AppConfigRecord,
  ConfigurationRepositories,
  CountryConfigRecord
} from "../../../../src/modules/configuration/configuration.repository.js";

function createRepositories(
  appConfig: AppConfigRecord | undefined,
  countryConfig?: CountryConfigRecord,
  options: {
    readonly countryActive?: boolean;
    readonly omitCountryId?: boolean;
    readonly anyCountryOverride?: boolean;
  } = {}
): ConfigurationRepositories {
  return {
    currency: { findByCode: async () => undefined },
    country: {
      findByCode: async () => ({
        id: "country-xx",
        code: "XX",
        nameEn: "Example",
        nameAr: "مثال",
        defaultCurrencyCode: "XXX",
        defaultLocale: "en-XX",
        supportedLocales: ["en-XX"],
        isActive: options.countryActive ?? true
      }),
      findIdByCode: async () =>
        options.omitCountryId ? undefined : "country-xx"
    },
    appConfig: { findByKey: async () => appConfig },
    countryConfig: {
      existsByKey: async () => options.anyCountryOverride ?? false,
      findByCountryIdAndKey: async () => countryConfig
    }
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

  it("rejects a corrupt GLOBAL_ONLY override without country context", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories(
          {
            key: "auth.endpoint_limits",
            value: { signupPer15Minutes: 5, loginPer15Minutes: 10 },
            valueKind: "OBJECT",
            resolutionPolicy: "GLOBAL_ONLY"
          },
          undefined,
          { anyCountryOverride: true }
        ),
        "auth.endpoint_limits"
      )
    ).rejects.toMatchObject({ code: "CONFIG_COUNTRY_OVERRIDE_REJECTED" });
  });

  it("rejects a corrupt GLOBAL_ONLY override with country context", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories(
          {
            key: "auth.endpoint_limits",
            value: { signupPer15Minutes: 5, loginPer15Minutes: 10 },
            valueKind: "OBJECT",
            resolutionPolicy: "GLOBAL_ONLY"
          },
          undefined,
          { anyCountryOverride: true }
        ),
        "auth.endpoint_limits",
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

  it("rejects persisted policy metadata that disagrees with the key catalog", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories({
          key: "platform.default_timezone",
          value: "UTC",
          valueKind: "STRING",
          resolutionPolicy: "GLOBAL_ONLY"
        }),
        "platform.default_timezone"
      )
    ).rejects.toMatchObject({ code: "CONFIG_VALUE_INVALID" });
  });

  it("rejects persisted app configuration kind metadata that disagrees with the key catalog", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories({
          key: "platform.default_timezone",
          value: "UTC",
          valueKind: "OBJECT",
          resolutionPolicy: "GLOBAL_ONLY"
        }),
        "platform.default_timezone"
      )
    ).rejects.toMatchObject({ code: "CONFIG_VALUE_INVALID" });
  });

  it("rejects persisted country configuration kind metadata that disagrees with the key catalog", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories(
          {
            key: "country.supported_locales",
            value: ["en-XX"],
            valueKind: "ARRAY",
            resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
          },
          {
            key: "country.supported_locales",
            value: ["en-XX"],
            valueKind: "STRING"
          }
        ),
        "country.supported_locales",
        "XX"
      )
    ).rejects.toMatchObject({ code: "CONFIG_VALUE_INVALID" });
  });

  it("fails closed when a country-required value has no country context", async () => {
    await expect(
      resolveEffectiveConfig(
        createRepositories({
          key: "country.currency_code",
          value: null,
          valueKind: "STRING",
          resolutionPolicy: "COUNTRY_REQUIRED"
        }),
        "country.currency_code"
      )
    ).rejects.toMatchObject({ code: "CONFIG_COUNTRY_VALUE_REQUIRED" });
  });

  it("rejects inactive countries and absent repository identifiers", async () => {
    const appConfig = {
      key: "country.supported_locales",
      value: ["en-XX"],
      valueKind: "ARRAY",
      resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK" as const
    };

    await expect(
      resolveEffectiveConfig(
        createRepositories(appConfig, undefined, { countryActive: false }),
        "country.supported_locales",
        "XX"
      )
    ).rejects.toMatchObject({ code: "COUNTRY_UNAVAILABLE" });
    await expect(
      resolveEffectiveConfig(
        createRepositories(appConfig, undefined, { omitCountryId: true }),
        "country.supported_locales",
        "XX"
      )
    ).rejects.toMatchObject({ code: "COUNTRY_UNAVAILABLE" });
  });
});

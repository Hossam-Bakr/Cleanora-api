
import {
  assertCountryCurrencySupported,
  getCountryByCode,
  getCurrencyByCode
} from "../../../../src/modules/configuration/application/country-currency.js";
import type { ConfigurationRepositories } from "../../../../src/modules/configuration/domain/configuration.types.js";

function createRepositories(
  options: {
    readonly countryActive?: boolean;
    readonly currencyActive?: boolean;
    readonly countryExists?: boolean;
    readonly currencyExists?: boolean;
  } = {}
): ConfigurationRepositories {
  return {
    country: {
      findByCode: async () =>
        options.countryExists === false
          ? undefined
          : {
              code: "XX",
              nameEn: "Example",
              nameAr: "مثال",
              defaultCurrencyCode: "XXX",
              defaultLocale: "en-XX",
              supportedLocales: ["en-XX"],
              isActive: options.countryActive ?? true
            },
      findIdByCode: async () => "country-xx"
    },
    currency: {
      findByCode: async () =>
        options.currencyExists === false
          ? undefined
          : {
              code: "XXX",
              nameEn: "Example Currency",
              nameAr: "عملة مثال",
              decimalPlaces: 2,
              isActive: options.currencyActive ?? true
            }
    },
    appConfig: { findByKey: async () => undefined },
    countryConfig: {
      existsByKey: async () => false,
      findByCountryIdAndKey: async () => undefined
    }
  };
}

describe("country and currency resolution", () => {
  it("returns active country and currency records", async () => {
    const repositories = createRepositories();

    await expect(getCountryByCode(repositories, "XX")).resolves.toMatchObject({
      code: "XX"
    });
    await expect(getCurrencyByCode(repositories, "XXX")).resolves.toMatchObject({
      code: "XXX"
    });
    await expect(
      assertCountryCurrencySupported(repositories, "XX")
    ).resolves.toBeUndefined();
  });

  it("rejects missing and inactive countries", async () => {
    await expect(
      getCountryByCode(createRepositories({ countryExists: false }), "XX")
    ).rejects.toMatchObject({ code: "COUNTRY_UNAVAILABLE" });
    await expect(
      getCountryByCode(createRepositories({ countryActive: false }), "XX")
    ).rejects.toMatchObject({ code: "COUNTRY_UNAVAILABLE" });
  });

  it("rejects missing and inactive currencies", async () => {
    await expect(
      getCurrencyByCode(createRepositories({ currencyExists: false }), "XXX")
    ).rejects.toMatchObject({ code: "CURRENCY_UNAVAILABLE" });
    await expect(
      assertCountryCurrencySupported(
        createRepositories({ currencyActive: false }),
        "XX"
      )
    ).rejects.toMatchObject({ code: "CURRENCY_UNAVAILABLE" });
  });
});


import {
  assertNoClientInventedCountryFacts,
  resolveCatalogCountryForAvailability,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import type {
  ActiveCountry,
  ActiveCountryReader,
} from "../../../src/modules/configuration/configuration.public.js";

/**
 * US3 country availability policy using Configuration-owned facts only
 * (FR-022, FR-023). Catalog never persists or invents Country rows.
 */

function fakeActiveCountryReader(options: {
  readonly activeByCode: ReadonlyMap<string, ActiveCountry>;
  readonly inactiveCodes?: ReadonlySet<string>;
}): ActiveCountryReader {
  const inactive = options.inactiveCodes ?? new Set<string>();
  return {
    async resolveActiveCountry(countryCode: string): Promise<ActiveCountry> {
      if (inactive.has(countryCode)) {
        throw Object.assign(new Error("Country is unavailable"), {
          code: "COUNTRY_UNAVAILABLE",
        });
      }
      const country = options.activeByCode.get(countryCode);
      if (country === undefined) {
        throw Object.assign(new Error("Country is unavailable"), {
          code: "COUNTRY_UNAVAILABLE",
        });
      }
      return country;
    },
    async getActiveCountryById(countryId: string): Promise<ActiveCountry | null> {
      for (const country of options.activeByCode.values()) {
        if (country.id === countryId) {
          return country;
        }
      }
      return null;
    },
  };
}

describe("catalog country policy (US3)", () => {
  it("resolves authoritative active EG through ActiveCountryReader facts", async () => {
    const reader = fakeActiveCountryReader({
      activeByCode: new Map([
        ["EG", { id: "country_eg", code: "EG" }],
      ]),
    });

    await expect(
      resolveCatalogCountryForAvailability(reader, "EG"),
    ).resolves.toEqual({ id: "country_eg", code: "EG" });
  });

  it("rejects inactive countries without accepting them as availability targets", async () => {
    const reader = fakeActiveCountryReader({
      activeByCode: new Map(),
      inactiveCodes: new Set(["SA"]),
    });

    await expect(
      resolveCatalogCountryForAvailability(reader, "SA"),
    ).rejects.toBeInstanceOf(CatalogError);

    await expect(
      resolveCatalogCountryForAvailability(reader, "SA"),
    ).rejects.toMatchObject({ code: "CATALOG_COUNTRY_UNAVAILABLE" });
  });

  it("rejects unknown country codes without inventing Catalog Country persistence", async () => {
    const reader = fakeActiveCountryReader({
      activeByCode: new Map([
        ["EG", { id: "country_eg", code: "EG" }],
      ]),
    });

    await expect(
      resolveCatalogCountryForAvailability(reader, "ZZ"),
    ).rejects.toMatchObject({ code: "CATALOG_COUNTRY_UNAVAILABLE" });

    expect(reader).not.toHaveProperty("createCountry");
    expect(reader).not.toHaveProperty("upsertCountry");
  });

  it("rejects client-invented country identity or active-state facts", () => {
    expect(() =>
      assertNoClientInventedCountryFacts({
        countryCode: "EG",
      }),
    ).not.toThrow();

    expect(() =>
      assertNoClientInventedCountryFacts({
        countryCode: "EG",
        countryId: "client_invented_id",
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertNoClientInventedCountryFacts({
        countryCode: "EG",
        active: true,
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertNoClientInventedCountryFacts({
        countryCode: "EG",
        isActive: false,
      }),
    ).toThrow(CatalogError);
  });
});

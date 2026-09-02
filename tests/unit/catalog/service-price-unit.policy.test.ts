
import {
  assertExactOrderVector,
  PRICE_AMOUNT_FORBIDDEN_KEYS,
  assertNoPriceAmountFields,
  assertPriceUnitActivationContent,
  assertPriceUnitInput,
  assertServiceConfigurationGraph,
  assertStableCode,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

/**
 * US2 price-unit policy (FR-013–FR-015).
 */
describe("service price unit policy", () => {
  it("accepts stable uppercase codes and trims blank localized labels to null", () => {
    const unit = assertPriceUnitInput({
      code: "PER_HOUR",
      labelAr: "   ",
      labelEn: " Per hour ",
      isActive: false,
    });
    expect(unit.code).toBe("PER_HOUR");
    expect(unit.labelAr).toBeNull();
    expect(unit.labelEn).toBe("Per hour");
  });

  it("rejects lowercase or malformed stable codes", () => {
    expect(() =>
      assertStableCode("per_hour", { min: 2, max: 64, field: "code" }),
    ).toThrow(CatalogError);
  });

  it("rejects every forbidden provider price amount key", () => {
    for (const key of PRICE_AMOUNT_FORBIDDEN_KEYS) {
      expect(() =>
        assertNoPriceAmountFields({ code: "PER_VISIT", [key]: "99.00" }),
      ).toThrow(CatalogError);
    }
  });

  it("allows incomplete labels while inactive", () => {
    expect(() =>
      assertPriceUnitActivationContent({
        isActive: false,
        labelAr: null,
        labelEn: "Per visit",
      }),
    ).not.toThrow();
  });

  it("requires complete AR/EN labels when active", () => {
    expect(() =>
      assertPriceUnitActivationContent({
        isActive: true,
        labelAr: "لكل زيارة",
        labelEn: "Per visit",
      }),
    ).not.toThrow();
    expect(() =>
      assertPriceUnitActivationContent({
        isActive: true,
        labelAr: null,
        labelEn: "Per visit",
      }),
    ).toThrow(CatalogError);
  });

  it("rejects duplicate price-unit codes in one graph", () => {
    expect(() =>
      assertServiceConfigurationGraph({
        priceUnits: [
          { code: "PER_VISIT", labelAr: null, labelEn: null, isActive: false },
          { code: "PER_VISIT", labelAr: null, labelEn: null, isActive: false },
        ],
        fields: [],
      }),
    ).toThrow(CatalogError);
  });

  it("preserves exact request order through the configuration graph helper", () => {
    const graph = assertServiceConfigurationGraph({
      priceUnits: [
        {
          code: "PER_HOUR",
          labelAr: "لكل ساعة",
          labelEn: "Per hour",
          isActive: true,
        },
        {
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: "Per visit",
          isActive: true,
        },
      ],
      fields: [],
    });

    expect(graph.priceUnits.map((unit) => unit.code)).toEqual(["PER_HOUR", "PER_VISIT"]);

    const orderedCodes = graph.priceUnits.map((unit) => unit.code);
    assertExactOrderVector(orderedCodes, new Set(orderedCodes));
  });

  it("never normalizes provider price facts into the returned price-unit shape", () => {
    const unit = assertPriceUnitInput({
      code: "PER_VISIT",
      labelAr: "لكل زيارة",
      labelEn: "Per visit",
      isActive: true,
    });

    expect(unit).toEqual({
      code: "PER_VISIT",
      labelAr: "لكل زيارة",
      labelEn: "Per visit",
      isActive: true,
    });
    expect(unit).not.toHaveProperty("amount");
    expect(unit).not.toHaveProperty("price");
    expect(unit).not.toHaveProperty("currency");
  });
});

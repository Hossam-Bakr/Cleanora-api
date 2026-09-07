
import {
  compareMinorUnitsDigitStrings,
  evaluateOfferingUsability,
  formatMinorUnitsToCanonicalDecimal,
  initialPriceStatusFromApprovalRequired,
  parseCanonicalDecimalToMinorUnits,
  requireActiveCatalogPriceUnit,
  validateDurationMinutes,
  validateNotePair,
  validatePriceAndMinimumAgainstMaximum,
} from "../../../src/modules/providers/domain/provider-service.policy.js";
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

describe("provider-service configuration policy (T022)", () => {
  it("parses and formats canonical decimals without JS number money math", () => {
    expect(parseCanonicalDecimalToMinorUnits("120.00", 2)).toBe("12000");
    expect(formatMinorUnitsToCanonicalDecimal("12000", 2)).toBe("120.00");
    expect(compareMinorUnitsDigitStrings("15000", "12000")).toBe(1);
  });

  it("rejects whitespace, signs, exponents, grouping, and excess scale", () => {
    for (const bad of [" 1.00", "1.00 ", "+1.00", "1e2", "1,000.00", "1.001"]) {
      expect(() => parseCanonicalDecimalToMinorUnits(bad, 2)).toThrow(
        ProviderServiceError,
      );
    }
  });

  it("enforces positive price/minimum, minimum>=price, and country maximum", () => {
    expect(() =>
      validatePriceAndMinimumAgainstMaximum({
        priceDecimal: "0",
        minimumChargeDecimal: "1.00",
        maximumPriceDecimal: R1_P09_SENTINELS.maximumPrice,
        decimalPlaces: 2,
      }),
    ).toThrow(ProviderServiceError);

    expect(() =>
      validatePriceAndMinimumAgainstMaximum({
        priceDecimal: "200.00",
        minimumChargeDecimal: "150.00",
        maximumPriceDecimal: R1_P09_SENTINELS.maximumPrice,
        decimalPlaces: 2,
      }),
    ).toThrow(ProviderServiceError);

    expect(() =>
      validatePriceAndMinimumAgainstMaximum({
        priceDecimal: "10000.00",
        minimumChargeDecimal: "10000.00",
        maximumPriceDecimal: R1_P09_SENTINELS.maximumPrice,
        decimalPlaces: 2,
      }),
    ).toThrow(ProviderServiceError);

    expect(
      validatePriceAndMinimumAgainstMaximum({
        priceDecimal: R1_P09_SENTINELS.providerPrice,
        minimumChargeDecimal: R1_P09_SENTINELS.minimumCharge,
        maximumPriceDecimal: R1_P09_SENTINELS.maximumPrice,
        decimalPlaces: 2,
      }),
    ).toEqual({
      providerPriceMinorUnits: "12000",
      minimumChargeMinorUnits: "15000",
      maximumPriceMinorUnits: "999999",
    });
  });

  it("requires duration 1–1440 and note pairs both absent or both 1–1000", () => {
    expect(validateDurationMinutes(90)).toBe(90);
    expect(() => validateDurationMinutes(0)).toThrow(ProviderServiceError);
    expect(() => validateDurationMinutes(1441)).toThrow(ProviderServiceError);

    expect(validateNotePair({})).toEqual({ noteAr: null, noteEn: null });
    expect(
      validateNotePair({
        noteAr: R1_P09_SENTINELS.noteAr,
        noteEn: R1_P09_SENTINELS.noteEn,
      }),
    ).toEqual({
      noteAr: R1_P09_SENTINELS.noteAr,
      noteEn: R1_P09_SENTINELS.noteEn,
    });
    expect(() =>
      validateNotePair({ noteAr: "only-ar", noteEn: null }),
    ).toThrow(ProviderServiceError);
  });

  it("maps approvalRequired to initial PENDING or EFFECTIVE", () => {
    expect(initialPriceStatusFromApprovalRequired(true)).toBe("PENDING");
    expect(initialPriceStatusFromApprovalRequired(false)).toBe("EFFECTIVE");
  });

  it("requires the selected Catalog unit to be currently active", () => {
    expect(
      requireActiveCatalogPriceUnit({
        catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
        activePriceUnits: [
          {
            id: R1_P09_IDS.catalogPriceUnitId,
            code: R1_P09_IDS.catalogPriceUnitCode,
          },
        ],
      }),
    ).toEqual({
      id: R1_P09_IDS.catalogPriceUnitId,
      code: R1_P09_IDS.catalogPriceUnitCode,
    });

    expect(() =>
      requireActiveCatalogPriceUnit({
        catalogPriceUnitId: "missing-unit",
        activePriceUnits: [],
      }),
    ).toThrow(ProviderServiceError);
  });

  it("marks disabled offerings unusable and surfaces DEC-051 blockers", () => {
    expect(
      evaluateOfferingUsability({
        enabled: false,
        estimatedDurationMinutes: 90,
        noteAr: null,
        noteEn: null,
        catalogSelectable: true,
        priceUnitActive: true,
        hasEffectivePrice: false,
        hasPendingPrice: true,
      }),
    ).toEqual({
      usable: false,
      blockerCodes: ["PRICE_APPROVAL_PENDING"],
    });
  });
});

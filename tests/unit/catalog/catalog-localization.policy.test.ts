
import {
  assertCategoryActivationContent,
  assertExactLocalesComplete,
  assertServiceActivationContent,
  assertStableCode,
  assertUniqueLocales,
  normalizeOptionalLocalizedText,
  STABLE_CODE_PATTERN,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

/**
 * US1 localization / identity policy (FR-003–FR-005, FR-008–FR-012, SC-002).
 */
describe("catalog localization policy", () => {
  it("accepts uppercase stable codes and rejects lowercase or blank codes", () => {
    expect(assertStableCode("HOME_CLEANING", { min: 2, max: 80, field: "code" })).toBe(
      "HOME_CLEANING",
    );
    expect(STABLE_CODE_PATTERN.test("home_cleaning")).toBe(false);
    expect(() =>
      assertStableCode("home_cleaning", { min: 2, max: 80, field: "code" }),
    ).toThrow(CatalogError);
    expect(() => assertStableCode("A", { min: 2, max: 80, field: "code" })).toThrow(
      CatalogError,
    );
  });

  it("trims localized content and treats blank as null", () => {
    expect(normalizeOptionalLocalizedText("  Home  ")).toBe("Home");
    expect(normalizeOptionalLocalizedText("   ")).toBeNull();
    expect(normalizeOptionalLocalizedText(null)).toBeNull();
    expect(normalizeOptionalLocalizedText(undefined)).toBeNull();
  });

  it("allows incomplete bilingual category content only while inactive", () => {
    expect(() =>
      assertCategoryActivationContent({
        isActive: false,
        nameAr: null,
        nameEn: "Home Cleaning",
        descriptionAr: null,
        descriptionEn: "Desc",
      }),
    ).not.toThrow();
  });

  it("requires complete AR and EN category content for activation", () => {
    expect(() =>
      assertCategoryActivationContent({
        isActive: true,
        nameAr: "تنظيف المنازل",
        nameEn: "Home Cleaning",
        descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
        descriptionEn: "Home cleaning and housekeeping services.",
      }),
    ).not.toThrow();

    expect(() =>
      assertCategoryActivationContent({
        isActive: true,
        nameAr: null,
        nameEn: "Home Cleaning",
        descriptionAr: "وصف",
        descriptionEn: "Desc",
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertCategoryActivationContent({
        isActive: true,
        nameAr: "   ",
        nameEn: "Home Cleaning",
        descriptionAr: "وصف",
        descriptionEn: "Desc",
      }),
    ).toThrow(CatalogError);
  });

  it("never falls back across locales for exact-locale completeness", () => {
    expect(() =>
      assertExactLocalesComplete({
        translations: [{ locale: "EN", name: "Standard", description: "Routine" }],
        requiredLocales: ["AR", "EN"],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertExactLocalesComplete({
        translations: [
          { locale: "AR", name: "تنظيف", description: "دوري" },
          { locale: "EN", name: "Standard", description: "Routine" },
        ],
        requiredLocales: ["AR", "EN"],
      }),
    ).not.toThrow();
  });

  it("requires complete AR and EN service translations for activation", () => {
    expect(() =>
      assertServiceActivationContent({
        isActive: true,
        translations: [
          { locale: "AR", name: "تنظيف منزلي قياسي", description: "تنظيف دوري للمنزل." },
          { locale: "EN", name: "Standard Home Cleaning", description: "Routine cleaning for a home." },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      assertServiceActivationContent({
        isActive: true,
        translations: [
          { locale: "EN", name: "Standard Home Cleaning", description: "Routine cleaning for a home." },
        ],
      }),
    ).toThrow(CatalogError);
  });

  it("allows incomplete service translations only while inactive", () => {
    expect(() =>
      assertServiceActivationContent({
        isActive: false,
        translations: [{ locale: "EN", name: "Draft", description: null }],
      }),
    ).not.toThrow();
  });

  it("rejects duplicate locales in one service translation payload", () => {
    expect(() =>
      assertUniqueLocales([
        { locale: "EN" },
        { locale: "EN" },
      ]),
    ).toThrow(CatalogError);
    expect(() => assertUniqueLocales([{ locale: "AR" }, { locale: "EN" }])).not.toThrow();
  });
});

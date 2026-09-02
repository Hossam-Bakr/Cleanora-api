
import {
  CATALOG_LIFECYCLE_ACTIONS,
  assertActiveServiceStoredConfiguration,
  assertCategoryLifecycleChange,
  assertServiceActivationPolicy,
  isServiceSelectable,
  listSelectableChildren,
  resolveExactLocaleContent,
  resolveLifecycleTarget,
  type CatalogLocaleCode,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

/**
 * US3 category/service activation and selectability truth tables
 * (FR-011, FR-014, FR-022–FR-026, SC-004, DEC-041).
 */

const completeTranslations = [
  {
    locale: "AR" as const,
    name: "تنظيف منزلي قياسي",
    description: "تنظيف دوري للمنزل.",
  },
  {
    locale: "EN" as const,
    name: "Standard Home Cleaning",
    description: "Routine cleaning for a home.",
  },
];

const completePriceUnit = {
  code: "PER_VISIT",
  isActive: true,
  labelAr: "لكل زيارة",
  labelEn: "Per visit",
};

const incompletePriceUnit = {
  code: "PER_HOUR",
  isActive: true,
  labelAr: null as string | null,
  labelEn: "Per hour",
};

const inactiveIncompleteField = {
  id: "field_draft",
  code: "DRAFT_NOTES",
  isActive: false,
  labelAr: null as string | null,
  labelEn: null as string | null,
  options: [] as const,
};

const activeCompleteField = {
  id: "field_info",
  code: "PREPARATION_INFORMATION",
  isActive: true,
  labelAr: "راجع تفاصيل الخدمة قبل الحجز.",
  labelEn: "Review the service details before booking.",
  options: [] as const,
};

const activeIncompleteField = {
  id: "field_bad",
  code: "BEDROOM_COUNT",
  isActive: true,
  labelAr: null as string | null,
  labelEn: "Number of bedrooms",
  options: [] as const,
};

const selectableBase = {
  countryIsAuthoritativeAndActive: true,
  categoryIsActive: true,
  serviceIsActive: true,
  countryAvailabilityIsAvailable: true,
  requestedLocale: "EN" as CatalogLocaleCode,
  translations: completeTranslations,
  priceUnits: [completePriceUnit],
  fields: [activeCompleteField],
};

describe("catalog lifecycle policy (US3)", () => {
  it("exposes only ACTIVATE and DEACTIVATE with no third draft lifecycle state", () => {
    expect([...CATALOG_LIFECYCLE_ACTIONS]).toEqual(["ACTIVATE", "DEACTIVATE"]);
    expect(CATALOG_LIFECYCLE_ACTIONS).not.toContain("DRAFT");
    expect(resolveLifecycleTarget("ACTIVATE")).toBe(true);
    expect(resolveLifecycleTarget("DEACTIVATE")).toBe(false);
  });

  it("requires complete AR/EN category content before activation", () => {
    expect(() =>
      assertCategoryLifecycleChange({
        action: "ACTIVATE",
        nameAr: "تنظيف المنازل",
        nameEn: "Home Cleaning",
        descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
        descriptionEn: "Home cleaning and housekeeping services.",
      }),
    ).not.toThrow();

    expect(() =>
      assertCategoryLifecycleChange({
        action: "ACTIVATE",
        nameAr: null,
        nameEn: "Home Cleaning",
        descriptionAr: "وصف",
        descriptionEn: "Desc",
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertCategoryLifecycleChange({
        action: "DEACTIVATE",
        nameAr: null,
        nameEn: null,
        descriptionAr: null,
        descriptionEn: null,
      }),
    ).not.toThrow();
  });

  it("requires an active category, bilingual service content, and an active complete price unit to activate", () => {
    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [completePriceUnit],
        fields: [],
      }),
    ).not.toThrow();

    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: false,
        translations: completeTranslations,
        priceUnits: [completePriceUnit],
        fields: [],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: [
          {
            locale: "EN",
            name: "Standard Home Cleaning",
            description: "Routine cleaning for a home.",
          },
        ],
        priceUnits: [completePriceUnit],
        fields: [],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [],
        fields: [],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [incompletePriceUnit],
        fields: [],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [{ ...completePriceUnit, isActive: false }],
        fields: [],
      }),
    ).toThrow(CatalogError);
  });

  it("allows zero active fields on activation and deactivation without bilingual prerequisites", () => {
    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [completePriceUnit],
        fields: [inactiveIncompleteField],
      }),
    ).not.toThrow();

    expect(() =>
      assertServiceActivationPolicy({
        action: "DEACTIVATE",
        categoryIsActive: false,
        translations: [],
        priceUnits: [],
        fields: [activeIncompleteField],
      }),
    ).not.toThrow();
  });

  it("rejects activation when an active field or option is incomplete", () => {
    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [completePriceUnit],
        fields: [activeIncompleteField],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceActivationPolicy({
        action: "ACTIVATE",
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [completePriceUnit],
        fields: [
          {
            ...activeCompleteField,
            options: [
              {
                id: "opt_1",
                value: "YES",
                isActive: true,
                labelAr: null,
                labelEn: "Yes",
              },
            ],
          },
        ],
      }),
    ).toThrow(CatalogError);
  });

  it("rejects stored activation when an active NUMBER field violates DEC-042 kind rules", () => {
    expect(() =>
      assertActiveServiceStoredConfiguration({
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [completePriceUnit],
        fields: [
          {
            code: "BEDROOM_COUNT",
            kind: "NUMBER",
            isRequired: false,
            isActive: true,
            labelAr: "عدد غرف النوم",
            labelEn: "Number of bedrooms",
            helpTextAr: null,
            helpTextEn: null,
            minLength: null,
            maxLength: null,
            numberMode: null,
            minValue: null,
            maxValue: null,
            minSelections: null,
            maxSelections: null,
            options: [],
          },
        ],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertActiveServiceStoredConfiguration({
        categoryIsActive: true,
        translations: completeTranslations,
        priceUnits: [completePriceUnit],
        fields: [
          {
            code: "BEDROOM_COUNT",
            kind: "NUMBER",
            isRequired: false,
            isActive: true,
            labelAr: "عدد غرف النوم",
            labelEn: "Number of bedrooms",
            helpTextAr: null,
            helpTextEn: null,
            minLength: null,
            maxLength: null,
            numberMode: "INTEGER",
            minValue: "0",
            maxValue: null,
            minSelections: null,
            maxSelections: null,
            options: [],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("is selectable only when category, service, country availability, locale, and price unit gates all pass", () => {
    expect(isServiceSelectable(selectableBase)).toBe(true);

    expect(
      isServiceSelectable({
        ...selectableBase,
        categoryIsActive: false,
      }),
    ).toBe(false);

    expect(
      isServiceSelectable({
        ...selectableBase,
        serviceIsActive: false,
      }),
    ).toBe(false);

    expect(
      isServiceSelectable({
        ...selectableBase,
        countryIsAuthoritativeAndActive: false,
      }),
    ).toBe(false);

    expect(
      isServiceSelectable({
        ...selectableBase,
        countryAvailabilityIsAvailable: false,
      }),
    ).toBe(false);

    expect(
      isServiceSelectable({
        ...selectableBase,
        priceUnits: [],
      }),
    ).toBe(false);

    expect(
      isServiceSelectable({
        ...selectableBase,
        priceUnits: [incompletePriceUnit],
      }),
    ).toBe(false);

    expect(
      isServiceSelectable({
        ...selectableBase,
        fields: [],
      }),
    ).toBe(true);
  });

  it("keeps inactive children out of selectable child sets without blocking an otherwise selectable service", () => {
    const children = listSelectableChildren({
      priceUnits: [
        completePriceUnit,
        {
          code: "PER_HOUR",
          isActive: false,
          labelAr: null,
          labelEn: null,
        },
      ],
      fields: [activeCompleteField, inactiveIncompleteField],
    });

    expect(
      children.priceUnits.map((unit: { code: string }) => unit.code),
    ).toEqual(["PER_VISIT"]);
    expect(
      children.fields.map((field: { code: string }) => field.code),
    ).toEqual(["PREPARATION_INFORMATION"]);

    expect(
      isServiceSelectable({
        ...selectableBase,
        fields: [activeCompleteField, inactiveIncompleteField],
      }),
    ).toBe(true);

    expect(
      isServiceSelectable({
        ...selectableBase,
        fields: [activeIncompleteField],
      }),
    ).toBe(false);
  });

  it("fails exact-locale reads safely without falling back to the other language", () => {
    const enOnly = [
      {
        locale: "EN" as const,
        name: "Standard Home Cleaning",
        description: "Routine cleaning for a home.",
      },
    ];

    expect(() =>
      resolveExactLocaleContent({
        translations: enOnly,
        locale: "AR",
      }),
    ).toThrow(CatalogError);

    expect(() =>
      resolveExactLocaleContent({
        translations: enOnly,
        locale: "EN",
      }),
    ).not.toThrow();

    const resolved = resolveExactLocaleContent({
      translations: completeTranslations,
      locale: "AR",
    });
    expect(resolved).toEqual({
      name: "تنظيف منزلي قياسي",
      description: "تنظيف دوري للمنزل.",
    });
    expect(resolved.name).not.toBe("Standard Home Cleaning");

    expect(
      isServiceSelectable({
        ...selectableBase,
        requestedLocale: "AR",
        translations: enOnly,
      }),
    ).toBe(false);
  });
});

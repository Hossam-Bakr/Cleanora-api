
import {
  EGYPT_HOUSEKEEPING_SEED,
  decideCatalogSeedRowAction,
} from "../../../src/modules/catalog/catalog.policy.js";

/**
 * US3 DEC-044 Egypt housekeeping seed identities and create-if-missing /
 * preserve-owner-change policy (FR-047–FR-049, SC-005). Pure policy only —
 * does not invoke a database or `prisma/seed.ts`.
 */
describe("catalog seed policy (US3 / DEC-044)", () => {
  it("defines the exact approved Egypt housekeeping identities and content direction", () => {
    expect(EGYPT_HOUSEKEEPING_SEED.category).toEqual({
      code: "HOME_CLEANING",
      nameEn: "Home Cleaning",
      nameAr: "تنظيف المنازل",
      descriptionEn: "Home cleaning and housekeeping services.",
      descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
      displayOrder: 0,
      isActive: true,
    });

    expect(EGYPT_HOUSEKEEPING_SEED.service).toEqual({
      code: "STANDARD_HOME_CLEANING",
      categoryCode: "HOME_CLEANING",
      nameEn: "Standard Home Cleaning",
      nameAr: "تنظيف منزلي قياسي",
      descriptionEn: "Routine cleaning for a home.",
      descriptionAr: "تنظيف دوري للمنزل.",
      displayOrder: 0,
      isActive: true,
    });

    expect(EGYPT_HOUSEKEEPING_SEED.priceUnits).toEqual([
      {
        code: "PER_VISIT",
        labelEn: "Per visit",
        labelAr: "لكل زيارة",
        displayOrder: 0,
        isActive: true,
      },
      {
        code: "PER_HOUR",
        labelEn: "Per hour",
        labelAr: "لكل ساعة",
        displayOrder: 1,
        isActive: true,
      },
    ]);

    expect(EGYPT_HOUSEKEEPING_SEED.fields).toEqual([
      {
        code: "PREPARATION_INFORMATION",
        kind: "INFORMATION",
        labelEn: "Review the service details before booking.",
        labelAr: "راجع تفاصيل الخدمة قبل الحجز.",
        isRequired: false,
        isActive: true,
        displayOrder: 0,
        numberMode: null,
        minValue: null,
        maxValue: null,
        minLength: null,
        maxLength: null,
      },
      {
        code: "BEDROOM_COUNT",
        kind: "NUMBER",
        labelEn: "Number of bedrooms",
        labelAr: "عدد غرف النوم",
        isRequired: false,
        isActive: true,
        displayOrder: 1,
        numberMode: "INTEGER",
        minValue: "0",
        maxValue: null,
        minLength: null,
        maxLength: null,
      },
      {
        code: "BATHROOM_COUNT",
        kind: "NUMBER",
        labelEn: "Number of bathrooms",
        labelAr: "عدد الحمامات",
        isRequired: false,
        isActive: true,
        displayOrder: 2,
        numberMode: "INTEGER",
        minValue: "0",
        maxValue: null,
        minLength: null,
        maxLength: null,
      },
      {
        code: "PETS_PRESENT",
        kind: "BOOLEAN",
        labelEn: "Are pets present?",
        labelAr: "هل توجد حيوانات أليفة؟",
        isRequired: false,
        isActive: true,
        displayOrder: 3,
        numberMode: null,
        minValue: null,
        maxValue: null,
        minLength: null,
        maxLength: null,
      },
      {
        code: "SPECIAL_INSTRUCTIONS",
        kind: "TEXT",
        labelEn: "Special instructions",
        labelAr: "تعليمات خاصة",
        isRequired: false,
        isActive: true,
        displayOrder: 4,
        numberMode: null,
        minValue: null,
        maxValue: null,
        minLength: null,
        maxLength: 1000,
      },
    ]);

    expect(EGYPT_HOUSEKEEPING_SEED.availability).toEqual({
      countryCode: "EG",
      isAvailable: true,
    });

    expect(EGYPT_HOUSEKEEPING_SEED.counts).toEqual({
      categories: 1,
      services: 1,
      priceUnits: 2,
      fields: 5,
      availabilities: 1,
      media: 0,
    });

    const fieldKinds = EGYPT_HOUSEKEEPING_SEED.fields.map(
      (field: { kind: string }) => field.kind,
    );
    expect(fieldKinds).toEqual([
      "INFORMATION",
      "NUMBER",
      "NUMBER",
      "BOOLEAN",
      "TEXT",
    ]);
    expect(fieldKinds).not.toContain("SINGLE_SELECT");
    expect(fieldKinds).not.toContain("MULTI_SELECT");
  });

  it("remains neutral on OQ-002 and never seeds Media files", () => {
    const serialized = JSON.stringify(EGYPT_HOUSEKEEPING_SEED);
    expect(serialized.toLowerCase()).not.toMatch(/materials|bring your own|customer.?supplies|provider.?supplies/);
    expect(EGYPT_HOUSEKEEPING_SEED.counts.media).toBe(0);
    expect(EGYPT_HOUSEKEEPING_SEED).not.toHaveProperty("media");
  });

  it("creates missing stable-code rows and preserves later owner-managed changes", () => {
    expect(
      decideCatalogSeedRowAction({
        stableCode: "HOME_CLEANING",
        existing: null,
      }),
    ).toBe("CREATE");

    expect(
      decideCatalogSeedRowAction({
        stableCode: "HOME_CLEANING",
        existing: {
          code: "HOME_CLEANING",
          isActive: true,
          nameEn: "Home Cleaning",
          version: 1,
        },
      }),
    ).toBe("PRESERVE");

    expect(
      decideCatalogSeedRowAction({
        stableCode: "HOME_CLEANING",
        existing: {
          code: "HOME_CLEANING",
          isActive: false,
          nameEn: "Owner renamed category",
          version: 4,
        },
      }),
    ).toBe("PRESERVE");

    expect(
      decideCatalogSeedRowAction({
        stableCode: "STANDARD_HOME_CLEANING",
        existing: {
          code: "STANDARD_HOME_CLEANING",
          isActive: true,
          nameEn: "Owner renamed service",
          displayOrder: 3,
          version: 9,
        },
      }),
    ).toBe("PRESERVE");

    expect(
      decideCatalogSeedRowAction({
        stableCode: "PER_VISIT",
        existing: null,
      }),
    ).toBe("CREATE");

    expect(
      decideCatalogSeedRowAction({
        stableCode: "PER_VISIT",
        existing: {
          code: "PER_VISIT",
          isActive: false,
          labelEn: "Owner label",
          version: 2,
        },
      }),
    ).toBe("PRESERVE");
  });

  it("never silently reactivates or rewrites an existing inactive seed identity", () => {
    const decision = decideCatalogSeedRowAction({
      stableCode: "STANDARD_HOME_CLEANING",
      existing: {
        code: "STANDARD_HOME_CLEANING",
        isActive: false,
        nameEn: "Standard Home Cleaning",
        version: 2,
      },
    });

    expect(decision).toBe("PRESERVE");
    expect(decision).not.toBe("CREATE");
    expect(decision).not.toBe("UPDATE");
    expect(decision).not.toBe("REACTIVATE");
  });
});

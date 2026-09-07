
import {
  createCatalogDefinitionReader,
  toCategoryManagementDto,
  toServiceManagementDto,
} from "../../../src/modules/catalog/catalog.public.js";
import {
  projectSnapshotReadyConfiguration,
  resolveExactLocaleHelpText,
  resolveExactLocaleLabel,
} from "../../../src/modules/catalog/catalog.definition-projection.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import type { CatalogServiceWithConfigurationRow } from "../../../src/modules/catalog/catalog.repository.js";

const stamp = new Date("2026-01-01T00:00:00.000Z");

describe("catalog.public DTOs and factory", () => {
  it("maps category and service rows to management DTOs with ISO timestamps", () => {
    expect(
      toCategoryManagementDto({
        id: "cat_1",
        code: "HOME_CLEANING",
        nameAr: "تنظيف",
        nameEn: "Cleaning",
        descriptionAr: "وصف",
        descriptionEn: "Desc",
        displayOrder: 0,
        isActive: true,
        version: 2,
        createdAt: stamp,
        updatedAt: stamp,
      }),
    ).toEqual(
      expect.objectContaining({
        id: "cat_1",
        createdAt: stamp.toISOString(),
        updatedAt: stamp.toISOString(),
      }),
    );

    expect(
      toServiceManagementDto({
        id: "svc_1",
        categoryId: "cat_1",
        code: "STANDARD_HOME_CLEANING",
        displayOrder: 0,
        isActive: false,
        version: 1,
        createdAt: stamp,
        updatedAt: stamp,
        translations: [{ locale: "EN", name: "A", description: "B" }],
      }).priceUnits,
    ).toEqual([]);

    const withFields = toServiceManagementDto({
      id: "svc_2",
      categoryId: "cat_1",
      code: "DEEP_CLEAN",
      displayOrder: 1,
      isActive: true,
      version: 3,
      createdAt: stamp,
      updatedAt: stamp,
      translations: [{ locale: "AR", name: "ع", description: null }],
      priceUnits: [
        {
          id: "pu_1",
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: "Per visit",
          displayOrder: 0,
          isActive: true,
        },
      ],
      fields: [
        {
          id: "field_1",
          code: "ROOMS",
          kind: "NUMBER",
          labelAr: "غرف",
          labelEn: "Rooms",
          helpTextAr: null,
          helpTextEn: "Count",
          isRequired: true,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: "INTEGER",
          minValue: "1",
          maxValue: "20",
          minSelections: null,
          maxSelections: null,
          displayOrder: 0,
          options: [
            {
              id: "opt_1",
              value: "A",
              labelAr: "أ",
              labelEn: "A",
              displayOrder: 0,
              isActive: true,
            },
          ],
        },
      ],
    });
    expect(withFields.fields).toHaveLength(1);
    expect(withFields.fields[0]?.options).toEqual([
      {
        id: "opt_1",
        value: "A",
        labelAr: "أ",
        labelEn: "A",
        displayOrder: 0,
        isActive: true,
      },
    ]);
  });

  it("forwards only the definition reader surface from the factory", async () => {
    const reader = createCatalogDefinitionReader({
      listSelectable: async () => ({ items: [], nextCursor: null }),
      getSnapshotReadyDefinition: async () => null,
      resolveSelectableProviderOffering: async () => null,
      getProviderOfferingReference: async () => null,
      getSnapshotReadyDefinitionById: async () => null,
    });
    await expect(
      reader.listSelectable({ countryCode: "EG", locale: "EN" }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    await expect(
      reader.getSnapshotReadyDefinition({
        serviceCode: "X",
        countryCode: "EG",
        locale: "AR",
      }),
    ).resolves.toBeNull();
    await expect(
      reader.resolveSelectableProviderOffering({
        serviceCode: "X",
        countryCode: "EG",
      }),
    ).resolves.toBeNull();
  });
});

describe("catalog.definition-projection edge paths", () => {
  it("resolves exact-locale labels and help text without cross-locale fallback", () => {
    expect(
      resolveExactLocaleLabel({
        labelAr: "عربي",
        labelEn: "English",
        locale: "AR",
      }),
    ).toBe("عربي");
    expect(
      resolveExactLocaleHelpText({
        helpTextAr: null,
        helpTextEn: "Help",
        locale: "EN",
      }),
    ).toBe("Help");
    expect(() =>
      resolveExactLocaleLabel({
        labelAr: null,
        labelEn: "English",
        locale: "AR",
      }),
    ).toThrow(CatalogError);
  });

  it("returns null when an active price unit lacks the requested locale", () => {
    const service: CatalogServiceWithConfigurationRow = {
      id: "svc_1",
      categoryId: "cat_1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 0,
      isActive: true,
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
      translations: [
        { locale: "AR", name: "أ", description: "ب" },
        { locale: "EN", name: "A", description: "B" },
      ],
      priceUnits: [
        {
          id: "pu_1",
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: null,
          displayOrder: 0,
          isActive: true,
        },
      ],
      fields: [],
    };

    expect(
      projectSnapshotReadyConfiguration({ service, locale: "EN" }),
    ).toBeNull();
    expect(
      projectSnapshotReadyConfiguration({ service, locale: "AR" }),
    ).toEqual({
      priceUnits: [
        {
          id: "pu_1",
          code: "PER_VISIT",
          label: "لكل زيارة",
          displayOrder: 0,
        },
      ],
      fields: [],
    });
  });

  it("projects active field kinds including select options and number rules", () => {
    const service: CatalogServiceWithConfigurationRow = {
      id: "svc_1",
      categoryId: "cat_1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 0,
      isActive: true,
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
      translations: [
        { locale: "AR", name: "أ", description: "ب" },
        { locale: "EN", name: "A", description: "B" },
      ],
      priceUnits: [
        {
          id: "pu_1",
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: "Per visit",
          displayOrder: 0,
          isActive: true,
        },
      ],
      fields: [
        {
          id: "f_info",
          code: "INFO",
          kind: "INFORMATION",
          labelAr: "م",
          labelEn: "Info",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 0,
          options: [],
        },
        {
          id: "f_text",
          code: "NOTES",
          kind: "TEXT",
          labelAr: "ملاحظات",
          labelEn: "Notes",
          helpTextAr: "مساعدة",
          helpTextEn: "Help",
          isRequired: true,
          isActive: true,
          minLength: 1,
          maxLength: 40,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 1,
          options: [],
        },
        {
          id: "f_num",
          code: "ROOMS",
          kind: "NUMBER",
          labelAr: "غرف",
          labelEn: "Rooms",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: true,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: "INTEGER",
          minValue: "1",
          maxValue: "10",
          minSelections: null,
          maxSelections: null,
          displayOrder: 2,
          options: [],
        },
        {
          id: "f_single",
          code: "PACKAGE",
          kind: "SINGLE_SELECT",
          labelAr: "باقة",
          labelEn: "Package",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: true,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: 1,
          maxSelections: 1,
          displayOrder: 3,
          options: [
            {
              id: "opt_a",
              value: "A",
              labelAr: "أ",
              labelEn: "A",
              displayOrder: 1,
              isActive: true,
            },
            {
              id: "opt_b",
              value: "B",
              labelAr: "ب",
              labelEn: "B",
              displayOrder: 0,
              isActive: false,
            },
          ],
        },
        {
          id: "f_multi",
          code: "EXTRAS",
          kind: "MULTI_SELECT",
          labelAr: "إضافات",
          labelEn: "Extras",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: 0,
          maxSelections: 3,
          displayOrder: 4,
          options: [
            {
              id: "opt_x",
              value: "X",
              labelAr: "س",
              labelEn: "X",
              displayOrder: 0,
              isActive: true,
            },
          ],
        },
        {
          id: "f_bool",
          code: "PETS",
          kind: "BOOLEAN",
          labelAr: "حيوانات",
          labelEn: "Pets",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 5,
          options: [],
        },
      ],
    };

    const projected = projectSnapshotReadyConfiguration({
      service,
      locale: "EN",
    });
    expect(projected).not.toBeNull();
    expect(projected?.fields.map((field) => field.kind)).toEqual([
      "INFORMATION",
      "TEXT",
      "NUMBER",
      "SINGLE_SELECT",
      "MULTI_SELECT",
      "BOOLEAN",
    ]);
    expect(
      projected?.fields.find((field) => field.kind === "NUMBER")?.numberRules,
    ).toEqual({ mode: "INTEGER", min: "1", max: "10" });
    expect(
      projected?.fields.find((field) => field.kind === "SINGLE_SELECT")?.options,
    ).toEqual([
      { id: "opt_a", value: "A", label: "A", displayOrder: 1 },
    ]);
  });
});

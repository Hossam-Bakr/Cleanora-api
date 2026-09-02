
import {
  assertFieldOptionInput,
  assertServiceConfigurationGraph,
  assertServiceFieldInput,
  assertServiceFieldKindCompatibility,
  SERVICE_FIELD_KINDS,
  type NormalizedFieldOptionInput,
  type NormalizedServiceFieldInput,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

const baseField = {
  code: "NOTES",
  labelAr: null,
  labelEn: null,
  helpTextAr: null,
  helpTextEn: null,
  isRequired: false,
  isActive: false,
  minLength: null,
  maxLength: null,
  numberMode: null,
  minValue: null,
  maxValue: null,
  minSelections: null,
  maxSelections: null,
  options: [] as const,
};

const normalizedBase = (
  overrides: Partial<NormalizedServiceFieldInput> = {},
): NormalizedServiceFieldInput => ({
  code: "NOTES",
  kind: "TEXT",
  labelAr: null,
  labelEn: null,
  helpTextAr: null,
  helpTextEn: null,
  isRequired: false,
  isActive: false,
  minLength: null,
  maxLength: null,
  numberMode: null,
  minValue: null,
  maxValue: null,
  minSelections: null,
  maxSelections: null,
  options: [],
  ...overrides,
});

/**
 * US2 six-kind field matrix (FR-016–FR-020, DEC-042).
 */
describe("service field policy", () => {
  it("supports exactly the closed six-kind catalog", () => {
    expect(SERVICE_FIELD_KINDS).toEqual([
      "INFORMATION",
      "TEXT",
      "NUMBER",
      "BOOLEAN",
      "SINGLE_SELECT",
      "MULTI_SELECT",
    ]);
  });

  it("accepts INFORMATION as display-only without constraints", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "INFORMATION",
        isRequired: false,
      }),
    ).not.toThrow();
  });

  it("rejects INFORMATION when constrained and coerces requiredness to false", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "INFORMATION",
        minLength: 1,
      }),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "INFORMATION",
        options: [{ value: "A", labelAr: null, labelEn: null, isActive: false }],
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceFieldKindCompatibility(
        normalizedBase({
          kind: "INFORMATION",
          isRequired: true,
        }),
      ),
    ).toThrow(CatalogError);

    const field = assertServiceFieldInput({
      ...baseField,
      kind: "INFORMATION",
      isRequired: true,
    });
    expect(field.isRequired).toBe(false);
  });

  it("accepts TEXT with optional non-negative length bounds", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "TEXT",
        minLength: 0,
        maxLength: 100,
      }),
    ).not.toThrow();
  });

  it("rejects TEXT with inverted bounds or foreign constraints", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "TEXT",
        minLength: 10,
        maxLength: 5,
      }),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldKindCompatibility(
        normalizedBase({
          kind: "TEXT",
          numberMode: "INTEGER",
        }),
      ),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldKindCompatibility(
        normalizedBase({
          kind: "TEXT",
          options: [
            { value: "A", labelAr: null, labelEn: null, isActive: false } satisfies NormalizedFieldOptionInput,
          ],
        }),
      ),
    ).toThrow(CatalogError);
  });

  it("accepts NUMBER with INTEGER canonical decimal-string bounds", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "NUMBER",
        numberMode: "INTEGER",
        minValue: "0",
        maxValue: "10",
      }),
    ).not.toThrow();
  });

  it("rejects NUMBER without mode at compatibility, with fractional INTEGER bounds, or foreign constraints", () => {
    expect(() =>
      assertServiceFieldKindCompatibility(
        normalizedBase({
          kind: "NUMBER",
          numberMode: null,
        }),
      ),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "NUMBER",
        numberMode: "INTEGER",
        minValue: "1.5",
      }),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "NUMBER",
        numberMode: "DECIMAL",
        minLength: 1,
      }),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "NUMBER",
        numberMode: "DECIMAL",
        minValue: "5",
        maxValue: "1",
      }),
    ).toThrow(CatalogError);
  });

  it("accepts BOOLEAN without options or bounds", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "BOOLEAN",
        isRequired: true,
      }),
    ).not.toThrow();
  });

  it("rejects BOOLEAN with options or bounds", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "BOOLEAN",
        minSelections: 1,
      }),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldKindCompatibility(
        normalizedBase({
          kind: "BOOLEAN",
          options: [{ value: "YES", labelAr: null, labelEn: null, isActive: false }],
        }),
      ),
    ).toThrow(CatalogError);
  });

  it("accepts SINGLE_SELECT with ordered unique inactive options and no selection bounds", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "SINGLE_SELECT",
        options: [
          { value: "SMALL", labelAr: null, labelEn: null, isActive: false },
          { value: "LARGE", labelAr: null, labelEn: null, isActive: false },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects SINGLE_SELECT duplicate option values, missing options, and selection bounds", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "SINGLE_SELECT",
        minSelections: 1,
        options: [
          { value: "A", labelAr: null, labelEn: null, isActive: false },
          { value: "A", labelAr: null, labelEn: null, isActive: false },
        ],
      }),
    ).toThrow(CatalogError);
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "SINGLE_SELECT",
        options: [],
      }),
    ).toThrow(CatalogError);
  });

  it("accepts MULTI_SELECT with optional selection bounds on inactive draft options", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "MULTI_SELECT",
        minSelections: 1,
        maxSelections: 2,
        options: [
          { value: "A", labelAr: null, labelEn: null, isActive: false },
          { value: "B", labelAr: null, labelEn: null, isActive: false },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects MULTI_SELECT with inverted selection bounds and max above active option count when active", () => {
    expect(() =>
      assertServiceFieldKindCompatibility(
        normalizedBase({
          kind: "MULTI_SELECT",
          minSelections: 3,
          maxSelections: 1,
          options: [
            { value: "A", labelAr: "أ", labelEn: "A", isActive: true },
            { value: "B", labelAr: "ب", labelEn: "B", isActive: true },
          ],
        }),
      ),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "MULTI_SELECT",
        isActive: true,
        labelAr: "إضافات",
        labelEn: "Add-ons",
        maxSelections: 3,
        options: [
          { value: "A", labelAr: "أ", labelEn: "A", isActive: true },
          { value: "B", labelAr: "ب", labelEn: "B", isActive: true },
        ],
      }),
    ).toThrow(CatalogError);
  });

  it("requires complete AR/EN labels when an active field is submitted", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "TEXT",
        isActive: true,
        labelEn: "Notes",
      }),
    ).toThrow(CatalogError);
  });

  it("requires two active options when an active select field is submitted", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "SINGLE_SELECT",
        isActive: true,
        labelAr: "حجم",
        labelEn: "Size",
        options: [
          { value: "SMALL", labelAr: "صغير", labelEn: "Small", isActive: true },
          { value: "LARGE", labelAr: null, labelEn: null, isActive: false },
        ],
      }),
    ).toThrow(CatalogError);
  });

  it("allows incomplete inactive drafts for fields and options", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "TEXT",
        labelAr: null,
        labelEn: "Draft only",
      }),
    ).not.toThrow();

    expect(() =>
      assertFieldOptionInput({
        value: "DRAFT_OPT",
        labelAr: null,
        labelEn: null,
        isActive: false,
      }),
    ).not.toThrow();
  });

  it("requires paired help text locales when either side is present on activation", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "TEXT",
        isActive: true,
        labelAr: "ملاحظات",
        labelEn: "Notes",
        helpTextAr: "مساعدة",
        helpTextEn: null,
      }),
    ).toThrow(CatalogError);
  });

  it("rejects duplicate field codes in one configuration graph", () => {
    expect(() =>
      assertServiceConfigurationGraph({
        priceUnits: [],
        fields: [
          { ...baseField, kind: "BOOLEAN", code: "PETS" },
          { ...baseField, kind: "TEXT", code: "PETS" },
        ],
      }),
    ).toThrow(CatalogError);
  });

  it("rejects unsupported kinds at the input and compatibility layers", () => {
    expect(() =>
      assertServiceFieldInput({
        ...baseField,
        kind: "FILE_UPLOAD",
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertServiceFieldKindCompatibility({
        kind: "DATE" as never,
        isRequired: false,
        minLength: null,
        maxLength: null,
        numberMode: null,
        minValue: null,
        maxValue: null,
        minSelections: null,
        maxSelections: null,
        options: [],
      }),
    ).toThrow(CatalogError);
  });

  it("rejects provider price or currency facts on field and option payloads", () => {
    for (const forbiddenKey of ["price", "amount", "currency"] as const) {
      expect(() =>
        assertServiceFieldInput({
          ...baseField,
          kind: "TEXT",
          [forbiddenKey]: "100",
        }),
      ).toThrow(CatalogError);

      expect(() =>
        assertFieldOptionInput({
          value: "OPT",
          labelAr: null,
          labelEn: null,
          isActive: false,
          [forbiddenKey]: "EGP",
        }),
      ).toThrow(CatalogError);
    }
  });
});

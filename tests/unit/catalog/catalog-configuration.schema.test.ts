
import {
  fieldInputSchema,
  replaceServiceConfigurationBodySchema,
} from "../../../src/modules/catalog/catalog.schema.js";

const commandBase = {
  idempotencyKey: "00000000-0000-4000-8000-000000000301",
  reasonCode: "catalog_management_change" as const,
  expectedVersion: 1,
  translations: [
    { locale: "EN" as const, name: "Draft", description: "Desc" },
  ],
  priceUnits: [
    {
      code: "PER_VISIT",
      labelAr: null,
      labelEn: "Per visit",
      isActive: false,
    },
  ],
};

const sixKindFields = [
  {
    code: "PREP_INFO",
    kind: "INFORMATION" as const,
    labelAr: null,
    labelEn: "Preparation",
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
  },
  {
    code: "BEDROOMS",
    kind: "NUMBER" as const,
    labelAr: null,
    labelEn: "Bedrooms",
    helpTextAr: null,
    helpTextEn: null,
    isRequired: true,
    isActive: false,
    minLength: null,
    maxLength: null,
    numberMode: "INTEGER" as const,
    minValue: "1",
    maxValue: "10",
    minSelections: null,
    maxSelections: null,
    options: [],
  },
  {
    code: "PETS",
    kind: "BOOLEAN" as const,
    labelAr: null,
    labelEn: "Pets",
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
  },
  {
    code: "NOTES",
    kind: "TEXT" as const,
    labelAr: null,
    labelEn: "Notes",
    helpTextAr: null,
    helpTextEn: null,
    isRequired: false,
    isActive: false,
    minLength: 0,
    maxLength: 500,
    numberMode: null,
    minValue: null,
    maxValue: null,
    minSelections: null,
    maxSelections: null,
    options: [],
  },
  {
    code: "SIZE",
    kind: "SINGLE_SELECT" as const,
    labelAr: null,
    labelEn: "Size",
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
    options: [
      { value: "SMALL", labelAr: null, labelEn: null, isActive: false },
      { value: "LARGE", labelAr: null, labelEn: null, isActive: false },
    ],
  },
  {
    code: "ADDONS",
    kind: "MULTI_SELECT" as const,
    labelAr: null,
    labelEn: "Add-ons",
    helpTextAr: null,
    helpTextEn: null,
    isRequired: false,
    isActive: false,
    minLength: null,
    maxLength: null,
    numberMode: null,
    minValue: null,
    maxValue: null,
    minSelections: 0,
    maxSelections: 2,
    options: [
      { value: "WINDOWS", labelAr: null, labelEn: null, isActive: false },
      { value: "FRIDGE", labelAr: null, labelEn: null, isActive: false },
    ],
  },
];

/**
 * US2 configuration Zod boundary (FR-009–FR-020).
 */
describe("catalog configuration schema", () => {
  it("accepts a valid six-kind configuration graph without countries", () => {
    const parsed = replaceServiceConfigurationBodySchema.parse({
      ...commandBase,
      fields: sixKindFields,
    });
    expect(parsed.fields).toHaveLength(6);
    expect(parsed.fields.map((field) => field.kind)).toEqual([
      "INFORMATION",
      "NUMBER",
      "BOOLEAN",
      "TEXT",
      "SINGLE_SELECT",
      "MULTI_SELECT",
    ]);
    expect(parsed).not.toHaveProperty("countries");
  });

  it("rejects countries because availability belongs to US3", () => {
    expect(() =>
      replaceServiceConfigurationBodySchema.parse({
        ...commandBase,
        countries: [{ countryCode: "EG", isAvailable: true }],
        fields: [],
      }),
    ).toThrow();
  });

  it("rejects provider price or currency fields at the boundary", () => {
    expect(() =>
      replaceServiceConfigurationBodySchema.parse({
        ...commandBase,
        priceUnits: [
          {
            code: "PER_VISIT",
            labelAr: null,
            labelEn: "Per visit",
            isActive: false,
            priceAmount: "10.00",
          },
        ],
        fields: [],
      }),
    ).toThrow();

    expect(() =>
      replaceServiceConfigurationBodySchema.parse({
        ...commandBase,
        fields: [
          {
            ...sixKindFields[3],
            currency: "EGP",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects incompatible discriminated-kind combinations", () => {
    expect(() =>
      fieldInputSchema.parse({
        code: "AREA",
        kind: "NUMBER",
        labelAr: null,
        labelEn: "Area",
        helpTextAr: null,
        helpTextEn: null,
        isRequired: false,
        isActive: false,
        minLength: null,
        maxValue: null,
        maxLength: null,
        minValue: null,
        minSelections: null,
        maxSelections: null,
        options: [],
      }),
    ).toThrow();

    expect(() =>
      fieldInputSchema.parse({
        ...sixKindFields[0],
        isRequired: true,
      }),
    ).toThrow();

    expect(() =>
      fieldInputSchema.parse({
        ...sixKindFields[3],
        numberMode: "INTEGER",
        minValue: "1",
        maxValue: "5",
      }),
    ).toThrow();
  });

  it("rejects duplicate price-unit codes, field codes, and option values", () => {
    expect(() =>
      replaceServiceConfigurationBodySchema.parse({
        ...commandBase,
        priceUnits: [commandBase.priceUnits[0], commandBase.priceUnits[0]],
        fields: [],
      }),
    ).toThrow();

    expect(() =>
      replaceServiceConfigurationBodySchema.parse({
        ...commandBase,
        fields: [sixKindFields[0], sixKindFields[0]],
      }),
    ).toThrow();

    expect(() =>
      replaceServiceConfigurationBodySchema.parse({
        ...commandBase,
        fields: [
          {
            ...sixKindFields[4],
            options: [
              { value: "SMALL", labelAr: null, labelEn: null, isActive: false },
              { value: "SMALL", labelAr: null, labelEn: null, isActive: false },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

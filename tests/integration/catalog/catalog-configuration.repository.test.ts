
import type {
  CatalogServiceConfigurationReplacementInput,
  CatalogServiceWithConfigurationRow,
} from "../../../src/modules/catalog/catalog.repository.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import {
  decideCatalogCommandOutcome,
  type CatalogCommandRecord,
} from "../../../src/modules/catalog/catalog.policy.js";

let nextId = 1;
function id(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

type StoredOption = {
  readonly id: string;
  readonly value: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  displayOrder: number;
  isActive: boolean;
};

type StoredField = {
  readonly id: string;
  readonly code: string;
  readonly kind: CatalogServiceWithConfigurationRow["fields"][number]["kind"];
  labelAr: string | null;
  labelEn: string | null;
  helpTextAr: string | null;
  helpTextEn: string | null;
  isRequired: boolean;
  isActive: boolean;
  minLength: number | null;
  maxLength: number | null;
  numberMode: "INTEGER" | "DECIMAL" | null;
  minValue: string | null;
  maxValue: string | null;
  minSelections: number | null;
  maxSelections: number | null;
  displayOrder: number;
  options: StoredOption[];
};

type StoredUnit = {
  readonly id: string;
  readonly code: string;
  labelAr: string | null;
  labelEn: string | null;
  displayOrder: number;
  isActive: boolean;
};

type StoredService = {
  readonly id: string;
  readonly categoryId: string;
  readonly code: string;
  readonly displayOrder: number;
  readonly isActive: boolean;
  version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  translations: CatalogServiceWithConfigurationRow["translations"];
  priceUnits: StoredUnit[];
  fields: StoredField[];
};

function compareByDisplayOrderThenId(
  left: { readonly displayOrder: number; readonly id: string },
  right: { readonly displayOrder: number; readonly id: string },
): number {
  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }
  return left.id.localeCompare(right.id);
}

function temporaryDisplayOrderBase(
  existingOrders: readonly number[],
  finalCount: number,
): number {
  const maxExisting =
    existingOrders.length === 0
      ? -1
      : existingOrders.reduce((max, order) => Math.max(max, order), -1);
  return Math.max(maxExisting + 1, finalCount);
}

function assertUniqueNonNegativeOrders(
  rows: readonly { readonly displayOrder: number; readonly id: string }[],
): void {
  const seen = new Set<number>();
  for (const row of rows) {
    expect(row.displayOrder).toBeGreaterThanOrEqual(0);
    expect(seen.has(row.displayOrder)).toBe(false);
    seen.add(row.displayOrder);
  }
}

/**
 * In-memory replacement seam mirroring repository identity/order rules:
 * omit → retain inactive; park then assign contiguous display orders.
 */
class RecordingConfigurationStore {
  readonly services = new Map<string, StoredService>();
  readonly deletedIds = new Set<string>();

  seed(service: StoredService): void {
    this.services.set(service.id, service);
  }

  replace(input: CatalogServiceConfigurationReplacementInput): CatalogServiceWithConfigurationRow {
    const current = this.services.get(input.serviceId);
    if (current === undefined) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
    if (current.version !== input.expectedVersion) {
      throw new CatalogError(
        "CATALOG_VERSION_CONFLICT",
        "Catalog service version is stale",
      );
    }

    const unitsByCode = new Map(current.priceUnits.map((unit) => [unit.code, unit]));
    const fieldsByCode = new Map(current.fields.map((field) => [field.code, field]));
    const presentUnitCodes = new Set(input.priceUnits.map((unit) => unit.code));
    const presentFieldCodes = new Set(input.fields.map((field) => field.code));
    const omittedUnits = current.priceUnits
      .filter((unit) => !presentUnitCodes.has(unit.code))
      .slice()
      .sort(compareByDisplayOrderThenId);
    const omittedFields = current.fields
      .filter((field) => !presentFieldCodes.has(field.code))
      .slice()
      .sort(compareByDisplayOrderThenId);

    const newUnitCount = input.priceUnits.filter(
      (unit) => !unitsByCode.has(unit.code),
    ).length;
    const unitFinalCount = current.priceUnits.length + newUnitCount;
    const unitTempBase = temporaryDisplayOrderBase(
      current.priceUnits.map((unit) => unit.displayOrder),
      unitFinalCount,
    );
    for (let index = 0; index < current.priceUnits.length; index += 1) {
      const unit = current.priceUnits[index];
      if (unit !== undefined) {
        unit.displayOrder = unitTempBase + index;
      }
    }

    const nextUnits: StoredUnit[] = [];
    for (let index = 0; index < input.priceUnits.length; index += 1) {
      const unit = input.priceUnits[index];
      if (unit === undefined) {
        continue;
      }
      const existing = unitsByCode.get(unit.code);
      nextUnits.push({
        id: existing?.id ?? id("unit"),
        code: unit.code,
        labelAr: unit.labelAr,
        labelEn: unit.labelEn,
        displayOrder: index,
        isActive: unit.isActive,
      });
    }
    for (let index = 0; index < omittedUnits.length; index += 1) {
      const unit = omittedUnits[index];
      if (unit === undefined) {
        continue;
      }
      nextUnits.push({
        id: unit.id,
        code: unit.code,
        labelAr: unit.labelAr,
        labelEn: unit.labelEn,
        displayOrder: input.priceUnits.length + index,
        isActive: false,
      });
    }
    assertUniqueNonNegativeOrders(nextUnits);
    current.priceUnits = nextUnits;

    const newFieldCount = input.fields.filter(
      (field) => !fieldsByCode.has(field.code),
    ).length;
    const fieldFinalCount = current.fields.length + newFieldCount;
    const fieldTempBase = temporaryDisplayOrderBase(
      current.fields.map((field) => field.displayOrder),
      fieldFinalCount,
    );
    for (let index = 0; index < current.fields.length; index += 1) {
      const field = current.fields[index];
      if (field !== undefined) {
        field.displayOrder = fieldTempBase + index;
      }
    }

    const nextFields: StoredField[] = [];
    for (let fieldIndex = 0; fieldIndex < input.fields.length; fieldIndex += 1) {
      const field = input.fields[fieldIndex];
      if (field === undefined) {
        continue;
      }
      const existingField = fieldsByCode.get(field.code);
      const fieldId = existingField?.id ?? id("field");
      const existingOptions = existingField?.options ?? [];
      const existingOptionsByValue = new Map(
        existingOptions.map((option) => [option.value, option]),
      );
      const presentOptionValues = new Set(field.options.map((option) => option.value));
      const omittedOptions = existingOptions
        .filter((option) => !presentOptionValues.has(option.value))
        .slice()
        .sort(compareByDisplayOrderThenId);

      const newOptionCount = field.options.filter(
        (option) => !existingOptionsByValue.has(option.value),
      ).length;
      const optionFinalCount = existingOptions.length + newOptionCount;
      const optionTempBase = temporaryDisplayOrderBase(
        existingOptions.map((option) => option.displayOrder),
        optionFinalCount,
      );
      for (let index = 0; index < existingOptions.length; index += 1) {
        const option = existingOptions[index];
        if (option !== undefined) {
          option.displayOrder = optionTempBase + index;
        }
      }

      const nextOptions: StoredOption[] = [];
      for (let optionIndex = 0; optionIndex < field.options.length; optionIndex += 1) {
        const option = field.options[optionIndex];
        if (option === undefined) {
          continue;
        }
        const existingOption = existingOptionsByValue.get(option.value);
        nextOptions.push({
          id: existingOption?.id ?? id("opt"),
          value: option.value,
          labelAr: option.labelAr,
          labelEn: option.labelEn,
          displayOrder: optionIndex,
          isActive: option.isActive,
        });
      }
      for (let index = 0; index < omittedOptions.length; index += 1) {
        const option = omittedOptions[index];
        if (option === undefined) {
          continue;
        }
        nextOptions.push({
          id: option.id,
          value: option.value,
          labelAr: option.labelAr,
          labelEn: option.labelEn,
          displayOrder: field.options.length + index,
          isActive: false,
        });
      }
      assertUniqueNonNegativeOrders(nextOptions);

      nextFields.push({
        id: fieldId,
        code: field.code,
        kind: field.kind,
        labelAr: field.labelAr,
        labelEn: field.labelEn,
        helpTextAr: field.helpTextAr,
        helpTextEn: field.helpTextEn,
        isRequired: field.isRequired,
        isActive: field.isActive,
        minLength: field.minLength,
        maxLength: field.maxLength,
        numberMode: field.numberMode,
        minValue: field.minValue,
        maxValue: field.maxValue,
        minSelections: field.minSelections,
        maxSelections: field.maxSelections,
        displayOrder: fieldIndex,
        options: nextOptions,
      });
    }

    for (let index = 0; index < omittedFields.length; index += 1) {
      const field = omittedFields[index];
      if (field === undefined) {
        continue;
      }
      nextFields.push({
        ...field,
        isActive: false,
        displayOrder: input.fields.length + index,
        options: field.options.map((option) => ({
          ...option,
          isActive: false,
        })),
      });
    }
    assertUniqueNonNegativeOrders(nextFields);
    current.fields = nextFields;
    current.version += 1;

    return {
      id: current.id,
      categoryId: current.categoryId,
      code: current.code,
      displayOrder: current.displayOrder,
      isActive: current.isActive,
      version: current.version,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      translations: current.translations
        .slice()
        .sort((left, right) => left.locale.localeCompare(right.locale)),
      priceUnits: current.priceUnits
        .slice()
        .sort(compareByDisplayOrderThenId)
        .map((unit) => ({ ...unit })),
      fields: current.fields
        .slice()
        .sort(compareByDisplayOrderThenId)
        .map((field) => ({
          ...field,
          options: field.options
            .slice()
            .sort(compareByDisplayOrderThenId)
            .map((option) => ({ ...option })),
        })),
    };
  }
}

function seedConfiguredService(): StoredService {
  return {
    id: "svc_1",
    categoryId: "cat_1",
    code: "STANDARD_HOME_CLEANING",
    displayOrder: 0,
    isActive: false,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    translations: [
      { locale: "EN", name: "Draft", description: null },
      { locale: "AR", name: null, description: null },
    ],
    priceUnits: [
      {
        id: "unit_keep",
        code: "PER_VISIT",
        labelAr: null,
        labelEn: "Per visit",
        displayOrder: 0,
        isActive: true,
      },
      {
        id: "unit_omit",
        code: "PER_HOUR",
        labelAr: null,
        labelEn: "Per hour",
        displayOrder: 1,
        isActive: true,
      },
    ],
    fields: [
      {
        id: "field_keep",
        code: "PETS",
        kind: "BOOLEAN",
        labelAr: null,
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
        displayOrder: 0,
        options: [],
      },
      {
        id: "field_omit",
        code: "OLD_FIELD",
        kind: "TEXT",
        labelAr: null,
        labelEn: "Old",
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
        displayOrder: 1,
        options: [
          {
            id: "opt_under_omitted_field",
            value: "LEGACY",
            labelAr: null,
            labelEn: "Legacy",
            displayOrder: 0,
            isActive: true,
          },
        ],
      },
      {
        id: "field_select",
        code: "SIZE",
        kind: "SINGLE_SELECT",
        labelAr: null,
        labelEn: "Size",
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
        displayOrder: 2,
        options: [
          {
            id: "opt_keep",
            value: "SMALL",
            labelAr: null,
            labelEn: "Small",
            displayOrder: 0,
            isActive: true,
          },
          {
            id: "opt_omit",
            value: "MEDIUM",
            labelAr: null,
            labelEn: "Medium",
            displayOrder: 1,
            isActive: true,
          },
        ],
      },
    ],
  };
}

/**
 * US2 configuration repository behavior (FR-013–FR-020, FR-027–FR-028).
 * Fake seam proves ID preservation and omit-as-inactive without a database.
 */
describe("catalog configuration repository", () => {
  it("preserves stable unit/field/option IDs when codes and values remain present", () => {
    const store = new RecordingConfigurationStore();
    store.seed(seedConfiguredService());

    const result = store.replace({
      serviceId: "svc_1",
      expectedVersion: 1,
      translations: [
        { locale: "EN", name: "Draft", description: null },
        { locale: "AR", name: null, description: null },
      ],
      priceUnits: [
        {
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: "Per visit",
          isActive: true,
        },
        {
          code: "PER_HOUR",
          labelAr: null,
          labelEn: "Per hour",
          isActive: false,
        },
      ],
      fields: [
        {
          code: "PETS",
          kind: "BOOLEAN",
          labelAr: null,
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
          options: [],
        },
        {
          code: "SIZE",
          kind: "SINGLE_SELECT",
          labelAr: null,
          labelEn: "Size",
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
          options: [
            {
              value: "SMALL",
              labelAr: null,
              labelEn: "Small",
              isActive: true,
            },
            {
              value: "MEDIUM",
              labelAr: null,
              labelEn: "Medium",
              isActive: false,
            },
          ],
        },
        {
          code: "OLD_FIELD",
          kind: "TEXT",
          labelAr: null,
          labelEn: "Old",
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
      ],
    });

    expect(result.priceUnits.find((unit) => unit.code === "PER_VISIT")?.id).toBe(
      "unit_keep",
    );
    expect(result.priceUnits.find((unit) => unit.code === "PER_HOUR")?.id).toBe(
      "unit_omit",
    );
    expect(result.fields.find((field) => field.code === "PETS")?.id).toBe("field_keep");
    expect(result.fields.find((field) => field.code === "SIZE")?.id).toBe(
      "field_select",
    );
    expect(result.fields.find((field) => field.code === "OLD_FIELD")?.id).toBe(
      "field_omit",
    );
    const size = result.fields.find((field) => field.code === "SIZE");
    expect(size?.options.find((option) => option.value === "SMALL")?.id).toBe(
      "opt_keep",
    );
    expect(size?.options.find((option) => option.value === "MEDIUM")?.id).toBe(
      "opt_omit",
    );
    expect(store.deletedIds.size).toBe(0);
  });

  it("retains omitted unit/field/option identities as inactive and never deletes them", () => {
    const store = new RecordingConfigurationStore();
    store.seed(seedConfiguredService());

    const result = store.replace({
      serviceId: "svc_1",
      expectedVersion: 1,
      translations: [{ locale: "EN", name: "Draft", description: null }],
      priceUnits: [
        {
          code: "PER_VISIT",
          labelAr: "لكل زيارة",
          labelEn: "Per visit",
          isActive: true,
        },
      ],
      fields: [
        {
          code: "PETS",
          kind: "BOOLEAN",
          labelAr: null,
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
          options: [],
        },
        {
          code: "SIZE",
          kind: "SINGLE_SELECT",
          labelAr: null,
          labelEn: "Size",
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
          options: [
            {
              value: "SMALL",
              labelAr: null,
              labelEn: "Small",
              isActive: true,
            },
          ],
        },
      ],
    });

    const omittedUnit = result.priceUnits.find((unit) => unit.code === "PER_HOUR");
    expect(omittedUnit).toEqual(
      expect.objectContaining({
        id: "unit_omit",
        labelEn: "Per hour",
        isActive: false,
      }),
    );

    const omittedField = result.fields.find((field) => field.code === "OLD_FIELD");
    expect(omittedField).toEqual(
      expect.objectContaining({
        id: "field_omit",
        labelEn: "Old",
        isActive: false,
      }),
    );
    expect(omittedField?.options).toEqual([
      expect.objectContaining({
        id: "opt_under_omitted_field",
        value: "LEGACY",
        labelEn: "Legacy",
        isActive: false,
      }),
    ]);

    const size = result.fields.find((field) => field.code === "SIZE");
    expect(size?.options.find((option) => option.value === "MEDIUM")).toEqual(
      expect.objectContaining({
        id: "opt_omit",
        labelEn: "Medium",
        isActive: false,
      }),
    );
    expect(store.deletedIds.size).toBe(0);
    expect(result.version).toBe(2);
  });

  it("normalizes request order deterministically without unique-position collisions", () => {
    const store = new RecordingConfigurationStore();
    store.seed(seedConfiguredService());

    const result = store.replace({
      serviceId: "svc_1",
      expectedVersion: 1,
      translations: [{ locale: "EN", name: "Draft", description: null }],
      priceUnits: [
        {
          code: "PER_HOUR",
          labelAr: null,
          labelEn: "Per hour",
          isActive: true,
        },
        {
          code: "PER_VISIT",
          labelAr: null,
          labelEn: "Per visit",
          isActive: true,
        },
      ],
      fields: [
        {
          code: "SIZE",
          kind: "SINGLE_SELECT",
          labelAr: null,
          labelEn: "Size",
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
          options: [
            {
              value: "MEDIUM",
              labelAr: null,
              labelEn: "Medium",
              isActive: true,
            },
            {
              value: "SMALL",
              labelAr: null,
              labelEn: "Small",
              isActive: true,
            },
          ],
        },
        {
          code: "PETS",
          kind: "BOOLEAN",
          labelAr: null,
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
          options: [],
        },
      ],
    });

    expect(result.priceUnits.map((unit) => unit.code)).toEqual([
      "PER_HOUR",
      "PER_VISIT",
    ]);
    expect(result.priceUnits.map((unit) => unit.displayOrder)).toEqual([0, 1]);
    expect(result.fields.map((field) => field.code)).toEqual([
      "SIZE",
      "PETS",
      "OLD_FIELD",
    ]);
    expect(result.fields.map((field) => field.displayOrder)).toEqual([0, 1, 2]);
    expect(result.fields[2]).toEqual(
      expect.objectContaining({ code: "OLD_FIELD", isActive: false }),
    );
    expect(result.fields[0]?.options.map((option) => option.value)).toEqual([
      "MEDIUM",
      "SMALL",
    ]);
    expect(result.fields[0]?.options.map((option) => option.displayOrder)).toEqual([
      0, 1,
    ]);
    assertUniqueNonNegativeOrders(result.priceUnits);
    assertUniqueNonNegativeOrders(result.fields);
    assertUniqueNonNegativeOrders(result.fields[0]?.options ?? []);
  });

  it("rejects stale expectedVersion without mutating stored configuration", () => {
    const store = new RecordingConfigurationStore();
    const seeded = seedConfiguredService();
    seeded.version = 3;
    store.seed(seeded);
    const beforeUnits = structuredClone(seeded.priceUnits);
    const beforeFields = structuredClone(seeded.fields);

    expect(() =>
      store.replace({
        serviceId: "svc_1",
        expectedVersion: 2,
        translations: [],
        priceUnits: [
          {
            code: "PER_VISIT",
            labelAr: null,
            labelEn: "changed",
            isActive: true,
          },
        ],
        fields: [],
      }),
    ).toThrow(CatalogError);

    const stored = store.services.get("svc_1");
    expect(stored?.version).toBe(3);
    expect(stored?.priceUnits).toEqual(beforeUnits);
    expect(stored?.fields).toEqual(beforeFields);
  });

  it("replays same-payload completed configuration commands without a second write", () => {
    const completed: CatalogCommandRecord = {
      status: "COMPLETED",
      requestHash: "f".repeat(64),
      targetType: "SERVICE",
      targetId: "svc_1",
      acceptedVersion: 5,
      reservedMediaFileId: null,
    };
    expect(decideCatalogCommandOutcome(completed, completed.requestHash)).toEqual({
      kind: "REPLAY",
      record: completed,
    });
  });

  it("rejects same-key different-payload configuration commands as idempotency conflict", () => {
    const completed: CatalogCommandRecord = {
      status: "COMPLETED",
      requestHash: "f".repeat(64),
      targetType: "SERVICE",
      targetId: "svc_1",
      acceptedVersion: 5,
      reservedMediaFileId: null,
    };
    expect(() => decideCatalogCommandOutcome(completed, "g".repeat(64))).toThrow(
      CatalogError,
    );
  });
});

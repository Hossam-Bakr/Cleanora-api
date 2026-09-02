/**
 * Exact-locale projection helpers for selectable and snapshot-ready Catalog reads.
 */

import type {
  CatalogFieldDefinition,
  CatalogFieldOptionDefinition,
  CatalogLocale,
  CatalogPriceUnitDefinition,
} from "./catalog.public.js";
import type {
  CatalogServiceFieldRow,
  CatalogServiceWithConfigurationRow,
} from "./catalog.repository.js";
import { CatalogError } from "./catalog.errors.js";
import {
  normalizeOptionalLocalizedText,
  type CatalogLocaleCode,
} from "./catalog.policy.js";

function compareByDisplayOrderThenId(
  left: { readonly displayOrder: number; readonly id: string },
  right: { readonly displayOrder: number; readonly id: string },
): number {
  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }
  return left.id.localeCompare(right.id);
}

/**
 * @desc Resolve one exact-locale label without cross-locale or code fallback.
 */
export function resolveExactLocaleLabel(input: {
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly locale: CatalogLocaleCode;
}): string {
  const label =
    input.locale === "AR"
      ? normalizeOptionalLocalizedText(input.labelAr)
      : normalizeOptionalLocalizedText(input.labelEn);
  if (label === null) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog content is missing a required locale label",
      { details: { missingLocales: [input.locale] } },
    );
  }
  return label;
}

/**
 * @desc Resolve optional help text for one exact locale only.
 */
export function resolveExactLocaleHelpText(input: {
  readonly helpTextAr: string | null;
  readonly helpTextEn: string | null;
  readonly locale: CatalogLocaleCode;
}): string | null {
  return input.locale === "AR"
    ? normalizeOptionalLocalizedText(input.helpTextAr)
    : normalizeOptionalLocalizedText(input.helpTextEn);
}

function projectFieldOption(
  option: CatalogServiceFieldRow["options"][number],
  locale: CatalogLocale,
): CatalogFieldOptionDefinition {
  return {
    id: option.id,
    value: option.value,
    label: resolveExactLocaleLabel({
      labelAr: option.labelAr,
      labelEn: option.labelEn,
      locale,
    }),
    displayOrder: option.displayOrder,
  };
}

function projectField(
  field: CatalogServiceFieldRow,
  locale: CatalogLocale,
): CatalogFieldDefinition {
  const options = field.options
    .filter((option) => option.isActive)
    .slice()
    .sort(compareByDisplayOrderThenId)
    .map((option) => projectFieldOption(option, locale));

  const base = {
    id: field.id,
    code: field.code,
    kind: field.kind,
    label: resolveExactLocaleLabel({
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      locale,
    }),
    helpText: resolveExactLocaleHelpText({
      helpTextAr: field.helpTextAr,
      helpTextEn: field.helpTextEn,
      locale,
    }),
    required: field.isRequired,
    displayOrder: field.displayOrder,
  };

  switch (field.kind) {
    case "INFORMATION":
    case "BOOLEAN":
      return {
        ...base,
        textBounds: null,
        numberRules: null,
        selectionBounds: null,
        options: [],
      };
    case "TEXT":
      return {
        ...base,
        textBounds: {
          min: field.minLength,
          max: field.maxLength,
        },
        numberRules: null,
        selectionBounds: null,
        options: [],
      };
    case "NUMBER":
      return {
        ...base,
        textBounds: null,
        numberRules:
          field.numberMode === null
            ? null
            : {
                mode: field.numberMode,
                min: field.minValue,
                max: field.maxValue,
              },
        selectionBounds: null,
        options: [],
      };
    case "SINGLE_SELECT":
      return {
        ...base,
        textBounds: null,
        numberRules: null,
        selectionBounds: {
          min: field.minSelections ?? 1,
          max: field.maxSelections ?? 1,
        },
        options,
      };
    case "MULTI_SELECT":
      return {
        ...base,
        textBounds: null,
        numberRules: null,
        selectionBounds: {
          min: field.minSelections,
          max: field.maxSelections,
        },
        options,
      };
    default: {
      const exhaustive: never = field.kind;
      throw new CatalogError(
        "CATALOG_DEPENDENCY_FAILED",
        `Unsupported catalog field kind: ${String(exhaustive)}`,
      );
    }
  }
}

/**
 * @desc Project active price units and fields for one exact locale.
 * @explanation Returns null when any active child lacks the requested locale.
 */
export function projectSnapshotReadyConfiguration(input: {
  readonly service: CatalogServiceWithConfigurationRow;
  readonly locale: CatalogLocale;
}): {
  readonly priceUnits: readonly CatalogPriceUnitDefinition[];
  readonly fields: readonly CatalogFieldDefinition[];
} | null {
  const activePriceUnits = input.service.priceUnits
    .filter((unit) => unit.isActive)
    .slice()
    .sort(compareByDisplayOrderThenId);
  const activeFields = input.service.fields
    .filter((field) => field.isActive)
    .slice()
    .sort(compareByDisplayOrderThenId);

  const priceUnits: CatalogPriceUnitDefinition[] = [];
  for (const unit of activePriceUnits) {
    try {
      priceUnits.push({
        id: unit.id,
        code: unit.code,
        label: resolveExactLocaleLabel({
          labelAr: unit.labelAr,
          labelEn: unit.labelEn,
          locale: input.locale,
        }),
        displayOrder: unit.displayOrder,
      });
    } catch {
      return null;
    }
  }

  const fields: CatalogFieldDefinition[] = [];
  for (const field of activeFields) {
    try {
      fields.push(projectField(field, input.locale));
    } catch {
      return null;
    }
  }

  return { priceUnits, fields };
}

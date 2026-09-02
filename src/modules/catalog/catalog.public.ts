/**
 * Catalog module public contracts for composition and later business-module
 * consumers.
 *
 * "Public" means module-public inside the modular monolith. R1-P08 exposes
 * protected staff management HTTP only; no anonymous or customer Catalog
 * Browse surface exists here. This file carries stable DTOs and interfaces
 * only — never a Prisma model, repository, controller, route, internal policy,
 * or raw transaction client.
 */

/** Approved cross-module entry point marker for the Catalog module. */
export const CATALOG_PUBLIC_CONTRACT = "catalog.public" as const;

export type CatalogLocale = "AR" | "EN";

export type CatalogServiceFieldKind =
  | "INFORMATION"
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "SINGLE_SELECT"
  | "MULTI_SELECT";

/**
 * One exact-locale, active, complete, country-available service. Inactive
 * drafts, untranslated content, management receipts, audit facts, and
 * persistence timestamps never appear here.
 */
export interface SelectableCatalogServiceSummary {
  readonly serviceId: string;
  readonly serviceCode: string;
  readonly serviceVersion: number;
  readonly categoryId: string;
  readonly categoryCode: string;
  readonly name: string;
  readonly description: string;
  readonly categoryName: string;
  readonly displayOrder: number;
}

export interface CatalogPriceUnitDefinition {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly displayOrder: number;
}

export interface CatalogFieldOptionDefinition {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly displayOrder: number;
}

/**
 * Decimal bounds are strings so no consumer inherits binary floating-point
 * ambiguity from a numeric field bound.
 */
export interface CatalogFieldDefinition {
  readonly id: string;
  readonly code: string;
  readonly kind: CatalogServiceFieldKind;
  readonly label: string;
  readonly helpText: string | null;
  readonly required: boolean;
  readonly textBounds: {
    readonly min: number | null;
    readonly max: number | null;
  } | null;
  readonly numberRules: {
    readonly mode: "INTEGER" | "DECIMAL";
    readonly min: string | null;
    readonly max: string | null;
  } | null;
  readonly selectionBounds: {
    readonly min: number | null;
    readonly max: number | null;
  } | null;
  readonly options: readonly CatalogFieldOptionDefinition[];
  readonly displayOrder: number;
}

/** Stable Media reference. Signed delivery URLs are requested separately. */
export interface CatalogMediaReference {
  readonly associationId: string;
  readonly mediaId: string;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly width: number;
  readonly height: number;
  readonly displayOrder: number;
}

/**
 * Current copy-ready truth for one service. The later owning module decides
 * when and how to persist a historical snapshot; R1-P08 stores none.
 */
export interface SnapshotReadyCatalogServiceDefinition {
  readonly serviceId: string;
  readonly serviceCode: string;
  readonly serviceVersion: number;
  readonly category: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly description: string;
  };
  readonly locale: CatalogLocale;
  readonly countryCode: string;
  readonly name: string;
  readonly description: string;
  readonly priceUnits: readonly CatalogPriceUnitDefinition[];
  readonly fields: readonly CatalogFieldDefinition[];
  readonly media: readonly CatalogMediaReference[];
}

/**
 * Composition-injected internal reader. It is not an actor-addressable HTTP
 * permission surface; a later Browse phase owns that and its authorization.
 * `null` means not selectable or not found, with no draft-leaking distinction.
 */
export interface CatalogDefinitionReader {
  listSelectable(input: {
    readonly countryCode: string;
    readonly locale: CatalogLocale;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<{
    readonly items: readonly SelectableCatalogServiceSummary[];
    readonly nextCursor: string | null;
  }>;

  getSnapshotReadyDefinition(input: {
    readonly serviceCode: string;
    readonly countryCode: string;
    readonly locale: CatalogLocale;
  }): Promise<SnapshotReadyCatalogServiceDefinition | null>;
}

/**
 * @desc Composition factory exposing only the internal Catalog reader surface.
 */
export function createCatalogDefinitionReader(
  source: CatalogDefinitionReader,
): CatalogDefinitionReader {
  return {
    listSelectable: (input) => source.listSelectable(input),
    getSnapshotReadyDefinition: (input) =>
      source.getSnapshotReadyDefinition(input),
  };
}

/** Management-safe category DTO without raw Prisma or audit fields. */
export interface CatalogCategoryManagementDto {
  readonly id: string;
  readonly code: string;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogServiceTranslationManagementDto {
  readonly locale: CatalogLocale;
  readonly name: string | null;
  readonly description: string | null;
}

export interface CatalogPriceUnitManagementDto {
  readonly id: string;
  readonly code: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
}

export interface CatalogFieldOptionManagementDto {
  readonly id: string;
  readonly value: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
}

export interface CatalogServiceFieldManagementDto {
  readonly id: string;
  readonly code: string;
  readonly kind: CatalogServiceFieldKind;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly helpTextAr: string | null;
  readonly helpTextEn: string | null;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly numberMode: "INTEGER" | "DECIMAL" | null;
  readonly minValue: string | null;
  readonly maxValue: string | null;
  readonly minSelections: number | null;
  readonly maxSelections: number | null;
  readonly displayOrder: number;
  readonly options: readonly CatalogFieldOptionManagementDto[];
}

/** Management-safe service DTO without raw Prisma, auth, or audit fields. */
export interface CatalogServiceManagementDto {
  readonly id: string;
  readonly categoryId: string;
  readonly code: string;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly translations: readonly CatalogServiceTranslationManagementDto[];
  readonly priceUnits: readonly CatalogPriceUnitManagementDto[];
  readonly fields: readonly CatalogServiceFieldManagementDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toCategoryManagementDto(row: {
  readonly id: string;
  readonly code: string;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): CatalogCategoryManagementDto {
  return {
    id: row.id,
    code: row.code,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    descriptionAr: row.descriptionAr,
    descriptionEn: row.descriptionEn,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toServiceManagementDto(row: {
  readonly id: string;
  readonly categoryId: string;
  readonly code: string;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly translations: readonly {
    readonly locale: CatalogLocale;
    readonly name: string | null;
    readonly description: string | null;
  }[];
  readonly priceUnits?: readonly {
    readonly id: string;
    readonly code: string;
    readonly labelAr: string | null;
    readonly labelEn: string | null;
    readonly displayOrder: number;
    readonly isActive: boolean;
  }[];
  readonly fields?: readonly {
    readonly id: string;
    readonly code: string;
    readonly kind: CatalogServiceFieldKind;
    readonly labelAr: string | null;
    readonly labelEn: string | null;
    readonly helpTextAr: string | null;
    readonly helpTextEn: string | null;
    readonly isRequired: boolean;
    readonly isActive: boolean;
    readonly minLength: number | null;
    readonly maxLength: number | null;
    readonly numberMode: "INTEGER" | "DECIMAL" | null;
    readonly minValue: string | null;
    readonly maxValue: string | null;
    readonly minSelections: number | null;
    readonly maxSelections: number | null;
    readonly displayOrder: number;
    readonly options: readonly {
      readonly id: string;
      readonly value: string;
      readonly labelAr: string | null;
      readonly labelEn: string | null;
      readonly displayOrder: number;
      readonly isActive: boolean;
    }[];
  }[];
}): CatalogServiceManagementDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    code: row.code,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    version: row.version,
    translations: row.translations.map((translation) => ({
      locale: translation.locale,
      name: translation.name,
      description: translation.description,
    })),
    priceUnits: (row.priceUnits ?? []).map((unit) => ({
      id: unit.id,
      code: unit.code,
      labelAr: unit.labelAr,
      labelEn: unit.labelEn,
      displayOrder: unit.displayOrder,
      isActive: unit.isActive,
    })),
    fields: (row.fields ?? []).map((field) => ({
      id: field.id,
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
      displayOrder: field.displayOrder,
      options: field.options.map((option) => ({
        id: option.id,
        value: option.value,
        labelAr: option.labelAr,
        labelEn: option.labelEn,
        displayOrder: option.displayOrder,
        isActive: option.isActive,
      })),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

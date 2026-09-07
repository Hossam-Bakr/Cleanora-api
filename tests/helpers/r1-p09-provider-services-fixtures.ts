/**
 * Deterministic R1-P09 Provider/Catalog/country-pricing-policy fixtures.
 * Synthetic only — never production Provider offering or price data.
 */

import { requireR1P09ProofDatabaseUrl } from "../../scripts/validate-clean-migration.js";

export const R1_P09_IDS = {
  providerId: "provider-r1p09-synthetic",
  otherProviderId: "provider-r1p09-other",
  providerServiceId: "provider-service-r1p09-synthetic",
  providerServicePriceId: "provider-service-price-r1p09-synthetic",
  catalogServiceId: "catalog-service-r1p09-synthetic",
  catalogServiceCode: "R1P09_SYNTHETIC_SERVICE",
  catalogPriceUnitId: "catalog-price-unit-r1p09-synthetic",
  catalogPriceUnitCode: "PER_VISIT",
  countryId: "country-r1p09-eg",
  countryCode: "EG",
  currencyId: "currency-r1p09-egp",
  currencyCode: "EGP",
  ownerUserId: "owner-r1p09-synthetic",
  adminUserId: "admin-r1p09-synthetic",
  staffAdminUserId: "staff-admin-r1p09-synthetic",
  otherProviderOwnerUserId: "owner-r1p09-other",
  requestId: "request-r1p09-synthetic",
  idempotencyKey: "00000000-0000-4000-8000-000000000009",
} as const;

export const R1_P09_SENTINELS = {
  maximumPrice: "9999.99",
  providerPrice: "120.00",
  minimumCharge: "150.00",
  currencyDecimalPlaces: 2,
  estimatedDurationMinutes: 90,
  noteAr: "ملاحظة خدمة تجريبية",
  noteEn: "Synthetic service note",
  reasonText: "R1-P09 synthetic provider reason",
  privilegedReasonCode: "PROVIDER_SERVICE_PRICE_APPROVED",
  password: "R1P09-Synthetic-Password-Only!",
} as const;

/** Country-required providers.service_pricing_policy object shape for tests. */
export function buildServicePricingPolicyValue(
  overrides: Partial<{
    approvalRequired: boolean;
    maximumPrice: string;
  }> = {},
) {
  return {
    approvalRequired: false,
    maximumPrice: R1_P09_SENTINELS.maximumPrice,
    ...overrides,
  };
}

export function buildResolvedPricingPolicy(
  overrides: Partial<{
    countryId: string;
    countryCode: string;
    currencyId: string;
    currencyCode: string;
    decimalPlaces: number;
    approvalRequired: boolean;
    maximumPrice: string;
  }> = {},
) {
  return {
    countryId: overrides.countryId ?? R1_P09_IDS.countryId,
    countryCode: overrides.countryCode ?? R1_P09_IDS.countryCode,
    currency: {
      id: overrides.currencyId ?? R1_P09_IDS.currencyId,
      code: overrides.currencyCode ?? R1_P09_IDS.currencyCode,
      decimalPlaces:
        overrides.decimalPlaces ?? R1_P09_SENTINELS.currencyDecimalPlaces,
    },
    approvalRequired: overrides.approvalRequired ?? false,
    maximumPrice: overrides.maximumPrice ?? R1_P09_SENTINELS.maximumPrice,
  };
}

export function buildSelectableCatalogSummary(
  overrides: Partial<{
    serviceId: string;
    serviceCode: string;
    serviceVersion: number;
    categoryId: string;
    categoryCode: string;
    name: string;
    description: string;
    categoryName: string;
    displayOrder: number;
  }> = {},
) {
  return {
    serviceId: overrides.serviceId ?? R1_P09_IDS.catalogServiceId,
    serviceCode: overrides.serviceCode ?? R1_P09_IDS.catalogServiceCode,
    serviceVersion: overrides.serviceVersion ?? 1,
    categoryId: overrides.categoryId ?? "catalog-category-r1p09-synthetic",
    categoryCode: overrides.categoryCode ?? "R1P09_CATEGORY",
    name: overrides.name ?? "Synthetic Catalog Service",
    description: overrides.description ?? "Deterministic R1-P09 fixture",
    categoryName: overrides.categoryName ?? "Synthetic Category",
    displayOrder: overrides.displayOrder ?? 1,
  };
}

export function buildCatalogPriceUnit(
  overrides: Partial<{
    id: string;
    code: string;
    label: string;
    displayOrder: number;
  }> = {},
) {
  return {
    id: overrides.id ?? R1_P09_IDS.catalogPriceUnitId,
    code: overrides.code ?? R1_P09_IDS.catalogPriceUnitCode,
    label: overrides.label ?? "Per visit",
    displayOrder: overrides.displayOrder ?? 1,
  };
}

export function buildCreateOfferingBody(
  overrides: Partial<{
    catalogServiceCode: string;
    catalogPriceUnitCode: string;
    providerPrice: string;
    minimumCharge: string;
    estimatedDurationMinutes: number;
    noteAr: string | null;
    noteEn: string | null;
    expectedVersion: number;
    idempotencyKey: string;
    reason: string;
  }> = {},
) {
  return {
    catalogServiceCode:
      overrides.catalogServiceCode ?? R1_P09_IDS.catalogServiceCode,
    catalogPriceUnitCode:
      overrides.catalogPriceUnitCode ?? R1_P09_IDS.catalogPriceUnitCode,
    providerPrice: overrides.providerPrice ?? R1_P09_SENTINELS.providerPrice,
    minimumCharge: overrides.minimumCharge ?? R1_P09_SENTINELS.minimumCharge,
    estimatedDurationMinutes:
      overrides.estimatedDurationMinutes ??
      R1_P09_SENTINELS.estimatedDurationMinutes,
    noteAr:
      overrides.noteAr === undefined
        ? R1_P09_SENTINELS.noteAr
        : overrides.noteAr,
    noteEn:
      overrides.noteEn === undefined
        ? R1_P09_SENTINELS.noteEn
        : overrides.noteEn,
    expectedVersion: overrides.expectedVersion ?? 0,
    idempotencyKey: overrides.idempotencyKey ?? R1_P09_IDS.idempotencyKey,
    reason: overrides.reason ?? R1_P09_SENTINELS.reasonText,
  };
}

export function buildProviderCommand(
  overrides: Partial<{
    expectedVersion: number;
    idempotencyKey: string;
    requestId: string;
    reason: string;
  }> = {},
) {
  return {
    expectedVersion: overrides.expectedVersion ?? 1,
    idempotencyKey: overrides.idempotencyKey ?? R1_P09_IDS.idempotencyKey,
    requestId: overrides.requestId ?? R1_P09_IDS.requestId,
    reason: overrides.reason ?? R1_P09_SENTINELS.reasonText,
  };
}

/** Cross-module fake: Catalog definition reader with deterministic fixtures. */
export function createFakeCatalogDefinitionReader(options?: {
  selectable?: boolean;
  priceUnits?: ReadonlyArray<ReturnType<typeof buildCatalogPriceUnit>>;
  byCode?: Map<string, ReturnType<typeof buildSelectableCatalogSummary>>;
  byId?: Map<string, ReturnType<typeof buildSelectableCatalogSummary>>;
}) {
  const selectable = options?.selectable ?? true;
  const summary = buildSelectableCatalogSummary();
  const priceUnits = options?.priceUnits ?? [buildCatalogPriceUnit()];
  const byCode =
    options?.byCode ?? new Map([[summary.serviceCode, summary]]);
  const byId = options?.byId ?? new Map([[summary.serviceId, summary]]);

  return {
    listSelectable: async () => ({
      items: selectable ? [summary] : [],
      nextCursor: null,
    }),
    getSnapshotReadyDefinition: async (input: {
      readonly serviceCode: string;
      readonly countryCode: string;
      readonly locale: "AR" | "EN";
    }) => {
      const found = byCode.get(input.serviceCode);
      if (!selectable || !found) return null;
      return {
        serviceId: found.serviceId,
        serviceCode: found.serviceCode,
        serviceVersion: found.serviceVersion,
        category: {
          id: found.categoryId,
          code: found.categoryCode,
          name: found.categoryName,
          description: found.description,
        },
        locale: input.locale,
        countryCode: input.countryCode,
        name: found.name,
        description: found.description,
        priceUnits,
        fields: [],
        media: [],
      };
    },
    resolveSelectableProviderOffering: async (input: {
      readonly serviceCode: string;
      readonly countryCode: string;
    }) => {
      void input.countryCode;
      const found = byCode.get(input.serviceCode);
      if (!found) return null;
      return {
        serviceId: found.serviceId,
        serviceCode: found.serviceCode,
        serviceVersion: found.serviceVersion,
        selectableForCountry: selectable,
        activePriceUnits: priceUnits.map((unit) => ({
          id: unit.id,
          code: unit.code,
        })),
      };
    },
    getProviderOfferingReference: async (input: {
      readonly serviceId: string;
      readonly countryCode: string;
    }) => {
      void input.countryCode;
      const found = byId.get(input.serviceId);
      if (!found) return null;
      return {
        serviceId: found.serviceId,
        serviceCode: found.serviceCode,
        serviceVersion: found.serviceVersion,
        selectableForCountry: selectable,
        activePriceUnits: priceUnits.map((unit) => ({
          id: unit.id,
          code: unit.code,
        })),
      };
    },
    getSnapshotReadyDefinitionById: async (input: {
      readonly serviceId: string;
      readonly countryCode: string;
      readonly locale: "AR" | "EN";
    }) => {
      const found = byId.get(input.serviceId);
      if (!selectable || !found) return null;
      return {
        serviceId: found.serviceId,
        serviceCode: found.serviceCode,
        serviceVersion: found.serviceVersion,
        category: {
          id: found.categoryId,
          code: found.categoryCode,
          name: found.categoryName,
          description: found.description,
        },
        locale: input.locale,
        countryCode: input.countryCode,
        name: found.name,
        description: found.description,
        priceUnits,
        fields: [],
        media: [],
      };
    },
  };
}

/** Cross-module fake: Configuration pricing-policy reader. */
export function createFakePricingPolicyReader(
  result:
    | { status: "AVAILABLE"; value: ReturnType<typeof buildResolvedPricingPolicy> }
    | {
        status: "UNAVAILABLE";
        code:
          | "COUNTRY_UNAVAILABLE"
          | "CURRENCY_UNAVAILABLE"
          | "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE";
      } = {
    status: "AVAILABLE",
    value: buildResolvedPricingPolicy(),
  },
) {
  return {
    readForCountry: async (_input: { readonly countryCode: string }) => result,
  };
}

export class R1P09TestClock {
  public constructor(private current = new Date("2026-09-05T12:00:00.000Z")) {}

  public now(): Date {
    return new Date(this.current);
  }

  public advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

/**
 * Database-backed R1-P09 suites fail closed unless the explicit disposable
 * target is phase-named.
 */
export function hasExplicitR1P09TestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    requireR1P09ProofDatabaseUrl(env);
    return true;
  } catch {
    return false;
  }
}

/** Sorts explicit delete callbacks so database cleanup remains deterministic. */
export async function cleanupR1P09Fixtures(
  callbacks: readonly (() => Promise<void>)[],
): Promise<void> {
  for (const callback of [...callbacks].reverse()) {
    await callback();
  }
}

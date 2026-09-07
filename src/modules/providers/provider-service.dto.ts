/**
 * Safe Provider Service management mappers. Never expose raw Prisma, receipts,
 * contacts, secrets, or client-calculated monetary totals.
 */

import type { ProviderOfferingCatalogReference } from "#modules/catalog/catalog.public";

import { formatMinorUnitsToCanonicalDecimal } from "./domain/provider-service.policy.js";
import { evaluateOfferingUsability } from "./domain/provider-service-readiness.policy.js";
import { ProviderServiceError } from "./domain/provider-service.errors.js";
import type {
  ProviderServicePriceHistorySnapshot,
  ProviderServicePriceSafeFacts,
  ProviderServicePriceSnapshot,
  ProviderServiceSafeResultJson,
  ProviderServiceSnapshot,
  ProviderServiceStatusHistorySnapshot,
  ProviderServicesReadyBlockerCode,
} from "./domain/provider-service.types.js";

export interface ProviderServicePriceManagementDto {
  readonly id: string;
  readonly status: "PENDING" | "EFFECTIVE" | "REJECTED" | "SUPERSEDED";
  readonly catalogPriceUnit: {
    readonly id: string;
    readonly codeAtProposal: string;
  };
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly price: string;
  readonly minimumCharge: string;
  readonly approvalRequiredAtProposal: boolean;
  readonly effectiveAt: string | null;
  readonly rejectedAt: string | null;
  readonly supersededAt: string | null;
  readonly createdAt: string;
}

export interface ProviderServiceManagementDto {
  readonly id: string;
  readonly providerId: string;
  readonly catalogService: {
    readonly id: string;
    readonly code: string;
    readonly version: number;
    readonly selectableForProviderCountry: boolean;
  };
  readonly enabled: boolean;
  readonly estimatedDurationMinutes: number;
  readonly notes: {
    readonly ar: string | null;
    readonly en: string | null;
  };
  readonly version: number;
  readonly effectivePrice: ProviderServicePriceManagementDto | null;
  readonly pendingPrice: ProviderServicePriceManagementDto | null;
  readonly usability: {
    readonly usable: boolean;
    readonly blockerCodes: readonly ProviderServicesReadyBlockerCode[];
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Staff-safe pending queue item — no contacts, receipts, or audit internals. */
export interface StaffPendingPriceProposalDto {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServiceVersion: number;
  readonly providerServicePriceId: string;
  readonly catalogService: {
    readonly id: string;
    readonly code: string;
  };
  readonly catalogPriceUnit: {
    readonly id: string;
    readonly codeAtProposal: string;
  };
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly price: string;
  readonly minimumCharge: string;
  readonly countryCodeAtProposal: string;
  readonly proposedAt: string;
  readonly providerDisplay: {
    readonly nameAr: string | null;
    readonly nameEn: string | null;
  };
}

/** Staff-safe pending dossier with optional current effective price. */
export interface StaffPendingPriceDossierDto {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServiceVersion: number;
  readonly pendingPrice: ProviderServicePriceManagementDto;
  readonly effectivePrice: ProviderServicePriceManagementDto | null;
  readonly catalogService: {
    readonly id: string;
    readonly code: string;
    readonly version: number;
  };
  readonly providerDisplay: {
    readonly nameAr: string | null;
    readonly nameEn: string | null;
  };
}

/** Staff-safe decision result — never includes hidden audit context. */
export interface StaffPriceDecisionResultDto {
  readonly decision: "APPROVE" | "REJECT";
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServicePriceId: string;
  readonly priceStatus: "EFFECTIVE" | "REJECTED";
  readonly version: number;
  readonly effectivePriceId: string | null;
}

/** Management-safe price history item without receipt/audit internals. */
export interface ProviderServicePriceHistoryItemDto {
  readonly id: string;
  readonly providerServicePriceId: string;
  readonly event: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly actorUserId: string;
  readonly reasonCode: string;
  readonly reasonText: string | null;
  readonly safeBefore: ProviderServicePriceSafeFacts | null;
  readonly safeAfter: ProviderServicePriceSafeFacts;
  readonly requestId: string;
  readonly aggregateVersion: number;
  readonly createdAt: string;
}

/** Management-safe enable/disable status history item. */
export interface ProviderServiceStatusHistoryItemDto {
  readonly id: string;
  readonly event: "OFFERING_ENABLED" | "OFFERING_DISABLED";
  readonly fromEnabled: boolean | null;
  readonly toEnabled: boolean;
  readonly actorUserId: string;
  readonly reasonCode: string;
  readonly reasonText: string | null;
  readonly requestId: string;
  readonly aggregateVersion: number;
  readonly createdAt: string;
}

const FORBIDDEN_OUTPUT_KEY =
  /(?:prisma|receipt|fingerprint|safeResult|password|token|cookie|otp|secret|databaseUrl|stack|contact|phone|email|holder|wallet|iban)/iu;

/**
 * @desc Fail closed when a management projection contains forbidden markers.
 * @access Application mapper
 */
export function assertSafeProviderServiceOutput(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertSafeProviderServiceOutput(entry);
    }
    return;
  }
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (FORBIDDEN_OUTPUT_KEY.test(key)) {
      throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED", undefined, {
        details: { reason: "UNSAFE_OUTPUT_KEY", key },
      });
    }
    assertSafeProviderServiceOutput(nested);
  }
}

/**
 * @desc Map a retained price snapshot to a management-safe DTO.
 * @access Application mapper
 */
export function toProviderServicePriceManagementDto(
  price: ProviderServicePriceSnapshot,
): ProviderServicePriceManagementDto {
  const dto: ProviderServicePriceManagementDto = {
    id: price.id,
    status: price.status,
    catalogPriceUnit: {
      id: price.catalogPriceUnitId,
      codeAtProposal: price.priceUnitCodeAtProposal,
    },
    currencyCode: price.currencyCode,
    currencyDecimalPlaces: price.currencyDecimalPlaces,
    price: formatMinorUnitsToCanonicalDecimal(
      price.providerPriceMinorUnits,
      price.currencyDecimalPlaces,
    ),
    minimumCharge: formatMinorUnitsToCanonicalDecimal(
      price.minimumChargeMinorUnits,
      price.currencyDecimalPlaces,
    ),
    approvalRequiredAtProposal: price.approvalRequiredAtProposal,
    effectiveAt: price.effectiveAt?.toISOString() ?? null,
    rejectedAt: price.rejectedAt?.toISOString() ?? null,
    supersededAt: price.supersededAt?.toISOString() ?? null,
    createdAt: price.createdAt.toISOString(),
  };
  assertSafeProviderServiceOutput(dto);
  return dto;
}

/**
 * @desc Allowlisted price history before/after facts from a price snapshot.
 * @access Application mapper
 */
export function toProviderServicePriceSafeFacts(
  price: ProviderServicePriceSnapshot,
): ProviderServicePriceSafeFacts {
  return {
    status: price.status,
    providerPrice: formatMinorUnitsToCanonicalDecimal(
      price.providerPriceMinorUnits,
      price.currencyDecimalPlaces,
    ),
    minimumCharge: formatMinorUnitsToCanonicalDecimal(
      price.minimumChargeMinorUnits,
      price.currencyDecimalPlaces,
    ),
    currencyCode: price.currencyCode,
    currencyDecimalPlaces: price.currencyDecimalPlaces,
    catalogPriceUnitId: price.catalogPriceUnitId,
    priceUnitCode: price.priceUnitCodeAtProposal,
    approvalRequiredAtProposal: price.approvalRequiredAtProposal,
    effectiveAt: price.effectiveAt?.toISOString() ?? null,
    rejectedAt: price.rejectedAt?.toISOString() ?? null,
    supersededAt: price.supersededAt?.toISOString() ?? null,
  };
}

/**
 * @desc Map Staff pending queue enrichment to a Staff-safe queue DTO.
 * @access Application mapper
 */
export function toStaffPendingPriceProposalDto(input: {
  readonly price: ProviderServicePriceSnapshot;
  readonly offeringVersion: number;
  readonly catalogServiceCode: string;
  readonly providerDisplayNameAr: string | null;
  readonly providerDisplayNameEn: string | null;
}): StaffPendingPriceProposalDto {
  const priceDto = toProviderServicePriceManagementDto(input.price);
  const dto: StaffPendingPriceProposalDto = {
    providerId: input.price.providerId,
    providerServiceId: input.price.providerServiceId,
    providerServiceVersion: input.offeringVersion,
    providerServicePriceId: input.price.id,
    catalogService: {
      id: input.price.catalogServiceId,
      code: input.catalogServiceCode,
    },
    catalogPriceUnit: priceDto.catalogPriceUnit,
    currencyCode: priceDto.currencyCode,
    currencyDecimalPlaces: priceDto.currencyDecimalPlaces,
    price: priceDto.price,
    minimumCharge: priceDto.minimumCharge,
    countryCodeAtProposal: input.price.countryCodeAtProposal,
    proposedAt: priceDto.createdAt,
    providerDisplay: {
      nameAr: input.providerDisplayNameAr,
      nameEn: input.providerDisplayNameEn,
    },
  };
  assertSafeProviderServiceOutput(dto);
  return dto;
}

/**
 * @desc Map Staff pending dossier facts without contacts or receipts.
 * @access Application mapper
 */
export function toStaffPendingPriceDossierDto(input: {
  readonly offering: ProviderServiceSnapshot;
  readonly pendingPrice: ProviderServicePriceSnapshot;
  readonly effectivePrice: ProviderServicePriceSnapshot | null;
  readonly catalogServiceCode: string;
  readonly catalogServiceVersion: number;
  readonly providerDisplayNameAr: string | null;
  readonly providerDisplayNameEn: string | null;
}): StaffPendingPriceDossierDto {
  const dto: StaffPendingPriceDossierDto = {
    providerId: input.offering.providerId,
    providerServiceId: input.offering.id,
    providerServiceVersion: input.offering.version,
    pendingPrice: toProviderServicePriceManagementDto(input.pendingPrice),
    effectivePrice:
      input.effectivePrice === null
        ? null
        : toProviderServicePriceManagementDto(input.effectivePrice),
    catalogService: {
      id: input.offering.catalogServiceId,
      code: input.catalogServiceCode,
      version: input.catalogServiceVersion,
    },
    providerDisplay: {
      nameAr: input.providerDisplayNameAr,
      nameEn: input.providerDisplayNameEn,
    },
  };
  assertSafeProviderServiceOutput(dto);
  return dto;
}

/**
 * @desc Map a Staff decision outcome to a Staff-safe response DTO.
 * @access Application mapper
 */
export function toStaffPriceDecisionResultDto(input: {
  readonly decision: "APPROVE" | "REJECT";
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServicePriceId: string;
  readonly priceStatus: "EFFECTIVE" | "REJECTED";
  readonly version: number;
  readonly effectivePriceId: string | null;
}): StaffPriceDecisionResultDto {
  const dto: StaffPriceDecisionResultDto = { ...input };
  assertSafeProviderServiceOutput(dto);
  return dto;
}

/**
 * @desc Map price history without receipt fingerprints or audit internals.
 * @access Application mapper
 */
export function toProviderServicePriceHistoryItemDto(
  row: ProviderServicePriceHistorySnapshot,
): ProviderServicePriceHistoryItemDto {
  const dto: ProviderServicePriceHistoryItemDto = {
    id: row.id,
    providerServicePriceId: row.providerServicePriceId,
    event: row.event,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorUserId: row.actorUserId,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    safeBefore: row.safeBefore,
    safeAfter: row.safeAfter,
    requestId: row.requestId,
    aggregateVersion: row.aggregateVersion,
    createdAt: row.createdAt.toISOString(),
  };
  assertSafeProviderServiceOutput(dto);
  return dto;
}

/**
 * @desc Map management-visible enable/disable status history.
 * @access Application mapper
 */
export function toProviderServiceStatusHistoryItemDto(
  row: ProviderServiceStatusHistorySnapshot,
): ProviderServiceStatusHistoryItemDto {
  if (row.event !== "OFFERING_ENABLED" && row.event !== "OFFERING_DISABLED") {
    throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED", undefined, {
      details: { reason: "NON_MANAGEMENT_STATUS_HISTORY_EVENT" },
    });
  }
  const dto: ProviderServiceStatusHistoryItemDto = {
    id: row.id,
    event: row.event,
    fromEnabled: row.fromEnabled,
    toEnabled: row.toEnabled,
    actorUserId: row.actorUserId,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    requestId: row.requestId,
    aggregateVersion: row.aggregateVersion,
    createdAt: row.createdAt.toISOString(),
  };
  assertSafeProviderServiceOutput(dto);
  return dto;
}

/**
 * @desc Map offering + Catalog reference + current prices to management DTO.
 * @access Application mapper
 */
export function toProviderServiceManagementDto(input: {
  readonly offering: ProviderServiceSnapshot;
  readonly catalogReference: ProviderOfferingCatalogReference;
  readonly effectivePrice: ProviderServicePriceSnapshot | null;
  readonly pendingPrice: ProviderServicePriceSnapshot | null;
  readonly pricingConfigurationValid?: boolean;
}): ProviderServiceManagementDto {
  const priceUnitId =
    input.effectivePrice?.catalogPriceUnitId ??
    input.pendingPrice?.catalogPriceUnitId ??
    null;
  const priceUnitActive =
    priceUnitId === null
      ? false
      : input.catalogReference.activePriceUnits.some(
          (unit) => unit.id === priceUnitId,
        );

  const usability = evaluateOfferingUsability({
    pricingConfigurationValid: input.pricingConfigurationValid ?? true,
    enabled: input.offering.enabled,
    estimatedDurationMinutes: input.offering.estimatedDurationMinutes,
    noteAr: input.offering.noteAr,
    noteEn: input.offering.noteEn,
    catalogSelectable: input.catalogReference.selectableForCountry,
    priceUnitActive,
    hasEffectivePrice: input.effectivePrice !== null,
    hasPendingPrice: input.pendingPrice !== null,
  });

  const dto: ProviderServiceManagementDto = {
    id: input.offering.id,
    providerId: input.offering.providerId,
    catalogService: {
      id: input.catalogReference.serviceId,
      code: input.catalogReference.serviceCode,
      version: input.catalogReference.serviceVersion,
      selectableForProviderCountry:
        input.catalogReference.selectableForCountry,
    },
    enabled: input.offering.enabled,
    estimatedDurationMinutes: input.offering.estimatedDurationMinutes,
    notes: {
      ar: input.offering.noteAr,
      en: input.offering.noteEn,
    },
    version: input.offering.version,
    effectivePrice:
      input.effectivePrice === null
        ? null
        : toProviderServicePriceManagementDto(input.effectivePrice),
    pendingPrice:
      input.pendingPrice === null
        ? null
        : toProviderServicePriceManagementDto(input.pendingPrice),
    usability,
    createdAt: input.offering.createdAt.toISOString(),
    updatedAt: input.offering.updatedAt.toISOString(),
  };
  assertSafeProviderServiceOutput(dto);
  return dto;
}

/**
 * @desc Rehydrate a stored safe create/configuration result for idempotent replay.
 * @access Application mapper
 */
export function managementDtoFromSafeResultJson(
  value: ProviderServiceSafeResultJson,
): ProviderServiceManagementDto {
  assertSafeProviderServiceOutput(value);
  const dto = value as unknown as ProviderServiceManagementDto;
  if (
    typeof dto.id !== "string" ||
    typeof dto.providerId !== "string" ||
    typeof dto.version !== "number"
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED", undefined, {
      details: { reason: "INVALID_STORED_SAFE_RESULT" },
    });
  }
  return dto;
}

/**
 * @desc Persistable JSON projection of a management DTO for command receipts.
 * @access Application mapper
 */
export function managementDtoToSafeResultJson(
  dto: ProviderServiceManagementDto,
): ProviderServiceSafeResultJson {
  assertSafeProviderServiceOutput(dto);
  return structuredClone(dto) as unknown as ProviderServiceSafeResultJson;
}

/**
 * @desc Rehydrate a stored Staff decision result for idempotent replay.
 * @access Application mapper
 */
export function staffDecisionDtoFromSafeResultJson(
  value: ProviderServiceSafeResultJson,
): StaffPriceDecisionResultDto {
  assertSafeProviderServiceOutput(value);
  const dto = value as unknown as StaffPriceDecisionResultDto;
  if (
    (dto.decision !== "APPROVE" && dto.decision !== "REJECT") ||
    typeof dto.providerId !== "string" ||
    typeof dto.providerServiceId !== "string" ||
    typeof dto.providerServicePriceId !== "string" ||
    typeof dto.version !== "number" ||
    (dto.priceStatus !== "EFFECTIVE" && dto.priceStatus !== "REJECTED")
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED", undefined, {
      details: { reason: "INVALID_STORED_STAFF_DECISION_RESULT" },
    });
  }
  return dto;
}

/**
 * @desc Persistable JSON projection of a Staff decision DTO for receipts.
 * @access Application mapper
 */
export function staffDecisionDtoToSafeResultJson(
  dto: StaffPriceDecisionResultDto,
): ProviderServiceSafeResultJson {
  assertSafeProviderServiceOutput(dto);
  return structuredClone(dto) as unknown as ProviderServiceSafeResultJson;
}

/**
 * Provider Service aggregate types for R1-P09.
 * Money crosses boundaries as canonical decimal strings; persistence and
 * internal arithmetic use exact minor-unit digit strings only — never JS number.
 */

import type { SnapshotReadyCatalogServiceDefinition } from "#modules/catalog/catalog.public";

export const PROVIDER_SERVICE_PRICE_STATUSES = [
  "PENDING",
  "EFFECTIVE",
  "REJECTED",
  "SUPERSEDED",
] as const;
export type ProviderServicePriceStatus =
  (typeof PROVIDER_SERVICE_PRICE_STATUSES)[number];

export const PROVIDER_SERVICE_PRICE_HISTORY_EVENTS = [
  "PRICE_PROPOSED_PENDING",
  "PRICE_EFFECTIVE_IMMEDIATE",
  "PRICE_APPROVED",
  "PRICE_REJECTED",
  "PRICE_SUPERSEDED_PENDING",
  "PRICE_SUPERSEDED_EFFECTIVE",
] as const;
export type ProviderServicePriceHistoryEvent =
  (typeof PROVIDER_SERVICE_PRICE_HISTORY_EVENTS)[number];

export const PROVIDER_SERVICE_STATUS_HISTORY_EVENTS = [
  "OFFERING_CREATED",
  "CONFIGURATION_UPDATED",
  "OFFERING_ENABLED",
  "OFFERING_DISABLED",
] as const;
export type ProviderServiceStatusHistoryEvent =
  (typeof PROVIDER_SERVICE_STATUS_HISTORY_EVENTS)[number];

/** Management status-history endpoint returns only these two events. */
export const PROVIDER_SERVICE_MANAGEMENT_STATUS_EVENTS = [
  "OFFERING_ENABLED",
  "OFFERING_DISABLED",
] as const;
export type ProviderServiceManagementStatusEvent =
  (typeof PROVIDER_SERVICE_MANAGEMENT_STATUS_EVENTS)[number];

/** Approved FR-033 / DEC-051 readiness blocker codes. */
export const PROVIDER_SERVICES_READY_BLOCKER_CODES = [
  "NO_PROVIDER_SERVICES",
  "NO_ENABLED_PROVIDER_SERVICE",
  "CATALOG_SERVICE_UNAVAILABLE",
  "PRICE_UNIT_UNAVAILABLE",
  "NO_EFFECTIVE_PRICE",
  "PRICE_APPROVAL_PENDING",
  "OFFERING_CONFIGURATION_INVALID",
] as const;
export type ProviderServicesReadyBlockerCode =
  (typeof PROVIDER_SERVICES_READY_BLOCKER_CODES)[number];

export const PROVIDER_SERVICE_SNAPSHOT_STATUSES = [
  "AVAILABLE",
  "UNAVAILABLE",
  "CONFLICT",
] as const;
export type ProviderServiceSnapshotStatus =
  (typeof PROVIDER_SERVICE_SNAPSHOT_STATUSES)[number];

export type ProviderServiceExactLocale = "AR" | "EN";

/** Exact whole minor-unit digit string (no sign, no decimal point, ≤65 digits). */
export type MinorUnitsDigitString = string;

/** Canonical plain decimal string at an API/public-contract boundary. */
export type CanonicalDecimalString = string;

export interface ProviderServiceCommandMeta {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
}

export interface VersionedProviderServiceCommand extends ProviderServiceCommandMeta {
  readonly expectedVersion: number;
}

export interface ProviderServiceNotePair {
  readonly noteAr: string | null;
  readonly noteEn: string | null;
}

export interface ProviderServiceSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly catalogServiceId: string;
  readonly enabled: boolean;
  readonly estimatedDurationMinutes: number;
  readonly noteAr: string | null;
  readonly noteEn: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProviderServicePriceSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly catalogServiceId: string;
  readonly catalogPriceUnitId: string;
  readonly priceUnitCodeAtProposal: string;
  readonly countryIdAtProposal: string;
  readonly countryCodeAtProposal: string;
  readonly currencyId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly providerPriceMinorUnits: MinorUnitsDigitString;
  readonly minimumChargeMinorUnits: MinorUnitsDigitString;
  readonly maximumPriceMinorUnitsAtProposal: MinorUnitsDigitString;
  readonly approvalRequiredAtProposal: boolean;
  readonly status: ProviderServicePriceStatus;
  readonly proposedByUserId: string;
  readonly effectiveAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly supersededAt: Date | null;
  readonly createdAt: Date;
}

/** Allowlisted commercial facts for price history before/after JSON. */
export interface ProviderServicePriceSafeFacts {
  readonly status?: ProviderServicePriceStatus;
  readonly providerPrice?: CanonicalDecimalString;
  readonly minimumCharge?: CanonicalDecimalString;
  readonly currencyCode?: string;
  readonly currencyDecimalPlaces?: number;
  readonly catalogPriceUnitId?: string;
  readonly priceUnitCode?: string;
  readonly approvalRequiredAtProposal?: boolean;
  readonly effectiveAt?: string | null;
  readonly rejectedAt?: string | null;
  readonly supersededAt?: string | null;
}

/** Allowlisted offering facts for status/configuration history JSON. */
export interface ProviderServiceOfferingSafeFacts {
  readonly enabled?: boolean | null;
  readonly estimatedDurationMinutes?: number;
  readonly noteArPresent?: boolean;
  readonly noteEnPresent?: boolean;
  readonly catalogServiceId?: string;
  readonly version?: number;
}

export type ProviderServiceSafeJsonPrimitive = string | number | boolean | null;
export type ProviderServiceSafeJsonValue =
  | ProviderServiceSafeJsonPrimitive
  | readonly ProviderServiceSafeJsonValue[]
  | { readonly [key: string]: ProviderServiceSafeJsonValue };

export type ProviderServiceSafeResultJson = {
  readonly [key: string]: ProviderServiceSafeJsonValue;
};

/**
 * Durable command receipt fields. On price history, primary command rows carry
 * all fields; secondary transition rows leave every receipt field null.
 * Status-history primary rows always carry the full receipt set.
 */
export interface ProviderServiceCommandReceiptFields {
  readonly scopeKey: string | null;
  readonly idempotencyKey: string | null;
  readonly requestFingerprint: string | null;
  readonly safeResultCode: string | null;
  readonly safeResultJson: ProviderServiceSafeResultJson | null;
}

export interface ProviderServicePriceHistoryInput {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServicePriceId: string;
  readonly event: ProviderServicePriceHistoryEvent;
  readonly fromStatus: ProviderServicePriceStatus | null;
  readonly toStatus: ProviderServicePriceStatus;
  readonly actorUserId: string;
  readonly reasonCode: string;
  readonly reasonText: string | null;
  readonly safeBefore: ProviderServicePriceSafeFacts | null;
  readonly safeAfter: ProviderServicePriceSafeFacts;
  readonly requestId: string;
  readonly aggregateVersion: number;
  readonly operationKey: string;
  readonly receipt: ProviderServiceCommandReceiptFields;
}

export interface ProviderServicePriceHistorySnapshot
  extends ProviderServicePriceHistoryInput {
  readonly id: string;
  readonly createdAt: Date;
}

export interface ProviderServiceStatusHistoryInput {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly event: ProviderServiceStatusHistoryEvent;
  readonly fromEnabled: boolean | null;
  readonly toEnabled: boolean;
  readonly actorUserId: string;
  readonly reasonCode: string;
  readonly reasonText: string | null;
  readonly safeBefore: ProviderServiceOfferingSafeFacts | null;
  readonly safeAfter: ProviderServiceOfferingSafeFacts;
  readonly requestId: string;
  readonly aggregateVersion: number;
  readonly operationKey: string;
  readonly receipt: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly safeResultCode: string;
    readonly safeResultJson: ProviderServiceSafeResultJson;
  };
}

export interface ProviderServiceStatusHistorySnapshot
  extends ProviderServiceStatusHistoryInput {
  readonly id: string;
  readonly createdAt: Date;
}

export interface ProviderServiceReceiptLookup {
  readonly scopeKey: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly safeResultCode: string;
  readonly safeResultJson: ProviderServiceSafeResultJson;
  readonly aggregateVersion: number;
  readonly source: "PRICE_HISTORY" | "STATUS_HISTORY";
  readonly historyId: string;
}

export interface ProviderServicesReadyFacts {
  readonly providerId: string;
  readonly servicesReady: boolean;
  readonly qualifyingOfferingCount: number;
  readonly blockerCodes: readonly ProviderServicesReadyBlockerCode[];
}

export interface ProviderServiceReadinessProjection {
  readonly providerServiceId: string;
  readonly catalogServiceId: string;
  readonly enabled: boolean;
  readonly estimatedDurationMinutes: number;
  readonly noteAr: string | null;
  readonly noteEn: string | null;
  readonly version: number;
  readonly effectivePrice: ProviderServicePriceSnapshot | null;
  readonly pendingPrice: ProviderServicePriceSnapshot | null;
}

export type ProviderServiceSnapshotReadyResult =
  | {
      readonly status: "AVAILABLE";
      readonly value: {
        readonly providerId: string;
        readonly providerServiceId: string;
        readonly providerServiceVersion: number;
        readonly catalogServiceId: string;
        readonly catalogServiceCode: string;
        readonly catalogServiceVersion: number;
        readonly estimatedDurationMinutes: number;
        readonly serviceNote: string | null;
        readonly providerServicePriceId: string;
        readonly price: CanonicalDecimalString;
        readonly minimumCharge: CanonicalDecimalString;
        readonly currencyCode: string;
        readonly effectiveAt: string;
        readonly priceUnit: {
          readonly id: string;
          readonly code: string;
          readonly label: string;
        };
        /** Structural Catalog snapshot-ready definition (owned fields only). */
        readonly catalogDefinition: SnapshotReadyCatalogServiceDefinition;
      };
    }
  | { readonly status: "UNAVAILABLE" }
  | {
      readonly status: "CONFLICT";
      readonly code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT";
    };

export type ProviderServicePriceTransitionTrigger =
  | "PROPOSE_PENDING"
  | "PROPOSE_IMMEDIATE"
  | "STAFF_APPROVE"
  | "STAFF_REJECT"
  | "SUPERSEDE_PENDING"
  | "SUPERSEDE_EFFECTIVE";

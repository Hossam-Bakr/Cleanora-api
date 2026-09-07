/**
 * Pure DEC-051 usable-offering readiness evaluation (R1-P09).
 * Never persists readiness, never decides LIVE/coverage/schedule/capacity,
 * and never flips eligibleForPublicBrowse.
 */

import {
  PROVIDER_SERVICES_READY_BLOCKER_CODES,
  type ProviderServiceExactLocale,
  type ProviderServicesReadyBlockerCode,
  type ProviderServicesReadyFacts,
} from "./provider-service.types.js";

/**
 * Stable blocker precedence for aggregate readiness (FR-035 / DEC-051).
 * Earlier codes win when multiple distinct codes appear across offerings.
 */
export const PROVIDER_SERVICES_READY_BLOCKER_PRECEDENCE = [
  "NO_PROVIDER_SERVICES",
  "NO_ENABLED_PROVIDER_SERVICE",
  "CATALOG_SERVICE_UNAVAILABLE",
  "PRICE_UNIT_UNAVAILABLE",
  "NO_EFFECTIVE_PRICE",
  "PRICE_APPROVAL_PENDING",
  "OFFERING_CONFIGURATION_INVALID",
] as const satisfies readonly ProviderServicesReadyBlockerCode[];

const BLOCKER_RANK = new Map<ProviderServicesReadyBlockerCode, number>(
  PROVIDER_SERVICES_READY_BLOCKER_PRECEDENCE.map((code, index) => [
    code,
    index,
  ]),
);

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 1440;
const MIN_NOTE_LENGTH = 1;
const MAX_NOTE_LENGTH = 1000;

export interface OfferingUsabilityInput {
  readonly enabled: boolean;
  readonly estimatedDurationMinutes: number;
  readonly noteAr: string | null;
  readonly noteEn: string | null;
  readonly catalogSelectable: boolean;
  readonly priceUnitActive: boolean;
  readonly hasEffectivePrice: boolean;
  readonly hasPendingPrice: boolean;
  /**
   * Current Configuration country currency/maximum (and optional effective-
   * price currency/max compatibility). Defaults to true for callers that
   * already validated commercial amounts elsewhere.
   */
  readonly pricingConfigurationValid?: boolean;
}

export interface OfferingUsabilityResult {
  readonly usable: boolean;
  readonly blockerCodes: readonly ProviderServicesReadyBlockerCode[];
}

export interface ProviderServicesReadinessOfferingFact {
  readonly enabled: boolean;
  readonly usable: boolean;
  readonly blockerCodes: readonly ProviderServicesReadyBlockerCode[];
}

/**
 * @desc Evaluate one offering's current DEC-051 usability blockers.
 * @access Domain policy
 * @explanation Usability is never persisted; Catalog/config drift requalifies
 * the unchanged offering on the next read. Does not inspect LIVE, coverage,
 * schedule, or capacity.
 */
export function evaluateOfferingUsability(
  input: OfferingUsabilityInput,
): OfferingUsabilityResult {
  const blockers: ProviderServicesReadyBlockerCode[] = [];

  if (
    !isValidDurationMinutes(input.estimatedDurationMinutes) ||
    !isValidNotePair(input.noteAr, input.noteEn)
  ) {
    blockers.push("OFFERING_CONFIGURATION_INVALID");
  }

  if (input.pricingConfigurationValid === false) {
    if (!blockers.includes("OFFERING_CONFIGURATION_INVALID")) {
      blockers.push("OFFERING_CONFIGURATION_INVALID");
    }
  }

  if (!input.catalogSelectable) {
    blockers.push("CATALOG_SERVICE_UNAVAILABLE");
  }
  if (!input.priceUnitActive) {
    blockers.push("PRICE_UNIT_UNAVAILABLE");
  }
  if (!input.hasEffectivePrice) {
    if (input.hasPendingPrice) {
      blockers.push("PRICE_APPROVAL_PENDING");
    } else {
      blockers.push("NO_EFFECTIVE_PRICE");
    }
  }

  const configurationOk = input.pricingConfigurationValid !== false;
  const usable =
    input.enabled &&
    blockers.length === 0 &&
    input.hasEffectivePrice &&
    input.catalogSelectable &&
    input.priceUnitActive &&
    configurationOk;

  return { usable, blockerCodes: dedupeBlockers(blockers) };
}

/**
 * @desc Aggregate Provider-level servicesReady facts from offering evaluations.
 * @access Domain policy
 * @explanation Provider approval is required for servicesReady=true (FR-033).
 * Aggregate blockers use precedence + deduplication; no unapproved codes.
 */
export function evaluateProviderServicesReadiness(input: {
  readonly providerId: string;
  readonly providerApproved: boolean;
  readonly offerings: readonly ProviderServicesReadinessOfferingFact[];
}): ProviderServicesReadyFacts {
  const { providerId, providerApproved, offerings } = input;

  if (offerings.length === 0) {
    return {
      providerId,
      servicesReady: false,
      qualifyingOfferingCount: 0,
      blockerCodes: ["NO_PROVIDER_SERVICES"],
    };
  }

  const enabled = offerings.filter((offering) => offering.enabled);
  if (enabled.length === 0) {
    return {
      providerId,
      servicesReady: false,
      qualifyingOfferingCount: 0,
      blockerCodes: ["NO_ENABLED_PROVIDER_SERVICE"],
    };
  }

  const qualifying = enabled.filter((offering) => offering.usable);
  const qualifyingOfferingCount = qualifying.length;
  if (qualifyingOfferingCount > 0) {
    return {
      providerId,
      servicesReady: providerApproved,
      qualifyingOfferingCount,
      blockerCodes: [],
    };
  }

  const collected: ProviderServicesReadyBlockerCode[] = [];
  for (const offering of enabled) {
    for (const code of offering.blockerCodes) {
      collected.push(code);
    }
  }

  return {
    providerId,
    servicesReady: false,
    qualifyingOfferingCount: 0,
    blockerCodes: sortBlockersByPrecedence(dedupeBlockers(collected)),
  };
}

/**
 * @desc Exact-locale service note for snapshot-ready consumers (no fallback).
 * @access Domain policy
 */
export function selectExactLocaleServiceNote(input: {
  readonly locale: ProviderServiceExactLocale;
  readonly noteAr: string | null;
  readonly noteEn: string | null;
}): string | null {
  if (input.noteAr === null && input.noteEn === null) {
    return null;
  }
  return input.locale === "AR" ? input.noteAr : input.noteEn;
}

/**
 * @desc True when every blocker code is an approved DEC-051 value.
 * @access Domain policy
 */
export function isApprovedServicesReadyBlockerCode(
  code: string,
): code is ProviderServicesReadyBlockerCode {
  return (PROVIDER_SERVICES_READY_BLOCKER_CODES as readonly string[]).includes(
    code,
  );
}

function isValidDurationMinutes(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_DURATION_MINUTES &&
    value <= MAX_DURATION_MINUTES
  );
}

function isValidNotePair(
  noteAr: string | null,
  noteEn: string | null,
): boolean {
  if (noteAr === null && noteEn === null) {
    return true;
  }
  if (typeof noteAr !== "string" || typeof noteEn !== "string") {
    return false;
  }
  const trimmedAr = noteAr.trim();
  const trimmedEn = noteEn.trim();
  return (
    trimmedAr.length >= MIN_NOTE_LENGTH &&
    trimmedAr.length <= MAX_NOTE_LENGTH &&
    trimmedEn.length >= MIN_NOTE_LENGTH &&
    trimmedEn.length <= MAX_NOTE_LENGTH
  );
}

function dedupeBlockers(
  codes: readonly ProviderServicesReadyBlockerCode[],
): readonly ProviderServicesReadyBlockerCode[] {
  const seen = new Set<ProviderServicesReadyBlockerCode>();
  const result: ProviderServicesReadyBlockerCode[] = [];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

function sortBlockersByPrecedence(
  codes: readonly ProviderServicesReadyBlockerCode[],
): readonly ProviderServicesReadyBlockerCode[] {
  return [...codes].sort((left, right) => {
    const leftRank = BLOCKER_RANK.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = BLOCKER_RANK.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

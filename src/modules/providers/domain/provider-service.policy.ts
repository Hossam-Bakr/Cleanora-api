/**
 * Pure Provider Service commercial and lifecycle policy helpers.
 * Monetary math uses digit-string arithmetic only — never JS number/float.
 */

import { createHash } from "node:crypto";
import type { ProviderServicePricingPolicyResult } from "#modules/configuration/configuration.public";

import { ProviderServiceError } from "./provider-service.errors.js";
import { evaluateOfferingUsability } from "./provider-service-readiness.policy.js";
import type {
  ProviderServiceNotePair,
  ProviderServicePriceStatus,
  ProviderServicePriceSnapshot,
  ProviderServicePriceTransitionTrigger,
  ProviderServicesReadyBlockerCode,
} from "./provider-service.types.js";

export { evaluateOfferingUsability };

/** Revalidate retained commercial facts against the current country policy. */
export function isCurrentProviderServicePriceValid(input: {
  readonly pricingPolicy: ProviderServicePricingPolicyResult;
  readonly effectivePrice: ProviderServicePriceSnapshot | null;
  readonly countryCode: string;
}): boolean {
  if (input.pricingPolicy.status !== "AVAILABLE") return false;
  const policy = input.pricingPolicy.value;
  if (policy.countryCode !== input.countryCode) return false;
  const price = input.effectivePrice;
  if (price === null) return true;
  if (price.countryCodeAtProposal !== input.countryCode ||
      price.countryIdAtProposal !== policy.countryId ||
      price.currencyId !== policy.currency.id ||
      price.currencyCode !== policy.currency.code ||
      price.currencyDecimalPlaces !== policy.currency.decimalPlaces) return false;
  try {
    validatePriceAndMinimumAgainstMaximum({
      priceDecimal: formatMinorUnitsToCanonicalDecimal(price.providerPriceMinorUnits, price.currencyDecimalPlaces),
      minimumChargeDecimal: formatMinorUnitsToCanonicalDecimal(price.minimumChargeMinorUnits, price.currencyDecimalPlaces),
      maximumPriceDecimal: policy.maximumPrice,
      decimalPlaces: policy.currency.decimalPlaces,
    });
    return true;
  } catch (error: unknown) {
    if (error instanceof ProviderServiceError) return false;
    throw error;
  }
}

const MAX_MINOR_UNIT_DIGITS = 65;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 1440;
const MIN_NOTE_LENGTH = 1;
const MAX_NOTE_LENGTH = 1000;
const MAX_CURRENCY_DECIMAL_PLACES = 30;

/**
 * Compare two non-negative minor-unit digit strings without binary floats.
 * Leading zeros are ignored except for the value zero itself.
 */
export function compareMinorUnitsDigitStrings(
  left: string,
  right: string,
): -1 | 0 | 1 {
  const a = stripLeadingZeros(left);
  const b = stripLeadingZeros(right);
  if (a.length !== b.length) {
    return a.length < b.length ? -1 : 1;
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+/u, "");
  return stripped.length === 0 ? "0" : stripped;
}

function assertDigitString(value: string, field: string): void {
  if (!/^[0-9]+$/u.test(value)) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field, reason: "NON_DIGIT_MINOR_UNITS" },
    });
  }
}

/**
 * @desc Parse a canonical plain decimal string into exact minor-unit digits.
 * @access Domain policy
 * @explanation Rejects signs, exponents, grouping, whitespace, excess scale,
 * and leading-zero malformations; never uses JS number for money math.
 */
export function parseCanonicalDecimalToMinorUnits(
  decimalString: string,
  decimalPlaces: number,
): string {
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > MAX_CURRENCY_DECIMAL_PLACES
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "decimalPlaces", reason: "SCALE_OUT_OF_RANGE" },
    });
  }

  if (typeof decimalString !== "string") {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "NOT_STRING" },
    });
  }

  if (decimalString.length === 0 || /\s/u.test(decimalString)) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "WHITESPACE_OR_EMPTY" },
    });
  }

  // Signs, exponents, grouping, and other non-canonical tokens fail closed.
  if (/[eE+\-,_]/u.test(decimalString)) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "NON_CANONICAL_SYNTAX" },
    });
  }

  const match = /^([0-9]+)(?:\.([0-9]+))?$/u.exec(decimalString);
  if (match === null) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "NON_CANONICAL_SYNTAX" },
    });
  }

  const integerPart = match[1] ?? "";
  const fractionPart = match[2] ?? "";

  if (integerPart.length === 0) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "MISSING_INTEGER_PART" },
    });
  }

  if (integerPart.length > 1 && integerPart.startsWith("0")) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "LEADING_ZERO_MALFORMED" },
    });
  }

  if (fractionPart.length > decimalPlaces) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "EXCESS_SCALE" },
    });
  }

  const paddedFraction = fractionPart.padEnd(decimalPlaces, "0");
  const combined = `${integerPart}${paddedFraction}`;
  const minorUnits = stripLeadingZeros(combined);

  if (minorUnits.length > MAX_MINOR_UNIT_DIGITS) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "amount", reason: "MINOR_UNITS_TOO_WIDE" },
    });
  }

  assertDigitString(minorUnits, "amount");
  return minorUnits;
}

/**
 * @desc Format exact minor-unit digits as a canonical boundary decimal string.
 * @access Domain policy
 * @explanation Inserts the decimal point from the recorded scale and pads
 * required zeros without rounding or binary floating-point conversion.
 */
export function formatMinorUnitsToCanonicalDecimal(
  minorUnitsDigitString: string,
  decimalPlaces: number,
): string {
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > MAX_CURRENCY_DECIMAL_PLACES
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "decimalPlaces", reason: "SCALE_OUT_OF_RANGE" },
    });
  }

  if (
    typeof minorUnitsDigitString !== "string" ||
    !/^[0-9]+$/u.test(minorUnitsDigitString)
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "minorUnits", reason: "NON_DIGIT_MINOR_UNITS" },
    });
  }

  if (minorUnitsDigitString.length > MAX_MINOR_UNIT_DIGITS) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "minorUnits", reason: "MINOR_UNITS_TOO_WIDE" },
    });
  }

  const normalized = stripLeadingZeros(minorUnitsDigitString);
  if (decimalPlaces === 0) {
    return normalized;
  }

  const padded = normalized.padStart(decimalPlaces + 1, "0");
  const splitAt = padded.length - decimalPlaces;
  const integerPart = padded.slice(0, splitAt);
  const fractionPart = padded.slice(splitAt);
  return `${stripLeadingZeros(integerPart)}.${fractionPart}`;
}

/**
 * @desc Validate price and minimum against a country maximum using digit math.
 * @access Domain policy
 */
export function validatePriceAndMinimumAgainstMaximum(input: {
  readonly priceDecimal: string;
  readonly minimumChargeDecimal: string;
  readonly maximumPriceDecimal: string;
  readonly decimalPlaces: number;
}): {
  readonly providerPriceMinorUnits: string;
  readonly minimumChargeMinorUnits: string;
  readonly maximumPriceMinorUnits: string;
} {
  const providerPriceMinorUnits = parseCanonicalDecimalToMinorUnits(
    input.priceDecimal,
    input.decimalPlaces,
  );
  const minimumChargeMinorUnits = parseCanonicalDecimalToMinorUnits(
    input.minimumChargeDecimal,
    input.decimalPlaces,
  );
  const maximumPriceMinorUnits = parseCanonicalDecimalToMinorUnits(
    input.maximumPriceDecimal,
    input.decimalPlaces,
  );

  if (compareMinorUnitsDigitStrings(providerPriceMinorUnits, "0") <= 0) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "price", reason: "NOT_POSITIVE" },
    });
  }
  if (compareMinorUnitsDigitStrings(minimumChargeMinorUnits, "0") <= 0) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "minimumCharge", reason: "NOT_POSITIVE" },
    });
  }
  if (
    compareMinorUnitsDigitStrings(
      minimumChargeMinorUnits,
      providerPriceMinorUnits,
    ) < 0
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "minimumCharge", reason: "BELOW_PRICE" },
    });
  }
  if (
    compareMinorUnitsDigitStrings(
      providerPriceMinorUnits,
      maximumPriceMinorUnits,
    ) > 0
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "price", reason: "EXCEEDS_MAXIMUM" },
    });
  }
  if (
    compareMinorUnitsDigitStrings(
      minimumChargeMinorUnits,
      maximumPriceMinorUnits,
    ) > 0
  ) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { field: "minimumCharge", reason: "EXCEEDS_MAXIMUM" },
    });
  }

  return {
    providerPriceMinorUnits,
    minimumChargeMinorUnits,
    maximumPriceMinorUnits,
  };
}

/**
 * @desc Require whole minutes in 1–1440 inclusive.
 * @access Domain policy
 */
export function validateDurationMinutes(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_DURATION_MINUTES ||
    value > MAX_DURATION_MINUTES
  ) {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "estimatedDurationMinutes", reason: "OUT_OF_RANGE" },
    });
  }
  return value;
}

/**
 * @desc Notes are both absent, or both trimmed to 1–1000 characters.
 * @access Domain policy
 */
export function validateNotePair(input: {
  readonly noteAr?: string | null | undefined;
  readonly noteEn?: string | null | undefined;
}): ProviderServiceNotePair {
  const rawAr = input.noteAr ?? null;
  const rawEn = input.noteEn ?? null;

  if (rawAr === null && rawEn === null) {
    return { noteAr: null, noteEn: null };
  }

  if (typeof rawAr !== "string" || typeof rawEn !== "string") {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "notes", reason: "PAIR_INCOMPLETE" },
    });
  }

  const noteAr = rawAr.trim();
  const noteEn = rawEn.trim();

  if (
    noteAr.length < MIN_NOTE_LENGTH ||
    noteAr.length > MAX_NOTE_LENGTH ||
    noteEn.length < MIN_NOTE_LENGTH ||
    noteEn.length > MAX_NOTE_LENGTH
  ) {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "notes", reason: "LENGTH_OUT_OF_RANGE" },
    });
  }

  return { noteAr, noteEn };
}

/**
 * @desc Initial retained-price status from country approvalRequired at proposal.
 * @access Domain policy
 */
export function initialPriceStatusFromApprovalRequired(
  approvalRequired: boolean,
): Extract<ProviderServicePriceStatus, "PENDING" | "EFFECTIVE"> {
  return approvalRequired ? "PENDING" : "EFFECTIVE";
}

export function priceHistoryEventForInitialStatus(
  status: Extract<ProviderServicePriceStatus, "PENDING" | "EFFECTIVE">,
): "PRICE_PROPOSED_PENDING" | "PRICE_EFFECTIVE_IMMEDIATE" {
  return status === "PENDING"
    ? "PRICE_PROPOSED_PENDING"
    : "PRICE_EFFECTIVE_IMMEDIATE";
}

export function isTerminalPriceStatus(
  status: ProviderServicePriceStatus,
): boolean {
  return status === "REJECTED" || status === "SUPERSEDED";
}

/**
 * @desc Resolve the legal next status for an approved transition trigger.
 * @access Domain policy
 */
export function resolvePriceTransition(input: {
  readonly fromStatus: ProviderServicePriceStatus | null;
  readonly trigger: ProviderServicePriceTransitionTrigger;
}): {
  readonly toStatus: ProviderServicePriceStatus;
  readonly event:
    | "PRICE_PROPOSED_PENDING"
    | "PRICE_EFFECTIVE_IMMEDIATE"
    | "PRICE_APPROVED"
    | "PRICE_REJECTED"
    | "PRICE_SUPERSEDED_PENDING"
    | "PRICE_SUPERSEDED_EFFECTIVE";
} {
  switch (input.trigger) {
    case "PROPOSE_PENDING":
      if (input.fromStatus !== null) {
        throwIllegalTransition(input.fromStatus, input.trigger);
      }
      return { toStatus: "PENDING", event: "PRICE_PROPOSED_PENDING" };
    case "PROPOSE_IMMEDIATE":
      if (input.fromStatus !== null) {
        throwIllegalTransition(input.fromStatus, input.trigger);
      }
      return { toStatus: "EFFECTIVE", event: "PRICE_EFFECTIVE_IMMEDIATE" };
    case "STAFF_APPROVE":
      if (input.fromStatus !== "PENDING") {
        throwIllegalTransition(input.fromStatus, input.trigger);
      }
      return { toStatus: "EFFECTIVE", event: "PRICE_APPROVED" };
    case "STAFF_REJECT":
      if (input.fromStatus !== "PENDING") {
        throwIllegalTransition(input.fromStatus, input.trigger);
      }
      return { toStatus: "REJECTED", event: "PRICE_REJECTED" };
    case "SUPERSEDE_PENDING":
      if (input.fromStatus !== "PENDING") {
        throwIllegalTransition(input.fromStatus, input.trigger);
      }
      return { toStatus: "SUPERSEDED", event: "PRICE_SUPERSEDED_PENDING" };
    case "SUPERSEDE_EFFECTIVE":
      if (input.fromStatus !== "EFFECTIVE") {
        throwIllegalTransition(input.fromStatus, input.trigger);
      }
      return { toStatus: "SUPERSEDED", event: "PRICE_SUPERSEDED_EFFECTIVE" };
    default: {
      const _exhaustive: never = input.trigger;
      return _exhaustive;
    }
  }
}

function throwIllegalTransition(
  fromStatus: ProviderServicePriceStatus | null,
  trigger: ProviderServicePriceTransitionTrigger,
): never {
  throw new ProviderServiceError(
    "PROVIDER_SERVICE_PRICE_TRANSITION_ILLEGAL",
    undefined,
    {
      details: {
        fromStatus,
        trigger,
      },
    },
  );
}

/**
 * @desc Timestamp fields required after a retained-price status change.
 * @access Domain policy
 */
export function priceTransitionTimestamps(input: {
  readonly fromStatus: ProviderServicePriceStatus;
  readonly toStatus: Extract<
    ProviderServicePriceStatus,
    "EFFECTIVE" | "REJECTED" | "SUPERSEDED"
  >;
  readonly transitionedAt: Date;
  readonly priorEffectiveAt: Date | null;
}): {
  readonly effectiveAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly supersededAt: Date | null;
} {
  switch (input.toStatus) {
    case "EFFECTIVE":
      return {
        effectiveAt: input.transitionedAt,
        rejectedAt: null,
        supersededAt: null,
      };
    case "REJECTED":
      return {
        effectiveAt: null,
        rejectedAt: input.transitionedAt,
        supersededAt: null,
      };
    case "SUPERSEDED":
      return {
        effectiveAt:
          input.fromStatus === "EFFECTIVE" ? input.priorEffectiveAt : null,
        rejectedAt: null,
        supersededAt: input.transitionedAt,
      };
    default: {
      const _exhaustive: never = input.toStatus;
      return _exhaustive;
    }
  }
}

/**
 * @desc Normalize Catalog service codes for create-scope identity.
 * @access Domain policy
 */
export function normalizeCatalogServiceCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "catalogServiceCode", reason: "EMPTY" },
    });
  }
  return trimmed.toUpperCase();
}

/**
 * @desc Build the durable create receipt scope for a Catalog service code.
 * @access Domain policy
 * @explanation Create replay must not depend on current Catalog availability,
 * so the scope uses the normalized code rather than a generated offering id.
 */
export function buildCreateOfferingScopeKey(
  providerId: string,
  catalogServiceCode: string,
): string {
  return `provider:${providerId}:service:create:${normalizeCatalogServiceCode(catalogServiceCode)}`;
}

/**
 * @desc Build the durable configuration receipt scope for an offering.
 * @access Domain policy
 */
export function buildConfigurationScopeKey(
  providerId: string,
  providerServiceId: string,
): string {
  return `provider:${providerId}:service:${providerServiceId}:configuration`;
}

/**
 * @desc Build the durable price-proposal receipt scope for an offering.
 * @access Domain policy
 */
export function buildPriceProposalScopeKey(
  providerId: string,
  providerServiceId: string,
): string {
  return `provider:${providerId}:service:${providerServiceId}:price-proposal`;
}

/**
 * @desc Build the durable lifecycle receipt scope for an offering.
 * @access Domain policy
 */
export function buildLifecycleScopeKey(
  providerId: string,
  providerServiceId: string,
): string {
  return `provider:${providerId}:service:${providerServiceId}:lifecycle`;
}

const MIN_REASON_LENGTH = 1;
const MAX_REASON_LENGTH = 1000;

/** Stable primary reason code for an accepted Provider price proposal. */
export const PRICE_PROPOSAL_REASON_CODE = "PRICE_PROPOSAL" as const;

/** Stable derived reason when a prior pending/effective row is superseded. */
export const REPLACED_BY_NEW_PROPOSAL_REASON_CODE =
  "REPLACED_BY_NEW_PROPOSAL" as const;

/**
 * @desc Require a trimmed free-text reason of 1–1000 characters.
 * @access Domain policy
 */
export function validateProviderReasonText(reason: unknown): string {
  if (typeof reason !== "string") {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "reason", reason: "NOT_STRING" },
    });
  }
  const trimmed = reason.trim();
  if (
    trimmed.length < MIN_REASON_LENGTH ||
    trimmed.length > MAX_REASON_LENGTH
  ) {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "reason", reason: "LENGTH_OUT_OF_RANGE" },
    });
  }
  return trimmed;
}

export type ProviderServiceLifecycleAction = "ENABLE" | "DISABLE";

/**
 * @desc Resolve enable/disable against the current offering flag.
 * @access Domain policy
 * @explanation Same-state commands are a no-op without fake history; a real
 * transition still requires later version, receipt, and audit work.
 */
export function resolveLifecycleTransition(input: {
  readonly currentlyEnabled: boolean;
  readonly action: ProviderServiceLifecycleAction;
}):
  | { readonly kind: "NO_OP"; readonly enabled: boolean }
  | {
      readonly kind: "TRANSITION";
      readonly fromEnabled: boolean;
      readonly toEnabled: boolean;
      readonly event: "OFFERING_ENABLED" | "OFFERING_DISABLED";
      readonly reasonCode: "OFFERING_ENABLED" | "OFFERING_DISABLED";
    } {
  const toEnabled = input.action === "ENABLE";
  if (input.currentlyEnabled === toEnabled) {
    return { kind: "NO_OP", enabled: input.currentlyEnabled };
  }
  if (toEnabled) {
    return {
      kind: "TRANSITION",
      fromEnabled: false,
      toEnabled: true,
      event: "OFFERING_ENABLED",
      reasonCode: "OFFERING_ENABLED",
    };
  }
  return {
    kind: "TRANSITION",
    fromEnabled: true,
    toEnabled: false,
    event: "OFFERING_DISABLED",
    reasonCode: "OFFERING_DISABLED",
  };
}

/**
 * @desc Collect DEC-051 enable blockers ignoring the current enabled flag.
 * @access Domain policy
 */
export function collectEnableBlockerCodes(input: {
  readonly estimatedDurationMinutes: number;
  readonly noteAr: string | null;
  readonly noteEn: string | null;
  readonly catalogSelectable: boolean;
  readonly priceUnitActive: boolean;
  readonly hasEffectivePrice: boolean;
  readonly hasPendingPrice: boolean;
}): readonly ProviderServicesReadyBlockerCode[] {
  const evaluation = evaluateOfferingUsability({
    enabled: true,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    noteAr: input.noteAr,
    noteEn: input.noteEn,
    catalogSelectable: input.catalogSelectable,
    priceUnitActive: input.priceUnitActive,
    hasEffectivePrice: input.hasEffectivePrice,
    hasPendingPrice: input.hasPendingPrice,
  });
  return evaluation.blockerCodes;
}

/**
 * @desc Fail closed when an ENABLE command cannot satisfy DEC-051 usability.
 * @access Domain policy
 */
export function assertEnableAllowed(
  blockerCodes: readonly ProviderServicesReadyBlockerCode[],
): void {
  if (blockerCodes.length > 0) {
    throw new ProviderServiceError("PROVIDER_SERVICE_ENABLE_BLOCKED", undefined, {
      details: { blockerCodes: [...blockerCodes] },
    });
  }
}

/**
 * @desc Plan which retained prices a new proposal must supersede.
 * @access Domain policy
 * @explanation Approval-required proposals supersede only prior PENDING;
 * immediate-effective proposals supersede prior PENDING and EFFECTIVE.
 */
export function planPriceProposalSupersessions(input: {
  readonly approvalRequired: boolean;
  readonly priorPendingId: string | null;
  readonly priorEffectiveId: string | null;
}): {
  readonly newStatus: Extract<ProviderServicePriceStatus, "PENDING" | "EFFECTIVE">;
  readonly supersedePendingId: string | null;
  readonly supersedeEffectiveId: string | null;
} {
  const newStatus = initialPriceStatusFromApprovalRequired(
    input.approvalRequired,
  );
  return {
    newStatus,
    supersedePendingId: input.priorPendingId,
    supersedeEffectiveId:
      newStatus === "EFFECTIVE" ? input.priorEffectiveId : null,
  };
}

/**
 * @desc Require a positive expected aggregate version for non-create mutations.
 * @access Domain policy
 */
export function requirePositiveExpectedVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "expectedVersion", reason: "POSITIVE_REQUIRED" },
    });
  }
  return value;
}

/** Cursor scopes for management history list endpoints. */
export const PRICE_HISTORY_CURSOR_SCOPE = "provider-services-price-history";
export const STATUS_HISTORY_CURSOR_SCOPE = "provider-services-status-history";

/**
 * @desc True when a status-history event is visible on the management endpoint.
 * @access Domain policy
 */
export function isManagementVisibleStatusEvent(
  event: string,
): event is "OFFERING_ENABLED" | "OFFERING_DISABLED" {
  return event === "OFFERING_ENABLED" || event === "OFFERING_DISABLED";
}

/**
 * @desc Build the durable Staff price-decision receipt scope.
 * @access Domain policy
 */
export function buildStaffPriceDecisionScopeKey(
  providerId: string,
  providerServiceId: string,
  providerServicePriceId: string,
): string {
  return `provider:${providerId}:service:${providerServiceId}:price:${providerServicePriceId}:decision`;
}

const MIN_STAFF_REASON_LENGTH = 1;
const MAX_STAFF_REASON_LENGTH = 1000;

/**
 * @desc Trim and validate a Staff price-decision reason (FR-031).
 * @access Domain policy
 */
export function validateStaffDecisionReason(reason: string): string {
  const trimmed = reason.trim();
  if (
    trimmed.length < MIN_STAFF_REASON_LENGTH ||
    trimmed.length > MAX_STAFF_REASON_LENGTH
  ) {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: "reason", reason: "LENGTH_OUT_OF_RANGE" },
    });
  }
  return trimmed;
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
        details: { reason: "NON_FINITE_FINGERPRINT_NUMBER" },
      });
    }
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeFingerprintValue);
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) {
        output[key] = canonicalizeFingerprintValue(nested);
      }
    }
    return output;
  }
  throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
    details: { reason: "UNSUPPORTED_FINGERPRINT_TYPE" },
  });
}

/**
 * @desc Canonical SHA-256 fingerprint of a normalized command body.
 * @access Domain policy
 * @explanation Caller actor/currency/total fields never enter the hash; only
 * the server-normalized commercial and version meaning is fingerprinted.
 */
export function fingerprintProviderServiceCommand(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeFingerprintValue(value)), "utf8")
    .digest("hex");
}

/**
 * @desc Require the selected Catalog price unit among currently active units.
 * @access Domain policy
 */
export function requireActiveCatalogPriceUnit(input: {
  readonly catalogPriceUnitId: string;
  readonly activePriceUnits: readonly {
    readonly id: string;
    readonly code: string;
  }[];
}): { readonly id: string; readonly code: string } {
  const found = input.activePriceUnits.find(
    (unit) => unit.id === input.catalogPriceUnitId,
  );
  if (found === undefined) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_UNIT_UNAVAILABLE");
  }
  return found;
}

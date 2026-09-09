/**
 * Closed Eligibility reason/rule catalogs (R1-P11 Batch D / DEC-080, DEC-084).
 *
 * Machine-readable vocabularies only — no HTTP, no persistence.
 */

import type {
  EligibilityReasonCode,
  EligibilityRuleId,
} from "./eligibility.public.js";

/** Presentation / evaluation order of Provider-facing rules (DEC-064 / DEC-080). */
export const ELIGIBILITY_RULE_ORDER = [
  "CATALOG_APPLICABILITY",
  "PROVIDER_APPROVAL_VERIFICATION_LIVE",
  "OFFERING_PRICE_USABILITY",
  "TEXTUAL_COVERAGE",
  "PROVIDER_SCHEDULE_PAUSE",
  "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
  "CREW_PREFERENCE",
  "CAPACITY_AFTER_CREW_FILTER",
  "PERFORMANCE_GATE",
] as const satisfies readonly EligibilityRuleId[];

/** Closed V1 reason catalog (extend only via new immutable rule version + DEC). */
export const ELIGIBILITY_REASON_CODES = [
  "SERVICE_NOT_AVAILABLE_IN_COUNTRY",
  "SERVICE_INACTIVE_OR_UNKNOWN",
  "PROVIDER_NOT_APPROVED",
  "PROVIDER_NOT_LIVE",
  "PROVIDER_SUSPENDED",
  "VERIFICATION_NOT_SATISFIED",
  "OFFERING_OR_PRICE_UNAVAILABLE",
  "REQUESTED_INTERVAL_TOO_SHORT",
  "CAPACITY_RULE_MISSING",
  "COVERAGE_MISMATCH",
  "PROVIDER_CLOSED_OR_OUTSIDE_HOURS",
  "PROVIDER_PAUSED",
  "NO_VALID_COMPLETE_TEAM",
  "TEAM_STRUCTURALLY_INVALID",
  "TEAM_MEMBERS_UNAVAILABLE",
  "CREW_PREFERENCE_MISMATCH",
  "INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER",
  "PERFORMANCE_GATE_FAILED",
  "PERFORMANCE_EVIDENCE_MISSING",
  "PERFORMANCE_EVIDENCE_INSUFFICIENT_SAMPLES",
  "PERFORMANCE_EVIDENCE_STALE",
  "NOT_IN_DISCOVERY_SCOPE",
] as const satisfies readonly EligibilityReasonCode[];

/**
 * Informational performance diagnostics — never exclusion reasons (DEC-080).
 */
export const INFORMATIONAL_REASON_CODES = [
  "PERFORMANCE_EVIDENCE_MISSING",
  "PERFORMANCE_EVIDENCE_INSUFFICIENT_SAMPLES",
  "PERFORMANCE_EVIDENCE_STALE",
] as const satisfies readonly EligibilityReasonCode[];

const INFORMATIONAL_SET = new Set<string>(INFORMATIONAL_REASON_CODES);

/**
 * @desc Whether a reason code may appear on a rejected candidate as exclusion.
 * @access Domain
 * @explanation Informational performance codes and discovery metadata are not
 * exclusion reasons; TEAM_STRUCTURALLY_INVALID is a real Team exclusion.
 */
export function isExclusionReasonCode(code: EligibilityReasonCode): boolean {
  if (code === "NOT_IN_DISCOVERY_SCOPE") {
    return false;
  }
  return !INFORMATIONAL_SET.has(code);
}

/**
 * @desc Deduplicate reason codes while preserving first rule-order occurrence.
 * @access Domain
 */
export function dedupeReasonsInOrder(
  codes: readonly EligibilityReasonCode[],
): readonly EligibilityReasonCode[] {
  const seen = new Set<EligibilityReasonCode>();
  const result: EligibilityReasonCode[] = [];
  for (const code of codes) {
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);
    result.push(code);
  }
  return result;
}

/**
 * @desc Filter to exclusion-only reasons for Provider/Team summary rows.
 * @access Domain
 */
export function exclusionReasonsOnly(
  codes: readonly EligibilityReasonCode[],
): readonly EligibilityReasonCode[] {
  return dedupeReasonsInOrder(codes.filter(isExclusionReasonCode));
}

/**
 * @desc Type guard for closed EligibilityReasonCode values.
 * @access Domain
 */
export function isEligibilityReasonCode(
  value: string,
): value is EligibilityReasonCode {
  return (ELIGIBILITY_REASON_CODES as readonly string[]).includes(value);
}

/**
 * @desc Type guard for closed EligibilityRuleId values.
 * @access Domain
 */
export function isEligibilityRuleId(value: string): value is EligibilityRuleId {
  return (ELIGIBILITY_RULE_ORDER as readonly string[]).includes(value);
}

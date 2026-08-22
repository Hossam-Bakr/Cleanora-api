/** Closed R1-P06 catalogs. Caller-supplied values must match one member exactly. */
export const DOCUMENT_DECISION_REASON_CODES = [
  "VERIFIED_COMPLETE",
  "DETAILS_MISMATCH",
  "EVIDENCE_UNREADABLE",
  "EVIDENCE_UNSAFE",
  "EVIDENCE_EXPIRED",
  "REPLACEMENT_REQUIRED",
  "POLICY_INVALIDATED",
] as const;

export const PAYOUT_DECISION_REASON_CODES = [
  "VERIFIED_MATCH",
  "HOLDER_NAME_MISMATCH",
  "IDENTIFIER_MISMATCH",
  "BENEFICIARY_UNAVAILABLE",
  "CORRECTION_REQUIRED",
  "REPLACEMENT_REQUIRED",
  "DESTINATION_INVALIDATED",
] as const;

export const PAYOUT_VERIFICATION_METHODS = [
  "MANUAL_WALLET_TRANSFER_CHECK",
  "MANUAL_BANK_BENEFICIARY_CHECK",
] as const;

export const R1_P06_NOTIFICATION_TEMPLATES = [
  "VERIFICATION_DOCUMENT_SUBMITTED",
  "VERIFICATION_DOCUMENT_DECIDED",
  "PAYOUT_DESTINATION_SUBMITTED",
  "PAYOUT_DESTINATION_DECIDED",
  "PAYOUT_PRIMARY_CHANGED",
  "PAYOUT_DESTINATION_REMOVED",
  "PAYOUT_SUCCESSOR_APPROVED",
] as const;

export const R1_P06_SAFE_ERROR_CODES = [
  "PROVIDER_NOT_APPROVED",
  "PROVIDER_SCOPE_DENIED",
  "PROVIDER_MEMBERSHIP_INACTIVE",
  "VERIFICATION_POLICY_NOT_FOUND",
  "POLICY_VERSION_CONFLICT",
  "POLICY_IMMUTABLE",
  "POLICY_FIELD_RULES_INVALID",
  "DOCUMENT_VERSION_CONFLICT",
  "DOCUMENT_STATE_CONFLICT",
  "DOCUMENT_METADATA_INVALID",
  "DOCUMENT_EVIDENCE_NOT_READY",
  "DOCUMENT_EVIDENCE_UNSUPPORTED",
  "DOCUMENT_EVIDENCE_UNSAFE",
  "DOCUMENT_EVIDENCE_LIMIT_EXCEEDED",
  "PAYOUT_DESTINATION_UNSUPPORTED",
  "PAYOUT_REGISTRY_INACTIVE",
  "PAYOUT_IDENTIFIER_INVALID",
  "PAYOUT_HOLDER_NAME_MISMATCH",
  "PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE",
  "PAYOUT_DESTINATION_VERSION_CONFLICT",
  "PAYOUT_DESTINATION_STATE_CONFLICT",
  "PAYOUT_DESTINATION_LIMIT_REACHED",
  "PAYOUT_SUCCESSOR_CONFLICT",
  "PAYOUT_DESTINATION_CONFLICT",
  "PAYOUT_PRIMARY_CONFLICT",
  "PAYOUT_REAUTHENTICATION_REQUIRED",
  "PAYOUT_STEP_UP_REQUIRED",
  "PAYOUT_REVEAL_RATE_LIMITED",
  "PAYOUT_REVEAL_AUDIT_UNAVAILABLE",
  "PAYOUT_KEY_CONFIGURATION_UNAVAILABLE",
  "PAYOUT_PROTECTED_VALUE_UNAVAILABLE",
] as const;

export type DocumentDecisionReasonCode = (typeof DOCUMENT_DECISION_REASON_CODES)[number];
export type PayoutDecisionReasonCode = (typeof PAYOUT_DECISION_REASON_CODES)[number];
export type PayoutVerificationMethod = (typeof PAYOUT_VERIFICATION_METHODS)[number];
export type R1P06NotificationTemplate = (typeof R1_P06_NOTIFICATION_TEMPLATES)[number];
export type R1P06SafeErrorCode = (typeof R1_P06_SAFE_ERROR_CODES)[number];

const PAYOUT_DECISION_REASON_CODES_BY_OUTCOME = {
  APPROVE: ["VERIFIED_MATCH"],
  REJECT: ["HOLDER_NAME_MISMATCH", "IDENTIFIER_MISMATCH", "BENEFICIARY_UNAVAILABLE"],
  REQUEST_CHANGES: ["HOLDER_NAME_MISMATCH", "IDENTIFIER_MISMATCH", "BENEFICIARY_UNAVAILABLE", "CORRECTION_REQUIRED"],
  REQUEST_REPLACEMENT: ["REPLACEMENT_REQUIRED"],
  INVALIDATE: ["DESTINATION_INVALIDATED"],
} as const satisfies Readonly<Record<string, readonly PayoutDecisionReasonCode[]>>;

export function isPayoutDecisionReasonAllowed(
  outcome: keyof typeof PAYOUT_DECISION_REASON_CODES_BY_OUTCOME,
  reasonCode: string,
): reasonCode is PayoutDecisionReasonCode {
  return (PAYOUT_DECISION_REASON_CODES_BY_OUTCOME[outcome] as readonly string[]).includes(reasonCode);
}

export function isMeaningfulSafeNote(value: string): boolean {
  const trimmed = value.trim();
  const containsControlCharacter = [...trimmed].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
  const containsE164LikeValue = /\+[1-9][0-9\s()-]{5,20}/u.test(trimmed);
  const compact = trimmed.replace(/[\s-]/gu, "").toUpperCase();
  const containsIbanLikeValue = /[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}/u.test(compact);
  return trimmed.length >= 10 && trimmed.length <= 1000 &&
    !containsControlCharacter && !containsE164LikeValue && !containsIbanLikeValue;
}

function normalizedForContainment(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

export function assertSafeNoteExcludesProtectedValues(
  note: string,
  protectedValues: readonly (string | null | undefined)[],
): void {
  const normalizedNote = normalizedForContainment(note);
  if (protectedValues.some((value) => {
    if (value === null || value === undefined) return false;
    const normalizedValue = normalizedForContainment(value);
    return normalizedValue.length > 0 && normalizedNote.includes(normalizedValue);
  })) throw new Error("VALIDATION_ERROR");
}

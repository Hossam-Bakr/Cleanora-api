import type { ProviderApplicationStatus, ProviderKind } from "./providers.types.js";
import type { VerificationBadgeState } from "./provider-verification.types.js";

export const DOCUMENT_VERIFICATION_BLOCKERS = [
  "DOCUMENT_POLICY_NOT_EFFECTIVE",
  "DOCUMENT_REQUIREMENT_INCOMPLETE",
] as const;

export interface DocumentVerificationTruth {
  readonly applicable: boolean;
  readonly status: "NOT_REQUIRED" | "NOT_STARTED" | "BLOCKED" | "SATISFIED";
  readonly satisfied: boolean;
  readonly blockerCodes: readonly string[];
  readonly badge: VerificationBadgeState;
}

export function deriveDocumentVerificationTruth(input: {
  readonly providerKind: ProviderKind;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly effectivePolicyPresent: boolean;
  readonly requiredTypeCodes: readonly string[];
  readonly effectiveApprovedTypeCodes: readonly string[];
}): DocumentVerificationTruth {
  if (input.providerKind === "INDIVIDUAL_TEAM") {
    return {
      applicable: false,
      status: "NOT_REQUIRED",
      satisfied: true,
      blockerCodes: [],
      badge: "NOT_ELIGIBLE",
    };
  }

  const badgeEligible = input.applicationStatus === "APPROVED";
  if (!input.effectivePolicyPresent) {
    return {
      applicable: true,
      status: "NOT_STARTED",
      satisfied: false,
      blockerCodes: ["DOCUMENT_POLICY_NOT_EFFECTIVE"],
      badge: "NOT_EARNED",
    };
  }
  const effective = new Set(input.effectiveApprovedTypeCodes);
  const missing = input.requiredTypeCodes.filter((code) => !effective.has(code));
  if (missing.length > 0) {
    return {
      applicable: true,
      status: "BLOCKED",
      satisfied: false,
      blockerCodes: missing.map(() => "DOCUMENT_REQUIREMENT_INCOMPLETE"),
      badge: "NOT_EARNED",
    };
  }
  return {
    applicable: true,
    status: "SATISFIED",
    satisfied: true,
    blockerCodes: [],
    badge: badgeEligible ? "EARNED" : "NOT_EARNED",
  };
}

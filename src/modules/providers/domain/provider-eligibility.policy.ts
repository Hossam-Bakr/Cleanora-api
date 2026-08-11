import type {
  ProviderApplicationStatus,
  ProviderKind,
} from "./providers.types.js";

/**
 * Eligibility gates for creating/editing a Provider application.
 * Pure and side-effect free; services supply authoritative identity/profile facts.
 */
export interface ProviderEligibilityInput {
  readonly providerKind: ProviderKind;
  readonly identityActive: boolean;
  readonly verificationOnly: boolean;
  readonly verifiedCategories: readonly string[];
  readonly matchingProfileComplete: boolean;
}

export type ProviderEligibilityDenialCode =
  | "IDENTITY_NOT_ELIGIBLE"
  | "ELIGIBLE_CATEGORY_VERIFIED"
  | "MATCHING_CUSTOMER_PROFILE_COMPLETE";

export type ProviderEligibilityRecoveryHint =
  | "ACTIVATE_IDENTITY"
  | "ENROLL_AND_VERIFY_INDIVIDUAL_OR_COMPANY"
  | "ENROLL_AND_VERIFY_INDIVIDUAL"
  | "ENROLL_AND_VERIFY_COMPANY"
  | "COMPLETE_MATCHING_INDIVIDUAL_PROFILE"
  | "COMPLETE_MATCHING_COMPANY_PROFILE";

export interface ProviderEligibilityResult {
  readonly eligible: boolean;
  readonly denialCodes: readonly ProviderEligibilityDenialCode[];
  readonly recoveryHints: readonly ProviderEligibilityRecoveryHint[];
}

export type ApplicantCustomerCategory = "INDIVIDUAL" | "COMPANY";

export function requiredCategoryForProviderKind(
  kind: ProviderKind,
): ApplicantCustomerCategory {
  return kind === "INDIVIDUAL_TEAM" ? "INDIVIDUAL" : "COMPANY";
}

export function mapCategoryToProviderKind(
  category: ApplicantCustomerCategory,
): ProviderKind {
  return category === "INDIVIDUAL" ? "INDIVIDUAL_TEAM" : "REGISTERED_COMPANY";
}

/**
 * Legacy owner-only identities hold verified `PROVIDER_OWNER` without a
 * matching Individual/Company path. That category never satisfies eligibility.
 */
export function isLegacyProviderOwnerOnly(
  verifiedCategories: readonly string[],
): boolean {
  const eligibleCustomer = verifiedCategories.some(
    (category) => category === "INDIVIDUAL" || category === "COMPANY",
  );
  return (
    verifiedCategories.includes("PROVIDER_OWNER") && !eligibleCustomer
  );
}

/**
 * Evaluate create/edit eligibility. Verified `PROVIDER_OWNER` is ignored —
 * only matching Individual/Company facts authorize application kinds (FR-012).
 */
export function evaluateProviderEligibility(
  input: ProviderEligibilityInput,
): ProviderEligibilityResult {
  const denialCodes: ProviderEligibilityDenialCode[] = [];
  const recoveryHints: ProviderEligibilityRecoveryHint[] = [];

  if (!input.identityActive || input.verificationOnly) {
    denialCodes.push("IDENTITY_NOT_ELIGIBLE");
    recoveryHints.push("ACTIVATE_IDENTITY");
  }

  const required = requiredCategoryForProviderKind(input.providerKind);
  const hasMatchingCategory = input.verifiedCategories.includes(required);
  // PROVIDER_OWNER is never treated as an eligible applicant category.
  if (!hasMatchingCategory) {
    denialCodes.push("ELIGIBLE_CATEGORY_VERIFIED");
    if (isLegacyProviderOwnerOnly(input.verifiedCategories)) {
      recoveryHints.push("ENROLL_AND_VERIFY_INDIVIDUAL_OR_COMPANY");
    } else if (required === "INDIVIDUAL") {
      recoveryHints.push("ENROLL_AND_VERIFY_INDIVIDUAL");
    } else {
      recoveryHints.push("ENROLL_AND_VERIFY_COMPANY");
    }
  }

  if (!input.matchingProfileComplete) {
    denialCodes.push("MATCHING_CUSTOMER_PROFILE_COMPLETE");
    recoveryHints.push(
      required === "INDIVIDUAL"
        ? "COMPLETE_MATCHING_INDIVIDUAL_PROFILE"
        : "COMPLETE_MATCHING_COMPANY_PROFILE",
    );
  }

  return {
    eligible: denialCodes.length === 0,
    denialCodes,
    recoveryHints: [...new Set(recoveryHints)],
  };
}

/**
 * Recovery-path projection for US13: given current verified categories and
 * matching profile completeness, which Provider kinds become eligible.
 */
export function evaluateLegacyOwnerRecoveryEligibility(input: {
  readonly verifiedCategories: readonly string[];
  readonly individualProfileComplete: boolean;
  readonly companyProfileComplete: boolean;
  readonly identityActive?: boolean;
  readonly verificationOnly?: boolean;
}): {
  readonly ownerOnlyBlocked: boolean;
  readonly individualTeamEligible: boolean;
  readonly registeredCompanyEligible: boolean;
} {
  const identityActive = input.identityActive ?? true;
  const verificationOnly = input.verificationOnly ?? false;
  const ownerOnlyBlocked = isLegacyProviderOwnerOnly(input.verifiedCategories);

  const individual = evaluateProviderEligibility({
    providerKind: "INDIVIDUAL_TEAM",
    identityActive,
    verificationOnly,
    verifiedCategories: input.verifiedCategories,
    matchingProfileComplete: input.individualProfileComplete,
  });
  const company = evaluateProviderEligibility({
    providerKind: "REGISTERED_COMPANY",
    identityActive,
    verificationOnly,
    verifiedCategories: input.verifiedCategories,
    matchingProfileComplete: input.companyProfileComplete,
  });

  return {
    ownerOnlyBlocked,
    individualTeamEligible: individual.eligible,
    registeredCompanyEligible: company.eligible,
  };
}

export interface ApplicationOwnerWithoutMembershipInput {
  readonly applicationOwnerUserId: string;
  readonly ownerUserId: string | null;
  readonly memberCount: number;
  readonly applicationStatus: ProviderApplicationStatus;
}

export interface ApplicationOwnerWithoutMembershipResult {
  readonly ok: boolean;
  readonly reasonCodes?: readonly string[];
}

/**
 * FR-013: draft creation links Application Owner only — no membership/global owner.
 */
export function assertApplicationOwnerWithoutMembership(
  input: ApplicationOwnerWithoutMembershipInput,
): ApplicationOwnerWithoutMembershipResult {
  const reasonCodes: string[] = [];
  if (input.ownerUserId !== null) {
    reasonCodes.push("APPROVED_OWNER_PRESENT");
  }
  if (input.memberCount !== 0) {
    reasonCodes.push("MEMBERSHIP_PRESENT");
  }
  if (input.applicationStatus !== "DRAFT" && input.memberCount > 0) {
    reasonCodes.push("UNEXPECTED_MEMBERSHIP_STATE");
  }
  return reasonCodes.length === 0
    ? { ok: true }
    : { ok: false, reasonCodes };
}

export interface CanChangeProviderKindInput {
  readonly actorIsApplicationOwner: boolean;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly firstSubmittedAt: Date | null;
  readonly currentKind: ProviderKind;
  readonly requestedKind: ProviderKind;
}

export interface CanChangeProviderKindResult {
  readonly allowed: boolean;
  readonly unchanged?: true;
  readonly denialCode?: "PROVIDER_ACCESS_DENIED" | "PROVIDER_STATE_CONFLICT";
}

/**
 * FR-006 / FR-007: kind mutable only for Application Owner never-submitted DRAFT.
 */
export function canChangeProviderKind(
  input: CanChangeProviderKindInput,
): CanChangeProviderKindResult {
  if (!input.actorIsApplicationOwner) {
    return { allowed: false, denialCode: "PROVIDER_ACCESS_DENIED" };
  }
  if (input.currentKind === input.requestedKind) {
    return { allowed: true, unchanged: true };
  }
  if (
    input.applicationStatus !== "DRAFT" ||
    input.firstSubmittedAt !== null
  ) {
    return { allowed: false, denialCode: "PROVIDER_STATE_CONFLICT" };
  }
  return { allowed: true };
}

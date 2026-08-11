import {
  PROFILE_COMPLETION_CHECK_CODES,
  PROFILE_COMPLETION_POLICY_VERSION,
  type ProfileCompletion,
  type ProfileCompletionCheck,
  type ProfileCompletionCheckCode,
} from "./providers.types.js";

/** Minimum READY gallery images required by policy r1-p05-v1. */
export const MIN_READY_GALLERY_IMAGES_REQUIRED = 3;

export interface ProviderCompletionFacts {
  readonly eligibleCategoryVerified: boolean;
  readonly matchingCustomerProfileComplete: boolean;
  readonly displayNameAr: string | null | undefined;
  readonly descriptionAr: string | null | undefined;
  readonly operationalEmailNormalized: string | null | undefined;
  readonly operationalPhoneE164: string | null | undefined;
  readonly activeCountryId: string | null | undefined;
  readonly logoReady: boolean;
  readonly coverReady: boolean;
  readonly readyGalleryImageCount: number;
}

function hasTrimmedText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function satisfactionMap(
  facts: ProviderCompletionFacts,
): Record<ProfileCompletionCheckCode, boolean> {
  return {
    ELIGIBLE_CATEGORY_VERIFIED: facts.eligibleCategoryVerified,
    MATCHING_CUSTOMER_PROFILE_COMPLETE: facts.matchingCustomerProfileComplete,
    ARABIC_DISPLAY_NAME: hasTrimmedText(facts.displayNameAr),
    ARABIC_DESCRIPTION: hasTrimmedText(facts.descriptionAr),
    OPERATIONAL_EMAIL: hasTrimmedText(facts.operationalEmailNormalized),
    OPERATIONAL_PHONE: hasTrimmedText(facts.operationalPhoneE164),
    ACTIVE_COUNTRY: hasTrimmedText(facts.activeCountryId),
    READY_LOGO: facts.logoReady,
    READY_COVER: facts.coverReady,
    MIN_READY_GALLERY_IMAGES:
      facts.readyGalleryImageCount >= MIN_READY_GALLERY_IMAGES_REQUIRED,
  };
}

/**
 * Pure r1-p05-v1 completion: exactly ten equal 10-point checks.
 * Documents and later-phase gates never contribute.
 */
export function calculateProfileCompletion(
  facts: ProviderCompletionFacts,
): ProfileCompletion {
  const satisfiedByCode = satisfactionMap(facts);
  const checks: ProfileCompletionCheck[] = PROFILE_COMPLETION_CHECK_CODES.map(
    (code) => ({
      code,
      satisfied: satisfiedByCode[code],
    }),
  );
  const missingRequirementCodes = checks
    .filter((check) => !check.satisfied)
    .map((check) => check.code);
  const satisfiedCount = checks.length - missingRequirementCodes.length;

  return {
    policyVersion: PROFILE_COMPLETION_POLICY_VERSION,
    percentage: satisfiedCount * 10,
    checks,
    missingRequirementCodes,
  };
}

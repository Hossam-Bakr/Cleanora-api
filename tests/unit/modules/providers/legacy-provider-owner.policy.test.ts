import {
  evaluateLegacyOwnerRecoveryEligibility,
  evaluateProviderEligibility,
  isLegacyProviderOwnerOnly,
} from "../../../../src/modules/providers/domain/provider-eligibility.policy.js";
import {
  SELF_SIGNUP_CATEGORIES,
  assertSelfSignupCategory,
} from "../../../../src/modules/authentication/domain/auth.policy.js";
import { selfSignupCategorySchema } from "../../../../src/modules/authentication/auth.schema.js";

describe("US13 legacy Provider Owner recovery policy (T138/T142)", () => {
  it("detects owner-only legacy identities", () => {
    expect(isLegacyProviderOwnerOnly(["PROVIDER_OWNER"])).toBe(true);
    expect(
      isLegacyProviderOwnerOnly(["PROVIDER_OWNER", "ENGINEER"]),
    ).toBe(true);
    expect(
      isLegacyProviderOwnerOnly(["PROVIDER_OWNER", "INDIVIDUAL"]),
    ).toBe(false);
    expect(isLegacyProviderOwnerOnly(["INDIVIDUAL"])).toBe(false);
  });

  it("denies owner-only applications with Individual-or-Company recovery hints", () => {
    const individual = evaluateProviderEligibility({
      providerKind: "INDIVIDUAL_TEAM",
      identityActive: true,
      verificationOnly: false,
      verifiedCategories: ["PROVIDER_OWNER"],
      matchingProfileComplete: true,
    });
    expect(individual.eligible).toBe(false);
    expect(individual.denialCodes).toContain("ELIGIBLE_CATEGORY_VERIFIED");
    expect(individual.recoveryHints).toContain(
      "ENROLL_AND_VERIFY_INDIVIDUAL_OR_COMPANY",
    );

    const company = evaluateProviderEligibility({
      providerKind: "REGISTERED_COMPANY",
      identityActive: true,
      verificationOnly: false,
      verifiedCategories: ["PROVIDER_OWNER"],
      matchingProfileComplete: true,
    });
    expect(company.eligible).toBe(false);
    expect(company.recoveryHints).toContain(
      "ENROLL_AND_VERIFY_INDIVIDUAL_OR_COMPANY",
    );
  });

  it("unlocks only the matching recovered path after Individual or Company", () => {
    const individualPath = evaluateLegacyOwnerRecoveryEligibility({
      verifiedCategories: ["PROVIDER_OWNER", "INDIVIDUAL"],
      individualProfileComplete: true,
      companyProfileComplete: false,
    });
    expect(individualPath.ownerOnlyBlocked).toBe(false);
    expect(individualPath.individualTeamEligible).toBe(true);
    expect(individualPath.registeredCompanyEligible).toBe(false);

    const companyPath = evaluateLegacyOwnerRecoveryEligibility({
      verifiedCategories: ["PROVIDER_OWNER", "COMPANY"],
      individualProfileComplete: false,
      companyProfileComplete: true,
    });
    expect(companyPath.individualTeamEligible).toBe(false);
    expect(companyPath.registeredCompanyEligible).toBe(true);
  });

  it("still requires matching profile completion after category recovery", () => {
    const incomplete = evaluateProviderEligibility({
      providerKind: "INDIVIDUAL_TEAM",
      identityActive: true,
      verificationOnly: false,
      verifiedCategories: ["PROVIDER_OWNER", "INDIVIDUAL"],
      matchingProfileComplete: false,
    });
    expect(incomplete.eligible).toBe(false);
    expect(incomplete.denialCodes).toContain(
      "MATCHING_CUSTOMER_PROFILE_COMPLETE",
    );
    expect(incomplete.recoveryHints).toContain(
      "COMPLETE_MATCHING_INDIVIDUAL_PROFILE",
    );
  });

  it("confirms public signup/enrollment still rejects PROVIDER_OWNER (T015/T142)", () => {
    expect(SELF_SIGNUP_CATEGORIES).not.toContain("PROVIDER_OWNER");
    expect(selfSignupCategorySchema.safeParse("PROVIDER_OWNER").success).toBe(
      false,
    );
    expect(() => assertSelfSignupCategory("PROVIDER_OWNER")).toThrow();
  });
});

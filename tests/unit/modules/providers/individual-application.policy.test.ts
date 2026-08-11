import {
  assertApplicationOwnerWithoutMembership,
  evaluateProviderEligibility,
  mapCategoryToProviderKind,
  requiredCategoryForProviderKind,
} from "../../../../src/modules/providers/domain/provider-eligibility.policy.js";

describe("US1 Individual provider application policy (T026)", () => {
  it("maps Individual to INDIVIDUAL_TEAM authoritatively", () => {
    expect(mapCategoryToProviderKind("INDIVIDUAL")).toBe("INDIVIDUAL_TEAM");
    expect(requiredCategoryForProviderKind("INDIVIDUAL_TEAM")).toBe(
      "INDIVIDUAL",
    );
  });

  it("allows a verified Individual with a complete matching profile", () => {
    const result = evaluateProviderEligibility({
      providerKind: "INDIVIDUAL_TEAM",
      identityActive: true,
      verificationOnly: false,
      verifiedCategories: ["INDIVIDUAL"],
      matchingProfileComplete: true,
    });
    expect(result).toEqual({
      eligible: true,
      denialCodes: [],
      recoveryHints: [],
    });
  });

  it("denies Engineer-only identities from provider application", () => {
    const result = evaluateProviderEligibility({
      providerKind: "INDIVIDUAL_TEAM",
      identityActive: true,
      verificationOnly: false,
      verifiedCategories: ["ENGINEER"],
      matchingProfileComplete: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.denialCodes).toContain("ELIGIBLE_CATEGORY_VERIFIED");
  });

  it("denies unverified, incomplete, and verification-only applicants", () => {
    expect(
      evaluateProviderEligibility({
        providerKind: "INDIVIDUAL_TEAM",
        identityActive: true,
        verificationOnly: false,
        verifiedCategories: [],
        matchingProfileComplete: true,
      }).denialCodes,
    ).toContain("ELIGIBLE_CATEGORY_VERIFIED");

    expect(
      evaluateProviderEligibility({
        providerKind: "INDIVIDUAL_TEAM",
        identityActive: true,
        verificationOnly: false,
        verifiedCategories: ["INDIVIDUAL"],
        matchingProfileComplete: false,
      }).denialCodes,
    ).toContain("MATCHING_CUSTOMER_PROFILE_COMPLETE");

    expect(
      evaluateProviderEligibility({
        providerKind: "INDIVIDUAL_TEAM",
        identityActive: false,
        verificationOnly: true,
        verifiedCategories: ["INDIVIDUAL"],
        matchingProfileComplete: true,
      }).denialCodes,
    ).toContain("IDENTITY_NOT_ELIGIBLE");
  });

  it("denies legacy PROVIDER_OWNER-only identities until Individual/Company path exists", () => {
    const result = evaluateProviderEligibility({
      providerKind: "INDIVIDUAL_TEAM",
      identityActive: true,
      verificationOnly: false,
      verifiedCategories: ["PROVIDER_OWNER"],
      matchingProfileComplete: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.denialCodes).toContain("ELIGIBLE_CATEGORY_VERIFIED");
  });

  it("records Application Owner without Provider membership on create", () => {
    expect(
      assertApplicationOwnerWithoutMembership({
        applicationOwnerUserId: "user-1",
        ownerUserId: null,
        memberCount: 0,
        applicationStatus: "DRAFT",
      }),
    ).toEqual({ ok: true });

    expect(
      assertApplicationOwnerWithoutMembership({
        applicationOwnerUserId: "user-1",
        ownerUserId: "user-1",
        memberCount: 1,
        applicationStatus: "DRAFT",
      }).ok,
    ).toBe(false);
  });
});

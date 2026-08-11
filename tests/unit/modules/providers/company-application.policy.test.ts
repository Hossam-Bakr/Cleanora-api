import {
  canChangeProviderKind,
  evaluateProviderEligibility,
  mapCategoryToProviderKind,
  requiredCategoryForProviderKind,
} from "../../../../src/modules/providers/domain/provider-eligibility.policy.js";

describe("US2 Company / dual-category provider application policy (T034)", () => {
  it("maps Company to REGISTERED_COMPANY authoritatively", () => {
    expect(mapCategoryToProviderKind("COMPANY")).toBe("REGISTERED_COMPANY");
    expect(requiredCategoryForProviderKind("REGISTERED_COMPANY")).toBe(
      "COMPANY",
    );
  });

  it("allows a verified Company with a complete matching profile", () => {
    const result = evaluateProviderEligibility({
      providerKind: "REGISTERED_COMPANY",
      identityActive: true,
      verificationOnly: false,
      verifiedCategories: ["COMPANY"],
      matchingProfileComplete: true,
    });
    expect(result).toEqual({
      eligible: true,
      denialCodes: [],
      recoveryHints: [],
    });
  });

  it("requires an explicit dual-category kind choice with matching profile", () => {
    const dual = ["INDIVIDUAL", "COMPANY"] as const;

    expect(
      evaluateProviderEligibility({
        providerKind: "INDIVIDUAL_TEAM",
        identityActive: true,
        verificationOnly: false,
        verifiedCategories: dual,
        matchingProfileComplete: true,
      }).eligible,
    ).toBe(true);

    expect(
      evaluateProviderEligibility({
        providerKind: "REGISTERED_COMPANY",
        identityActive: true,
        verificationOnly: false,
        verifiedCategories: dual,
        matchingProfileComplete: true,
      }).eligible,
    ).toBe(true);

    expect(
      evaluateProviderEligibility({
        providerKind: "REGISTERED_COMPANY",
        identityActive: true,
        verificationOnly: false,
        verifiedCategories: dual,
        matchingProfileComplete: false,
      }).denialCodes,
    ).toContain("MATCHING_CUSTOMER_PROFILE_COMPLETE");
  });

  it("allows kind change only for never-submitted Application Owner drafts", () => {
    expect(
      canChangeProviderKind({
        actorIsApplicationOwner: true,
        applicationStatus: "DRAFT",
        firstSubmittedAt: null,
        requestedKind: "REGISTERED_COMPANY",
        currentKind: "INDIVIDUAL_TEAM",
      }),
    ).toEqual({ allowed: true });

    expect(
      canChangeProviderKind({
        actorIsApplicationOwner: true,
        applicationStatus: "DRAFT",
        firstSubmittedAt: new Date("2026-01-01T00:00:00.000Z"),
        requestedKind: "REGISTERED_COMPANY",
        currentKind: "INDIVIDUAL_TEAM",
      }).allowed,
    ).toBe(false);

    expect(
      canChangeProviderKind({
        actorIsApplicationOwner: true,
        applicationStatus: "PENDING_REVIEW",
        firstSubmittedAt: null,
        requestedKind: "REGISTERED_COMPANY",
        currentKind: "INDIVIDUAL_TEAM",
      }).allowed,
    ).toBe(false);

    expect(
      canChangeProviderKind({
        actorIsApplicationOwner: false,
        applicationStatus: "DRAFT",
        firstSubmittedAt: null,
        requestedKind: "REGISTERED_COMPANY",
        currentKind: "INDIVIDUAL_TEAM",
      }).allowed,
    ).toBe(false);
  });

  it("treats identical kind retries as a no-op allow for change checks", () => {
    expect(
      canChangeProviderKind({
        actorIsApplicationOwner: true,
        applicationStatus: "DRAFT",
        firstSubmittedAt: null,
        requestedKind: "INDIVIDUAL_TEAM",
        currentKind: "INDIVIDUAL_TEAM",
      }),
    ).toEqual({ allowed: true, unchanged: true });
  });
});

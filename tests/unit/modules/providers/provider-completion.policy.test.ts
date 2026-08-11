import {
  calculateProfileCompletion,
  MIN_READY_GALLERY_IMAGES_REQUIRED,
  type ProviderCompletionFacts,
} from "../../../../src/modules/providers/domain/provider-completion.policy.js";
import {
  PROFILE_COMPLETION_CHECK_CODES,
  PROFILE_COMPLETION_POLICY_VERSION,
  type ProfileCompletionCheckCode,
} from "../../../../src/modules/providers/domain/providers.types.js";

const CHECK_KEYS = [
  "eligibleCategoryVerified",
  "matchingCustomerProfileComplete",
  "displayNameAr",
  "descriptionAr",
  "operationalEmailNormalized",
  "operationalPhoneE164",
  "activeCountryId",
  "logoReady",
  "coverReady",
  "readyGalleryImageCount",
] as const;

function factsFromMask(mask: number): ProviderCompletionFacts {
  const bit = (index: number): boolean => ((mask >> index) & 1) === 1;
  return {
    eligibleCategoryVerified: bit(0),
    matchingCustomerProfileComplete: bit(1),
    displayNameAr: bit(2) ? "اسم العرض" : "   ",
    descriptionAr: bit(3) ? "وصف عربي" : "",
    operationalEmailNormalized: bit(4) ? "ops@example.com" : null,
    operationalPhoneE164: bit(5) ? "+201012345678" : null,
    activeCountryId: bit(6) ? "country-eg" : null,
    logoReady: bit(7),
    coverReady: bit(8),
    readyGalleryImageCount: bit(9) ? MIN_READY_GALLERY_IMAGES_REQUIRED : 2,
  };
}

function expectedSatisfied(
  mask: number,
): ReadonlySet<ProfileCompletionCheckCode> {
  const set = new Set<ProfileCompletionCheckCode>();
  for (let index = 0; index < PROFILE_COMPLETION_CHECK_CODES.length; index += 1) {
    if (((mask >> index) & 1) === 1) {
      set.add(PROFILE_COMPLETION_CHECK_CODES[index]!);
    }
  }
  return set;
}

describe("US9 provider completion policy (T097)", () => {
  it("locks policy r1-p05-v1 to exactly ten equal 10-point checks", () => {
    expect(PROFILE_COMPLETION_POLICY_VERSION).toBe("r1-p05-v1");
    expect(PROFILE_COMPLETION_CHECK_CODES).toHaveLength(10);
    expect(CHECK_KEYS).toHaveLength(10);
    expect(MIN_READY_GALLERY_IMAGES_REQUIRED).toBe(3);
  });

  it("exhausts all 1024 boolean combinations with deterministic percentage and missing codes", () => {
    expect(1 << 10).toBe(1024);

    for (let mask = 0; mask < 1024; mask += 1) {
      const facts = factsFromMask(mask);
      const result = calculateProfileCompletion(facts);
      const satisfied = expectedSatisfied(mask);
      const satisfiedCount = satisfied.size;

      expect(result.policyVersion).toBe("r1-p05-v1");
      expect(result.checks).toHaveLength(10);
      expect(result.percentage).toBe(satisfiedCount * 10);
      expect(result.missingRequirementCodes).toHaveLength(10 - satisfiedCount);

      for (const check of result.checks) {
        expect(check.satisfied).toBe(satisfied.has(check.code));
      }

      expect([...result.missingRequirementCodes]).toEqual(
        PROFILE_COMPLETION_CHECK_CODES.filter((code) => !satisfied.has(code)),
      );

      if (satisfiedCount === 10) {
        expect(result.percentage).toBe(100);
        expect(result.missingRequirementCodes).toEqual([]);
      }
      if (satisfiedCount === 0) {
        expect(result.percentage).toBe(0);
        expect(result.missingRequirementCodes).toEqual([
          ...PROFILE_COMPLETION_CHECK_CODES,
        ]);
      }
    }
  });

  it("treats whitespace-only Arabic text as unsatisfied", () => {
    const result = calculateProfileCompletion(
      factsFromMask(0b11_1111_1111 & ~(1 << 2)),
    );
    expect(result.missingRequirementCodes).toContain("ARABIC_DISPLAY_NAME");
    expect(result.percentage).toBe(90);
  });
});

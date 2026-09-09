import {
  EligibilityError,
  eligibilityError,
  isEligibilityError,
} from "#modules/eligibility/eligibility.errors";
import {
  dedupeReasonsInOrder,
  ELIGIBILITY_REASON_CODES,
  ELIGIBILITY_RULE_ORDER,
  exclusionReasonsOnly,
  INFORMATIONAL_REASON_CODES,
  isEligibilityReasonCode,
  isEligibilityRuleId,
  isExclusionReasonCode,
} from "#modules/eligibility/eligibility.reasons";

describe("EligibilityError helpers", () => {
  it("builds typed errors with optional details and guards instances", () => {
    const withDetails = eligibilityError("VALIDATION_FAILED", {
      field: "serviceId",
    });
    expect(withDetails).toBeInstanceOf(EligibilityError);
    expect(withDetails.code).toBe("VALIDATION_FAILED");
    expect(withDetails.details).toEqual({ field: "serviceId" });
    expect(isEligibilityError(withDetails)).toBe(true);
    expect(isEligibilityError(new Error("nope"))).toBe(false);

    const custom = new EligibilityError("DEPENDENCY_FAILURE", {
      message: "reader failed",
    });
    expect(custom.message).toBe("reader failed");
    expect(custom.details).toBeUndefined();
  });
});

describe("eligibility.reasons catalogs (Batch D / T021)", () => {
  it("includes TEAM_STRUCTURALLY_INVALID and closed rule order", () => {
    expect(ELIGIBILITY_REASON_CODES).toContain("TEAM_STRUCTURALLY_INVALID");
    expect(ELIGIBILITY_RULE_ORDER[0]).toBe("CATALOG_APPLICABILITY");
    expect(ELIGIBILITY_RULE_ORDER.at(-1)).toBe("PERFORMANCE_GATE");
    expect(isEligibilityRuleId("CREW_PREFERENCE")).toBe(true);
    expect(isEligibilityRuleId("UNKNOWN")).toBe(false);
    expect(isEligibilityReasonCode("SERVICE_INACTIVE_OR_UNKNOWN")).toBe(true);
  });

  it("treats informational performance codes as non-exclusion", () => {
    for (const code of INFORMATIONAL_REASON_CODES) {
      expect(isExclusionReasonCode(code)).toBe(false);
    }
    expect(isExclusionReasonCode("TEAM_STRUCTURALLY_INVALID")).toBe(true);
    expect(isExclusionReasonCode("NOT_IN_DISCOVERY_SCOPE")).toBe(false);
  });

  it("dedupes while preserving first occurrence and filters exclusions", () => {
    expect(
      dedupeReasonsInOrder([
        "PROVIDER_NOT_LIVE",
        "COVERAGE_MISMATCH",
        "PROVIDER_NOT_LIVE",
      ]),
    ).toEqual(["PROVIDER_NOT_LIVE", "COVERAGE_MISMATCH"]);
    expect(
      exclusionReasonsOnly([
        "PERFORMANCE_GATE_FAILED",
        "PERFORMANCE_EVIDENCE_MISSING",
        "PERFORMANCE_GATE_FAILED",
      ]),
    ).toEqual(["PERFORMANCE_GATE_FAILED"]);
  });
});

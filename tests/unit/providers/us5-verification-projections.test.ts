import { deriveDocumentVerificationTruth } from "../../../src/modules/providers/domain/provider-verification.policy.js";

describe("R1-P06 US5 verification projections", () => {
  it.each([
    [false, [] as string[], "NOT_STARTED", "NOT_EARNED"],
    [true, [] as string[], "BLOCKED", "NOT_EARNED"],
    [true, ["COMMERCIAL_REGISTRATION"], "SATISFIED", "EARNED"],
  ] as const)("derives policy=%s effective=%j", (policy, effective, status, badge) => {
    expect(deriveDocumentVerificationTruth({
      providerKind: "REGISTERED_COMPANY", applicationStatus: "APPROVED",
      effectivePolicyPresent: policy, requiredTypeCodes: ["COMMERCIAL_REGISTRATION"],
      effectiveApprovedTypeCodes: effective,
    })).toMatchObject({ status, badge });
  });
  it("does not erase earned truth during operational suspension because operational state is not an input", () => {
    const truth = deriveDocumentVerificationTruth({ providerKind: "REGISTERED_COMPANY", applicationStatus: "APPROVED", effectivePolicyPresent: true, requiredTypeCodes: [], effectiveApprovedTypeCodes: [] });
    expect(truth.badge).toBe("EARNED");
  });
});

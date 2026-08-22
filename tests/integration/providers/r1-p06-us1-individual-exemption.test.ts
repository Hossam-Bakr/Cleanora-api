import { deriveDocumentVerificationTruth } from "../../../src/modules/providers/domain/provider-verification.policy.js";
import { mapVerificationOverview } from "../../../src/modules/providers/provider-verification.dto.js";

describe("R1-P06 US1 protected Individual Team projection", () => {
  it("returns NOT_REQUIRED, no document capability, and no badge eligibility", () => {
    const truth = deriveDocumentVerificationTruth({
      providerKind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      effectivePolicyPresent: false,
      requiredTypeCodes: [],
      effectiveApprovedTypeCodes: [],
    });
    expect(mapVerificationOverview({
      providerId: "provider-individual",
      providerKind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
      truth,
      payoutDestinationReady: false,
      capabilities: [],
    })).toMatchObject({
      documentsVerified: { applicable: false, status: "NOT_REQUIRED", satisfied: true },
      badgeTruth: "NOT_ELIGIBLE",
      capabilities: [],
    });
  });
});

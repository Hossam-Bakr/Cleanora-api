import { deriveDocumentVerificationTruth } from "../../../src/modules/providers/domain/provider-verification.policy.js";
import { calculateMarketplaceReadiness } from "../../../src/modules/providers/domain/provider-readiness.policy.js";
import { mapVerificationOverview } from "../../../src/modules/providers/provider-verification.dto.js";

describe("R1-P06 US1 Individual Team document exemption", () => {
  it("is NOT_REQUIRED, satisfied, and badge-ineligible with no document capability", () => {
    const truth = deriveDocumentVerificationTruth({
      providerKind: "INDIVIDUAL_TEAM", applicationStatus: "APPROVED",
      effectivePolicyPresent: false, requiredTypeCodes: [], effectiveApprovedTypeCodes: [],
    });
    expect(truth).toEqual({ applicable: false, status: "NOT_REQUIRED", satisfied: true, blockerCodes: [], badge: "NOT_ELIGIBLE" });
    const overview = mapVerificationOverview({
      providerId: "provider-1", providerKind: "INDIVIDUAL_TEAM", applicationStatus: "APPROVED",
      operationalStatus: "SUSPENDED", truth, payoutDestinationReady: false, capabilities: [],
    });
    expect(overview.capabilities).toEqual([]);
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM", applicationStatus: "APPROVED", operationalStatus: "SUSPENDED",
      profileCompletionPercentage: 100, documentsVerified: truth, payoutDestinationReady: false,
    });
    expect(readiness.gates.find((gate) => gate.key === "documentsVerified")).toMatchObject({ satisfied: true, status: "NOT_REQUIRED", owningPhase: "R1-P06" });
  });
});

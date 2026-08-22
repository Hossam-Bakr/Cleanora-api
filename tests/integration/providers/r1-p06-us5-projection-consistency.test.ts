import { calculateMarketplaceReadiness } from "../../../src/modules/providers/domain/provider-readiness.policy.js";

describe("R1-P06 US5 projection consistency", () => {
  it("uses the same document and payout truth in every readiness consumer", () => {
    const readiness = calculateMarketplaceReadiness({ kind: "REGISTERED_COMPANY", applicationStatus: "APPROVED", operationalStatus: "INACTIVE", profileCompletionPercentage: 100, documentsVerified: { applicable: true, status: "SATISFIED", satisfied: true, blockerCodes: [] }, payoutDestinationReady: true });
    expect(readiness.gates.find((gate) => gate.key === "documentsVerified")?.satisfied).toBe(true);
    expect(readiness.gates.find((gate) => gate.key === "payoutDestinationReady")?.satisfied).toBe(true);
    expect(readiness.eligibleForPublicBrowse).toBe(false);
  });
});

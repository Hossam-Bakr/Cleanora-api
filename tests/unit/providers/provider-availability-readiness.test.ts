import { calculateMarketplaceReadiness } from "../../../src/modules/providers/domain/provider-readiness.policy.js";

function gate(
  readiness: ReturnType<typeof calculateMarketplaceReadiness>,
  key: string,
) {
  const found = readiness.gates.find((candidate) => candidate.key === key);
  if (found === undefined) {
    throw new Error(`missing readiness gate ${key}`);
  }
  return found;
}

describe("Provider availability readiness gates (DEC-060, T058)", () => {
  it("replaces Phase 10 placeholders with exact configuration readiness gates", () => {
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "LIVE",
      profileCompletionPercentage: 100,
    });

    expect(gate(readiness, "coverageReady")).toMatchObject({
      applicable: true,
      status: "BLOCKED",
      satisfied: false,
      owningPhase: "R1-P10",
      blockerCodes: ["NO_EFFECTIVE_ACTIVE_COVERAGE_SELECTION"],
    });
    expect(gate(readiness, "availabilityReady")).toMatchObject({
      applicable: true,
      status: "BLOCKED",
      satisfied: false,
      owningPhase: "R1-P10",
      blockerCodes: ["NO_VALID_PROVIDER_WEEKLY_PERIOD"],
    });
    expect(gate(readiness, "capacityReady")).toMatchObject({
      applicable: true,
      status: "BLOCKED",
      satisfied: false,
      owningPhase: "R1-P10",
      blockerCodes: ["POSITIVE_SIMULTANEOUS_TEAM_LIMIT_REQUIRED"],
    });
  });

  it("satisfies coverage, availability, and capacity independently from live facts", () => {
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "LIVE",
      profileCompletionPercentage: 100,
      coverageReady: { satisfied: true, blockerCodes: [] },
      availabilityReady: { satisfied: true, blockerCodes: [] },
      capacityReady: { satisfied: true, blockerCodes: [] },
    });

    for (const key of [
      "coverageReady",
      "availabilityReady",
      "capacityReady",
    ]) {
      expect(gate(readiness, key)).toMatchObject({
        status: "SATISFIED",
        satisfied: true,
        blockerCodes: [],
        owningPhase: "R1-P10",
      });
    }
  });

  it("keeps runtime suspension separate from DEC-060 configuration readiness", () => {
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "SUSPENDED",
      profileCompletionPercentage: 100,
      coverageReady: { satisfied: true, blockerCodes: [] },
      availabilityReady: { satisfied: true, blockerCodes: [] },
      capacityReady: { satisfied: false, blockerCodes: ["NO_COMPLETE_TEAM"] },
    });

    expect(gate(readiness, "coverageReady").satisfied).toBe(true);
    expect(gate(readiness, "availabilityReady").satisfied).toBe(true);
    expect(gate(readiness, "capacityReady")).toMatchObject({
      status: "BLOCKED",
      blockerCodes: ["NO_COMPLETE_TEAM"],
    });
    expect(gate(readiness, "operationalLive")).toMatchObject({
      status: "BLOCKED",
      satisfied: false,
    });
    expect(readiness.eligibleForPublicBrowse).toBe(false);
  });
});

import { calculateMarketplaceReadiness } from "../../../../src/modules/providers/domain/provider-readiness.policy.js";
import {
  MARKETPLACE_READINESS_GATE_KEYS,
  type MarketplaceReadinessGate,
  type ProviderApplicationStatus,
  type ProviderKind,
  type ProviderOperationalStatus,
} from "../../../../src/modules/providers/domain/providers.types.js";

function readiness(input: {
  readonly kind: ProviderKind;
  readonly applicationStatus?: ProviderApplicationStatus;
  readonly operationalStatus?: ProviderOperationalStatus;
  readonly profileCompletionPercentage?: number;
}) {
  return calculateMarketplaceReadiness({
    kind: input.kind,
    applicationStatus: input.applicationStatus ?? "DRAFT",
    operationalStatus: input.operationalStatus ?? "INACTIVE",
    profileCompletionPercentage: input.profileCompletionPercentage ?? 0,
  });
}

function gateByKey(
  gates: readonly MarketplaceReadinessGate[],
  key: (typeof MARKETPLACE_READINESS_GATE_KEYS)[number],
): MarketplaceReadinessGate {
  const found = gates.find((gate) => gate.key === key);
  if (found === undefined) {
    throw new Error(`missing gate ${key}`);
  }
  return found;
}

describe("US9 provider readiness policy (T098)", () => {
  it("returns exactly eleven locked gates in stable order", () => {
    expect(MARKETPLACE_READINESS_GATE_KEYS).toHaveLength(11);
    const result = readiness({ kind: "INDIVIDUAL_TEAM" });
    expect(result.gates.map((gate) => gate.key)).toEqual([
      ...MARKETPLACE_READINESS_GATE_KEYS,
    ]);
    expect(result.eligibleForPublicBrowse).toBe(false);
  });

  it.each(["INDIVIDUAL_TEAM", "REGISTERED_COMPANY"] as const)(
    "%s treats profileComplete and applicationApproved from facts",
    (kind) => {
      const incomplete = readiness({
        kind,
        profileCompletionPercentage: 90,
        applicationStatus: "DRAFT",
      });
      expect(gateByKey(incomplete.gates, "profileComplete")).toMatchObject({
        status: "BLOCKED",
        satisfied: false,
        blockerCodes: ["PROFILE_INCOMPLETE"],
        owningPhase: "R1-P05",
      });
      expect(gateByKey(incomplete.gates, "applicationApproved")).toMatchObject({
        status: "BLOCKED",
        satisfied: false,
        blockerCodes: ["APPLICATION_NOT_APPROVED"],
        owningPhase: "R1-P05",
      });

      const completeApproved = readiness({
        kind,
        profileCompletionPercentage: 100,
        applicationStatus: "APPROVED",
      });
      expect(gateByKey(completeApproved.gates, "profileComplete")).toMatchObject({
        status: "SATISFIED",
        satisfied: true,
        blockerCodes: [],
      });
      expect(
        gateByKey(completeApproved.gates, "applicationApproved"),
      ).toMatchObject({
        status: "SATISFIED",
        satisfied: true,
        blockerCodes: [],
      });
    },
  );

  it("marks Individual documents NOT_REQUIRED and satisfied", () => {
    const documents = gateByKey(
      readiness({ kind: "INDIVIDUAL_TEAM", profileCompletionPercentage: 100 })
        .gates,
      "documentsVerified",
    );
    expect(documents).toMatchObject({
      applicable: false,
      status: "NOT_REQUIRED",
      satisfied: true,
      blockerCodes: [],
      owningPhase: "R1-P05",
    });
  });

  it("blocks Company documents on R1-P06 without inventing OQ-007 checklist", () => {
    const documents = gateByKey(
      readiness({
        kind: "REGISTERED_COMPANY",
        profileCompletionPercentage: 100,
        applicationStatus: "APPROVED",
      }).gates,
      "documentsVerified",
    );
    expect(documents).toMatchObject({
      applicable: true,
      status: "BLOCKED",
      satisfied: false,
      blockerCodes: ["COMPANY_DOCUMENTS_DEFERRED_R1_P06"],
      owningPhase: "R1-P06",
    });
  });

  it("keeps later-phase gates NOT_STARTED/BLOCKED with owning phases", () => {
    for (const kind of ["INDIVIDUAL_TEAM", "REGISTERED_COMPANY"] as const) {
      const gates = readiness({
        kind,
        profileCompletionPercentage: 100,
        applicationStatus: "APPROVED",
      }).gates;

      expect(gateByKey(gates, "payoutDestinationReady")).toMatchObject({
        status: "NOT_STARTED",
        satisfied: false,
        owningPhase: "R1-P06",
      });
      expect(gateByKey(gates, "workersReady")).toMatchObject({
        status: "NOT_STARTED",
        owningPhase: "R1-P07",
      });
      expect(gateByKey(gates, "servicesReady")).toMatchObject({
        status: "NOT_STARTED",
        owningPhase: "R1-P09",
      });
      expect(gateByKey(gates, "coverageReady")).toMatchObject({
        status: "NOT_STARTED",
        owningPhase: "R1-P10",
      });
      expect(gateByKey(gates, "availabilityReady")).toMatchObject({
        status: "NOT_STARTED",
        owningPhase: "R1-P10",
      });
      expect(gateByKey(gates, "capacityReady")).toMatchObject({
        status: "NOT_STARTED",
        owningPhase: "R1-P10",
      });
      expect(gateByKey(gates, "operationalLive")).toMatchObject({
        status: "BLOCKED",
        satisfied: false,
        owningPhase: "R1-P05",
        blockerCodes: ["OPERATIONAL_LIVE_UNSUPPORTED_R1_P05"],
      });
      expect(gateByKey(gates, "eligibleForPublicBrowse")).toMatchObject({
        status: "BLOCKED",
        satisfied: false,
        owningPhase: "R1-P12",
        blockerCodes: ["PUBLIC_BROWSE_DEFERRED_R1_P12"],
      });
    }
  });

  it("never sets eligibleForPublicBrowse true in R1-P05", () => {
    const cases: Array<{
      kind: ProviderKind;
      applicationStatus: ProviderApplicationStatus;
      operationalStatus: ProviderOperationalStatus;
      profileCompletionPercentage: number;
    }> = [
      {
        kind: "INDIVIDUAL_TEAM",
        applicationStatus: "APPROVED",
        operationalStatus: "LIVE",
        profileCompletionPercentage: 100,
      },
      {
        kind: "REGISTERED_COMPANY",
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        profileCompletionPercentage: 100,
      },
      {
        kind: "INDIVIDUAL_TEAM",
        applicationStatus: "DRAFT",
        operationalStatus: "INACTIVE",
        profileCompletionPercentage: 0,
      },
    ];

    for (const facts of cases) {
      const result = calculateMarketplaceReadiness(facts);
      expect(result.eligibleForPublicBrowse).toBe(false);
      expect(gateByKey(result.gates, "eligibleForPublicBrowse").satisfied).toBe(
        false,
      );
    }
  });

  it("uses only SATISFIED|NOT_REQUIRED|NOT_STARTED|BLOCKED statuses", () => {
    const allowed = new Set([
      "SATISFIED",
      "NOT_REQUIRED",
      "NOT_STARTED",
      "BLOCKED",
    ]);
    for (const kind of ["INDIVIDUAL_TEAM", "REGISTERED_COMPANY"] as const) {
      for (const gate of readiness({
        kind,
        profileCompletionPercentage: 100,
        applicationStatus: "APPROVED",
        operationalStatus: "LIVE",
      }).gates) {
        expect(allowed.has(gate.status)).toBe(true);
        expect(typeof gate.applicable).toBe("boolean");
        expect(typeof gate.satisfied).toBe("boolean");
        expect(Array.isArray(gate.blockerCodes)).toBe(true);
        expect(gate.owningPhase.length).toBeGreaterThan(0);
      }
    }
  });
});

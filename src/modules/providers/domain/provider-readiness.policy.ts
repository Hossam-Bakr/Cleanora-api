import {
  MARKETPLACE_READINESS_GATE_KEYS,
  type MarketplaceReadiness,
  type MarketplaceReadinessGate,
  type MarketplaceReadinessGateKey,
  type ProviderApplicationStatus,
  type ProviderKind,
  type ProviderOperationalStatus,
} from "./providers.types.js";

export interface ProviderReadinessFacts {
  readonly kind: ProviderKind;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: ProviderOperationalStatus;
  readonly profileCompletionPercentage: number;
  readonly documentsVerified?: {
    readonly applicable: boolean;
    readonly status: "NOT_REQUIRED" | "NOT_STARTED" | "BLOCKED" | "SATISFIED";
    readonly satisfied: boolean;
    readonly blockerCodes: readonly string[];
  };
  readonly payoutDestinationReady?: boolean;
}

function gate(input: {
  readonly key: MarketplaceReadinessGateKey;
  readonly applicable: boolean;
  readonly status: MarketplaceReadinessGate["status"];
  readonly satisfied: boolean;
  readonly blockerCodes: readonly string[];
  readonly owningPhase: string;
}): MarketplaceReadinessGate {
  return input;
}

function documentsVerifiedGate(
  kind: ProviderKind,
  current?: ProviderReadinessFacts["documentsVerified"],
): MarketplaceReadinessGate {
  if (current !== undefined) {
    return gate({
      key: "documentsVerified",
      applicable: current.applicable,
      status: current.status,
      satisfied: current.satisfied,
      blockerCodes: current.blockerCodes,
      owningPhase: "R1-P06",
    });
  }
  if (kind === "INDIVIDUAL_TEAM") {
    return gate({
      key: "documentsVerified",
      applicable: false,
      status: "NOT_REQUIRED",
      satisfied: true,
      blockerCodes: [],
      owningPhase: "R1-P05",
    });
  }
  return gate({
    key: "documentsVerified",
    applicable: true,
    status: "BLOCKED",
    satisfied: false,
    blockerCodes: ["COMPANY_DOCUMENTS_DEFERRED_R1_P06"],
    owningPhase: "R1-P06",
  });
}

function laterPhaseGate(
  key: MarketplaceReadinessGateKey,
  owningPhase: string,
  blockerCode: string,
): MarketplaceReadinessGate {
  return gate({
    key,
    applicable: true,
    status: "NOT_STARTED",
    satisfied: false,
    blockerCodes: [blockerCode],
    owningPhase,
  });
}

/**
 * Pure eleven-gate marketplace readiness. Public browse stays false in R1-P05.
 */
export function calculateMarketplaceReadiness(
  facts: ProviderReadinessFacts,
): MarketplaceReadiness {
  const profileComplete = facts.profileCompletionPercentage === 100;
  const applicationApproved = facts.applicationStatus === "APPROVED";
  const operationalLive = facts.operationalStatus === "LIVE";

  const byKey: Record<MarketplaceReadinessGateKey, MarketplaceReadinessGate> = {
    profileComplete: gate({
      key: "profileComplete",
      applicable: true,
      status: profileComplete ? "SATISFIED" : "BLOCKED",
      satisfied: profileComplete,
      blockerCodes: profileComplete ? [] : ["PROFILE_INCOMPLETE"],
      owningPhase: "R1-P05",
    }),
    applicationApproved: gate({
      key: "applicationApproved",
      applicable: true,
      status: applicationApproved ? "SATISFIED" : "BLOCKED",
      satisfied: applicationApproved,
      blockerCodes: applicationApproved ? [] : ["APPLICATION_NOT_APPROVED"],
      owningPhase: "R1-P05",
    }),
    documentsVerified: documentsVerifiedGate(facts.kind, facts.documentsVerified),
    payoutDestinationReady: facts.payoutDestinationReady === undefined
      ? laterPhaseGate("payoutDestinationReady", "R1-P06", "PAYOUT_DEFERRED_R1_P06")
      : gate({
          key: "payoutDestinationReady",
          applicable: true,
          status: facts.payoutDestinationReady ? "SATISFIED" : "BLOCKED",
          satisfied: facts.payoutDestinationReady,
          blockerCodes: facts.payoutDestinationReady ? [] : ["PAYOUT_PRIMARY_APPROVED_REQUIRED"],
          owningPhase: "R1-P06",
        }),
    workersReady: laterPhaseGate(
      "workersReady",
      "R1-P07",
      "WORKERS_DEFERRED_R1_P07",
    ),
    servicesReady: laterPhaseGate(
      "servicesReady",
      "R1-P09",
      "SERVICES_DEFERRED_R1_P09",
    ),
    coverageReady: laterPhaseGate(
      "coverageReady",
      "R1-P10",
      "COVERAGE_DEFERRED_R1_P10",
    ),
    availabilityReady: laterPhaseGate(
      "availabilityReady",
      "R1-P10",
      "AVAILABILITY_DEFERRED_R1_P10",
    ),
    capacityReady: laterPhaseGate(
      "capacityReady",
      "R1-P10",
      "CAPACITY_DEFERRED_R1_P10",
    ),
    operationalLive: gate({
      key: "operationalLive",
      applicable: true,
      status: operationalLive ? "SATISFIED" : "BLOCKED",
      satisfied: operationalLive,
      blockerCodes: operationalLive
        ? []
        : ["OPERATIONAL_LIVE_UNSUPPORTED_R1_P05"],
      owningPhase: "R1-P05",
    }),
    eligibleForPublicBrowse: gate({
      key: "eligibleForPublicBrowse",
      applicable: true,
      status: "BLOCKED",
      satisfied: false,
      blockerCodes: ["PUBLIC_BROWSE_DEFERRED_R1_P12"],
      owningPhase: "R1-P12",
    }),
  };

  return {
    gates: MARKETPLACE_READINESS_GATE_KEYS.map((key) => byKey[key]),
    eligibleForPublicBrowse: false,
  };
}

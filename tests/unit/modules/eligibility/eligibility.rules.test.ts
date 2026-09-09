import {
  evaluateCatalogApplicability,
  evaluateOfferingPriceUsability,
  evaluateProviderApprovalVerificationLive,
  evaluateProviderCandidate,
  evaluateProviderSchedulePause,
  evaluateTextualCoverage,
  type AvailabilityFacts,
  type CrewCapacityTeamFacts,
  type LifecycleFacts,
  type PricingFacts,
} from "#modules/eligibility/eligibility.rules";
import { R1_P11_IDS, R1_P11_TIMES } from "../../../helpers/r1-p11-eligibility-fixtures.js";

function availableTeam(
  overrides: Partial<CrewCapacityTeamFacts> & { readonly teamId: string },
): CrewCapacityTeamFacts {
  return {
    teamId: overrides.teamId,
    structurallyValid: overrides.structurallyValid ?? true,
    membersAvailableForWholeInterval:
      overrides.membersAvailableForWholeInterval ?? true,
    cleanerGenderCounts: overrides.cleanerGenderCounts ?? {
      male: 1,
      female: 0,
      otherOrUnspecified: 0,
    },
    escortFacts: overrides.escortFacts ?? {
      escortRequired: false,
      escortPresentAndValid: true,
      escortsAvailableForWholeInterval: true,
    },
  };
}

const liveLifecycle: LifecycleFacts = {
  status: "PRESENT",
  providerId: R1_P11_IDS.providerId,
  approved: true,
  live: true,
  suspended: false,
  verificationSatisfiedOrNotRequired: true,
  aggregateVersion: "1",
};

const availablePricing: PricingFacts = {
  status: "AVAILABLE",
  providerId: R1_P11_IDS.providerId,
  serviceId: R1_P11_IDS.serviceId,
  priceAmount: "100.00",
  minimumChargeAmount: "100.00",
  currencyCode: "EGP",
  priceUnitId: "pu-1",
  estimatedDurationMinutes: 60,
  sourceVersion: "psv-1",
};

function availableFacts(
  teams: readonly CrewCapacityTeamFacts[],
  overrides: Partial<Extract<AvailabilityFacts, { status: "AVAILABLE_FACTS" }>> = {},
): AvailabilityFacts {
  return {
    status: "AVAILABLE_FACTS",
    providerId: R1_P11_IDS.providerId,
    coverageMatch: overrides.coverageMatch ?? true,
    providerScheduleAvailable: overrides.providerScheduleAvailable ?? true,
    paused: overrides.paused ?? false,
    suspended: overrides.suspended ?? false,
    simultaneousTeamLimit: overrides.simultaneousTeamLimit ?? 5,
    teams,
  };
}

const disabledGate = {
  enabled: false as const,
  metricKey: null,
  minimumThreshold: null,
  minimumSampleCount: null,
  maxEvidenceAgeSeconds: null,
};

describe("eligibility.rules (Batch D / SC-001)", () => {
  it("records Catalog business FAIL for well-formed inactive/unknown service", () => {
    expect(
      evaluateCatalogApplicability({
        status: "UNAVAILABLE",
        reason: "SERVICE_INACTIVE_OR_UNKNOWN",
      }),
    ).toMatchObject({
      status: "FAIL",
      reasons: ["SERVICE_INACTIVE_OR_UNKNOWN"],
    });
  });

  it("owns REQUESTED_INTERVAL_TOO_SHORT on AVAILABLE pricing (DEC-065)", () => {
    const short = evaluateOfferingPriceUsability({
      pricing: { ...availablePricing, estimatedDurationMinutes: 180 },
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt, // 120 minutes
    });
    expect(short).toMatchObject({
      status: "FAIL",
      reasons: ["REQUESTED_INTERVAL_TOO_SHORT"],
    });

    const ok = evaluateOfferingPriceUsability({
      pricing: availablePricing,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
    });
    expect(ok.status).toBe("PASS");
  });

  it("collects multiple independent FAILs on one Provider (Example A)", () => {
    const result = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: { ...liveLifecycle, live: false },
      pricing: availablePricing,
      availability: availableFacts([availableTeam({ teamId: "t1" })], {
        coverageMatch: false,
        providerScheduleAvailable: false,
      }),
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });

    expect(result.provider.eligible).toBe(false);
    expect(result.provider.reasons).toEqual(
      expect.arrayContaining([
        "PROVIDER_NOT_LIVE",
        "COVERAGE_MISMATCH",
        "PROVIDER_CLOSED_OR_OUTSIDE_HOURS",
      ]),
    );
    const coverage = result.provider.ruleOutcomes.find(
      (o) => o.ruleId === "TEXTUAL_COVERAGE",
    );
    const schedule = result.provider.ruleOutcomes.find(
      (o) => o.ruleId === "PROVIDER_SCHEDULE_PAUSE",
    );
    const live = result.provider.ruleOutcomes.find(
      (o) => o.ruleId === "PROVIDER_APPROVAL_VERIFICATION_LIVE",
    );
    expect(coverage?.status).toBe("FAIL");
    expect(schedule?.status).toBe("FAIL");
    expect(live?.status).toBe("FAIL");
  });

  it("keeps Provider eligible with mixed valid/invalid Teams (Example B)", () => {
    const result = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: availableFacts([
        availableTeam({ teamId: "t1", structurallyValid: false }),
        availableTeam({ teamId: "t2" }),
      ]),
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });

    expect(result.provider.eligible).toBe(true);
    expect(result.provider.qualifyingTeamCount).toBe(1);
    const t1 = result.teams.find((row) => row.teamId === "t1");
    const t2 = result.teams.find((row) => row.teamId === "t2");
    expect(t1?.eligible).toBe(false);
    expect(t1?.reasons).toContain("TEAM_STRUCTURALLY_INVALID");
    expect(t2?.eligible).toBe(true);
  });

  it("excludes all Teams when Provider capacity FAILs (Example C)", () => {
    const result = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 2,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: availableFacts(
        [availableTeam({ teamId: "t1" }), availableTeam({ teamId: "t2" })],
        { simultaneousTeamLimit: 1 },
      ),
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });

    expect(result.provider.eligible).toBe(false);
    expect(result.provider.reasons).toContain(
      "INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER",
    );
    expect(result.teams.every((row) => row.eligible === false)).toBe(true);
    expect(
      result.teams.every((row) =>
        row.reasons.includes("INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER"),
      ),
    ).toBe(true);
  });

  it("does not invent NO_VALID_COMPLETE_TEAM when Teams remain readable under missing capacity", () => {
    const result = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: {
        status: "MISSING_CONFIGURATION",
        providerId: R1_P11_IDS.providerId,
        missingConfiguration: ["CAPACITY_RULE"],
        coverageMatch: true,
        providerScheduleAvailable: true,
        paused: false,
        suspended: false,
        simultaneousTeamLimit: null,
        teams: [availableTeam({ teamId: "t1" })],
      },
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });

    expect(result.provider.reasons).toContain("CAPACITY_RULE_MISSING");
    expect(result.provider.reasons).not.toContain("NO_VALID_COMPLETE_TEAM");
  });

  it("evaluates coverage independently of live status", () => {
    expect(
      evaluateTextualCoverage(
        availableFacts([availableTeam({ teamId: "t1" })], {
          coverageMatch: false,
        }),
      ).status,
    ).toBe("FAIL");
    expect(
      evaluateProviderApprovalVerificationLive({
        ...liveLifecycle,
        live: false,
      }).reasons,
    ).toContain("PROVIDER_NOT_LIVE");
  });

  it("collects independent lifecycle FAILs including suspension and verification", () => {
    expect(
      evaluateProviderApprovalVerificationLive({
        ...liveLifecycle,
        approved: false,
        suspended: true,
        live: false,
        verificationSatisfiedOrNotRequired: false,
      }).reasons,
    ).toEqual([
      "PROVIDER_NOT_APPROVED",
      "PROVIDER_SUSPENDED",
      "PROVIDER_NOT_LIVE",
      "VERIFICATION_NOT_SATISFIED",
    ]);
  });

  it("marks coverage/schedule NOT_EVALUATED on availability OVERFLOW", () => {
    const overflow = {
      status: "OVERFLOW" as const,
      providerId: R1_P11_IDS.providerId,
      acceptedTeams: [availableTeam({ teamId: "t1" })],
    };
    expect(evaluateTextualCoverage(overflow).status).toBe("NOT_EVALUATED");
    expect(evaluateProviderSchedulePause(overflow).status).toBe(
      "NOT_EVALUATED",
    );
    const candidate = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: overflow,
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });
    expect(
      candidate.provider.ruleOutcomes.find(
        (o) => o.ruleId === "CAPACITY_AFTER_CREW_FILTER",
      )?.status,
    ).toBe("NOT_EVALUATED");
  });

  it("fails schedule for pause/suspension and teams for unavailable members", () => {
    expect(
      evaluateProviderSchedulePause(
        availableFacts([availableTeam({ teamId: "t1" })], {
          paused: true,
          suspended: true,
        }),
      ).reasons,
    ).toEqual(
      expect.arrayContaining(["PROVIDER_PAUSED", "PROVIDER_SUSPENDED"]),
    );

    const unavailable = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: availableFacts([
        availableTeam({
          teamId: "t1",
          membersAvailableForWholeInterval: false,
        }),
      ]),
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });
    expect(unavailable.teams[0]?.reasons).toContain("TEAM_MEMBERS_UNAVAILABLE");
    expect(unavailable.provider.reasons).toContain("NO_VALID_COMPLETE_TEAM");

    const preferenceMismatch = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "all_female",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: availableFacts([
        availableTeam({
          teamId: "t1",
          cleanerGenderCounts: { male: 1, female: 0, otherOrUnspecified: 0 },
        }),
      ]),
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });
    expect(preferenceMismatch.teams[0]?.reasons).toContain(
      "CREW_PREFERENCE_MISMATCH",
    );
    expect(
      preferenceMismatch.provider.ruleOutcomes.find(
        (o) => o.ruleId === "CREW_PREFERENCE",
      )?.status,
    ).toBe("FAIL");
  });

  it("returns eligible Provider sortingFacts when all gates PASS", () => {
    const result = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: availableFacts([availableTeam({ teamId: "t1" })]),
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });
    expect(result.provider.eligible).toBe(true);
    expect(result.provider.sortingFacts).toMatchObject({
      priceAmount: "100.00",
      matchingCapacityUnits: 1,
    });
    expect(result.teams[0]?.eligible).toBe(true);
    expect(result.teams[0]?.sortingFacts).not.toBeNull();
  });

  it("preserves multi-fail facts under MISSING_CONFIGURATION without inventing NO_VALID_COMPLETE_TEAM", () => {
    const result = evaluateProviderCandidate({
      providerId: R1_P11_IDS.providerId,
      preference: "any",
      requiredTeamUnits: 1,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      lifecycle: liveLifecycle,
      pricing: availablePricing,
      availability: {
        status: "MISSING_CONFIGURATION",
        providerId: R1_P11_IDS.providerId,
        missingConfiguration: ["CAPACITY_RULE", "PROVIDER_SCHEDULE"],
        coverageMatch: false,
        providerScheduleAvailable: false,
        paused: true,
        suspended: false,
        simultaneousTeamLimit: null,
        teams: [availableTeam({ teamId: "t1" })],
      },
      performanceGate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      performancePortResult: null,
    });
    expect(result.provider.reasons).toEqual(
      expect.arrayContaining([
        "CAPACITY_RULE_MISSING",
        "COVERAGE_MISMATCH",
        "PROVIDER_PAUSED",
        "PROVIDER_CLOSED_OR_OUTSIDE_HOURS",
      ]),
    );
    expect(result.provider.reasons).not.toContain("NO_VALID_COMPLETE_TEAM");
    expect(result.teams).toHaveLength(1);
  });
});

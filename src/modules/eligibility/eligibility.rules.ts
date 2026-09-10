/**
 * Pure Eligibility rule evaluators and Provider/Team algebra (R1-P11 Batch D).
 *
 * Authority: DEC-064, DEC-065, DEC-074, DEC-080, DEC-084.
 * No I/O — callers supply reader/port outcomes as discriminated facts.
 */

import {
  evaluateCapacityAfterCrewFilter,
  evaluateCrewPreferenceRule,
  matchingCapacityAfterCrewFilter,
  teamIndividuallyQualifies,
  type CrewCapacityTeamFacts,
} from "./eligibility.crew-capacity.js";
import { evaluatePerformanceGateFromEvidence } from "./eligibility.performance.js";
import type { PerformanceGateParameters } from "./eligibility.performance.js";
import {
  dedupeReasonsInOrder,
  exclusionReasonsOnly,
} from "./eligibility.reasons.js";
import type {
  CrewPreference,
  EligibilityReasonCode,
  ProviderSummary,
  RuleOutcome,
  SortingFacts,
  TeamResult,
} from "./eligibility.public.js";
import type { PerformanceEvidenceResult } from "./performance-evidence.port.js";

export type { CrewCapacityTeamFacts } from "./eligibility.crew-capacity.js";

/** Catalog offering resolution for evaluation-level CATALOG_APPLICABILITY. */
export type CatalogApplicabilityFacts =
  | {
      readonly status: "AVAILABLE";
      readonly serviceId: string;
      readonly serviceCode: string;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly reason:
        | "SERVICE_NOT_AVAILABLE_IN_COUNTRY"
        | "SERVICE_INACTIVE_OR_UNKNOWN";
    };

export type LifecycleFacts =
  | { readonly status: "MISSING"; readonly providerId: string }
  | {
      readonly status: "PRESENT";
      readonly providerId: string;
      readonly approved: boolean;
      readonly live: boolean;
      readonly suspended: boolean;
      readonly verificationSatisfiedOrNotRequired: boolean;
      readonly aggregateVersion: string;
    };

export type PricingFacts =
  | {
      readonly status: "AVAILABLE";
      readonly providerId: string;
      readonly serviceId: string;
      readonly priceAmount: string;
      readonly minimumChargeAmount: string;
      readonly currencyCode: string;
      readonly priceUnitId: string;
      readonly estimatedDurationMinutes: number;
      readonly sourceVersion: string;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly providerId: string;
      readonly serviceId: string;
      readonly reason: "OFFERING_OR_PRICE_UNAVAILABLE";
      readonly sourceVersion: string | null;
    };

export type AvailabilityFacts =
  | {
      readonly status: "MISSING_CONFIGURATION";
      readonly providerId: string;
      readonly missingConfiguration: readonly (
        | "COVERAGE"
        | "PROVIDER_SCHEDULE"
        | "CAPACITY_RULE"
      )[];
      readonly coverageMatch: boolean;
      readonly providerScheduleAvailable: boolean;
      readonly paused: boolean;
      readonly suspended: boolean;
      readonly simultaneousTeamLimit: number | null;
      readonly teams: readonly CrewCapacityTeamFacts[];
    }
  | {
      readonly status: "AVAILABLE_FACTS";
      readonly providerId: string;
      readonly coverageMatch: boolean;
      readonly providerScheduleAvailable: boolean;
      readonly paused: boolean;
      readonly suspended: boolean;
      readonly simultaneousTeamLimit: number;
      readonly teams: readonly CrewCapacityTeamFacts[];
    }
  | {
      readonly status: "OVERFLOW";
      readonly providerId: string;
      readonly acceptedTeams: readonly CrewCapacityTeamFacts[];
    };

/**
 * @desc Evaluate Catalog applicability (evaluation-level outcome).
 * @access Domain
 * @explanation Well-formed unknown/inactive/unavailable service ⇒ business FAIL,
 * never a hard validation error (DEC-084).
 */
export function evaluateCatalogApplicability(
  facts: CatalogApplicabilityFacts,
): RuleOutcome {
  if (facts.status === "AVAILABLE") {
    return {
      ruleId: "CATALOG_APPLICABILITY",
      status: "PASS",
      reasons: [],
    };
  }
  return {
    ruleId: "CATALOG_APPLICABILITY",
    status: "FAIL",
    reasons: [facts.reason],
  };
}

/**
 * @desc Evaluate approval / verification / live / suspension (DEC-080).
 * @access Domain
 * @explanation Explicit MISSING Provider is a business exclusion path, not a
 * technical failure. Collect all independent lifecycle FAILs.
 */
export function evaluateProviderApprovalVerificationLive(
  facts: LifecycleFacts,
): RuleOutcome {
  if (facts.status === "MISSING") {
    return {
      ruleId: "PROVIDER_APPROVAL_VERIFICATION_LIVE",
      status: "FAIL",
      reasons: ["PROVIDER_NOT_APPROVED", "PROVIDER_NOT_LIVE"],
    };
  }

  const reasons: EligibilityReasonCode[] = [];
  if (!facts.approved) {
    reasons.push("PROVIDER_NOT_APPROVED");
  }
  if (facts.suspended) {
    reasons.push("PROVIDER_SUSPENDED");
  }
  if (!facts.live) {
    reasons.push("PROVIDER_NOT_LIVE");
  }
  if (!facts.verificationSatisfiedOrNotRequired) {
    reasons.push("VERIFICATION_NOT_SATISFIED");
  }

  if (reasons.length === 0) {
    return {
      ruleId: "PROVIDER_APPROVAL_VERIFICATION_LIVE",
      status: "PASS",
      reasons: [],
    };
  }
  return {
    ruleId: "PROVIDER_APPROVAL_VERIFICATION_LIVE",
    status: "FAIL",
    reasons: dedupeReasonsInOrder(reasons),
  };
}

/**
 * @desc Elapsed minutes of half-open UTC interval [startsAt, endsAt).
 * @access Domain
 */
export function requestedIntervalDurationMinutes(
  startsAt: string,
  endsAt: string,
): number {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  return (endMs - startMs) / 60_000;
}

/**
 * @desc Offering/price usability + Eligibility-owned interval length check.
 * @access Domain
 * @explanation Pricing reader never emits REQUESTED_INTERVAL_TOO_SHORT;
 * Eligibility compares AVAILABLE estimatedDurationMinutes to the request
 * interval (DEC-065 / DEC-084).
 */
export function evaluateOfferingPriceUsability(input: {
  readonly pricing: PricingFacts;
  readonly startsAt: string;
  readonly endsAt: string;
}): RuleOutcome {
  if (input.pricing.status === "UNAVAILABLE") {
    return {
      ruleId: "OFFERING_PRICE_USABILITY",
      status: "FAIL",
      reasons: ["OFFERING_OR_PRICE_UNAVAILABLE"],
    };
  }

  const reasons: EligibilityReasonCode[] = [];
  const durationMinutes = requestedIntervalDurationMinutes(
    input.startsAt,
    input.endsAt,
  );
  if (durationMinutes < input.pricing.estimatedDurationMinutes) {
    reasons.push("REQUESTED_INTERVAL_TOO_SHORT");
  }

  if (reasons.length === 0) {
    return {
      ruleId: "OFFERING_PRICE_USABILITY",
      status: "PASS",
      reasons: [],
    };
  }
  return {
    ruleId: "OFFERING_PRICE_USABILITY",
    status: "FAIL",
    reasons,
  };
}

/**
 * @desc Textual coverage rule from availability facts.
 * @access Domain
 */
export function evaluateTextualCoverage(facts: AvailabilityFacts): RuleOutcome {
  if (facts.status === "OVERFLOW") {
    return {
      ruleId: "TEXTUAL_COVERAGE",
      status: "NOT_EVALUATED",
      reasons: [],
      dependencyRuleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
    };
  }
  if (!facts.coverageMatch) {
    return {
      ruleId: "TEXTUAL_COVERAGE",
      status: "FAIL",
      reasons: ["COVERAGE_MISMATCH"],
    };
  }
  return {
    ruleId: "TEXTUAL_COVERAGE",
    status: "PASS",
    reasons: [],
  };
}

/**
 * @desc Provider schedule / pause rule.
 * @access Domain
 * @explanation Pause and suspension are operational facts, not missing-config
 * categories (DEC-084).
 */
export function evaluateProviderSchedulePause(
  facts: AvailabilityFacts,
): RuleOutcome {
  if (facts.status === "OVERFLOW") {
    return {
      ruleId: "PROVIDER_SCHEDULE_PAUSE",
      status: "NOT_EVALUATED",
      reasons: [],
      dependencyRuleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
    };
  }

  const reasons: EligibilityReasonCode[] = [];
  if (facts.paused) {
    reasons.push("PROVIDER_PAUSED");
  }
  if (facts.suspended) {
    reasons.push("PROVIDER_SUSPENDED");
  }
  const scheduleMissing =
    facts.status === "MISSING_CONFIGURATION" &&
    facts.missingConfiguration.includes("PROVIDER_SCHEDULE");
  if (!facts.providerScheduleAvailable || scheduleMissing) {
    reasons.push("PROVIDER_CLOSED_OR_OUTSIDE_HOURS");
  }

  if (reasons.length === 0) {
    return {
      ruleId: "PROVIDER_SCHEDULE_PAUSE",
      status: "PASS",
      reasons: [],
    };
  }
  return {
    ruleId: "PROVIDER_SCHEDULE_PAUSE",
    status: "FAIL",
    reasons: dedupeReasonsInOrder(reasons),
  };
}

/**
 * @desc Complete Team validity / availability at Provider + per-Team grain.
 * @access Domain
 */
export function evaluateCompleteTeamValidityAvailability(input: {
  readonly availability: AvailabilityFacts;
}): {
  readonly providerOutcome: RuleOutcome;
  readonly teamOutcomes: readonly {
    readonly teamId: string;
    readonly outcome: RuleOutcome;
  }[];
} {
  if (input.availability.status === "OVERFLOW") {
    return {
      providerOutcome: {
        ruleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
        status: "NOT_EVALUATED",
        reasons: [],
      },
      teamOutcomes: [],
    };
  }

  const providerReasons: EligibilityReasonCode[] = [];
  if (
    input.availability.status === "MISSING_CONFIGURATION" &&
    input.availability.missingConfiguration.includes("CAPACITY_RULE")
  ) {
    providerReasons.push("CAPACITY_RULE_MISSING");
  }

  const teams = input.availability.teams;
  const teamOutcomes = teams.map((team) => {
    const reasons: EligibilityReasonCode[] = [];
    if (!team.structurallyValid) {
      reasons.push("TEAM_STRUCTURALLY_INVALID");
    }
    if (!team.membersAvailableForWholeInterval) {
      reasons.push("TEAM_MEMBERS_UNAVAILABLE");
    }
    if (reasons.length === 0) {
      return {
        teamId: team.teamId,
        outcome: {
          ruleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY" as const,
          status: "PASS" as const,
          reasons: [],
        },
      };
    }
    return {
      teamId: team.teamId,
      outcome: {
        ruleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY" as const,
        status: "FAIL" as const,
        reasons: dedupeReasonsInOrder(reasons),
      },
    };
  });

  const anyStructurallyValidAvailable = teams.some(
    (team) => team.structurallyValid && team.membersAvailableForWholeInterval,
  );
  if (teams.length === 0 || !anyStructurallyValidAvailable) {
    if (teams.length === 0 || !teams.some((team) => team.structurallyValid)) {
      providerReasons.push("NO_VALID_COMPLETE_TEAM");
    } else {
      providerReasons.push("NO_VALID_COMPLETE_TEAM");
    }
  }

  return {
    providerOutcome: {
      ruleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
      status: providerReasons.length === 0 ? "PASS" : "FAIL",
      reasons: dedupeReasonsInOrder(providerReasons),
    },
    teamOutcomes,
  };
}

export interface EvaluateProviderCandidateInput {
  readonly providerId: string;
  readonly preference: CrewPreference;
  readonly requiredTeamUnits: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly lifecycle: LifecycleFacts;
  readonly pricing: PricingFacts;
  readonly availability: AvailabilityFacts;
  readonly performanceGate: PerformanceGateParameters;
  readonly policyVersionId: string;
  readonly evaluatedAt: string;
  /** null when gate disabled (port not called). */
  readonly performancePortResult: PerformanceEvidenceResult | null;
}

export interface EvaluateProviderCandidateResult {
  readonly provider: ProviderSummary;
  readonly teams: readonly TeamResult[];
  readonly matchingCapacityUnits: number;
}

/**
 * @desc Evaluate all Provider/Team rules for one candidate (DEC-080 algebra).
 * @access Domain
 */
export function evaluateProviderCandidate(
  input: EvaluateProviderCandidateInput,
): EvaluateProviderCandidateResult {
  if (input.availability.status === "OVERFLOW") {
    throw new Error(
      "Eligibility invariant: availability OVERFLOW must be handled before candidate evaluation",
    );
  }
  const lifecycleOutcome = evaluateProviderApprovalVerificationLive(
    input.lifecycle,
  );
  const pricingOutcome = evaluateOfferingPriceUsability({
    pricing: input.pricing,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  const coverageOutcome = evaluateTextualCoverage(input.availability);
  const scheduleOutcome = evaluateProviderSchedulePause(input.availability);
  const teamValidity = evaluateCompleteTeamValidityAvailability({
    availability: input.availability,
  });

  const teams: CrewCapacityTeamFacts[] = [...input.availability.teams];

  const teamResults: TeamResult[] = [];
  const crewOutcomes: RuleOutcome[] = [];

  for (const team of teams) {
    const validity =
      teamValidity.teamOutcomes.find((entry) => entry.teamId === team.teamId)
        ?.outcome ?? {
        ruleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY" as const,
        status: "FAIL" as const,
        reasons: ["TEAM_STRUCTURALLY_INVALID"] as const,
      };
    const crew = evaluateCrewPreferenceRule({
      preference: input.preference,
      team,
    });
    crewOutcomes.push(crew);

    const teamRuleOutcomes = [validity, crew];
    const teamReasons = exclusionReasonsOnly(
      teamRuleOutcomes.flatMap((outcome) => outcome.reasons),
    );

    teamResults.push({
      providerId: input.providerId,
      teamId: team.teamId,
      eligible: false,
      ruleOutcomes: teamRuleOutcomes,
      reasons: teamReasons,
      sortingFacts: null,
    });
  }

  const limit = input.availability.simultaneousTeamLimit;

  const crewPreferenceEvaluated =
    teams.length === 0 ||
    crewOutcomes.some((outcome) => outcome.status !== "NOT_EVALUATED");

  const capacity =
    limit === null || limit < 1
      ? ({
          ruleId: "CAPACITY_AFTER_CREW_FILTER" as const,
          status: "NOT_EVALUATED" as const,
          reasons: [] as const,
          dependencyRuleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY" as const,
          matchingCapacityUnits: 0,
        } satisfies RuleOutcome & { matchingCapacityUnits: number })
      : evaluateCapacityAfterCrewFilter({
          preference: input.preference,
          teams,
          simultaneousTeamLimit: limit,
          requiredTeamUnits: input.requiredTeamUnits,
          crewPreferenceEvaluated,
        });

  const performance = evaluatePerformanceGateFromEvidence({
    gate: input.performanceGate,
    policyVersionId: input.policyVersionId,
    evaluatedAt: input.evaluatedAt,
    providerId: input.providerId,
    portResult: input.performancePortResult,
  });

  const providerRuleOutcomes: RuleOutcome[] = [
    lifecycleOutcome,
    pricingOutcome,
    coverageOutcome,
    scheduleOutcome,
    teamValidity.providerOutcome,
    {
      ruleId: "CREW_PREFERENCE",
      status:
        teams.length === 0
          ? "NOT_EVALUATED"
          : crewOutcomes.every((o) => o.status === "PASS")
            ? "PASS"
            : crewOutcomes.some((o) => o.status === "FAIL")
              ? "FAIL"
              : "NOT_EVALUATED",
      reasons: dedupeReasonsInOrder(
        crewOutcomes.flatMap((o) => (o.status === "FAIL" ? o.reasons : [])),
      ),
      ...(teams.length === 0
        ? { dependencyRuleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY" as const }
        : {}),
    },
    {
      ruleId: capacity.ruleId,
      status: capacity.status,
      reasons: capacity.reasons,
      ...(capacity.dependencyRuleId === undefined
        ? {}
        : { dependencyRuleId: capacity.dependencyRuleId }),
    },
    {
      ruleId: performance.ruleId,
      status: performance.status,
      reasons: performance.reasons,
    },
  ];

  const matchingCapacityUnits =
    limit === null || limit < 1
      ? 0
      : matchingCapacityAfterCrewFilter({
          preference: input.preference,
          teams,
          simultaneousTeamLimit: limit,
        });

  const qualifyingTeamIds = new Set(
    teams
      .filter((team) =>
        teamIndividuallyQualifies({ preference: input.preference, team }),
      )
      .map((team) => team.teamId),
  );

  const performanceBlocks = performance.status === "FAIL";
  const capacityOk = capacity.status === "PASS";
  const hasQualifyingTeam = qualifyingTeamIds.size > 0;

  // DEC-080: all applicable Provider gates PASS, capacity sufficient, ≥1 Team.
  // Disabled/missing/stale performance does not falsify. One invalid Team does
  // not exclude a Provider that still has other qualifying Teams.
  const refinedEligible =
    lifecycleOutcome.status === "PASS" &&
    pricingOutcome.status === "PASS" &&
    coverageOutcome.status === "PASS" &&
    scheduleOutcome.status === "PASS" &&
    !teamValidity.providerOutcome.reasons.includes("CAPACITY_RULE_MISSING") &&
    !teamValidity.providerOutcome.reasons.includes("NO_VALID_COMPLETE_TEAM") &&
    capacityOk &&
    hasQualifyingTeam &&
    !performanceBlocks;

  const providerReasons = exclusionReasonsOnly([
    ...providerRuleOutcomes.flatMap((o) => o.reasons),
    ...(!refinedEligible &&
    !hasQualifyingTeam &&
    !teamValidity.providerOutcome.reasons.includes("NO_VALID_COMPLETE_TEAM") &&
    teams.length > 0
      ? (["NO_VALID_COMPLETE_TEAM"] as const)
      : []),
  ]);

  const sortingFacts: SortingFacts | null =
    refinedEligible && input.pricing.status === "AVAILABLE"
      ? {
          priceAmount: input.pricing.priceAmount,
          minimumChargeAmount: input.pricing.minimumChargeAmount,
          currencyCode: input.pricing.currencyCode,
          priceUnitId: input.pricing.priceUnitId,
          estimatedDurationMinutes: input.pricing.estimatedDurationMinutes,
          matchingCapacityUnits,
          ...(performance.status === "PASS" &&
          performance.evidenceForSnapshot.status === "OK"
            ? {
                performanceMetricKey: performance.evidenceForSnapshot.metricKey,
                performanceValue: performance.evidenceForSnapshot.value,
              }
            : {}),
        }
      : null;

  const finalizedTeams = teamResults
    .map((team) => {
      const individuallyOk = qualifyingTeamIds.has(team.teamId);
      const eligible = refinedEligible && individuallyOk;
      // When the Provider fails any gate, inherit all Provider exclusion reasons
      // into each ineligible Team (reason-codes.md / DEC-080).
      const inherited: EligibilityReasonCode[] =
        !eligible && !refinedEligible ? [...providerReasons] : [];
      const reasons = exclusionReasonsOnly([...team.reasons, ...inherited]);
      if (!eligible && reasons.length === 0) {
        throw new Error(
          `Eligibility invariant: ineligible Team ${team.teamId} has no real exclusion reason`,
        );
      }
      return {
        ...team,
        eligible,
        reasons,
        sortingFacts: eligible ? sortingFacts : null,
        ruleOutcomes: [
          ...team.ruleOutcomes,
          {
            ruleId: "CAPACITY_AFTER_CREW_FILTER" as const,
            status: capacity.status,
            reasons: capacity.reasons,
            ...(capacity.dependencyRuleId === undefined
              ? {}
              : { dependencyRuleId: capacity.dependencyRuleId }),
          },
        ],
      };
    })
    .sort((left, right) => left.teamId.localeCompare(right.teamId));

  const providerFinalReasons = refinedEligible ? [] : providerReasons;
  if (!refinedEligible && providerFinalReasons.length === 0) {
    throw new Error(
      `Eligibility invariant: ineligible Provider ${input.providerId} has no real exclusion reason`,
    );
  }

  return {
    provider: {
      providerId: input.providerId,
      eligible: refinedEligible,
      ruleOutcomes: providerRuleOutcomes,
      reasons: providerFinalReasons,
      sortingFacts,
      qualifyingTeamCount: refinedEligible ? qualifyingTeamIds.size : 0,
    },
    teams: finalizedTeams,
    matchingCapacityUnits,
  };
}

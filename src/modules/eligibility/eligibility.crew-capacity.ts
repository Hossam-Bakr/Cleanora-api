/**
 * Crew preference and capacity-after-crew-filter policies (R1-P11 / DEC-074).
 *
 * Pure functions over Team aggregate facts — no Worker IDs, no I/O.
 */

import type {
  CrewPreference,
  EligibilityReasonCode,
  RuleOutcome,
} from "./eligibility.public.js";

/** Team aggregate facts consumed by crew/capacity policies (DEC-079). */
export interface CrewCapacityTeamFacts {
  readonly teamId: string;
  readonly structurallyValid: boolean;
  readonly membersAvailableForWholeInterval: boolean;
  readonly cleanerGenderCounts: {
    readonly male: number;
    readonly female: number;
    readonly otherOrUnspecified: number;
  };
  readonly escortFacts: {
    readonly escortRequired: boolean;
    readonly escortPresentAndValid: boolean;
    readonly escortsAvailableForWholeInterval: boolean;
  };
}

/**
 * @desc Whether cleaner gender counts satisfy the requested crew preference.
 * @access Domain
 * @explanation Escort gender is ignored; only cleans=true aggregates matter.
 * `any` always matches when at least one cleaner exists (Providers structural
 * validity already requires a cleaner). Empty cleaner totals fail preference
 * for gendered prefs; `any` still passes with zero cleaners only when the Team
 * is already treated as structurally invalid elsewhere.
 */
export function matchesCrewPreference(
  preference: CrewPreference,
  counts: CrewCapacityTeamFacts["cleanerGenderCounts"],
): boolean {
  const total = counts.male + counts.female + counts.otherOrUnspecified;
  if (preference === "any") {
    return true;
  }
  if (total === 0) {
    return false;
  }
  if (preference === "all_male") {
    return counts.female === 0 && counts.otherOrUnspecified === 0 && counts.male > 0;
  }
  return counts.male === 0 && counts.otherOrUnspecified === 0 && counts.female > 0;
}

/**
 * @desc Evaluate CREW_PREFERENCE for one Team (DEC-074 / DEC-080).
 * @access Domain
 * @explanation Prerequisite: Team must be structurally valid and members
 * available; otherwise NOT_EVALUATED with dependency on complete-team rule.
 * Escort gender never produces CREW_PREFERENCE_MISMATCH.
 */
export function evaluateCrewPreferenceRule(input: {
  readonly preference: CrewPreference;
  readonly team: CrewCapacityTeamFacts;
}): RuleOutcome {
  if (!input.team.structurallyValid || !input.team.membersAvailableForWholeInterval) {
    return {
      ruleId: "CREW_PREFERENCE",
      status: "NOT_EVALUATED",
      reasons: [],
      dependencyRuleId: "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
    };
  }
  if (matchesCrewPreference(input.preference, input.team.cleanerGenderCounts)) {
    return {
      ruleId: "CREW_PREFERENCE",
      status: "PASS",
      reasons: [],
    };
  }
  return {
    ruleId: "CREW_PREFERENCE",
    status: "FAIL",
    reasons: ["CREW_PREFERENCE_MISMATCH"] satisfies readonly EligibilityReasonCode[],
  };
}

/**
 * @desc Whether a Team individually qualifies before Provider capacity (DEC-080).
 * @access Domain
 */
export function teamIndividuallyQualifies(input: {
  readonly preference: CrewPreference;
  readonly team: CrewCapacityTeamFacts;
}): boolean {
  if (!input.team.structurallyValid) {
    return false;
  }
  if (!input.team.membersAvailableForWholeInterval) {
    return false;
  }
  return matchesCrewPreference(input.preference, input.team.cleanerGenderCounts);
}

/**
 * @desc Count matching capacity units after crew filter, capped by limit.
 * @access Domain
 * @explanation Capacity = min(simultaneousTeamLimit, crew-matching complete
 * Teams). Alternatives do not imply simultaneous booking of all (DEC-074).
 */
export function matchingCapacityAfterCrewFilter(input: {
  readonly preference: CrewPreference;
  readonly teams: readonly CrewCapacityTeamFacts[];
  readonly simultaneousTeamLimit: number;
}): number {
  const matching = input.teams.filter((team) =>
    teamIndividuallyQualifies({ preference: input.preference, team }),
  ).length;
  return Math.min(input.simultaneousTeamLimit, matching);
}

/**
 * @desc Evaluate CAPACITY_AFTER_CREW_FILTER at Provider grain (DEC-074 / DEC-080).
 * @access Domain
 * @explanation Missing capacity rule is a separate FAIL upstream
 * (`CAPACITY_RULE_MISSING`); this rule requires a positive integer limit.
 * When no Teams individually qualify, capacity FAIL is not emitted here —
 * complete-team / crew outcomes own that; capacity compares matching units
 * against requiredTeamUnits only when crew evaluation completed.
 */
export function evaluateCapacityAfterCrewFilter(input: {
  readonly preference: CrewPreference;
  readonly teams: readonly CrewCapacityTeamFacts[];
  readonly simultaneousTeamLimit: number;
  readonly requiredTeamUnits: number;
  /** True when crew preference was evaluable for at least one Team fact set. */
  readonly crewPreferenceEvaluated: boolean;
}): RuleOutcome & { readonly matchingCapacityUnits: number } {
  if (!input.crewPreferenceEvaluated) {
    return {
      ruleId: "CAPACITY_AFTER_CREW_FILTER",
      status: "NOT_EVALUATED",
      reasons: [],
      dependencyRuleId: "CREW_PREFERENCE",
      matchingCapacityUnits: 0,
    };
  }

  const matchingCapacityUnits = matchingCapacityAfterCrewFilter({
    preference: input.preference,
    teams: input.teams,
    simultaneousTeamLimit: input.simultaneousTeamLimit,
  });

  if (matchingCapacityUnits >= input.requiredTeamUnits) {
    return {
      ruleId: "CAPACITY_AFTER_CREW_FILTER",
      status: "PASS",
      reasons: [],
      matchingCapacityUnits,
    };
  }

  return {
    ruleId: "CAPACITY_AFTER_CREW_FILTER",
    status: "FAIL",
    reasons: [
      "INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER",
    ] satisfies readonly EligibilityReasonCode[],
    matchingCapacityUnits,
  };
}

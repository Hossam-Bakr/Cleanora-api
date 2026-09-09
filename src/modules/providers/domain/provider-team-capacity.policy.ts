/**
 * Pure complete-Team capacity policy (R1-P10 / DEC-055).
 * One unit is one active Team whose current members are all active and
 * available for the full requested interval, with at least one cleaner.
 */

export type ProviderTeamCapacityTeamStatus =
  | "DRAFT"
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

export type ProviderTeamCapacityWorkerStatus =
  | "DRAFT"
  | "ACTIVE"
  | "INACTIVE"
  | "REMOVED";

export type ProviderTeamCapacityBlocker =
  | "TEAM_INACTIVE"
  | "TEAM_HAS_NO_CURRENT_MEMBERS"
  | "TEAM_HAS_NO_CLEANER"
  | "TEAM_MEMBER_INACTIVE"
  | "TEAM_MEMBER_UNAVAILABLE";

export interface ProviderTeamCapacityMemberFact {
  readonly workerId: string;
  readonly cleans: boolean;
  readonly workerStatus: ProviderTeamCapacityWorkerStatus;
  readonly availableForFullInterval: boolean;
}

export interface ProviderTeamCapacityTeamFact {
  readonly teamId: string;
  readonly status: ProviderTeamCapacityTeamStatus;
  readonly members: readonly ProviderTeamCapacityMemberFact[];
}

export interface ProviderTeamCapacityResult {
  readonly availableUnits: number;
  readonly completeAvailableTeamCount: number;
  readonly maxSimultaneousTeams: number;
  readonly teams: readonly {
    readonly teamId: string;
    readonly completeAvailable: boolean;
    readonly blockers: readonly ProviderTeamCapacityBlocker[];
  }[];
}

export type CapacityRuleValidationError =
  | "MAX_SIMULTANEOUS_TEAMS_OUT_OF_RANGE";

export function validateMaxSimultaneousTeams(
  maxSimultaneousTeams: number,
): CapacityRuleValidationError | null {
  if (
    !Number.isInteger(maxSimultaneousTeams) ||
    maxSimultaneousTeams < 1 ||
    maxSimultaneousTeams > 50
  ) {
    return "MAX_SIMULTANEOUS_TEAMS_OUT_OF_RANGE";
  }
  return null;
}

export function evaluateCompleteTeamCapacity(input: {
  readonly maxSimultaneousTeams: number;
  readonly teams: readonly ProviderTeamCapacityTeamFact[];
}): ProviderTeamCapacityResult {
  const teams = input.teams.map((team) => {
    const blockers: ProviderTeamCapacityBlocker[] = [];

    if (team.status !== "ACTIVE") {
      blockers.push("TEAM_INACTIVE");
    }
    if (team.members.length === 0) {
      blockers.push("TEAM_HAS_NO_CURRENT_MEMBERS");
    }
    if (!team.members.some((member) => member.cleans)) {
      blockers.push("TEAM_HAS_NO_CLEANER");
    }
    if (team.members.some((member) => member.workerStatus !== "ACTIVE")) {
      blockers.push("TEAM_MEMBER_INACTIVE");
    }
    if (team.members.some((member) => !member.availableForFullInterval)) {
      blockers.push("TEAM_MEMBER_UNAVAILABLE");
    }

    return {
      teamId: team.teamId,
      completeAvailable: blockers.length === 0,
      blockers,
    };
  });
  const completeAvailableTeamCount = teams.filter(
    (team) => team.completeAvailable,
  ).length;

  return {
    availableUnits: Math.min(input.maxSimultaneousTeams, completeAvailableTeamCount),
    completeAvailableTeamCount,
    maxSimultaneousTeams: input.maxSimultaneousTeams,
    teams,
  };
}

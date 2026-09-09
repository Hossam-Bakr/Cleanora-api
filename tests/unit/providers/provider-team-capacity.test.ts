import {
  evaluateCompleteTeamCapacity,
  validateMaxSimultaneousTeams,
  type ProviderTeamCapacityTeamFact,
} from "../../../src/modules/providers/domain/provider-team-capacity.policy.js";

function team(
  overrides: Partial<ProviderTeamCapacityTeamFact> = {},
): ProviderTeamCapacityTeamFact {
  return {
    teamId: "team-1",
    status: "ACTIVE",
    members: [
      {
        workerId: "cleaner-1",
        cleans: true,
        workerStatus: "ACTIVE",
        availableForFullInterval: true,
      },
    ],
    ...overrides,
  };
}

describe("Provider complete-Team capacity policy (DEC-055)", () => {
  it("counts one active complete Team as one unit", () => {
    expect(
      evaluateCompleteTeamCapacity({
        maxSimultaneousTeams: 3,
        teams: [team()],
      }),
    ).toMatchObject({
      availableUnits: 1,
      completeAvailableTeamCount: 1,
      maxSimultaneousTeams: 3,
      teams: [{ teamId: "team-1", completeAvailable: true, blockers: [] }],
    });
  });

  it("caps available units by maxSimultaneousTeams", () => {
    const result = evaluateCompleteTeamCapacity({
      maxSimultaneousTeams: 2,
      teams: [
        team({ teamId: "team-1" }),
        team({ teamId: "team-2" }),
        team({ teamId: "team-3" }),
      ],
    });

    expect(result.completeAvailableTeamCount).toBe(3);
    expect(result.availableUnits).toBe(2);
  });

  it("requires at least one cleaner membership", () => {
    const result = evaluateCompleteTeamCapacity({
      maxSimultaneousTeams: 1,
      teams: [
        team({
          members: [
            {
              workerId: "escort-1",
              cleans: false,
              workerStatus: "ACTIVE",
              availableForFullInterval: true,
            },
          ],
        }),
      ],
    });

    expect(result.availableUnits).toBe(0);
    expect(result.teams[0]).toMatchObject({
      completeAvailable: false,
      blockers: ["TEAM_HAS_NO_CLEANER"],
    });
  });

  it("allows Escorts and other non-cleaners to accompany a Team without adding units", () => {
    const result = evaluateCompleteTeamCapacity({
      maxSimultaneousTeams: 5,
      teams: [
        team({
          members: [
            {
              workerId: "cleaner-1",
              cleans: true,
              workerStatus: "ACTIVE",
              availableForFullInterval: true,
            },
            {
              workerId: "escort-1",
              cleans: false,
              workerStatus: "ACTIVE",
              availableForFullInterval: true,
            },
            {
              workerId: "other-1",
              cleans: false,
              workerStatus: "ACTIVE",
              availableForFullInterval: true,
            },
          ],
        }),
      ],
    });

    expect(result.completeAvailableTeamCount).toBe(1);
    expect(result.availableUnits).toBe(1);
  });

  it("requires non-cleaning members to be available too", () => {
    const result = evaluateCompleteTeamCapacity({
      maxSimultaneousTeams: 1,
      teams: [
        team({
          members: [
            {
              workerId: "cleaner-1",
              cleans: true,
              workerStatus: "ACTIVE",
              availableForFullInterval: true,
            },
            {
              workerId: "escort-1",
              cleans: false,
              workerStatus: "ACTIVE",
              availableForFullInterval: false,
            },
          ],
        }),
      ],
    });

    expect(result.availableUnits).toBe(0);
    expect(result.teams[0]?.blockers).toContain("TEAM_MEMBER_UNAVAILABLE");
  });

  it("does not let an incomplete Team block another complete Team", () => {
    const result = evaluateCompleteTeamCapacity({
      maxSimultaneousTeams: 3,
      teams: [
        team({ teamId: "incomplete", members: [] }),
        team({ teamId: "complete" }),
      ],
    });

    expect(result.availableUnits).toBe(1);
    expect(result.teams).toEqual([
      {
        teamId: "incomplete",
        completeAvailable: false,
        blockers: ["TEAM_HAS_NO_CURRENT_MEMBERS", "TEAM_HAS_NO_CLEANER"],
      },
      { teamId: "complete", completeAvailable: true, blockers: [] },
    ]);
  });

  it("validates configured simultaneous-Team limits", () => {
    expect(validateMaxSimultaneousTeams(1)).toBeNull();
    expect(validateMaxSimultaneousTeams(50)).toBeNull();
    expect(validateMaxSimultaneousTeams(0)).toBe(
      "MAX_SIMULTANEOUS_TEAMS_OUT_OF_RANGE",
    );
    expect(validateMaxSimultaneousTeams(51)).toBe(
      "MAX_SIMULTANEOUS_TEAMS_OUT_OF_RANGE",
    );
    expect(validateMaxSimultaneousTeams(1.5)).toBe(
      "MAX_SIMULTANEOUS_TEAMS_OUT_OF_RANGE",
    );
  });
});

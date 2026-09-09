import {
  evaluateCapacityAfterCrewFilter,
  evaluateCrewPreferenceRule,
  matchingCapacityAfterCrewFilter,
  matchesCrewPreference,
  teamIndividuallyQualifies,
  type CrewCapacityTeamFacts,
} from "#modules/eligibility/eligibility.crew-capacity";

function team(
  overrides: Partial<CrewCapacityTeamFacts> & { readonly teamId: string },
): CrewCapacityTeamFacts {
  return {
    structurallyValid: overrides.structurallyValid ?? true,
    membersAvailableForWholeInterval:
      overrides.membersAvailableForWholeInterval ?? true,
    cleanerGenderCounts: overrides.cleanerGenderCounts ?? {
      male: 2,
      female: 0,
      otherOrUnspecified: 0,
    },
    escortFacts: overrides.escortFacts ?? {
      escortRequired: false,
      escortPresentAndValid: true,
      escortsAvailableForWholeInterval: true,
    },
    teamId: overrides.teamId,
  };
}

describe("crew preference + capacity (Batch D / SC-002)", () => {
  it("applies gender preference only to cleaner aggregates (escort ignored)", () => {
    const withFemaleEscortOnly = team({
      teamId: "t1",
      cleanerGenderCounts: { male: 2, female: 0, otherOrUnspecified: 0 },
      escortFacts: {
        escortRequired: true,
        escortPresentAndValid: true,
        escortsAvailableForWholeInterval: true,
      },
    });
    expect(matchesCrewPreference("all_male", withFemaleEscortOnly.cleanerGenderCounts)).toBe(
      true,
    );
    expect(matchesCrewPreference("all_female", withFemaleEscortOnly.cleanerGenderCounts)).toBe(
      false,
    );
    expect(matchesCrewPreference("any", withFemaleEscortOnly.cleanerGenderCounts)).toBe(true);
  });

  it("does not emit CREW_PREFERENCE_MISMATCH from escort fields", () => {
    const outcome = evaluateCrewPreferenceRule({
      preference: "all_male",
      team: team({
        teamId: "t1",
        cleanerGenderCounts: { male: 1, female: 0, otherOrUnspecified: 0 },
        escortFacts: {
          escortRequired: false,
          escortPresentAndValid: true,
          escortsAvailableForWholeInterval: true,
        },
      }),
    });
    expect(outcome.status).toBe("PASS");
    expect(outcome.reasons).toEqual([]);
  });

  it("fails crew preference when cleaners mix genders", () => {
    const outcome = evaluateCrewPreferenceRule({
      preference: "all_female",
      team: team({
        teamId: "t1",
        cleanerGenderCounts: { male: 1, female: 1, otherOrUnspecified: 0 },
      }),
    });
    expect(outcome).toMatchObject({
      status: "FAIL",
      reasons: ["CREW_PREFERENCE_MISMATCH"],
    });
  });

  it("skips crew preference when Team validity/availability prerequisites fail", () => {
    const outcome = evaluateCrewPreferenceRule({
      preference: "any",
      team: team({
        teamId: "t1",
        structurallyValid: false,
      }),
    });
    expect(outcome.status).toBe("NOT_EVALUATED");
    expect(outcome.dependencyRuleId).toBe("COMPLETE_TEAM_VALIDITY_AVAILABILITY");
  });

  it("counts capacity after crew filter capped by simultaneous limit (SC-002)", () => {
    const teams = [
      team({
        teamId: "t-male",
        cleanerGenderCounts: { male: 2, female: 0, otherOrUnspecified: 0 },
      }),
      team({
        teamId: "t-female",
        cleanerGenderCounts: { male: 0, female: 2, otherOrUnspecified: 0 },
      }),
      team({
        teamId: "t-invalid",
        structurallyValid: false,
        cleanerGenderCounts: { male: 2, female: 0, otherOrUnspecified: 0 },
      }),
    ];
    expect(
      matchingCapacityAfterCrewFilter({
        preference: "all_male",
        teams,
        simultaneousTeamLimit: 5,
      }),
    ).toBe(1);
    expect(
      matchingCapacityAfterCrewFilter({
        preference: "all_male",
        teams,
        simultaneousTeamLimit: 1,
      }),
    ).toBe(1);

    const capacity = evaluateCapacityAfterCrewFilter({
      preference: "all_male",
      teams,
      simultaneousTeamLimit: 5,
      requiredTeamUnits: 2,
      crewPreferenceEvaluated: true,
    });
    expect(capacity.status).toBe("FAIL");
    expect(capacity.reasons).toEqual(["INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER"]);
    expect(capacity.matchingCapacityUnits).toBe(1);
  });

  it("treats escort-not-required Teams as individually qualifying when cleaners match", () => {
    expect(
      teamIndividuallyQualifies({
        preference: "any",
        team: team({
          teamId: "t1",
          escortFacts: {
            escortRequired: false,
            escortPresentAndValid: true,
            escortsAvailableForWholeInterval: true,
          },
        }),
      }),
    ).toBe(true);
  });
});

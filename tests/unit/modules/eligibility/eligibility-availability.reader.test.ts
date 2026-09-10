/**
 * Eligibility availability reader unit coverage (Batch G).
 */

import { ProviderAvailabilityError } from "#modules/providers/domain/provider-availability.errors";
import type { ProviderCapacityEvaluationFacts } from "#modules/providers/domain/provider-availability.ports";
import {
  EligibilityAvailabilityReaderService,
  mapTeamAvailabilityFacts,
} from "#modules/providers/eligibility-availability.reader";
import { R1_P11_TIMES } from "../../../helpers/r1-p11-eligibility-fixtures.js";

function baseFacts(
  overrides: Partial<ProviderCapacityEvaluationFacts> = {},
): ProviderCapacityEvaluationFacts {
  return {
    providerId: "p1",
    providerCountryId: "c1",
    operationalStatus: "LIVE",
    pause: null,
    capacityRule: { maxSimultaneousTeams: 2 },
    providerWeeklyPeriods: [],
    providerExceptions: [],
    teams: [
      {
        teamId: "t1",
        status: "ACTIVE",
        members: [
          {
            workerId: "w1",
            workerType: "CLEANER",
            workerStatus: "ACTIVE",
            cleans: true,
            gender: "female",
            weeklyPeriods: [],
            exceptions: [],
          },
        ],
      },
    ],
    ...overrides,
  } as ProviderCapacityEvaluationFacts;
}

describe("mapTeamAvailabilityFacts", () => {
  it("aggregates cleaner genders and vacuous escort facts without Worker IDs", () => {
    const mapped = mapTeamAvailabilityFacts({
      facts: baseFacts(),
      timeZone: null,
      intervalStart: new Date(R1_P11_TIMES.startsAt),
      intervalEnd: new Date(R1_P11_TIMES.endsAt),
      teams: baseFacts().teams,
    });
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      teamId: "t1",
      structurallyValid: true,
      membersAvailableForWholeInterval: false,
      cleanerGenderCounts: { male: 0, female: 1, otherOrUnspecified: 0 },
      escortFacts: {
        escortRequired: false,
        escortPresentAndValid: true,
        escortsAvailableForWholeInterval: true,
      },
    });
    expect(JSON.stringify(mapped)).not.toMatch(/workerId/u);
  });
});

describe("EligibilityAvailabilityReaderService", () => {
  it("returns empty discovery when locality ancestry is inactive", async () => {
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCandidateProviderIdsForActiveTextualArea: vi.fn(),
          } as never,
          localityReader: {
            findCityById: vi.fn().mockResolvedValue({
              id: "city",
              countryId: "other",
              isActive: true,
              countryActive: true,
            }),
            findDistrictById: vi.fn(),
          } as never,
          countryTimeZoneReader: {} as never,
        }),
    });
    await expect(
      reader.discoverProviderIds({
        countryId: "c1",
        cityId: "city",
        limit: 10,
      }),
    ).resolves.toEqual({ status: "OK", providerIds: [] });
  });

  it("returns OVERFLOW when candidate Provider IDs exceed the limit", async () => {
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCandidateProviderIdsForActiveTextualArea: vi
              .fn()
              .mockResolvedValue(["p1", "p2", "p3"]),
          } as never,
          localityReader: {
            findCityById: vi.fn().mockResolvedValue({
              id: "city",
              countryId: "c1",
              isActive: true,
              countryActive: true,
            }),
            listActiveDistrictIdsForCity: vi.fn().mockResolvedValue(["d1"]),
            findDistrictById: vi.fn(),
          } as never,
          countryTimeZoneReader: {} as never,
        }),
    });
    await expect(
      reader.discoverProviderIds({
        countryId: "c1",
        cityId: "city",
        limit: 2,
      }),
    ).resolves.toEqual({ status: "OVERFLOW" });
  });

  it("returns MISSING_CONFIGURATION when capacity facts are absent", async () => {
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCapacityEvaluationFacts: vi.fn().mockResolvedValue(null),
          } as never,
          localityReader: {} as never,
          countryTimeZoneReader: {} as never,
        }),
    });
    await expect(
      reader.getAvailabilityFacts({
        providerId: "p1",
        startsAt: R1_P11_TIMES.startsAt,
        endsAt: R1_P11_TIMES.endsAt,
        countryId: "c1",
        cityId: "city",
        remainingTeamBudget: 5,
      }),
    ).resolves.toMatchObject({
      status: "MISSING_CONFIGURATION",
      providerId: "p1",
      missingConfiguration: ["COVERAGE", "PROVIDER_SCHEDULE", "CAPACITY_RULE"],
      simultaneousTeamLimit: null,
      teams: [],
    });
  });

  it("rejects invalid interval and team budget inputs", async () => {
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: vi.fn(),
    });
    await expect(
      reader.getAvailabilityFacts({
        providerId: "p1",
        startsAt: R1_P11_TIMES.endsAt,
        endsAt: R1_P11_TIMES.startsAt,
        countryId: "c1",
        cityId: "city",
        remainingTeamBudget: 1,
      }),
    ).rejects.toBeInstanceOf(ProviderAvailabilityError);

    await expect(
      reader.getAvailabilityFacts({
        providerId: "p1",
        startsAt: R1_P11_TIMES.startsAt,
        endsAt: R1_P11_TIMES.endsAt,
        countryId: "c1",
        cityId: "city",
        remainingTeamBudget: -1,
      }),
    ).rejects.toBeInstanceOf(ProviderAvailabilityError);
  });

  it("returns OVERFLOW when Team count exceeds remainingTeamBudget", async () => {
    const facts = baseFacts({
      teams: [
        {
          teamId: "t-b",
          status: "ACTIVE",
          members: [
            {
              workerId: "w2",
              workerType: "CLEANER",
              workerStatus: "ACTIVE",
              cleans: true,
              gender: "male",
              weeklyPeriods: [],
              exceptions: [],
            },
          ],
        },
        {
          teamId: "t-a",
          status: "ACTIVE",
          members: [
            {
              workerId: "w1",
              workerType: "CLEANER",
              workerStatus: "ACTIVE",
              cleans: true,
              gender: "female",
              weeklyPeriods: [],
              exceptions: [],
            },
          ],
        },
      ],
    } as never);
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCapacityEvaluationFacts: vi.fn().mockResolvedValue(facts),
            findConfigurationByProviderId: vi.fn().mockResolvedValue({
              coverage: [{ type: "CITY", cityId: "city", districtId: null }],
              weeklyPeriods: [{ weekday: 1, startMinute: 0, endMinute: 1440 }],
            }),
          } as never,
          localityReader: {
            findCityById: vi.fn().mockResolvedValue({
              id: "city",
              countryId: "c1",
              isActive: true,
              countryActive: true,
            }),
            listActiveDistrictIdsForCity: vi.fn().mockResolvedValue([]),
          } as never,
          countryTimeZoneReader: {
            getTimeZoneForCountry: vi.fn().mockResolvedValue("Africa/Cairo"),
          } as never,
        }),
    });
    const result = await reader.getAvailabilityFacts({
      providerId: "p1",
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      countryId: "c1",
      cityId: "city",
      remainingTeamBudget: 1,
    });
    expect(result.status).toBe("OVERFLOW");
    if (result.status === "OVERFLOW") {
      expect(result.acceptedTeams.map((team) => team.teamId)).toEqual(["t-a"]);
    }
  });

  it("returns OK discovery with Provider IDs under the limit", async () => {
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCandidateProviderIdsForActiveTextualArea: vi
              .fn()
              .mockResolvedValue(["p2", "p1"]),
          } as never,
          localityReader: {
            findCityById: vi.fn().mockResolvedValue({
              id: "city",
              countryId: "c1",
              isActive: true,
              countryActive: true,
            }),
            listActiveDistrictIdsForCity: vi.fn().mockResolvedValue(["d1"]),
            findDistrictById: vi.fn(),
          } as never,
          countryTimeZoneReader: {} as never,
        }),
    });
    await expect(
      reader.discoverProviderIds({
        countryId: "c1",
        cityId: "city",
        limit: 10,
      }),
    ).resolves.toEqual({ status: "OK", providerIds: ["p2", "p1"] });
  });

  it("discovers via district ancestry and rejects inactive districts", async () => {
    const activeReader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCandidateProviderIdsForActiveTextualArea: vi
              .fn()
              .mockResolvedValue(["p1"]),
          } as never,
          localityReader: {
            findDistrictById: vi.fn().mockResolvedValue({
              id: "d1",
              cityId: "city",
              countryId: "c1",
              isActive: true,
              cityActive: true,
              countryActive: true,
            }),
            findCityById: vi.fn(),
            listActiveDistrictIdsForCity: vi.fn(),
          } as never,
          countryTimeZoneReader: {} as never,
        }),
    });
    await expect(
      activeReader.discoverProviderIds({
        countryId: "c1",
        cityId: "city",
        districtId: "d1",
        limit: 5,
      }),
    ).resolves.toEqual({ status: "OK", providerIds: ["p1"] });

    const inactiveReader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCandidateProviderIdsForActiveTextualArea: vi.fn(),
          } as never,
          localityReader: {
            findDistrictById: vi.fn().mockResolvedValue(null),
            findCityById: vi.fn(),
            listActiveDistrictIdsForCity: vi.fn(),
          } as never,
          countryTimeZoneReader: {} as never,
        }),
    });
    await expect(
      inactiveReader.discoverProviderIds({
        countryId: "c1",
        cityId: "city",
        districtId: "missing",
        limit: 5,
      }),
    ).resolves.toEqual({ status: "OK", providerIds: [] });
  });

  it("returns AVAILABLE_FACTS when coverage/schedule/capacity are complete", async () => {
    const facts = baseFacts({
      providerWeeklyPeriods: [
        { weekday: 2, startMinute: 0, endMinute: 1440 },
      ],
      teams: [
        {
          teamId: "t1",
          status: "ACTIVE",
          members: [
            {
              workerId: "w1",
              workerType: "CLEANER",
              workerStatus: "ACTIVE",
              cleans: true,
              gender: "female",
              weeklyPeriods: [
                { weekday: 2, startMinute: 0, endMinute: 1440 },
              ],
              exceptions: [],
            },
            {
              workerId: "e1",
              workerType: "ESCORT",
              workerStatus: "ACTIVE",
              cleans: false,
              gender: "male",
              weeklyPeriods: [
                { weekday: 2, startMinute: 0, endMinute: 1440 },
              ],
              exceptions: [],
            },
          ],
        },
      ],
    } as never);
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCapacityEvaluationFacts: vi.fn().mockResolvedValue(facts),
            findConfigurationByProviderId: vi.fn().mockResolvedValue({
              coverage: [{ type: "CITY", cityId: "city", districtId: null }],
              weeklyPeriods: [
                { weekday: 2, startMinute: 0, endMinute: 1440 },
              ],
            }),
          } as never,
          localityReader: {
            findCityById: vi.fn().mockResolvedValue({
              id: "city",
              countryId: "c1",
              isActive: true,
              countryActive: true,
            }),
            listActiveDistrictIdsForCity: vi.fn().mockResolvedValue([]),
          } as never,
          countryTimeZoneReader: {
            getTimeZoneForCountry: vi.fn().mockResolvedValue("Africa/Cairo"),
          } as never,
        }),
    });
    const result = await reader.getAvailabilityFacts({
      providerId: "p1",
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      countryId: "c1",
      cityId: "city",
      remainingTeamBudget: 5,
    });
    expect(result).toMatchObject({
      status: "AVAILABLE_FACTS",
      providerId: "p1",
      coverageMatch: true,
      providerScheduleAvailable: true,
      simultaneousTeamLimit: 2,
    });
    if (result.status === "AVAILABLE_FACTS") {
      expect(result.teams[0]?.membersAvailableForWholeInterval).toBe(true);
      expect(result.teams[0]?.escortFacts.escortPresentAndValid).toBe(true);
    }
  });

  it("preserves readable facts on CAPACITY_RULE-only MISSING_CONFIGURATION", async () => {
    const facts = baseFacts({
      capacityRule: null,
      providerWeeklyPeriods: [
        { weekday: 2, startMinute: 0, endMinute: 1440 },
      ],
      teams: [
        {
          teamId: "t1",
          status: "ACTIVE",
          members: [
            {
              workerId: "w1",
              workerType: "CLEANER",
              workerStatus: "ACTIVE",
              cleans: true,
              gender: "other_or_unspecified",
              weeklyPeriods: [
                { weekday: 2, startMinute: 0, endMinute: 1440 },
              ],
              exceptions: [],
            },
          ],
        },
      ],
    } as never);
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCapacityEvaluationFacts: vi.fn().mockResolvedValue(facts),
            findConfigurationByProviderId: vi.fn().mockResolvedValue({
              coverage: [{ type: "CITY", cityId: "city", districtId: null }],
              weeklyPeriods: [
                { weekday: 2, startMinute: 0, endMinute: 1440 },
              ],
            }),
          } as never,
          localityReader: {
            findCityById: vi.fn().mockResolvedValue({
              id: "city",
              countryId: "c1",
              isActive: true,
              countryActive: true,
            }),
            listActiveDistrictIdsForCity: vi.fn().mockResolvedValue([]),
          } as never,
          countryTimeZoneReader: {
            getTimeZoneForCountry: vi.fn().mockResolvedValue("Africa/Cairo"),
          } as never,
        }),
    });
    const result = await reader.getAvailabilityFacts({
      providerId: "p1",
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      countryId: "c1",
      cityId: "city",
      remainingTeamBudget: 5,
    });
    expect(result).toMatchObject({
      status: "MISSING_CONFIGURATION",
      missingConfiguration: ["CAPACITY_RULE"],
      coverageMatch: true,
      providerScheduleAvailable: true,
      simultaneousTeamLimit: null,
    });
    if (result.status === "MISSING_CONFIGURATION") {
      expect(result.teams).toHaveLength(1);
      expect(result.teams[0]?.cleanerGenderCounts.otherOrUnspecified).toBe(1);
    }
  });

  it("matches district coverage and flags suspended Providers", async () => {
    const facts = baseFacts({
      operationalStatus: "SUSPENDED",
      providerWeeklyPeriods: [
        { weekday: 2, startMinute: 0, endMinute: 1440 },
      ],
    } as never);
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCapacityEvaluationFacts: vi.fn().mockResolvedValue(facts),
            findConfigurationByProviderId: vi.fn().mockResolvedValue({
              coverage: [
                { type: "DISTRICT", cityId: "city", districtId: "d1" },
              ],
              weeklyPeriods: [
                { weekday: 2, startMinute: 0, endMinute: 1440 },
              ],
            }),
          } as never,
          localityReader: {
            findDistrictById: vi.fn().mockResolvedValue({
              id: "d1",
              cityId: "city",
              countryId: "c1",
              isActive: true,
              cityActive: true,
              countryActive: true,
            }),
            findCityById: vi.fn(),
            listActiveDistrictIdsForCity: vi.fn(),
          } as never,
          countryTimeZoneReader: {
            getTimeZoneForCountry: vi.fn().mockResolvedValue("Africa/Cairo"),
          } as never,
        }),
    });
    const result = await reader.getAvailabilityFacts({
      providerId: "p1",
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      countryId: "c1",
      cityId: "city",
      districtId: "d1",
      remainingTeamBudget: 5,
    });
    expect(result).toMatchObject({
      status: "AVAILABLE_FACTS",
      coverageMatch: true,
      suspended: true,
      paused: false,
    });
  });

  it("emits pause without fabricating PROVIDER_SUSPENDED facts", async () => {
    const facts = baseFacts({
      operationalStatus: "LIVE",
      pause: {
        id: "pause-1",
        providerId: "p1",
        startedAt: new Date("2026-09-15T07:00:00.000Z"),
        endsAt: new Date("2026-09-15T12:00:00.000Z"),
        resumedAt: null,
        actorUserId: "actor-1",
        version: 1,
        createdAt: new Date("2026-09-15T07:00:00.000Z"),
        updatedAt: new Date("2026-09-15T07:00:00.000Z"),
      },
      providerWeeklyPeriods: [
        { weekday: 2, startMinute: 0, endMinute: 1440 },
      ],
    } as never);
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCapacityEvaluationFacts: vi.fn().mockResolvedValue(facts),
            findConfigurationByProviderId: vi.fn().mockResolvedValue({
              coverage: [{ type: "CITY", cityId: "city", districtId: null }],
              weeklyPeriods: [
                { weekday: 2, startMinute: 0, endMinute: 1440 },
              ],
            }),
          } as never,
          localityReader: {
            findCityById: vi.fn().mockResolvedValue({
              id: "city",
              countryId: "c1",
              isActive: true,
              countryActive: true,
            }),
            listActiveDistrictIdsForCity: vi.fn().mockResolvedValue([]),
          } as never,
          countryTimeZoneReader: {
            getTimeZoneForCountry: vi.fn().mockResolvedValue("Africa/Cairo"),
          } as never,
        }),
    });
    const result = await reader.getAvailabilityFacts({
      providerId: "p1",
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      countryId: "c1",
      cityId: "city",
      remainingTeamBudget: 5,
    });
    expect(result).toMatchObject({
      status: "AVAILABLE_FACTS",
      paused: true,
      suspended: false,
    });
  });

  it("passes remainingTeamBudget into the repository before hydration", async () => {
    const findCapacityEvaluationFacts = vi.fn().mockResolvedValue({
      ...baseFacts(),
      teamBudgetExceeded: true,
      teams: [{ teamId: "t-a", status: "ACTIVE", members: [] }],
    });
    const reader = new EligibilityAvailabilityReaderService({
      runInReadTransaction: async (work) =>
        work({
          repository: {
            findCapacityEvaluationFacts,
            findConfigurationByProviderId: vi.fn(),
          } as never,
          localityReader: {} as never,
          countryTimeZoneReader: {} as never,
        }),
    });
    const result = await reader.getAvailabilityFacts({
      providerId: "p1",
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      countryId: "c1",
      cityId: "city",
      remainingTeamBudget: 0,
    });
    expect(findCapacityEvaluationFacts).toHaveBeenCalledWith("p1", {
      remainingTeamBudget: 0,
    });
    expect(result.status).toBe("OVERFLOW");
  });
});

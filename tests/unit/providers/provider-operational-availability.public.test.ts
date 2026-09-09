import {
  createProviderOperationalAvailabilityReader,
  type ProviderOperationalAvailabilityEvaluation,
} from "../../../src/modules/providers/providers.public.js";
import { ProviderOperationalAvailabilityService } from "../../../src/modules/providers/provider-operational-availability.service.js";
import type {
  ProviderAvailabilityCountryTimeZoneReader,
  ProviderAvailabilityLocalityReader,
  ProviderOperationalAvailabilityRepository,
} from "../../../src/modules/providers/domain/provider-availability.ports.js";

const MONDAY_0800_TO_1000_CAIRO = {
  startsAt: "2027-01-04T06:00:00.000Z",
  endsAt: "2027-01-04T08:00:00.000Z",
};

function fakeLocalityReader(): ProviderAvailabilityLocalityReader {
  return {
    findCityById: vi.fn(async (cityId) => ({
      id: cityId,
      countryId: "country-eg",
      isActive: true,
      countryActive: true,
    })),
    findDistrictById: vi.fn(async (districtId) => ({
      id: districtId,
      cityId: "city-cairo",
      countryId: "country-eg",
      isActive: true,
      cityActive: true,
      countryActive: true,
    })),
    listActiveDistrictIdsForCity: vi.fn(async () => ["district-nasr"]),
  };
}

function fakeCountryTimeZoneReader(): ProviderAvailabilityCountryTimeZoneReader {
  return {
    getTimeZoneForCountry: vi.fn(async () => "Africa/Cairo"),
  };
}

function fakeRepository(): ProviderOperationalAvailabilityRepository {
  const capacityFacts = {
    providerId: "provider-1",
    applicationStatus: "APPROVED" as const,
    providerCountryId: "country-eg",
    workforceStateVersion: 13,
    operationalStatus: "LIVE" as const,
    pause: null,
    capacityRule: {
      id: "capacity-1",
      providerId: "provider-1",
      maxSimultaneousTeams: 2,
      version: 4,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    },
    providerWeeklyPeriods: [
      {
        id: "provider-period-1",
        weekday: 1 as const,
        startMinute: 480,
        endMinute: 720,
        endsNextDay: false,
      },
    ],
    providerExceptions: [],
    teams: [
      {
        teamId: "team-1",
        teamVersion: 7,
        status: "ACTIVE" as const,
        members: [
          {
            workerId: "worker-1",
            workerVersion: 9,
            cleans: true,
            workerStatus: "ACTIVE" as const,
            weeklyPeriods: [
              {
                id: "worker-period-1",
                weekday: 1 as const,
                startMinute: 480,
                endMinute: 720,
                endsNextDay: false,
              },
            ],
            exceptions: [],
          },
        ],
      },
    ],
  };

  return {
    findConfigurationByProviderId: vi.fn(async () => ({
      id: "config-1",
      providerId: "provider-1",
      version: 3,
      coverage: [
        {
          id: "coverage-1",
          type: "DISTRICT" as const,
          cityId: null,
          districtId: "district-nasr",
        },
      ],
      weeklyPeriods: capacityFacts.providerWeeklyPeriods,
      exceptions: [],
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    })),
    findCapacityEvaluationFacts: vi.fn(async () => capacityFacts),
    findCandidateProviderIdsForActiveTextualArea: vi.fn(async () => [
      "provider-1",
    ]),
  } as unknown as ProviderOperationalAvailabilityRepository;
}

describe("Provider operational availability public reader (T057)", () => {
  it("exports only the narrow candidate/evaluation methods", async () => {
    const reader = createProviderOperationalAvailabilityReader({
      findCandidateProviderIdsForActiveTextualArea: vi.fn(async () => [
        "provider-1",
      ]),
      evaluateOneProviderOperationalAvailability: vi.fn(async () => null),
    });

    expect(Object.keys(reader).sort()).toEqual([
      "evaluateOneProviderOperationalAvailability",
      "findCandidateProviderIdsForActiveTextualArea",
    ]);
    await expect(
      reader.findCandidateProviderIdsForActiveTextualArea({
        countryId: "country-eg",
        cityId: "city-cairo",
      }),
    ).resolves.toEqual(["provider-1"]);
  });

  it("returns contact-free operational facts using transaction-bound readers", async () => {
    const repository = fakeRepository();
    const localityReader = fakeLocalityReader();
    const countryTimeZoneReader = fakeCountryTimeZoneReader();
    const service = new ProviderOperationalAvailabilityService({
      runInReadTransaction: async (work) =>
        work({ repository, localityReader, countryTimeZoneReader }),
    });

    await expect(
      service.findCandidateProviderIdsForActiveTextualArea({
        countryId: "country-eg",
        cityId: "city-cairo",
        districtId: "district-nasr",
      }),
    ).resolves.toEqual(["provider-1"]);

    const result =
      await service.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: MONDAY_0800_TO_1000_CAIRO,
        requiredCompleteTeamUnits: 1,
      });

    expect(result).toMatchObject({
      providerId: "provider-1",
      timeZone: "Africa/Cairo",
      coverageMatch: {
        matched: true,
        countryId: "country-eg",
        cityId: "city-cairo",
        districtId: "district-nasr",
        matchedBy: "DISTRICT",
      },
      availability: {
        available: true,
        runtimeAvailable: true,
        providerScheduleAvailable: true,
      },
      capacity: {
        availableUnits: 1,
        requiredCompleteTeamUnits: 1,
        sufficient: true,
      },
      blockerCodes: [],
      versions: { availability: 3, workforce: 13, capacity: 4 },
    } satisfies Partial<ProviderOperationalAvailabilityEvaluation>);
    expect(localityReader.findDistrictById).toHaveBeenCalledWith(
      "district-nasr",
    );
    expect(countryTimeZoneReader.getTimeZoneForCountry).toHaveBeenCalledWith(
      "country-eg",
    );

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "email",
      "phone",
      "fullLegalName",
      "worker-1",
      "teamResults",
      "settings",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

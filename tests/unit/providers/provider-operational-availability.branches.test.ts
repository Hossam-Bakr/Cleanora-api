import { ProviderOperationalAvailabilityService } from "../../../src/modules/providers/provider-operational-availability.service.js";
import type {
  ProviderAvailabilityCountryTimeZoneReader,
  ProviderAvailabilityLocalityReader,
  ProviderCapacityEvaluationFacts,
  ProviderOperationalAvailabilityRepository,
} from "../../../src/modules/providers/domain/provider-availability.ports.js";

const INTERVAL = {
  startsAt: "2027-01-04T06:00:00.000Z",
  endsAt: "2027-01-04T08:00:00.000Z",
};

function locality(overrides?: {
  readonly cityActive?: boolean;
  readonly districtActive?: boolean;
  readonly countryActive?: boolean;
}): ProviderAvailabilityLocalityReader {
  return {
    findCityById: vi.fn(async (cityId) => ({
      id: cityId,
      countryId: "country-eg",
      isActive: overrides?.cityActive ?? true,
      countryActive: overrides?.countryActive ?? true,
    })),
    findDistrictById: vi.fn(async (districtId) => ({
      id: districtId,
      cityId: "city-cairo",
      countryId: "country-eg",
      isActive: overrides?.districtActive ?? true,
      cityActive: overrides?.cityActive ?? true,
      countryActive: overrides?.countryActive ?? true,
    })),
    listActiveDistrictIdsForCity: vi.fn(async () => ["district-nasr"]),
  };
}

function zoneReader(
  timeZone: string | null = "Africa/Cairo",
): ProviderAvailabilityCountryTimeZoneReader {
  return {
    getTimeZoneForCountry: vi.fn(async () => timeZone),
  };
}

function baseFacts(
  overrides: Partial<ProviderCapacityEvaluationFacts> = {},
): ProviderCapacityEvaluationFacts {
  return {
    providerId: "provider-1",
    applicationStatus: "APPROVED",
    providerCountryId: "country-eg",
    workforceStateVersion: 13,
    operationalStatus: "LIVE",
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
        weekday: 1,
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
        status: "ACTIVE",
        members: [
          {
            workerId: "worker-1",
            workerVersion: 9,
            cleans: true,
            workerStatus: "ACTIVE",
            gender: "female",
            workerType: "CLEANING_STAFF",
            weeklyPeriods: [
              {
                id: "worker-period-1",
                weekday: 1,
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
    ...overrides,
  };
}

function repository(
  facts: ProviderCapacityEvaluationFacts | null,
  coverage: "district" | "city" | "empty" = "district",
): ProviderOperationalAvailabilityRepository {
  const coverageRows =
    coverage === "empty"
      ? []
      : coverage === "city"
        ? [
            {
              id: "coverage-1",
              type: "CITY" as const,
              cityId: "city-cairo",
              districtId: null,
            },
          ]
        : [
            {
              id: "coverage-1",
              type: "DISTRICT" as const,
              cityId: null,
              districtId: "district-nasr",
            },
          ];
  return {
    findConfigurationByProviderId: vi.fn(async () =>
      facts === null
        ? null
        : {
            id: "config-1",
            providerId: "provider-1",
            version: 3,
            coverage: coverageRows,
            weeklyPeriods: facts.providerWeeklyPeriods,
            exceptions: facts.providerExceptions,
            createdAt: new Date("2026-09-07T00:00:00.000Z"),
            updatedAt: new Date("2026-09-07T00:00:00.000Z"),
          },
    ),
    findCapacityEvaluationFacts: vi.fn(async () => facts),
    findCandidateProviderIdsForActiveTextualArea: vi.fn(async () => [
      "provider-1",
    ]),
  } as unknown as ProviderOperationalAvailabilityRepository;
}

function service(
  repo: ProviderOperationalAvailabilityRepository,
  localityReader = locality(),
  countryTimeZoneReader = zoneReader(),
) {
  return new ProviderOperationalAvailabilityService({
    runInReadTransaction: async (work) =>
      work({ repository: repo, localityReader, countryTimeZoneReader }),
  });
}

describe("Provider operational availability service branch coverage", () => {
  it("rejects invalid evaluation intervals and required units", async () => {
    const svc = service(repository(baseFacts()));
    await expect(
      svc.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: {
          startsAt: "not-utc",
          endsAt: INTERVAL.endsAt,
        },
        requiredCompleteTeamUnits: 1,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VALIDATION_FAILED" });

    await expect(
      svc.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: {
          startsAt: INTERVAL.endsAt,
          endsAt: INTERVAL.startsAt,
        },
        requiredCompleteTeamUnits: 1,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VALIDATION_FAILED" });

    await expect(
      svc.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 0,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VALIDATION_FAILED" });
  });

  it("returns null for missing or unapproved providers", async () => {
    const missing = service(repository(null));
    await expect(
      missing.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toBeNull();

    const draft = service(
      repository(baseFacts({ applicationStatus: "DRAFT" as never })),
    );
    await expect(
      draft.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toBeNull();
  });

  it("reports inactive locality, suspension, pause, and missing capacity rule blockers", async () => {
    const inactive = service(
      repository(baseFacts()),
      locality({ districtActive: false }),
    );
    await expect(
      inactive.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({
      coverageMatch: { matched: false },
      blockerCodes: expect.arrayContaining(["TEXTUAL_AREA_INACTIVE_OR_MISMATCH"]),
    });

    const suspended = service(
      repository(baseFacts({ operationalStatus: "SUSPENDED" })),
    );
    await expect(
      suspended.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({
      availability: { runtimeAvailable: false },
      blockerCodes: expect.arrayContaining(["SUSPENDED"]),
    });

    const paused = service(
      repository(
        baseFacts({
          pause: {
            id: "pause-1",
            providerId: "provider-1",
            startedAt: new Date("2027-01-04T00:00:00.000Z"),
            endsAt: new Date("2027-01-05T00:00:00.000Z"),
            resumedAt: null,
            actorUserId: "owner-1",
            version: 1,
            createdAt: new Date("2026-09-07T00:00:00.000Z"),
            updatedAt: new Date("2026-09-07T00:00:00.000Z"),
          },
        }),
      ),
    );
    await expect(
      paused.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({
      availability: { runtimeAvailable: false },
      blockerCodes: expect.arrayContaining(["PAUSE"]),
    });

    const noRule = service(repository(baseFacts({ capacityRule: null })));
    await expect(
      noRule.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({
      capacity: { availableUnits: 0, sufficient: false },
      blockerCodes: expect.arrayContaining(["CAPACITY_RULE_MISSING"]),
    });
  });

  it("matches whole-city coverage and skips candidates for inactive areas", async () => {
    const cityCoverage = service(repository(baseFacts(), "city"));
    await expect(
      cityCoverage.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({
      coverageMatch: { matched: true, matchedBy: "CITY" },
    });

    const inactiveCity = service(
      repository(baseFacts(), "empty"),
      locality({ cityActive: false }),
    );
    await expect(
      inactiveCity.findCandidateProviderIdsForActiveTextualArea({
        countryId: "country-eg",
        cityId: "city-cairo",
      }),
    ).resolves.toEqual([]);
  });

  it("does not promote a district selection to whole-city coverage", async () => {
    const repo = repository(baseFacts(), "district");
    const svc = service(repo);

    await expect(
      svc.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({
      coverageMatch: { matched: false, matchedBy: null },
      blockerCodes: expect.arrayContaining(["PROVIDER_COVERAGE_MISMATCH"]),
    });

    await expect(
      svc.findCandidateProviderIdsForActiveTextualArea({
        countryId: "country-eg",
        cityId: "city-cairo",
      }),
    ).resolves.toEqual(["provider-1"]);
    expect(repo.findCandidateProviderIdsForActiveTextualArea).toHaveBeenCalledWith({
      countryId: "country-eg",
      cityId: "city-cairo",
      districtIds: [],
    });
  });

  it("rejects stale coverage from a different Provider country", async () => {
    const svc = service(
      repository(baseFacts({ providerCountryId: "country-other" }), "city"),
    );

    await expect(
      svc.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({
      coverageMatch: { matched: false },
      blockerCodes: expect.arrayContaining(["PROVIDER_COVERAGE_MISMATCH"]),
    });
    await expect(
      svc.getProviderAvailabilityReadiness("provider-1"),
    ).resolves.toMatchObject({ coverageReady: { satisfied: false } });
  });

  it("publishes the Provider workforce aggregate version", async () => {
    const svc = service(
      repository(
        baseFacts({
          workforceStateVersion: 23,
          teams: [
            {
              ...baseFacts().teams[0]!,
              teamVersion: 99,
            },
          ],
        }),
      ),
    );

    await expect(
      svc.evaluateOneProviderOperationalAvailability({
        providerId: "provider-1",
        location: {
          countryId: "country-eg",
          cityId: "city-cairo",
          districtId: "district-nasr",
        },
        utcInterval: INTERVAL,
        requiredCompleteTeamUnits: 1,
      }),
    ).resolves.toMatchObject({ versions: { workforce: 23 } });
  });

  it("exposes readiness blockers when configuration is incomplete", async () => {
    const empty = service(repository(baseFacts(), "empty"));
    await expect(
      empty.getProviderAvailabilityReadiness("provider-1"),
    ).resolves.toMatchObject({
      coverageReady: { satisfied: false },
    });

    const missing = service(repository(null));
    await expect(
      missing.getProviderAvailabilityReadiness("provider-1"),
    ).resolves.toBeNull();
  });
});

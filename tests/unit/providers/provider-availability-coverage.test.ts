import {
  decideProviderAvailabilityManagementAuthorization,
  matchesProviderCoverage,
  validateCoverageSelections,
  type ProviderAvailabilityManagementFacts,
} from "../../../src/modules/providers/domain/provider-availability.policy.js";
import { ProviderAvailabilityError } from "../../../src/modules/providers/domain/provider-availability.errors.js";
import { ProviderAvailabilityService } from "../../../src/modules/providers/provider-availability.service.js";
import type {
  ProviderAvailabilityAuthorizationReader,
  ProviderAvailabilityLocalityReader,
  ProviderAvailabilityRepository,
} from "../../../src/modules/providers/domain/provider-availability.ports.js";
import type { ProviderAvailabilityConfigurationSnapshot } from "../../../src/modules/providers/domain/provider-availability.types.js";

describe("Coverage selection validation (pure policy)", () => {
  it("rejects an empty selection list", () => {
    expect(validateCoverageSelections([])).toBe("EMPTY_SELECTION_LIST");
  });

  it("rejects duplicate selections", () => {
    expect(
      validateCoverageSelections([
        { type: "CITY", id: "city-1" },
        { type: "CITY", id: "city-1" },
      ]),
    ).toBe("DUPLICATE_SELECTION");
  });

  it("accepts a valid mixed selection list", () => {
    expect(
      validateCoverageSelections([
        { type: "CITY", id: "city-1" },
        { type: "DISTRICT", id: "district-9" },
      ]),
    ).toBeNull();
  });
});

describe("Coverage matching (DEC-056: whole-city, active-district, inactive-ancestry)", () => {
  it("matches an exact active district selection", () => {
    expect(
      matchesProviderCoverage(
        { coverageCityIds: [], coverageDistrictIds: ["district-1"] },
        {
          districtId: "district-1",
          cityId: "city-1",
          districtActive: true,
          cityActive: true,
          countryActive: true,
        },
      ),
    ).toBe(true);
  });

  it("matches any active district under a whole-city selection, including new districts", () => {
    expect(
      matchesProviderCoverage(
        { coverageCityIds: ["city-1"], coverageDistrictIds: [] },
        {
          districtId: "district-new",
          cityId: "city-1",
          districtActive: true,
          cityActive: true,
          countryActive: true,
        },
      ),
    ).toBe(true);
  });

  it("does not match when the city ancestry is inactive", () => {
    expect(
      matchesProviderCoverage(
        { coverageCityIds: ["city-1"], coverageDistrictIds: ["district-1"] },
        {
          districtId: "district-1",
          cityId: "city-1",
          districtActive: true,
          cityActive: false,
          countryActive: true,
        },
      ),
    ).toBe(false);
  });

  it("does not match when the district itself is inactive", () => {
    expect(
      matchesProviderCoverage(
        { coverageCityIds: ["city-1"], coverageDistrictIds: [] },
        {
          districtId: "district-1",
          cityId: "city-1",
          districtActive: false,
          cityActive: true,
          countryActive: true,
        },
      ),
    ).toBe(false);
  });

  it("does not match when the country ancestry is inactive", () => {
    expect(
      matchesProviderCoverage(
        { coverageCityIds: ["city-1"], coverageDistrictIds: ["district-1"] },
        {
          districtId: "district-1",
          cityId: "city-1",
          districtActive: true,
          cityActive: true,
          countryActive: false,
        },
      ),
    ).toBe(false);
  });

  it("does not match an unrelated city", () => {
    expect(
      matchesProviderCoverage(
        { coverageCityIds: ["city-2"], coverageDistrictIds: [] },
        {
          districtId: "district-1",
          cityId: "city-1",
          districtActive: true,
          cityActive: true,
          countryActive: true,
        },
      ),
    ).toBe(false);
  });
});

describe("decideProviderAvailabilityManagementAuthorization (DEC-058, repair item 1)", () => {
  const baseFacts: ProviderAvailabilityManagementFacts = {
    actorActive: true,
    providerAdminEnabled: false,
    providerApproved: true,
    sameProvider: true,
    membershipActive: true,
    managementLevel: "OWNER",
  };

  it("allows an active, exact-scope Owner without an enabled Provider Admin capability", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        managementLevel: "OWNER",
        providerAdminEnabled: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies an active, exact-scope Admin without an enabled Provider Admin capability", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        managementLevel: "ADMIN",
        providerAdminEnabled: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_AVAILABILITY_POLICY_FORBIDDEN",
    });
  });

  it("allows an active, exact-scope Admin with an enabled Provider Admin capability", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        managementLevel: "ADMIN",
        providerAdminEnabled: true,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies an inactive identity even for an Owner", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        actorActive: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_AVAILABILITY_POLICY_FORBIDDEN",
    });
  });

  it("denies an inactive membership non-enumerating (NOT_FOUND, not FORBIDDEN)", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        membershipActive: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND",
    });
  });

  it("denies a non-manager (e.g. Worker/Supervisor) membership non-enumerating", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        managementLevel: null,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND",
    });
  });

  it("denies wrong Provider membership non-enumerating", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        sameProvider: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND",
    });
  });

  it("denies an unapproved Provider with a state-invalid code", () => {
    expect(
      decideProviderAvailabilityManagementAuthorization({
        ...baseFacts,
        providerApproved: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_AVAILABILITY_POLICY_PROVIDER_STATE_INVALID",
    });
  });
});

function fakeAuthReader(
  overrides: Partial<ProviderAvailabilityAuthorizationReader> = {},
): ProviderAvailabilityAuthorizationReader {
  return {
    async resolveAuthorityFacts() {
      return {
        actorActive: true,
        providerAdminEnabled: true,
        providerApproved: true,
        sameProvider: true,
        membershipActive: true,
        managementLevel: "OWNER",
        providerCountryId: "country-1",
        operationalStatus: "LIVE",
      };
    },
    ...overrides,
  };
}

function fakeLocalityReader(
  overrides: Partial<ProviderAvailabilityLocalityReader> = {},
): ProviderAvailabilityLocalityReader {
  return {
    async findCityById(cityId) {
      return {
        id: cityId,
        countryId: "country-1",
        isActive: true,
        countryActive: true,
      };
    },
    async findDistrictById(districtId) {
      return {
        id: districtId,
        cityId: "city-1",
        countryId: "country-1",
        isActive: true,
        cityActive: true,
        countryActive: true,
      };
    },
    async listActiveDistrictIdsForCity() {
      return [];
    },
    ...overrides,
  };
}

function fakeRepository(
  overrides: Partial<ProviderAvailabilityRepository> = {},
): ProviderAvailabilityRepository {
  const store = new Map<
    string,
    {
      status: "IN_PROGRESS" | "ACCEPTED";
      fingerprint: string;
      actorUserId: string;
      safeResultJson: unknown;
    }
  >();
  return {
    async findConfigurationByProviderId() {
      return null;
    },
    async reserveOrReplayCoverageCommand(input) {
      const key = `${input.providerId}:${input.idempotencyKey}`;
      const existing = store.get(key);
      if (existing !== undefined) {
        // Repair item 4: a different actor presenting the same
        // resource-scoped key is a stable conflict, never a replay of
        // another actor's safe result.
        if (
          existing.fingerprint !== input.requestFingerprint ||
          existing.actorUserId !== input.actorUserId
        ) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT",
          );
        }
        if (existing.status !== "ACCEPTED") {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_COMMAND_IN_PROGRESS",
          );
        }
        return { status: "REPLAYED", safeResultJson: existing.safeResultJson };
      }
      store.set(key, {
        status: "IN_PROGRESS",
        fingerprint: input.requestFingerprint,
        actorUserId: input.actorUserId,
        safeResultJson: null,
      });
      return { status: "PROCEED" };
    },
    async completeCoverageCommand(input) {
      const key = `${input.providerId}:${input.idempotencyKey}`;
      const existing = store.get(key);
      store.set(key, {
        status: "ACCEPTED",
        fingerprint: existing?.fingerprint ?? "",
        actorUserId: existing?.actorUserId ?? "",
        safeResultJson: input.safeResultJson,
      });
    },
    async replaceCoverage(input): Promise<ProviderAvailabilityConfigurationSnapshot> {
      return {
        id: "config-1",
        providerId: input.providerId,
        version: input.expectedVersion + 1,
        coverage: input.selections.map((s, index) => ({
          id: `area-${index}`,
          type: s.type,
          cityId: s.type === "CITY" ? s.id : null,
          districtId: s.type === "DISTRICT" ? s.id : null,
        })),
        weeklyPeriods: [],
        exceptions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async appendCoverageHistory() {
      // no-op
    },
    async reserveOrReplayCalendarCommand() {
      return { status: "PROCEED" };
    },
    async completeCalendarCommand() {
      // no-op
    },
    async replaceCalendar(input): Promise<ProviderAvailabilityConfigurationSnapshot> {
      return {
        id: "config-1",
        providerId: input.providerId,
        version: input.expectedVersion + 1,
        coverage: [],
        weeklyPeriods: input.weeklyPeriods.map((period, index) => ({
          id: `schedule-${index}`,
          ...period,
        })),
        exceptions: input.exceptions.map((exception, index) => ({
          id: `exception-${index}`,
          localDate: exception.localDate,
          closed: exception.closed,
          startMinute: exception.closed ? null : (exception.startMinute ?? null),
          endMinute: exception.closed ? null : (exception.endMinute ?? null),
          endsNextDay: exception.closed ? null : (exception.endsNextDay ?? false),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async appendCalendarHistory() {
      // no-op
    },
    async findCurrentPause() {
      return null;
    },
    async findPauseRuntimeFacts() {
      return {
        operationalStatus: "LIVE",
        pause: null,
      };
    },
    async reserveOrReplayPauseCommand() {
      return { status: "PROCEED" };
    },
    async completePauseCommand() {
      // no-op
    },
    async startPause() {
      throw new Error("startPause not stubbed for this test");
    },
    async resumePause() {
      throw new Error("resumePause not stubbed for this test");
    },
    async appendPauseHistory() {
      // no-op
    },
    ...overrides,
  };
}

function buildService(overrides: {
  readonly authReader?: ProviderAvailabilityAuthorizationReader;
  readonly localityReader?: ProviderAvailabilityLocalityReader;
  readonly repository?: ProviderAvailabilityRepository;
  /**
   * Repair item 2 seam test hook: when provided, called once per
   * transaction with the exact `localityReader` instance the service used,
   * proving there is no outer/shared reader.
   */
  readonly onTransactionLocalityReader?: (
    reader: ProviderAvailabilityLocalityReader,
  ) => void;
} = {}): ProviderAvailabilityService {
  const authReader = overrides.authReader ?? fakeAuthReader();
  const localityReader = overrides.localityReader ?? fakeLocalityReader();
  const repository = overrides.repository ?? fakeRepository();
  const combinedRepository = { ...repository, ...authReader } as never;
  const work = (transactionWork: (context: {
    readonly repository: never;
    readonly localityReader: ProviderAvailabilityLocalityReader;
  }) => unknown) => {
    overrides.onTransactionLocalityReader?.(localityReader);
    return transactionWork({ repository: combinedRepository, localityReader });
  };
  return new ProviderAvailabilityService({
    runInWriteTransaction: (transactionWork) => work(transactionWork) as never,
    runInReadTransaction: (transactionWork) => work(transactionWork) as never,
  });
}

describe("ProviderAvailabilityService.replaceCoverage (R1-P10 Batch A)", () => {
  it("denies non-manager actors (fail-closed, non-enumerating)", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return {
            actorActive: true,
            providerAdminEnabled: true,
            providerApproved: true,
            sameProvider: true,
            membershipActive: false,
            managementLevel: null,
            providerCountryId: "country-1",
            operationalStatus: "LIVE",
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "11111111-1111-1111-1111-111111111111",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_NOT_FOUND" });
  });

  it("replaces coverage successfully for an active OWNER", async () => {
    const service = buildService();
    const result = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey: "11111111-1111-1111-1111-111111111111",
      },
    );
    expect(result.replayed).toBe(false);
    expect(result.coverage.coverage).toEqual([{ type: "CITY", id: "city-1" }]);
  });

  it("replays an idempotent coverage-replace request", async () => {
    let calls = 0;
    const repository = fakeRepository({
      async replaceCoverage(input) {
        calls += 1;
        return {
          id: "config-1",
          providerId: input.providerId,
          version: input.expectedVersion + 1,
          coverage: [],
          weeklyPeriods: [],
          exceptions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    });
    const service = buildService({ repository });
    const idempotencyKey = "22222222-2222-2222-2222-222222222222";
    const first = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "DISTRICT", id: "district-1" }],
        expectedVersion: 0,
        idempotencyKey,
      },
    );
    const second = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "DISTRICT", id: "district-1" }],
        expectedVersion: 0,
        idempotencyKey,
      },
    );
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(calls).toBe(1);
  });

  it("rejects coverage referencing an unknown city", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findCityById() {
          return null;
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "missing-city" }],
          expectedVersion: 0,
          idempotencyKey: "33333333-3333-3333-3333-333333333333",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_COVERAGE_INVALID" });
  });

  it("surfaces a version conflict from the repository", async () => {
    const repository = fakeRepository({
      async replaceCoverage() {
        return "VERSION_CONFLICT" as const;
      },
    });
    const service = buildService({ repository });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 5,
          idempotencyKey: "44444444-4444-4444-4444-444444444444",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VERSION_CONFLICT" });
  });
});

describe("ProviderAvailabilityService.replaceCoverage authorization facts (repair item 2)", () => {
  const baseFacts = {
    actorActive: true,
    providerAdminEnabled: true,
    providerApproved: true,
    sameProvider: true,
    membershipActive: true,
    managementLevel: "OWNER" as const,
    providerCountryId: "country-1",
    operationalStatus: "LIVE" as const,
  };

  it("denies an inactive user (fail-closed)", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, actorActive: false };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "55555555-5555-5555-5555-555555555555",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_FORBIDDEN" });
  });

  it("denies an Admin (not Owner) with a disabled Provider Admin capability (DEC-058)", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, managementLevel: "ADMIN", providerAdminEnabled: false };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "66666666-6666-6666-6666-666666666666",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_FORBIDDEN" });
  });

  it("allows an Owner even with a disabled Provider Admin capability (DEC-058)", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, managementLevel: "OWNER", providerAdminEnabled: false };
        },
      }),
    });
    const result = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey: "67676767-6767-6767-6767-676767676767",
      },
    );
    expect(result.replayed).toBe(false);
  });

  it("denies wrong Provider membership non-enumerating (NOT_FOUND, not FORBIDDEN)", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, sameProvider: false };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "77777777-7777-7777-7777-777777777777",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_NOT_FOUND" });
  });

  it("denies a non-manager (MEMBER-level) active membership non-enumerating", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, managementLevel: null };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "88888888-8888-8888-8888-888888888888",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_NOT_FOUND" });
  });

  it("denies an unapproved Provider with a state-invalid error", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, providerApproved: false };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "99999999-9999-9999-9999-999999999999",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_PROVIDER_STATE_INVALID",
    });
  });

  it("allows an active ADMIN just as it allows an active OWNER", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, managementLevel: "ADMIN" };
        },
      }),
    });
    const result = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
    );
    expect(result.replayed).toBe(false);
  });
});

describe("ProviderAvailabilityService.replaceCoverage country enforcement (repair item 3)", () => {
  it("rejects a city outside the Provider's own country", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findCityById(cityId) {
          return {
            id: cityId,
            countryId: "country-OTHER",
            isActive: true,
            countryActive: true,
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
    });
  });

  it("rejects a district outside the Provider's own country", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findDistrictById(districtId) {
          return {
            id: districtId,
            cityId: "city-1",
            countryId: "country-OTHER",
            isActive: true,
            cityActive: true,
            countryActive: true,
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "DISTRICT", id: "district-1" }],
          expectedVersion: 0,
          idempotencyKey: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
    });
  });

  it("rejects coverage entirely when the Provider has no configured country", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return {
            actorActive: true,
            providerAdminEnabled: true,
            providerApproved: true,
            sameProvider: true,
            membershipActive: true,
            managementLevel: "OWNER",
            providerCountryId: null,
            operationalStatus: "LIVE",
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
    });
  });

  it("accepts coverage that matches the Provider's own country exactly", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return {
            actorActive: true,
            providerAdminEnabled: true,
            providerApproved: true,
            sameProvider: true,
            membershipActive: true,
            managementLevel: "OWNER",
            providerCountryId: "country-EG",
            operationalStatus: "LIVE",
          };
        },
      }),
      localityReader: fakeLocalityReader({
        async findCityById(cityId) {
          return {
            id: cityId,
            countryId: "country-EG",
            isActive: true,
            countryActive: true,
          };
        },
      }),
    });
    const result = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      },
    );
    expect(result.replayed).toBe(false);
  });

  it("rejects an inactive selected city as invalid coverage", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findCityById(cityId) {
          return {
            id: cityId,
            countryId: "country-1",
            isActive: false,
            countryActive: true,
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
    });
  });

  it("rejects a selected city whose country ancestry is inactive", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findCityById(cityId) {
          return {
            id: cityId,
            countryId: "country-1",
            isActive: true,
            countryActive: false,
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
    });
  });

  it("rejects an inactive selected district as invalid coverage", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findDistrictById(districtId) {
          return {
            id: districtId,
            cityId: "city-1",
            countryId: "country-1",
            isActive: false,
            cityActive: true,
            countryActive: true,
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "DISTRICT", id: "district-1" }],
          expectedVersion: 0,
          idempotencyKey: "e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
    });
  });

  it("rejects a selected district whose city ancestry is inactive", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findDistrictById(districtId) {
          return {
            id: districtId,
            cityId: "city-1",
            countryId: "country-1",
            isActive: true,
            cityActive: false,
            countryActive: true,
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "DISTRICT", id: "district-1" }],
          expectedVersion: 0,
          idempotencyKey: "e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
    });
  });

  it("rejects a selected district whose country ancestry is inactive", async () => {
    const service = buildService({
      localityReader: fakeLocalityReader({
        async findDistrictById(districtId) {
          return {
            id: districtId,
            cityId: "city-1",
            countryId: "country-1",
            isActive: true,
            cityActive: true,
            countryActive: false,
          };
        },
      }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "DISTRICT", id: "district-1" }],
          expectedVersion: 0,
          idempotencyKey: "e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5",
        },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
    });
  });
});

describe("ProviderAvailabilityService.replaceCoverage idempotency (repair item 4)", () => {
  it("raises a stable idempotency-conflict error when the same key is reused with different input", async () => {
    const service = buildService();
    const idempotencyKey = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey,
      },
    );
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "DISTRICT", id: "district-1" }],
          expectedVersion: 0,
          idempotencyKey,
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
  });

  it("fingerprints expectedVersion, so the same selections at a different version are not conflated", async () => {
    const repository = fakeRepository();
    const service = buildService({ repository });
    const idempotencyKey = "10101010-1010-1010-1010-101010101010";
    await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey,
      },
    );
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 1,
          idempotencyKey,
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
  });

  it("does not treat an in-progress (unaccepted) receipt as a successful replay", async () => {
    const repository = fakeRepository({
      async reserveOrReplayCoverageCommand() {
        return { status: "PROCEED" as const };
      },
      async completeCoverageCommand() {
        // Simulate a crash after reservation but before completion: never called.
      },
    });
    const authReader = fakeAuthReader();
    const inProgressRepository: ProviderAvailabilityRepository = {
      ...repository,
      async reserveOrReplayCoverageCommand(input) {
        void input;
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_COMMAND_IN_PROGRESS",
        );
      },
    };
    const localityReader = fakeLocalityReader();
    const service = new ProviderAvailabilityService({
      runInWriteTransaction: (work) =>
        work({
          repository: { ...inProgressRepository, ...authReader } as never,
          localityReader,
        }),
      runInReadTransaction: (work) =>
        work({
          repository: { ...inProgressRepository, ...authReader } as never,
          localityReader,
        }),
    });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "20202020-2020-2020-2020-202020202020",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_COMMAND_IN_PROGRESS" });
  });

  it("treats a REPLAYED receipt with a missing safe result as a dependency failure, not a success", async () => {
    const repository = fakeRepository({
      async reserveOrReplayCoverageCommand() {
        return { status: "REPLAYED" as const, safeResultJson: undefined };
      },
    });
    const service = buildService({ repository });
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey: "30303030-3030-3030-3030-303030303030",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED" });
  });

  it("allows an active Owner without an enabled Provider Admin capability (DEC-058, repair item 1)", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return {
            actorActive: true,
            providerAdminEnabled: false,
            providerApproved: true,
            sameProvider: true,
            membershipActive: true,
            managementLevel: "OWNER",
            providerCountryId: "country-1",
            operationalStatus: "LIVE",
          };
        },
      }),
    });
    const result = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey: "40404040-4040-4040-4040-404040404040",
      },
    );
    expect(result.replayed).toBe(false);
  });

  it("raises a stable conflict when the same key is reused with a different expectedVersion (repair item 4)", async () => {
    const service = buildService();
    const idempotencyKey = "50505050-5050-5050-5050-505050505050";
    await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      { selections: [{ type: "CITY", id: "city-1" }], expectedVersion: 0, idempotencyKey },
    );
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        { selections: [{ type: "CITY", id: "city-1" }], expectedVersion: 1, idempotencyKey },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
  });

  it("raises a stable conflict when the same key is reused with a different reasonCode (repair item 4)", async () => {
    const service = buildService();
    const idempotencyKey = "60606060-6060-6060-6060-606060606060";
    await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey,
        reasonCode: "reason_a",
      },
    );
    await expect(
      service.replaceCoverage(
        { actorUserId: "user-1" },
        "provider-1",
        {
          selections: [{ type: "CITY", id: "city-1" }],
          expectedVersion: 0,
          idempotencyKey,
          reasonCode: "reason_b",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
  });

  it("raises a stable conflict when a different actor reuses the same resource-scoped key (repair item 4)", async () => {
    const repository = fakeRepository();
    const service = buildService({ repository });
    const idempotencyKey = "70707070-7070-7070-7070-707070707070";
    await service.replaceCoverage(
      { actorUserId: "owner-user" },
      "provider-1",
      { selections: [{ type: "CITY", id: "city-1" }], expectedVersion: 0, idempotencyKey },
    );
    await expect(
      service.replaceCoverage(
        { actorUserId: "different-user" },
        "provider-1",
        { selections: [{ type: "CITY", id: "city-1" }], expectedVersion: 0, idempotencyKey },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
  });

  it("appends exactly one history event across an original request and its replay", async () => {
    let historyCalls = 0;
    const repository = fakeRepository({
      async appendCoverageHistory() {
        historyCalls += 1;
      },
    });
    const service = buildService({ repository });
    const idempotencyKey = "80808080-8080-8080-8080-808080808080";
    const first = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      { selections: [{ type: "CITY", id: "city-1" }], expectedVersion: 0, idempotencyKey },
    );
    expect(first.replayed).toBe(false);
    const second = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      { selections: [{ type: "CITY", id: "city-1" }], expectedVersion: 0, idempotencyKey },
    );
    expect(second.replayed).toBe(true);
    expect(historyCalls).toBe(1);
  });

  it("replays an accepted coverage command before mutable locality validation", async () => {
    let localityActive = true;
    let cityLookups = 0;
    let replaceCalls = 0;
    let historyCalls = 0;
    const repository = fakeRepository({
      async replaceCoverage(input) {
        replaceCalls += 1;
        return {
          id: "config-1",
          providerId: input.providerId,
          version: input.expectedVersion + 1,
          coverage: input.selections.map((s, index) => ({
            id: `area-${index}`,
            type: s.type,
            cityId: s.type === "CITY" ? s.id : null,
            districtId: s.type === "DISTRICT" ? s.id : null,
          })),
          weeklyPeriods: [],
          exceptions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async appendCoverageHistory() {
        historyCalls += 1;
      },
    });
    const service = buildService({
      repository,
      localityReader: fakeLocalityReader({
        async findCityById(cityId) {
          cityLookups += 1;
          return {
            id: cityId,
            countryId: "country-1",
            isActive: localityActive,
            countryActive: localityActive,
          };
        },
      }),
    });
    const idempotencyKey = "81818181-8181-8181-8181-818181818181";
    const body = {
      selections: [{ type: "CITY", id: "city-1" }],
      expectedVersion: 0,
      idempotencyKey,
    } as const;

    const first = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      body,
    );
    localityActive = false;
    const second = await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      body,
    );

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(cityLookups).toBe(1);
    expect(replaceCalls).toBe(1);
    expect(historyCalls).toBe(1);
  });
});

describe("ProviderAvailabilityService transaction seam (repair item 2)", () => {
  it("uses only the callback-provided, transaction-bound locality reader for coverage validation (no outer reader)", async () => {
    let usedReaders = 0;
    const distinctiveLocalityReader: ProviderAvailabilityLocalityReader = {
      ...fakeLocalityReader(),
      async findCityById(cityId) {
        usedReaders += 1;
        return {
          id: cityId,
          countryId: "country-1",
          isActive: true,
          countryActive: true,
        };
      },
    };
    const service = buildService({
      localityReader: distinctiveLocalityReader,
      onTransactionLocalityReader: (reader) => {
        expect(reader).toBe(distinctiveLocalityReader);
      },
    });
    await service.replaceCoverage(
      { actorUserId: "user-1" },
      "provider-1",
      {
        selections: [{ type: "CITY", id: "city-1" }],
        expectedVersion: 0,
        idempotencyKey: "90909090-9090-9090-9090-909090909090",
      },
    );
    expect(usedReaders).toBeGreaterThan(0);
  });

  it("uses the callback-provided locality reader for matchesDistrict reads too", async () => {
    let calledForMatch = false;
    const distinctiveLocalityReader: ProviderAvailabilityLocalityReader = {
      ...fakeLocalityReader(),
      async findDistrictById(districtId) {
        calledForMatch = true;
        return {
          id: districtId,
          cityId: "city-1",
          countryId: "country-1",
          isActive: true,
          cityActive: true,
          countryActive: true,
        };
      },
    };
    const authReader = fakeAuthReader();
    const repository = fakeRepository({
      async findConfigurationByProviderId() {
        return {
          id: "config-1",
          providerId: "provider-1",
          version: 1,
          coverage: [{ id: "area-1", type: "DISTRICT", cityId: null, districtId: "district-1" }],
          weeklyPeriods: [],
          exceptions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    });
    const service = new ProviderAvailabilityService({
      runInWriteTransaction: (work) =>
        work({
          repository: { ...repository, ...authReader } as never,
          localityReader: distinctiveLocalityReader,
        }),
      runInReadTransaction: (work) =>
        work({
          repository: { ...repository, ...authReader } as never,
          localityReader: distinctiveLocalityReader,
        }),
    });
    await service.matchesDistrict("provider-1", "district-1");
    expect(calledForMatch).toBe(true);
  });
});

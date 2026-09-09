import { ProviderAvailabilityError } from "../../../src/modules/providers/domain/provider-availability.errors.js";
import type {
  ProviderAvailabilityAuthorizationReader,
  ProviderAvailabilityLocalityReader,
  ProviderAvailabilityRepository,
} from "../../../src/modules/providers/domain/provider-availability.ports.js";
import type {
  ProviderAvailabilityConfigurationSnapshot,
} from "../../../src/modules/providers/domain/provider-availability.types.js";
import { ProviderAvailabilityService } from "../../../src/modules/providers/provider-availability.service.js";

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

const inertLocalityReader: ProviderAvailabilityLocalityReader = {
  async findCityById() {
    return null;
  },
  async findDistrictById() {
    return null;
  },
  async listActiveDistrictIdsForCity() {
    return [];
  },
};

function fakeAuthReader(
  overrides: Partial<ProviderAvailabilityAuthorizationReader> = {},
): ProviderAvailabilityAuthorizationReader {
  return {
    async resolveAuthorityFacts() {
      return baseFacts;
    },
    ...overrides,
  };
}

function snapshot(
  providerId: string,
  version: number,
  calendar: Pick<
    ProviderAvailabilityConfigurationSnapshot,
    "weeklyPeriods" | "exceptions"
  >,
): ProviderAvailabilityConfigurationSnapshot {
  return {
    id: "config-1",
    providerId,
    version,
    coverage: [],
    weeklyPeriods: calendar.weeklyPeriods,
    exceptions: calendar.exceptions,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function fakeRepository(
  overrides: Partial<ProviderAvailabilityRepository> = {},
): ProviderAvailabilityRepository {
  let current = snapshot("provider-1", 0, { weeklyPeriods: [], exceptions: [] });
  const receipts = new Map<
    string,
    {
      status: "IN_PROGRESS" | "ACCEPTED";
      fingerprint: string;
      actorUserId: string;
      safeResultJson: unknown;
    }
  >();

  return {
    async findConfigurationByProviderId(providerId) {
      return current.providerId === providerId && current.version > 0 ? current : null;
    },
    async reserveOrReplayCoverageCommand() {
      return { status: "PROCEED" };
    },
    async completeCoverageCommand() {
      // no-op
    },
    async replaceCoverage(input) {
      current = {
        ...current,
        providerId: input.providerId,
        version: input.expectedVersion + 1,
        coverage: input.selections.map((selection, index) => ({
          id: `coverage-${index}`,
          type: selection.type,
          cityId: selection.type === "CITY" ? selection.id : null,
          districtId: selection.type === "DISTRICT" ? selection.id : null,
        })),
      };
      return current;
    },
    async appendCoverageHistory() {
      // no-op
    },
    async reserveOrReplayCalendarCommand(input) {
      const key = `${input.providerId}:${input.idempotencyKey}`;
      const existing = receipts.get(key);
      if (existing !== undefined) {
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

      receipts.set(key, {
        status: "IN_PROGRESS",
        fingerprint: input.requestFingerprint,
        actorUserId: input.actorUserId,
        safeResultJson: null,
      });
      return { status: "PROCEED" };
    },
    async completeCalendarCommand(input) {
      const key = `${input.providerId}:${input.idempotencyKey}`;
      const existing = receipts.get(key);
      receipts.set(key, {
        status: "ACCEPTED",
        fingerprint: existing?.fingerprint ?? "",
        actorUserId: existing?.actorUserId ?? "",
        safeResultJson: input.safeResultJson,
      });
    },
    async replaceCalendar(input) {
      if (current.version !== input.expectedVersion) {
        return "VERSION_CONFLICT" as const;
      }
      current = snapshot(input.providerId, input.expectedVersion + 1, {
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
      });
      return current;
    },
    async appendCalendarHistory() {
      // no-op
    },
    async findCurrentPause() {
      return null;
    },
    async findPauseRuntimeFacts() {
      return {
        operationalStatus: "LIVE" as const,
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
  readonly repository?: ProviderAvailabilityRepository;
} = {}): ProviderAvailabilityService {
  const authReader = overrides.authReader ?? fakeAuthReader();
  const repository = overrides.repository ?? fakeRepository();
  const combinedRepository = { ...repository, ...authReader } as never;
  const work = (transactionWork: (context: {
    readonly repository: never;
    readonly localityReader: ProviderAvailabilityLocalityReader;
  }) => unknown) =>
    transactionWork({
      repository: combinedRepository,
      localityReader: inertLocalityReader,
    });

  return new ProviderAvailabilityService({
    runInWriteTransaction: (transactionWork) => work(transactionWork) as never,
    runInReadTransaction: (transactionWork) => work(transactionWork) as never,
  });
}

describe("ProviderAvailabilityService.replaceCalendar (R1-P10 Provider schedules)", () => {
  it("allows an active exact-scope Owner without a provider_admin capability", async () => {
    const service = buildService({
      authReader: fakeAuthReader({
        async resolveAuthorityFacts() {
          return { ...baseFacts, providerAdminEnabled: false };
        },
      }),
    });

    const result = await service.replaceCalendar(
      { actorUserId: "owner-1" },
      "provider-1",
      {
        weeklyPeriods: [
          { weekday: 1, startMinute: 480, endMinute: 1_020, endsNextDay: false },
        ],
        exceptions: [],
        expectedVersion: 0,
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      },
    );

    expect(result.replayed).toBe(false);
    expect(result.calendar.version).toBe(1);
    expect(result.calendar.weeklyPeriods).toEqual([
      { weekday: 1, startMinute: 480, endMinute: 1_020, endsNextDay: false },
    ]);
  });

  it("rejects overlapping weekly periods", async () => {
    const service = buildService();

    await expect(
      service.replaceCalendar(
        { actorUserId: "owner-1" },
        "provider-1",
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
            { weekday: 1, startMinute: 719, endMinute: 1_020, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: 0,
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_SCHEDULE_INVALID" });
  });

  it("accepts overnight carryover adjacent to the next weekday", async () => {
    const service = buildService();

    const result = await service.replaceCalendar(
      { actorUserId: "owner-1" },
      "provider-1",
      {
        weeklyPeriods: [
          { weekday: 1, startMinute: 1_320, endMinute: 120, endsNextDay: true },
          { weekday: 2, startMinute: 120, endMinute: 300, endsNextDay: false },
        ],
        exceptions: [],
        expectedVersion: 0,
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      },
    );

    expect(result.calendar.weeklyPeriods).toEqual([
      { weekday: 1, startMinute: 1_320, endMinute: 120, endsNextDay: true },
      { weekday: 2, startMinute: 120, endMinute: 300, endsNextDay: false },
    ]);
  });

  it("replaces holidays and open exceptions with the weekly schedule in one version bump", async () => {
    let historyCalls = 0;
    const repository = fakeRepository({
      async appendCalendarHistory(input) {
        historyCalls += 1;
        expect(input.safeBefore).toEqual({ weeklyPeriods: [], exceptions: [] });
        expect(input.safeAfter.exceptions).toHaveLength(2);
      },
    });
    const service = buildService({ repository });

    const result = await service.replaceCalendar(
      { actorUserId: "owner-1", requestId: "request-1" },
      "provider-1",
      {
        weeklyPeriods: [
          { weekday: 5, startMinute: 540, endMinute: 900, endsNextDay: false },
        ],
        exceptions: [
          { localDate: "2026-01-06", closed: true },
          {
            localDate: "2026-01-07",
            closed: false,
            startMinute: 600,
            endMinute: 720,
            endsNextDay: false,
          },
        ],
        expectedVersion: 0,
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        reasonCode: "PROVIDER_SCHEDULE_UPDATE",
      },
    );

    expect(result.calendar.version).toBe(1);
    expect(result.calendar.exceptions).toEqual([
      {
        localDate: "2026-01-06",
        closed: true,
        startMinute: null,
        endMinute: null,
        endsNextDay: null,
      },
      {
        localDate: "2026-01-07",
        closed: false,
        startMinute: 600,
        endMinute: 720,
        endsNextDay: false,
      },
    ]);
    expect(historyCalls).toBe(1);
  });

  it("replays an accepted calendar replacement without mutating twice", async () => {
    let replaceCalls = 0;
    const repository = fakeRepository({
      async replaceCalendar(input) {
        replaceCalls += 1;
        return snapshot(input.providerId, input.expectedVersion + 1, {
          weeklyPeriods: input.weeklyPeriods.map((period, index) => ({
            id: `schedule-${index}`,
            ...period,
          })),
          exceptions: [],
        });
      },
    });
    const service = buildService({ repository });
    const command = {
      weeklyPeriods: [
        { weekday: 3 as const, startMinute: 480, endMinute: 960, endsNextDay: false },
      ],
      exceptions: [],
      expectedVersion: 0,
      idempotencyKey: "55555555-5555-4555-8555-555555555555",
    };

    const first = await service.replaceCalendar(
      { actorUserId: "owner-1" },
      "provider-1",
      command,
    );
    const second = await service.replaceCalendar(
      { actorUserId: "owner-1" },
      "provider-1",
      command,
    );

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.calendar).toEqual(first.calendar);
    expect(replaceCalls).toBe(1);
  });

  it("raises a stable conflict when another actor reuses the same idempotency key", async () => {
    const repository = fakeRepository();
    const service = buildService({ repository });
    const command = {
      weeklyPeriods: [
        { weekday: 4 as const, startMinute: 480, endMinute: 960, endsNextDay: false },
      ],
      exceptions: [],
      expectedVersion: 0,
      idempotencyKey: "66666666-6666-4666-8666-666666666666",
    };

    await service.replaceCalendar({ actorUserId: "owner-1" }, "provider-1", command);

    await expect(
      service.replaceCalendar({ actorUserId: "owner-2" }, "provider-1", command),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT",
    });
  });

  it("surfaces a version conflict from the repository", async () => {
    const service = buildService({
      repository: fakeRepository({
        async replaceCalendar() {
          return "VERSION_CONFLICT" as const;
        },
      }),
    });

    await expect(
      service.replaceCalendar(
        { actorUserId: "owner-1" },
        "provider-1",
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 960, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: 99,
          idempotencyKey: "77777777-7777-4777-8777-777777777777",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VERSION_CONFLICT" });
  });
});

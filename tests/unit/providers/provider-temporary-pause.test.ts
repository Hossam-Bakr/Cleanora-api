import { ProviderAvailabilityError } from "../../../src/modules/providers/domain/provider-availability.errors.js";
import type {
  ProviderAvailabilityAuthorizationReader,
  ProviderAvailabilityLocalityReader,
  ProviderAvailabilityRepository,
} from "../../../src/modules/providers/domain/provider-availability.ports.js";
import type {
  ProviderAvailabilityConfigurationSnapshot,
  ProviderTemporaryPauseSnapshot,
} from "../../../src/modules/providers/domain/provider-availability.types.js";
import {
  doesRequestedIntervalOverlapEffectivePause,
  isEffectivePauseAt,
  isProviderRuntimeUnavailable,
  validatePauseEndsAt,
} from "../../../src/modules/providers/domain/provider-temporary-pause.policy.js";
import { ProviderAvailabilityService } from "../../../src/modules/providers/provider-availability.service.js";

describe("provider-temporary-pause.policy (DEC-057)", () => {
  const startedAt = new Date("2026-06-01T10:00:00.000Z");
  const endsAt = new Date("2026-06-01T12:00:00.000Z");

  it("treats half-open [startedAt, endsAt) boundaries correctly", () => {
    const pause = { startedAt, endsAt, resumedAt: null };
    expect(isEffectivePauseAt(pause, new Date("2026-06-01T09:59:59.999Z"))).toBe(
      false,
    );
    expect(isEffectivePauseAt(pause, startedAt)).toBe(true);
    expect(isEffectivePauseAt(pause, new Date("2026-06-01T11:59:59.999Z"))).toBe(
      true,
    );
    expect(isEffectivePauseAt(pause, endsAt)).toBe(false);
  });

  it("keeps open-ended pauses effective until resumed", () => {
    const pause = { startedAt, endsAt: null, resumedAt: null };
    expect(isEffectivePauseAt(pause, new Date("2027-01-01T00:00:00.000Z"))).toBe(
      true,
    );
    expect(
      isEffectivePauseAt(
        { ...pause, resumedAt: new Date("2026-06-01T11:00:00.000Z") },
        new Date("2026-06-01T11:30:00.000Z"),
      ),
    ).toBe(false);
  });

  it("detects half-open evaluation interval overlap", () => {
    const pause = { startedAt, endsAt, resumedAt: null };
    expect(
      doesRequestedIntervalOverlapEffectivePause(
        pause,
        new Date("2026-06-01T11:00:00.000Z"),
        new Date("2026-06-01T13:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      doesRequestedIntervalOverlapEffectivePause(
        pause,
        endsAt,
        new Date("2026-06-01T13:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      doesRequestedIntervalOverlapEffectivePause(
        pause,
        new Date("2026-06-01T08:00:00.000Z"),
        startedAt,
      ),
    ).toBe(false);
  });

  it("rejects endsAt that is not strictly after startedAt", () => {
    expect(validatePauseEndsAt(startedAt, startedAt)).toBe(
      "ENDS_AT_NOT_AFTER_START",
    );
    expect(validatePauseEndsAt(startedAt, endsAt)).toBeNull();
    expect(validatePauseEndsAt(startedAt, null)).toBeNull();
  });

  it("marks suspended providers unavailable without needing a pause", () => {
    expect(
      isProviderRuntimeUnavailable({
        operationalStatus: "SUSPENDED",
        pause: null,
        at: startedAt,
      }),
    ).toBe(true);
  });
});

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

function emptyConfig(
  providerId: string,
  version: number,
): ProviderAvailabilityConfigurationSnapshot {
  return {
    id: "config-1",
    providerId,
    version,
    coverage: [{ id: "area-1", type: "CITY", cityId: "city-1", districtId: null }],
    weeklyPeriods: [
      {
        id: "schedule-1",
        weekday: 1,
        startMinute: 480,
        endMinute: 1_020,
        endsNextDay: false,
      },
    ],
    exceptions: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function fakePauseRepository(options?: {
  readonly operationalStatus?: "INACTIVE" | "LIVE" | "SUSPENDED";
}): ProviderAvailabilityRepository {
  let pause: ProviderTemporaryPauseSnapshot | null = null;
  const configuration = emptyConfig("provider-1", 1);
  const receipts = new Map<
    string,
    {
      status: "IN_PROGRESS" | "ACCEPTED";
      fingerprint: string;
      actorUserId: string;
      safeResultJson: unknown;
    }
  >();
  const operationalStatus = options?.operationalStatus ?? "LIVE";

  return {
    async findConfigurationByProviderId(providerId) {
      return configuration.providerId === providerId ? configuration : null;
    },
    async reserveOrReplayCoverageCommand() {
      return { status: "PROCEED" };
    },
    async completeCoverageCommand() {
      // no-op
    },
    async replaceCoverage() {
      throw new Error("replaceCoverage unused");
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
    async replaceCalendar() {
      throw new Error("replaceCalendar unused");
    },
    async appendCalendarHistory() {
      // no-op
    },
    async findCurrentPause(providerId) {
      return pause?.providerId === providerId ? pause : null;
    },
    async findPauseRuntimeFacts(providerId) {
      if (providerId !== "provider-1") {
        return null;
      }
      return { operationalStatus, pause };
    },
    async reserveOrReplayPauseCommand(input) {
      const key = `${input.scope}:${input.providerId}:${input.idempotencyKey}`;
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
    async completePauseCommand(input) {
      const key = `${input.scope}:${input.providerId}:${input.idempotencyKey}`;
      const existing = receipts.get(key);
      receipts.set(key, {
        status: "ACCEPTED",
        fingerprint: existing?.fingerprint ?? "",
        actorUserId: existing?.actorUserId ?? "",
        safeResultJson: input.safeResultJson,
      });
    },
    async startPause(input) {
      if (pause !== null && pause.resumedAt === null) {
        if (pause.endsAt === null || pause.endsAt.getTime() > input.startedAt.getTime()) {
          return "PAUSE_CONFLICT";
        }
        pause = {
          ...pause,
          resumedAt: pause.endsAt,
          version: pause.version + 1,
          updatedAt: input.startedAt,
        };
      }
      if (input.expectedVersion !== 0) {
        return "VERSION_CONFLICT";
      }
      pause = {
        id: "pause-1",
        providerId: input.providerId,
        startedAt: input.startedAt,
        endsAt: input.endsAt,
        resumedAt: null,
        actorUserId: input.actorUserId,
        version: 1,
        createdAt: input.startedAt,
        updatedAt: input.startedAt,
      };
      return pause;
    },
    async resumePause(input) {
      if (pause === null || pause.resumedAt !== null) {
        return "NOT_FOUND";
      }
      if (pause.version !== input.expectedVersion) {
        return "VERSION_CONFLICT";
      }
      pause = {
        ...pause,
        resumedAt: input.resumedAt,
        version: pause.version + 1,
        updatedAt: input.resumedAt,
      };
      return pause;
    },
    async appendPauseHistory() {
      // no-op
    },
  };
}

function buildService(overrides: {
  readonly authReader?: ProviderAvailabilityAuthorizationReader;
  readonly repository?: ProviderAvailabilityRepository;
} = {}): ProviderAvailabilityService {
  const authReader = overrides.authReader ?? fakeAuthReader();
  const repository = overrides.repository ?? fakePauseRepository();
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

describe("ProviderAvailabilityService temporary pause (DEC-057)", () => {
  it("allows an Owner to start an open-ended pause", async () => {
    const service = buildService();
    const result = await service.startPause(
      { actorUserId: "owner-1" },
      "provider-1",
      {
        expectedVersion: 0,
        idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    );

    expect(result.replayed).toBe(false);
    expect(result.pause.version).toBe(1);
    expect(result.pause.endsAt).toBeNull();
    expect(result.pause.effective).toBe(true);
    expect(result.pause.resumedAt).toBeNull();
  });

  it("rejects a second unresolved pause", async () => {
    const service = buildService();
    await service.startPause(
      { actorUserId: "owner-1" },
      "provider-1",
      {
        expectedVersion: 0,
        idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    );

    await expect(
      service.startPause(
        { actorUserId: "owner-1" },
        "provider-1",
        {
          expectedVersion: 0,
          idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_PAUSE_CONFLICT" });
  });

  it("resumes an unresolved pause early", async () => {
    const service = buildService();
    const started = await service.startPause(
      { actorUserId: "owner-1" },
      "provider-1",
      {
        expectedVersion: 0,
        idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      },
    );

    const resumed = await service.resumePause(
      { actorUserId: "owner-1" },
      "provider-1",
      {
        expectedVersion: started.pause.version,
        idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      },
    );

    expect(resumed.replayed).toBe(false);
    expect(resumed.pause.version).toBe(2);
    expect(resumed.pause.resumedAt).not.toBeNull();
    expect(resumed.pause.effective).toBe(false);
  });

  it("replays an accepted start command without creating a second pause", async () => {
    const service = buildService();
    const command = {
      expectedVersion: 0,
      idempotencyKey: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      endsAt: new Date("2099-01-01T00:00:00.000Z"),
    };

    const first = await service.startPause(
      { actorUserId: "owner-1" },
      "provider-1",
      command,
    );
    const replay = await service.startPause(
      { actorUserId: "owner-1" },
      "provider-1",
      command,
    );

    expect(replay.replayed).toBe(true);
    expect(replay.pause).toEqual(first.pause);
  });

  it("treats time expiry as ineffective without mutating the pause row", async () => {
    const repository = fakePauseRepository();
    const pastEnd = new Date("2020-01-01T12:00:00.000Z");
    await repository.startPause({
      providerId: "provider-1",
      startedAt: new Date("2020-01-01T10:00:00.000Z"),
      endsAt: pastEnd,
      expectedVersion: 0,
      actorUserId: "owner-1",
    });

    const service = buildService({ repository });
    const current = await service.getPause(
      { actorUserId: "owner-1" },
      "provider-1",
    );
    expect(current).not.toBeNull();
    expect(current?.effective).toBe(false);
    expect(current?.resumedAt).toBeNull();

    const blocker = await service.evaluateRuntimeBlocker("provider-1", {
      at: new Date("2020-01-01T13:00:00.000Z"),
    });
    expect(blocker.unavailable).toBe(false);
    expect(blocker.configurationUntouched).toBe(true);

    const stillUnresolved = await repository.findCurrentPause("provider-1");
    expect(stillUnresolved?.resumedAt).toBeNull();
  });

  it("materializes an expired pause before starting a later pause", async () => {
    const repository = fakePauseRepository();
    await repository.startPause({
      providerId: "provider-1",
      startedAt: new Date("2020-01-01T10:00:00.000Z"),
      endsAt: new Date("2020-01-01T12:00:00.000Z"),
      expectedVersion: 0,
      actorUserId: "owner-1",
    });
    const service = buildService({ repository });

    const restarted = await service.startPause(
      { actorUserId: "owner-1" },
      "provider-1",
      {
        expectedVersion: 0,
        idempotencyKey: "12121212-1212-4212-8212-121212121212",
      },
    );

    expect(restarted.pause.effective).toBe(true);
    expect(restarted.pause.resumedAt).toBeNull();
  });

  it("blocks runtime evaluation when the Provider is suspended", async () => {
    const repository = fakePauseRepository({ operationalStatus: "SUSPENDED" });
    const before = await repository.findConfigurationByProviderId("provider-1");
    const service = buildService({ repository });

    const blocker = await service.evaluateRuntimeBlocker("provider-1");
    expect(blocker).toEqual({
      unavailable: true,
      reason: "SUSPENDED",
      configurationUntouched: true,
    });

    const after = await repository.findConfigurationByProviderId("provider-1");
    expect(after).toEqual(before);
  });

  it("blocks runtime evaluation when an evaluation interval overlaps an effective pause", async () => {
    const repository = fakePauseRepository();
    const startedAt = new Date("2026-06-01T10:00:00.000Z");
    await repository.startPause({
      providerId: "provider-1",
      startedAt,
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      expectedVersion: 0,
      actorUserId: "owner-1",
    });
    const before = await repository.findConfigurationByProviderId("provider-1");
    const service = buildService({ repository });

    const blocker = await service.evaluateRuntimeBlocker("provider-1", {
      at: startedAt,
      interval: {
        start: new Date("2026-06-01T11:00:00.000Z"),
        end: new Date("2026-06-01T11:30:00.000Z"),
      },
    });

    expect(blocker).toEqual({
      unavailable: true,
      reason: "PAUSE",
      configurationUntouched: true,
    });
    expect(await repository.findConfigurationByProviderId("provider-1")).toEqual(
      before,
    );
  });
});

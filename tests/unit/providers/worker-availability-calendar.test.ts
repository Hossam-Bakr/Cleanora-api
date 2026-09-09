import { ProviderAvailabilityError } from "../../../src/modules/providers/domain/provider-availability.errors.js";
import type {
  ProviderAvailabilityAuthorizationReader,
  ProviderWorkerAvailabilityRepository,
} from "../../../src/modules/providers/domain/provider-availability.ports.js";
import type {
  WorkerAvailabilityConfigurationSnapshot,
} from "../../../src/modules/providers/domain/provider-availability.types.js";
import {
  intersectProviderWorkerAvailabilityForCivilDate,
  ProviderWorkerAvailabilityService,
} from "../../../src/modules/providers/provider-worker-availability.service.js";

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

function workerSnapshot(
  providerId = "provider-1",
  workerId = "worker-1",
  version = 1,
): WorkerAvailabilityConfigurationSnapshot {
  return {
    providerId,
    workerId,
    version,
    weeklyPeriods: [],
    exceptions: [],
  };
}

function fakeRepository(
  overrides: Partial<
    ProviderWorkerAvailabilityRepository & ProviderAvailabilityAuthorizationReader
  > = {},
): ProviderWorkerAvailabilityRepository & ProviderAvailabilityAuthorizationReader {
  let current = workerSnapshot();
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
    async resolveAuthorityFacts() {
      return baseFacts;
    },
    async findWorkerCalendarByProviderId(input) {
      return current.providerId === input.providerId && current.workerId === input.workerId
        ? current
        : null;
    },
    async reserveOrReplayWorkerCalendarCommand(input) {
      const key = `${input.providerId}:${input.workerId}:${input.idempotencyKey}`;
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
    async completeWorkerCalendarCommand(input) {
      const key = `${input.providerId}:${input.workerId}:${input.idempotencyKey}`;
      const existing = receipts.get(key);
      receipts.set(key, {
        status: "ACCEPTED",
        fingerprint: existing?.fingerprint ?? "",
        actorUserId: existing?.actorUserId ?? "",
        safeResultJson: input.safeResultJson,
      });
    },
    async replaceWorkerCalendar(input) {
      if (current.providerId !== input.providerId || current.workerId !== input.workerId) {
        return "NOT_FOUND" as const;
      }
      if (current.version !== input.expectedVersion) {
        return "VERSION_CONFLICT" as const;
      }
      current = {
        providerId: input.providerId,
        workerId: input.workerId,
        version: input.expectedVersion + 1,
        weeklyPeriods: input.weeklyPeriods.map((period, index) => ({
          id: `worker-schedule-${index}`,
          ...period,
        })),
        exceptions: input.exceptions.map((exception, index) => ({
          id: `worker-exception-${index}`,
          localDate: exception.localDate,
          closed: exception.closed,
          startMinute: exception.closed ? null : (exception.startMinute ?? null),
          endMinute: exception.closed ? null : (exception.endMinute ?? null),
          endsNextDay: exception.closed ? null : (exception.endsNextDay ?? false),
        })),
      };
      return current;
    },
    async appendWorkerCalendarHistory() {
      // no-op
    },
    ...overrides,
  };
}

function buildService(
  repository = fakeRepository(),
): ProviderWorkerAvailabilityService {
  const work = (transactionWork: (context: { readonly repository: typeof repository }) => unknown) =>
    transactionWork({ repository });

  return new ProviderWorkerAvailabilityService({
    runInWriteTransaction: (transactionWork) => work(transactionWork) as never,
    runInReadTransaction: (transactionWork) => work(transactionWork) as never,
  });
}

describe("Worker availability calendar intersection (R1-P10 Batch B2)", () => {
  it("intersects Worker availability with Provider availability by civil date", () => {
    expect(
      intersectProviderWorkerAvailabilityForCivilDate({
        localDate: "2026-01-06",
        providerWeeklyPeriods: [
          { weekday: 2, startMinute: 480, endMinute: 1_020, endsNextDay: false },
        ],
        providerExceptions: [],
        workerWeeklyPeriods: [
          { weekday: 2, startMinute: 600, endMinute: 900, endsNextDay: false },
        ],
        workerExceptions: [],
      }),
    ).toEqual([
      {
        localDate: "2026-01-06",
        startMinute: 600,
        endMinute: 900,
        source: "WEEKLY",
      },
    ]);
  });

  it("lets Provider and Worker exceptions replace their own weekly hours before intersection", () => {
    expect(
      intersectProviderWorkerAvailabilityForCivilDate({
        localDate: "2026-01-06",
        providerWeeklyPeriods: [
          { weekday: 2, startMinute: 480, endMinute: 1_020, endsNextDay: false },
        ],
        providerExceptions: [
          {
            localDate: "2026-01-06",
            closed: false,
            startMinute: 720,
            endMinute: 960,
            endsNextDay: false,
          },
        ],
        workerWeeklyPeriods: [
          { weekday: 2, startMinute: 540, endMinute: 900, endsNextDay: false },
        ],
        workerExceptions: [],
      }),
    ).toEqual([
      {
        localDate: "2026-01-06",
        startMinute: 720,
        endMinute: 900,
        source: "EXCEPTION",
      },
    ]);
  });

  it("removes Worker availability when the Provider is closed for that civil date", () => {
    expect(
      intersectProviderWorkerAvailabilityForCivilDate({
        localDate: "2026-01-06",
        providerWeeklyPeriods: [
          { weekday: 2, startMinute: 480, endMinute: 1_020, endsNextDay: false },
        ],
        providerExceptions: [{ localDate: "2026-01-06", closed: true }],
        workerWeeklyPeriods: [
          { weekday: 2, startMinute: 540, endMinute: 900, endsNextDay: false },
        ],
        workerExceptions: [],
      }),
    ).toEqual([]);
  });
});

describe("ProviderWorkerAvailabilityService.replaceWorkerCalendar", () => {
  it("uses ProviderWorker.version and replaces Worker weekly periods and exceptions", async () => {
    let historyCalls = 0;
    const service = buildService(
      fakeRepository({
        async appendWorkerCalendarHistory(input) {
          historyCalls += 1;
          expect(input.targetVersion).toBe(2);
          expect(input.safeBefore).toEqual({ weeklyPeriods: [], exceptions: [] });
          expect(input.safeAfter.exceptions).toHaveLength(1);
        },
      }),
    );

    const result = await service.replaceWorkerCalendar(
      { actorUserId: "owner-1", requestId: "request-1" },
      "provider-1",
      "worker-1",
      {
        weeklyPeriods: [
          { weekday: 1, startMinute: 480, endMinute: 960, endsNextDay: false },
        ],
        exceptions: [{ localDate: "2026-01-07", closed: true }],
        expectedVersion: 1,
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        reasonCode: "WORKER_SCHEDULE_UPDATE",
      },
    );

    expect(result.replayed).toBe(false);
    expect(result.calendar.version).toBe(2);
    expect(result.calendar.workerId).toBe("worker-1");
    expect(result.calendar.weeklyPeriods).toEqual([
      { weekday: 1, startMinute: 480, endMinute: 960, endsNextDay: false },
    ]);
    expect(result.calendar.exceptions).toEqual([
      {
        localDate: "2026-01-07",
        closed: true,
        startMinute: null,
        endMinute: null,
        endsNextDay: null,
      },
    ]);
    expect(historyCalls).toBe(1);
  });

  it("replays an accepted Worker calendar command without validating the submitted periods again", async () => {
    const repository = fakeRepository({
      async reserveOrReplayWorkerCalendarCommand() {
        return {
          status: "REPLAYED",
          safeResultJson: {
            providerId: "provider-1",
            workerId: "worker-1",
            version: 2,
            weeklyPeriods: [],
            exceptions: [],
          },
        };
      },
      async replaceWorkerCalendar() {
        throw new Error("replacement must not run on accepted replay");
      },
    });
    const service = buildService(repository);

    await expect(
      service.replaceWorkerCalendar(
        { actorUserId: "owner-1" },
        "provider-1",
        "worker-1",
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 600, endMinute: 600, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: 1,
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
        },
      ),
    ).resolves.toMatchObject({ replayed: true });
  });

  it("rejects overlapping Worker periods with the shared schedule validator", async () => {
    const service = buildService();

    await expect(
      service.replaceWorkerCalendar(
        { actorUserId: "owner-1" },
        "provider-1",
        "worker-1",
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
            { weekday: 1, startMinute: 719, endMinute: 900, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: 1,
          idempotencyKey: "33333333-3333-4333-8333-333333333333",
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_SCHEDULE_INVALID" });
  });

  it("returns the non-enumerating not-found error for a missing or foreign Worker", async () => {
    const service = buildService(
      fakeRepository({
        async findWorkerCalendarByProviderId() {
          return null;
        },
      }),
    );

    await expect(
      service.getWorkerCalendar(
        { actorUserId: "owner-1" },
        "provider-1",
        "foreign-worker",
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_NOT_FOUND" });
  });
});

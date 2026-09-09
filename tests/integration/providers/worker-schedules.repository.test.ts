import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  createSecondProviderAdminActor,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Worker schedules repository/service persistence (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("full-replaces weekly periods and dated exceptions with the Worker row version", async () => {
      const providerBefore = await h.db.provider.findUniqueOrThrow({
        where: { id: h.provider.id },
        select: { workforceStateVersion: true },
      });
      const first = await h.workerAvailabilityService.replaceWorkerCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        h.worker.id,
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 1_020, endsNextDay: false },
          ],
          exceptions: [{ localDate: "2027-01-07", closed: true }],
          expectedVersion: h.worker.version,
          idempotencyKey: randomUUID(),
        },
      );

      expect(first.calendar.version).toBe(h.worker.version + 1);
      expect(first.calendar.weeklyPeriods).toEqual([
        { weekday: 1, startMinute: 480, endMinute: 1_020, endsNextDay: false },
      ]);
      expect(first.calendar.exceptions).toEqual([
        {
          localDate: "2027-01-07",
          closed: true,
          startMinute: null,
          endMinute: null,
          endsNextDay: null,
        },
      ]);
      await expect(
        h.db.provider.findUniqueOrThrow({
          where: { id: h.provider.id },
          select: { workforceStateVersion: true },
        }),
      ).resolves.toEqual({
        workforceStateVersion: providerBefore.workforceStateVersion + 1,
      });

      const second = await h.workerAvailabilityService.replaceWorkerCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        h.worker.id,
        {
          weeklyPeriods: [
            { weekday: 2, startMinute: 1_320, endMinute: 120, endsNextDay: true },
          ],
          exceptions: [
            {
              localDate: "2027-01-08",
              closed: false,
              startMinute: 600,
              endMinute: 720,
              endsNextDay: false,
            },
          ],
          expectedVersion: h.worker.version + 1,
          idempotencyKey: randomUUID(),
        },
      );

      expect(second.calendar.version).toBe(h.worker.version + 2);
      await expect(
        h.db.provider.findUniqueOrThrow({
          where: { id: h.provider.id },
          select: { workforceStateVersion: true },
        }),
      ).resolves.toEqual({
        workforceStateVersion: providerBefore.workforceStateVersion + 2,
      });
      expect(await h.db.workerSchedule.count({ where: { workerId: h.worker.id } }))
        .toBe(1);
      expect(
        await h.db.workerScheduleException.count({
          where: { workerId: h.worker.id },
        }),
      ).toBe(1);
      await expect(
        h.db.providerAvailabilityConfiguration.findUnique({
          where: { providerId: h.provider.id },
        }),
      ).resolves.toBeNull();
    });

    it("rejects concurrent replacement at a stale expected Worker version", async () => {
      await h.workerAvailabilityService.replaceWorkerCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        h.worker.id,
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: h.worker.version,
          idempotencyKey: randomUUID(),
        },
      );

      await expect(
        h.workerAvailabilityService.replaceWorkerCalendar(
          { actorUserId: h.owner.id },
          h.provider.id,
          h.worker.id,
          {
            weeklyPeriods: [
              { weekday: 2, startMinute: 480, endMinute: 720, endsNextDay: false },
            ],
            exceptions: [],
            expectedVersion: h.worker.version,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VERSION_CONFLICT" });
    });

    it("replays an accepted UUID command without double-writing history", async () => {
      const idempotencyKey = randomUUID();
      const command = {
        weeklyPeriods: [
          { weekday: 3 as const, startMinute: 480, endMinute: 720, endsNextDay: false },
        ],
        exceptions: [],
        expectedVersion: h.worker.version,
        idempotencyKey,
      };

      const first = await h.workerAvailabilityService.replaceWorkerCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        h.worker.id,
        command,
      );
      const replay = await h.workerAvailabilityService.replaceWorkerCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        h.worker.id,
        command,
      );

      expect(replay.replayed).toBe(true);
      expect(replay.calendar).toEqual(first.calendar);
      expect(
        await h.db.providerAvailabilityHistory.count({
          where: {
            providerId: h.provider.id,
            targetType: "WORKER_SCHEDULE",
            targetId: h.worker.id,
            eventCode: "worker.schedule.configuration.replaced",
          },
        }),
      ).toBe(1);
    });

    it("binds Worker schedule idempotency replay to the original actor", async () => {
      const secondOwner = await createSecondProviderAdminActor(
        h.db,
        h.provider.id,
      );
      const idempotencyKey = randomUUID();
      const command = {
        weeklyPeriods: [
          { weekday: 4 as const, startMinute: 540, endMinute: 900, endsNextDay: false },
        ],
        exceptions: [],
        expectedVersion: h.worker.version,
        idempotencyKey,
      };

      await h.workerAvailabilityService.replaceWorkerCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        h.worker.id,
        command,
      );

      await expect(
        h.workerAvailabilityService.replaceWorkerCalendar(
          { actorUserId: secondOwner.id },
          h.provider.id,
          h.worker.id,
          command,
        ),
      ).rejects.toMatchObject({
        code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT",
      });
    });
  },
);

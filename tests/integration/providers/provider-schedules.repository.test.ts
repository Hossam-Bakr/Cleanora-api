import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  createSecondProviderAdminActor,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider schedules repository/service persistence (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("full-replaces weekly periods and dated exceptions with one configuration version", async () => {
      const first = await h.availabilityService.replaceCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 1_020, endsNextDay: false },
          ],
          exceptions: [{ localDate: "2027-01-07", closed: true }],
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        },
      );

      expect(first.calendar.version).toBe(1);
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

      const second = await h.availabilityService.replaceCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
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
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
        },
      );

      expect(second.calendar.version).toBe(2);
      expect(await h.db.providerSchedule.count({ where: { providerId: h.provider.id } }))
        .toBe(1);
      expect(
        await h.db.providerScheduleException.count({
          where: { providerId: h.provider.id },
        }),
      ).toBe(1);
    });

    it("rejects concurrent replacement at a stale expected version", async () => {
      await h.availabilityService.replaceCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        },
      );

      await expect(
        h.availabilityService.replaceCalendar(
          { actorUserId: h.owner.id },
          h.provider.id,
          {
            weeklyPeriods: [
              { weekday: 2, startMinute: 480, endMinute: 720, endsNextDay: false },
            ],
            exceptions: [],
            expectedVersion: 0,
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
        expectedVersion: 0,
        idempotencyKey,
      };

      const first = await h.availabilityService.replaceCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );
      const replay = await h.availabilityService.replaceCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );

      expect(replay.replayed).toBe(true);
      expect(replay.calendar).toEqual(first.calendar);
      expect(
        await h.db.providerAvailabilityHistory.count({
          where: {
            providerId: h.provider.id,
            eventCode: "schedule.configuration.replaced",
          },
        }),
      ).toBe(1);
    });

    it("binds idempotency replay to the original actor", async () => {
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
        expectedVersion: 0,
        idempotencyKey,
      };

      await h.availabilityService.replaceCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );

      await expect(
        h.availabilityService.replaceCalendar(
          { actorUserId: secondOwner.id },
          h.provider.id,
          command,
        ),
      ).rejects.toMatchObject({
        code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT",
      });
    });
  },
);

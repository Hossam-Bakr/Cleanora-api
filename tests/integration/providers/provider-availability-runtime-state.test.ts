import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider availability runtime state blockers (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("blocks runtime on suspension without erasing schedule configuration", async () => {
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

      const beforeSchedules = await h.db.providerSchedule.count({
        where: { providerId: h.provider.id },
      });
      expect(beforeSchedules).toBe(1);

      await h.db.provider.update({
        where: { id: h.provider.id },
        data: {
          operationalStatus: "SUSPENDED",
          suspendedAt: new Date(),
        },
      });

      const blocker = await h.availabilityService.evaluateRuntimeBlocker(
        h.provider.id,
      );
      expect(blocker).toEqual({
        unavailable: true,
        reason: "SUSPENDED",
        configurationUntouched: true,
      });

      expect(
        await h.db.providerSchedule.count({
          where: { providerId: h.provider.id },
        }),
      ).toBe(beforeSchedules);
    });

    it("blocks runtime on overlapping pause without mutating configuration or lifecycle", async () => {
      await h.availabilityService.replaceCalendar(
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
      );

      const providerBefore = await h.db.provider.findUniqueOrThrow({
        where: { id: h.provider.id },
        select: {
          applicationStatus: true,
          operationalStatus: true,
          approvedAt: true,
        },
      });

      const pause = await h.availabilityService.startPause(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
          endsAt: new Date("2099-01-01T00:00:00.000Z"),
        },
      );

      const blocker = await h.availabilityService.evaluateRuntimeBlocker(
        h.provider.id,
        {
          at: new Date(pause.pause.startedAt),
          interval: {
            start: new Date(pause.pause.startedAt),
            end: new Date("2099-01-01T00:00:00.000Z"),
          },
        },
      );
      expect(blocker).toEqual({
        unavailable: true,
        reason: "PAUSE",
        configurationUntouched: true,
      });

      const providerAfter = await h.db.provider.findUniqueOrThrow({
        where: { id: h.provider.id },
        select: {
          applicationStatus: true,
          operationalStatus: true,
          approvedAt: true,
        },
      });
      expect(providerAfter).toEqual(providerBefore);
      expect(
        await h.db.providerSchedule.count({
          where: { providerId: h.provider.id },
        }),
      ).toBe(1);
    });
  },
);

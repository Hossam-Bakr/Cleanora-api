import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider temporary pause repository/service persistence (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("starts one pause, rejects a second unresolved pause, and resumes with history", async () => {
      const first = await h.availabilityService.startPause(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
          endsAt: new Date("2099-01-01T00:00:00.000Z"),
        },
      );

      expect(first.pause.version).toBe(1);
      expect(first.pause.effective).toBe(true);

      await expect(
        h.availabilityService.startPause(
          { actorUserId: h.owner.id },
          h.provider.id,
          {
            expectedVersion: 0,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_PAUSE_CONFLICT" });

      const resumed = await h.availabilityService.resumePause(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
        },
      );
      expect(resumed.pause.resumedAt).not.toBeNull();
      expect(resumed.pause.version).toBe(2);

      expect(
        await h.db.providerAvailabilityHistory.count({
          where: {
            providerId: h.provider.id,
            targetType: "PAUSE",
            eventCode: { in: ["pause.started", "pause.resumed"] },
          },
        }),
      ).toBe(2);
    });

    it("replays an accepted pause start UUID without double-writing history", async () => {
      const idempotencyKey = randomUUID();
      const command = {
        expectedVersion: 0,
        idempotencyKey,
      };

      const first = await h.availabilityService.startPause(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );
      const replay = await h.availabilityService.startPause(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );

      expect(replay.replayed).toBe(true);
      expect(replay.pause).toEqual(first.pause);
      expect(
        await h.db.providerAvailabilityHistory.count({
          where: {
            providerId: h.provider.id,
            eventCode: "pause.started",
          },
        }),
      ).toBe(1);
    });

    it("materializes an expired bounded pause before starting another pause", async () => {
      const endedAt = new Date(Date.now() - 60_000);
      const expired = await h.db.providerTemporaryPause.create({
        data: {
          providerId: h.provider.id,
          startedAt: new Date(endedAt.getTime() - 60_000),
          endsAt: endedAt,
          actorUserId: h.owner.id,
          version: 1,
        },
      });

      const restarted = await h.availabilityService.startPause(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        },
      );

      expect(restarted.pause.effective).toBe(true);
      await expect(
        h.db.providerTemporaryPause.findUnique({ where: { id: expired.id } }),
      ).resolves.toMatchObject({ resumedAt: endedAt, version: 2 });
    });
  },
);

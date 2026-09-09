import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  createSecondProviderAdminActor,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider capacity repository/service persistence (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("creates and updates the capacity rule with optimistic versions and history", async () => {
      const first = await h.capacityService.replaceCapacityRule(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          maxSimultaneousTeams: 2,
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        },
      );
      expect(first.capacity).toEqual({
        providerId: h.provider.id,
        version: 1,
        maxSimultaneousTeams: 2,
      });

      const second = await h.capacityService.replaceCapacityRule(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          maxSimultaneousTeams: 4,
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
        },
      );
      expect(second.capacity.version).toBe(2);
      expect(second.capacity.maxSimultaneousTeams).toBe(4);
      expect(
        await h.db.providerAvailabilityHistory.count({
          where: {
            providerId: h.provider.id,
            targetType: "CAPACITY",
            eventCode: "capacity.replaced",
          },
        }),
      ).toBe(2);
    });

    it("rejects concurrent replacement at a stale capacity version", async () => {
      await h.capacityService.replaceCapacityRule(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          maxSimultaneousTeams: 2,
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        },
      );

      await expect(
        h.capacityService.replaceCapacityRule(
          { actorUserId: h.owner.id },
          h.provider.id,
          {
            maxSimultaneousTeams: 3,
            expectedVersion: 0,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VERSION_CONFLICT" });
    });

    it("replays an accepted UUID command without double-writing capacity history", async () => {
      const command = {
        maxSimultaneousTeams: 2,
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
      };

      const first = await h.capacityService.replaceCapacityRule(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );
      const replay = await h.capacityService.replaceCapacityRule(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );

      expect(replay.replayed).toBe(true);
      expect(replay.capacity).toEqual(first.capacity);
      expect(
        await h.db.providerAvailabilityHistory.count({
          where: {
            providerId: h.provider.id,
            targetType: "CAPACITY",
            eventCode: "capacity.replaced",
          },
        }),
      ).toBe(1);
    });

    it("binds capacity idempotency replay to the original actor", async () => {
      const secondOwner = await createSecondProviderAdminActor(
        h.db,
        h.provider.id,
      );
      const command = {
        maxSimultaneousTeams: 2,
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
      };

      await h.capacityService.replaceCapacityRule(
        { actorUserId: h.owner.id },
        h.provider.id,
        command,
      );
      await expect(
        h.capacityService.replaceCapacityRule(
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

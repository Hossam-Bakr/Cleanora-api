import { randomUUID } from "node:crypto";
import request from "supertest";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "R1-P10 Provider capacity HTTP (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("requires authentication and denies non-members non-enumerating", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/capacity`;
      await request(h.app(null)).get(path).expect(401);

      const stranger = await h.db.user.create({
        data: {
          emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
          status: "ACTIVE",
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
          emailVerifiedAt: new Date(),
        },
      });
      await request(h.app(stranger.id)).get(path).expect(404);
    });

    it("creates, reads, replays and version-checks the capacity rule", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/capacity`;
      const body = {
        maxSimultaneousTeams: 2,
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
        reasonCode: "CAPACITY_RULE_UPDATE",
      };

      const empty = await request(h.app(h.owner.id)).get(path).expect(200);
      expect(empty.body.data).toEqual({
        providerId: h.provider.id,
        version: 0,
        maxSimultaneousTeams: null,
      });

      const first = await request(h.app(h.owner.id))
        .put(path)
        .send(body)
        .expect(200);
      expect(first.body.data).toEqual({
        providerId: h.provider.id,
        version: 1,
        maxSimultaneousTeams: 2,
      });

      const replayed = await request(h.app(h.owner.id))
        .put(path)
        .send(body)
        .expect(200);
      expect(replayed.body.meta.replayed).toBe(true);

      await request(h.app(h.owner.id))
        .put(path)
        .send({ ...body, idempotencyKey: randomUUID() })
        .expect(409);

      const read = await request(h.app(h.owner.id)).get(path).expect(200);
      expect(read.body.data).toEqual({
        providerId: h.provider.id,
        version: 1,
        maxSimultaneousTeams: 2,
      });
    });

    it("rejects out-of-range capacity input before persistence", async () => {
      const response = await request(h.app(h.owner.id))
        .put(`/api/v1/providers/${h.provider.id}/availability/capacity`)
        .send({
          maxSimultaneousTeams: 51,
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        })
        .expect(400);

      expect(response.body.error.code).toBe("REQUEST_VALIDATION_FAILED");
      expect(
        await h.db.providerCapacityRule.findUnique({
          where: { providerId: h.provider.id },
        }),
      ).toBeNull();
    });
  },
);

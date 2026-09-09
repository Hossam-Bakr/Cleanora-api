import { randomUUID } from "node:crypto";
import request from "supertest";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "R1-P10 Provider temporary pause HTTP (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("requires authentication and denies non-members non-enumerating", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/pause`;
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

    it("starts, reads, replays, conflicts, and resumes a temporary pause", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/pause`;
      const resumePath = `${path}/resume`;
      const idempotencyKey = randomUUID();
      const body = {
        expectedVersion: 0,
        idempotencyKey,
        endsAt: "2099-06-01T12:00:00.000Z",
        reasonCode: "PROVIDER_PAUSE_START",
      };

      const first = await request(h.app(h.owner.id))
        .post(path)
        .send(body)
        .expect(200);
      expect(first.body.data.version).toBe(1);
      expect(first.body.data.effective).toBe(true);
      expect(first.body.data.endsAt).toBe(body.endsAt);

      const replayed = await request(h.app(h.owner.id))
        .post(path)
        .send(body)
        .expect(200);
      expect(replayed.body.meta.replayed).toBe(true);

      await request(h.app(h.owner.id))
        .post(path)
        .send({ ...body, idempotencyKey: randomUUID() })
        .expect(409);

      const read = await request(h.app(h.owner.id)).get(path).expect(200);
      expect(read.body.data.version).toBe(1);

      const resumed = await request(h.app(h.owner.id))
        .post(resumePath)
        .send({
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
        })
        .expect(200);
      expect(resumed.body.data.resumedAt).not.toBeNull();
      expect(resumed.body.data.effective).toBe(false);
    });

    it("rejects endsAt that is not after server start with a stable validation error", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/pause`;

      const response = await request(h.app(h.owner.id))
        .post(path)
        .send({
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
          endsAt: "2000-01-01T00:00:00.000Z",
        })
        .expect(422);

      expect(response.body.error.code).toBe("PROVIDER_AVAILABILITY_PAUSE_INVALID");
    });
  },
);

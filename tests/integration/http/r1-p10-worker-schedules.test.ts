import { randomUUID } from "node:crypto";
import request from "supertest";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createActiveProviderWorker,
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "R1-P10 Worker schedules HTTP (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("requires authentication and denies non-members non-enumerating", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/workers/${h.worker.id}/calendar`;
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

    it("returns not-found for a missing or cross-Provider Worker without disclosure", async () => {
      const otherOwner = await h.db.user.create({
        data: {
          emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
          status: "ACTIVE",
          accountCategories: ["PROVIDER_OWNER"],
          verifiedCategories: ["PROVIDER_OWNER"],
          emailVerifiedAt: new Date(),
        },
      });
      const otherProvider = await h.db.provider.create({
        data: {
          applicationOwnerUserId: otherOwner.id,
          ownerUserId: otherOwner.id,
          kind: "INDIVIDUAL_TEAM",
          applicationStatus: "APPROVED",
          approvedAt: new Date(),
          profile: {
            create: {
              countryId: h.country.id,
              displayNameAr: "اختبار عامل آخر",
              displayNameEn: "R1-P10 other Provider",
            },
          },
          members: {
            create: {
              userId: otherOwner.id,
              level: "OWNER",
              status: "ACTIVE",
              enabledAt: new Date(),
            },
          },
        },
      });
      const otherWorker = await createActiveProviderWorker(
        h.db,
        otherProvider.id,
        { fullLegalName: "Foreign Provider Worker" },
      );

      await request(h.app(h.owner.id))
        .get(`/api/v1/providers/${h.provider.id}/availability/workers/missing/calendar`)
        .expect(404);
      await request(h.app(h.owner.id))
        .get(`/api/v1/providers/${h.provider.id}/availability/workers/${otherWorker.id}/calendar`)
        .expect(404);
    });

    it("replaces owned Worker schedules as Owner, replays by UUID, and rejects stale versions", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/workers/${h.worker.id}/calendar`;
      const idempotencyKey = randomUUID();
      const body = {
        weeklyPeriods: [
          { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
          { weekday: 1, startMinute: 720, endMinute: 1_020, endsNextDay: false },
        ],
        exceptions: [{ localDate: "2027-01-06", closed: true }],
        expectedVersion: h.worker.version,
        idempotencyKey,
        reasonCode: "WORKER_SCHEDULE_UPDATE",
      };

      const first = await request(h.app(h.owner.id))
        .put(path)
        .send(body)
        .expect(200);
      expect(first.body.data.version).toBe(h.worker.version + 1);
      expect(first.body.data.workerId).toBe(h.worker.id);
      expect(first.body.data.weeklyPeriods).toEqual(body.weeklyPeriods);
      expect(first.body.data.exceptions).toEqual([
        {
          localDate: "2027-01-06",
          closed: true,
          startMinute: null,
          endMinute: null,
          endsNextDay: null,
        },
      ]);

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
      expect(read.body.data.version).toBe(h.worker.version + 1);
      expect(read.body.data.weeklyPeriods).toEqual(body.weeklyPeriods);
    });

    it("rejects overlapping Worker weekly periods with a stable validation error", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/workers/${h.worker.id}/calendar`;

      const response = await request(h.app(h.owner.id))
        .put(path)
        .send({
          weeklyPeriods: [
            { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
            { weekday: 1, startMinute: 719, endMinute: 1_020, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: h.worker.version,
          idempotencyKey: randomUUID(),
        })
        .expect(422);

      expect(response.body.error.code).toBe("PROVIDER_AVAILABILITY_SCHEDULE_INVALID");
    });

    it("raises a stable idempotency conflict for same key with different Worker payload", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/workers/${h.worker.id}/calendar`;
      const idempotencyKey = randomUUID();

      await request(h.app(h.owner.id))
        .put(path)
        .send({
          weeklyPeriods: [
            { weekday: 2, startMinute: 480, endMinute: 720, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: h.worker.version,
          idempotencyKey,
        })
        .expect(200);

      await request(h.app(h.owner.id))
        .put(path)
        .send({
          weeklyPeriods: [
            { weekday: 3, startMinute: 480, endMinute: 720, endsNextDay: false },
          ],
          exceptions: [],
          expectedVersion: h.worker.version,
          idempotencyKey,
        })
        .expect(409);
    });
  },
);

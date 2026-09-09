import request from "supertest";
import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "R1-P10 Provider availability coverage HTTP (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("requires authentication and denies non-members (non-enumerating 404)", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/coverage`;
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

    it("replaces coverage as Owner, is idempotent, and rejects a stale version", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "CAI", nameAr: "القاهرة", nameEn: "Cairo" },
      });
      const path = `/api/v1/providers/${h.provider.id}/availability/coverage`;
      const idempotencyKey = randomUUID();

      const first = await request(h.app(h.owner.id))
        .put(path)
        .send({ selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey })
        .expect(200);
      expect(first.body.data.coverage).toEqual([{ type: "CITY", id: city.id }]);

      const replayed = await request(h.app(h.owner.id))
        .put(path)
        .send({ selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey })
        .expect(200);
      expect(replayed.body.meta.replayed).toBe(true);

      await request(h.app(h.owner.id))
        .put(path)
        .send({ selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey: randomUUID() })
        .expect(409);

      const read = await request(h.app(h.owner.id)).get(path).expect(200);
      expect(read.body.data.version).toBe(1);
    });

    it("raises a stable idempotency conflict for same key/different payload over HTTP (repair item 4)", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "SOH", nameAr: "سوهاج", nameEn: "Sohag" },
      });
      const otherCity = await h.db.city.create({
        data: { countryId: h.country.id, code: "QEN", nameAr: "قنا", nameEn: "Qena" },
      });
      const path = `/api/v1/providers/${h.provider.id}/availability/coverage`;
      const idempotencyKey = randomUUID();

      await request(h.app(h.owner.id))
        .put(path)
        .send({ selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey })
        .expect(200);

      await request(h.app(h.owner.id))
        .put(path)
        .send({ selections: [{ type: "CITY", id: otherCity.id }], expectedVersion: 0, idempotencyKey })
        .expect(409);
    });

    it("rejects a coverage selection referencing an unknown city", async () => {
      const path = `/api/v1/providers/${h.provider.id}/availability/coverage`;
      await request(h.app(h.owner.id))
        .put(path)
        .send({ selections: [{ type: "CITY", id: "not-a-real-city" }], expectedVersion: 0, idempotencyKey: randomUUID() })
        .expect(422);
    });

    it("rejects coverage outside the Provider's own country over HTTP (repair item 3)", async () => {
      const currency = await h.db.currency.findFirstOrThrow();
      const foreignCode = `X${Math.floor(Math.random() * 10)}`;
      const otherCountry =
        (await h.db.country.findUnique({ where: { code: foreignCode } })) ??
        (await h.db.country.create({
          data: {
            code: foreignCode,
            nameEn: `Foreign fixture ${foreignCode}`,
            nameAr: `دولة ${foreignCode}`,
            defaultCurrencyId: currency.id,
            defaultLocale: "ar",
            supportedLocales: ["ar"],
            isActive: true,
          },
        }));
      const foreignCity = await h.db.city.create({
        data: {
          countryId: otherCountry.id,
          code: `DXB${randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase()}`,
          nameAr: `دبي ${foreignCode}`,
          nameEn: `Dubai ${foreignCode}`,
        },
      });
      const path = `/api/v1/providers/${h.provider.id}/availability/coverage`;
      await request(h.app(h.owner.id))
        .put(path)
        .send({
          selections: [{ type: "CITY", id: foreignCity.id }],
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        })
        .expect(422);
    });
  },
);

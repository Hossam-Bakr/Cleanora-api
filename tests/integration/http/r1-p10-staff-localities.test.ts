import request from "supertest";
import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "R1-P10 Staff locality/time-zone HTTP (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("requires authentication", async () => {
      await request(h.app(null))
        .get(`/api/v1/staff/configuration/countries/${h.country.id}/cities`)
        .expect(401);
    });

    it("creates a city, is idempotent, and rejects a bad reason", async () => {
      const path = `/api/v1/staff/configuration/countries/${h.country.id}/cities`;
      const idempotencyKey = randomUUID();

      await request(h.app())
        .post(path)
        .send({ code: "CAI", nameAr: "القاهرة", nameEn: "Cairo", idempotencyKey, reasonCode: "not_a_real_reason" })
        .expect(400);

      const created = await request(h.app())
        .post(path)
        .send({ code: "CAI", nameAr: "القاهرة", nameEn: "Cairo", idempotencyKey, reasonCode: "configuration_locality_change" })
        .expect(201);
      expect(created.body.data.code).toBe("CAI");

      const replayed = await request(h.app())
        .post(path)
        .send({ code: "CAI", nameAr: "القاهرة", nameEn: "Cairo", idempotencyKey, reasonCode: "configuration_locality_change" })
        .expect(200);
      expect(replayed.body.meta.replayed).toBe(true);

      const listed = await request(h.app()).get(path).expect(200);
      expect(listed.body.data).toHaveLength(1);
    });

    it("creates a district under a city and patches it with expectedVersion", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "GIZ", nameAr: "الجيزة", nameEn: "Giza" },
      });
      const districtPath = `/api/v1/staff/configuration/cities/${city.id}/districts`;
      const created = await request(h.app())
        .post(districtPath)
        .send({
          code: "DOK",
          nameAr: "الدقي",
          nameEn: "Dokki",
          idempotencyKey: randomUUID(),
          reasonCode: "configuration_locality_change",
        })
        .expect(201);

      const patched = await request(h.app())
        .patch(`/api/v1/staff/configuration/districts/${created.body.data.id}`)
        .send({
          isActive: false,
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
          reasonCode: "configuration_locality_change",
        })
        .expect(200);
      expect(patched.body.data.isActive).toBe(false);

      await request(h.app())
        .patch(`/api/v1/staff/configuration/districts/${created.body.data.id}`)
        .send({
          isActive: false,
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
          reasonCode: "configuration_locality_change",
        })
        .expect(409);
    });

    it("sets and reads the country time zone, then rejects a stale expectedVersion", async () => {
      const path = `/api/v1/staff/configuration/countries/${h.country.id}/time-zone`;
      // Repair item 6: the R1-P10 migration backfills Egypt's
      // `platform.default_timezone` CountryConfig row (Africa/Cairo, version 1)
      // before COUNTRY_REQUIRED takes effect, so it already exists here.
      const initial = await request(h.app()).get(path).expect(200);
      expect(initial.body.data.timeZone).toBe("Africa/Cairo");
      const currentVersion = initial.body.data.version as number;
      expect(currentVersion).toBeGreaterThanOrEqual(1);

      const put1 = await request(h.app())
        .put(path)
        .send({
          timeZone: "Africa/Cairo",
          expectedVersion: currentVersion,
          idempotencyKey: randomUUID(),
          reasonCode: "configuration_locality_change",
        })
        .expect(200);
      expect(put1.body.data.timeZone).toBe("Africa/Cairo");

      const read = await request(h.app()).get(path).expect(200);
      expect(read.body.data.version).toBe(currentVersion + 1);

      await request(h.app())
        .put(path)
        .send({
          timeZone: "Africa/Cairo",
          expectedVersion: currentVersion,
          idempotencyKey: randomUUID(),
          reasonCode: "configuration_locality_change",
        })
        .expect(409);
    });

    it("raises a stable idempotency conflict for same key/different payload over HTTP (repair item 5)", async () => {
      const path = `/api/v1/staff/configuration/countries/${h.country.id}/cities`;
      const idempotencyKey = randomUUID();

      await request(h.app())
        .post(path)
        .send({
          code: "LUX",
          nameAr: "الأقصر",
          nameEn: "Luxor",
          idempotencyKey,
          reasonCode: "configuration_locality_change",
        })
        .expect(201);

      await request(h.app())
        .post(path)
        .send({
          code: "HRG",
          nameAr: "الغردقة",
          nameEn: "Hurghada",
          idempotencyKey,
          reasonCode: "configuration_locality_change",
        })
        .expect(409);
    });

    it("raises a stable idempotency conflict when a different Staff actor reuses the same key (repair item 4)", async () => {
      const staffAdminRole = await h.db.role.findUniqueOrThrow({
        where: { code: "staff_admin" },
      });
      const secondStaffAdmin = await h.db.user.create({
        data: {
          emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
          status: "ACTIVE",
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
          emailVerifiedAt: new Date(),
        },
      });
      await h.db.userRole.create({
        data: {
          userId: secondStaffAdmin.id,
          roleId: staffAdminRole.id,
          status: "ENABLED",
          enabledAt: new Date(),
        },
      });

      const path = `/api/v1/staff/configuration/countries/${h.country.id}/cities`;
      const idempotencyKey = randomUUID();

      await request(h.app(h.staffAdmin.id))
        .post(path)
        .send({
          code: "SHM",
          nameAr: "شرم الشيخ",
          nameEn: "Sharm El Sheikh",
          idempotencyKey,
          reasonCode: "configuration_locality_change",
        })
        .expect(201);

      await request(h.app(secondStaffAdmin.id))
        .post(path)
        .send({
          code: "SHM",
          nameAr: "شرم الشيخ",
          nameEn: "Sharm El Sheikh",
          idempotencyKey,
          reasonCode: "configuration_locality_change",
        })
        .expect(409);
    });
  },
);

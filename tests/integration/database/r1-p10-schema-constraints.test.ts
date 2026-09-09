import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createActiveProviderWorker,
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "R1-P10 schema constraints (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("rejects a duplicate city code within one country", async () => {
      await h.db.city.create({
        data: { countryId: h.country.id, code: "CAI", nameAr: "القاهرة", nameEn: "Cairo" },
      });
      await expect(
        h.db.city.create({
          data: { countryId: h.country.id, code: "CAI", nameAr: "أخرى", nameEn: "Other" },
        }),
      ).rejects.toBeTruthy();
    });

    it("rejects a district city_id XOR check violation on provider_coverage_areas", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "GIZ", nameAr: "الجيزة", nameEn: "Giza" },
      });
      const district = await h.db.district.create({
        data: { cityId: city.id, code: "DOK", nameAr: "الدقي", nameEn: "Dokki" },
      });
      await expect(
        h.db.$executeRaw`INSERT INTO "provider_coverage_areas" ("id", "provider_id", "city_id", "district_id") VALUES (${"bad-area-1"}, ${h.provider.id}, ${city.id}, ${district.id})`,
      ).rejects.toBeTruthy();
    });

    it("blocks direct mutation of provider_availability_history rows", async () => {
      const config = await h.db.providerAvailabilityConfiguration.create({
        data: { providerId: h.provider.id },
      });
      const history = await h.db.providerAvailabilityHistory.create({
        data: {
          providerId: h.provider.id,
          targetType: "COVERAGE",
          targetId: config.id,
          targetVersion: 1,
          eventCode: "coverage.replaced",
          actorUserId: h.owner.id,
          requestId: "req-1",
        },
      });
      await expect(
        h.db.providerAvailabilityHistory.update({
          where: { id: history.id },
          data: { eventCode: "tampered" },
        }),
      ).rejects.toBeTruthy();
    });

    it("evolves platform.default_timezone to COUNTRY_REQUIRED", async () => {
      const config = await h.db.appConfig.findUniqueOrThrow({
        where: { key: "platform.default_timezone" },
      });
      expect(config.resolutionPolicy).toBe("COUNTRY_REQUIRED");
    });

    it("backfills Egypt's platform.default_timezone to Africa/Cairo before the migration switches resolution policy (repair item 6)", async () => {
      const record = await h.db.countryConfig.findUniqueOrThrow({
        where: {
          countryId_key: { countryId: h.country.id, key: "platform.default_timezone" },
        },
      });
      expect(record.value).toBe("Africa/Cairo");
      expect(record.version).toBeGreaterThanOrEqual(1);
    });

    it("rejects an exact duplicate weekly period on provider_schedules (repair item 7)", async () => {
      await h.db.providerSchedule.create({
        data: { providerId: h.provider.id, weekday: 1, startMinute: 480, endMinute: 1020 },
      });
      await expect(
        h.db.providerSchedule.create({
          data: { providerId: h.provider.id, weekday: 1, startMinute: 480, endMinute: 1020 },
        }),
      ).rejects.toBeTruthy();
    });

    it("rejects an exact duplicate weekly period on worker_schedules (repair item 7)", async () => {
      const worker = await createActiveProviderWorker(h.db, h.provider.id);
      await h.db.workerSchedule.create({
        data: { workerId: worker.id, weekday: 2, startMinute: 480, endMinute: 1020 },
      });
      await expect(
        h.db.workerSchedule.create({
          data: { workerId: worker.id, weekday: 2, startMinute: 480, endMinute: 1020 },
        }),
      ).rejects.toBeTruthy();
    });

    it("allows only one holiday exception per date but rejects a duplicate holiday (repair item 7, DEC-054)", async () => {
      const localDate = new Date("2027-01-01T00:00:00.000Z");
      await h.db.providerScheduleException.create({
        data: { providerId: h.provider.id, localDate, closed: true },
      });
      await expect(
        h.db.providerScheduleException.create({
          data: { providerId: h.provider.id, localDate, closed: true },
        }),
      ).rejects.toBeTruthy();
    });

    it("allows multiple distinct open exception periods for one date but rejects an exact duplicate (repair item 7, DEC-054)", async () => {
      const localDate = new Date("2027-02-01T00:00:00.000Z");
      await h.db.providerScheduleException.create({
        data: {
          providerId: h.provider.id,
          localDate,
          closed: false,
          startMinute: 480,
          endMinute: 720,
        },
      });
      // A second, distinct open period on the same date is allowed (DEC-054).
      await expect(
        h.db.providerScheduleException.create({
          data: {
            providerId: h.provider.id,
            localDate,
            closed: false,
            startMinute: 780,
            endMinute: 1020,
          },
        }),
      ).resolves.toBeTruthy();
      // An exact duplicate of an existing open period is rejected.
      await expect(
        h.db.providerScheduleException.create({
          data: {
            providerId: h.provider.id,
            localDate,
            closed: false,
            startMinute: 480,
            endMinute: 720,
          },
        }),
      ).rejects.toBeTruthy();
    });
  },
);

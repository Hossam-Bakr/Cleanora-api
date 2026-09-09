import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

/**
 * Proves DEC-056 textual coverage matching end to end: an exact active
 * district, whole-city coverage of active districts (including a district
 * created after coverage was set), and inactive ancestry stopping the match.
 */
describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider textual coverage matching (live, DEC-056)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("matches an exact active district selection", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "CAI", nameAr: "القاهرة", nameEn: "Cairo" },
      });
      const district = await h.db.district.create({
        data: { cityId: city.id, code: "MAADI", nameAr: "المعادي", nameEn: "Maadi" },
      });
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "DISTRICT", id: district.id }], expectedVersion: 0, idempotencyKey: randomUUID() },
      );

      await expect(
        h.availabilityService.matchesDistrict(h.provider.id, district.id),
      ).resolves.toBe(true);
    });

    it("whole-city coverage matches a district created after coverage was set", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "GIZ", nameAr: "الجيزة", nameEn: "Giza" },
      });
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey: randomUUID() },
      );

      const newDistrict = await h.db.district.create({
        data: { cityId: city.id, code: "DOK", nameAr: "الدقي", nameEn: "Dokki" },
      });

      await expect(
        h.availabilityService.matchesDistrict(h.provider.id, newDistrict.id),
      ).resolves.toBe(true);
    });

    it("stops matching once the covered district is deactivated", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "ALX", nameAr: "الإسكندرية", nameEn: "Alexandria" },
      });
      const district = await h.db.district.create({
        data: { cityId: city.id, code: "MONT", nameAr: "المنتزه", nameEn: "Montaza" },
      });
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "DISTRICT", id: district.id }], expectedVersion: 0, idempotencyKey: randomUUID() },
      );

      await h.db.district.update({ where: { id: district.id }, data: { isActive: false, version: { increment: 1 } } });

      await expect(
        h.availabilityService.matchesDistrict(h.provider.id, district.id),
      ).resolves.toBe(false);
    });

    it("stops matching a whole-city selection once the city ancestry is deactivated", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "SUEZ", nameAr: "السويس", nameEn: "Suez" },
      });
      const district = await h.db.district.create({
        data: { cityId: city.id, code: "PORT", nameAr: "بورت", nameEn: "Port" },
      });
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey: randomUUID() },
      );

      await h.db.city.update({ where: { id: city.id }, data: { isActive: false, version: { increment: 1 } } });

      await expect(
        h.availabilityService.matchesDistrict(h.provider.id, district.id),
      ).resolves.toBe(false);
    });
  },
);

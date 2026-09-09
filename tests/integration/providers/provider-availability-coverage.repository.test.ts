import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  createSecondProviderAdminActor,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider availability coverage repository (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });
    afterEach(async () => {
      await h?.close();
    });

    it("full-replaces coverage and bumps the configuration version", async () => {
      const city = await h.db.city.create({
        data: {
          countryId: h.country.id,
          code: `CAI${randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase()}`,
          nameAr: `القاهرة ${randomUUID().slice(0, 6)}`,
          nameEn: `Cairo ${randomUUID().slice(0, 6)}`,
          isActive: true,
        },
      });
      const district = await h.db.district.create({
        data: {
          cityId: city.id,
          code: `MAADI${randomUUID().replaceAll("-", "").slice(0, 3).toUpperCase()}`,
          nameAr: `المعادي ${randomUUID().slice(0, 6)}`,
          nameEn: `Maadi ${randomUUID().slice(0, 6)}`,
          isActive: true,
        },
      });
      expect(h.country.isActive).toBe(true);
      expect(city.countryId).toBe(h.country.id);

      const first = await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          selections: [{ type: "CITY", id: city.id }],
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        },
      );
      expect(first.coverage.version).toBe(1);

      const second = await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          selections: [{ type: "DISTRICT", id: district.id }],
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
        },
      );
      expect(second.coverage.version).toBe(2);
      expect(second.coverage.coverage).toEqual([{ type: "DISTRICT", id: district.id }]);

      const areas = await h.db.providerCoverageArea.findMany({
        where: { providerId: h.provider.id },
      });
      expect(areas).toHaveLength(1);
    });

    it("rejects concurrent replacement at a stale expected version", async () => {
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          selections: [
            {
              type: "CITY",
              id: (
                await h.db.city.create({
                  data: { countryId: h.country.id, code: "ALX", nameAr: "الإسكندرية", nameEn: "Alexandria" },
                })
              ).id,
            },
          ],
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
        },
      );

      await expect(
        h.availabilityService.replaceCoverage(
          { actorUserId: h.owner.id },
          h.provider.id,
          {
            selections: [
              {
                type: "CITY",
                id: (
                  await h.db.city.create({
                    data: { countryId: h.country.id, code: "SUEZ", nameAr: "السويس", nameEn: "Suez" },
                  })
                ).id,
              },
            ],
            expectedVersion: 0,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_VERSION_CONFLICT" });
    });

    it("is idempotent for a repeated idempotency key and does not double-write history", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "GIZ", nameAr: "الجيزة", nameEn: "Giza" },
      });
      const idempotencyKey = randomUUID();
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey },
      );
      const replay = await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey },
      );
      expect(replay.replayed).toBe(true);

      const historyCount = await h.db.providerAvailabilityHistory.count({
        where: { providerId: h.provider.id },
      });
      expect(historyCount).toBe(1);
    });

    it("raises a stable idempotency conflict for same key/different payload (repair item 4)", async () => {
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "PORT", nameAr: "بورسعيد", nameEn: "Port Said" },
      });
      const idempotencyKey = randomUUID();
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey },
      );

      const otherCity = await h.db.city.create({
        data: { countryId: h.country.id, code: "ISM", nameAr: "الإسماعيلية", nameEn: "Ismailia" },
      });
      await expect(
        h.availabilityService.replaceCoverage(
          { actorUserId: h.owner.id },
          h.provider.id,
          { selections: [{ type: "CITY", id: otherCity.id }], expectedVersion: 0, idempotencyKey },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
    });

    it("raises a stable idempotency conflict when a different actor reuses the same key (repair item 4)", async () => {
      const secondOwner = await createSecondProviderAdminActor(
        h.db,
        h.provider.id,
      );
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "LUX", nameAr: "الأقصر", nameEn: "Luxor" },
      });
      const idempotencyKey = randomUUID();
      await h.availabilityService.replaceCoverage(
        { actorUserId: h.owner.id },
        h.provider.id,
        { selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey },
      );
      await expect(
        h.availabilityService.replaceCoverage(
          { actorUserId: secondOwner.id },
          h.provider.id,
          { selections: [{ type: "CITY", id: city.id }], expectedVersion: 0, idempotencyKey },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
    });

    it("rejects coverage outside the Provider's own country (repair item 3)", async () => {
      const currency = await h.db.currency.findFirstOrThrow();
      const foreignCode = `Y${Math.floor(Math.random() * 10)}`;
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
          code: `RUH${randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase()}`,
          nameAr: `الرياض ${foreignCode}`,
          nameEn: `Riyadh ${foreignCode}`,
        },
      });
      await expect(
        h.availabilityService.replaceCoverage(
          { actorUserId: h.owner.id },
          h.provider.id,
          {
            selections: [{ type: "CITY", id: foreignCity.id }],
            expectedVersion: 0,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({
        code: "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
      });
    });

    it("rejects coverage entirely when the Provider has no configured country (repair item 3)", async () => {
      const owner = await h.db.user.create({
        data: {
          emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
          status: "ACTIVE",
          accountCategories: ["PROVIDER_OWNER"],
          verifiedCategories: ["PROVIDER_OWNER"],
          emailVerifiedAt: new Date(),
        },
      });
      const providerAdminRole = await h.db.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      await h.db.userRole.create({
        data: { userId: owner.id, roleId: providerAdminRole.id, status: "ENABLED", enabledAt: new Date() },
      });
      const countrylessProvider = await h.db.provider.create({
        data: {
          applicationOwnerUserId: owner.id,
          ownerUserId: owner.id,
          kind: "INDIVIDUAL_TEAM",
          applicationStatus: "APPROVED",
          approvedAt: new Date(),
          profile: { create: { countryId: null, displayNameEn: "No-country fixture" } },
          members: { create: { userId: owner.id, level: "OWNER", status: "ACTIVE", enabledAt: new Date() } },
        },
      });
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "TAN", nameAr: "طنطا", nameEn: "Tanta" },
      });
      await expect(
        h.availabilityService.replaceCoverage(
          { actorUserId: owner.id },
          countrylessProvider.id,
          {
            selections: [{ type: "CITY", id: city.id }],
            expectedVersion: 0,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({
        code: "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
      });
    });

    it("denies a Provider member with a disabled Provider Admin capability (repair item 2)", async () => {
      const member = await h.db.user.create({
        data: {
          emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
          status: "ACTIVE",
          accountCategories: ["PROVIDER_OWNER"],
          verifiedCategories: ["PROVIDER_OWNER"],
          emailVerifiedAt: new Date(),
        },
      });
      // No `provider_admin` UserRole grant for this member, even though it
      // has an active OWNER-equivalent membership row.
      await h.db.providerMember.create({
        data: {
          providerId: h.provider.id,
          userId: member.id,
          level: "ADMIN",
          status: "ACTIVE",
          enabledAt: new Date(),
        },
      });
      const city = await h.db.city.create({
        data: { countryId: h.country.id, code: "MAN", nameAr: "المنصورة", nameEn: "Mansoura" },
      });
      await expect(
        h.availabilityService.replaceCoverage(
          { actorUserId: member.id },
          h.provider.id,
          {
            selections: [{ type: "CITY", id: city.id }],
            expectedVersion: 0,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_FORBIDDEN" });
    });

    it("denies wrong Provider membership non-enumerating (repair item 2)", async () => {
      const outsider = await h.db.user.create({
        data: {
          emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
          status: "ACTIVE",
          accountCategories: ["PROVIDER_OWNER"],
          verifiedCategories: ["PROVIDER_OWNER"],
          emailVerifiedAt: new Date(),
        },
      });
      const providerAdminRole = await h.db.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      await h.db.userRole.create({
        data: { userId: outsider.id, roleId: providerAdminRole.id, status: "ENABLED", enabledAt: new Date() },
      });
      await expect(
        h.availabilityService.replaceCoverage(
          { actorUserId: outsider.id },
          h.provider.id,
          {
            selections: [{ type: "CITY", id: (
              await h.db.city.create({
                data: { countryId: h.country.id, code: "ASW", nameAr: "أسوان", nameEn: "Aswan" },
              })
            ).id }],
            expectedVersion: 0,
            idempotencyKey: randomUUID(),
          },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_NOT_FOUND" });
    });
  },
);

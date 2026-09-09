import { randomUUID } from "node:crypto";

import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

const MONDAY_MORNING_PROVIDER_PERIOD = {
  weekday: 1 as const,
  startMinute: 480,
  endMinute: 720,
  endsNextDay: false,
};

const MONDAY_0800_TO_1000_CAIRO = {
  startsAt: "2027-01-04T06:00:00.000Z",
  endsAt: "2027-01-04T08:00:00.000Z",
};

async function configureAvailableProvider(h: R1P10AvailabilityLiveHarness) {
  const city = await h.db.city.create({
    data: {
      countryId: h.country.id,
      code: `CAI${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      nameAr: "Cairo Arabic fixture",
      nameEn: "Cairo",
    },
  });
  const district = await h.db.district.create({
    data: {
      cityId: city.id,
      code: `NASR${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      nameAr: "Nasr City Arabic fixture",
      nameEn: "Nasr City",
    },
  });
  await h.availabilityService.replaceCoverage(
    { actorUserId: h.owner.id },
    h.provider.id,
    {
      selections: [{ type: "DISTRICT", id: district.id }],
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    },
  );
  await h.availabilityService.replaceCalendar(
    { actorUserId: h.owner.id },
    h.provider.id,
    {
      weeklyPeriods: [MONDAY_MORNING_PROVIDER_PERIOD],
      exceptions: [],
      expectedVersion: 1,
      idempotencyKey: randomUUID(),
    },
  );
  await h.capacityService.replaceCapacityRule(
    { actorUserId: h.owner.id },
    h.provider.id,
    {
      maxSimultaneousTeams: 2,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    },
  );
  await h.workerAvailabilityService.replaceWorkerCalendar(
    { actorUserId: h.owner.id },
    h.provider.id,
    h.worker.id,
    {
      weeklyPeriods: [MONDAY_MORNING_PROVIDER_PERIOD],
      exceptions: [],
      expectedVersion: h.worker.version,
      idempotencyKey: randomUUID(),
    },
  );
  await h.db.providerTeam.create({
    data: {
      providerId: h.provider.id,
      status: "ACTIVE",
      name: `Operational availability ${randomUUID()}`,
      normalizedName: `operational availability ${randomUUID()}`,
      memberships: {
        create: {
          workerId: h.worker.id,
          cleans: true,
        },
      },
    },
  });
  await h.db.provider.update({
    where: { id: h.provider.id },
    data: { operationalStatus: "LIVE" },
  });
  return { city, district };
}

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider operational availability public evaluation (live, T059)",
  () => {
    let h: R1P10AvailabilityLiveHarness;

    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
    });

    afterEach(async () => {
      await h?.close();
    });

    it("finds candidates and evaluates one Provider from one RepeatableRead snapshot without exposing contacts", async () => {
      const { city, district } = await configureAvailableProvider(h);

      const candidates =
        await h.operationalAvailabilityService.findCandidateProviderIdsForActiveTextualArea(
          {
            countryId: h.country.id,
            cityId: city.id,
            districtId: district.id,
          },
        );
      expect(candidates).toContain(h.provider.id);

      const evaluation =
        await h.operationalAvailabilityService.evaluateOneProviderOperationalAvailability(
          {
            providerId: h.provider.id,
            location: {
              countryId: h.country.id,
              cityId: city.id,
              districtId: district.id,
            },
            utcInterval: MONDAY_0800_TO_1000_CAIRO,
            requiredCompleteTeamUnits: 1,
          },
        );

      expect(evaluation).toMatchObject({
        providerId: h.provider.id,
        timeZone: "Africa/Cairo",
        coverageMatch: { matched: true, matchedBy: "DISTRICT" },
        availability: {
          available: true,
          runtimeAvailable: true,
          providerScheduleAvailable: true,
        },
        capacity: {
          availableUnits: 1,
          requiredCompleteTeamUnits: 1,
          sufficient: true,
        },
        blockerCodes: [],
      });
      expect(evaluation?.versions.availability).toBeGreaterThan(0);
      expect(evaluation?.versions.capacity).toBeGreaterThan(0);
      expect(evaluation?.versions.workforce).toBeGreaterThan(0);

      const serialized = JSON.stringify(evaluation);
      expect(serialized).not.toContain("operationalPhoneE164");
      expect(serialized).not.toContain("emailNormalized");
      expect(serialized).not.toContain(h.worker.id);
    });
  },
);

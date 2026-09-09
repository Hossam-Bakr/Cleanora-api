import { randomUUID } from "node:crypto";
import { hasExplicitR1P10TestDatabase } from "../../helpers/r1-p10-availability-fixtures.js";
import {
  createActiveProviderWorker,
  createR1P10AvailabilityLiveHarness,
  type R1P10AvailabilityLiveHarness,
} from "../../helpers/r1-p10-availability-live.js";

const MONDAY_MORNING_PROVIDER_PERIOD = {
  weekday: 1 as const,
  startMinute: 480,
  endMinute: 720,
  endsNextDay: false,
};

const MONDAY_0800_TO_1200_CAIRO = {
  start: new Date("2027-01-04T06:00:00.000Z"),
  end: new Date("2027-01-04T10:00:00.000Z"),
};

async function configureProviderCalendar(h: R1P10AvailabilityLiveHarness) {
  await h.availabilityService.replaceCalendar(
    { actorUserId: h.owner.id },
    h.provider.id,
    {
      weeklyPeriods: [MONDAY_MORNING_PROVIDER_PERIOD],
      exceptions: [],
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    },
  );
}

async function configureCapacity(
  h: R1P10AvailabilityLiveHarness,
  maxSimultaneousTeams: number,
) {
  await h.capacityService.replaceCapacityRule(
    { actorUserId: h.owner.id },
    h.provider.id,
    {
      maxSimultaneousTeams,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    },
  );
}

async function createAvailableWorker(h: R1P10AvailabilityLiveHarness) {
  const worker = await createActiveProviderWorker(h.db, h.provider.id);
  await h.workerAvailabilityService.replaceWorkerCalendar(
    { actorUserId: h.owner.id },
    h.provider.id,
    worker.id,
    {
      weeklyPeriods: [MONDAY_MORNING_PROVIDER_PERIOD],
      exceptions: [],
      expectedVersion: worker.version,
      idempotencyKey: randomUUID(),
    },
  );
  return worker;
}

async function createTeamWithMembers(
  h: R1P10AvailabilityLiveHarness,
  members: readonly { readonly workerId: string; readonly cleans: boolean }[],
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const name = `Capacity team ${suffix}`;
  return h.db.providerTeam.create({
    data: {
      providerId: h.provider.id,
      status: "ACTIVE",
      name,
      normalizedName: name.toLowerCase(),
      memberships: {
        create: members.map((member) => ({
          workerId: member.workerId,
          cleans: member.cleans,
        })),
      },
    },
  });
}

describe.skipIf(!hasExplicitR1P10TestDatabase())(
  "Provider complete-Team capacity evaluation (live)",
  () => {
    let h: R1P10AvailabilityLiveHarness;
    beforeEach(async () => {
      h = await createR1P10AvailabilityLiveHarness();
      await configureProviderCalendar(h);
    });
    afterEach(async () => {
      await h?.close();
    });

    it("reports three complete available Teams capped by a limit of two; unteamed Workers add no capacity", async () => {
      await configureCapacity(h, 2);
      const workers = [];
      for (let index = 0; index < 4; index += 1) {
        workers.push(await createAvailableWorker(h));
      }
      for (const worker of workers.slice(0, 3)) {
        await createTeamWithMembers(h, [{ workerId: worker.id, cleans: true }]);
      }

      const result = await h.capacityService.evaluateCompleteTeamCapacity({
        providerId: h.provider.id,
        intervalStart: MONDAY_0800_TO_1200_CAIRO.start,
        intervalEnd: MONDAY_0800_TO_1200_CAIRO.end,
        requestedUnits: 3,
      });

      expect(result.countryTimeZone).toBe("Africa/Cairo");
      expect(result.completeAvailableTeamCount).toBe(3);
      expect(result.availableUnits).toBe(2);
      expect(result.sufficient).toBe(false);
      expect(result.blockers).toEqual([]);
    });

    it("ignores an incomplete Team without blocking another complete Team", async () => {
      await configureCapacity(h, 3);
      const worker = await createAvailableWorker(h);
      await h.db.providerTeam.create({
        data: {
          providerId: h.provider.id,
          status: "DRAFT",
          name: "Incomplete capacity team",
          normalizedName: "incomplete capacity team",
        },
      });
      await createTeamWithMembers(h, [{ workerId: worker.id, cleans: true }]);

      const result = await h.capacityService.evaluateCompleteTeamCapacity({
        providerId: h.provider.id,
        intervalStart: MONDAY_0800_TO_1200_CAIRO.start,
        intervalEnd: MONDAY_0800_TO_1200_CAIRO.end,
        requestedUnits: 1,
      });

      expect(result.completeAvailableTeamCount).toBe(1);
      expect(result.availableUnits).toBe(1);
      expect(result.sufficient).toBe(true);
      expect(result.teamResults).toContainEqual(
        expect.objectContaining({
          completeAvailable: false,
          blockers: expect.arrayContaining([
            "TEAM_HAS_NO_CURRENT_MEMBERS",
            "TEAM_HAS_NO_CLEANER",
          ]),
        }),
      );
    });

    it("requires every current member, including a non-cleaner, to be available for the full interval", async () => {
      await configureCapacity(h, 2);
      const cleaner = await createAvailableWorker(h);
      const unavailableEscort = await createActiveProviderWorker(
        h.db,
        h.provider.id,
        { workerType: "ESCORT", fullLegalName: "Unavailable Escort" },
      );
      await h.workerAvailabilityService.replaceWorkerCalendar(
        { actorUserId: h.owner.id },
        h.provider.id,
        unavailableEscort.id,
        {
          weeklyPeriods: [
            {
              weekday: 1,
              startMinute: 480,
              endMinute: 600,
              endsNextDay: false,
            },
          ],
          exceptions: [],
          expectedVersion: unavailableEscort.version,
          idempotencyKey: randomUUID(),
        },
      );
      await createTeamWithMembers(h, [
        { workerId: cleaner.id, cleans: true },
        { workerId: unavailableEscort.id, cleans: false },
      ]);

      const result = await h.capacityService.evaluateCompleteTeamCapacity({
        providerId: h.provider.id,
        intervalStart: MONDAY_0800_TO_1200_CAIRO.start,
        intervalEnd: MONDAY_0800_TO_1200_CAIRO.end,
      });

      expect(result.availableUnits).toBe(0);
      expect(result.teamResults[0]?.blockers).toContain(
        "TEAM_MEMBER_UNAVAILABLE",
      );
    });

    it("short-circuits runtime capacity to zero for suspension or overlapping pause", async () => {
      await configureCapacity(h, 1);
      const worker = await createAvailableWorker(h);
      await createTeamWithMembers(h, [{ workerId: worker.id, cleans: true }]);

      await h.availabilityService.startPause(
        { actorUserId: h.owner.id },
        h.provider.id,
        {
          expectedVersion: 0,
          idempotencyKey: randomUUID(),
          endsAt: new Date("2027-01-04T07:00:00.000Z"),
        },
      );
      const paused = await h.capacityService.evaluateCompleteTeamCapacity({
        providerId: h.provider.id,
        intervalStart: MONDAY_0800_TO_1200_CAIRO.start,
        intervalEnd: MONDAY_0800_TO_1200_CAIRO.end,
      });
      expect(paused.availableUnits).toBe(0);
      expect(paused.blockers).toEqual(["PAUSE"]);

      await h.db.providerTemporaryPause.updateMany({
        where: { providerId: h.provider.id, resumedAt: null },
        data: { resumedAt: new Date("2027-01-04T05:00:00.000Z") },
      });
      await h.db.provider.update({
        where: { id: h.provider.id },
        data: {
          operationalStatus: "SUSPENDED",
          suspendedAt: new Date(),
        },
      });
      const suspended = await h.capacityService.evaluateCompleteTeamCapacity({
        providerId: h.provider.id,
        intervalStart: MONDAY_0800_TO_1200_CAIRO.start,
        intervalEnd: MONDAY_0800_TO_1200_CAIRO.end,
      });
      expect(suspended.availableUnits).toBe(0);
      expect(suspended.blockers).toEqual(["SUSPENDED"]);
    });
  },
);

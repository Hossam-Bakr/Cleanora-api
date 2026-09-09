/**
 * Pure fake/mock-backed tests for `PrismaLocalityRepository`'s command
 * reservation path (repair items 3 and 4). Mirrors
 * `provider-availability-repository-reservation.test.ts`: a
 * `findUnique`-after-failed-`create` pattern is unsafe on PostgreSQL because
 * a unique violation aborts the whole interactive transaction, so this
 * repository must use `createMany({ skipDuplicates: true })` and read back
 * the winner when it reserves zero rows. DB-gated concurrency proof remains
 * a separate, explicitly unavailable-in-this-batch live test.
 */
import { createPrismaLocalityRepository } from "../../../src/modules/configuration/infrastructure/prisma-locality.repository.js";

type FakeLocalityCommandRow = {
  readonly status: "IN_PROGRESS" | "ACCEPTED";
  readonly requestFingerprint: string;
  readonly actorUserId: string;
  readonly safeResultJson: unknown;
};

function fakeDatabase(options: {
  readonly existingRow: FakeLocalityCommandRow | null;
  readonly onCreateMany?: () => void;
}) {
  let stored = options.existingRow;
  return {
    configurationLocalityCommand: {
      async findUnique() {
        return stored;
      },
      async createMany() {
        options.onCreateMany?.();
        if (stored !== null) {
          return { count: 0 };
        }
        stored = {
          status: "IN_PROGRESS",
          requestFingerprint: "fp-reserved",
          actorUserId: "actor-reserved",
          safeResultJson: null,
        };
        return { count: 1 };
      },
    },
  };
}

describe("PrismaLocalityRepository.reserveOrReplayCommand (repair item 3)", () => {
  it("reserves via createMany (skipDuplicates) and never issues a plain create/P2002 recovery", async () => {
    let createManyCalls = 0;
    const repository = createPrismaLocalityRepository(
      fakeDatabase({
        existingRow: null,
        onCreateMany: () => {
          createManyCalls += 1;
        },
      }),
    );
    const receipt = await repository.reserveOrReplayCommand({
      scopeKey: "configuration:locality:city.create:country-1",
      idempotencyKey: "10101010-1010-1010-1010-101010101010",
      requestFingerprint: "fp-1",
      actorUserId: "actor-1",
    });
    expect(receipt).toEqual({ status: "PROCEED" });
    expect(createManyCalls).toBe(1);
  });

  it("resolves a concurrent reservation race (createMany count 0) by reading back the winner as a replay", async () => {
    const repository = createPrismaLocalityRepository(
      fakeDatabase({
        existingRow: {
          status: "ACCEPTED",
          requestFingerprint: "fp-1",
          actorUserId: "actor-1",
          safeResultJson: { code: "CAI" },
        },
      }),
    );
    const receipt = await repository.reserveOrReplayCommand({
      scopeKey: "configuration:locality:city.create:country-1",
      idempotencyKey: "20202020-2020-2020-2020-202020202020",
      requestFingerprint: "fp-1",
      actorUserId: "actor-1",
    });
    expect(receipt).toEqual({ status: "REPLAYED", safeResultJson: { code: "CAI" } });
  });

  it("raises a stable idempotency conflict when the raced winner has a different actor (repair item 4)", async () => {
    const repository = createPrismaLocalityRepository(
      fakeDatabase({
        existingRow: {
          status: "ACCEPTED",
          requestFingerprint: "fp-1",
          actorUserId: "actor-original",
          safeResultJson: { code: "CAI" },
        },
      }),
    );
    await expect(
      repository.reserveOrReplayCommand({
        scopeKey: "configuration:locality:city.create:country-1",
        idempotencyKey: "30303030-3030-3030-3030-303030303030",
        requestFingerprint: "fp-1",
        actorUserId: "actor-different",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });

  it("raises a stable idempotency conflict when the raced winner has a different fingerprint", async () => {
    const repository = createPrismaLocalityRepository(
      fakeDatabase({
        existingRow: {
          status: "ACCEPTED",
          requestFingerprint: "fp-original",
          actorUserId: "actor-1",
          safeResultJson: { code: "CAI" },
        },
      }),
    );
    await expect(
      repository.reserveOrReplayCommand({
        scopeKey: "configuration:locality:city.create:country-1",
        idempotencyKey: "40404040-4040-4040-4040-404040404040",
        requestFingerprint: "fp-different",
        actorUserId: "actor-1",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });

  it("does not treat the raced winner as a replay while it is still IN_PROGRESS", async () => {
    const repository = createPrismaLocalityRepository(
      fakeDatabase({
        existingRow: {
          status: "IN_PROGRESS",
          requestFingerprint: "fp-1",
          actorUserId: "actor-1",
          safeResultJson: null,
        },
      }),
    );
    await expect(
      repository.reserveOrReplayCommand({
        scopeKey: "configuration:locality:city.create:country-1",
        idempotencyKey: "50505050-5050-5050-5050-505050505050",
        requestFingerprint: "fp-1",
        actorUserId: "actor-1",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_COMMAND_IN_PROGRESS" });
  });
});

describe("PrismaLocalityRepository persistence error mapping", () => {
  it("maps a concurrent unique violation instead of leaking Prisma P2002", async () => {
    const repository = createPrismaLocalityRepository({
      city: {
        async create() {
          throw { code: "P2002" };
        },
      },
    });

    await expect(
      repository.insertCity({
        countryId: "country-1",
        code: "CAI",
        nameAr: "القاهرة",
        nameEn: "Cairo",
      }),
    ).rejects.toMatchObject({
      code: "LOCALITY_ALREADY_EXISTS",
      details: { reason: "UNIQUE_CONSTRAINT_CONFLICT" },
    });
  });
});

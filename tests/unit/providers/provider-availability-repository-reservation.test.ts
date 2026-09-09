/**
 * Pure fake/mock-backed tests for `PrismaProviderAvailabilityRepository`'s
 * command reservation path (repair items 3 and 4). These exercise the exact
 * `createMany({ skipDuplicates: true })`-then-read-winner logic without a
 * live PostgreSQL connection: a `findUnique`-after-failed-`create` pattern is
 * unsafe on PostgreSQL because a unique violation aborts the whole
 * interactive transaction, so this repository must never rely on catching
 * P2002 from a plain `create`. DB-gated concurrency proof remains a separate,
 * explicitly unavailable-in-this-batch live test.
 */
import { PrismaProviderAvailabilityRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-availability.repository.js";
import type { ProviderIdentityReader } from "../../../src/modules/authentication/authentication.public.js";

function fakeIdentityReader(): ProviderIdentityReader {
  return {
    async getIdentity() {
      return null;
    },
    async findByEmailNormalized() {
      return null;
    },
  };
}

type FakeCommandRow = {
  readonly status: "IN_PROGRESS" | "ACCEPTED";
  readonly requestFingerprint: string;
  readonly actorUserId: string;
  readonly safeResultJson: unknown;
};

/**
 * @desc Build a fake `providerAvailabilityCommand` Prisma delegate that
 * never throws a unique-constraint error: `createMany` reports `count: 0`
 * exactly like PostgreSQL's `INSERT ... ON CONFLICT DO NOTHING` would when
 * another transaction already committed the winning row.
 */
function fakeDatabase(options: {
  readonly existingRow: FakeCommandRow | null;
  readonly onCreateMany?: () => void;
}) {
  let stored = options.existingRow;
  return {
    providerAvailabilityCommand: {
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

describe("PrismaProviderAvailabilityRepository.reserveOrReplayCoverageCommand (repair item 3)", () => {
  it("reserves via createMany (skipDuplicates) and never issues a plain create/P2002 recovery", async () => {
    let createManyCalls = 0;
    const database = fakeDatabase({
      existingRow: null,
      onCreateMany: () => {
        createManyCalls += 1;
      },
    });
    const repository = new PrismaProviderAvailabilityRepository(
      database as never,
      fakeIdentityReader(),
    );
    const receipt = await repository.reserveOrReplayCoverageCommand({
      providerId: "provider-1",
      idempotencyKey: "10101010-1010-1010-1010-101010101010",
      requestFingerprint: "fp-1",
      actorUserId: "actor-1",
    });
    expect(receipt).toEqual({ status: "PROCEED" });
    expect(createManyCalls).toBe(1);
  });

  it("resolves a concurrent reservation race (createMany count 0) by reading back the winner as a replay", async () => {
    const database = fakeDatabase({
      existingRow: {
        status: "ACCEPTED",
        requestFingerprint: "fp-1",
        actorUserId: "actor-1",
        safeResultJson: { coverage: [] },
      },
    });
    const repository = new PrismaProviderAvailabilityRepository(
      database as never,
      fakeIdentityReader(),
    );
    const receipt = await repository.reserveOrReplayCoverageCommand({
      providerId: "provider-1",
      idempotencyKey: "20202020-2020-2020-2020-202020202020",
      requestFingerprint: "fp-1",
      actorUserId: "actor-1",
    });
    expect(receipt).toEqual({ status: "REPLAYED", safeResultJson: { coverage: [] } });
  });

  it("raises a stable idempotency conflict when the raced winner has a different actor (repair item 4)", async () => {
    const database = fakeDatabase({
      existingRow: {
        status: "ACCEPTED",
        requestFingerprint: "fp-1",
        actorUserId: "actor-original",
        safeResultJson: { coverage: [] },
      },
    });
    const repository = new PrismaProviderAvailabilityRepository(
      database as never,
      fakeIdentityReader(),
    );
    await expect(
      repository.reserveOrReplayCoverageCommand({
        providerId: "provider-1",
        idempotencyKey: "30303030-3030-3030-3030-303030303030",
        requestFingerprint: "fp-1",
        actorUserId: "actor-different",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
  });

  it("raises a stable idempotency conflict when the raced winner has a different fingerprint", async () => {
    const database = fakeDatabase({
      existingRow: {
        status: "ACCEPTED",
        requestFingerprint: "fp-original",
        actorUserId: "actor-1",
        safeResultJson: { coverage: [] },
      },
    });
    const repository = new PrismaProviderAvailabilityRepository(
      database as never,
      fakeIdentityReader(),
    );
    await expect(
      repository.reserveOrReplayCoverageCommand({
        providerId: "provider-1",
        idempotencyKey: "40404040-4040-4040-4040-404040404040",
        requestFingerprint: "fp-different",
        actorUserId: "actor-1",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT" });
  });

  it("does not treat the raced winner as a replay while it is still IN_PROGRESS", async () => {
    const database = fakeDatabase({
      existingRow: {
        status: "IN_PROGRESS",
        requestFingerprint: "fp-1",
        actorUserId: "actor-1",
        safeResultJson: null,
      },
    });
    const repository = new PrismaProviderAvailabilityRepository(
      database as never,
      fakeIdentityReader(),
    );
    await expect(
      repository.reserveOrReplayCoverageCommand({
        providerId: "provider-1",
        idempotencyKey: "50505050-5050-5050-5050-505050505050",
        requestFingerprint: "fp-1",
        actorUserId: "actor-1",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_AVAILABILITY_COMMAND_IN_PROGRESS" });
  });
});

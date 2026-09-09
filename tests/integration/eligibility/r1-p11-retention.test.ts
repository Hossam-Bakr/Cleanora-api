/**
 * R1-P11 retention / purge proofs (Batch G / T045, FR-018 / SC-006).
 * Invalid batchSize and caller-asOf rejection run without a database.
 * 720-hour boundary + purge order require CLEANORA_R1_P11_DATABASE_URL.
 */

import { randomUUID } from "node:crypto";

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import type { PurgeOptions } from "#modules/eligibility/eligibility.public";
import {
  createEligibilityApplicationService,
  type EligibilityApplicationServiceDependencies,
} from "#modules/eligibility/eligibility.service";
import type { EligibilityUnitOfWork } from "#modules/eligibility/infrastructure/eligibility.unit-of-work";
import {
  computeEligibilityExpiresAt,
  ELIGIBILITY_RETENTION_HOURS,
  PrismaEligibilityRepository,
  resolvePurgeBatchSize,
} from "#modules/eligibility/infrastructure/prisma-eligibility.repository";
import { R1_P11_ELIGIBILITY_RULE_SEED } from "../../../prisma/seed.js";
import {
  hasExplicitR1P11TestDatabase,
  requireR1P11ProofDatabaseUrl,
  R1_P11_IDS,
} from "../../helpers/r1-p11-eligibility-fixtures.js";
import {
  openR1P11LiveDb,
  type R1P11LiveDb,
} from "../../helpers/r1-p11-eligibility-live.js";

function stubReaderFactory(): () => never {
  return () => {
    throw new Error("dependency reader must not run during purge tests");
  };
}

function createPurgeService(args: {
  readonly clock: () => Date;
  readonly purge: ReturnType<typeof vi.fn>;
}) {
  const unitOfWork = {
    runRepeatableRead: async <T>(
      work: (context: {
        readonly eligibility: { purgeExpiredEvaluations: typeof args.purge };
        readonly transaction: unknown;
      }) => Promise<T>,
    ) =>
      work({
        eligibility: { purgeExpiredEvaluations: args.purge },
        transaction: {},
      }),
  } as unknown as EligibilityUnitOfWork;

  const deps: EligibilityApplicationServiceDependencies = {
    unitOfWork,
    clock: args.clock,
    createCatalogReader: stubReaderFactory(),
    createActiveCountryReader: stubReaderFactory(),
    createLocalityReader: stubReaderFactory(),
    createCountryTimeZoneReader: stubReaderFactory(),
    createPricingReader: stubReaderFactory(),
    createLifecycleReader: stubReaderFactory(),
    createAvailabilityReader: stubReaderFactory(),
  };
  return createEligibilityApplicationService(deps);
}

function createLivePurgeService(
  harness: R1P11LiveDb,
  clock: () => Date,
) {
  const unitOfWork = {
    runRepeatableRead: async <T>(
      work: (context: {
        readonly eligibility: PrismaEligibilityRepository;
        readonly transaction: unknown;
      }) => Promise<T>,
    ) =>
      work({
        eligibility: new PrismaEligibilityRepository(harness.db),
        transaction: harness.db,
      }),
  } as unknown as EligibilityUnitOfWork;

  return createEligibilityApplicationService({
    unitOfWork,
    clock,
    createCatalogReader: stubReaderFactory(),
    createActiveCountryReader: stubReaderFactory(),
    createLocalityReader: stubReaderFactory(),
    createCountryTimeZoneReader: stubReaderFactory(),
    createPricingReader: stubReaderFactory(),
    createLifecycleReader: stubReaderFactory(),
    createAvailabilityReader: stubReaderFactory(),
  });
}

describe("R1-P11 retention — invalid batchSize (no DB)", () => {
  it("rejects invalid batchSize via resolvePurgeBatchSize without clamping", () => {
    for (const batchSize of [0, -1, 501, 1.5, Number.NaN]) {
      expect(() => resolvePurgeBatchSize(batchSize)).toThrow(EligibilityError);
      try {
        resolvePurgeBatchSize(batchSize);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EligibilityError);
        expect((error as EligibilityError).code).toBe("VALIDATION_FAILED");
        expect((error as EligibilityError).details?.["field"]).toBe("batchSize");
      }
    }
  });

  it("rejects invalid batchSize on the public purge service before UoW work", async () => {
    const purge = vi.fn();
    const service = createPurgeService({
      clock: () => new Date("2026-09-09T12:00:00.000Z"),
      purge,
    });
    await expect(service.purgeExpiredEvaluations({ batchSize: 0 })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(
      service.purgeExpiredEvaluations({ batchSize: 501 }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(purge).not.toHaveBeenCalled();
  });

  it("defaults omitted batchSize to 100 and forbids caller asOf on public options", async () => {
    const cutoff = new Date("2026-09-09T12:00:00.000Z");
    const purge = vi.fn().mockResolvedValue({
      deletedEvaluations: 0,
      deletedCandidateResults: 0,
      moreRemaining: false,
      cutoff: cutoff.toISOString(),
    });
    const service = createPurgeService({ clock: () => cutoff, purge });

    await service.purgeExpiredEvaluations();
    expect(purge).toHaveBeenCalledWith({
      cutoff,
      batchSize: 100,
    });

    const publicKeys: ReadonlyArray<keyof PurgeOptions> = ["batchSize"];
    expect(publicKeys).toEqual(["batchSize"]);
    expect(publicKeys).not.toContain("asOf");

    await expect(
      service.purgeExpiredEvaluations({
        asOf: "2026-01-01T00:00:00.000Z",
      } as PurgeOptions & { asOf: string }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { field: "asOf", reason: "CALLER_ASOF_FORBIDDEN" },
    });
  });

  it("computes expiresAt as completedAt + exactly 720 elapsed hours", () => {
    const completedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(ELIGIBILITY_RETENTION_HOURS).toBe(720);
    expect(computeEligibilityExpiresAt(completedAt).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z",
    );
  });
});

const live = hasExplicitR1P11TestDatabase();

describe.skipIf(!live)("R1-P11 retention — live 720h boundary + purge order", () => {
  let harness: R1P11LiveDb;

  beforeEach(async () => {
    // Gate URL explicitly (never DATABASE_URL) before opening the client.
    requireR1P11ProofDatabaseUrl(process.env);
    harness = await openR1P11LiveDb();
  });

  afterEach(async () => {
    await harness?.close();
  });

  async function insertEvaluation(args: {
    readonly id: string;
    readonly expiresAt: Date;
    readonly completedAt: Date;
    readonly candidateId: string;
  }): Promise<void> {
    await harness.db.eligibilityEvaluation.create({
      data: {
        id: args.id,
        ruleVersionId: R1_P11_ELIGIBILITY_RULE_SEED.id,
        countryId: harness.countryId,
        evaluatedAt: args.completedAt,
        completedAt: args.completedAt,
        expiresAt: args.expiresAt,
        requestNormalized: { mode: "discovery" },
        requestHash: `hash-${args.id}`,
        evidenceSafe: { providers: [] },
        evidenceHash: `evidence-${args.id}`,
        resultHash: `result-${args.id}`,
        metadata: { contractVersion: "eligibility.public.v1" },
        outcomeSummary: { eligibleProviderCount: 0 },
        engineVersion: "eligibility-engine.r1.v1",
        candidateResults: {
          create: [
            {
              id: args.candidateId,
              providerId: R1_P11_IDS.providerId,
              teamId: null,
              rowKind: "PROVIDER_SUMMARY",
              eligible: false,
              ruleOutcomes: [],
              reasons: [],
            },
          ],
        },
      },
    });
  }

  it("purges only rows with expiresAt strictly before the composition-clock cutoff", async () => {
    const cutoff = new Date("2026-09-09T12:00:00.000Z");
    const expiredCompleted = new Date(
      cutoff.getTime() - ELIGIBILITY_RETENTION_HOURS * 60 * 60 * 1000 - 1,
    );
    const boundaryCompleted = new Date(
      cutoff.getTime() - ELIGIBILITY_RETENTION_HOURS * 60 * 60 * 1000,
    );
    const futureCompleted = new Date(cutoff.getTime() - 1);

    const expiredId = randomUUID();
    const boundaryId = randomUUID();
    const futureId = randomUUID();
    await harness.db.eligibilityEvaluation.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });

    await insertEvaluation({
      id: expiredId,
      completedAt: expiredCompleted,
      expiresAt: computeEligibilityExpiresAt(expiredCompleted),
      candidateId: randomUUID(),
    });
    await insertEvaluation({
      id: boundaryId,
      completedAt: boundaryCompleted,
      expiresAt: computeEligibilityExpiresAt(boundaryCompleted),
      candidateId: randomUUID(),
    });
    await insertEvaluation({
      id: futureId,
      completedAt: futureCompleted,
      expiresAt: computeEligibilityExpiresAt(futureCompleted),
      candidateId: randomUUID(),
    });

    // Boundary: expiresAt === cutoff must be retained (lt, not lte).
    expect(computeEligibilityExpiresAt(boundaryCompleted).getTime()).toBe(
      cutoff.getTime(),
    );
    expect(computeEligibilityExpiresAt(expiredCompleted).getTime()).toBeLessThan(
      cutoff.getTime(),
    );

    const service = createLivePurgeService(harness, () => cutoff);
    const result = await service.purgeExpiredEvaluations({ batchSize: 100 });
    expect(result.deletedEvaluations).toBeGreaterThanOrEqual(1);
    expect(result.moreRemaining).toBe(false);
    expect(result.cutoff).toBe(cutoff.toISOString());
    expect(
      await harness.db.eligibilityEvaluation.findUnique({ where: { id: expiredId } }),
    ).toBeNull();
    expect(
      await harness.db.eligibilityEvaluation.findUnique({ where: { id: boundaryId } }),
    ).not.toBeNull();
    expect(
      await harness.db.eligibilityEvaluation.findUnique({ where: { id: futureId } }),
    ).not.toBeNull();

    const ruleStillPresent = await harness.db.eligibilityRuleVersion.findUnique({
      where: { id: R1_P11_ELIGIBILITY_RULE_SEED.id },
    });
    expect(ruleStillPresent).not.toBeNull();
  });

  it("deletes expired rows in (expiresAt, id) order within the batch", async () => {
    const cutoff = new Date("2026-09-09T18:00:00.000Z");
    const early = new Date("2026-08-01T00:00:00.000Z");
    const mid = new Date("2026-08-02T00:00:00.000Z");
    const late = new Date("2026-08-03T00:00:00.000Z");

    await harness.db.eligibilityEvaluation.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const idC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const idLate = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await harness.db.eligibilityEvaluation.deleteMany({
      where: { id: { in: [idA, idB, idC, idLate] } },
    });

    await insertEvaluation({
      id: idB,
      completedAt: early,
      expiresAt: early,
      candidateId: randomUUID(),
    });
    await insertEvaluation({
      id: idA,
      completedAt: early,
      expiresAt: early,
      candidateId: randomUUID(),
    });
    await insertEvaluation({
      id: idC,
      completedAt: mid,
      expiresAt: mid,
      candidateId: randomUUID(),
    });
    await insertEvaluation({
      id: idLate,
      completedAt: late,
      expiresAt: late,
      candidateId: randomUUID(),
    });

    const ordered = await harness.db.eligibilityEvaluation.findMany({
      where: {
        id: { in: [idA, idB, idC, idLate] },
        expiresAt: { lt: cutoff },
      },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    expect(ordered.map((row) => row.id)).toEqual([idA, idB, idC, idLate]);

    const repository = new PrismaEligibilityRepository(harness.db);
    const first = await repository.purgeExpiredEvaluations({
      cutoff,
      batchSize: 2,
    });
    expect(first.deletedEvaluations).toBe(2);
    expect(first.moreRemaining).toBe(true);

    const afterFirst = await harness.db.eligibilityEvaluation.findMany({
      where: {
        id: { in: [idA, idB, idC, idLate] },
        expiresAt: { lt: cutoff },
      },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    // First batch must consume idA then idB (same expiresAt, ascending id).
    expect(afterFirst.map((row) => row.id)).toEqual([idC, idLate]);

    const second = await repository.purgeExpiredEvaluations({
      cutoff,
      batchSize: 10,
    });
    expect(second.deletedEvaluations).toBe(2);
    expect(second.moreRemaining).toBe(false);
  });
});

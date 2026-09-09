/**
 * PrismaEligibilityRepository purge paths with a fake Prisma client.
 */

import {
  createPrismaEligibilityRepository,
  PrismaEligibilityRepository,
  resolvePurgeBatchSize,
} from "#modules/eligibility/infrastructure/prisma-eligibility.repository";

describe("PrismaEligibilityRepository purge (fake client)", () => {
  it("returns zero deletes when nothing is expired", async () => {
    const db = {
      eligibilityEvaluation: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
      },
      eligibilityCandidateResult: {
        count: vi.fn(),
      },
      eligibilityRuleVersion: {
        findFirst: vi.fn(),
      },
    };
    const repository = new PrismaEligibilityRepository(db as never);
    const cutoff = new Date("2026-09-09T12:00:00.000Z");
    await expect(
      repository.purgeExpiredEvaluations({ cutoff, batchSize: 10 }),
    ).resolves.toEqual({
      deletedEvaluations: 0,
      deletedCandidateResults: 0,
      moreRemaining: false,
      cutoff: cutoff.toISOString(),
    });
    expect(db.eligibilityEvaluation.deleteMany).not.toHaveBeenCalled();
  });

  it("looks ahead one row past batchSize for moreRemaining", async () => {
    const db = {
      eligibilityEvaluation: {
        findMany: vi.fn().mockResolvedValue([
          { id: "e1" },
          { id: "e2" },
          { id: "e3" },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      eligibilityCandidateResult: {
        count: vi.fn().mockResolvedValue(4),
      },
    };
    const repository = new PrismaEligibilityRepository(db as never);
    const cutoff = new Date("2026-09-09T12:00:00.000Z");
    const result = await repository.purgeExpiredEvaluations({
      cutoff,
      batchSize: 2,
    });
    expect(result).toEqual({
      deletedEvaluations: 2,
      deletedCandidateResults: 4,
      moreRemaining: true,
      cutoff: cutoff.toISOString(),
    });
    expect(db.eligibilityEvaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      }),
    );
    expect(db.eligibilityEvaluation.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1", "e2"] } },
    });
  });

  it("maps findEffectiveRuleVersion null/present", async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "rule-1",
      countryId: "c1",
      versionLabel: "r1-v1",
      schemaVersion: "1",
      engineCompatibility: "eligibility-engine.r1.v1",
      ruleOrder: [],
      parameters: {},
      effectiveFrom: new Date(),
      contentChecksum: "x",
      createdAt: new Date(),
      createdByProvenance: "test",
    });
    const repository = new PrismaEligibilityRepository({
      eligibilityRuleVersion: { findFirst },
    } as never);
    await expect(
      repository.findEffectiveRuleVersion({
        countryId: "c1",
        evaluatedAt: new Date(),
      }),
    ).resolves.toBeNull();
    const found = await repository.findEffectiveRuleVersion({
      countryId: "c1",
      evaluatedAt: new Date(),
    });
    expect(found?.id).toBe("rule-1");
    expect(resolvePurgeBatchSize(25)).toBe(25);
  });

  it("inserts evaluation with candidates and maps optional null fields", async () => {
    const create = vi.fn().mockResolvedValue({});
    const db = {
      eligibilityEvaluation: { create },
      eligibilityCandidateResult: { count: vi.fn() },
      eligibilityRuleVersion: { findFirst: vi.fn() },
    };
    const repository = createPrismaEligibilityRepository(db as never);
    const result = await repository.insertEvaluationWithCandidates({
      id: "eval-1",
      ruleVersionId: "rule-1",
      countryId: "c1",
      evaluatedAt: new Date("2026-09-09T12:00:00.000Z"),
      completedAt: new Date("2026-09-09T12:00:00.000Z"),
      expiresAt: new Date("2026-10-09T12:00:00.000Z"),
      requestNormalized: {},
      requestHash: "rh",
      evidenceSafe: {},
      evidenceHash: "eh",
      resultHash: "rsh",
      metadata: {},
      outcomeSummary: {},
      traceId: null,
      engineVersion: "eligibility-engine.r1.v1",
      candidates: [
        {
          id: "cand-1",
          providerId: "p1",
          teamId: null,
          rowKind: "PROVIDER_SUMMARY",
          eligible: false,
          ruleOutcomes: [],
          reasons: [],
          sortingFacts: null,
          diagnosticsSafe: null,
        },
        {
          id: "cand-2",
          providerId: "p1",
          teamId: "t1",
          rowKind: "TEAM_RESULT",
          eligible: true,
          ruleOutcomes: [],
          reasons: [],
          sortingFacts: { priceAmount: "10.00" },
          diagnosticsSafe: { note: "safe" },
          createdAt: new Date("2026-09-09T12:00:00.000Z"),
        },
      ],
    });
    expect(result).toEqual({ evaluationId: "eval-1" });
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0]?.[0]?.data as {
      traceId: null;
      candidateResults: { create: unknown[] };
    };
    expect(data.traceId).toBeNull();
    expect(data.candidateResults.create).toHaveLength(2);
  });

  it("purges a full batch without moreRemaining when lookahead is empty", async () => {
    const db = {
      eligibilityEvaluation: {
        findMany: vi.fn().mockResolvedValue([{ id: "e1" }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      eligibilityCandidateResult: {
        count: vi.fn().mockResolvedValue(2),
      },
    };
    const repository = new PrismaEligibilityRepository(db as never);
    await expect(
      repository.purgeExpiredEvaluations({
        cutoff: new Date("2026-09-09T12:00:00.000Z"),
        batchSize: 10,
      }),
    ).resolves.toEqual({
      deletedEvaluations: 1,
      deletedCandidateResults: 2,
      moreRemaining: false,
      cutoff: "2026-09-09T12:00:00.000Z",
    });
  });
});

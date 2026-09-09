/**
 * Prisma-backed Eligibility persistence (R1-P11 Batch B).
 *
 * Owns atomic evaluation+candidate inserts, effective rule-version selection,
 * and expired-evaluation purge. Partial XOR/unique constraints live in SQL;
 * this repository never invents live Provider/Team FKs (DEC-082).
 */

import type { Prisma, PrismaClient } from "#generated/prisma/client";
import { EligibilityCandidateRowKind, Prisma as PrismaNamespace } from "#generated/prisma/client";

import { EligibilityError } from "../eligibility.errors.js";
import type { PurgeResult } from "../eligibility.public.js";

type EligibilityDatabase = Pick<
  Prisma.TransactionClient,
  "eligibilityRuleVersion" | "eligibilityEvaluation" | "eligibilityCandidateResult"
>;

export const ELIGIBILITY_ENGINE_COMPATIBILITY = "eligibility-engine.r1.v1" as const;
export const ELIGIBILITY_RETENTION_HOURS = 720 as const;
export const ELIGIBILITY_PURGE_BATCH_DEFAULT = 100 as const;
export const ELIGIBILITY_PURGE_BATCH_MIN = 1 as const;
export const ELIGIBILITY_PURGE_BATCH_MAX = 500 as const;

export type EligibilityRuleVersionRecord = {
  readonly id: string;
  readonly countryId: string;
  readonly versionLabel: string;
  readonly schemaVersion: string;
  readonly engineCompatibility: string;
  readonly ruleOrder: Prisma.JsonValue;
  readonly parameters: Prisma.JsonValue;
  readonly effectiveFrom: Date;
  readonly contentChecksum: string;
  readonly createdAt: Date;
  readonly createdByProvenance: string;
};

export type EligibilityCandidateInsert = {
  readonly id: string;
  readonly providerId: string;
  readonly teamId: string | null;
  readonly rowKind: EligibilityCandidateRowKind;
  readonly eligible: boolean;
  readonly ruleOutcomes: Prisma.InputJsonValue;
  readonly reasons: Prisma.InputJsonValue;
  readonly sortingFacts?: Prisma.InputJsonValue | null;
  readonly diagnosticsSafe?: Prisma.InputJsonValue | null;
  readonly createdAt?: Date;
};

export type EligibilityEvaluationInsert = {
  readonly id: string;
  readonly ruleVersionId: string;
  readonly countryId: string;
  readonly evaluatedAt: Date;
  readonly completedAt: Date;
  readonly expiresAt: Date;
  readonly requestNormalized: Prisma.InputJsonValue;
  readonly requestHash: string;
  readonly evidenceSafe: Prisma.InputJsonValue;
  readonly evidenceHash: string;
  readonly resultHash: string;
  readonly metadata: Prisma.InputJsonValue;
  readonly outcomeSummary: Prisma.InputJsonValue;
  readonly traceId?: string | null;
  readonly engineVersion: string;
  readonly createdAt?: Date;
  readonly candidates: readonly EligibilityCandidateInsert[];
};

export type PurgeExpiredInput = {
  /** Fixed cutoff from composition clock; deletes rows with expiresAt < cutoff. */
  readonly cutoff: Date;
  /** Integer 1–500; omit ⇒ 100. Invalid sizes reject (do not clamp). */
  readonly batchSize?: number;
};

/**
 * @desc Compute expiresAt as completedAt + 720 elapsed hours.
 * @access Infrastructure / application
 * @explanation DEC-084 retention window; callers must persist this exact value.
 */
export function computeEligibilityExpiresAt(completedAt: Date): Date {
  return new Date(
    completedAt.getTime() + ELIGIBILITY_RETENTION_HOURS * 60 * 60 * 1000,
  );
}

/**
 * @desc Validate purge batchSize (integer 1–500; default 100).
 * @access Infrastructure
 * @explanation Rejects invalid sizes with VALIDATION_FAILED; never clamps.
 */
export function resolvePurgeBatchSize(batchSize: number | undefined): number {
  if (batchSize === undefined) {
    return ELIGIBILITY_PURGE_BATCH_DEFAULT;
  }
  if (
    !Number.isInteger(batchSize) ||
    batchSize < ELIGIBILITY_PURGE_BATCH_MIN ||
    batchSize > ELIGIBILITY_PURGE_BATCH_MAX
  ) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: {
        field: "batchSize",
        reason: "BATCH_SIZE_OUT_OF_RANGE",
        min: ELIGIBILITY_PURGE_BATCH_MIN,
        max: ELIGIBILITY_PURGE_BATCH_MAX,
        received: batchSize,
      },
    });
  }
  return batchSize;
}

/**
 * @desc Eligibility Prisma repository for rule versions, evaluations, and purge.
 * @access Infrastructure
 * @explanation Accepts a transaction client so UoW can share one RepeatableRead
 * snapshot with dependency readers in later batches.
 */
export class PrismaEligibilityRepository {
  public constructor(private readonly db: EligibilityDatabase) {}

  /**
   * @desc Select the latest compatible rule version effective at evaluatedAt.
   * @access Infrastructure
   * @explanation Filters by country + engineCompatibility and
   * effectiveFrom <= evaluatedAt; uniqueness forbids effectiveFrom ties.
   */
  public async findEffectiveRuleVersion(input: {
    readonly countryId: string;
    readonly evaluatedAt: Date;
    readonly engineCompatibility?: string;
  }): Promise<EligibilityRuleVersionRecord | null> {
    const compatibility =
      input.engineCompatibility ?? ELIGIBILITY_ENGINE_COMPATIBILITY;
    const row = await this.db.eligibilityRuleVersion.findFirst({
      where: {
        countryId: input.countryId,
        engineCompatibility: compatibility,
        effectiveFrom: { lte: input.evaluatedAt },
      },
      orderBy: { effectiveFrom: "desc" },
    });
    return row === null ? null : toRuleVersionRecord(row);
  }

  /**
   * @desc Insert one evaluation and all candidate rows atomically.
   * @access Infrastructure
   * @explanation Must run inside the caller's transaction; candidate XOR and
   * partial uniques are enforced by PostgreSQL constraints.
   */
  public async insertEvaluationWithCandidates(
    input: EligibilityEvaluationInsert,
  ): Promise<{ readonly evaluationId: string }> {
    await this.db.eligibilityEvaluation.create({
      data: {
        id: input.id,
        ruleVersionId: input.ruleVersionId,
        countryId: input.countryId,
        evaluatedAt: input.evaluatedAt,
        completedAt: input.completedAt,
        ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
        expiresAt: input.expiresAt,
        requestNormalized: input.requestNormalized,
        requestHash: input.requestHash,
        evidenceSafe: input.evidenceSafe,
        evidenceHash: input.evidenceHash,
        resultHash: input.resultHash,
        metadata: input.metadata,
        outcomeSummary: input.outcomeSummary,
        traceId:
          input.traceId === undefined || input.traceId === null
            ? null
            : input.traceId,
        engineVersion: input.engineVersion,
        candidateResults: {
          create: input.candidates.map((candidate) => ({
            id: candidate.id,
            providerId: candidate.providerId,
            teamId: candidate.teamId,
            rowKind: candidate.rowKind,
            eligible: candidate.eligible,
            ruleOutcomes: candidate.ruleOutcomes,
            reasons: candidate.reasons,
            sortingFacts:
              candidate.sortingFacts === undefined ||
              candidate.sortingFacts === null
                ? PrismaNamespace.DbNull
                : candidate.sortingFacts,
            diagnosticsSafe:
              candidate.diagnosticsSafe === undefined ||
              candidate.diagnosticsSafe === null
                ? PrismaNamespace.DbNull
                : candidate.diagnosticsSafe,
            ...(candidate.createdAt === undefined
              ? {}
              : { createdAt: candidate.createdAt }),
          })),
        },
      },
    });
    return { evaluationId: input.id };
  }

  /**
   * @desc Purge expired evaluations (cascade deletes candidate rows).
   * @access Infrastructure
   * @explanation Deletes in (expiresAt, id) order up to batchSize; returns
   * candidate delete counts via pre-count and moreRemaining via lookahead.
   */
  public async purgeExpiredEvaluations(
    input: PurgeExpiredInput,
  ): Promise<PurgeResult> {
    const batchSize = resolvePurgeBatchSize(input.batchSize);
    const expired = await this.db.eligibilityEvaluation.findMany({
      where: { expiresAt: { lt: input.cutoff } },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: batchSize + 1,
      select: { id: true },
    });
    const moreRemaining = expired.length > batchSize;
    const batch = moreRemaining ? expired.slice(0, batchSize) : expired;
    if (batch.length === 0) {
      return {
        deletedEvaluations: 0,
        deletedCandidateResults: 0,
        moreRemaining: false,
        cutoff: input.cutoff.toISOString(),
      };
    }

    const ids = batch.map((row) => row.id);
    const deletedCandidateResults = await this.db.eligibilityCandidateResult.count(
      {
        where: { evaluationId: { in: ids } },
      },
    );
    const deleted = await this.db.eligibilityEvaluation.deleteMany({
      where: { id: { in: ids } },
    });

    return {
      deletedEvaluations: deleted.count,
      deletedCandidateResults,
      moreRemaining,
      cutoff: input.cutoff.toISOString(),
    };
  }
}

function toRuleVersionRecord(row: {
  id: string;
  countryId: string;
  versionLabel: string;
  schemaVersion: string;
  engineCompatibility: string;
  ruleOrder: Prisma.JsonValue;
  parameters: Prisma.JsonValue;
  effectiveFrom: Date;
  contentChecksum: string;
  createdAt: Date;
  createdByProvenance: string;
}): EligibilityRuleVersionRecord {
  return {
    id: row.id,
    countryId: row.countryId,
    versionLabel: row.versionLabel,
    schemaVersion: row.schemaVersion,
    engineCompatibility: row.engineCompatibility,
    ruleOrder: row.ruleOrder,
    parameters: row.parameters,
    effectiveFrom: row.effectiveFrom,
    contentChecksum: row.contentChecksum,
    createdAt: row.createdAt,
    createdByProvenance: row.createdByProvenance,
  };
}

/**
 * @desc Construct a repository bound to an explicit Prisma client (tests).
 * @access Infrastructure / tests
 */
export function createPrismaEligibilityRepository(
  client: PrismaClient | Prisma.TransactionClient,
): PrismaEligibilityRepository {
  return new PrismaEligibilityRepository(client);
}

export { EligibilityCandidateRowKind };

/**
 * R1-P11 schema/constraint proofs (T012). Skipped unless an approved disposable
 * Phase 11 database URL is present (CLEANORA_R1_P11_DATABASE_URL).
 */

import { randomUUID } from "node:crypto";

import { hasExplicitR1P11TestDatabase } from "../../helpers/r1-p11-eligibility-fixtures.js";
import {
  openR1P11LiveDb,
  type R1P11LiveDb,
} from "../../helpers/r1-p11-eligibility-live.js";
import {
  computeEligibilityExpiresAt,
  createPrismaEligibilityRepository,
  ELIGIBILITY_ENGINE_COMPATIBILITY,
} from "../../../src/modules/eligibility/infrastructure/prisma-eligibility.repository.js";
import {
  R1_P11_ELIGIBILITY_RULE_SEED,
  seedR1P11EligibilityRuleVersion,
} from "../../../prisma/seed.js";

describe.skipIf(!hasExplicitR1P11TestDatabase())(
  "R1-P11 schema constraints (live)",
  () => {
    let live: R1P11LiveDb;

    beforeEach(async () => {
      live = await openR1P11LiveDb();
      await seedR1P11EligibilityRuleVersion(live.db);
    });

    afterEach(async () => {
      await live?.close();
    });

    it("exposes unique (id, country_id) so evaluations can use a composite FK", async () => {
      const indexes = await live.db.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'eligibility_rule_versions'
          AND indexname = 'eligibility_rule_versions_id_country_id_key'
      `;
      expect(indexes).toHaveLength(1);

      const completedAt = new Date("2026-09-09T12:00:00.000Z");
      const evaluationId = randomUUID();
      await live.db.eligibilityEvaluation.create({
        data: {
          id: evaluationId,
          ruleVersionId: R1_P11_ELIGIBILITY_RULE_SEED.id,
          countryId: live.countryId,
          evaluatedAt: completedAt,
          completedAt,
          expiresAt: computeEligibilityExpiresAt(completedAt),
          requestNormalized: {},
          requestHash: "ok",
          evidenceSafe: {},
          evidenceHash: "ok",
          resultHash: "ok",
          metadata: {},
          outcomeSummary: {},
          engineVersion: "eligibility-engine.r1.v1",
        },
      });
      const row = await live.db.eligibilityEvaluation.findUniqueOrThrow({
        where: { id: evaluationId },
      });
      expect(row.ruleVersionId).toBe(R1_P11_ELIGIBILITY_RULE_SEED.id);
      expect(row.countryId).toBe(live.countryId);
    });

    it("rejects duplicate (countryId, versionLabel) and (countryId, effectiveFrom)", async () => {
      await expect(
        live.db.eligibilityRuleVersion.create({
          data: {
            id: "eligibility_rule_dup_label",
            countryId: live.countryId,
            versionLabel: R1_P11_ELIGIBILITY_RULE_SEED.versionLabel,
            schemaVersion: "eligibility.rules.v1",
            engineCompatibility: ELIGIBILITY_ENGINE_COMPATIBILITY,
            ruleOrder: [],
            parameters: {},
            effectiveFrom: new Date("2026-09-11T00:00:00.000Z"),
            contentChecksum: "deadbeef",
            createdByProvenance: "test",
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        live.db.eligibilityRuleVersion.create({
          data: {
            id: "eligibility_rule_dup_effective",
            countryId: live.countryId,
            versionLabel: "r1-v1-other",
            schemaVersion: "eligibility.rules.v1",
            engineCompatibility: ELIGIBILITY_ENGINE_COMPATIBILITY,
            ruleOrder: [],
            parameters: {},
            effectiveFrom: R1_P11_ELIGIBILITY_RULE_SEED.effectiveFrom,
            contentChecksum: "deadbeef",
            createdByProvenance: "test",
          },
        }),
      ).rejects.toBeTruthy();
    });

    it("enforces composite FK country agreement on evaluations", async () => {
      const otherCountry = await live.db.country.create({
        data: {
          code: "YY",
          nameEn: "Synthetic YY",
          nameAr: "اختبار",
          defaultCurrencyId: (
            await live.db.currency.findFirstOrThrow({ select: { id: true } })
          ).id,
          defaultLocale: "en",
          supportedLocales: ["en"],
          isActive: true,
        },
      });

      const completedAt = new Date("2026-09-09T12:00:00.000Z");
      await expect(
        live.db.eligibilityEvaluation.create({
          data: {
            id: randomUUID(),
            ruleVersionId: R1_P11_ELIGIBILITY_RULE_SEED.id,
            countryId: otherCountry.id,
            evaluatedAt: completedAt,
            completedAt,
            expiresAt: computeEligibilityExpiresAt(completedAt),
            requestNormalized: {},
            requestHash: "h1",
            evidenceSafe: {},
            evidenceHash: "h2",
            resultHash: "h3",
            metadata: {},
            outcomeSummary: {},
            engineVersion: "eligibility-engine.r1.v1",
          },
        }),
      ).rejects.toBeTruthy();

      await live.db.country.delete({ where: { id: otherCountry.id } });
    });

    it("rejects XOR violations and duplicate partial-unique candidate rows", async () => {
      const completedAt = new Date("2026-09-09T12:00:00.000Z");
      const evaluationId = randomUUID();
      await live.db.eligibilityEvaluation.create({
        data: {
          id: evaluationId,
          ruleVersionId: R1_P11_ELIGIBILITY_RULE_SEED.id,
          countryId: live.countryId,
          evaluatedAt: completedAt,
          completedAt,
          expiresAt: computeEligibilityExpiresAt(completedAt),
          requestNormalized: {},
          requestHash: "req",
          evidenceSafe: {},
          evidenceHash: "ev",
          resultHash: "res",
          metadata: {},
          outcomeSummary: {},
          engineVersion: "eligibility-engine.r1.v1",
        },
      });

      await expect(
        live.db.$executeRaw`
          INSERT INTO "eligibility_candidate_results"
            ("id", "evaluation_id", "provider_id", "team_id", "row_kind", "eligible", "rule_outcomes", "reasons")
          VALUES
            (${randomUUID()}, ${evaluationId}, ${"provider-missing"}, ${"team-1"}, 'PROVIDER_SUMMARY'::"EligibilityCandidateRowKind", false, '[]'::jsonb, '[]'::jsonb)
        `,
      ).rejects.toBeTruthy();

      await expect(
        live.db.$executeRaw`
          INSERT INTO "eligibility_candidate_results"
            ("id", "evaluation_id", "provider_id", "team_id", "row_kind", "eligible", "rule_outcomes", "reasons")
          VALUES
            (${randomUUID()}, ${evaluationId}, ${"provider-missing"}, NULL, 'TEAM_RESULT'::"EligibilityCandidateRowKind", false, '[]'::jsonb, '[]'::jsonb)
        `,
      ).rejects.toBeTruthy();

      await live.db.eligibilityCandidateResult.create({
        data: {
          id: randomUUID(),
          evaluationId,
          providerId: "provider-nonexistent-a",
          teamId: null,
          rowKind: "PROVIDER_SUMMARY",
          eligible: false,
          ruleOutcomes: [],
          reasons: [],
        },
      });

      await expect(
        live.db.eligibilityCandidateResult.create({
          data: {
            id: randomUUID(),
            evaluationId,
            providerId: "provider-nonexistent-a",
            teamId: null,
            rowKind: "PROVIDER_SUMMARY",
            eligible: false,
            ruleOutcomes: [],
            reasons: [],
          },
        }),
      ).rejects.toBeTruthy();

      await live.db.eligibilityCandidateResult.create({
        data: {
          id: randomUUID(),
          evaluationId,
          providerId: "provider-nonexistent-b",
          teamId: "team-1",
          rowKind: "TEAM_RESULT",
          eligible: true,
          ruleOutcomes: [],
          reasons: [],
        },
      });

      await expect(
        live.db.eligibilityCandidateResult.create({
          data: {
            id: randomUUID(),
            evaluationId,
            providerId: "provider-nonexistent-b",
            teamId: "team-1",
            rowKind: "TEAM_RESULT",
            eligible: true,
            ruleOutcomes: [],
            reasons: [],
          },
        }),
      ).rejects.toBeTruthy();
    });

    it("allows Provider summary for nonexistent providerId and cascades purge", async () => {
      const completedAt = new Date("2026-09-09T12:00:00.000Z");
      const evaluationId = randomUUID();
      const repository = createPrismaEligibilityRepository(live.db);

      await repository.insertEvaluationWithCandidates({
        id: evaluationId,
        ruleVersionId: R1_P11_ELIGIBILITY_RULE_SEED.id,
        countryId: live.countryId,
        evaluatedAt: completedAt,
        completedAt,
        expiresAt: computeEligibilityExpiresAt(completedAt),
        requestNormalized: { mode: "explicit" },
        requestHash: "req-hash",
        evidenceSafe: { providers: [] },
        evidenceHash: "ev-hash",
        resultHash: "res-hash",
        metadata: {},
        outcomeSummary: {},
        engineVersion: "eligibility-engine.r1.v1",
        candidates: [
          {
            id: randomUUID(),
            providerId: "provider-does-not-exist",
            teamId: null,
            rowKind: "PROVIDER_SUMMARY",
            eligible: false,
            ruleOutcomes: [],
            reasons: ["PROVIDER_NOT_APPROVED"],
          },
        ],
      });

      const stored = await live.db.eligibilityCandidateResult.findMany({
        where: { evaluationId },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0]?.providerId).toBe("provider-does-not-exist");

      await live.db.eligibilityEvaluation.delete({ where: { id: evaluationId } });
      const remaining = await live.db.eligibilityCandidateResult.count({
        where: { evaluationId },
      });
      expect(remaining).toBe(0);
    });

    it("selects the effective rule version by country and evaluatedAt", async () => {
      const repository = createPrismaEligibilityRepository(live.db);
      const found = await repository.findEffectiveRuleVersion({
        countryId: live.countryId,
        evaluatedAt: new Date("2026-09-09T12:00:00.000Z"),
      });
      expect(found?.id).toBe(R1_P11_ELIGIBILITY_RULE_SEED.id);

      const beforeEffective = await repository.findEffectiveRuleVersion({
        countryId: live.countryId,
        evaluatedAt: new Date("2026-09-08T23:59:59.999Z"),
      });
      expect(beforeEffective).toBeNull();
    });
  },
);

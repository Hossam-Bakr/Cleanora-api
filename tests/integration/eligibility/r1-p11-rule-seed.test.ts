/**
 * R1-P11 rule-version seed idempotency + drift-fail proofs (T013).
 * Skipped unless CLEANORA_R1_P11_DATABASE_URL names an approved disposable DB.
 */

import { hasExplicitR1P11TestDatabase } from "../../helpers/r1-p11-eligibility-fixtures.js";
import {
  openR1P11LiveDb,
  type R1P11LiveDb,
} from "../../helpers/r1-p11-eligibility-live.js";
import {
  computeR1P11EligibilityRuleContentChecksum,
  R1_P11_ELIGIBILITY_RULE_SEED,
  seedR1P11EligibilityRuleVersion,
} from "../../../prisma/seed.js";

describe.skipIf(!hasExplicitR1P11TestDatabase())(
  "R1-P11 eligibility rule seed (live)",
  () => {
    let live: R1P11LiveDb;

    beforeEach(async () => {
      live = await openR1P11LiveDb();
    });

    afterEach(async () => {
      await live?.close();
    });

    it("is idempotent when immutable fields match", async () => {
      await seedR1P11EligibilityRuleVersion(live.db);
      await seedR1P11EligibilityRuleVersion(live.db);

      const row = await live.db.eligibilityRuleVersion.findUniqueOrThrow({
        where: { id: R1_P11_ELIGIBILITY_RULE_SEED.id },
      });
      expect(row.countryId).toBe(live.countryId);
      expect(row.versionLabel).toBe(R1_P11_ELIGIBILITY_RULE_SEED.versionLabel);
      expect(row.schemaVersion).toBe(R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion);
      expect(row.engineCompatibility).toBe(
        R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
      );
      expect(row.effectiveFrom.toISOString()).toBe(
        R1_P11_ELIGIBILITY_RULE_SEED.effectiveFrom.toISOString(),
      );
      expect(row.contentChecksum).toBe(
        computeR1P11EligibilityRuleContentChecksum({
          schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
          engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
          ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
          parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
        }),
      );
      expect(
        (row.parameters as { performanceGate?: { enabled?: boolean } })
          .performanceGate?.enabled,
      ).toBe(false);
    });

    it("fails loudly on immutable-field drift without overwrite", async () => {
      await seedR1P11EligibilityRuleVersion(live.db);

      const before = await live.db.eligibilityRuleVersion.findUniqueOrThrow({
        where: { id: R1_P11_ELIGIBILITY_RULE_SEED.id },
      });

      // Simulate divergent immutable content that a naive reseed must refuse.
      await live.db.$executeRaw`
        UPDATE "eligibility_rule_versions"
        SET "version_label" = 'r1-v1-drifted'
        WHERE "id" = ${R1_P11_ELIGIBILITY_RULE_SEED.id}
      `;

      await expect(seedR1P11EligibilityRuleVersion(live.db)).rejects.toThrow(
        /Eligibility rule seed drift/u,
      );

      const after = await live.db.eligibilityRuleVersion.findUniqueOrThrow({
        where: { id: R1_P11_ELIGIBILITY_RULE_SEED.id },
      });
      expect(after.versionLabel).toBe("r1-v1-drifted");
      expect(after.contentChecksum).toBe(before.contentChecksum);

      // Restore for subsequent suites sharing the disposable DB.
      await live.db.$executeRaw`
        UPDATE "eligibility_rule_versions"
        SET "version_label" = ${R1_P11_ELIGIBILITY_RULE_SEED.versionLabel}
        WHERE "id" = ${R1_P11_ELIGIBILITY_RULE_SEED.id}
      `;
    });
  },
);

/**
 * R1-P11 concurrent snapshot proofs (Batch E / T036, DEC-084).
 * Live composed proofs are DB-gated via CLEANORA_R1_P11_DATABASE_URL.
 */

import { hasExplicitR1P11TestDatabase } from "../../helpers/r1-p11-eligibility-fixtures.js";
import { createR1P11EligibilityLiveHarness } from "../../helpers/r1-p11-eligibility-live.js";

const live = hasExplicitR1P11TestDatabase();

describe.skipIf(!live)("R1-P11 concurrent snapshot (live)", () => {
  it("two parallel evaluations succeed on one consistent snapshot each", async () => {
    const h = await createR1P11EligibilityLiveHarness();
    try {
      const request = {
        mode: "discovery" as const,
        ...h.requestBase,
      };
      const [first, second] = await Promise.all([
        h.eligibility.evaluateEligibility(request),
        h.eligibility.evaluateEligibility(request),
      ]);

      expect(first.metadata.requestHash).toBe(second.metadata.requestHash);
      expect(first.metadata.evaluatedAt).toBe(second.metadata.evaluatedAt);
      expect(first.eligibleTeams.map((row) => row.teamId).sort()).toEqual(
        second.eligibleTeams.map((row) => row.teamId).sort(),
      );
      expect(first.evaluationId).not.toBe(second.evaluationId);
    } finally {
      await h.close();
    }
  });
});

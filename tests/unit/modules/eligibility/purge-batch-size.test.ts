/**
 * Purge batchSize validation (R1-P11 / FR-018).
 */

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import { resolvePurgeBatchSize } from "#modules/eligibility/infrastructure/prisma-eligibility.repository";

describe("resolvePurgeBatchSize", () => {
  it("defaults omitted batchSize to 100", () => {
    expect(resolvePurgeBatchSize(undefined)).toBe(100);
  });

  it("accepts integer bounds 1 and 500", () => {
    expect(resolvePurgeBatchSize(1)).toBe(1);
    expect(resolvePurgeBatchSize(500)).toBe(500);
  });

  it.each([0, -1, 501, 1.5, Number.NaN])(
    "rejects invalid batchSize %s without clamping",
    (batchSize) => {
      expect(() => resolvePurgeBatchSize(batchSize)).toThrow(EligibilityError);
      try {
        resolvePurgeBatchSize(batchSize);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EligibilityError);
        expect((error as EligibilityError).code).toBe("VALIDATION_FAILED");
        expect((error as EligibilityError).details?.["field"]).toBe("batchSize");
      }
    },
  );
});

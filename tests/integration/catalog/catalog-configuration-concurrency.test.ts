
import {
  decideCatalogCommandOutcome,
  type CatalogCommandRecord,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

/**
 * US2 configuration concurrency (FR-028, FR-034–FR-035, SC-006).
 * Live two-writer proofs run in `catalog-live-disposable.test.ts`.
 */

describe("catalog configuration concurrency", () => {
  const completed: CatalogCommandRecord = {
    status: "COMPLETED",
    requestHash: "d".repeat(64),
    targetType: "SERVICE",
    targetId: "svc_config",
    acceptedVersion: 4,
    reservedMediaFileId: null,
  };

  it("documents the approved live target regex for configuration races", () => {
    expect(
      /\/cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)(?:\?|$)/u.test(
        "postgresql://host/cleanora_r1_p08_proof",
      ),
    ).toBe(true);
  });

  it("replays same-payload completed configuration commands without a second write", () => {
    expect(decideCatalogCommandOutcome(completed, completed.requestHash)).toEqual({
      kind: "REPLAY",
      record: completed,
    });
  });

  it("rejects same-key different-payload configuration commands as idempotency conflict", () => {
    expect(() => decideCatalogCommandOutcome(completed, "e".repeat(64))).toThrow(
      CatalogError,
    );
  });
});

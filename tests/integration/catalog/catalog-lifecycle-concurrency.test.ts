
import {
  assertExactOrderReplacement,
  decideCatalogCommandOutcome,
  type CatalogCommandRecord,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type { CatalogRepository } from "../../../src/modules/catalog/catalog.repository.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * US3 lifecycle/order concurrency helpers (FR-028, FR-034–FR-035, SC-006).
 * Live PostgreSQL races run in `catalog-live-disposable.test.ts`.
 */

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};

describe("catalog lifecycle concurrency policy (US3)", () => {
  const completed: CatalogCommandRecord = {
    status: "COMPLETED",
    requestHash: "a".repeat(64),
    targetType: "CATEGORY_ORDER",
    targetId: "CATEGORY_ORDER",
    acceptedVersion: 2,
    reservedMediaFileId: null,
  };

  it("replays same-payload completed order commands without a second write", () => {
    expect(decideCatalogCommandOutcome(completed, completed.requestHash)).toEqual({
      kind: "REPLAY",
      record: completed,
    });
  });

  it("rejects stale order replacements through exact-set version CAS", () => {
    const current = new Map([
      ["cat_a", 3],
      ["cat_b", 1],
    ]);
    expect(() =>
      assertExactOrderReplacement({
        scope: "CATEGORY",
        items: [
          { id: "cat_a", expectedVersion: 2 },
          { id: "cat_b", expectedVersion: 1 },
        ],
        current,
      }),
    ).toThrow(CatalogError);
  });

  it("rejects stale expected versions through CatalogService CAS", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: noopLogger,
    });
    expect(() =>
      service.assertExpectedVersion({
        currentVersion: 4,
        expectedVersion: 3,
        targetType: "SERVICE",
      }),
    ).toThrow(CatalogError);
  });
});

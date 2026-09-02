
import {
  decideCatalogCommandOutcome,
  type CatalogCommandRecord,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type { CatalogRepository } from "../../../src/modules/catalog/catalog.repository.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * Taxonomy concurrency/idempotency (FR-034, FR-035, SC-006).
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

describe("catalog taxonomy concurrency policy", () => {
  const completed: CatalogCommandRecord = {
    status: "COMPLETED",
    requestHash: "a".repeat(64),
    targetType: "CATEGORY",
    targetId: "cat_1",
    acceptedVersion: 2,
    reservedMediaFileId: null,
  };

  it("replays same-payload completed commands without a second write", () => {
    expect(decideCatalogCommandOutcome(completed, completed.requestHash)).toEqual({
      kind: "REPLAY",
      record: completed,
    });
  });

  it("rejects same-key different-payload as idempotency conflict", () => {
    expect(() => decideCatalogCommandOutcome(completed, "b".repeat(64))).toThrow(
      CatalogError,
    );
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
        currentVersion: 3,
        expectedVersion: 2,
        targetType: "CATEGORY",
      }),
    ).toThrow(CatalogError);
    expect(() =>
      service.assertExpectedVersion({
        currentVersion: 3,
        expectedVersion: 3,
        targetType: "CATEGORY",
      }),
    ).not.toThrow();
  });
});


import type { CatalogRepository } from "../../../src/modules/catalog/catalog.repository.js";

/**
 * US3 availability, lifecycle propagation, and order persistence contracts
 * (FR-022–FR-029). Live Prisma proofs run in `catalog-live-disposable.test.ts`.
 */

describe("catalog availability lifecycle repository", () => {
  it("exposes US3 persistence methods on CatalogRepository", () => {
    const requiredMethods: readonly (keyof CatalogRepository)[] = [
      "lockAllCategories",
      "replaceCategoryOrder",
      "lockServicesInCategory",
      "replaceServiceOrder",
      "listServiceCountryAvailability",
      "replaceServiceCountryAvailability",
      "listSelectableServiceCandidates",
      "lockChildServiceIds",
      "bumpServiceVersions",
    ];
    for (const method of requiredMethods) {
      expect(method).toEqual(expect.any(String));
    }
    expect(requiredMethods).toHaveLength(9);
  });
});

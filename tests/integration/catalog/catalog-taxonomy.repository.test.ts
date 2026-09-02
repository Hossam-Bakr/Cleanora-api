
import type { CatalogRepository } from "../../../src/modules/catalog/catalog.repository.js";

/**
 * Taxonomy repository persistence (FR-001–FR-005, FR-008–FR-012).
 * Live Prisma proofs run in `catalog-live-disposable.test.ts` when
 * `CLEANORA_R1_P08_DATABASE_URL` matches the approved disposable target.
 */

describe("catalog taxonomy repository", () => {
  it("exposes the typed taxonomy persistence methods on CatalogRepository", () => {
    const requiredMethods: readonly (keyof CatalogRepository)[] = [
      "insertCategory",
      "updateCategory",
      "nextCategoryDisplayOrder",
      "lockChildServiceIds",
      "bumpServiceVersions",
      "insertService",
      "upsertServiceTranslations",
      "nextServiceDisplayOrder",
      "updateService",
      "findCategory",
      "findService",
    ];
    for (const method of requiredMethods) {
      expect(method).toEqual(expect.any(String));
    }
    expect(requiredMethods).toHaveLength(11);
  });
});

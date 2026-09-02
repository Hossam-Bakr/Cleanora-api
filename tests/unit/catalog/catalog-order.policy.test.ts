
import {
  assertExactOrderReplacement,
  assertExactOrderVector,
  contiguousDisplayOrders,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

/**
 * US3 exact-set full order replacement / order-vector validation
 * (FR-024, FR-027, FR-028).
 */

const categoryCurrent = new Map([
  ["cat_a", 3],
  ["cat_b", 1],
  ["cat_c", 7],
]);

const serviceCurrent = new Map([
  ["svc_1", 2],
  ["svc_2", 5],
]);

const childCurrent = new Map([
  ["unit_1", 1],
  ["unit_2", 1],
  ["field_1", 4],
]);

const mediaCurrent = new Map([
  ["assoc_1", 1],
  ["assoc_2", 2],
]);

describe("catalog order policy (US3)", () => {
  it("accepts an exact category order vector with matching versions and contiguous positions", () => {
    const result = assertExactOrderReplacement({
      scope: "CATEGORY",
      items: [
        { id: "cat_b", expectedVersion: 1 },
        { id: "cat_a", expectedVersion: 3 },
        { id: "cat_c", expectedVersion: 7 },
      ],
      current: categoryCurrent,
    });

    expect(result.orderedIds).toEqual(["cat_b", "cat_a", "cat_c"]);
    expect(result.positions).toEqual([0, 1, 2]);
    expect(contiguousDisplayOrders(result.orderedIds.length)).toEqual([0, 1, 2]);
    expect(() =>
      assertExactOrderVector(result.orderedIds, new Set(categoryCurrent.keys())),
    ).not.toThrow();
  });

  it("accepts exact service, child, and media order replacements under the same rule", () => {
    expect(
      assertExactOrderReplacement({
        scope: "SERVICE",
        items: [
          { id: "svc_2", expectedVersion: 5 },
          { id: "svc_1", expectedVersion: 2 },
        ],
        current: serviceCurrent,
      }).orderedIds,
    ).toEqual(["svc_2", "svc_1"]);

    expect(
      assertExactOrderReplacement({
        scope: "CHILD",
        items: [
          { id: "field_1", expectedVersion: 4 },
          { id: "unit_1", expectedVersion: 1 },
          { id: "unit_2", expectedVersion: 1 },
        ],
        current: childCurrent,
      }).positions,
    ).toEqual([0, 1, 2]);

    expect(
      assertExactOrderReplacement({
        scope: "MEDIA",
        items: [
          { id: "assoc_2", expectedVersion: 2 },
          { id: "assoc_1", expectedVersion: 1 },
        ],
        current: mediaCurrent,
      }).orderedIds,
    ).toEqual(["assoc_2", "assoc_1"]);
  });

  it("rejects duplicate, missing, and foreign identities", () => {
    expect(() =>
      assertExactOrderReplacement({
        scope: "CATEGORY",
        items: [
          { id: "cat_a", expectedVersion: 3 },
          { id: "cat_a", expectedVersion: 3 },
          { id: "cat_b", expectedVersion: 1 },
        ],
        current: categoryCurrent,
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertExactOrderReplacement({
        scope: "CATEGORY",
        items: [
          { id: "cat_a", expectedVersion: 3 },
          { id: "cat_b", expectedVersion: 1 },
        ],
        current: categoryCurrent,
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertExactOrderReplacement({
        scope: "CATEGORY",
        items: [
          { id: "cat_a", expectedVersion: 3 },
          { id: "cat_b", expectedVersion: 1 },
          { id: "cat_foreign", expectedVersion: 1 },
        ],
        current: categoryCurrent,
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertExactOrderVector(["cat_a", "cat_a"], new Set(["cat_a", "cat_b"])),
    ).toThrow(CatalogError);
  });

  it("rejects stale or mismatched expected versions while keeping the exact ID set rule", () => {
    expect(() =>
      assertExactOrderReplacement({
        scope: "SERVICE",
        items: [
          { id: "svc_1", expectedVersion: 1 },
          { id: "svc_2", expectedVersion: 5 },
        ],
        current: serviceCurrent,
      }),
    ).toThrow(CatalogError);

    expect(() =>
      assertExactOrderReplacement({
        scope: "SERVICE",
        items: [
          { id: "svc_1", expectedVersion: 2 },
          { id: "svc_2", expectedVersion: 5 },
        ],
        current: serviceCurrent,
      }),
    ).not.toThrow();

    try {
      assertExactOrderReplacement({
        scope: "MEDIA",
        items: [
          { id: "assoc_1", expectedVersion: 99 },
          { id: "assoc_2", expectedVersion: 2 },
        ],
        current: mediaCurrent,
      });
      expect.unreachable("stale media order should fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogError);
      expect(error).toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    }
  });

  it("normalizes accepted replacements to stable contiguous zero-based positions", () => {
    const result = assertExactOrderReplacement({
      scope: "CHILD",
      items: [
        { id: "unit_2", expectedVersion: 1 },
        { id: "field_1", expectedVersion: 4 },
        { id: "unit_1", expectedVersion: 1 },
      ],
      current: childCurrent,
    });

    expect(result.positions).toEqual([0, 1, 2]);
    expect(new Set(result.positions).size).toBe(result.positions.length);
    expect(Math.min(...result.positions)).toBe(0);
    expect(Math.max(...result.positions)).toBe(result.positions.length - 1);
  });
});

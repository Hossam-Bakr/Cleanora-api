
import {
  buildCatalogCommandScopeKey,
  canonicalCatalogCommandFingerprint,
  catalogAdvisoryLockKey,
  CATALOG_COMMAND_SCOPE_KEY_MAX_LENGTH,
  decideCatalogCommandOutcome,
  hashCatalogCommandFingerprint,
  type CatalogCommandRecord,
} from "../../../src/modules/catalog/catalog.policy.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

const completed: CatalogCommandRecord = {
  status: "COMPLETED",
  requestHash: "a".repeat(64),
  targetType: "SERVICE",
  targetId: "svc_1",
  acceptedVersion: 4,
  reservedMediaFileId: null,
};

const pending: CatalogCommandRecord = {
  status: "PENDING",
  requestHash: "b".repeat(64),
  targetType: "SERVICE_MEDIA",
  targetId: "svc_1",
  acceptedVersion: null,
  reservedMediaFileId: "media_1",
};

/**
 * FR-034, FR-035, SC-006 command fingerprint, replay, reservation, and
 * conflict policy.
 */
describe("Catalog command fingerprinting", () => {
  it("produces the same canonical fingerprint regardless of key order", () => {
    const left = canonicalCatalogCommandFingerprint({
      code: "HOME_CLEANING",
      nameAr: "تنظيف المنازل",
      displayOrder: 0,
    });
    const right = canonicalCatalogCommandFingerprint({
      displayOrder: 0,
      nameAr: "تنظيف المنازل",
      code: "HOME_CLEANING",
    });
    expect(left).toBe(right);
  });

  it("keeps array order significant because Catalog order vectors are business facts", () => {
    const ascending = canonicalCatalogCommandFingerprint({ order: ["a", "b"] });
    const descending = canonicalCatalogCommandFingerprint({ order: ["b", "a"] });
    expect(ascending).not.toBe(descending);
  });

  it("distinguishes an absent value from an explicit null", () => {
    expect(canonicalCatalogCommandFingerprint({ nameAr: null })).not.toBe(
      canonicalCatalogCommandFingerprint({}),
    );
    expect(canonicalCatalogCommandFingerprint({ nameAr: undefined })).toBe(
      canonicalCatalogCommandFingerprint({}),
    );
  });

  it("hashes to a stable lowercase 64-character SHA-256 digest", () => {
    const hash = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({ code: "HOME_CLEANING" }),
    );
    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(hash).toBe(
      hashCatalogCommandFingerprint(
        canonicalCatalogCommandFingerprint({ code: "HOME_CLEANING" }),
      ),
    );
    expect(hash).not.toBe(
      hashCatalogCommandFingerprint(
        canonicalCatalogCommandFingerprint({ code: "HOME_CLEANING_2" }),
      ),
    );
  });

  it("never embeds localized content in the derived digest", () => {
    const hash = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({ nameAr: "تنظيف المنازل" }),
    );
    expect(hash).not.toContain("تنظيف");
  });
});

describe("Catalog command scope keys", () => {
  it("scopes a receipt by operation and stable target", () => {
    expect(
      buildCatalogCommandScopeKey({
        operation: "service.configuration.replace",
        targetType: "SERVICE",
        targetId: "svc_1",
      }),
    ).toBe("catalog:service.configuration.replace:SERVICE:svc_1");
  });

  it("uses a stable creation scope when no target exists yet", () => {
    expect(
      buildCatalogCommandScopeKey({
        operation: "category.create",
        targetType: "CATEGORY",
        targetId: null,
      }),
    ).toBe("catalog:category.create:CATEGORY:*");
  });

  it("separates different operations on the same target", () => {
    const configure = buildCatalogCommandScopeKey({
      operation: "service.configuration.replace",
      targetType: "SERVICE",
      targetId: "svc_1",
    });
    const reorder = buildCatalogCommandScopeKey({
      operation: "service.media.reorder",
      targetType: "SERVICE",
      targetId: "svc_1",
    });
    expect(configure).not.toBe(reorder);
  });

  it("rejects a scope key longer than the persisted column allows", () => {
    expect(() =>
      buildCatalogCommandScopeKey({
        operation: "service.configuration.replace",
        targetType: "SERVICE",
        targetId: "x".repeat(CATALOG_COMMAND_SCOPE_KEY_MAX_LENGTH),
      }),
    ).toThrow(CatalogError);
  });
});

describe("Catalog command replay and conflict decisions", () => {
  it("treats a first-seen key as a new command", () => {
    expect(decideCatalogCommandOutcome(null, "c".repeat(64))).toEqual({ kind: "NEW" });
  });

  it("replays a completed command without a second write, audit, or version bump", () => {
    const decision = decideCatalogCommandOutcome(completed, completed.requestHash);
    expect(decision).toEqual({ kind: "REPLAY", record: completed });
  });

  it("resumes a pending media reservation for the same payload", () => {
    const decision = decideCatalogCommandOutcome(pending, pending.requestHash);
    expect(decision).toEqual({ kind: "RESUME", record: pending });
    expect(decision.kind === "RESUME" ? decision.record.reservedMediaFileId : null).toBe(
      "media_1",
    );
  });

  it("rejects the same key with a different payload as an idempotency conflict", () => {
    for (const existing of [completed, pending]) {
      expect(() => decideCatalogCommandOutcome(existing, "d".repeat(64))).toThrow(
        CatalogError,
      );
      try {
        decideCatalogCommandOutcome(existing, "d".repeat(64));
      } catch (error) {
        expect(error).toBeInstanceOf(CatalogError);
        expect((error as CatalogError).code).toBe("CATALOG_IDEMPOTENCY_CONFLICT");
        expect((error as CatalogError).httpStatus).toBe(409);
      }
    }
  });

  it("rejects a malformed stored digest instead of silently replaying", () => {
    expect(() =>
      decideCatalogCommandOutcome({ ...completed, requestHash: "not-a-digest" }, "e".repeat(64)),
    ).toThrow(CatalogError);
  });
});

describe("Catalog idempotency advisory locks", () => {
  it("derives a deterministic two-part advisory lock identity", () => {
    const first = catalogAdvisoryLockKey("staff-1", "catalog:category.create:CATEGORY:*", "key-1");
    const second = catalogAdvisoryLockKey("staff-1", "catalog:category.create:CATEGORY:*", "key-1");
    expect(first).toEqual(second);
    expect(Number.isSafeInteger(first.classId)).toBe(true);
    expect(Number.isSafeInteger(first.objectId)).toBe(true);
    expect(first.classId).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(first.classId).toBeLessThanOrEqual(2 ** 31 - 1);
    expect(first.objectId).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(first.objectId).toBeLessThanOrEqual(2 ** 31 - 1);
  });

  it("separates different idempotency identities", () => {
    const a = catalogAdvisoryLockKey("actor-1", "catalog:category.create:CATEGORY:*", "key-1");
    const b = catalogAdvisoryLockKey("actor-1", "catalog:category.create:CATEGORY:*", "key-2");
    const c = catalogAdvisoryLockKey("actor-1", "catalog:service.create:SERVICE:*", "key-1");
    const d = catalogAdvisoryLockKey("actor-2", "catalog:category.create:CATEGORY:*", "key-1");
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).not.toEqual(d);
  });
});

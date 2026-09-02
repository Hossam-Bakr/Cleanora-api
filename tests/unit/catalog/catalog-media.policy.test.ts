
import {
  CATALOG_SERVICE_IMAGE,
  type CatalogServiceImageReceipt,
} from "../../../src/modules/media/media.public.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

/**
 * T098 — Catalog image MIME/size/normalization/receipt policy (FR-038–FR-040).
 * Media owns the numeric limits and owner type; Catalog policy asserts them
 * before orchestration and refuses unsafe receipt shapes.
 *
 * Existing owner-type marker is asserted directly. Policy helpers and Media
 * limit constants are loaded dynamically so missing US4 exports fail closed.
 */
async function loadCatalogMediaPolicy() {
  const policyPath: string = "../../../src/modules/catalog/catalog-media.policy.js";
  const policy = (await import(policyPath)) as {
    assertCatalogServiceImageContentType: (mime: string) => string;
    assertCatalogServiceImageByteLimit: (bytes: number) => void;
    assertCatalogServiceImageDimensions: (input: {
      readonly width: number;
      readonly height: number;
    }) => void;
    assertSafeCatalogServiceImageReceipt: (receipt: unknown) => void;
  };
  const mediaPublic = await import("../../../src/modules/media/media.public.js");
  return {
    ...policy,
    CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES: (
      mediaPublic as {
        readonly CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES?: readonly string[];
      }
    ).CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
    CATALOG_SERVICE_IMAGE_MAX_BYTES: (
      mediaPublic as { readonly CATALOG_SERVICE_IMAGE_MAX_BYTES?: number }
    ).CATALOG_SERVICE_IMAGE_MAX_BYTES,
    CATALOG_SERVICE_IMAGE_MAX_EDGE: (
      mediaPublic as { readonly CATALOG_SERVICE_IMAGE_MAX_EDGE?: number }
    ).CATALOG_SERVICE_IMAGE_MAX_EDGE,
  };
}

describe("catalog media policy (T098)", () => {
  it("exposes the existing CATALOG_SERVICE_IMAGE owner-type marker", () => {
    expect(CATALOG_SERVICE_IMAGE).toBe("CATALOG_SERVICE_IMAGE");
  });

  it("locks Catalog service-image allowed JPEG/PNG/WebP content types", async () => {
    const {
      CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
      assertCatalogServiceImageContentType,
    } = await loadCatalogMediaPolicy();
    expect([...(CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES ?? [])].sort()).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(assertCatalogServiceImageContentType("image/jpeg")).toBe("image/jpeg");
    expect(assertCatalogServiceImageContentType("image/png")).toBe("image/png");
    expect(assertCatalogServiceImageContentType("image/webp")).toBe("image/webp");
  });

  it("rejects unsupported MIME types with CATALOG_MEDIA_INVALID", async () => {
    const { assertCatalogServiceImageContentType } = await loadCatalogMediaPolicy();
    for (const mime of ["image/gif", "image/svg+xml", "application/pdf", "video/mp4", ""]) {
      expect(() => assertCatalogServiceImageContentType(mime)).toThrow(CatalogError);
      try {
        assertCatalogServiceImageContentType(mime);
      } catch (error) {
        expect(error).toBeInstanceOf(CatalogError);
        expect((error as CatalogError).code).toBe("CATALOG_MEDIA_INVALID");
      }
    }
  });

  it("locks the Catalog image byte ceiling at 5 MiB and rejects oversize buffers", async () => {
    const {
      CATALOG_SERVICE_IMAGE_MAX_BYTES,
      assertCatalogServiceImageByteLimit,
    } = await loadCatalogMediaPolicy();
    expect(CATALOG_SERVICE_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(() =>
      assertCatalogServiceImageByteLimit(CATALOG_SERVICE_IMAGE_MAX_BYTES!),
    ).not.toThrow();
    expect(() =>
      assertCatalogServiceImageByteLimit(CATALOG_SERVICE_IMAGE_MAX_BYTES! + 1),
    ).toThrow(CatalogError);
    expect(() => assertCatalogServiceImageByteLimit(0)).toThrow(CatalogError);
    expect(() => assertCatalogServiceImageByteLimit(-1)).toThrow(CatalogError);
  });

  it("locks the max edge at 1200px for normalized Catalog service images", async () => {
    const {
      CATALOG_SERVICE_IMAGE_MAX_EDGE,
      assertCatalogServiceImageDimensions,
    } = await loadCatalogMediaPolicy();
    expect(CATALOG_SERVICE_IMAGE_MAX_EDGE).toBe(1200);
    expect(() =>
      assertCatalogServiceImageDimensions({ width: 1200, height: 800 }),
    ).not.toThrow();
    expect(() =>
      assertCatalogServiceImageDimensions({ width: 800, height: 1200 }),
    ).not.toThrow();
    expect(() =>
      assertCatalogServiceImageDimensions({ width: 1201, height: 800 }),
    ).toThrow(CatalogError);
    expect(() =>
      assertCatalogServiceImageDimensions({ width: 0, height: 100 }),
    ).toThrow(CatalogError);
  });

  it("accepts a safe READY receipt and rejects receipts that leak storage keys or URLs", async () => {
    const { assertSafeCatalogServiceImageReceipt } = await loadCatalogMediaPolicy();
    const safe: CatalogServiceImageReceipt = {
      mediaFileId: "media_1",
      ownerUserId: "staff_1",
      state: "READY",
      canonicalContentType: "image/webp",
      byteSize: 2048,
      width: 640,
      height: 480,
      safeReceiptId: "receipt_1",
    };
    expect(() => assertSafeCatalogServiceImageReceipt(safe)).not.toThrow();

    const leakedKey = {
      ...safe,
      storageKey: "cloudinary/private/key",
    } as CatalogServiceImageReceipt & { readonly storageKey: string };
    expect(() => assertSafeCatalogServiceImageReceipt(leakedKey)).toThrow(CatalogError);

    const leakedUrl = {
      ...safe,
      url: "https://res.cloudinary.com/demo/private/key",
    } as CatalogServiceImageReceipt & { readonly url: string };
    expect(() => assertSafeCatalogServiceImageReceipt(leakedUrl)).toThrow(CatalogError);

    expect(JSON.stringify(safe)).not.toMatch(/storageKey|cloudinary|https?:\/\//iu);
  });
});

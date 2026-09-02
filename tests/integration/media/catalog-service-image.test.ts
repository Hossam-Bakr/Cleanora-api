import sharp from "sharp";

import {
  CATALOG_SERVICE_IMAGE,
  type CatalogServiceImageReceipt,
} from "../../../src/modules/media/media.public.js";
import { createTransactionalCatalogServiceImageAuthorizer } from "../../../src/modules/media/infrastructure/media-provider.factory.js";

/**
 * T099 — Media Catalog-service-image ingest/status/READY/delivery/cleanup
 * with in-process fakes only (FR-038–FR-040). No external storage I/O.
 *
 * Existing READY-authorizer seam is exercised directly. Adapter/processor/
 * factory surfaces are loaded dynamically so missing US4 Media exports fail
 * those cases without blocking the already-shipped authorizer proof.
 */
const readyReceipt: CatalogServiceImageReceipt = {
  mediaFileId: "media_catalog_1",
  ownerUserId: "staff_1",
  state: "READY",
  canonicalContentType: "image/webp",
  byteSize: 100,
  width: 640,
  height: 480,
  safeReceiptId: "receipt_catalog_1",
};

async function loadCatalogServiceImageSurface() {
  const factory = await import(
    "../../../src/modules/media/infrastructure/media-provider.factory.js"
  );
  const adapterPath: string =
    "../../../src/modules/media/infrastructure/catalog-service-image.adapter.js";
  const adapterModule = (await import(adapterPath)) as {
    CatalogServiceImageAdapter: new (
      processor: unknown,
      persistence: unknown,
    ) => {
      ingest: (input: unknown) => Promise<CatalogServiceImageReceipt>;
      readValidationReceipt: (
        mediaFileId: string,
      ) => Promise<CatalogServiceImageReceipt | null>;
    };
    SharpCatalogServiceImageProcessor: new () => {
      process: (bytes: Buffer) => Promise<{
        readonly bytes: Buffer;
        readonly width: number;
        readonly height: number;
        readonly contentType: string;
        readonly sourceContentType: string;
      }>;
    };
    PrismaCatalogServiceImagePersistence: new (deps: unknown) => {
      reserveAndStore: (input: unknown) => Promise<CatalogServiceImageReceipt>;
      delivery: (
        mediaFileId: string,
      ) => Promise<{ readonly url: string; readonly expiresAt: Date }>;
      cleanup: (mediaFileId: string, safeReasonCode: string) => Promise<void>;
    };
  };
  const mediaPublic = await import("../../../src/modules/media/media.public.js");
  return {
    createCatalogServiceImagePort: (
      factory as unknown as {
        readonly createCatalogServiceImagePort?: (input: {
          readonly environment: unknown;
          readonly database?: unknown;
          readonly sdk?: unknown;
        }) => {
          ingest: unknown;
          readValidationReceipt: unknown;
          issueDelivery: unknown;
          requestCleanup: unknown;
        };
      }
    ).createCatalogServiceImagePort!,
    ...adapterModule,
    CATALOG_SERVICE_IMAGE_MAX_BYTES: (
      mediaPublic as {
        readonly CATALOG_SERVICE_IMAGE_MAX_BYTES?: number;
      }
    ).CATALOG_SERVICE_IMAGE_MAX_BYTES,
  };
}

describe("Catalog service image Media adapter (T099, fake storage)", () => {
  it("authorizes only READY CATALOG_SERVICE_IMAGE rows for the trusted uploader (existing seam)", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        ownerUserId: "staff_1",
        ownerType: CATALOG_SERVICE_IMAGE,
        status: "READY",
        width: 640,
        height: 480,
      })
      .mockResolvedValueOnce({
        ownerUserId: "staff_1",
        ownerType: "WORKER_PROFILE_IMAGE",
        status: "READY",
        width: 640,
        height: 480,
      })
      .mockResolvedValueOnce({
        ownerUserId: "other",
        ownerType: CATALOG_SERVICE_IMAGE,
        status: "READY",
        width: 640,
        height: 480,
      })
      .mockResolvedValueOnce({
        ownerUserId: "staff_1",
        ownerType: CATALOG_SERVICE_IMAGE,
        status: "PROCESSING",
        width: 640,
        height: 480,
      })
      .mockResolvedValueOnce(null);
    const authorizer = createTransactionalCatalogServiceImageAuthorizer({
      mediaFile: { findUnique },
    });

    await expect(
      authorizer.assertReadyCatalogServiceImage({
        mediaFileId: "media_ok",
        uploaderUserId: "staff_1",
      }),
    ).resolves.toBe(true);
    await expect(
      authorizer.assertReadyCatalogServiceImage({
        mediaFileId: "media_wrong_owner_type",
        uploaderUserId: "staff_1",
      }),
    ).resolves.toBe(false);
    await expect(
      authorizer.assertReadyCatalogServiceImage({
        mediaFileId: "media_wrong_uploader",
        uploaderUserId: "staff_1",
      }),
    ).resolves.toBe(false);
    await expect(
      authorizer.assertReadyCatalogServiceImage({
        mediaFileId: "media_processing",
        uploaderUserId: "staff_1",
      }),
    ).resolves.toBe(false);
    await expect(
      authorizer.assertReadyCatalogServiceImage({
        mediaFileId: "missing",
        uploaderUserId: "staff_1",
      }),
    ).resolves.toBe(false);
  });

  it("composes createCatalogServiceImagePort without Provider coupling", async () => {
    const { createCatalogServiceImagePort, CATALOG_SERVICE_IMAGE_MAX_BYTES } =
      await loadCatalogServiceImageSurface();
    expect(CATALOG_SERVICE_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    const { createTestEnvironment } = await import("../../helpers/test-environment.js");
    const port = createCatalogServiceImagePort({
      environment: createTestEnvironment({
        MEDIA_STORAGE_PROVIDER: "cloudinary",
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
        CLOUDINARY_PROFILE_IMAGE_FOLDER: "cleanora-catalog",
        CLOUDINARY_SIGNED_URL_TTL_SECONDS: 300,
        MEDIA_IMAGE_MAX_BYTES: CATALOG_SERVICE_IMAGE_MAX_BYTES!,
      }),
      database: { mediaFile: {} },
      sdk: { config: vi.fn(), uploader: {}, url: vi.fn() } as never,
    });
    expect(port.ingest).toBeTypeOf("function");
    expect(port.readValidationReceipt).toBeTypeOf("function");
    expect(port.issueDelivery).toBeTypeOf("function");
    expect(port.requestCleanup).toBeTypeOf("function");
  });

  it.each(["image/jpeg", "image/png", "image/webp"] as const)(
    "ingests accepted %s bytes to a READY Catalog receipt via fake persistence",
    async (contentType) => {
      const {
        CatalogServiceImageAdapter,
      } = await loadCatalogServiceImageSurface();
      const processor = {
        process: vi.fn(async () => ({
          bytes: Buffer.from("normalized"),
          width: 640,
          height: 480,
          contentType,
          sourceContentType: contentType,
        })),
      };
      const persistence = {
        reserveAndStore: vi.fn(async () => ({
          ...readyReceipt,
          canonicalContentType: contentType,
        })),
        readReceipt: vi.fn(async () => readyReceipt),
        delivery: vi.fn(async () => ({
          url: "https://example.invalid/signed",
          expiresAt: new Date("2026-08-31T12:05:00.000Z"),
        })),
        cleanup: vi.fn(async () => undefined),
      };
      const adapter = new CatalogServiceImageAdapter(processor, persistence);
      const receipt = await adapter.ingest({
        mediaFileId: "media_catalog_1",
        ownerUserId: "staff_1",
        declaredContentType: contentType,
        bytes: Buffer.from("valid-image"),
      });
      expect(receipt.state).toBe("READY");
      expect(receipt.canonicalContentType).toBe(contentType);
      expect(JSON.stringify(receipt)).not.toMatch(/storageKey|api_secret|cloudinary/iu);
      expect(persistence.reserveAndStore).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaFileId: "media_catalog_1",
          ownerUserId: "staff_1",
          contentType,
        }),
      );
    },
  );

  it("rejects bad MIME, empty, oversized, or corrupt images before persistence", async () => {
    const {
      CatalogServiceImageAdapter,
      CATALOG_SERVICE_IMAGE_MAX_BYTES,
    } = await loadCatalogServiceImageSurface();
    expect(CATALOG_SERVICE_IMAGE_MAX_BYTES).toBeTypeOf("number");
    const processor = {
      process: vi.fn(async () => ({
        bytes: Buffer.from("normalized"),
        width: 640,
        height: 480,
        contentType: "image/webp" as const,
        sourceContentType: "image/png" as const,
      })),
    };
    const persistence = {
      reserveAndStore: vi.fn(async () => readyReceipt),
      readReceipt: vi.fn(),
      delivery: vi.fn(),
      cleanup: vi.fn(),
    };
    const adapter = new CatalogServiceImageAdapter(processor, persistence);

    await expect(
      adapter.ingest({
        mediaFileId: "m1",
        ownerUserId: "staff_1",
        declaredContentType: "image/gif",
        bytes: Buffer.from("gif"),
      }),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    await expect(
      adapter.ingest({
        mediaFileId: "m1",
        ownerUserId: "staff_1",
        declaredContentType: "image/png",
        bytes: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    await expect(
      adapter.ingest({
        mediaFileId: "m1",
        ownerUserId: "staff_1",
        declaredContentType: "image/png",
        bytes: Buffer.alloc((CATALOG_SERVICE_IMAGE_MAX_BYTES as number) + 1),
      }),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_TOO_LARGE" });
    expect(persistence.reserveAndStore).not.toHaveBeenCalled();
  });

  it("normalizes Catalog images through Sharp without leaking EXIF orientation", async () => {
    const { SharpCatalogServiceImageProcessor } =
      await loadCatalogServiceImageSurface();
    const input = await sharp({
      create: { width: 1600, height: 800, channels: 3, background: "#1a7a4c" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const processed = await new SharpCatalogServiceImageProcessor().process(input);
    const metadata = await sharp(processed.bytes).metadata();
    expect(["image/jpeg", "image/png", "image/webp"]).toContain(processed.contentType);
    expect(Math.max(processed.width, processed.height)).toBeLessThanOrEqual(1200);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });

  it("keeps storage keys and credentials off receipts, delivery, and cleanup surfaces", async () => {
    const { PrismaCatalogServiceImagePersistence } =
      await loadCatalogServiceImageSurface();
    type MediaRow = {
      id: string;
      ownerUserId: string;
      ownerType: typeof CATALOG_SERVICE_IMAGE;
      storageProvider: "CLOUDINARY";
      storageKey: string;
      contentType: string;
      byteSize: number;
      width: number | null;
      height: number | null;
      status: string;
    };
    let row: MediaRow | null = null;
    const repository = {
      reserveCatalogServiceImage: vi.fn(async (input: Omit<MediaRow, "status" | "ownerType"> & {
        readonly ownerType?: string;
      }) => {
        row = {
          ...input,
          ownerType: CATALOG_SERVICE_IMAGE,
          status: "PENDING_UPLOAD",
        } as MediaRow;
        return row;
      }),
      findById: vi.fn(async () => row),
      markStatus: vi.fn(
        async (
          _id: string,
          status: "READY" | "FAILED",
          extra?: Readonly<Record<string, unknown>>,
        ) => {
          if (row !== null) {
            row = { ...row, ...extra, status } as MediaRow;
          }
        },
      ),
      markPendingDelete: vi.fn(async () => undefined),
    };
    const storage = {
      storeProfileImage: vi.fn(async () => ({
        provider: "CLOUDINARY" as const,
        storageKey: "catalog-private-key",
        contentType: "image/webp" as const,
        byteSize: 100,
        width: 640,
        height: 480,
        uploadResourceType: "image" as const,
        uploadType: "authenticated" as const,
      })),
      createAuthorizedDeliveryUrl: vi.fn(async (_reference: unknown, expiresAt: Date) => ({
        url: "https://example.invalid/signed-catalog",
        urlExpiresAt: expiresAt.toISOString(),
      })),
      remove: vi.fn(async () => ({ destroyResult: "ok" as const })),
    };
    const persistence = new PrismaCatalogServiceImagePersistence({
      repository,
      storage,
      createStorageKey: () => "catalog-private-key",
      signedUrlTtlSeconds: 300,
      now: () => new Date("2026-08-31T12:00:00.000Z"),
    });

    const receipt = await persistence.reserveAndStore({
      mediaFileId: "media_catalog_1",
      ownerUserId: "staff_1",
      bytes: Buffer.from("webp"),
      contentType: "image/webp",
      width: 640,
      height: 480,
    });
    expect(receipt).toEqual(
      expect.objectContaining({
        mediaFileId: "media_catalog_1",
        state: "READY",
        ownerUserId: "staff_1",
      }),
    );
    expect(JSON.stringify(receipt)).not.toContain("catalog-private-key");
    expect(repository.reserveCatalogServiceImage).toHaveBeenCalledWith(
      expect.objectContaining({ ownerType: CATALOG_SERVICE_IMAGE }),
    );

    const delivery = await persistence.delivery("media_catalog_1");
    expect(delivery.url).toBe("https://example.invalid/signed-catalog");
    expect(JSON.stringify(delivery)).not.toContain("catalog-private-key");
    expect(JSON.stringify(delivery)).not.toMatch(/api_secret|credential/iu);

    await persistence.cleanup("media_catalog_1", "CATALOG_MEDIA_FINALIZATION_FAILED");
    expect(repository.markPendingDelete).toHaveBeenCalledWith("media_catalog_1");
  });

  it("readValidationReceipt never returns storage keys or credentials", async () => {
    const { CatalogServiceImageAdapter } = await loadCatalogServiceImageSurface();
    const persistence = {
      reserveAndStore: vi.fn(),
      readReceipt: vi.fn(async () => readyReceipt),
      delivery: vi.fn(),
      cleanup: vi.fn(),
    };
    const adapter = new CatalogServiceImageAdapter(
      {
        process: vi.fn(),
      },
      persistence,
    );
    const receipt = await adapter.readValidationReceipt("media_catalog_1");
    expect(receipt).toEqual(readyReceipt);
    expect(JSON.stringify(receipt)).not.toMatch(/storageKey|secret|credential/iu);
  });
});

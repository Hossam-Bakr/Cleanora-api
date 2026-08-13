import { MediaError } from "../../../../src/modules/media/domain/media.errors.js";
import { ProviderMediaAdapter } from "../../../../src/modules/media/infrastructure/provider-media.adapter.js";
import { PROVIDER_IMAGE_MAX_BYTES, PROVIDER_VIDEO_MAX_BYTES } from "../../../../src/modules/media/domain/media.types.js";

describe("ProviderMediaAdapter branch coverage (T156)", () => {
  function build(options: {
    readonly existing?: Record<string, unknown> | null;
    readonly findAfterStore?: Record<string, unknown> | null;
    readonly storeThrows?: boolean;
    readonly storedImage?: Record<string, unknown>;
    readonly storedVideo?: Record<string, unknown>;
  } = {}) {
    const repository = {
      createPendingUpload: vi.fn(async (row: Record<string, unknown>) => row),
      findById: vi
        .fn()
        .mockResolvedValueOnce(
          options.existing === undefined ? null : options.existing,
        )
        .mockResolvedValue(
          options.findAfterStore === undefined
            ? {
                id: "media-1",
                status: "READY",
                contentType: "image/jpeg",
                byteSize: 100,
                width: 600,
                height: 600,
                storageProvider: "CLOUDINARY",
                storageKey: "key-1",
                ownerType: "PROVIDER_LOGO",
              }
            : options.findAfterStore,
        ),
      markStatus: vi.fn(async () => undefined),
      markPendingDelete: vi.fn(async () => undefined),
    };
    const storage = {
      storeProviderImage: vi.fn(async () => {
        if (options.storeThrows) {
          throw new Error("storage down");
        }
        return {
          contentType: "image/jpeg",
          byteSize: 100,
          width: 600,
          height: 600,
          ...options.storedImage,
        };
      }),
      storeProviderVideo: vi.fn(async (input: { storageKey: string }) => ({
        provider: "CLOUDINARY",
        storageKey: input.storageKey,
        contentType: "video/mp4",
        byteSize: 5,
        width: 1280,
        height: 720,
        uploadResourceType: "video",
        uploadType: "authenticated",
        ...options.storedVideo,
      })),
      createAuthorizedDeliveryUrl: vi.fn(async () => ({
        url: "https://cdn.example/signed",
        expiresAt: new Date("2026-08-10T13:00:00.000Z"),
      })),
      createAuthorizedVideoThumbnailUrl: vi.fn(async () => ({
        url: "https://cdn.example/signed-thumbnail",
        urlExpiresAt: "2026-08-10T13:00:00.000Z",
      })),
      createAuthorizedVideoDeliveryUrl: vi.fn(async () => ({
        url: "https://cdn.example/signed-video",
        urlExpiresAt: "2026-08-10T13:00:00.000Z",
      })),
    };
    const imageProcessor = {
      normalize: vi.fn(async () => ({
        bytes: Buffer.from("img"),
        contentType: "image/jpeg",
        byteSize: 100,
        width: 600,
        height: 600,
      })),
    };
    const cleanup = {
      sweepOnce: vi.fn(async () => ({ processed: 2 })),
    };
    const adapter = new ProviderMediaAdapter(
      repository as never,
      storage as never,
      imageProcessor as never,
      cleanup as never,
    );
    return { adapter, repository, storage, imageProcessor, cleanup };
  }

  it("reserves, stores images (create and update paths), and maps failures", async () => {
    const created = build({ existing: null });
    await expect(
      created.adapter.reserveProviderMedia({
        mediaId: "media-1",
        ownerUserId: "user-1",
        ownerType: "PROVIDER_LOGO",
        contentType: "image/jpeg",
        byteSize: 10,
        width: 1,
        height: 1,
      }),
    ).resolves.toMatchObject({ mediaId: "media-1", status: "PENDING_UPLOAD" });

    await expect(
      created.adapter.storeProviderImage({
        mediaId: "media-1",
        ownerUserId: "user-1",
        purpose: "LOGO",
        bytes: Buffer.from("x"),
        storageKey: "key-1",
      }),
    ).resolves.toMatchObject({ status: "READY" });
    expect(created.repository.createPendingUpload).toHaveBeenCalled();

    const updated = build({
      storedImage: { width: 1600, height: 600 },
      existing: {
        id: "media-1",
        status: "FAILED",
        contentType: "image/jpeg",
        byteSize: 1,
        width: 1,
        height: 1,
        storageProvider: "CLOUDINARY",
        storageKey: "old",
        ownerType: "PROVIDER_LOGO",
      },
    });
    await updated.adapter.storeProviderImage({
      mediaId: "media-1",
      ownerUserId: "user-1",
      purpose: "COVER",
      bytes: Buffer.from("x"),
      storageKey: "key-2",
    });
    expect(updated.repository.markStatus).toHaveBeenCalledWith(
      "media-1",
      "PENDING_UPLOAD",
      expect.any(Object),
    );

    const authoritativeMismatch = build({
      storedImage: { width: 599, height: 600 },
    });
    await expect(
      authoritativeMismatch.adapter.storeProviderImage({
        mediaId: "media-1",
        ownerUserId: "user-1",
        purpose: "LOGO",
        bytes: Buffer.from("x"),
        storageKey: "key",
      }),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    expect(authoritativeMismatch.repository.markStatus).toHaveBeenCalledWith(
      "media-1",
      "FAILED",
      expect.any(Object),
    );

    const tooLarge = build();
    tooLarge.imageProcessor.normalize.mockResolvedValue({
      bytes: Buffer.from("x"),
      contentType: "image/jpeg",
      byteSize: PROVIDER_IMAGE_MAX_BYTES + 1,
      width: 600,
      height: 600,
    });
    await expect(
      tooLarge.adapter.storeProviderImage({
        mediaId: "media-1",
        ownerUserId: "user-1",
        purpose: "LOGO",
        bytes: Buffer.from("x"),
        storageKey: "key",
      }),
    ).rejects.toBeInstanceOf(MediaError);

    const failedStore = build({ existing: null, storeThrows: true });
    await expect(
      failedStore.adapter.storeProviderImage({
        mediaId: "media-1",
        ownerUserId: "user-1",
        purpose: "LOGO",
        bytes: Buffer.from("x"),
        storageKey: "key",
      }),
    ).rejects.toThrow("storage down");
    expect(failedStore.repository.markStatus).toHaveBeenCalledWith(
      "media-1",
      "FAILED",
      expect.any(Object),
    );

    const missingAfter = build({
      existing: null,
      findAfterStore: null,
    });
    await expect(
      missingAfter.adapter.storeProviderImage({
        mediaId: "media-1",
        ownerUserId: "user-1",
        purpose: "LOGO",
        bytes: Buffer.from("x"),
        storageKey: "key",
      }),
    ).rejects.toMatchObject({ code: "MEDIA_PROVIDER_FAILURE" });
  });

  it("stores videos with empty/too-large guards and both persistence paths", async () => {
    const { adapter, repository } = build({ existing: null });
    await expect(
      adapter.storeProviderVideo({
        mediaId: "vid-1",
        ownerUserId: "user-1",
        bytes: Buffer.alloc(0),
        contentType: "video/mp4",
        storageKey: "v1",
      }),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });

    await expect(
      adapter.storeProviderVideo({
        mediaId: "vid-1",
        ownerUserId: "user-1",
        bytes: Buffer.alloc(PROVIDER_VIDEO_MAX_BYTES + 1),
        contentType: "video/mp4",
        storageKey: "v1",
      }),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_TOO_LARGE" });

    await expect(
      adapter.storeProviderVideo({
        mediaId: "vid-1",
        ownerUserId: "user-1",
        bytes: Buffer.from("video"),
        contentType: "video/mp4",
        storageKey: "v1",
      }),
    ).resolves.toMatchObject({ status: "PROCESSING" });
    expect(repository.createPendingUpload).toHaveBeenCalled();

    const updatePath = build({
      existing: {
        id: "vid-1",
        status: "FAILED",
        contentType: "video/mp4",
        byteSize: 1,
        width: null,
        height: null,
        storageProvider: "CLOUDINARY",
        storageKey: "old",
        ownerType: "PROVIDER_GALLERY_VIDEO",
      },
    });
    await updatePath.adapter.storeProviderVideo({
      mediaId: "vid-1",
      ownerUserId: "user-1",
      bytes: Buffer.from("video"),
      contentType: "video/webm",
      storageKey: "v2",
    });
    expect(updatePath.repository.markStatus).toHaveBeenCalledWith(
      "vid-1",
      "PROCESSING",
      expect.any(Object),
    );

    const authoritativeOversize = build({
      existing: null,
      storedVideo: { byteSize: PROVIDER_VIDEO_MAX_BYTES + 1 },
    });
    await expect(
      authoritativeOversize.adapter.storeProviderVideo({
        mediaId: "vid-oversize",
        ownerUserId: "user-1",
        bytes: Buffer.from("video"),
        contentType: "video/mp4",
        storageKey: "v3",
      }),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_TOO_LARGE" });
    expect(authoritativeOversize.repository.markStatus).toHaveBeenCalledWith(
      "vid-oversize",
      "FAILED",
      expect.any(Object),
    );
  });

  it("finalizes authoritative videos and signs delivery/thumbnail URLs", async () => {
    const ready = build({
      existing: {
        id: "media-1",
        status: "READY",
        contentType: "image/jpeg",
        byteSize: 1,
        width: 1,
        height: 1,
        storageProvider: "S3",
        storageKey: "key",
        ownerType: "PROVIDER_LOGO",
      },
    });
    // requireReadyMedia uses findById once
    ready.repository.findById = vi.fn(async () => ({
      id: "media-1",
      status: "READY",
      contentType: "image/jpeg",
      byteSize: 1,
      width: 1,
      height: 1,
      storageProvider: "S3",
      storageKey: "key",
      ownerType: "PROVIDER_LOGO",
    }));

    ready.repository.findById = vi.fn(async () => ({
      id: "vid-1",
      status: "PROCESSING",
      contentType: "video/mp4",
      byteSize: 5,
      width: 1280,
      height: 720,
      storageProvider: "CLOUDINARY",
      storageKey: "vkey",
      ownerType: "PROVIDER_GALLERY_VIDEO",
    }));
    await expect(
      ready.adapter.finalizeProviderVideo({ mediaId: "vid-1" }),
    ).resolves.toMatchObject({
      status: "READY",
      thumbnailUrl: { url: "https://cdn.example/signed-thumbnail" },
    });

    ready.repository.findById = vi.fn(async () => ({
      id: "media-1",
      status: "READY",
      contentType: "image/jpeg",
      byteSize: 1,
      width: 1,
      height: 1,
      storageProvider: "S3",
      storageKey: "key",
      ownerType: "PROVIDER_LOGO",
    }));

    await expect(
      ready.adapter.createSignedDeliveryUrl(
        "media-1",
        new Date("2026-08-10T13:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ url: "https://cdn.example/signed" });

    await expect(
      ready.adapter.createSignedThumbnailUrl(
        "media-1",
        new Date("2026-08-10T13:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });

    ready.repository.findById = vi.fn(async () => ({
      id: "vid-1",
      status: "READY",
      contentType: "video/mp4",
      byteSize: 1,
      width: null,
      height: null,
      storageProvider: "CLOUDINARY",
      storageKey: "vkey",
      ownerType: "PROVIDER_GALLERY_VIDEO",
    }));
    await expect(
      ready.adapter.createSignedThumbnailUrl(
        "vid-1",
        new Date("2026-08-10T13:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ url: "https://cdn.example/signed-thumbnail" });

    ready.repository.findById = vi.fn(async () => null);
    await expect(
      ready.adapter.createSignedDeliveryUrl("missing", new Date()),
    ).rejects.toMatchObject({ code: "MEDIA_PROVIDER_FAILURE" });
  });

  it("marks pending delete and sweeps cleanup with optional override limit", async () => {
    const { adapter, repository, cleanup } = build();
    (repository as { listCleanupCandidates?: unknown }).listCleanupCandidates =
      vi.fn(async () => []);
    await adapter.markPendingDelete("media-1");
    expect(repository.markPendingDelete).toHaveBeenCalledWith("media-1");

    await expect(adapter.cleanupBoundedPending()).resolves.toEqual({
      processed: 2,
    });
    expect(cleanup.sweepOnce).toHaveBeenCalled();

    await expect(adapter.cleanupBoundedPending(5)).resolves.toEqual({
      processed: 0,
    });
  });
});

import { MediaError } from "../domain/media.errors.js";
import type {
  FinalizeProviderVideoInput,
  MediaStoragePort,
  ProviderImageProcessor,
  ProviderMediaPort,
  ReserveProviderMediaInput,
  StoreProviderImageInput,
  StoreProviderVideoInput,
} from "../domain/media.ports.js";
import type {
  DeliveryUrl,
  MediaStatus,
  ProviderMediaSafeView,
} from "../domain/media.types.js";
import {
  PROVIDER_IMAGE_DIMENSIONS,
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_VIDEO_MAX_BYTES,
  PROVIDER_VIDEO_MAX_HEIGHT,
  PROVIDER_VIDEO_MAX_WIDTH,
  providerOwnerTypeForImagePurpose,
} from "../domain/media.types.js";
import { MediaCleanupService } from "./media-cleanup.service.js";
import { PrismaMediaRepository } from "./prisma-media.repository.js";

function toSafeView(row: {
  readonly id: string;
  readonly status: MediaStatus;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
}): ProviderMediaSafeView {
  return {
    mediaId: row.id,
    status: row.status,
    contentType: row.contentType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
  };
}

/**
 * Media-owned Provider operations. Authorization stays with Providers; this
 * adapter never inspects membership or application state. Storage keys remain
 * inside Media and never appear on safe views.
 *
 * Provider videos are uploaded as authenticated Cloudinary assets, validated
 * from authoritative upload metadata, and finalized only after a signed
 * derived thumbnail can be produced.
 */
export class ProviderMediaAdapter implements ProviderMediaPort {
  public constructor(
    private readonly repository: PrismaMediaRepository,
    private readonly storage: MediaStoragePort,
    private readonly imageProcessor: ProviderImageProcessor,
    private readonly cleanup: MediaCleanupService,
  ) {}

  public normalizeProviderImage(input: {
    readonly purpose: StoreProviderImageInput["purpose"];
    readonly bytes: Buffer;
  }) {
    return this.imageProcessor.normalize(input);
  }

  public async reserveProviderMedia(
    input: ReserveProviderMediaInput,
  ): Promise<ProviderMediaSafeView> {
    const row = await this.repository.createPendingUpload({
      id: input.mediaId,
      ownerUserId: input.ownerUserId,
      ownerType: input.ownerType,
      storageProvider: "CLOUDINARY",
      storageKey: `reserved/${input.mediaId}`,
      contentType: input.contentType,
      byteSize: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      status: "PENDING_UPLOAD",
    });
    return toSafeView(row);
  }

  public async storeProviderImage(
    input: StoreProviderImageInput,
  ): Promise<ProviderMediaSafeView> {
    const normalized = await this.imageProcessor.normalize({
      purpose: input.purpose,
      bytes: input.bytes,
    });
    if (normalized.byteSize > PROVIDER_IMAGE_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Provider image exceeds 5 MiB",
      );
    }

    const ownerType = providerOwnerTypeForImagePurpose(input.purpose);
    const existing = await this.repository.findById(input.mediaId);
    if (existing === null) {
      await this.repository.createPendingUpload({
        id: input.mediaId,
        ownerUserId: input.ownerUserId,
        ownerType,
        storageProvider: "CLOUDINARY",
        storageKey: input.storageKey,
        contentType: normalized.contentType,
        byteSize: normalized.byteSize,
        width: normalized.width,
        height: normalized.height,
        status: "PENDING_UPLOAD",
      });
    } else {
      await this.repository.markStatus(input.mediaId, "PENDING_UPLOAD", {
        storageKey: input.storageKey,
        contentType: normalized.contentType,
        byteSize: normalized.byteSize,
        width: normalized.width,
        height: normalized.height,
        ownerType,
      });
    }

    try {
      const storeProviderImage = this.storage.storeProviderImage;
      if (storeProviderImage === undefined) {
        throw new MediaError(
          "MEDIA_PROVIDER_UNSUPPORTED",
          "Provider image storage is unavailable",
        );
      }
      const stored = await storeProviderImage.call(this.storage, {
        bytes: normalized.bytes,
        ownerUserId: input.ownerUserId,
        mediaId: input.mediaId,
        storageKey: input.storageKey,
        purpose: input.purpose,
      });
      const expectedDimensions = PROVIDER_IMAGE_DIMENSIONS[input.purpose];
      if (
        stored.contentType !== normalized.contentType ||
        stored.byteSize <= 0 ||
        stored.byteSize > PROVIDER_IMAGE_MAX_BYTES ||
        stored.width !== expectedDimensions.width ||
        stored.height !== expectedDimensions.height
      ) {
        throw new MediaError(
          "MEDIA_IMAGE_INVALID",
          "Provider image authoritative metadata is invalid",
        );
      }
      await this.repository.markStatus(input.mediaId, "READY", {
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        width: stored.width,
        height: stored.height,
      });
    } catch (error) {
      await this.repository.markStatus(input.mediaId, "FAILED", {
        cleanupEligibleAt: new Date(),
      });
      throw error;
    }

    const row = await this.repository.findById(input.mediaId);
    if (row === null) {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Provider media row missing after store",
      );
    }
    return toSafeView(row);
  }

  public async storeProviderVideo(
    input: StoreProviderVideoInput,
  ): Promise<ProviderMediaSafeView> {
    if (input.bytes.byteLength === 0) {
      throw new MediaError("MEDIA_IMAGE_INVALID", "Provider video is empty");
    }
    if (input.bytes.byteLength > PROVIDER_VIDEO_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Provider video exceeds 40 MiB",
      );
    }

    const existing = await this.repository.findById(input.mediaId);
    if (existing === null) {
      await this.repository.createPendingUpload({
        id: input.mediaId,
        ownerUserId: input.ownerUserId,
        ownerType: "PROVIDER_GALLERY_VIDEO",
        storageProvider: "CLOUDINARY",
        storageKey: input.storageKey,
        contentType: input.contentType,
        byteSize: input.bytes.byteLength,
        width: null,
        height: null,
        status: "PROCESSING",
      });
    } else {
      await this.repository.markStatus(input.mediaId, "PROCESSING", {
        storageKey: input.storageKey,
        contentType: input.contentType,
        byteSize: input.bytes.byteLength,
        ownerType: "PROVIDER_GALLERY_VIDEO",
      });
    }

    const upload = this.storage.storeProviderVideo;
    if (upload === undefined) {
      await this.repository.markStatus(input.mediaId, "FAILED", {
        cleanupEligibleAt: new Date(),
      });
      throw new MediaError(
        "MEDIA_PROVIDER_UNSUPPORTED",
        "Configured media storage does not support Provider videos",
      );
    }
    try {
      const stored = await upload.call(this.storage, input);
      if (stored.byteSize <= 0 || stored.byteSize > PROVIDER_VIDEO_MAX_BYTES) {
        throw new MediaError(
          "MEDIA_IMAGE_TOO_LARGE",
          "Provider video authoritative size exceeds 40 MiB",
        );
      }
      await this.repository.markStatus(input.mediaId, "PROCESSING", {
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        width: stored.width,
        height: stored.height,
      });
      return {
        mediaId: input.mediaId,
        status: "PROCESSING",
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        width: stored.width,
        height: stored.height,
      };
    } catch (error) {
      await this.repository.markStatus(input.mediaId, "FAILED", {
        cleanupEligibleAt: new Date(),
      });
      throw error;
    }
  }

  public async finalizeProviderVideo(
    input: FinalizeProviderVideoInput,
  ): Promise<ProviderMediaSafeView> {
    const row = await this.repository.findById(input.mediaId);
    const thumbnail = this.storage.createAuthorizedVideoThumbnailUrl;
    if (
      row === null ||
      row.ownerType !== "PROVIDER_GALLERY_VIDEO" ||
      row.status !== "PROCESSING" ||
      (row.contentType !== "video/mp4" && row.contentType !== "video/webm") ||
      row.width === null ||
      row.height === null ||
      row.byteSize <= 0 ||
      row.byteSize > PROVIDER_VIDEO_MAX_BYTES ||
      row.width > PROVIDER_VIDEO_MAX_WIDTH ||
      row.height > PROVIDER_VIDEO_MAX_HEIGHT ||
      thumbnail === undefined
    ) {
      if (row !== null) {
        await this.repository.markStatus(input.mediaId, "FAILED", {
          cleanupEligibleAt: new Date(),
        });
      }
      throw new MediaError(
        "MEDIA_IMAGE_INVALID",
        "Provider video metadata or derived thumbnail is invalid",
      );
    }
    try {
      const thumbnailUrl = await thumbnail.call(
        this.storage,
        { provider: "CLOUDINARY", storageKey: row.storageKey },
        new Date(Date.now() + 60_000),
      );
      await this.repository.markStatus(input.mediaId, "READY");
      return { ...toSafeView({ ...row, status: "READY" }), thumbnailUrl };
    } catch (error) {
      await this.repository.markStatus(input.mediaId, "FAILED", {
        cleanupEligibleAt: new Date(),
      });
      throw error;
    }
  }

  public async createSignedDeliveryUrl(
    mediaId: string,
    expiresAt: Date,
  ): Promise<DeliveryUrl> {
    const row = await this.requireReadyMedia(mediaId);
    if (row.ownerType === "PROVIDER_GALLERY_VIDEO") {
      const videoDelivery = this.storage.createAuthorizedVideoDeliveryUrl;
      if (row.storageProvider !== "CLOUDINARY" || videoDelivery === undefined) {
        throw new MediaError(
          "MEDIA_PROVIDER_UNSUPPORTED",
          "Configured media storage does not support video delivery",
        );
      }
      return videoDelivery.call(
        this.storage,
        { provider: "CLOUDINARY", storageKey: row.storageKey },
        expiresAt,
      );
    }
    return this.storage.createAuthorizedDeliveryUrl(
      {
        provider: row.storageProvider === "S3" ? "S3" : "CLOUDINARY",
        storageKey: row.storageKey,
      },
      expiresAt,
    );
  }

  public async createSignedThumbnailUrl(
    mediaId: string,
    expiresAt: Date,
  ): Promise<DeliveryUrl> {
    const row = await this.requireReadyMedia(mediaId);
    if (row.ownerType !== "PROVIDER_GALLERY_VIDEO") {
      throw new MediaError(
        "MEDIA_IMAGE_INVALID",
        "Thumbnails are only derived for Provider gallery videos",
      );
    }
    const thumbnail = this.storage.createAuthorizedVideoThumbnailUrl;
    if (row.storageProvider !== "CLOUDINARY" || thumbnail === undefined) {
      throw new MediaError(
        "MEDIA_PROVIDER_UNSUPPORTED",
        "Configured media storage does not support video thumbnails",
      );
    }
    return thumbnail.call(
      this.storage,
      { provider: "CLOUDINARY", storageKey: row.storageKey },
      expiresAt,
    );
  }

  public markPendingDelete(mediaId: string): Promise<void> {
    return this.repository.markPendingDelete(mediaId);
  }

  public cleanupBoundedPending(
    limit?: number,
  ): Promise<{ readonly processed: number }> {
    if (limit !== undefined) {
      return new MediaCleanupService(
        this.repository,
        this.storage,
        limit,
      ).sweepOnce();
    }
    return this.cleanup.sweepOnce();
  }

  private async requireReadyMedia(mediaId: string) {
    const row = await this.repository.findById(mediaId);
    if (row === null || row.status !== "READY") {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Media is not available for signed delivery",
      );
    }
    return row;
  }
}

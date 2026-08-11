/**
 * Deterministic Provider media fake for automated suites.
 * Persists opaque media_files rows for FK integrity, never calls Cloudinary,
 * and never returns storage keys or public ids on safe views.
 */

import { randomUUID } from "node:crypto";

import type {
  DeliveryUrl,
  NormalizedProviderImage,
  ProviderImagePurpose,
  ProviderMediaPort,
  ProviderMediaSafeView,
} from "../../src/modules/media/media.public.js";
import type {
  ReserveProviderMediaInput,
  StoreProviderImageInput,
  StoreProviderVideoInput,
} from "../../src/modules/media/domain/media.ports.js";
import {
  PROVIDER_IMAGE_DIMENSIONS,
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_VIDEO_MAX_BYTES,
  providerOwnerTypeForImagePurpose,
} from "../../src/modules/media/media.public.js";
import { MediaError } from "../../src/modules/media/domain/media.errors.js";
import { PrismaMediaRepository } from "../../src/modules/media/infrastructure/prisma-media.repository.js";
import { SharpProviderImageProcessor } from "../../src/modules/media/infrastructure/sharp-provider-image.processor.js";

export type FakeMediaStatus =
  | "PENDING_UPLOAD"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "PENDING_DELETE"
  | "DELETED";

export interface FakeProviderMediaRecord {
  readonly mediaId: string;
  status: FakeMediaStatus;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly hasThumbnail: boolean;
  cleanupEligible: boolean;
}

function toSafeView(record: FakeProviderMediaRecord): ProviderMediaSafeView {
  return {
    mediaId: record.mediaId,
    status: record.status,
    contentType: record.contentType,
    byteSize: record.byteSize,
    width: record.width,
    height: record.height,
  };
}

/**
 * Test double implementing the Media ProviderMediaPort.
 * Image normalize uses Sharp; storage is local Prisma rows only.
 */
export class FakeProviderMediaAdapter implements ProviderMediaPort {
  readonly records = new Map<string, FakeProviderMediaRecord>();
  failNextFinalize = false;
  failNextStore = false;
  beforeNextImageStore: (() => Promise<void>) | undefined = undefined;
  private sequence = 0;
  private readonly repository = new PrismaMediaRepository();
  private readonly processor = new SharpProviderImageProcessor();

  async reservePending(input: {
    readonly contentType: string;
    readonly byteSize: number;
  }): Promise<{ readonly mediaId: string; readonly status: "PENDING_UPLOAD" }> {
    this.sequence += 1;
    const mediaId = `fake-media-${this.sequence}`;
    this.records.set(mediaId, {
      mediaId,
      status: "PENDING_UPLOAD",
      contentType: input.contentType,
      byteSize: input.byteSize,
      width: null,
      height: null,
      hasThumbnail: false,
      cleanupEligible: false,
    });
    return { mediaId, status: "PENDING_UPLOAD" };
  }

  async finalizeReady(
    mediaId: string,
    dimensions: { readonly width: number; readonly height: number },
  ): Promise<FakeProviderMediaRecord> {
    const record = this.records.get(mediaId);
    if (record === undefined) {
      throw new Error("FAKE_MEDIA_NOT_FOUND");
    }
    if (this.failNextFinalize) {
      this.failNextFinalize = false;
      record.status = "FAILED";
      record.cleanupEligible = true;
      await this.repository.markStatus(mediaId, "FAILED", {
        cleanupEligibleAt: new Date(),
      });
      return { ...record };
    }
    const next: FakeProviderMediaRecord = {
      ...record,
      status: "READY",
      width: dimensions.width,
      height: dimensions.height,
      hasThumbnail: record.contentType.startsWith("video/") ? true : false,
      cleanupEligible: false,
    };
    this.records.set(mediaId, next);
    await this.repository.markStatus(mediaId, "READY", {
      width: dimensions.width,
      height: dimensions.height,
    });
    return { ...next };
  }

  async markPendingDelete(mediaId: string): Promise<void> {
    const record = this.records.get(mediaId);
    if (record !== undefined) {
      record.status = "PENDING_DELETE";
      record.cleanupEligible = true;
    }
    await this.repository.markPendingDelete(mediaId);
  }

  async signedDeliveryUrl(mediaId: string): Promise<{
    readonly url: string;
    readonly expiresAt: string;
  }> {
    return {
      url: `https://media.test.local/signed/${mediaId}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  normalizeProviderImage(input: {
    readonly purpose: ProviderImagePurpose;
    readonly bytes: Buffer;
  }): Promise<NormalizedProviderImage> {
    return this.processor.normalize(input);
  }

  async reserveProviderMedia(
    input: ReserveProviderMediaInput,
  ): Promise<ProviderMediaSafeView> {
    await this.repository.createPendingUpload({
      id: input.mediaId,
      ownerUserId: input.ownerUserId,
      ownerType: input.ownerType,
      storageProvider: "CLOUDINARY",
      storageKey: `fake/${input.mediaId}`,
      contentType: input.contentType,
      byteSize: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      status: "PENDING_UPLOAD",
    });
    const record: FakeProviderMediaRecord = {
      mediaId: input.mediaId,
      status: "PENDING_UPLOAD",
      contentType: input.contentType,
      byteSize: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      hasThumbnail: false,
      cleanupEligible: false,
    };
    this.records.set(input.mediaId, record);
    return toSafeView(record);
  }

  async storeProviderImage(
    input: StoreProviderImageInput,
  ): Promise<ProviderMediaSafeView> {
    const beforeStore = this.beforeNextImageStore;
    this.beforeNextImageStore = undefined;
    await beforeStore?.();
    if (this.failNextStore) {
      this.failNextStore = false;
      await this.repository.markStatus(input.mediaId, "FAILED", {
        cleanupEligibleAt: new Date(),
      });
      const failed = this.records.get(input.mediaId);
      if (failed !== undefined) {
        failed.status = "FAILED";
        failed.cleanupEligible = true;
      }
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Fake provider media store failed",
      );
    }

    const normalized = await this.processor.normalize({
      purpose: input.purpose,
      bytes: input.bytes,
    });
    if (normalized.byteSize > PROVIDER_IMAGE_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Provider image exceeds 5 MiB",
      );
    }
    const dims = PROVIDER_IMAGE_DIMENSIONS[input.purpose];
    await this.repository.markStatus(input.mediaId, "READY", {
      contentType: normalized.contentType,
      byteSize: normalized.byteSize,
      width: dims.width,
      height: dims.height,
      ownerType: providerOwnerTypeForImagePurpose(input.purpose),
      storageKey: input.storageKey,
    });
    const record: FakeProviderMediaRecord = {
      mediaId: input.mediaId,
      status: "READY",
      contentType: normalized.contentType,
      byteSize: normalized.byteSize,
      width: dims.width,
      height: dims.height,
      hasThumbnail: false,
      cleanupEligible: false,
    };
    this.records.set(input.mediaId, record);
    return toSafeView(record);
  }

  async storeProviderVideo(
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
    await this.repository.markStatus(input.mediaId, "PROCESSING", {
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      ownerType: "PROVIDER_GALLERY_VIDEO",
      storageKey: input.storageKey,
    });
    const record: FakeProviderMediaRecord = {
      mediaId: input.mediaId,
      status: "PROCESSING",
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      width: null,
      height: null,
      hasThumbnail: false,
      cleanupEligible: false,
    };
    this.records.set(input.mediaId, record);
    return toSafeView(record);
  }

  async finalizeProviderVideo(input: {
    readonly mediaId: string;
  }): Promise<ProviderMediaSafeView> {
    const existing = this.records.get(input.mediaId);
    if (existing === undefined) {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Fake video media missing",
      );
    }
    if (this.failNextFinalize) {
      this.failNextFinalize = false;
      existing.status = "FAILED";
      existing.cleanupEligible = true;
      await this.repository.markStatus(input.mediaId, "FAILED", {
        cleanupEligibleAt: new Date(),
      });
      return toSafeView(existing);
    }
    const width = 1280;
    const height = 720;
    await this.repository.markStatus(input.mediaId, "READY", {
      width,
      height,
    });
    const record: FakeProviderMediaRecord = {
      ...existing,
      status: "READY",
      width,
      height,
      hasThumbnail: true,
      cleanupEligible: false,
    };
    this.records.set(input.mediaId, record);
    return {
      ...toSafeView(record),
      thumbnailUrl: {
        url: `https://media.test.local/thumb/${input.mediaId}`,
        urlExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    };
  }

  async createSignedDeliveryUrl(
    mediaId: string,
    expiresAt: Date,
  ): Promise<DeliveryUrl> {
    const record = this.records.get(mediaId);
    if (record === undefined || record.status !== "READY") {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Media is not available for signed delivery",
      );
    }
    return {
      url: `https://media.test.local/signed/${mediaId}`,
      urlExpiresAt: expiresAt.toISOString(),
    };
  }

  async createSignedThumbnailUrl(
    mediaId: string,
    expiresAt: Date,
  ): Promise<DeliveryUrl> {
    const record = this.records.get(mediaId);
    if (
      record === undefined ||
      record.status !== "READY" ||
      !record.hasThumbnail
    ) {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Thumbnail is not available for signed delivery",
      );
    }
    return {
      url: `https://media.test.local/thumb/${mediaId}`,
      urlExpiresAt: expiresAt.toISOString(),
    };
  }

  async cleanupBoundedPending(
    limit = 20,
  ): Promise<{ readonly processed: number }> {
    let processed = 0;
    for (const record of this.records.values()) {
      if (processed >= limit) {
        break;
      }
      if (record.cleanupEligible || record.status === "PENDING_DELETE") {
        record.status = "DELETED";
        record.cleanupEligible = false;
        await this.repository.markDeleted(record.mediaId);
        processed += 1;
      }
    }
    return { processed };
  }

  /** Convenience for tests that need a fresh opaque media id. */
  nextMediaId(): string {
    return randomUUID();
  }

  reset(): void {
    this.records.clear();
    this.failNextFinalize = false;
    this.failNextStore = false;
    this.beforeNextImageStore = undefined;
    this.sequence = 0;
  }
}

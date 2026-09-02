import sharp from "sharp";

import type { MediaStoragePort } from "../domain/media.ports.js";
import {
  CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
  CATALOG_SERVICE_IMAGE_MAX_BYTES,
  CATALOG_SERVICE_IMAGE_MAX_EDGE,
  type CatalogServiceImageContentType,
} from "../domain/media.types.js";
import type {
  CatalogServiceImagePort,
  CatalogServiceImageReceipt,
} from "../media.public.js";
import { CATALOG_SERVICE_IMAGE, MediaError } from "../media.public.js";

const LIMIT_INPUT_PIXELS = 40_000_000;

const acceptedDeclaredTypes = new Set<string>([
  ...CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
  "image/jpg",
]);

export interface CatalogServiceImageProcessor {
  process(bytes: Buffer): Promise<{
    readonly bytes: Buffer;
    readonly width: number;
    readonly height: number;
    readonly contentType: CatalogServiceImageContentType;
    readonly sourceContentType: CatalogServiceImageContentType;
  }>;
}

export interface CatalogServiceImagePersistence {
  reserveAndStore(input: {
    readonly mediaFileId: string;
    readonly ownerUserId: string;
    readonly bytes: Buffer;
    readonly contentType: CatalogServiceImageContentType;
    readonly width: number;
    readonly height: number;
  }): Promise<CatalogServiceImageReceipt>;
  readReceipt(mediaFileId: string): Promise<CatalogServiceImageReceipt | null>;
  delivery(
    mediaFileId: string,
  ): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  cleanup(mediaFileId: string, safeReasonCode: string): Promise<void>;
}

export interface CatalogServiceImageMediaRepository {
  reserveCatalogServiceImage(input: {
    readonly id: string;
    readonly ownerUserId: string;
    readonly ownerType: typeof CATALOG_SERVICE_IMAGE;
    readonly storageProvider: "CLOUDINARY";
    readonly storageKey: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly width: number;
    readonly height: number;
  }): Promise<unknown>;
  findById(mediaFileId: string): Promise<{
    readonly id: string;
    readonly ownerUserId: string;
    readonly ownerType: string;
    readonly storageProvider: "CLOUDINARY" | "S3";
    readonly storageKey: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly width: number | null;
    readonly height: number | null;
    readonly status: string;
  } | null>;
  markStatus(
    mediaFileId: string,
    status: "READY" | "FAILED",
    extra?: Readonly<Record<string, unknown>>,
  ): Promise<void>;
  markPendingDelete(mediaFileId: string): Promise<void>;
}

function normalizeDeclaredContentType(
  value: string,
): CatalogServiceImageContentType | null {
  if (value === "image/jpeg" || value === "image/jpg") {
    return "image/jpeg";
  }
  if (value === "image/png" || value === "image/webp") {
    return value;
  }
  return null;
}

function toSafeReceipt(row: {
  readonly id: string;
  readonly ownerUserId: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly status: string;
  readonly ownerType: string;
}): CatalogServiceImageReceipt | null {
  if (row.ownerType !== CATALOG_SERVICE_IMAGE) {
    return null;
  }
  const state =
    row.status === "READY"
      ? "READY"
      : row.status === "FAILED"
        ? "FAILED"
        : row.status === "PENDING_UPLOAD" || row.status === "PROCESSING"
          ? "PROCESSING"
          : null;
  if (
    state === null ||
    !CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES.includes(
      row.contentType as CatalogServiceImageContentType,
    )
  ) {
    return null;
  }
  return {
    mediaFileId: row.id,
    ownerUserId: row.ownerUserId,
    state,
    canonicalContentType: row.contentType as CatalogServiceImageContentType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    safeReceiptId: row.id,
  };
}

/**
 * Sharp-owned decode, orientation correction, metadata stripping, and
 * constrained resize for Catalog service images. Output stays JPEG/PNG/WebP.
 */
export class SharpCatalogServiceImageProcessor
  implements CatalogServiceImageProcessor
{
  public async process(
    bytes: Buffer,
  ): Promise<Awaited<ReturnType<CatalogServiceImageProcessor["process"]>>> {
    try {
      const pipeline = sharp(bytes, {
        failOn: "error",
        limitInputPixels: LIMIT_INPUT_PIXELS,
        animated: false,
        pages: 1,
      });
      const metadata = await pipeline.metadata();
      if ((metadata.pages ?? 1) > 1 || metadata.pages === -1) {
        throw new MediaError(
          "MEDIA_IMAGE_INVALID",
          "Animated Catalog service images are not accepted",
        );
      }
      const sourceContentType =
        metadata.format === "jpeg"
          ? "image/jpeg"
          : metadata.format === "png"
            ? "image/png"
            : metadata.format === "webp"
              ? "image/webp"
              : null;
      if (sourceContentType === null) {
        throw new MediaError(
          "MEDIA_IMAGE_INVALID",
          "Catalog service image must be a decodable JPEG, PNG, or WebP",
        );
      }

      let normalizedPipeline = pipeline
        .rotate()
        .resize({
          width: CATALOG_SERVICE_IMAGE_MAX_EDGE,
          height: CATALOG_SERVICE_IMAGE_MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        });

      if (sourceContentType === "image/jpeg") {
        normalizedPipeline = normalizedPipeline.jpeg({
          quality: 85,
          mozjpeg: true,
        });
      } else if (sourceContentType === "image/png") {
        normalizedPipeline = normalizedPipeline.png({ compressionLevel: 9 });
      } else {
        normalizedPipeline = normalizedPipeline.webp({
          quality: 82,
          effort: 4,
        });
      }

      const normalized = await normalizedPipeline.toBuffer({
        resolveWithObject: true,
      });
      if (normalized.info.size > CATALOG_SERVICE_IMAGE_MAX_BYTES) {
        throw new MediaError(
          "MEDIA_IMAGE_TOO_LARGE",
          "Normalized Catalog service image exceeds 5 MiB",
        );
      }
      return {
        bytes: normalized.data,
        width: normalized.info.width,
        height: normalized.info.height,
        contentType: sourceContentType,
        sourceContentType,
      };
    } catch (error: unknown) {
      if (error instanceof MediaError) {
        throw error;
      }
      throw new MediaError(
        "MEDIA_IMAGE_INVALID",
        "Catalog service image could not be decoded safely",
      );
    }
  }
}

/**
 * Media-owned database/storage orchestration for Catalog service images.
 * Storage keys and provider credentials never cross the public receipt.
 */
export class PrismaCatalogServiceImagePersistence
  implements CatalogServiceImagePersistence
{
  public constructor(
    private readonly dependencies: {
      readonly repository: CatalogServiceImageMediaRepository;
      readonly storage: MediaStoragePort;
      readonly createStorageKey: () => string;
      readonly signedUrlTtlSeconds: number;
      readonly now?: () => Date;
    },
  ) {}

  public async reserveAndStore(
    input: Parameters<CatalogServiceImagePersistence["reserveAndStore"]>[0],
  ): Promise<CatalogServiceImageReceipt> {
    const existing = await this.dependencies.repository.findById(
      input.mediaFileId,
    );
    if (
      existing !== null &&
      existing.ownerType === CATALOG_SERVICE_IMAGE &&
      existing.ownerUserId === input.ownerUserId
    ) {
      if (existing.status === "READY") {
        const replay = toSafeReceipt(existing);
        if (replay !== null) {
          return replay;
        }
      }
    }

    const storageKey =
      existing !== null &&
      existing.ownerType === CATALOG_SERVICE_IMAGE &&
      existing.ownerUserId === input.ownerUserId &&
      (existing.status === "PENDING_UPLOAD" || existing.status === "FAILED")
        ? existing.storageKey
        : this.dependencies.createStorageKey();

    if (
      existing === null ||
      existing.ownerType !== CATALOG_SERVICE_IMAGE ||
      existing.ownerUserId !== input.ownerUserId
    ) {
      await this.dependencies.repository.reserveCatalogServiceImage({
        id: input.mediaFileId,
        ownerUserId: input.ownerUserId,
        ownerType: CATALOG_SERVICE_IMAGE,
        storageProvider: "CLOUDINARY",
        storageKey,
        contentType: input.contentType,
        byteSize: input.bytes.length,
        width: input.width,
        height: input.height,
      });
    }

    try {
      const stored = await this.dependencies.storage.storeProfileImage({
        bytes: input.bytes,
        ownerUserId: input.ownerUserId,
        mediaId: input.mediaFileId,
        storageKey,
      });
      await this.dependencies.repository.markStatus(input.mediaFileId, "READY", {
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        width: stored.width,
        height: stored.height,
      });
    } catch (error: unknown) {
      await this.dependencies.repository
        .markStatus(input.mediaFileId, "FAILED", {
          cleanupEligibleAt: this.dependencies.now?.() ?? new Date(),
        })
        .catch(() => undefined);
      throw error;
    }

    const receipt = await this.readReceipt(input.mediaFileId);
    if (receipt === null || receipt.state !== "READY") {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Catalog service image receipt was not finalized",
      );
    }
    return receipt;
  }

  public async readReceipt(
    mediaFileId: string,
  ): Promise<CatalogServiceImageReceipt | null> {
    const row = await this.dependencies.repository.findById(mediaFileId);
    if (row === null) {
      return null;
    }
    return toSafeReceipt(row);
  }

  public async delivery(
    mediaFileId: string,
  ): Promise<{ readonly url: string; readonly expiresAt: Date }> {
    const row = await this.dependencies.repository.findById(mediaFileId);
    if (
      row === null ||
      row.ownerType !== CATALOG_SERVICE_IMAGE ||
      row.status !== "READY"
    ) {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Catalog service image is not ready for delivery",
      );
    }
    const expiresAt = new Date(
      (this.dependencies.now?.() ?? new Date()).getTime() +
        this.dependencies.signedUrlTtlSeconds * 1000,
    );
    const delivery = await this.dependencies.storage.createAuthorizedDeliveryUrl(
      {
        provider: row.storageProvider,
        storageKey: row.storageKey,
      },
      expiresAt,
    );
    return { url: delivery.url, expiresAt };
  }

  public async cleanup(
    mediaFileId: string,
    _safeReasonCode: string,
  ): Promise<void> {
    await this.dependencies.repository.markPendingDelete(mediaFileId);
  }
}

/**
 * Media-owned Catalog service-image pipeline. Catalog supplies the reserved
 * media identity; Media owns normalize/store/READY/delivery/cleanup only.
 */
export class CatalogServiceImageAdapter implements CatalogServiceImagePort {
  public constructor(
    private readonly processor: CatalogServiceImageProcessor,
    private readonly persistence: CatalogServiceImagePersistence,
  ) {}

  public async ingest(
    input: Parameters<CatalogServiceImagePort["ingest"]>[0],
  ): Promise<CatalogServiceImageReceipt> {
    if (
      !acceptedDeclaredTypes.has(input.declaredContentType) ||
      input.bytes.length === 0
    ) {
      throw new MediaError(
        "MEDIA_IMAGE_INVALID",
        "Catalog service image is invalid",
      );
    }
    if (input.bytes.length > CATALOG_SERVICE_IMAGE_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Catalog service image exceeds 5 MiB",
      );
    }

    const processed = await this.processor.process(input.bytes);
    const declared = normalizeDeclaredContentType(input.declaredContentType);
    if (
      declared === null ||
      processed.width < 1 ||
      processed.height < 1 ||
      processed.width > CATALOG_SERVICE_IMAGE_MAX_EDGE ||
      processed.height > CATALOG_SERVICE_IMAGE_MAX_EDGE ||
      declared !== processed.sourceContentType
    ) {
      throw new MediaError(
        "MEDIA_IMAGE_INVALID",
        "Catalog service image content does not match its declared type",
      );
    }

    return this.persistence.reserveAndStore({
      mediaFileId: input.mediaFileId,
      ownerUserId: input.ownerUserId,
      bytes: processed.bytes,
      contentType: processed.contentType,
      width: processed.width,
      height: processed.height,
    });
  }

  public readValidationReceipt(mediaFileId: string) {
    return this.persistence.readReceipt(mediaFileId);
  }

  public async issueDelivery(
    input: Parameters<CatalogServiceImagePort["issueDelivery"]>[0],
  ) {
    return this.persistence.delivery(input.mediaFileId);
  }

  public requestCleanup(
    input: Parameters<CatalogServiceImagePort["requestCleanup"]>[0],
  ) {
    return this.persistence.cleanup(input.mediaFileId, input.safeReasonCode);
  }
}

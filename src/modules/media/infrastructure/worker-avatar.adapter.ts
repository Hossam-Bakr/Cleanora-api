import sharp from "sharp";
import { randomUUID } from "node:crypto";

import type {
  TransactionalWorkerAvatarAuthorizer,
  WorkerAvatarPort,
  WorkerAvatarReceipt,
} from "../media.public.js";
import { MediaError } from "../media.public.js";
import { PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_MAX_EDGE } from "../domain/media.types.js";
import type { MediaStoragePort } from "../domain/media.ports.js";

export interface WorkerAvatarProcessor {
  process(bytes: Buffer): Promise<{
    readonly bytes: Buffer;
    readonly width: number;
    readonly height: number;
    readonly contentType: "image/webp";
    readonly sourceContentType: "image/jpeg" | "image/png" | "image/webp";
  }>;
}

export interface WorkerAvatarPersistence {
  reserveAndStore(input: {
    readonly ownerUserId: string;
    readonly bytes: Buffer;
    readonly contentType: "image/webp";
    readonly width: number;
    readonly height: number;
  }): Promise<WorkerAvatarReceipt>;
  readReceipt(mediaFileId: string): Promise<WorkerAvatarReceipt | null>;
  privateDelivery(mediaFileId: string): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  cleanup(mediaFileId: string, safeReasonCode: string): Promise<void>;
}

export interface WorkerAvatarMediaRepository {
  createPendingUpload(input: {
    readonly id: string;
    readonly ownerUserId: string;
    readonly ownerType: "WORKER_PROFILE_IMAGE";
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
  markStatus(mediaFileId: string, status: "READY" | "FAILED", extra?: Readonly<Record<string, unknown>>): Promise<void>;
  markPendingDelete(mediaFileId: string): Promise<void>;
}

/** Media-owned database/storage orchestration; storage keys never cross the public receipt. */
export class PrismaWorkerAvatarPersistence implements WorkerAvatarPersistence {
  public constructor(private readonly dependencies: {
    readonly repository: WorkerAvatarMediaRepository;
    readonly storage: MediaStoragePort;
    readonly createStorageKey: () => string;
    readonly signedUrlTtlSeconds: number;
    readonly createId?: () => string;
    readonly now?: () => Date;
  }) {}

  public async reserveAndStore(input: Parameters<WorkerAvatarPersistence["reserveAndStore"]>[0]): Promise<WorkerAvatarReceipt> {
    const mediaFileId = this.dependencies.createId?.() ?? randomUUID();
    const storageKey = this.dependencies.createStorageKey();
    await this.dependencies.repository.createPendingUpload({
      id: mediaFileId,
      ownerUserId: input.ownerUserId,
      ownerType: "WORKER_PROFILE_IMAGE",
      storageProvider: "CLOUDINARY",
      storageKey,
      contentType: input.contentType,
      byteSize: input.bytes.length,
      width: input.width,
      height: input.height,
    });
    try {
      const stored = await this.dependencies.storage.storeProfileImage({
        bytes: input.bytes,
        ownerUserId: input.ownerUserId,
        mediaId: mediaFileId,
        storageKey,
      });
      await this.dependencies.repository.markStatus(mediaFileId, "READY", {
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        width: stored.width,
        height: stored.height,
      });
    } catch (error: unknown) {
      await this.dependencies.repository.markStatus(mediaFileId, "FAILED", {
        cleanupEligibleAt: this.dependencies.now?.() ?? new Date(),
      }).catch(() => undefined);
      throw error;
    }
    const receipt = await this.readReceipt(mediaFileId);
    if (receipt === null || receipt.state !== "READY") {
      throw new MediaError("MEDIA_PROVIDER_FAILURE", "Worker avatar receipt was not finalized");
    }
    return receipt;
  }

  public async readReceipt(mediaFileId: string): Promise<WorkerAvatarReceipt | null> {
    const row = await this.dependencies.repository.findById(mediaFileId);
    if (row === null || row.ownerType !== "WORKER_PROFILE_IMAGE") return null;
    const state = row.status === "READY"
      ? "READY"
      : row.status === "FAILED"
        ? "FAILED"
        : row.status === "PENDING_UPLOAD" || row.status === "PROCESSING"
          ? "PROCESSING"
          : null;
    if (state === null || !["image/jpeg", "image/png", "image/webp"].includes(row.contentType)) return null;
    return {
      mediaFileId: row.id,
      ownerUserId: row.ownerUserId,
      state,
      canonicalContentType: row.contentType as WorkerAvatarReceipt["canonicalContentType"],
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
      safeReceiptId: row.id,
    };
  }

  public async privateDelivery(mediaFileId: string): Promise<{ readonly url: string; readonly expiresAt: Date }> {
    const row = await this.dependencies.repository.findById(mediaFileId);
    if (row === null || row.ownerType !== "WORKER_PROFILE_IMAGE" || row.status !== "READY") {
      throw new MediaError("MEDIA_PROVIDER_FAILURE", "Worker avatar is not ready for private delivery");
    }
    const expiresAt = new Date((this.dependencies.now?.() ?? new Date()).getTime() + this.dependencies.signedUrlTtlSeconds * 1000);
    const delivery = await this.dependencies.storage.createAuthorizedDeliveryUrl({
      provider: row.storageProvider,
      storageKey: row.storageKey,
    }, expiresAt);
    return { url: delivery.url, expiresAt };
  }

  public async cleanup(mediaFileId: string, _safeReasonCode: string): Promise<void> {
    await this.dependencies.repository.markPendingDelete(mediaFileId);
  }
}

const acceptedContentTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function normalizeDeclaredContentType(value: string): "image/jpeg" | "image/png" | "image/webp" | null {
  if (value === "image/jpeg" || value === "image/jpg") return "image/jpeg";
  if (value === "image/png" || value === "image/webp") return value;
  return null;
}

/** Sharp-owned decode, orientation correction, metadata stripping, and private WebP normalization. */
export class SharpWorkerAvatarProcessor implements WorkerAvatarProcessor {
  public async process(bytes: Buffer): Promise<Awaited<ReturnType<WorkerAvatarProcessor["process"]>>> {
    try {
      const pipeline = sharp(bytes, {
        failOn: "error",
        limitInputPixels: 40_000_000,
        animated: false,
        pages: 1,
      });
      const metadata = await pipeline.metadata();
      if ((metadata.pages ?? 1) > 1 || metadata.pages === -1) {
        throw new MediaError("MEDIA_IMAGE_INVALID", "Animated Worker avatars are not accepted");
      }
      const sourceContentType = metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "png"
          ? "image/png"
          : metadata.format === "webp"
            ? "image/webp"
            : null;
      if (sourceContentType === null) {
        throw new MediaError("MEDIA_IMAGE_INVALID", "Worker avatar must be a decodable JPEG, PNG, or WebP");
      }
      const normalized = await pipeline
        .rotate()
        .resize({
          width: PROFILE_IMAGE_MAX_EDGE,
          height: PROFILE_IMAGE_MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (normalized.info.size > PROFILE_IMAGE_MAX_BYTES) {
        throw new MediaError("MEDIA_IMAGE_TOO_LARGE", "Normalized Worker avatar exceeds 5 MiB");
      }
      return {
        bytes: normalized.data,
        width: normalized.info.width,
        height: normalized.info.height,
        contentType: "image/webp",
        sourceContentType,
      };
    } catch (error: unknown) {
      if (error instanceof MediaError) throw error;
      throw new MediaError("MEDIA_IMAGE_INVALID", "Worker avatar could not be decoded safely");
    }
  }
}

export class WorkerAvatarAdapter implements WorkerAvatarPort {
  public constructor(
    private readonly processor: WorkerAvatarProcessor,
    private readonly persistence: WorkerAvatarPersistence,
  ) {}

  public async ingest(input: Parameters<WorkerAvatarPort["ingest"]>[0]) {
    if (!acceptedContentTypes.has(input.declaredContentType) || input.bytes.length === 0) {
      throw new MediaError("MEDIA_IMAGE_INVALID", "Worker avatar is invalid");
    }
    if (input.bytes.length > PROFILE_IMAGE_MAX_BYTES) {
      throw new MediaError("MEDIA_IMAGE_TOO_LARGE", "Worker avatar exceeds 5 MiB");
    }
    const processed = await this.processor.process(input.bytes);
    if (processed.width < 1
      || processed.height < 1
      || processed.width > PROFILE_IMAGE_MAX_EDGE
      || processed.height > PROFILE_IMAGE_MAX_EDGE
      || normalizeDeclaredContentType(input.declaredContentType) !== processed.sourceContentType) {
      throw new MediaError("MEDIA_IMAGE_INVALID", "Worker avatar content does not match its declared type");
    }
    return this.persistence.reserveAndStore({
      ownerUserId: input.ownerUserId,
      bytes: processed.bytes,
      contentType: processed.contentType,
      width: processed.width,
      height: processed.height,
    });
  }

  public readValidationReceipt(mediaFileId: string) { return this.persistence.readReceipt(mediaFileId); }
  public issuePrivateDelivery(input: Parameters<WorkerAvatarPort["issuePrivateDelivery"]>[0]) { return this.persistence.privateDelivery(input.mediaFileId); }
  public requestCleanup(input: Parameters<WorkerAvatarPort["requestCleanup"]>[0]) { return this.persistence.cleanup(input.mediaFileId, input.safeReasonCode); }
}

export class PrismaTransactionalWorkerAvatarAuthorizer implements TransactionalWorkerAvatarAuthorizer {
  public constructor(private readonly reader: { read(mediaFileId: string): Promise<{ readonly ownerUserId: string; readonly ownerType: string; readonly status: string } | null> }) {}
  public async assertReadyOwnedProfileImage(input: Parameters<TransactionalWorkerAvatarAuthorizer["assertReadyOwnedProfileImage"]>[0]) {
    const row = await this.reader.read(input.mediaFileId);
    return row?.ownerUserId === input.ownerUserId && row.ownerType === "WORKER_PROFILE_IMAGE" && row.status === "READY";
  }
}

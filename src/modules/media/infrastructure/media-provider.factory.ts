import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";

import type { AppEnvironment } from "../../../config/env.js";
import { MediaError } from "../domain/media.errors.js";
import type { MediaStoragePort, ProviderMediaPort } from "../domain/media.ports.js";
import type {
  MediaPendingUploadPort,
  ProviderMediaStatusReader,
  ProviderVerificationEvidencePort,
  TransactionalProviderVerificationEvidenceAuthorizerFactory,
} from "../media.public.js";
import {
  CloudinaryMediaAdapter,
  createOpaqueCloudinaryPublicId,
  type CloudinarySdk,
} from "./cloudinary-media.adapter.js";
import { MediaCleanupService } from "./media-cleanup.service.js";
import { PrismaMediaRepository } from "./prisma-media.repository.js";
import { ProviderMediaAdapter } from "./provider-media.adapter.js";
import { SharpProviderImageProcessor } from "./sharp-provider-image.processor.js";
import {
  inspectVerificationEvidence,
  ProviderVerificationEvidenceAdapter,
  type VerificationMalwareScanner,
} from "./provider-verification-evidence.adapter.js";

export interface MediaProviderSelection {
  readonly storage: MediaStoragePort;
  readonly signedUrlTtlSeconds: number;
  readonly imageMaxBytes: number;
}

/**
 * Selects the configured media storage provider (DEC-033).
 * `s3` fails readiness clearly — no S3 adapter in R1-P04.
 */
export function createMediaStoragePort(
  environment: AppEnvironment,
  sdk: CloudinarySdk = cloudinary,
): MediaProviderSelection {
  const provider = environment.MEDIA_STORAGE_PROVIDER;
  if (provider === undefined || provider.trim().length === 0) {
    throw new Error(
      "MEDIA_STORAGE_PROVIDER is required when customers/media runtime is composed",
    );
  }
  if (provider === "s3") {
    throw new MediaError(
      "MEDIA_PROVIDER_UNSUPPORTED",
      "S3 is not implemented in R1-P04",
    );
  }
  if (provider !== "cloudinary") {
    throw new Error(
      `Unsupported MEDIA_STORAGE_PROVIDER '${provider}'. R1-P04 supports cloudinary only.`,
    );
  }

  const cloudName = environment.CLOUDINARY_CLOUD_NAME;
  const apiKey = environment.CLOUDINARY_API_KEY;
  const apiSecret = environment.CLOUDINARY_API_SECRET;
  const folder = environment.CLOUDINARY_PROFILE_IMAGE_FOLDER;
  const ttl = environment.CLOUDINARY_SIGNED_URL_TTL_SECONDS;
  const maxBytes = environment.MEDIA_IMAGE_MAX_BYTES;

  if (
    cloudName === undefined ||
    cloudName.trim().length === 0 ||
    apiKey === undefined ||
    apiKey.trim().length === 0 ||
    apiSecret === undefined ||
    apiSecret.trim().length === 0 ||
    folder === undefined ||
    folder.trim().length === 0
  ) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, and CLOUDINARY_PROFILE_IMAGE_FOLDER are required when MEDIA_STORAGE_PROVIDER=cloudinary",
    );
  }
  if (ttl === undefined || !Number.isInteger(ttl) || ttl < 60 || ttl > 86_400) {
    throw new Error(
      "CLOUDINARY_SIGNED_URL_TTL_SECONDS must be a positive integer between 60 and 86400",
    );
  }
  if (maxBytes !== 5 * 1024 * 1024) {
    throw new Error(
      "MEDIA_IMAGE_MAX_BYTES must equal 5242880 (5 MiB) for R1-P04",
    );
  }

  return {
    storage: new CloudinaryMediaAdapter(sdk, {
      cloudName,
      apiKey,
      apiSecret,
      folder,
      signedUrlTtlSeconds: ttl,
    }),
    signedUrlTtlSeconds: ttl,
    imageMaxBytes: maxBytes,
  };
}

/**
 * Composition-owned pending-upload wiring. Kept out of media.public so the
 * public surface stays infrastructure-free.
 */
export function createMediaPendingUploadPort(): MediaPendingUploadPort {
  const repository = new PrismaMediaRepository();
  return {
    createOpaqueStorageKey: createOpaqueCloudinaryPublicId,
    async reservePendingUpload(input) {
      await repository.createPendingUpload({
        id: input.id,
        ownerUserId: input.ownerUserId,
        storageProvider: "CLOUDINARY",
        storageKey: input.storageKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
      });
    },
    markPendingDelete(mediaId) {
      return repository.markPendingDelete(mediaId);
    },
  };
}

/**
 * Composition-owned Provider media wiring. Public consumers import
 * `ProviderMediaPort` from media.public; factories stay in infrastructure.
 */
export function createProviderMediaPort(
  storage: MediaStoragePort,
  database?: unknown,
): ProviderMediaPort {
  const repository = new PrismaMediaRepository(
    database as ConstructorParameters<typeof PrismaMediaRepository>[0],
  );
  return new ProviderMediaAdapter(
    repository,
    storage,
    new SharpProviderImageProcessor(),
    new MediaCleanupService(repository, storage),
  );
}

/** Media-owned reader; composition never queries the Media Prisma delegate. */
export function createProviderMediaStatusReader(
  transaction?: unknown,
): ProviderMediaStatusReader {
  const repository = new PrismaMediaRepository(
    transaction as ConstructorParameters<typeof PrismaMediaRepository>[0],
  );
  return {
    async getMediaStatus(mediaId) {
      const row = await repository.findById(mediaId);
      if (row === null) {
        return null;
      }
      return {
        mediaId: row.id,
        status: row.status,
        contentType: row.contentType,
        byteSize: row.byteSize,
        width: row.width,
        height: row.height,
        hasReadyThumbnail:
          row.ownerType === "PROVIDER_GALLERY_VIDEO" && row.status === "READY",
      };
    },
  };
}

/** Media-owned R1-P06 private evidence pipeline. */
export function createProviderVerificationEvidencePort(input: {
  readonly environment: AppEnvironment;
  readonly scanner: VerificationMalwareScanner;
  readonly database?: unknown;
  readonly sdk?: CloudinarySdk;
}): ProviderVerificationEvidencePort {
  const selection = createMediaStoragePort(input.environment, input.sdk ?? cloudinary);
  if (!(selection.storage instanceof CloudinaryMediaAdapter)) {
    throw new Error("R1-P06 verification evidence requires the configured Cloudinary adapter");
  }
  const storage = selection.storage;
  const repository = new PrismaMediaRepository(
    input.database as ConstructorParameters<typeof PrismaMediaRepository>[0],
  );
  const folder = `${input.environment.CLOUDINARY_PROFILE_IMAGE_FOLDER ?? "cleanora-providers"}/verification-evidence`;
  const reserve = async (
    value: Parameters<ProviderVerificationEvidencePort["reserve"]>[0],
  ) => {
    const mediaFileId = randomUUID();
    await repository.reserveVerificationEvidence({
      id: mediaFileId,
      ownerUserId: value.ownerUserId,
      providerId: value.providerId,
      documentVersionId: value.documentVersionId,
      storageProvider: "CLOUDINARY",
      storageKey: createOpaqueCloudinaryPublicId(folder),
      contentType: value.declaredContentType,
      byteSize: value.byteSize,
      width: null,
      height: null,
    });
    return { mediaFileId, state: "PROCESSING" as const };
  };
  return new ProviderVerificationEvidenceAdapter({
    reserve,
    async ingest(value) {
      const reservation = await reserve({ ...value, byteSize: value.bytes.length });
      try {
        const inspected = await inspectVerificationEvidence({
          buffer: value.bytes,
          extension: value.originalExtension,
          declaredContentType: value.declaredContentType,
          scanner: input.scanner,
        });
        const row = await repository.findById(reservation.mediaFileId);
        if (row === null) throw new Error("MEDIA_VERIFICATION_STATE_CONFLICT");
        const stored = await storage.storeProviderVerificationEvidence({
          bytes: inspected.normalized,
          storageKey: row.storageKey,
          canonicalContentType: inspected.canonicalContentType,
          originalExtension: value.originalExtension,
        });
        await repository.markVerificationEvidenceReady({
          mediaFileId: row.id,
          canonicalContentType: inspected.canonicalContentType,
          // Limits and Provider evidence aggregates are based on the bytes the
          // caller supplied, not a potentially smaller normalized derivative.
          byteSize: value.bytes.length,
          width: stored.width > 0 ? stored.width : null,
          height: stored.height > 0 ? stored.height : null,
          pageCount: inspected.pageCount,
        });
        const receipt = await repository.readVerificationEvidenceReceipt(row.id);
        if (receipt === null) throw new Error("MEDIA_VERIFICATION_STATE_CONFLICT");
        return receipt;
      } catch (error) {
        await repository.markVerificationEvidenceFailed(reservation.mediaFileId);
        throw error;
      }
    },
    readValidationReceipt(mediaFileId) {
      return repository.readVerificationEvidenceReceipt(mediaFileId);
    },
    async issuePrivateDelivery(value) {
      const row = await repository.findById(value.mediaFileId);
      if (
        row === null ||
        row.ownerType !== "PROVIDER_VERIFICATION_DOCUMENT_PAGE" ||
        row.verificationProviderId !== value.providerId ||
        row.verificationDocumentVersionId !== value.documentVersionId ||
        row.status !== "READY" ||
        !["application/pdf", "image/jpeg", "image/png"].includes(row.contentType)
      ) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
      const expiresAt = new Date(Date.now() + selection.signedUrlTtlSeconds * 1000);
      return storage.createProviderVerificationEvidenceDelivery({
        storageKey: row.storageKey,
        contentType: row.contentType as "application/pdf" | "image/jpeg" | "image/png",
        expiresAt,
      });
    },
    async requestCleanup(value) {
      await repository.markPendingDelete(value.mediaFileId);
    },
  });
}

/** Media-owned exact receipt recheck for Provider transaction commits. */
export const createTransactionalProviderVerificationEvidenceAuthorizer:
  TransactionalProviderVerificationEvidenceAuthorizerFactory = (transaction) => {
    const repository = new PrismaMediaRepository(
      transaction as ConstructorParameters<typeof PrismaMediaRepository>[0],
    );
    return {
      async allReady(input) {
        if (input.evidence.length === 0) return false;
        const receipts = await Promise.all(
          input.evidence.map((item) =>
            repository.readVerificationEvidenceReceipt(item.mediaFileId),
          ),
        );
        return receipts.every((receipt, index) => {
          const expected = input.evidence[index];
          return expected !== undefined &&
            receipt?.state === "READY" &&
            receipt.providerId === input.providerId &&
            receipt.documentVersionId === input.documentVersionId &&
            receipt.canonicalContentType === expected.canonicalContentType &&
            receipt.byteSize === expected.byteSize &&
            receipt.pageCount === expected.pageCount;
        });
      },
    };
  };

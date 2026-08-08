import { v2 as cloudinary } from "cloudinary";

import type { AppEnvironment } from "../../../config/env.js";
import { MediaError } from "../domain/media.errors.js";
import type { MediaStoragePort } from "../domain/media.ports.js";
import type { MediaPendingUploadPort } from "../media.public.js";
import {
  CloudinaryMediaAdapter,
  createOpaqueCloudinaryPublicId,
  type CloudinarySdk,
} from "./cloudinary-media.adapter.js";
import { PrismaMediaRepository } from "./prisma-media.repository.js";

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

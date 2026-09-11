import { MediaError } from "./domain/media.errors.js";
import type {
  MediaStoragePort,
  ProfileImageProcessor,
  ProviderImageProcessor,
  ProviderMediaPort,
  StoreProfileImageInput,
} from "./domain/media.ports.js";
import type {
  DeliveryUrl,
  MediaOwnerType,
  MediaStatus,
  MediaStorageProviderName,
  NormalizedProfileImage,
  NormalizedProfileImageContentType,
  NormalizedProviderImage,
  ProviderImagePurpose,
  ProviderMediaOwnerType,
  ProviderMediaSafeView,
  StoredMediaReference,
  StoredProviderVideoReference,
} from "./domain/media.types.js";
import {
  CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
  CATALOG_SERVICE_IMAGE_MAX_BYTES,
  CATALOG_SERVICE_IMAGE_MAX_EDGE,
  MEDIA_OWNER_TYPES,
  MEDIA_STATUSES,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_EDGE,
  PROVIDER_IMAGE_DIMENSIONS,
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_MEDIA_OWNER_TYPES,
  PROVIDER_VIDEO_MAX_BYTES,
  PROVIDER_VIDEO_MAX_HEIGHT,
  PROVIDER_VIDEO_MAX_WIDTH,
  providerOwnerTypeForImagePurpose,
} from "./domain/media.types.js";
import { assertEvidenceSet } from "./domain/provider-verification-evidence.policy.js";

export type {
  DeliveryUrl,
  MediaOwnerType,
  MediaStatus,
  MediaStoragePort,
  MediaStorageProviderName,
  NormalizedProfileImage,
  NormalizedProfileImageContentType,
  NormalizedProviderImage,
  ProfileImageProcessor,
  ProviderImageProcessor,
  ProviderImagePurpose,
  ProviderMediaOwnerType,
  ProviderMediaPort,
  ProviderMediaSafeView,
  StoredMediaReference,
  StoredProviderVideoReference,
  StoreProfileImageInput,
};

export {
  MediaError,
  CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
  CATALOG_SERVICE_IMAGE_MAX_BYTES,
  CATALOG_SERVICE_IMAGE_MAX_EDGE,
  MEDIA_OWNER_TYPES,
  MEDIA_STATUSES,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_EDGE,
  PROVIDER_IMAGE_DIMENSIONS,
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_MEDIA_OWNER_TYPES,
  PROVIDER_VIDEO_MAX_BYTES,
  PROVIDER_VIDEO_MAX_HEIGHT,
  PROVIDER_VIDEO_MAX_WIDTH,
  providerOwnerTypeForImagePurpose,
  assertEvidenceSet as assertProviderVerificationEvidenceSet,
};

/**
 * Explicit Provider owner-type markers on the public surface (R1-P05).
 * Media never decides Provider authorization — callers supply purpose only.
 */
export const PROVIDER_LOGO = "PROVIDER_LOGO" as const satisfies ProviderMediaOwnerType;
export const PROVIDER_COVER =
  "PROVIDER_COVER" as const satisfies ProviderMediaOwnerType;
export const PROVIDER_GALLERY_IMAGE =
  "PROVIDER_GALLERY_IMAGE" as const satisfies ProviderMediaOwnerType;
export const PROVIDER_GALLERY_VIDEO =
  "PROVIDER_GALLERY_VIDEO" as const satisfies ProviderMediaOwnerType;

/** Explicit lifecycle markers required for Provider video/image finalization. */
export const PROCESSING = "PROCESSING" as const satisfies MediaStatus;
export const FAILED = "FAILED" as const satisfies MediaStatus;

/**
 * Cross-module pending-upload surface. Concrete wiring lives in composition /
 * media infrastructure factories — this file must stay infrastructure-free.
 */
export interface MediaPendingUploadPort {
  createOpaqueStorageKey(folder: string): string;
  reservePendingUpload(input: {
    readonly id: string;
    readonly ownerUserId: string;
    readonly storageKey: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly width: number;
    readonly height: number;
  }): Promise<void>;
  markPendingDelete(mediaId: string): Promise<void>;
}

export interface ProviderMediaStatusView {
  readonly mediaId: string;
  readonly status: MediaStatus;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly hasReadyThumbnail: boolean;
}

/** Media-owned status reader used by Provider completion projections. */
export interface ProviderMediaStatusReader {
  getMediaStatus(mediaId: string): Promise<ProviderMediaStatusView | null>;
}

/**
 * Approved public surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * `domain/` or `infrastructure/`.
 */
export const MEDIA_PUBLIC_CONTRACT = "media.public" as const;

export const WORKER_PROFILE_IMAGE = "WORKER_PROFILE_IMAGE" as const;

export interface WorkerAvatarReceipt {
  readonly mediaFileId: string;
  readonly ownerUserId: string;
  readonly state: "PROCESSING" | "READY" | "FAILED";
  readonly canonicalContentType: "image/jpeg" | "image/png" | "image/webp";
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly safeReceiptId: string;
}

export interface WorkerAvatarPort {
  ingest(input: {
    readonly ownerUserId: string;
    readonly declaredContentType: string;
    readonly bytes: Buffer;
  }): Promise<WorkerAvatarReceipt>;
  readValidationReceipt(mediaFileId: string): Promise<WorkerAvatarReceipt | null>;
  issuePrivateDelivery(input: {
    readonly mediaFileId: string;
    readonly actorUserId: string;
    readonly providerId: string;
    readonly workerId: string;
    readonly purpose: "WORKER_AVATAR_PRIVATE_READ";
  }): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  requestCleanup(input: {
    readonly mediaFileId: string;
    readonly safeReasonCode: string;
  }): Promise<void>;
}

export interface TransactionalWorkerAvatarAuthorizer {
  assertReadyOwnedProfileImage(input: {
    readonly mediaFileId: string;
    readonly ownerUserId: string;
  }): Promise<boolean>;
}

export type TransactionalWorkerAvatarAuthorizerFactory = (
  transaction: unknown,
) => TransactionalWorkerAvatarAuthorizer;

export const CATALOG_SERVICE_IMAGE =
  "CATALOG_SERVICE_IMAGE" as const satisfies MediaOwnerType;

/**
 * Safe Catalog service image receipt. It carries no storage key, signed URL,
 * or Catalog business meaning; Media owns file lifecycle only.
 */
export interface CatalogServiceImageReceipt {
  readonly mediaFileId: string;
  readonly ownerUserId: string;
  readonly state: "PROCESSING" | "READY" | "FAILED";
  readonly canonicalContentType: "image/jpeg" | "image/png" | "image/webp";
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly safeReceiptId: string;
}

/**
 * Media-owned Catalog service image pipeline. Catalog reserves the stable
 * media identity first, so `ingest` is idempotent for the same supplied
 * `mediaFileId` and a crashed upload can be resumed without a duplicate file.
 */
export interface CatalogServiceImagePort {
  ingest(input: {
    readonly mediaFileId: string;
    readonly ownerUserId: string;
    readonly declaredContentType: string;
    readonly bytes: Buffer;
  }): Promise<CatalogServiceImageReceipt>;
  readValidationReceipt(mediaFileId: string): Promise<CatalogServiceImageReceipt | null>;
  issueDelivery(input: {
    readonly mediaFileId: string;
    readonly purpose: "CATALOG_SERVICE_PRESENTATION";
  }): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  requestCleanup(input: {
    readonly mediaFileId: string;
    readonly safeReasonCode: string;
  }): Promise<void>;
}

/**
 * Transaction-bound recheck proving the reserved media identity is a READY
 * Catalog service image uploaded by the trusted staff principal.
 */
export interface TransactionalCatalogServiceImageAuthorizer {
  assertReadyCatalogServiceImage(input: {
    readonly mediaFileId: string;
    readonly uploaderUserId: string;
  }): Promise<boolean>;
}

export type TransactionalCatalogServiceImageAuthorizerFactory = (
  transaction: unknown,
) => TransactionalCatalogServiceImageAuthorizer;

/** Safe Catalog snapshot facts for associated service images. */
export interface CatalogServiceMediaSafeFact {
  readonly mediaFileId: string;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly width: number | null;
  readonly height: number | null;
  readonly status: string;
  readonly ownerUserId: string;
}

/**
 * Transaction-bound Media-owned reader for Catalog association snapshots.
 * Media interprets processing status and ownership; Catalog never reads
 * `media_files` persistence directly.
 */
export interface TransactionalCatalogServiceMediaFactsReader {
  readCatalogServiceMediaFacts(
    mediaFileIds: readonly string[],
  ): Promise<ReadonlyMap<string, CatalogServiceMediaSafeFact>>;
}

export type TransactionalCatalogServiceMediaFactsReaderFactory = (
  transaction: unknown,
) => TransactionalCatalogServiceMediaFactsReader;

export type ProviderVerificationEvidencePurpose =
  | "PROVIDER_DOCUMENT_MANAGEMENT"
  | "STAFF_DOCUMENT_REVIEW";

export interface ProviderVerificationEvidenceReceipt {
  readonly mediaFileId: string;
  readonly providerId: string;
  readonly documentVersionId: string;
  readonly state: "PROCESSING" | "READY" | "FAILED";
  readonly canonicalContentType: "application/pdf" | "image/jpeg" | "image/png";
  readonly byteSize: number;
  readonly pageCount: number | null;
  readonly safeReceiptId: string;
}

export interface ProviderVerificationEvidencePort {
  reserve(input: {
    readonly ownerUserId: string;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly originalExtension: ".pdf" | ".jpg" | ".jpeg" | ".png";
    readonly declaredContentType: string;
    readonly byteSize: number;
  }): Promise<{ readonly mediaFileId: string; readonly state: "PROCESSING" }>;
  ingest(input: {
    readonly ownerUserId: string;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly originalExtension: ".pdf" | ".jpg" | ".jpeg" | ".png";
    readonly declaredContentType: string;
    readonly bytes: Buffer;
  }): Promise<ProviderVerificationEvidenceReceipt>;
  readValidationReceipt(mediaFileId: string): Promise<ProviderVerificationEvidenceReceipt | null>;
  issuePrivateDelivery(input: {
    readonly mediaFileId: string;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly purpose: ProviderVerificationEvidencePurpose;
    readonly actorUserId: string;
  }): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  requestCleanup(input: { readonly mediaFileId: string; readonly safeReasonCode: string }): Promise<void>;
}

export interface TransactionalProviderVerificationEvidenceAuthorizer {
  allReady(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly evidence: readonly {
      readonly mediaFileId: string;
      readonly canonicalContentType: "application/pdf" | "image/jpeg" | "image/png";
      readonly byteSize: number;
      readonly pageCount: number | null;
    }[];
  }): Promise<boolean>;
}

export type TransactionalProviderVerificationEvidenceAuthorizerFactory = (
  transaction: unknown,
) => TransactionalProviderVerificationEvidenceAuthorizer;

export type {
  BookingAttachmentDelivery,
  BookingAttachmentFacts,
  BookingAttachmentReader,
} from "./infrastructure/prisma-booking-attachment.reader.js";
export { createBookingAttachmentReader } from "./infrastructure/prisma-booking-attachment.reader.js";

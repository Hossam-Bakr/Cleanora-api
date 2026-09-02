/** Profile image content type after Sharp normalization (DEC-033). */
export type NormalizedProfileImageContentType = "image/webp";

export type MediaStorageProviderName = "CLOUDINARY" | "S3";

/** Validated Cloudinary upload resource type for R1-P04 profile images. */
export type CloudinaryUploadResourceType = "image";

/** Validated Cloudinary delivery type for R1-P04 profile images. */
export type CloudinaryUploadType = "authenticated";

/** Normalized Cloudinary destroy outcomes exposed to internal callers. */
export type CloudinaryDestroyResult = "ok" | "not_found";

/**
 * Media owner types persisted on `media_files.owner_type`.
 * Provider values are owned by Media; Providers supplies purpose only.
 */
export const MEDIA_OWNER_TYPES = [
  "CUSTOMER_PROFILE_IMAGE",
  "WORKER_PROFILE_IMAGE",
  "PROVIDER_LOGO",
  "PROVIDER_COVER",
  "PROVIDER_GALLERY_IMAGE",
  "PROVIDER_GALLERY_VIDEO",
  "CATALOG_SERVICE_IMAGE",
] as const;

export type MediaOwnerType = (typeof MEDIA_OWNER_TYPES)[number];

export const PROVIDER_MEDIA_OWNER_TYPES = [
  "PROVIDER_LOGO",
  "PROVIDER_COVER",
  "PROVIDER_GALLERY_IMAGE",
  "PROVIDER_GALLERY_VIDEO",
] as const;

export type ProviderMediaOwnerType = (typeof PROVIDER_MEDIA_OWNER_TYPES)[number];

export type WorkerProfileImageOwnerType = "WORKER_PROFILE_IMAGE";

/**
 * Media lifecycle statuses persisted on `media_files.status`.
 * PROCESSING and FAILED support Provider video/image finalization.
 */
export const MEDIA_STATUSES = [
  "PENDING_UPLOAD",
  "READY",
  "PENDING_DELETE",
  "DELETED",
  "PROCESSING",
  "FAILED",
] as const;

export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export type ProviderImagePurpose = "LOGO" | "COVER" | "GALLERY_IMAGE";

export interface ProviderImageDimensions {
  readonly width: number;
  readonly height: number;
}

export const PROVIDER_IMAGE_DIMENSIONS: Readonly<
  Record<ProviderImagePurpose, ProviderImageDimensions>
> = {
  LOGO: { width: 600, height: 600 },
  COVER: { width: 1600, height: 600 },
  GALLERY_IMAGE: { width: 1200, height: 900 },
};

export function providerOwnerTypeForImagePurpose(
  purpose: ProviderImagePurpose,
): Exclude<ProviderMediaOwnerType, "PROVIDER_GALLERY_VIDEO"> {
  switch (purpose) {
    case "LOGO":
      return "PROVIDER_LOGO";
    case "COVER":
      return "PROVIDER_COVER";
    case "GALLERY_IMAGE":
      return "PROVIDER_GALLERY_IMAGE";
  }
}

export interface StoredMediaReference {
  readonly provider: MediaStorageProviderName;
  readonly storageKey: string;
  readonly contentType: NormalizedProfileImageContentType;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  /** Validated provider upload resource type (response-derived). */
  readonly uploadResourceType: CloudinaryUploadResourceType;
  /** Validated provider upload type (response-derived). */
  readonly uploadType: CloudinaryUploadType;
}

export interface StoredProviderVideoReference {
  readonly provider: "CLOUDINARY";
  readonly storageKey: string;
  readonly contentType: "video/mp4" | "video/webm";
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly uploadResourceType: "video";
  readonly uploadType: "authenticated";
}

export interface MediaRemoveResult {
  readonly destroyResult: CloudinaryDestroyResult;
}

export interface DeliveryUrl {
  readonly url: string;
  readonly urlExpiresAt: string;
}

export interface NormalizedProfileImage {
  readonly bytes: Buffer;
  readonly contentType: NormalizedProfileImageContentType;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
}

/** Provider image after Sharp normalize — WebP at fixed purpose dimensions. */
export interface NormalizedProviderImage {
  readonly bytes: Buffer;
  readonly contentType: NormalizedProfileImageContentType;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly purpose: ProviderImagePurpose;
  readonly ownerType: Exclude<ProviderMediaOwnerType, "PROVIDER_GALLERY_VIDEO">;
}

/**
 * Safe cross-module media projection. Never includes storage keys, Cloudinary
 * public ids, credentials, or raw provider payloads.
 */
export interface ProviderMediaSafeView {
  readonly mediaId: string;
  readonly status: MediaStatus;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly deliveryUrl?: DeliveryUrl;
  readonly thumbnailUrl?: DeliveryUrl;
}

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_EDGE = 1200;

/** Catalog service-image byte ceiling (FR-038); identical to profile-image limit. */
export const CATALOG_SERVICE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Catalog service-image max edge after normalization (FR-038). */
export const CATALOG_SERVICE_IMAGE_MAX_EDGE = 1200;

export const CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type CatalogServiceImageContentType =
  (typeof CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES)[number];

export const PROVIDER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROVIDER_VIDEO_MAX_BYTES = 40 * 1024 * 1024;
export const PROVIDER_VIDEO_MAX_WIDTH = 1920;
export const PROVIDER_VIDEO_MAX_HEIGHT = 1080;

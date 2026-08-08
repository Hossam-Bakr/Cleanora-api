/** Profile image content type after Sharp normalization (DEC-033). */
export type NormalizedProfileImageContentType = "image/webp";

export type MediaStorageProviderName = "CLOUDINARY" | "S3";

/** Validated Cloudinary upload resource type for R1-P04 profile images. */
export type CloudinaryUploadResourceType = "image";

/** Validated Cloudinary delivery type for R1-P04 profile images. */
export type CloudinaryUploadType = "authenticated";

/** Normalized Cloudinary destroy outcomes exposed to internal callers. */
export type CloudinaryDestroyResult = "ok" | "not_found";

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

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_EDGE = 1200;

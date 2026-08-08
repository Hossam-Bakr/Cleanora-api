import { MediaError } from "./domain/media.errors.js";
import type {
  MediaStoragePort,
  ProfileImageProcessor,
  StoreProfileImageInput,
} from "./domain/media.ports.js";
import type {
  DeliveryUrl,
  MediaStorageProviderName,
  NormalizedProfileImage,
  NormalizedProfileImageContentType,
  StoredMediaReference,
} from "./domain/media.types.js";
import {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_EDGE,
} from "./domain/media.types.js";

export type {
  DeliveryUrl,
  MediaStoragePort,
  MediaStorageProviderName,
  NormalizedProfileImage,
  NormalizedProfileImageContentType,
  ProfileImageProcessor,
  StoredMediaReference,
  StoreProfileImageInput,
};
export { MediaError, PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_MAX_EDGE };

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

/**
 * Approved public surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * `domain/` or `infrastructure/`.
 */
export const MEDIA_PUBLIC_CONTRACT = "media.public" as const;

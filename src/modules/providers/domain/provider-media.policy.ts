import {
  PROVIDER_IMAGE_DIMENSIONS,
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_VIDEO_MAX_BYTES,
  PROVIDER_VIDEO_MAX_HEIGHT,
  PROVIDER_VIDEO_MAX_WIDTH,
  type ProviderImagePurpose,
} from "#modules/media/media.public";

import { providersError } from "./providers.errors.js";
import type {
  ProviderApplicationStatus,
  ProviderGalleryKind,
  ProviderOperationalStatus,
} from "./providers.types.js";
import {
  canEditPostApprovalContent,
  resolveActorRelationship,
  type ProviderAuthorizationFacts,
} from "./provider-authorization.policy.js";

/** Locked gallery capacity (FR-040). Logo/cover never consume these. */
export const PROVIDER_GALLERY_IMAGE_MAX_COUNT = 12;
export const PROVIDER_GALLERY_VIDEO_MAX_COUNT = 2;

/** Submission media readiness (FR-041). Videos never satisfy this. */
export const PROVIDER_MIN_READY_GALLERY_IMAGES = 3;

/** UX guidance only — never a hard reject (FR-045). */
export const PROVIDER_VIDEO_DURATION_GUIDANCE_SECONDS = 60;

export const PROVIDER_IMAGE_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const PROVIDER_VIDEO_ALLOWED_MIME = [
  "video/mp4",
  "video/webm",
] as const;

export type ProviderImageMime = (typeof PROVIDER_IMAGE_ALLOWED_MIME)[number];
export type ProviderVideoMime = (typeof PROVIDER_VIDEO_ALLOWED_MIME)[number];

export type ProviderMediaCapacityStatus =
  | "PENDING_UPLOAD"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "PENDING_DELETE"
  | "DELETED";

/** Statuses that reserve gallery capacity (FR-047). */
export function countsTowardGalleryCapacity(
  status: ProviderMediaCapacityStatus,
): boolean {
  return (
    status === "PENDING_UPLOAD" ||
    status === "PROCESSING" ||
    status === "READY"
  );
}

/** Only READY media contributes to completion (FR-041, FR-046). */
export function contributesToMediaCompletion(
  status: ProviderMediaCapacityStatus,
  options: { readonly hasReadyThumbnail?: boolean; readonly kind: ProviderGalleryKind | "LOGO" | "COVER" },
): boolean {
  if (status !== "READY") {
    return false;
  }
  if (options.kind === "VIDEO") {
    return options.hasReadyThumbnail === true;
  }
  return true;
}

export function assertImageMime(contentType: string): ProviderImageMime {
  if (
    (PROVIDER_IMAGE_ALLOWED_MIME as readonly string[]).includes(contentType)
  ) {
    return contentType as ProviderImageMime;
  }
  throw providersError("PROVIDER_MEDIA_INVALID", {
    field: "contentType",
    reason: "IMAGE_MIME",
  });
}

export function assertVideoMime(contentType: string): ProviderVideoMime {
  if (
    (PROVIDER_VIDEO_ALLOWED_MIME as readonly string[]).includes(contentType)
  ) {
    return contentType as ProviderVideoMime;
  }
  throw providersError("PROVIDER_MEDIA_INVALID", {
    field: "contentType",
    reason: "VIDEO_MIME",
  });
}

export function assertImageByteLimit(byteSize: number): void {
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw providersError("PROVIDER_MEDIA_INVALID", {
      field: "byteSize",
      reason: "EMPTY",
    });
  }
  if (byteSize > PROVIDER_IMAGE_MAX_BYTES) {
    throw providersError("PROVIDER_MEDIA_INVALID", {
      field: "byteSize",
      reason: "IMAGE_TOO_LARGE",
      maxBytes: PROVIDER_IMAGE_MAX_BYTES,
    });
  }
}

export function assertVideoByteLimit(byteSize: number): void {
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw providersError("PROVIDER_MEDIA_INVALID", {
      field: "byteSize",
      reason: "EMPTY",
    });
  }
  if (byteSize > PROVIDER_VIDEO_MAX_BYTES) {
    throw providersError("PROVIDER_MEDIA_INVALID", {
      field: "byteSize",
      reason: "VIDEO_TOO_LARGE",
      maxBytes: PROVIDER_VIDEO_MAX_BYTES,
    });
  }
}

export function assertVideoDimensions(input: {
  readonly width: number | null | undefined;
  readonly height: number | null | undefined;
}): void {
  const width = input.width;
  const height = input.height;
  if (
    width === null ||
    width === undefined ||
    height === null ||
    height === undefined ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw providersError("PROVIDER_MEDIA_INVALID", {
      field: "dimensions",
      reason: "VIDEO_DIMENSIONS_REQUIRED",
    });
  }
  if (width > PROVIDER_VIDEO_MAX_WIDTH || height > PROVIDER_VIDEO_MAX_HEIGHT) {
    throw providersError("PROVIDER_MEDIA_INVALID", {
      field: "dimensions",
      reason: "VIDEO_EXCEEDS_1080P",
      maxWidth: PROVIDER_VIDEO_MAX_WIDTH,
      maxHeight: PROVIDER_VIDEO_MAX_HEIGHT,
    });
  }
}

/**
 * Duration is guidance only. Callers may surface UX hints; never reject.
 */
export function evaluateVideoDurationGuidance(
  durationSeconds: number | null | undefined,
): {
  readonly withinGuidance: boolean;
  readonly guidanceSeconds: typeof PROVIDER_VIDEO_DURATION_GUIDANCE_SECONDS;
} {
  if (
    durationSeconds === null ||
    durationSeconds === undefined ||
    !Number.isFinite(durationSeconds)
  ) {
    return {
      withinGuidance: true,
      guidanceSeconds: PROVIDER_VIDEO_DURATION_GUIDANCE_SECONDS,
    };
  }
  return {
    withinGuidance: durationSeconds <= PROVIDER_VIDEO_DURATION_GUIDANCE_SECONDS,
    guidanceSeconds: PROVIDER_VIDEO_DURATION_GUIDANCE_SECONDS,
  };
}

export function fixedImageDimensions(
  purpose: ProviderImagePurpose,
): { readonly width: number; readonly height: number } {
  return PROVIDER_IMAGE_DIMENSIONS[purpose];
}

export function assertGalleryImageCapacity(currentCountingImages: number): void {
  if (currentCountingImages >= PROVIDER_GALLERY_IMAGE_MAX_COUNT) {
    throw providersError("PROVIDER_MEDIA_LIMIT_EXCEEDED", {
      kind: "IMAGE",
      limit: PROVIDER_GALLERY_IMAGE_MAX_COUNT,
      current: currentCountingImages,
    });
  }
}

export function assertGalleryVideoCapacity(currentCountingVideos: number): void {
  if (currentCountingVideos >= PROVIDER_GALLERY_VIDEO_MAX_COUNT) {
    throw providersError("PROVIDER_MEDIA_LIMIT_EXCEEDED", {
      kind: "VIDEO",
      limit: PROVIDER_GALLERY_VIDEO_MAX_COUNT,
      current: currentCountingVideos,
    });
  }
}

/** Mime + byte preflight before reserve (FR-042–FR-045). */
export function assertGalleryUploadConstraints(
  kind: ProviderGalleryKind,
  contentType: string,
  bytes: { readonly byteLength: number },
): void {
  if (kind === "IMAGE") {
    assertImageMime(contentType);
    assertImageByteLimit(bytes.byteLength);
    return;
  }
  assertVideoMime(contentType);
  assertVideoByteLimit(bytes.byteLength);
}

/**
 * Kind-scoped capacity gate for gallery rows that reserve slots (FR-040/047).
 * Callers pass current gallery items under the Provider row lock.
 */
export function assertGalleryCapacityForKind(
  kind: ProviderGalleryKind,
  items: readonly { readonly kind: ProviderGalleryKind }[],
): void {
  if (kind === "IMAGE") {
    assertGalleryImageCapacity(
      items.filter((item) => item.kind === "IMAGE").length,
    );
    return;
  }
  assertGalleryVideoCapacity(
    items.filter((item) => item.kind === "VIDEO").length,
  );
}

export function countGalleryByKind(
  items: readonly {
    readonly kind: ProviderGalleryKind;
    readonly status: ProviderMediaCapacityStatus;
  }[],
): { readonly images: number; readonly videos: number } {
  let images = 0;
  let videos = 0;
  for (const item of items) {
    if (!countsTowardGalleryCapacity(item.status)) {
      continue;
    }
    if (item.kind === "IMAGE") {
      images += 1;
    } else {
      videos += 1;
    }
  }
  return { images, videos };
}

export function countReadyGalleryImages(
  items: readonly {
    readonly kind: ProviderGalleryKind;
    readonly status: ProviderMediaCapacityStatus;
    readonly hasReadyThumbnail?: boolean;
  }[],
): number {
  let ready = 0;
  for (const item of items) {
    if (item.kind !== "IMAGE") {
      continue;
    }
    if (
      contributesToMediaCompletion(item.status, {
        kind: "IMAGE",
        ...(item.hasReadyThumbnail === undefined
          ? {}
          : { hasReadyThumbnail: item.hasReadyThumbnail }),
      })
    ) {
      ready += 1;
    }
  }
  return ready;
}

/**
 * Application Owner edits while DRAFT/CHANGES_REQUESTED.
 * After APPROVED, Application Owner (who is OWNER) and active OWNER/ADMIN may
 * edit — including while operationally SUSPENDED (remediation).
 * PENDING_REVIEW and REJECTED lock media mutations.
 *
 * Note: `resolveActorRelationship` prefers APPLICATION_OWNER over membership,
 * so post-approval owners still appear as APPLICATION_OWNER.
 */
export function canEditProviderMedia(
  facts: ProviderAuthorizationFacts,
): boolean {
  const relationship = resolveActorRelationship(facts);
  if (
    facts.applicationStatus === "DRAFT" ||
    facts.applicationStatus === "CHANGES_REQUESTED"
  ) {
    return relationship === "APPLICATION_OWNER";
  }
  if (facts.applicationStatus !== "APPROVED") {
    return false;
  }
  if (relationship === "APPLICATION_OWNER") {
    return true;
  }
  return canEditPostApprovalContent(facts);
}

export function assertCanEditProviderMedia(
  facts: ProviderAuthorizationFacts,
): void {
  if (canEditProviderMedia(facts)) {
    return;
  }
  if (
    facts.applicationStatus === "PENDING_REVIEW" ||
    facts.applicationStatus === "REJECTED"
  ) {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      reason: "MEDIA_LOCKED",
      applicationStatus: facts.applicationStatus,
    });
  }
  throw providersError("PROVIDER_ACCESS_DENIED");
}

export function mediaEditableApplicationStatuses(): readonly ProviderApplicationStatus[] {
  return ["DRAFT", "CHANGES_REQUESTED", "APPROVED"];
}

/** Approval is preserved; operational SUSPENDED still allows remediation edits. */
export function preservesApprovedOnMediaEdit(
  applicationStatus: ProviderApplicationStatus,
  _operationalStatus: ProviderOperationalStatus,
): boolean {
  return applicationStatus === "APPROVED";
}

export {
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_VIDEO_MAX_BYTES,
  PROVIDER_VIDEO_MAX_WIDTH,
  PROVIDER_VIDEO_MAX_HEIGHT,
  PROVIDER_IMAGE_DIMENSIONS,
};

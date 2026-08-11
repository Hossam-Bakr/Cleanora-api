import {
  assertCanEditProviderMedia,
  assertGalleryCapacityForKind,
  assertGalleryImageCapacity,
  assertGalleryUploadConstraints,
  assertGalleryVideoCapacity,
  assertImageByteLimit,
  assertImageMime,
  assertVideoByteLimit,
  assertVideoDimensions,
  assertVideoMime,
  canEditProviderMedia,
  contributesToMediaCompletion,
  countGalleryByKind,
  countReadyGalleryImages,
  countsTowardGalleryCapacity,
  evaluateVideoDurationGuidance,
  fixedImageDimensions,
  mediaEditableApplicationStatuses,
  preservesApprovedOnMediaEdit,
  PROVIDER_GALLERY_IMAGE_MAX_COUNT,
  PROVIDER_GALLERY_VIDEO_MAX_COUNT,
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_MIN_READY_GALLERY_IMAGES,
  PROVIDER_VIDEO_DURATION_GUIDANCE_SECONDS,
  PROVIDER_VIDEO_MAX_BYTES,
  PROVIDER_VIDEO_MAX_HEIGHT,
  PROVIDER_VIDEO_MAX_WIDTH,
} from "../../../../src/modules/providers/domain/provider-media.policy.js";
import type { ProviderAuthorizationFacts } from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

function ownerFacts(
  overrides: Partial<ProviderAuthorizationFacts> = {},
): ProviderAuthorizationFacts {
  return {
    actorUserId: "owner-1",
    actorActive: true,
    applicationOwnerUserId: "owner-1",
    membership: null,
    staffAdmin: false,
    providerAdminEnabled: false,
    applicationStatus: "DRAFT",
    operationalStatus: "INACTIVE",
    ...overrides,
  };
}

describe("US4 provider media policy (T051)", () => {
  it("locks gallery capacity at 12 images and 2 videos", () => {
    expect(PROVIDER_GALLERY_IMAGE_MAX_COUNT).toBe(12);
    expect(PROVIDER_GALLERY_VIDEO_MAX_COUNT).toBe(2);
    expect(() => assertGalleryImageCapacity(12)).toThrow(AppError);
    expect(() => assertGalleryVideoCapacity(2)).toThrow(AppError);
    expect(() => assertGalleryImageCapacity(11)).not.toThrow();
    expect(() => assertGalleryVideoCapacity(1)).not.toThrow();
  });

  it("preflights gallery upload mime/bytes and kind capacity", () => {
    expect(() =>
      assertGalleryUploadConstraints("IMAGE", "image/png", {
        byteLength: 1024,
      }),
    ).not.toThrow();
    expect(() =>
      assertGalleryUploadConstraints("VIDEO", "video/mp4", {
        byteLength: 2048,
      }),
    ).not.toThrow();
    expect(() =>
      assertGalleryUploadConstraints("IMAGE", "video/mp4", {
        byteLength: 1024,
      }),
    ).toThrow(AppError);
    expect(() =>
      assertGalleryUploadConstraints("VIDEO", "image/png", {
        byteLength: 1024,
      }),
    ).toThrow(AppError);

    const elevenImages = Array.from({ length: 11 }, () => ({
      kind: "IMAGE" as const,
    }));
    expect(() =>
      assertGalleryCapacityForKind("IMAGE", elevenImages),
    ).not.toThrow();
    expect(() =>
      assertGalleryCapacityForKind("IMAGE", [
        ...elevenImages,
        { kind: "IMAGE" },
      ]),
    ).toThrow(AppError);
    expect(() =>
      assertGalleryCapacityForKind("VIDEO", [
        { kind: "VIDEO" },
        { kind: "VIDEO" },
      ]),
    ).toThrow(AppError);
  });

  it("counts pending and processing toward capacity but not failed/deleted", () => {
    expect(countsTowardGalleryCapacity("PENDING_UPLOAD")).toBe(true);
    expect(countsTowardGalleryCapacity("PROCESSING")).toBe(true);
    expect(countsTowardGalleryCapacity("READY")).toBe(true);
    expect(countsTowardGalleryCapacity("FAILED")).toBe(false);
    expect(countsTowardGalleryCapacity("PENDING_DELETE")).toBe(false);
    expect(countsTowardGalleryCapacity("DELETED")).toBe(false);

    const counts = countGalleryByKind([
      { kind: "IMAGE", status: "READY" },
      { kind: "IMAGE", status: "PENDING_UPLOAD" },
      { kind: "IMAGE", status: "FAILED" },
      { kind: "VIDEO", status: "PROCESSING" },
      { kind: "VIDEO", status: "READY" },
      { kind: "VIDEO", status: "DELETED" },
    ]);
    expect(counts).toEqual({ images: 2, videos: 2 });
  });

  it("never lets logo/cover consume gallery image capacity", () => {
    const galleryOnly = countGalleryByKind([
      { kind: "IMAGE", status: "READY" },
      { kind: "IMAGE", status: "READY" },
    ]);
    expect(galleryOnly.images).toBe(2);
    expect(PROVIDER_GALLERY_IMAGE_MAX_COUNT).toBe(12);
  });

  it("requires READY media for completion and never counts videos as images", () => {
    expect(PROVIDER_MIN_READY_GALLERY_IMAGES).toBe(3);
    expect(
      contributesToMediaCompletion("PROCESSING", { kind: "IMAGE" }),
    ).toBe(false);
    expect(contributesToMediaCompletion("READY", { kind: "IMAGE" })).toBe(true);
    expect(
      contributesToMediaCompletion("READY", {
        kind: "VIDEO",
        hasReadyThumbnail: false,
      }),
    ).toBe(false);
    expect(
      contributesToMediaCompletion("READY", {
        kind: "VIDEO",
        hasReadyThumbnail: true,
      }),
    ).toBe(true);

    const readyImages = countReadyGalleryImages([
      { kind: "IMAGE", status: "READY" },
      { kind: "IMAGE", status: "READY" },
      { kind: "IMAGE", status: "PROCESSING" },
      { kind: "VIDEO", status: "READY", hasReadyThumbnail: true },
      { kind: "VIDEO", status: "READY", hasReadyThumbnail: true },
    ]);
    expect(readyImages).toBe(2);
  });

  it("accepts only JPEG/PNG/WebP images up to 5 MiB", () => {
    expect(assertImageMime("image/jpeg")).toBe("image/jpeg");
    expect(assertImageMime("image/png")).toBe("image/png");
    expect(assertImageMime("image/webp")).toBe("image/webp");
    expect(() => assertImageMime("image/gif")).toThrow(AppError);
    expect(() => assertImageByteLimit(PROVIDER_IMAGE_MAX_BYTES)).not.toThrow();
    expect(() => assertImageByteLimit(PROVIDER_IMAGE_MAX_BYTES + 1)).toThrow(
      AppError,
    );
  });

  it("normalizes images to fixed logo/cover/gallery dimensions", () => {
    expect(fixedImageDimensions("LOGO")).toEqual({ width: 600, height: 600 });
    expect(fixedImageDimensions("COVER")).toEqual({ width: 1600, height: 600 });
    expect(fixedImageDimensions("GALLERY_IMAGE")).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it("accepts only MP4/WebM videos up to 40 MiB and 1080p", () => {
    expect(assertVideoMime("video/mp4")).toBe("video/mp4");
    expect(assertVideoMime("video/webm")).toBe("video/webm");
    expect(() => assertVideoMime("video/avi")).toThrow(AppError);
    expect(() => assertVideoByteLimit(PROVIDER_VIDEO_MAX_BYTES)).not.toThrow();
    expect(() => assertVideoByteLimit(PROVIDER_VIDEO_MAX_BYTES + 1)).toThrow(
      AppError,
    );
    expect(() =>
      assertVideoDimensions({
        width: PROVIDER_VIDEO_MAX_WIDTH,
        height: PROVIDER_VIDEO_MAX_HEIGHT,
      }),
    ).not.toThrow();
    expect(() =>
      assertVideoDimensions({
        width: PROVIDER_VIDEO_MAX_WIDTH + 1,
        height: PROVIDER_VIDEO_MAX_HEIGHT,
      }),
    ).toThrow(AppError);
  });

  it("treats sixty seconds as guidance only, never a hard reject", () => {
    expect(PROVIDER_VIDEO_DURATION_GUIDANCE_SECONDS).toBe(60);
    expect(evaluateVideoDurationGuidance(61).withinGuidance).toBe(false);
    expect(evaluateVideoDurationGuidance(60).withinGuidance).toBe(true);
    expect(evaluateVideoDurationGuidance(null).withinGuidance).toBe(true);
    // Policy exposes guidance; it never throws for duration.
    expect(() => evaluateVideoDurationGuidance(10_000)).not.toThrow();
  });

  it("allows Application Owner media edits only while DRAFT or CHANGES_REQUESTED", () => {
    expect(canEditProviderMedia(ownerFacts({ applicationStatus: "DRAFT" }))).toBe(
      true,
    );
    expect(
      canEditProviderMedia(
        ownerFacts({ applicationStatus: "CHANGES_REQUESTED" }),
      ),
    ).toBe(true);
    expect(
      canEditProviderMedia(ownerFacts({ applicationStatus: "PENDING_REVIEW" })),
    ).toBe(false);
    expect(
      canEditProviderMedia(ownerFacts({ applicationStatus: "REJECTED" })),
    ).toBe(false);
    expect(() =>
      assertCanEditProviderMedia(
        ownerFacts({ applicationStatus: "PENDING_REVIEW" }),
      ),
    ).toThrow(AppError);
  });

  it("covers remaining media policy edge branches", () => {
    expect(countsTowardGalleryCapacity("FAILED")).toBe(false);
    expect(countsTowardGalleryCapacity("DELETED")).toBe(false);
    expect(countsTowardGalleryCapacity("PENDING_DELETE")).toBe(false);
    expect(
      contributesToMediaCompletion("READY", {
        kind: "VIDEO",
        hasReadyThumbnail: false,
      }),
    ).toBe(false);
    expect(contributesToMediaCompletion("FAILED", { kind: "IMAGE" })).toBe(
      false,
    );

    expect(() => assertImageByteLimit(0)).toThrow(AppError);
    expect(() => assertVideoByteLimit(-1)).toThrow(AppError);
    expect(() =>
      assertVideoDimensions({ width: null, height: 1080 }),
    ).toThrow(AppError);
    expect(() =>
      assertVideoDimensions({ width: 1920, height: undefined }),
    ).toThrow(AppError);
    expect(evaluateVideoDurationGuidance(undefined).withinGuidance).toBe(true);
    expect(evaluateVideoDurationGuidance(Number.NaN).withinGuidance).toBe(true);

    expect(mediaEditableApplicationStatuses()).toEqual([
      "DRAFT",
      "CHANGES_REQUESTED",
      "APPROVED",
    ]);
    expect(preservesApprovedOnMediaEdit("DRAFT", "INACTIVE")).toBe(false);

    expect(() =>
      assertCanEditProviderMedia(ownerFacts({ applicationStatus: "REJECTED" })),
    ).toThrow(AppError);
    expect(() =>
      assertCanEditProviderMedia(
        ownerFacts({
          actorUserId: "stranger",
          applicationOwnerUserId: "owner-1",
          applicationStatus: "DRAFT",
          membership: null,
        }),
      ),
    ).toThrow(AppError);

    expect(
      countGalleryByKind([
        { kind: "IMAGE", status: "READY" },
        { kind: "IMAGE", status: "FAILED" },
        { kind: "VIDEO", status: "PROCESSING" },
        { kind: "VIDEO", status: "DELETED" },
      ]),
    ).toEqual({ images: 1, videos: 1 });

    expect(
      canEditProviderMedia({
        actorUserId: "admin-1",
        actorActive: true,
        applicationOwnerUserId: "owner-1",
        membership: { level: "ADMIN", status: "ACTIVE" },
        staffAdmin: false,
        providerAdminEnabled: true,
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
      }),
    ).toBe(true);
  });
});

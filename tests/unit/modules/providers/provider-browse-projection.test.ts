import { ProviderBrowseProjectionService } from "#modules/providers/provider-browse-projection.service";

describe("ProviderBrowseProjectionService EX-01", () => {
  it("omits media slots when signing fails without failing the preview", async () => {
    const service = new ProviderBrowseProjectionService({
      providers: {
        findById: vi.fn().mockResolvedValue({
          id: "p1",
          kind: "INDIVIDUAL_TEAM",
        }),
        getProfile: vi.fn().mockResolvedValue({
          displayNameAr: "فريق",
          displayNameEn: "Team",
          descriptionAr: null,
          descriptionEn: null,
          countryId: "c1",
        }),
      },
      activeCountries: {
        getById: vi.fn().mockResolvedValue({ id: "c1", code: "EG" }),
      },
      mediaUsage: {
        getUsageSnapshot: vi.fn().mockResolvedValue({
          logoMediaFileId: "logo-1",
          coverMediaFileId: "cover-1",
          gallery: [
            {
              galleryItemId: "gi1",
              mediaFileId: "g1",
              kind: "IMAGE",
              status: "READY",
              hasReadyThumbnail: false,
              position: 0,
            },
            {
              galleryItemId: "gi2",
              mediaFileId: "g2",
              kind: "IMAGE",
              status: "READY",
              hasReadyThumbnail: false,
              position: 1,
            },
          ],
          logoStatus: "READY",
          coverStatus: "READY",
          imageCount: 2,
          videoCount: 0,
          readyGalleryImageCount: 2,
        }),
      },
      mediaReader: {
        getMediaStatus: vi.fn().mockResolvedValue({
          status: "READY",
          contentType: "image/jpeg",
          width: 10,
          height: 10,
          hasReadyThumbnail: false,
        }),
      },
      media: {
        createSignedDeliveryUrl: vi.fn(async (mediaId: string) => {
          if (mediaId === "logo-1" || mediaId === "g1") {
            throw new Error("sign failed");
          }
          return {
            url: `https://cdn.example/${mediaId}`,
            urlExpiresAt: "2099-01-01T00:00:00.000Z",
          };
        }),
        createSignedThumbnailUrl: vi.fn(),
      },
      signedUrlTtlSeconds: 60,
      clock: () => new Date("2026-09-10T00:00:00.000Z"),
    });

    const preview = await service.getContactFreePreview("p1");
    expect(preview).not.toBeNull();
    expect(preview?.logo).toBeNull();
    expect(preview?.cover?.deliveryUrl).toContain("cover-1");
    expect(preview?.gallery).toHaveLength(1);
    expect(preview?.gallery[0]?.deliveryUrl).toContain("g2");
  });

  it("supports text-only enrichment without loading or signing media", async () => {
    const getUsageSnapshot = vi.fn();
    const service = new ProviderBrowseProjectionService({
      providers: {
        findById: vi.fn().mockResolvedValue({ id: "p1", kind: "INDIVIDUAL_TEAM" }),
        getProfile: vi.fn().mockResolvedValue({
          displayNameAr: "فريق",
          displayNameEn: "Team",
          descriptionAr: null,
          descriptionEn: null,
          countryId: null,
        }),
      },
      activeCountries: { getById: vi.fn() },
      mediaUsage: { getUsageSnapshot },
      mediaReader: { getMediaStatus: vi.fn() },
      media: {
        createSignedDeliveryUrl: vi.fn(),
        createSignedThumbnailUrl: vi.fn(),
      },
      signedUrlTtlSeconds: 60,
    });
    await expect(
      service.getContactFreePreview("p1", { includeMedia: false }),
    ).resolves.toMatchObject({ displayNameEn: "Team", logo: null, gallery: [] });
    expect(getUsageSnapshot).not.toHaveBeenCalled();
  });

  it("returns null for missing Providers and signs ready video thumbnails only", async () => {
    const findById = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "p1", kind: "INDIVIDUAL_TEAM" });
    const service = new ProviderBrowseProjectionService({
      providers: {
        findById,
        getProfile: vi.fn().mockResolvedValue({
          displayNameAr: "فريق",
          displayNameEn: "Team",
          descriptionAr: null,
          descriptionEn: null,
          countryId: "c1",
        }),
      },
      activeCountries: { getById: vi.fn().mockResolvedValue(null) },
      mediaUsage: {
        getUsageSnapshot: vi.fn().mockResolvedValue({
          logoMediaFileId: "not-ready",
          coverMediaFileId: null,
          gallery: [
            {
              galleryItemId: "video-item",
              mediaFileId: "video-ready",
              kind: "VIDEO",
              status: "READY",
              hasReadyThumbnail: true,
              position: 0,
            },
          ],
          logoStatus: "PROCESSING",
          coverStatus: "EMPTY",
          imageCount: 0,
          videoCount: 1,
          readyGalleryImageCount: 0,
        }),
      },
      mediaReader: {
        getMediaStatus: vi.fn(async (mediaId: string) =>
          mediaId === "video-ready"
            ? {
                mediaId,
                status: "READY" as const,
                contentType: "video/mp4",
                byteSize: 1024,
                width: 1920,
                height: 1080,
                hasReadyThumbnail: true,
              }
            : null,
        ),
      },
      media: {
        createSignedDeliveryUrl: vi.fn(async (mediaId: string) => ({
          url: `https://cdn.example/${mediaId}`,
          urlExpiresAt: "2099-01-01T00:00:00.000Z",
        })),
        createSignedThumbnailUrl: vi.fn().mockResolvedValue({
          url: "https://cdn.example/video-ready/thumb",
          urlExpiresAt: "2099-01-01T00:00:00.000Z",
        }),
      },
      signedUrlTtlSeconds: 60,
    });
    await expect(service.getContactFreePreview("missing")).resolves.toBeNull();
    const preview = await service.getContactFreePreview("p1");
    expect(preview?.logo).toBeNull();
    expect(preview?.gallery[0]).toMatchObject({
      kind: "VIDEO",
      thumbnailUrl: "https://cdn.example/video-ready/thumb",
    });
  });
});

import type { ProviderMediaPort } from "#modules/media/media.public";

import type {
  ActiveCountryReaderPort,
  ProviderMediaReaderPort,
  ProviderMediaUsageReaderPort,
  ProviderRepositoryPort,
} from "./domain/providers.ports.js";
import {
  mapProviderPreview,
  type ProviderBrowseMediaDto,
  type ProviderPreviewDto,
} from "./provider.dto.js";

export interface ProviderBrowseProjectionDependencies {
  readonly providers: Pick<
    ProviderRepositoryPort,
    "findById" | "getProfile"
  >;
  readonly activeCountries: Pick<ActiveCountryReaderPort, "getById">;
  readonly mediaUsage: ProviderMediaUsageReaderPort;
  readonly mediaReader: ProviderMediaReaderPort;
  readonly media: Pick<
    ProviderMediaPort,
    "createSignedDeliveryUrl" | "createSignedThumbnailUrl"
  >;
  readonly signedUrlTtlSeconds: number;
  readonly clock?: () => Date;
}

/**
 * Providers-owned contact-free projection for guest Browse enrichment.
 * A single Media signing failure follows EX-01 and cannot fail the aggregate.
 */
export class ProviderBrowseProjectionService {
  public constructor(
    private readonly dependencies: ProviderBrowseProjectionDependencies,
  ) {}

  public async getContactFreePreview(
    providerId: string,
    options?: { readonly includeMedia?: boolean },
  ): Promise<ProviderPreviewDto | null> {
    const provider = await this.dependencies.providers.findById(providerId);
    if (provider === null) {
      return null;
    }
    const profile = await this.dependencies.providers.getProfile(providerId);
    const country =
      profile?.countryId === null || profile?.countryId === undefined
        ? null
        : await this.dependencies.activeCountries.getById(profile.countryId);
    if (options?.includeMedia === false) {
      return mapProviderPreview({
        provider,
        profile,
        countryCode: country?.code ?? null,
      });
    }
    const usage = await this.dependencies.mediaUsage.getUsageSnapshot(providerId);
    const expiresAt = new Date(
      (this.dependencies.clock?.() ?? new Date()).getTime() +
        this.dependencies.signedUrlTtlSeconds * 1000,
    );
    const [logo, cover, gallery] = await Promise.all([
      this.toMedia(usage.logoMediaFileId, "IMAGE", expiresAt, false),
      this.toMedia(usage.coverMediaFileId, "IMAGE", expiresAt, false),
      Promise.all(
        usage.gallery.map((item) =>
          this.toMedia(
            item.mediaFileId,
            item.kind,
            expiresAt,
            item.kind === "VIDEO" && item.hasReadyThumbnail,
          ),
        ),
      ),
    ]);

    return mapProviderPreview({
      provider,
      profile,
      countryCode: country?.code ?? null,
      logo,
      cover,
      gallery: gallery.filter(
        (item): item is ProviderBrowseMediaDto => item !== null,
      ),
    });
  }

  private async toMedia(
    mediaId: string | null,
    kind: "IMAGE" | "VIDEO",
    expiresAt: Date,
    includeThumbnail: boolean,
  ): Promise<ProviderBrowseMediaDto | null> {
    if (mediaId === null) {
      return null;
    }
    const facts = await this.dependencies.mediaReader.getMediaStatus(mediaId);
    if (facts?.status !== "READY") {
      return null;
    }
    try {
      const delivery = await this.dependencies.media.createSignedDeliveryUrl(
        mediaId,
        expiresAt,
      );
      let thumbnailUrl: string | null = null;
      if (includeThumbnail) {
        try {
          thumbnailUrl = (
            await this.dependencies.media.createSignedThumbnailUrl(
              mediaId,
              expiresAt,
            )
          ).url;
        } catch {
          thumbnailUrl = null;
        }
      }
      return {
        kind,
        contentType: facts.contentType,
        width: facts.width,
        height: facts.height,
        deliveryUrl: delivery.url,
        urlExpiresAt: delivery.urlExpiresAt,
        thumbnailUrl,
      };
    } catch {
      return null;
    }
  }
}

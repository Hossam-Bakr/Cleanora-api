import type { Prisma } from "#generated/prisma/client";
import { getPrismaClient } from "#database/prisma";

import {
  countGalleryByKind,
  countReadyGalleryImages,
  countsTowardGalleryCapacity,
  type ProviderMediaCapacityStatus,
} from "../domain/provider-media.policy.js";
import type {
  ProviderMediaUsageReaderPort,
  ProviderMediaReaderPort,
} from "../domain/providers.ports.js";
import type {
  ProviderGalleryItemRecord,
  ProviderGalleryKind,
  ProviderProfileRecord,
} from "../domain/providers.types.js";

type DbClient = Prisma.TransactionClient | ReturnType<typeof getPrismaClient>;

export interface ProviderGalleryCapacityItem {
  readonly galleryItemId: string;
  readonly kind: ProviderGalleryKind;
  readonly mediaFileId: string;
  readonly status: ProviderMediaCapacityStatus;
  readonly hasReadyThumbnail: boolean;
  readonly position: number;
}

export interface ProviderMediaUsageSnapshot {
  readonly logoMediaFileId: string | null;
  readonly coverMediaFileId: string | null;
  readonly logoStatus: ProviderMediaCapacityStatus | null;
  readonly coverStatus: ProviderMediaCapacityStatus | null;
  readonly gallery: readonly ProviderGalleryCapacityItem[];
  readonly imageCount: number;
  readonly videoCount: number;
  readonly readyGalleryImageCount: number;
}

const GALLERY_SELECT = {
  id: true,
  providerId: true,
  mediaFileId: true,
  kind: true,
  position: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Provider-owned gallery/profile-slot persistence helpers with capacity reads.
 * Callers must lock the Provider row before capacity-sensitive writes.
 */
export class PrismaProviderMediaRepository implements ProviderMediaUsageReaderPort {
  public constructor(
    private readonly mediaReader: ProviderMediaReaderPort,
    private readonly db: DbClient = getPrismaClient(),
  ) {}

  public async getUsageSnapshot(
    providerId: string,
  ): Promise<ProviderMediaUsageSnapshot> {
    const profile = await this.db.providerProfile.findUnique({
      where: { providerId },
      select: {
        logoMediaFileId: true,
        coverMediaFileId: true,
      },
    });

    const rows = await this.db.providerGalleryItem.findMany({
      where: { providerId },
      orderBy: { position: "asc" },
      select: GALLERY_SELECT,
    });

    const gallery: ProviderGalleryCapacityItem[] = await Promise.all(
      rows.map(async (row) => {
        const media = await this.mediaReader.getMediaStatus(row.mediaFileId);
        return {
          galleryItemId: row.id,
          kind: row.kind,
          mediaFileId: row.mediaFileId,
          status: media?.status ?? "DELETED",
          hasReadyThumbnail: media?.hasReadyThumbnail ?? false,
          position: row.position,
        };
      }),
    );

    const [logoMedia, coverMedia] = await Promise.all([
      profile?.logoMediaFileId === null || profile?.logoMediaFileId === undefined
        ? null
        : this.mediaReader.getMediaStatus(profile.logoMediaFileId),
      profile?.coverMediaFileId === null || profile?.coverMediaFileId === undefined
        ? null
        : this.mediaReader.getMediaStatus(profile.coverMediaFileId),
    ]);

    const counts = countGalleryByKind(
      gallery.map((item) => ({ kind: item.kind, status: item.status })),
    );

    return {
      logoMediaFileId: profile?.logoMediaFileId ?? null,
      coverMediaFileId: profile?.coverMediaFileId ?? null,
      logoStatus: logoMedia?.status ?? null,
      coverStatus: coverMedia?.status ?? null,
      gallery,
      imageCount: counts.images,
      videoCount: counts.videos,
      readyGalleryImageCount: countReadyGalleryImages(
        gallery.map((item) => ({
          kind: item.kind,
          status: item.status,
          hasReadyThumbnail: item.hasReadyThumbnail,
        })),
      ),
    };
  }

  public async nextGalleryPosition(providerId: string): Promise<number> {
    const last = await this.db.providerGalleryItem.findFirst({
      where: { providerId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return last === null ? 0 : last.position + 1;
  }

  public async listCountingGalleryItems(
    providerId: string,
  ): Promise<readonly ProviderGalleryCapacityItem[]> {
    const snapshot = await this.getUsageSnapshot(providerId);
    return snapshot.gallery.filter((item) =>
      countsTowardGalleryCapacity(item.status),
    );
  }
}

export function mapProfileSlot(
  profile: ProviderProfileRecord,
): Pick<ProviderProfileRecord, "logoMediaFileId" | "coverMediaFileId"> {
  return {
    logoMediaFileId: profile.logoMediaFileId,
    coverMediaFileId: profile.coverMediaFileId,
  };
}

export type { ProviderGalleryItemRecord };

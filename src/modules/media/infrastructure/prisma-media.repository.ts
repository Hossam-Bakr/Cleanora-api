import type { MediaFile, MediaStatus, Prisma } from "#generated/prisma/client";
import { getPrismaClient } from "#database/prisma";

export type MediaFileRow = MediaFile;

export interface CreatePendingUploadInput {
  readonly id: string;
  readonly ownerUserId: string;
  readonly storageProvider: "CLOUDINARY";
  readonly storageKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
}

export class PrismaMediaRepository {
  public async createPendingUpload(
    input: CreatePendingUploadInput,
  ): Promise<MediaFileRow> {
    return getPrismaClient().mediaFile.create({
      data: {
        id: input.id,
        ownerUserId: input.ownerUserId,
        ownerType: "CUSTOMER_PROFILE_IMAGE",
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        status: "PENDING_UPLOAD",
      },
    });
  }

  public async markPendingDelete(
    mediaId: string,
    cleanupEligibleAt: Date = new Date(),
  ): Promise<void> {
    await getPrismaClient().mediaFile.update({
      where: { id: mediaId },
      data: {
        status: "PENDING_DELETE",
        cleanupEligibleAt,
      },
    });
  }

  public async findById(mediaId: string): Promise<MediaFileRow | null> {
    return getPrismaClient().mediaFile.findUnique({ where: { id: mediaId } });
  }

  public async listCleanupCandidates(
    limit: number,
    stalePendingUploadBefore: Date,
  ): Promise<MediaFileRow[]> {
    return getPrismaClient().mediaFile.findMany({
      where: {
        OR: [
          {
            status: "PENDING_DELETE",
            OR: [
              { cleanupEligibleAt: null },
              { cleanupEligibleAt: { lte: new Date() } },
            ],
          },
          {
            status: "PENDING_UPLOAD",
            createdAt: { lte: stalePendingUploadBefore },
          },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
  }

  public async markDeleted(mediaId: string): Promise<void> {
    await getPrismaClient().mediaFile.update({
      where: { id: mediaId },
      data: { status: "DELETED" satisfies MediaStatus },
    });
  }

  public async markStatus(
    mediaId: string,
    status: MediaStatus,
    extra?: Prisma.MediaFileUpdateInput,
  ): Promise<void> {
    await getPrismaClient().mediaFile.update({
      where: { id: mediaId },
      data: { status, ...extra },
    });
  }
}

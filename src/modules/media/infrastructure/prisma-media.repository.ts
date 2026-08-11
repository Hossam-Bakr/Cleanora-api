import type {
  MediaFile,
  MediaOwnerType,
  MediaStatus,
  Prisma,
} from "#generated/prisma/client";
import { getPrismaClient } from "#database/prisma";

export type MediaFileRow = MediaFile;

export interface CreatePendingUploadInput {
  readonly id: string;
  readonly ownerUserId: string;
  readonly ownerType?: MediaOwnerType;
  readonly storageProvider: "CLOUDINARY";
  readonly storageKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly status?: MediaStatus;
}

export class PrismaMediaRepository {
  public constructor(
    private readonly suppliedDb?:
      | Prisma.TransactionClient
      | ReturnType<typeof getPrismaClient>,
  ) {}

  private get db(): Prisma.TransactionClient | ReturnType<typeof getPrismaClient> {
    return this.suppliedDb ?? getPrismaClient();
  }
  public async createPendingUpload(
    input: CreatePendingUploadInput,
  ): Promise<MediaFileRow> {
    return this.db.mediaFile.create({
      data: {
        id: input.id,
        ownerUserId: input.ownerUserId,
        ownerType: input.ownerType ?? "CUSTOMER_PROFILE_IMAGE",
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        status: input.status ?? "PENDING_UPLOAD",
      },
    });
  }

  public async markPendingDelete(
    mediaId: string,
    cleanupEligibleAt: Date = new Date(),
  ): Promise<void> {
    await this.db.mediaFile.update({
      where: { id: mediaId },
      data: {
        status: "PENDING_DELETE",
        cleanupEligibleAt,
      },
    });
  }

  public async findById(mediaId: string): Promise<MediaFileRow | null> {
    return this.db.mediaFile.findUnique({ where: { id: mediaId } });
  }

  public async listCleanupCandidates(
    limit: number,
    stalePendingUploadBefore: Date,
  ): Promise<MediaFileRow[]> {
    return this.db.mediaFile.findMany({
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
            status: "FAILED",
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
    await this.db.mediaFile.update({
      where: { id: mediaId },
      data: { status: "DELETED" satisfies MediaStatus },
    });
  }

  public async markStatus(
    mediaId: string,
    status: MediaStatus,
    extra?: Prisma.MediaFileUpdateInput,
  ): Promise<void> {
    await this.db.mediaFile.update({
      where: { id: mediaId },
      data: { status, ...extra },
    });
  }
}

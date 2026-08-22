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
  readonly verificationProviderId?: string | null;
  readonly verificationDocumentVersionId?: string | null;
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
        verificationProviderId: input.verificationProviderId ?? null,
        verificationDocumentVersionId: input.verificationDocumentVersionId ?? null,
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

  public async reserveVerificationEvidence(input: Omit<CreatePendingUploadInput, "ownerType" | "status" | "verificationProviderId" | "verificationDocumentVersionId"> & {
    readonly providerId: string;
    readonly documentVersionId: string;
  }): Promise<MediaFileRow> {
    return this.createPendingUpload({
      ...input,
      ownerType: "PROVIDER_VERIFICATION_DOCUMENT_PAGE",
      verificationProviderId: input.providerId,
      verificationDocumentVersionId: input.documentVersionId,
      status: "PROCESSING",
    });
  }

  public async readVerificationEvidenceReceipt(mediaId: string): Promise<{
    readonly mediaFileId: string;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly state: "PROCESSING" | "READY" | "FAILED";
    readonly canonicalContentType: "application/pdf" | "image/jpeg" | "image/png";
    readonly byteSize: number;
    readonly pageCount: number | null;
    readonly safeReceiptId: string;
  } | null> {
    const row = await this.db.mediaFile.findFirst({
      where: { id: mediaId, ownerType: "PROVIDER_VERIFICATION_DOCUMENT_PAGE" },
    });
    if (
      row === null ||
      row.verificationProviderId === null ||
      row.verificationDocumentVersionId === null ||
      !["PROCESSING", "READY", "FAILED"].includes(row.status)
    ) return null;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(row.contentType)) return null;
    return {
      mediaFileId: row.id,
      providerId: row.verificationProviderId,
      documentVersionId: row.verificationDocumentVersionId,
      state: row.status as "PROCESSING" | "READY" | "FAILED",
      canonicalContentType: row.contentType as "application/pdf" | "image/jpeg" | "image/png",
      byteSize: row.byteSize,
      pageCount: row.verificationPageCount,
      safeReceiptId: row.id,
    };
  }

  public async markVerificationEvidenceReady(input: {
    readonly mediaFileId: string;
    readonly canonicalContentType: "application/pdf" | "image/jpeg" | "image/png";
    readonly byteSize: number;
    readonly width: number | null;
    readonly height: number | null;
    readonly pageCount: number | null;
  }): Promise<void> {
    const changed = await this.db.mediaFile.updateMany({
      where: {
        id: input.mediaFileId,
        ownerType: "PROVIDER_VERIFICATION_DOCUMENT_PAGE",
        status: "PROCESSING",
      },
      data: {
        status: "READY",
        contentType: input.canonicalContentType,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        verificationPageCount: input.pageCount,
      },
    });
    if (changed.count !== 1) throw new Error("MEDIA_VERIFICATION_STATE_CONFLICT");
  }

  public async markVerificationEvidenceFailed(mediaFileId: string): Promise<void> {
    await this.db.mediaFile.updateMany({
      where: {
        id: mediaFileId,
        ownerType: "PROVIDER_VERIFICATION_DOCUMENT_PAGE",
        status: "PROCESSING",
      },
      data: { status: "FAILED", cleanupEligibleAt: new Date() },
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

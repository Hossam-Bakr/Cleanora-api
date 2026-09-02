import type {
  MediaFile,
  MediaOwnerType,
  MediaStatus,
  Prisma,
} from "#generated/prisma/client";
import { getPrismaClient } from "#database/prisma";
import type { TransactionalCatalogServiceImageAuthorizer } from "../media.public.js";
import type {
  CatalogServiceMediaSafeFact,
  TransactionalCatalogServiceMediaFactsReader,
} from "../media.public.js";

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

  /**
   * @desc Reserve a PENDING Catalog service-image media row for later ingest.
   * @explanation Catalog supplies the stable media identity and trusted uploader;
   * Media stores only owner type, status, and file facts—no service association.
   */
  public async reserveCatalogServiceImage(input: {
    readonly id: string;
    readonly ownerUserId: string;
    readonly ownerType?: "CATALOG_SERVICE_IMAGE";
    readonly storageProvider?: "CLOUDINARY";
    readonly storageKey: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly width?: number | null;
    readonly height?: number | null;
  }): Promise<MediaFileRow> {
    return this.createPendingUpload({
      id: input.id,
      ownerUserId: input.ownerUserId,
      ownerType: input.ownerType ?? "CATALOG_SERVICE_IMAGE",
      storageProvider: input.storageProvider ?? "CLOUDINARY",
      storageKey: input.storageKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      status: "PENDING_UPLOAD",
    });
  }

  /**
   * @desc Read Catalog service-image ownership/status facts for a READY recheck.
   * @explanation Catalog associates only READY CATALOG_SERVICE_IMAGE rows; Media
   * never interprets service identity, version, or presentation order.
   */
  public async readCatalogServiceImageAuthorizationFacts(
    mediaFileId: string,
  ): Promise<{
    readonly ownerUserId: string;
    readonly ownerType: string;
    readonly status: string;
    readonly width: number | null;
    readonly height: number | null;
  } | null> {
    const row = await this.findById(mediaFileId);
    if (row === null || row.ownerType !== "CATALOG_SERVICE_IMAGE") {
      return null;
    }
    return {
      ownerUserId: row.ownerUserId,
      ownerType: row.ownerType,
      status: row.status,
      width: row.width,
      height: row.height,
    };
  }
}

function toCatalogServiceMediaSafeFact(row: MediaFileRow): CatalogServiceMediaSafeFact | null {
  const contentType = row.contentType;
  if (
    contentType !== "image/jpeg" &&
    contentType !== "image/png" &&
    contentType !== "image/webp"
  ) {
    return null;
  }
  return {
    mediaFileId: row.id,
    contentType,
    width: row.width,
    height: row.height,
    status: row.status,
    ownerUserId: row.ownerUserId,
  };
}

/**
 * Transaction-bound Media-owned reader for Catalog service-image associations.
 */
export class PrismaTransactionalCatalogServiceMediaFactsReader
  implements TransactionalCatalogServiceMediaFactsReader
{
  public constructor(private readonly repository: PrismaMediaRepository) {}

  public async readCatalogServiceMediaFacts(
    mediaFileIds: readonly string[],
  ): Promise<ReadonlyMap<string, CatalogServiceMediaSafeFact>> {
    const uniqueIds = [...new Set(mediaFileIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const rows = await Promise.all(
      uniqueIds.map((mediaFileId) => this.repository.findById(mediaFileId)),
    );
    const facts = new Map<string, CatalogServiceMediaSafeFact>();
    for (const row of rows) {
      if (row === null || row.ownerType !== "CATALOG_SERVICE_IMAGE") {
        continue;
      }
      const fact = toCatalogServiceMediaSafeFact(row);
      if (fact !== null) {
        facts.set(fact.mediaFileId, fact);
      }
    }
    return facts;
  }
}

/**
 * Transaction-bound Media READY/owner/purpose recheck for Catalog service images.
 * Persistence ownership stays on PrismaMediaRepository; this authorizer only
 * evaluates Media facts and carries no Catalog business meaning.
 */
export class PrismaTransactionalCatalogServiceImageAuthorizer
  implements TransactionalCatalogServiceImageAuthorizer
{
  public constructor(private readonly repository: PrismaMediaRepository) {}

  public async assertReadyCatalogServiceImage(
    input: Parameters<
      TransactionalCatalogServiceImageAuthorizer["assertReadyCatalogServiceImage"]
    >[0],
  ): Promise<boolean> {
    const row = await this.repository.readCatalogServiceImageAuthorizationFacts(
      input.mediaFileId,
    );
    return (
      row !== null &&
      row.ownerUserId === input.uploaderUserId &&
      row.ownerType === "CATALOG_SERVICE_IMAGE" &&
      row.status === "READY" &&
      row.width !== null &&
      row.height !== null
    );
  }
}

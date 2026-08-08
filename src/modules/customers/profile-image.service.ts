import { randomUUID } from "node:crypto";

import type { DenialAuditWriter } from "#modules/admin/audit.service";
import {
  MediaError,
  type MediaPendingUploadPort,
  type MediaStoragePort,
  type ProfileImageProcessor,
} from "#modules/media/media.public";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { authorizeSharedImageOrAddressSelf } from "./domain/customer-self.policy.js";
import { customersError } from "./domain/customers.errors.js";
import { denyCustomerOperation } from "./domain/ownership-denial.js";
import type {
  CustomerProfileAggregate,
  CustomerProfileView,
  ProfileImageDeliveryView,
} from "./domain/customers.types.js";
import { PrismaProfileRepository } from "./infrastructure/prisma-profile.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export interface ProfileImagePutCommand {
  readonly principal: AuthenticationPrincipal;
  readonly bytes: Buffer;
  readonly expectedAssociationVersion: number;
  readonly requestId?: string;
}

/**
 * Customers-owned profile-image association (DEC-033).
 * Sharp + Cloudinary I/O stay outside the customers Prisma transaction.
 */
export class ProfileImageService {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly media: MediaStoragePort,
    private readonly processor: ProfileImageProcessor,
    private readonly pendingUploads: MediaPendingUploadPort,
    private readonly profiles: PrismaProfileRepository,
    private readonly denialAudit: DenialAuditWriter,
    private readonly cloudinaryFolder: string,
    private readonly signedUrlTtlSeconds: number,
  ) {}

  public async get(
    principal: AuthenticationPrincipal,
    requestId?: string,
  ): Promise<ProfileImageDeliveryView | null> {
    await this.authorize(principal, "customers.profile_image.read", requestId);
    const row = await this.unitOfWork.run(async ({ prisma }) =>
      prisma.customerProfile.findUnique({
        where: { userId: principal.userId },
        include: { profileImageMediaFile: true },
      }),
    );
    if (row?.profileImageMediaFile === null || row === null) {
      return null;
    }
    const file = row.profileImageMediaFile;
    if (file.status !== "READY") {
      return null;
    }
    return this.toDeliveryView(
      file.id,
      {
        provider: file.storageProvider === "S3" ? "S3" : "CLOUDINARY",
        storageKey: file.storageKey,
        contentType: "image/webp",
        byteSize: file.byteSize,
        width: file.width ?? 1,
        height: file.height ?? 1,
      },
      row.imageAssociationVersion,
      file.contentType,
      file.width,
      file.height,
    );
  }

  public async put(command: ProfileImagePutCommand): Promise<CustomerProfileAggregate> {
    await this.authorize(
      command.principal,
      "customers.profile_image.put",
      command.requestId,
    );

    let normalized;
    try {
      normalized = await this.processor.normalize(command.bytes);
    } catch (error) {
      throw this.mapMediaError(error);
    }

    const mediaId = randomUUID();
    const storageKey = this.pendingUploads.createOpaqueStorageKey(this.cloudinaryFolder);

    await this.pendingUploads.reservePendingUpload({
      id: mediaId,
      ownerUserId: command.principal.userId,
      storageKey,
      contentType: normalized.contentType,
      byteSize: normalized.byteSize,
      width: normalized.width,
      height: normalized.height,
    });

    let stored;
    try {
      stored = await this.media.storeProfileImage({
        bytes: normalized.bytes,
        ownerUserId: command.principal.userId,
        mediaId,
        storageKey,
      });
    } catch (error) {
      await this.pendingUploads
        .markPendingDelete(mediaId)
        .catch(() => undefined);
      throw this.mapMediaError(error);
    }

    try {
      await this.unitOfWork.run(async ({ prisma, generalAudit }) => {
        const reservation = await prisma.mediaFile.findUnique({
          where: { id: mediaId },
        });
        if (
          reservation === null ||
          reservation.storageKey !== storageKey ||
          reservation.status !== "PENDING_UPLOAD"
        ) {
          throw customersError("CUSTOMER_PROFILE_IMAGE_INVALID");
        }

        const profile = await prisma.customerProfile.findUnique({
          where: { userId: command.principal.userId },
          select: {
            id: true,
            profileImageMediaFileId: true,
            imageAssociationVersion: true,
          },
        });

        const currentVersion = profile?.imageAssociationVersion ?? 1;
        if (currentVersion !== command.expectedAssociationVersion) {
          throw customersError("CUSTOMER_PROFILE_IMAGE_CONFLICT");
        }

        await prisma.mediaFile.update({
          where: { id: mediaId },
          data: {
            status: "READY",
            contentType: stored.contentType,
            byteSize: stored.byteSize,
            width: stored.width,
            height: stored.height,
          },
        });

        if (profile === null) {
          try {
            await prisma.customerProfile.create({
              data: {
                userId: command.principal.userId,
                profileImageMediaFileId: mediaId,
                imageAssociationVersion:
                  command.expectedAssociationVersion + 1,
              },
            });
          } catch (error) {
            if (isPrismaUniqueConflict(error)) {
              throw customersError("CUSTOMER_PROFILE_IMAGE_CONFLICT");
            }
            throw error;
          }
        } else {
          const updated = await prisma.customerProfile.updateMany({
            where: {
              userId: command.principal.userId,
              imageAssociationVersion: command.expectedAssociationVersion,
            },
            data: {
              profileImageMediaFileId: mediaId,
              imageAssociationVersion: { increment: 1 },
            },
          });
          if (updated.count !== 1) {
            throw customersError("CUSTOMER_PROFILE_IMAGE_CONFLICT");
          }
          if (
            profile.profileImageMediaFileId !== null &&
            profile.profileImageMediaFileId !== mediaId
          ) {
            await prisma.mediaFile.update({
              where: { id: profile.profileImageMediaFileId },
              data: {
                status: "PENDING_DELETE",
                cleanupEligibleAt: new Date(),
              },
            });
          }
        }

        await generalAudit.append({
          actorType: "USER",
          actorId: command.principal.userId,
          action: "customers.profile_image.associate",
          targetType: "customer_profile",
          targetId: command.principal.userId,
          context: { outcome: "SUCCEEDED" },
          ...(command.requestId === undefined
            ? {}
            : { requestId: command.requestId }),
        });
      });
    } catch (error) {
      await this.pendingUploads
        .markPendingDelete(mediaId)
        .catch(() => undefined);
      throw error;
    }

    return this.buildAggregate(command.principal);
  }

  public async remove(
    principal: AuthenticationPrincipal,
    expectedAssociationVersion: number,
    requestId?: string,
  ): Promise<{ readonly removed: true; readonly associationVersion: number }> {
    await this.authorize(principal, "customers.profile_image.delete", requestId);

    return this.unitOfWork.run(async ({ prisma, generalAudit }) => {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId: principal.userId },
        include: { profileImageMediaFile: true },
      });
      if (profile?.profileImageMediaFile === null || profile === null) {
        throw customersError("CUSTOMER_PROFILE_IMAGE_ABSENT");
      }
      if (profile.imageAssociationVersion !== expectedAssociationVersion) {
        throw customersError("CUSTOMER_PROFILE_IMAGE_CONFLICT");
      }

      const updated = await prisma.customerProfile.updateMany({
        where: {
          userId: principal.userId,
          imageAssociationVersion: expectedAssociationVersion,
        },
        data: {
          profileImageMediaFileId: null,
          imageAssociationVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw customersError("CUSTOMER_PROFILE_IMAGE_CONFLICT");
      }

      await prisma.mediaFile.update({
        where: { id: profile.profileImageMediaFile.id },
        data: {
          status: "PENDING_DELETE",
          cleanupEligibleAt: new Date(),
        },
      });

      await generalAudit.append({
        actorType: "USER",
        actorId: principal.userId,
        action: "customers.profile_image.remove",
        targetType: "customer_profile",
        targetId: principal.userId,
        context: { outcome: "SUCCEEDED" },
        ...(requestId === undefined ? {} : { requestId }),
      });

      return {
        removed: true as const,
        associationVersion: expectedAssociationVersion + 1,
      };
    });
  }

  private async buildAggregate(
    principal: AuthenticationPrincipal,
  ): Promise<CustomerProfileAggregate> {
    const categories = ["INDIVIDUAL", "COMPANY", "ENGINEER"] as const;
    const profiles: CustomerProfileView[] = [];
    for (const category of categories) {
      const view = await this.unitOfWork.run((context) =>
        this.profiles.get(context.prisma, principal.userId, category),
      );
      profiles.push(view);
    }
    const profileImage = await this.get(principal);
    return {
      profiles,
      profileImage,
    };
  }

  private async toDeliveryView(
    mediaId: string,
    reference: {
      readonly provider: "CLOUDINARY" | "S3";
      readonly storageKey: string;
      readonly contentType: "image/webp";
      readonly byteSize: number;
      readonly width: number;
      readonly height: number;
    },
    associationVersion: number,
    contentType: string,
    width: number | null,
    height: number | null,
  ): Promise<ProfileImageDeliveryView> {
    const expiresAt = new Date(Date.now() + this.signedUrlTtlSeconds * 1000);
    const delivery = await this.media.createAuthorizedDeliveryUrl(
      reference,
      expiresAt,
    );
    return {
      mediaId,
      url: delivery.url,
      urlExpiresAt: delivery.urlExpiresAt,
      associationVersion,
      contentType,
      ...(width === null ? {} : { width }),
      ...(height === null ? {} : { height }),
    };
  }

  private async authorize(
    principal: AuthenticationPrincipal,
    action: string,
    requestId?: string,
  ): Promise<void> {
    const decision = authorizeSharedImageOrAddressSelf({
      principal,
      resourceOwnerUserId: principal.userId,
    });
    if (!decision.allowed) {
      await denyCustomerOperation(
        this.denialAudit,
        principal,
        action,
        decision.denialCode!,
        requestId,
      );
    }
  }

  private mapMediaError(error: unknown): never {
    if (error instanceof MediaError) {
      throw customersError("CUSTOMER_PROFILE_IMAGE_INVALID");
    }
    throw error;
  }
}

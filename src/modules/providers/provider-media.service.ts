import { randomUUID } from "node:crypto";

import {
  MediaError,
  type ProviderMediaPort,
  type ProviderMediaSafeView,
} from "#modules/media/media.public";
import { AppError } from "#shared/errors/app-error";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { canReadProviderProjections } from "./domain/provider-authorization.policy.js";
import { assertExpectedVersion } from "./domain/provider-lifecycle.policy.js";
import {
  assertCanEditProviderMedia,
  assertGalleryCapacityForKind,
  assertGalleryUploadConstraints,
  assertImageByteLimit,
  assertImageMime,
  assertVideoDimensions,
  assertVideoMime,
  contributesToMediaCompletion,
  PROVIDER_GALLERY_IMAGE_MAX_COUNT,
  PROVIDER_GALLERY_VIDEO_MAX_COUNT,
} from "./domain/provider-media.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderMediaReaderPort,
  ProviderMediaUsageReaderPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type {
  ProviderGalleryKind,
  ProviderRecord,
} from "./domain/providers.types.js";
import {
  mapProviderMediaProjection,
  type ProviderMediaProjectionDto,
} from "./provider.dto.js";
import type { ProviderProjectionService } from "./provider-projection.service.js";
import { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export interface ProviderMediaServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly providers: ProviderRepositoryPort;
  readonly media: ProviderMediaPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly mediaUsage: ProviderMediaUsageReaderPort;
  readonly mediaReader: ProviderMediaReaderPort;
  readonly projections: Pick<ProviderProjectionService, "computeProjections">;
  readonly signedUrlTtlSeconds: number;
  readonly mediaFolder: string;
}

function opaqueStorageKey(folder: string, mediaId: string): string {
  return `${folder}/providers/${mediaId}`;
}

/**
 * Short reserve → upload/process → finalize/compensate Provider media workflows.
 * Cloudinary/Media I/O stays outside Provider DB transactions.
 */
export class ProviderMediaService {
  private readonly denialAudit: ProviderDenialAuditService;

  public constructor(
    private readonly dependencies: ProviderMediaServiceDependencies,
  ) {
    this.denialAudit = new ProviderDenialAuditService(dependencies.denialAudit);
  }

  public async listMedia(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    const provider = await this.requireReadableProvider(input);
    return this.buildMediaProjection(provider, input.principal.userId);
  }

  public async putLogo(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    return this.replaceSlot({
      ...input,
      purpose: "LOGO",
      action: "providers.media.logo.put",
    });
  }

  public async putCover(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    return this.replaceSlot({
      ...input,
      purpose: "COVER",
      action: "providers.media.cover.put",
    });
  }

  public async addGalleryImage(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    return this.addGalleryItem({
      ...input,
      kind: "IMAGE",
      action: "providers.media.gallery_image.add",
    });
  }

  public async addGalleryVideo(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    return this.addGalleryItem({
      ...input,
      kind: "VIDEO",
      action: "providers.media.gallery_video.add",
    });
  }

  public async reorderGallery(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly orderedGalleryItemIds: readonly string[];
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    assertExpectedVersion(input.expectedVersion);

    let updated: ProviderRecord;
    try {
      updated = await this.dependencies.unitOfWork.run(async (context) => {
        const locked = await this.lockAuthorizedEditable({
          contextProviders: context.providers,
          identityReader: context.identityReader,
          principal: input.principal,
          providerId: input.providerId,
          expectedVersion: input.expectedVersion,
        });

      await context.providers.replaceGalleryPositions({
        providerId: locked.id,
        orderedGalleryItemIds: input.orderedGalleryItemIds,
      });

      const bumped = await context.providers.bumpVersion({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
      });

      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.media.gallery.reorder",
        targetType: "provider",
        targetId: locked.id,
        context: { outcome: "SUCCEEDED" },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

        return bumped;
      });
    } catch (error) {
      return this.rethrowMutationDenial(error, {
        principal: input.principal,
        providerId: input.providerId,
        action: "providers.media.gallery.reorder",
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }

    return this.buildMediaProjection(updated, input.principal.userId);
  }

  public async deleteLogo(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    return this.clearSlot({
      ...input,
      purpose: "LOGO",
      action: "providers.media.logo.delete",
    });
  }

  public async deleteCover(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    return this.clearSlot({
      ...input,
      purpose: "COVER",
      action: "providers.media.cover.delete",
    });
  }

  public async deleteGalleryItem(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly galleryItemId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    assertExpectedVersion(input.expectedVersion);

    let removedMediaId: string | null = null;
    let updated: ProviderRecord;
    try {
      updated = await this.dependencies.unitOfWork.run(async (context) => {
        const locked = await this.lockAuthorizedEditable({
          contextProviders: context.providers,
          identityReader: context.identityReader,
          principal: input.principal,
          providerId: input.providerId,
          expectedVersion: input.expectedVersion,
        });

      const items = await context.providers.listGalleryItems(locked.id);
      const target = items.find((item) => item.id === input.galleryItemId);
      if (target === undefined) {
        throw providersError("PROVIDER_NOT_FOUND", {
          reason: "GALLERY_ITEM_NOT_FOUND",
        });
      }
      removedMediaId = target.mediaFileId;

      await context.providers.deleteGalleryItem({
        providerId: locked.id,
        galleryItemId: input.galleryItemId,
      });

      const remaining = items
        .filter((item) => item.id !== input.galleryItemId)
        .map((item) => item.id);
      if (remaining.length > 0) {
        await context.providers.replaceGalleryPositions({
          providerId: locked.id,
          orderedGalleryItemIds: remaining,
        });
      }

      const bumped = await context.providers.bumpVersion({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
      });

      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.media.gallery.delete",
        targetType: "provider",
        targetId: locked.id,
        context: { outcome: "SUCCEEDED", galleryItemId: input.galleryItemId },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

        return bumped;
      });
    } catch (error) {
      return this.rethrowMutationDenial(error, {
        principal: input.principal,
        providerId: input.providerId,
        action: "providers.media.gallery.delete",
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }

    if (removedMediaId !== null) {
      await this.dependencies.media
        .markPendingDelete(removedMediaId)
        .catch(() => undefined);
    }

    return this.buildMediaProjection(updated, input.principal.userId);
  }

  private async replaceSlot(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly purpose: "LOGO" | "COVER";
    readonly action: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    assertExpectedVersion(input.expectedVersion);
    assertImageMime(input.contentType);
    assertImageByteLimit(input.bytes.byteLength);
    await this.requireEditableProvider({
      principal: input.principal,
      providerId: input.providerId,
      expectedVersion: input.expectedVersion,
      action: input.action,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    });

    const mediaId = randomUUID();
    const storageKey = opaqueStorageKey(
      this.dependencies.mediaFolder,
      mediaId,
    );
    const ownerType =
      input.purpose === "LOGO" ? "PROVIDER_LOGO" : "PROVIDER_COVER";

    try {
      await this.dependencies.media.reserveProviderMedia({
        mediaId,
        ownerUserId: input.principal.userId,
        ownerType,
        contentType: input.contentType,
        byteSize: input.bytes.byteLength,
      });
    } catch (error) {
      throw this.mapMediaError(error);
    }

    let previousMediaId: string | null = null;
    let reservedProvider: ProviderRecord;
    try {
      reservedProvider = await this.dependencies.unitOfWork.run(
        async (context) => {
          const locked = await this.lockAuthorizedEditable({
            contextProviders: context.providers,
            identityReader: context.identityReader,
            principal: input.principal,
            providerId: input.providerId,
            expectedVersion: input.expectedVersion,
          });
          const profile = await context.providers.getProfile(locked.id);
          previousMediaId =
            input.purpose === "LOGO"
              ? (profile?.logoMediaFileId ?? null)
              : (profile?.coverMediaFileId ?? null);
          const bumped = await context.providers.bumpVersion({
            providerId: locked.id,
            expectedVersion: input.expectedVersion,
          });
          await context.generalAudit.append({
            actorType: "USER",
            actorId: input.principal.userId,
            action: `${input.action}.reserve`,
            targetType: "provider",
            targetId: locked.id,
            context: { outcome: "RESERVED", mediaId },
            ...(input.requestId === undefined
              ? {}
              : { requestId: input.requestId }),
          });
          return bumped;
        },
      );
    } catch (error) {
      await this.dependencies.media
        .markPendingDelete(mediaId)
        .catch(() => undefined);
      return this.rethrowMutationDenial(error, {
        principal: input.principal,
        providerId: input.providerId,
        action: input.action,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }

    let stored: ProviderMediaSafeView;
    try {
      stored = await this.dependencies.media.storeProviderImage({
        mediaId,
        ownerUserId: input.principal.userId,
        purpose: input.purpose,
        bytes: input.bytes,
        storageKey,
      });
    } catch (error) {
      await this.dependencies.media.markPendingDelete(mediaId).catch(() => undefined);
      throw this.mapMediaError(error);
    }

    const finalizedProvider = await this.dependencies.unitOfWork.run(
      async (context) => {
        const locked = await context.providers.lockById(input.providerId);
        if (locked === null || locked.version !== reservedProvider.version) {
          throw providersError("PROVIDER_STATE_CONFLICT", {
            reason: "MEDIA_RESERVATION_LOST",
          });
        }
        const profile = await context.providers.getProfile(locked.id);
        const currentMediaId =
          input.purpose === "LOGO"
            ? (profile?.logoMediaFileId ?? null)
            : (profile?.coverMediaFileId ?? null);
        if (currentMediaId !== previousMediaId || stored.status !== "READY") {
          throw providersError("PROVIDER_STATE_CONFLICT", {
            reason: "MEDIA_RESERVATION_LOST",
          });
        }
        await context.providers.upsertProfile({
          providerId: locked.id,
          displayNameAr: profile?.displayNameAr ?? null,
          displayNameEn: profile?.displayNameEn ?? null,
          descriptionAr: profile?.descriptionAr ?? null,
          descriptionEn: profile?.descriptionEn ?? null,
          countryId: profile?.countryId ?? null,
          ...(input.purpose === "LOGO"
            ? { logoMediaFileId: mediaId }
            : { coverMediaFileId: mediaId }),
        });
        await context.generalAudit.append({
          actorType: "USER",
          actorId: input.principal.userId,
          action: input.action,
          targetType: "provider",
          targetId: locked.id,
          context: {
            outcome: "SUCCEEDED",
            mediaId,
            status: stored.status,
            applicationStatus: locked.applicationStatus,
          },
          ...(input.requestId === undefined
            ? {}
            : { requestId: input.requestId }),
        });
        return locked;
      },
    ).catch(async (error: unknown) => {
      await this.dependencies.media.markPendingDelete(mediaId).catch(() => undefined);
      throw error;
    });

    if (previousMediaId !== null && previousMediaId !== mediaId) {
      await this.dependencies.media
        .markPendingDelete(previousMediaId)
        .catch(() => undefined);
    }

    return this.buildMediaProjection(
      finalizedProvider ?? reservedProvider,
      input.principal.userId,
    );
  }

  private async clearSlot(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly purpose: "LOGO" | "COVER";
    readonly action: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    assertExpectedVersion(input.expectedVersion);

    let removedMediaId: string | null = null;
    let updated: ProviderRecord;
    try {
      updated = await this.dependencies.unitOfWork.run(async (context) => {
        const locked = await this.lockAuthorizedEditable({
          contextProviders: context.providers,
          identityReader: context.identityReader,
          principal: input.principal,
          providerId: input.providerId,
          expectedVersion: input.expectedVersion,
        });

      const profile = await context.providers.getProfile(locked.id);
      removedMediaId =
        input.purpose === "LOGO"
          ? (profile?.logoMediaFileId ?? null)
          : (profile?.coverMediaFileId ?? null);

      await context.providers.upsertProfile({
        providerId: locked.id,
        displayNameAr: profile?.displayNameAr ?? null,
        displayNameEn: profile?.displayNameEn ?? null,
        descriptionAr: profile?.descriptionAr ?? null,
        descriptionEn: profile?.descriptionEn ?? null,
        countryId: profile?.countryId ?? null,
        ...(input.purpose === "LOGO"
          ? { logoMediaFileId: null }
          : { coverMediaFileId: null }),
      });

      const bumped = await context.providers.bumpVersion({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
      });

      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: input.action,
        targetType: "provider",
        targetId: locked.id,
        context: { outcome: "SUCCEEDED" },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

        return bumped;
      });
    } catch (error) {
      return this.rethrowMutationDenial(error, {
        principal: input.principal,
        providerId: input.providerId,
        action: input.action,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }

    if (removedMediaId !== null) {
      await this.dependencies.media
        .markPendingDelete(removedMediaId)
        .catch(() => undefined);
    }

    return this.buildMediaProjection(updated, input.principal.userId);
  }

  private async addGalleryItem(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly kind: ProviderGalleryKind;
    readonly action: string;
    readonly requestId?: string;
  }): Promise<ProviderMediaProjectionDto> {
    assertExpectedVersion(input.expectedVersion);
    assertGalleryUploadConstraints(input.kind, input.contentType, input.bytes);
    await this.requireEditableProvider({
      principal: input.principal,
      providerId: input.providerId,
      expectedVersion: input.expectedVersion,
      action: input.action,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    });

    const mediaId = randomUUID();
    const storageKey = opaqueStorageKey(
      this.dependencies.mediaFolder,
      mediaId,
    );
    const ownerType =
      input.kind === "IMAGE"
        ? "PROVIDER_GALLERY_IMAGE"
        : "PROVIDER_GALLERY_VIDEO";

    try {
      await this.dependencies.media.reserveProviderMedia({
        mediaId,
        ownerUserId: input.principal.userId,
        ownerType,
        contentType: input.contentType,
        byteSize: input.bytes.byteLength,
      });
    } catch (error) {
      throw this.mapMediaError(error);
    }

    try {
      await this.dependencies.unitOfWork.run(async (context) => {
        const locked = await this.lockAuthorizedEditable({
          contextProviders: context.providers,
          identityReader: context.identityReader,
          principal: input.principal,
          providerId: input.providerId,
          expectedVersion: input.expectedVersion,
        });

        // Gallery rows reserve capacity under the Provider row lock (FR-040/047).
        const items = await context.providers.listGalleryItems(locked.id);
        assertGalleryCapacityForKind(input.kind, items);

        await context.providers.createGalleryItem({
          providerId: locked.id,
          mediaFileId: mediaId,
          kind: input.kind,
          position: items.length,
          createdByUserId: input.principal.userId,
        });

        const bumped = await context.providers.bumpVersion({
          providerId: locked.id,
          expectedVersion: input.expectedVersion,
        });

        await context.generalAudit.append({
          actorType: "USER",
          actorId: input.principal.userId,
          action: input.action,
          targetType: "provider",
          targetId: locked.id,
          context: {
            outcome: "RESERVED",
            mediaId,
            kind: input.kind,
          },
          ...(input.requestId === undefined
            ? {}
            : { requestId: input.requestId }),
        });

        return bumped;
      });
    } catch (error) {
      await this.dependencies.media
        .markPendingDelete(mediaId)
        .catch(() => undefined);
      return this.rethrowMutationDenial(error, {
        principal: input.principal,
        providerId: input.providerId,
        action: input.action,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }

    try {
      await this.storeReservedGalleryMedia({
        kind: input.kind,
        mediaId,
        ownerUserId: input.principal.userId,
        bytes: input.bytes,
        contentType: input.contentType,
        storageKey,
      });
    } catch (error) {
      await this.compensateFailedGalleryItem({
        providerId: input.providerId,
        principal: input.principal,
        mediaId,
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });
      if (error instanceof MediaError) {
        throw this.mapMediaError(error);
      }
      throw error;
    }

    const provider = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (provider === null) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: "providers.media.list",
        targetId: input.providerId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }
    return this.buildMediaProjection(provider, input.principal.userId);
  }

  private async storeReservedGalleryMedia(input: {
    readonly kind: ProviderGalleryKind;
    readonly mediaId: string;
    readonly ownerUserId: string;
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly storageKey: string;
  }): Promise<void> {
    if (input.kind === "IMAGE") {
      await this.dependencies.media.storeProviderImage({
        mediaId: input.mediaId,
        ownerUserId: input.ownerUserId,
        purpose: "GALLERY_IMAGE",
        bytes: input.bytes,
        storageKey: input.storageKey,
      });
      return;
    }

    const videoMime = assertVideoMime(input.contentType);
    await this.dependencies.media.storeProviderVideo({
      mediaId: input.mediaId,
      ownerUserId: input.ownerUserId,
      bytes: input.bytes,
      contentType: videoMime,
      storageKey: input.storageKey,
    });
    const finalized = await this.dependencies.media.finalizeProviderVideo({
      mediaId: input.mediaId,
    });
    if (finalized.status === "FAILED") {
      throw providersError("PROVIDER_MEDIA_INVALID", {
        reason: "VIDEO_FINALIZE_FAILED",
      });
    }
    assertVideoDimensions({
      width: finalized.width,
      height: finalized.height,
    });
    if (
      finalized.status === "READY" &&
      !contributesToMediaCompletion(finalized.status, {
        kind: "VIDEO",
        hasReadyThumbnail: finalized.thumbnailUrl !== undefined,
      })
    ) {
      throw providersError("PROVIDER_MEDIA_INVALID", {
        reason: "VIDEO_THUMBNAIL_REQUIRED",
      });
    }
  }

  private async compensateFailedGalleryItem(input: {
    readonly providerId: string;
    readonly principal: AuthenticationPrincipal;
    readonly mediaId: string;
    readonly requestId?: string;
  }): Promise<void> {
    try {
      await this.dependencies.unitOfWork.run(async (context) => {
        const locked = await context.providers.lockById(input.providerId);
        if (locked === null) {
          return;
        }
        const items = await context.providers.listGalleryItems(locked.id);
        const target = items.find((item) => item.mediaFileId === input.mediaId);
        if (target === undefined) {
          return;
        }
        await context.providers.deleteGalleryItem({
          providerId: locked.id,
          galleryItemId: target.id,
        });
        const remaining = items
          .filter((item) => item.id !== target.id)
          .map((item) => item.id);
        if (remaining.length > 0) {
          await context.providers.replaceGalleryPositions({
            providerId: locked.id,
            orderedGalleryItemIds: remaining,
          });
        }
        await context.providers.bumpVersion({
          providerId: locked.id,
          expectedVersion: locked.version,
        });
        await context.generalAudit.append({
          actorType: "USER",
          actorId: input.principal.userId,
          action: "providers.media.gallery.compensate",
          targetType: "provider",
          targetId: locked.id,
          context: { outcome: "COMPENSATED", mediaId: input.mediaId },
          ...(input.requestId === undefined
            ? {}
            : { requestId: input.requestId }),
        });
      });
    } catch {
      // Best-effort compensation; media cleanup still runs.
    }
    await this.dependencies.media
      .markPendingDelete(input.mediaId)
      .catch(() => undefined);
  }

  private async lockAuthorizedEditable(input: {
    readonly contextProviders: ProviderRepositoryPort;
    readonly identityReader: ProviderIdentityReaderPort;
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
  }): Promise<ProviderRecord> {
    const locked = await input.contextProviders.lockById(input.providerId);
    if (locked === null) {
      throw providersError("PROVIDER_NOT_FOUND");
    }

    const member = await input.contextProviders.findMember({
      providerId: locked.id,
      userId: input.principal.userId,
    });
    const identity = await input.identityReader.getEligibilityFacts(
      input.principal.userId,
    );

    const facts = {
      actorUserId: input.principal.userId,
      actorActive: identity?.active === true,
      applicationOwnerUserId: locked.applicationOwnerUserId,
      membership:
        member === null
          ? null
          : { level: member.level, status: member.status },
      staffAdmin: false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
      applicationStatus: locked.applicationStatus,
      operationalStatus: locked.operationalStatus,
    } as const;
    if (!canReadProviderProjections(facts)) {
      throw providersError("PROVIDER_NOT_FOUND");
    }
    if (locked.version !== input.expectedVersion) {
      throw providersError("PROVIDER_VERSION_CONFLICT");
    }
    assertCanEditProviderMedia(facts);

    return locked;
  }

  private async requireReadableProvider(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<ProviderRecord> {
    const provider = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (provider === null) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: "providers.media.list",
        targetId: input.providerId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }

    const member = await this.dependencies.providers.findMember({
      providerId: provider.id,
      userId: input.principal.userId,
    });
    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      input.principal.userId,
    );
    const readable = canReadProviderProjections({
      actorUserId: input.principal.userId,
      actorActive: identity?.active === true,
      applicationOwnerUserId: provider.applicationOwnerUserId,
      membership:
        member === null ? null : { level: member.level, status: member.status },
      staffAdmin: false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
    });
    if (!readable) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: "providers.media.list",
        targetId: provider.id,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }
    return provider;
  }

  private async requireEditableProvider(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly action: string;
    readonly requestId?: string;
  }): Promise<ProviderRecord> {
    const provider = await this.dependencies.providers.findById(input.providerId);
    if (provider === null) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: input.action,
        targetId: input.providerId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }
    const [member, identity] = await Promise.all([
      this.dependencies.providers.findMember({
        providerId: input.providerId,
        userId: input.principal.userId,
      }),
      this.dependencies.identityReader.getEligibilityFacts(input.principal.userId),
    ]);
    const facts = {
      actorUserId: input.principal.userId,
      actorActive: identity?.active === true,
      applicationOwnerUserId: provider.applicationOwnerUserId,
      membership:
        member === null ? null : { level: member.level, status: member.status },
      staffAdmin: false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
    } as const;
    if (!canReadProviderProjections(facts)) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: input.action,
        targetId: provider.id,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }
    if (provider.version !== input.expectedVersion) {
      throw providersError("PROVIDER_VERSION_CONFLICT");
    }
    assertCanEditProviderMedia(facts);
    return provider;
  }

  private async rethrowMutationDenial(
    error: unknown,
    input: {
      readonly principal: AuthenticationPrincipal;
      readonly providerId: string;
      readonly action: string;
      readonly requestId?: string;
    },
  ): Promise<never> {
    if (
      error instanceof AppError &&
      (error.code === "PROVIDER_NOT_FOUND" ||
        error.code === "PROVIDER_ACCESS_DENIED")
    ) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: input.action,
        targetId: input.providerId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }
    throw error;
  }

  private async buildMediaProjection(
    provider: ProviderRecord,
    actorUserId: string,
  ): Promise<ProviderMediaProjectionDto> {
    const usage = await this.dependencies.mediaUsage.getUsageSnapshot(
      provider.id,
    );
    const expiresAt = new Date(
      Date.now() + this.dependencies.signedUrlTtlSeconds * 1000,
    );

    const logo =
      usage.logoMediaFileId === null
        ? null
        : await this.toSlotView(
            usage.logoMediaFileId,
            "LOGO",
            expiresAt,
          );
    const cover =
      usage.coverMediaFileId === null
        ? null
        : await this.toSlotView(
            usage.coverMediaFileId,
            "COVER",
            expiresAt,
          );

    const gallery = [];
    for (const item of usage.gallery) {
      gallery.push(await this.toGalleryView(item, expiresAt));
    }

    const member = await this.dependencies.providers.findMember({
      providerId: provider.id,
      userId: actorUserId,
    });
    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      actorUserId,
    );
    let canEdit = false;
    try {
      assertCanEditProviderMedia({
        actorUserId,
        actorActive: identity?.active === true,
        applicationOwnerUserId: provider.applicationOwnerUserId,
        membership:
          member === null
            ? null
            : { level: member.level, status: member.status },
        staffAdmin: false,
        providerAdminEnabled: identity?.providerAdminEnabled ?? false,
        applicationStatus: provider.applicationStatus,
        operationalStatus: provider.operationalStatus,
      });
      canEdit = true;
    } catch {
      canEdit = false;
    }

    const { completion, readiness } =
      await this.dependencies.projections.computeProjections(provider);

    return mapProviderMediaProjection({
      providerId: provider.id,
      version: provider.version,
      applicationStatus: provider.applicationStatus,
      canEdit,
      logo,
      cover,
      gallery,
      usage: {
        galleryImageCount: usage.imageCount,
        galleryVideoCount: usage.videoCount,
        galleryImageLimit: PROVIDER_GALLERY_IMAGE_MAX_COUNT,
        galleryVideoLimit: PROVIDER_GALLERY_VIDEO_MAX_COUNT,
        readyGalleryImageCount: usage.readyGalleryImageCount,
      },
      completion,
      readiness,
    });
  }

  private async toSlotView(
    mediaId: string,
    purpose: "LOGO" | "COVER",
    expiresAt: Date,
  ) {
    const media = await this.dependencies.mediaReader.getMediaStatus(mediaId);
    const status = media?.status ?? "DELETED";
    let deliveryUrl: string | null = null;
    let urlExpiresAt: string | null = null;
    if (status === "READY") {
      try {
        const delivery = await this.dependencies.media.createSignedDeliveryUrl(
          mediaId,
          expiresAt,
        );
        deliveryUrl = delivery.url;
        urlExpiresAt = delivery.urlExpiresAt;
      } catch {
        deliveryUrl = null;
      }
    }
    return {
      mediaId,
      purpose,
      status,
      contentType: media?.contentType ?? null,
      byteSize: media?.byteSize ?? null,
      width: media?.width ?? null,
      height: media?.height ?? null,
      deliveryUrl,
      urlExpiresAt,
      thumbnailUrl: null as string | null,
    };
  }

  private async toGalleryView(
    item: {
      readonly galleryItemId: string;
      readonly mediaFileId: string;
      readonly kind: ProviderGalleryKind;
      readonly status: string;
      readonly hasReadyThumbnail: boolean;
      readonly position: number;
    },
    expiresAt: Date,
  ) {
    const media = await this.dependencies.mediaReader.getMediaStatus(
      item.mediaFileId,
    );
    const status = media?.status ?? "DELETED";
    let deliveryUrl: string | null = null;
    let urlExpiresAt: string | null = null;
    let thumbnailUrl: string | null = null;
    if (status === "READY") {
      try {
        const delivery = await this.dependencies.media.createSignedDeliveryUrl(
          item.mediaFileId,
          expiresAt,
        );
        deliveryUrl = delivery.url;
        urlExpiresAt = delivery.urlExpiresAt;
      } catch {
        deliveryUrl = null;
      }
      if (item.kind === "VIDEO" && media?.hasReadyThumbnail === true) {
        try {
          const thumb = await this.dependencies.media.createSignedThumbnailUrl(
            item.mediaFileId,
            expiresAt,
          );
          thumbnailUrl = thumb.url;
        } catch {
          thumbnailUrl = null;
        }
      }
    }

    return {
      galleryItemId: item.galleryItemId,
      mediaId: item.mediaFileId,
      kind: item.kind,
      position: item.position,
      status,
      contentType: media?.contentType ?? null,
      byteSize: media?.byteSize ?? null,
      width: media?.width ?? null,
      height: media?.height ?? null,
      deliveryUrl,
      urlExpiresAt,
      thumbnailUrl,
    };
  }

  private mapMediaError(error: unknown): never {
    if (error instanceof MediaError) {
      if (
        error.code === "MEDIA_PROVIDER_UNSUPPORTED" ||
        error.code === "MEDIA_PROVIDER_FAILURE"
      ) {
        throw providersError("PROVIDER_DEPENDENCY_UNAVAILABLE", {
          reason: error.code,
        });
      }
      throw providersError("PROVIDER_MEDIA_INVALID", {
        reason: error.code,
      });
    }
    throw error;
  }
}

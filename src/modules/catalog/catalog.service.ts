/**
 * Catalog application service: protected management use cases and internal
 * selectable / snapshot-ready reads. Controllers stay thin.
 */

import type {
  AuthenticationPrincipal,
  ProtectedOperationAuthorizer,
} from "#modules/authentication/authentication.public";
import { findPrivilegedActionReason } from "#modules/authentication/authentication.public";
import type { SafeAuditContext } from "#modules/admin/audit.public";
import type {
  CatalogServiceImagePort,
  CatalogServiceImageReceipt,
} from "#modules/media/media.public";
import { MediaError } from "#modules/media/media.public";
import type { Logger } from "#shared/logger";
import { createHash, randomUUID } from "node:crypto";
import type {
  CatalogCategoryManagementDto,
  CatalogDefinitionReader,
  CatalogLocale,
  CatalogMediaReference,
  CatalogServiceManagementDto,
  ProviderOfferingCatalogReference,
  SelectableCatalogServiceSummary,
  SnapshotReadyCatalogServiceDefinition,
} from "./catalog.public.js";
import {
  toCategoryManagementDto,
  toServiceManagementDto,
} from "./catalog.public.js";
import { projectSnapshotReadyConfiguration } from "./catalog.definition-projection.js";
import { CatalogError } from "./catalog.errors.js";
import {
  assertCatalogServiceImageByteLimit,
  assertCatalogServiceImageContentType,
  assertSafeCatalogServiceImageReceipt,
} from "./catalog-media.policy.js";
import {
  assertActiveServiceStoredConfiguration,
  assertCategoryActivationContent,
  assertExactOrderReplacement,
  assertNoClientInventedCountryFacts,
  assertServiceConfigurationGraph,
  assertStableCode,
  assertUniqueLocales,
  buildCatalogCommandScopeKey,
  canonicalCatalogCommandFingerprint,
  hashCatalogCommandFingerprint,
  isServiceSelectable,
  normalizeOptionalLocalizedText,
  resolveCatalogCountryForAvailability,
  resolveExactLocaleContent,
} from "./catalog.policy.js";
import type {
  CatalogCategoryRow,
  CatalogRepository,
  CatalogServiceRow,
  CatalogServiceWithConfigurationRow,
  CatalogUnitOfWorkDependencies,
  SelectableServiceCandidateRow,
} from "./catalog.repository.js";
import type {
  CategoryLifecycleBody,
  CreateCategoryBody,
  CreateServiceBody,
  MoveServiceBody,
  ReplaceCategoryBody,
  ReplaceCategoryOrderBody,
  ReplaceServiceAvailabilityBody,
  ReplaceServiceConfigurationBody,
  ReplaceServiceOrderBody,
  ReorderServiceMediaBody,
  RemoveServiceMediaBody,
  ServiceLifecycleBody,
  UploadServiceMediaFields,
} from "./catalog.schema.js";

export interface CatalogServiceDependencies {
  readonly repository: CatalogRepository;
  readonly authorization: ProtectedOperationAuthorizer;
  readonly logger: Logger;
  readonly catalogServiceImage?: CatalogServiceImagePort;
  readonly createMediaFileId?: () => string;
}

export interface CatalogManagementMediaView {
  readonly associationId: string;
  readonly mediaId: string;
  readonly displayOrder: number;
  readonly status: "READY";
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly width: number | null;
  readonly height: number | null;
  readonly deliveryUrl: string;
  readonly deliveryExpiresAt: string;
}

export interface CatalogServiceManagementWithMediaDto
  extends CatalogServiceManagementDto {
  readonly countries: readonly {
    readonly countryCode: string;
    readonly isAvailable: boolean;
  }[];
  readonly media: readonly CatalogManagementMediaView[];
}


export interface CatalogCommandMeta {
  readonly principal: AuthenticationPrincipal;
  readonly requestId?: string;
}

export class CatalogService implements CatalogDefinitionReader {
  constructor(private readonly deps: CatalogServiceDependencies) {}

  /**
   * @desc Bind definition reads to an opaque shared transaction.
   * @explanation Providers UoW supplies the transaction; Catalog never exposes
   * Prisma types on the public seam and does not open a nested Catalog txn.
   */
  forTransaction(transactionContext: unknown): CatalogDefinitionReader {
    const uow = this.deps.repository.unitOfWork.bindToTransaction(
      transactionContext,
    );
    return {
      listSelectable: (input) => this.listSelectableWith(uow, input),
      getSnapshotReadyDefinition: (input) =>
        this.getSnapshotReadyDefinitionWith(uow, input),
      resolveSelectableProviderOffering: (input) =>
        this.resolveSelectableProviderOfferingWith(uow, input),
      getProviderOfferingReference: (input) =>
        this.getProviderOfferingReferenceWith(uow, input),
      getSnapshotReadyDefinitionById: (input) =>
        this.getSnapshotReadyDefinitionByIdWith(uow, input),
    };
  }

  async listSelectable(input: {
    readonly countryCode: string;
    readonly locale: CatalogLocale;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<{
    readonly items: readonly SelectableCatalogServiceSummary[];
    readonly nextCursor: string | null;
  }> {
    return this.deps.repository.unitOfWork.runInReadSnapshot((uow) =>
      this.listSelectableWith(uow, input),
    );
  }

  async getSnapshotReadyDefinition(input: {
    readonly serviceCode: string;
    readonly countryCode: string;
    readonly locale: CatalogLocale;
  }): Promise<SnapshotReadyCatalogServiceDefinition | null> {
    return this.deps.repository.unitOfWork.runInReadSnapshot((uow) =>
      this.getSnapshotReadyDefinitionWith(uow, input),
    );
  }

  async resolveSelectableProviderOffering(input: {
    readonly serviceCode: string;
    readonly countryCode: string;
  }): Promise<ProviderOfferingCatalogReference | null> {
    return this.deps.repository.unitOfWork.runInReadSnapshot((uow) =>
      this.resolveSelectableProviderOfferingWith(uow, input),
    );
  }

  async getProviderOfferingReference(input: {
    readonly serviceId: string;
    readonly countryCode: string;
  }): Promise<ProviderOfferingCatalogReference | null> {
    return this.deps.repository.unitOfWork.runInReadSnapshot((uow) =>
      this.getProviderOfferingReferenceWith(uow, input),
    );
  }

  async getSnapshotReadyDefinitionById(input: {
    readonly serviceId: string;
    readonly countryCode: string;
    readonly locale: CatalogLocale;
  }): Promise<SnapshotReadyCatalogServiceDefinition | null> {
    return this.deps.repository.unitOfWork.runInReadSnapshot((uow) =>
      this.getSnapshotReadyDefinitionByIdWith(uow, input),
    );
  }

  private async listSelectableWith(
    uow: CatalogUnitOfWorkDependencies,
    input: {
      readonly countryCode: string;
      readonly locale: CatalogLocale;
      readonly cursor?: string;
      readonly limit?: number;
    },
  ): Promise<{
    readonly items: readonly SelectableCatalogServiceSummary[];
    readonly nextCursor: string | null;
  }> {
    const country = await resolveCatalogCountryForAvailability(
      uow.activeCountryReader,
      input.countryCode,
    );
    const page = await this.deps.repository.listSelectableServiceCandidates(
      uow.tx,
      {
        countryId: country.id,
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
      },
    );

    const items: SelectableCatalogServiceSummary[] = [];
    for (const candidate of page.items) {
      const summary = this.toSelectableSummary(candidate, input.locale, true);
      if (summary !== null) {
        items.push(summary);
      }
    }

    return { items, nextCursor: page.nextCursor };
  }

  private async getSnapshotReadyDefinitionWith(
    uow: CatalogUnitOfWorkDependencies,
    input: {
      readonly serviceCode: string;
      readonly countryCode: string;
      readonly locale: CatalogLocale;
    },
  ): Promise<SnapshotReadyCatalogServiceDefinition | null> {
    const country = await resolveCatalogCountryForAvailability(
      uow.activeCountryReader,
      input.countryCode,
    );
    const candidate = await this.deps.repository.findSelectableServiceByCode(
      uow.tx,
      {
        serviceCode: input.serviceCode,
        countryId: country.id,
      },
    );
    return this.toSnapshotReadyDefinition(
      uow,
      candidate,
      country.code,
      input.locale,
    );
  }

  private async resolveSelectableProviderOfferingWith(
    uow: CatalogUnitOfWorkDependencies,
    input: {
      readonly serviceCode: string;
      readonly countryCode: string;
    },
  ): Promise<ProviderOfferingCatalogReference | null> {
    const country = await this.resolveActiveCountryOrNull(
      uow,
      input.countryCode,
    );
    if (country === null) {
      return null;
    }
    const candidate = await this.deps.repository.findSelectableServiceByCode(
      uow.tx,
      {
        serviceCode: input.serviceCode,
        countryId: country.id,
      },
    );
    if (candidate === null) {
      return null;
    }
    return this.toProviderOfferingReference(candidate, true);
  }

  private async getProviderOfferingReferenceWith(
    uow: CatalogUnitOfWorkDependencies,
    input: {
      readonly serviceId: string;
      readonly countryCode: string;
    },
  ): Promise<ProviderOfferingCatalogReference | null> {
    const country = await this.resolveActiveCountryOrNull(
      uow,
      input.countryCode,
    );
    if (country === null) {
      return null;
    }
    const candidate = await this.deps.repository.findSelectableServiceById(
      uow.tx,
      {
        serviceId: input.serviceId,
        countryId: country.id,
      },
    );
    if (candidate === null) {
      return null;
    }
    return this.toProviderOfferingReference(candidate, true);
  }

  private async getSnapshotReadyDefinitionByIdWith(
    uow: CatalogUnitOfWorkDependencies,
    input: {
      readonly serviceId: string;
      readonly countryCode: string;
      readonly locale: CatalogLocale;
    },
  ): Promise<SnapshotReadyCatalogServiceDefinition | null> {
    const country = await resolveCatalogCountryForAvailability(
      uow.activeCountryReader,
      input.countryCode,
    );
    const candidate = await this.deps.repository.findSelectableServiceById(
      uow.tx,
      {
        serviceId: input.serviceId,
        countryId: country.id,
      },
    );
    return this.toSnapshotReadyDefinition(
      uow,
      candidate,
      country.code,
      input.locale,
    );
  }

  private async resolveActiveCountryOrNull(
    uow: CatalogUnitOfWorkDependencies,
    countryCode: string,
  ): Promise<{ readonly id: string; readonly code: string } | null> {
    try {
      return await resolveCatalogCountryForAvailability(
        uow.activeCountryReader,
        countryCode,
      );
    } catch (error) {
      if (error instanceof CatalogError) {
        return null;
      }
      throw error;
    }
  }

  private toProviderOfferingReference(
    candidate: SelectableServiceCandidateRow,
    countryIsAuthoritativeAndActive: boolean,
  ): ProviderOfferingCatalogReference {
    const activePriceUnits = candidate.service.priceUnits
      .filter((unit) => unit.isActive)
      .map((unit) => ({ id: unit.id, code: unit.code }));

    let selectableForCountry = false;
    if (
      countryIsAuthoritativeAndActive &&
      candidate.category.isActive &&
      candidate.service.isActive &&
      candidate.countryAvailabilityIsAvailable
    ) {
      try {
        assertActiveServiceStoredConfiguration({
          categoryIsActive: candidate.category.isActive,
          translations: candidate.service.translations,
          priceUnits: candidate.service.priceUnits.map((unit) => ({
            code: unit.code,
            isActive: unit.isActive,
            labelAr: unit.labelAr,
            labelEn: unit.labelEn,
          })),
          fields: this.storedConfigurationForActivation(candidate.service),
        });
        selectableForCountry = true;
      } catch (error) {
        if (!(error instanceof CatalogError)) {
          throw error;
        }
      }
    }

    return {
      serviceId: candidate.service.id,
      serviceCode: candidate.service.code,
      serviceVersion: candidate.service.version,
      selectableForCountry,
      activePriceUnits,
    };
  }

  private async toSnapshotReadyDefinition(
    uow: CatalogUnitOfWorkDependencies,
    candidate: SelectableServiceCandidateRow | null,
    countryCode: string,
    locale: CatalogLocale,
  ): Promise<SnapshotReadyCatalogServiceDefinition | null> {
    if (candidate === null) {
      return null;
    }

    const summary = this.toSelectableSummary(candidate, locale, true);
    if (summary === null) {
      return null;
    }

    const configuration = projectSnapshotReadyConfiguration({
      service: candidate.service,
      locale,
    });
    if (configuration === null) {
      return null;
    }

    const associations = await this.deps.repository.listServiceMediaAssociations(
      uow.tx,
      candidate.service.id,
    );
    const media = this.toSelectableMediaReferences(associations);

    const serviceContent = resolveExactLocaleContent({
      translations: candidate.service.translations,
      locale,
    });
    const categoryContent = resolveExactLocaleContent({
      translations: [
        {
          locale: "AR",
          name: candidate.category.nameAr,
          description: candidate.category.descriptionAr,
        },
        {
          locale: "EN",
          name: candidate.category.nameEn,
          description: candidate.category.descriptionEn,
        },
      ],
      locale,
    });

    return {
      serviceId: candidate.service.id,
      serviceCode: candidate.service.code,
      serviceVersion: candidate.service.version,
      category: {
        id: candidate.category.id,
        code: candidate.category.code,
        name: categoryContent.name,
        description: categoryContent.description,
      },
      locale,
      countryCode,
      name: serviceContent.name,
      description: serviceContent.description,
      priceUnits: configuration.priceUnits,
      fields: configuration.fields,
      media,
    };
  }

  /**
   * Allowlisted media association counts for FR-032 before/after.
   * Never includes uploader, storage key, provider payload, or delivery URL.
   */
  mediaAuditSnapshot(
    input: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, string | number | boolean>> {
    return this.buildSafeAuditContext({
      serviceId:
        typeof input["serviceId"] === "string" ? input["serviceId"] : null,
      code: typeof input["code"] === "string" ? input["code"] : null,
      version: typeof input["version"] === "number" ? input["version"] : null,
      associationCount:
        typeof input["associationCount"] === "number"
          ? input["associationCount"]
          : null,
    });
  }

  /**
   * Protected management delivery presentation. Short-lived URL only; never
   * uploader, storage key, or receipt internals.
   */
  toManagementMediaPresentation(input: {
    readonly associationId: string;
    readonly displayOrder: number;
    readonly receipt: CatalogServiceImageReceipt;
    readonly delivery: { readonly url: string; readonly expiresAt: Date };
  }): CatalogManagementMediaView {
    return {
      associationId: input.associationId,
      mediaId: input.receipt.mediaFileId,
      displayOrder: input.displayOrder,
      status: "READY",
      contentType: input.receipt.canonicalContentType,
      width: input.receipt.width,
      height: input.receipt.height,
      deliveryUrl: input.delivery.url,
      deliveryExpiresAt: input.delivery.expiresAt.toISOString(),
    };
  }

  /**
   * Internal selectable/snapshot media references — READY associations only.
   */
  toSelectableMediaReferences(
    rows: readonly {
      readonly associationId?: string;
      readonly id?: string;
      readonly mediaFileId: string;
      readonly displayOrder: number;
      readonly contentType?: "image/jpeg" | "image/png" | "image/webp";
      readonly width?: number | null;
      readonly height?: number | null;
      readonly status?: string;
      readonly ownerUserId?: string;
      readonly storageKey?: string;
      readonly providerPayload?: unknown;
      readonly privateUrl?: string;
    }[],
  ): CatalogMediaReference[] {
    const references: CatalogMediaReference[] = [];
    for (const row of rows) {
      if (row.status !== undefined && row.status !== "READY") {
        continue;
      }
      if (
        row.contentType !== "image/jpeg" &&
        row.contentType !== "image/png" &&
        row.contentType !== "image/webp"
      ) {
        continue;
      }
      if (
        typeof row.width !== "number" ||
        typeof row.height !== "number" ||
        row.width < 1 ||
        row.height < 1
      ) {
        continue;
      }
      const associationId = row.associationId ?? row.id;
      if (associationId === undefined) {
        continue;
      }
      references.push({
        associationId,
        mediaId: row.mediaFileId,
        contentType: row.contentType,
        width: row.width,
        height: row.height,
        displayOrder: row.displayOrder,
      });
    }
    return references;
  }

  private requireCatalogServiceImage(): CatalogServiceImagePort {
    if (this.deps.catalogServiceImage === undefined) {
      throw new CatalogError(
        "CATALOG_MEDIA_UNAVAILABLE",
        "Catalog service image dependency is not configured",
      );
    }
    return this.deps.catalogServiceImage;
  }

  private mapMediaDependencyError(error: unknown): CatalogError {
    if (error instanceof CatalogError) {
      return error;
    }
    if (error instanceof MediaError) {
      if (
        error.code === "MEDIA_IMAGE_INVALID" ||
        error.code === "MEDIA_IMAGE_TOO_LARGE"
      ) {
        return new CatalogError(
          "CATALOG_MEDIA_INVALID",
          "Catalog service image is invalid",
          { cause: error },
        );
      }
    }
    return new CatalogError(
      "CATALOG_MEDIA_UNAVAILABLE",
      "Catalog media dependency is unavailable",
      { cause: error },
    );
  }

  private async requestMediaCleanup(
    mediaFileId: string,
    safeReasonCode: string,
  ): Promise<void> {
    const media = this.deps.catalogServiceImage;
    if (media === undefined) {
      return;
    }
    try {
      await media.requestCleanup({ mediaFileId, safeReasonCode });
    } catch (error: unknown) {
      this.deps.logger.warn("catalog.media.cleanup.failed", {
        mediaFileId,
        safeReasonCode,
        outcome: "CLEANUP_REQUEST_FAILED",
      });
      void error;
    }
  }

  private hashMediaUploadPayload(input: {
    readonly declaredContentType: string;
    readonly bytes: Buffer;
  }): string {
    return createHash("sha256")
      .update(input.declaredContentType)
      .update("\0")
      .update(input.bytes)
      .digest("hex");
  }

  private async buildServiceManagementWithMedia(
    uow: CatalogUnitOfWorkDependencies,
    serviceId: string,
  ): Promise<CatalogServiceManagementWithMediaDto> {
    const service = await this.deps.repository.findServiceWithConfiguration(
      uow.tx,
      serviceId,
    );
    if (service === null) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
    const countries = await this.deps.repository.listServiceCountryAvailability(
      uow.tx,
      serviceId,
    );
    const associations = await this.deps.repository.listServiceMediaAssociations(
      uow.tx,
      serviceId,
    );
    const mediaPort = this.deps.catalogServiceImage;
    const media: CatalogManagementMediaView[] = [];
    if (mediaPort !== undefined) {
      for (const association of associations) {
        if (association.status !== undefined && association.status !== "READY") {
          continue;
        }
        const receipt = await mediaPort.readValidationReceipt(
          association.mediaFileId,
        );
        if (receipt === null || receipt.state !== "READY") {
          continue;
        }
        try {
          assertSafeCatalogServiceImageReceipt(receipt);
          const delivery = await mediaPort.issueDelivery({
            mediaFileId: association.mediaFileId,
            purpose: "CATALOG_SERVICE_PRESENTATION",
          });
          media.push(
            this.toManagementMediaPresentation({
              associationId: association.id,
              displayOrder: association.displayOrder,
              receipt,
              delivery,
            }),
          );
        } catch {
          // Omit individual presentation on delivery failure; never leak keys.
        }
      }
    }

    return {
      ...toServiceManagementDto(service),
      countries: countries.map((country) => ({
        countryCode: country.countryCode,
        isAvailable: country.isAvailable,
      })),
      media,
    };
  }

  /**
   * Reserve → external Media ingest → finalize association/version/audit/receipt.
   */
  async uploadServiceMedia(
    command: UploadServiceMediaFields & {
      readonly serviceId: string;
      readonly declaredContentType: string;
      readonly bytes: Buffer;
    },
    meta: CatalogCommandMeta,
  ): Promise<{
    readonly service?: CatalogServiceManagementWithMediaDto;
    readonly association: {
      readonly mediaFileId: string;
      readonly displayOrder: number;
      readonly associationId?: string;
    };
    readonly acceptedVersion: number;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, command.reasonCode);
    assertCatalogServiceImageContentType(command.declaredContentType);
    assertCatalogServiceImageByteLimit(command.bytes.length);

    const media = this.requireCatalogServiceImage();
    const payloadHash = this.hashMediaUploadPayload({
      declaredContentType: command.declaredContentType,
      bytes: command.bytes,
    });
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.media.upload",
        serviceId: command.serviceId,
        expectedVersion: command.expectedVersion,
        declaredContentType: command.declaredContentType,
        payloadHash,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.media.upload",
      targetType: "SERVICE",
      targetId: command.serviceId,
    });
    const generatedMediaFileId =
      this.deps.createMediaFileId?.() ?? randomUUID();

    const reservation = await this.deps.repository.unitOfWork.runInTransaction(
      async (uow) => {
        await this.recheckManagementWriteAuthority(
          meta.principal,
          command.reasonCode,
        );
        const receipt = await this.deps.repository.reserveOrReplayCommand(
          uow.tx,
          {
            scopeKey,
            idempotencyKey: command.idempotencyKey,
            requestHash: fingerprint,
            actorUserId: meta.principal.userId,
            targetType: "SERVICE",
            targetId: command.serviceId,
            pending: true,
            reservedMediaFileId: generatedMediaFileId,
          },
        );

        if (receipt !== "proceed") {
          if (receipt.status === "COMPLETED") {
            return {
              kind: "replay" as const,
              receipt,
            };
          }
          return {
            kind: "resume" as const,
            mediaFileId:
              receipt.reservedMediaFileId ?? generatedMediaFileId,
            receipt,
          };
        }

        return {
          kind: "fresh" as const,
          mediaFileId: generatedMediaFileId,
        };
      },
    );

    if (reservation.kind === "replay") {
      const acceptedVersion =
        reservation.receipt.acceptedVersion ?? command.expectedVersion;
      return {
        association: {
          mediaFileId:
            reservation.receipt.reservedMediaFileId ?? generatedMediaFileId,
          displayOrder: 0,
        },
        acceptedVersion,
        replayed: true,
      };
    }

    const reservedMediaFileId = reservation.mediaFileId;
    let ingestReceipt: CatalogServiceImageReceipt;
    try {
      ingestReceipt = await media.ingest({
        mediaFileId: reservedMediaFileId,
        ownerUserId: meta.principal.userId,
        declaredContentType: command.declaredContentType,
        bytes: command.bytes,
      });
      assertSafeCatalogServiceImageReceipt(ingestReceipt);
    } catch (error: unknown) {
      await this.requestMediaCleanup(
        reservedMediaFileId,
        "CATALOG_MEDIA_INGEST_FAILED",
      );
      throw this.mapMediaDependencyError(error);
    }

    if (ingestReceipt.mediaFileId !== reservedMediaFileId) {
      await this.requestMediaCleanup(
        reservedMediaFileId,
        "CATALOG_MEDIA_RECEIPT_MISMATCH",
      );
      throw new CatalogError(
        "CATALOG_MEDIA_INVALID",
        "Catalog service image receipt identity does not match the reserved media id",
      );
    }

    try {
      return await this.deps.repository.unitOfWork.runInTransaction(
        async (uow) => {
          await this.recheckManagementWriteAuthority(
            meta.principal,
            command.reasonCode,
          );

          const service = await this.deps.repository.findService(
            uow.tx,
            command.serviceId,
          );
          if (service === null) {
            throw new CatalogError(
              "CATALOG_NOT_FOUND",
              "Catalog service was not found",
            );
          }
          this.assertExpectedVersion({
            currentVersion: service.version,
            expectedVersion: command.expectedVersion,
            targetType: "SERVICE",
          });

          const beforeAssociations =
            await this.deps.repository.lockServiceMediaAssociations(
              uow.tx,
              command.serviceId,
            );

          const ready =
            await uow.catalogServiceImageAuthorizer.assertReadyCatalogServiceImage(
              {
                mediaFileId: reservedMediaFileId,
                uploaderUserId: meta.principal.userId,
              },
            );
          if (!ready) {
            throw new CatalogError(
              "CATALOG_MEDIA_INVALID",
              "Catalog service image is not eligible for association",
            );
          }

          const plannedAssociationCount = beforeAssociations.length + 1;
          await this.appendPrivilegedMutationAudit(uow, {
            meta,
            reasonCode: command.reasonCode,
            action: "catalog.service.media.upload",
            targetType: "service",
            targetId: command.serviceId,
            context: {
              before: this.mediaAuditSnapshot({
                serviceId: service.id,
                code: service.code,
                version: service.version,
                associationCount: beforeAssociations.length,
              }),
              after: this.mediaAuditSnapshot({
                serviceId: service.id,
                code: service.code,
                version: service.version + 1,
                associationCount: plannedAssociationCount,
              }),
            },
          });

          const association =
            await this.deps.repository.insertServiceMediaAssociation(uow.tx, {
              serviceId: command.serviceId,
              mediaFileId: reservedMediaFileId,
            });
          const acceptedVersion = await this.deps.repository.bumpServiceVersion(
            uow.tx,
            command.serviceId,
          );

          await this.deps.repository.completeCommand(uow.tx, {
            scopeKey,
            idempotencyKey: command.idempotencyKey,
            targetId: command.serviceId,
            acceptedVersion,
            actorUserId: meta.principal.userId,
            requestHash: fingerprint,
            targetType: "SERVICE",
          });

          let mediaView: CatalogManagementMediaView | undefined;
          try {
            const delivery = await media.issueDelivery({
              mediaFileId: reservedMediaFileId,
              purpose: "CATALOG_SERVICE_PRESENTATION",
            });
            mediaView = this.toManagementMediaPresentation({
              associationId: association.id,
              displayOrder: association.displayOrder,
              receipt: ingestReceipt,
              delivery,
            });
          } catch {
            mediaView = undefined;
          }

          this.logAcceptedWrite({
            operation: "catalog.service.media.upload",
            outcome: "ASSOCIATED",
            targetType: "SERVICE",
            targetId: command.serviceId,
            version: acceptedVersion,
            actorUserId: meta.principal.userId,
            ...(meta.requestId === undefined
              ? {}
              : { requestId: meta.requestId }),
            extras: {
              associationCount: plannedAssociationCount,
            },
          });

          return {
            service: {
              ...toServiceManagementDto(service),
              countries: [],
              media: mediaView === undefined ? [] : [mediaView],
            },
            association: {
              mediaFileId: reservedMediaFileId,
              displayOrder: association.displayOrder,
              associationId: association.id,
            },
            acceptedVersion,
            replayed: false,
          };
        },
      );
    } catch (error: unknown) {
      await this.requestMediaCleanup(
        reservedMediaFileId,
        "CATALOG_MEDIA_FINALIZATION_FAILED",
      );
      throw error instanceof CatalogError
        ? error
        : this.mapMediaDependencyError(error);
    }
  }

  async reorderServiceMedia(
    command: ReorderServiceMediaBody & { readonly serviceId: string },
    meta: CatalogCommandMeta,
  ): Promise<{
    readonly service: CatalogServiceManagementWithMediaDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, command.reasonCode);
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.media.reorder",
        serviceId: command.serviceId,
        expectedVersion: command.expectedVersion,
        orderedAssociationIds: command.orderedAssociationIds,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.media.reorder",
      targetType: "SERVICE",
      targetId: command.serviceId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(
        meta.principal,
        command.reasonCode,
      );
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE",
        targetId: command.serviceId,
      });

      if (receipt !== "proceed" && receipt.replayed) {
        return {
          service: await this.buildServiceManagementWithMedia(
            uow,
            command.serviceId,
          ),
          replayed: true,
        };
      }

      const service = await this.deps.repository.findService(
        uow.tx,
        command.serviceId,
      );
      if (service === null) {
        throw new CatalogError(
          "CATALOG_NOT_FOUND",
          "Catalog service was not found",
        );
      }
      this.assertExpectedVersion({
        currentVersion: service.version,
        expectedVersion: command.expectedVersion,
        targetType: "SERVICE",
      });

      const before = await this.deps.repository.lockServiceMediaAssociations(
        uow.tx,
        command.serviceId,
      );
      await this.deps.repository.replaceServiceMediaOrder(uow.tx, {
        serviceId: command.serviceId,
        orderedAssociationIds: command.orderedAssociationIds,
      });
      const acceptedVersion = await this.deps.repository.bumpServiceVersion(
        uow.tx,
        command.serviceId,
      );

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: command.reasonCode,
        action: "catalog.service.media.reorder",
        targetType: "service",
        targetId: command.serviceId,
        context: {
          before: this.mediaAuditSnapshot({
            serviceId: service.id,
            code: service.code,
            version: service.version,
            associationCount: before.length,
          }),
          after: this.mediaAuditSnapshot({
            serviceId: service.id,
            code: service.code,
            version: acceptedVersion,
            associationCount: before.length,
          }),
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        targetId: command.serviceId,
        acceptedVersion,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE",
      });

      return {
        service: await this.buildServiceManagementWithMedia(
          uow,
          command.serviceId,
        ),
        replayed: false,
      };
    });
  }

  async removeServiceMedia(
    command: RemoveServiceMediaBody & {
      readonly serviceId: string;
      readonly associationId: string;
    },
    meta: CatalogCommandMeta,
  ): Promise<{
    readonly service: CatalogServiceManagementWithMediaDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, command.reasonCode);
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.media.remove",
        serviceId: command.serviceId,
        associationId: command.associationId,
        expectedVersion: command.expectedVersion,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.media.remove",
      targetType: "SERVICE",
      targetId: command.serviceId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(
        meta.principal,
        command.reasonCode,
      );
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE",
        targetId: command.serviceId,
      });

      if (receipt !== "proceed" && receipt.replayed) {
        return {
          service: await this.buildServiceManagementWithMedia(
            uow,
            command.serviceId,
          ),
          replayed: true,
        };
      }

      const service = await this.deps.repository.findService(
        uow.tx,
        command.serviceId,
      );
      if (service === null) {
        throw new CatalogError(
          "CATALOG_NOT_FOUND",
          "Catalog service was not found",
        );
      }
      this.assertExpectedVersion({
        currentVersion: service.version,
        expectedVersion: command.expectedVersion,
        targetType: "SERVICE",
      });

      const before = await this.deps.repository.lockServiceMediaAssociations(
        uow.tx,
        command.serviceId,
      );
      await this.deps.repository.removeServiceMediaAssociation(uow.tx, {
        serviceId: command.serviceId,
        associationId: command.associationId,
      });
      const acceptedVersion = await this.deps.repository.bumpServiceVersion(
        uow.tx,
        command.serviceId,
      );

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: command.reasonCode,
        action: "catalog.service.media.remove",
        targetType: "service",
        targetId: command.serviceId,
        context: {
          before: this.mediaAuditSnapshot({
            serviceId: service.id,
            code: service.code,
            version: service.version,
            associationCount: before.length,
          }),
          after: this.mediaAuditSnapshot({
            serviceId: service.id,
            code: service.code,
            version: acceptedVersion,
            associationCount: Math.max(0, before.length - 1),
          }),
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        targetId: command.serviceId,
        acceptedVersion,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE",
      });

      return {
        service: await this.buildServiceManagementWithMedia(
          uow,
          command.serviceId,
        ),
        replayed: false,
      };
    });
  }

  /**
   * Shared protected-read gate for staff management queries.
   */
  async assertManagementRead(principal: AuthenticationPrincipal): Promise<void> {
    const decision = await this.deps.authorization.authorizeProtectedOperation({
      principal,
      operationId: "catalog.management.read",
    });
    if (!decision.allowed) {
      throw new CatalogError("CATALOG_FORBIDDEN", "Catalog management read denied", {
        httpStatus: 403,
        details: { denialCode: decision.denialCode },
      });
    }
  }

  /**
   * Shared protected-write gate including privileged reason validation.
   */
  async assertManagementWrite(
    principal: AuthenticationPrincipal,
    reasonCode: string,
  ): Promise<void> {
    const decision = await this.deps.authorization.authorizeProtectedOperation({
      principal,
      operationId: "catalog.management.write",
    });
    if (!decision.allowed) {
      throw new CatalogError("CATALOG_FORBIDDEN", "Catalog management write denied", {
        httpStatus: 403,
        details: { denialCode: decision.denialCode },
      });
    }

    const reason = findPrivilegedActionReason(reasonCode);
    if (
      reason === undefined ||
      !reason.isActive ||
      reason.operation !== "CATALOG_MANAGEMENT_WRITE" ||
      reason.code !== "catalog_management_change"
    ) {
      throw new CatalogError(
        "CATALOG_FORBIDDEN",
        "Catalog management write requires an approved privileged reason",
        { httpStatus: 403 },
      );
    }
  }

  /**
   * Re-authorize the trusted principal inside the final Catalog transaction.
   *
   * @explanation A grant revoked between the pre-check and the commit must
   * prevent the mutation, so authority is read again from current facts rather
   * than trusted from the earlier decision.
   */
  async recheckManagementWriteAuthority(
    principal: AuthenticationPrincipal,
    reasonCode: string,
  ): Promise<void> {
    await this.assertManagementWrite(principal, reasonCode);
  }

  /**
   * Enforce the caller's exact expected aggregate version.
   */
  assertExpectedVersion(input: {
    readonly currentVersion: number;
    readonly expectedVersion: number;
    readonly targetType: string;
  }): void {
    if (input.currentVersion !== input.expectedVersion) {
      throw new CatalogError(
        "CATALOG_VERSION_CONFLICT",
        "Catalog aggregate version is stale",
        {
          details: {
            targetType: input.targetType,
            currentVersion: input.currentVersion,
            expectedVersion: input.expectedVersion,
          },
        },
      );
    }
  }

  /**
   * Build allowlisted privileged-audit context facts only.
   */
  buildSafeAuditContext(
    facts: Readonly<Record<string, string | number | boolean | null>>,
  ): Readonly<Record<string, string | number | boolean>> {
    const forbidden =
      /name|description|label|help|body|url|token|key|localeText|answer|material|supply|customer/iu;
    const safe: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(facts)) {
      if (forbidden.test(key) || value === null) {
        continue;
      }
      safe[key] = value;
    }
    return safe;
  }

  /** Allowlisted category identity/lifecycle/order facts for FR-032 before/after. */
  categoryAuditSnapshot(row: CatalogCategoryRow): SafeAuditContext {
    return {
      categoryId: row.id,
      code: row.code,
      version: row.version,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
    };
  }

  /** Allowlisted service identity/lifecycle/order facts for FR-032 before/after. */
  serviceAuditSnapshot(row: CatalogServiceRow): SafeAuditContext {
    return {
      serviceId: row.id,
      categoryId: row.categoryId,
      code: row.code,
      version: row.version,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
    };
  }

  /** Allowlisted configuration counts for FR-032 before/after (no localized text). */
  configurationAuditSnapshot(row: CatalogServiceWithConfigurationRow): SafeAuditContext {
    return {
      serviceId: row.id,
      code: row.code,
      version: row.version,
      priceUnitCount: row.priceUnits.length,
      fieldCount: row.fields.length,
      activePriceUnitCount: row.priceUnits.filter((unit) => unit.isActive).length,
      activeFieldCount: row.fields.filter((field) => field.isActive).length,
    };
  }

  private storedConfigurationForActivation(
    row: CatalogServiceWithConfigurationRow,
  ): Parameters<typeof assertActiveServiceStoredConfiguration>[0]["fields"] {
    return row.fields.map((field) => ({
      code: field.code,
      kind: field.kind,
      isRequired: field.isRequired,
      isActive: field.isActive,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      helpTextAr: field.helpTextAr,
      helpTextEn: field.helpTextEn,
      minLength: field.minLength,
      maxLength: field.maxLength,
      numberMode: field.numberMode,
      minValue: field.minValue,
      maxValue: field.maxValue,
      minSelections: field.minSelections,
      maxSelections: field.maxSelections,
      options: field.options.map((option) => ({
        value: option.value,
        isActive: option.isActive,
        labelAr: option.labelAr,
        labelEn: option.labelEn,
      })),
    }));
  }

  private toSelectableSummary(
    candidate: SelectableServiceCandidateRow,
    locale: CatalogLocale,
    countryIsAuthoritativeAndActive: boolean,
  ): SelectableCatalogServiceSummary | null {
    const selectable = isServiceSelectable({
      countryIsAuthoritativeAndActive,
      categoryIsActive: candidate.category.isActive,
      serviceIsActive: candidate.service.isActive,
      countryAvailabilityIsAvailable: candidate.countryAvailabilityIsAvailable,
      requestedLocale: locale,
      translations: candidate.service.translations,
      priceUnits: candidate.service.priceUnits.map((unit) => ({
        code: unit.code,
        isActive: unit.isActive,
        labelAr: unit.labelAr,
        labelEn: unit.labelEn,
      })),
      fields: candidate.service.fields.map((field) => ({
        code: field.code,
        isActive: field.isActive,
        labelAr: field.labelAr,
        labelEn: field.labelEn,
        options: field.options.map((option) => ({
          value: option.value,
          isActive: option.isActive,
          labelAr: option.labelAr,
          labelEn: option.labelEn,
        })),
      })),
    });
    if (!selectable) {
      return null;
    }

    try {
      assertActiveServiceStoredConfiguration({
        categoryIsActive: candidate.category.isActive,
        translations: candidate.service.translations,
        priceUnits: candidate.service.priceUnits.map((unit) => ({
          code: unit.code,
          isActive: unit.isActive,
          labelAr: unit.labelAr,
          labelEn: unit.labelEn,
        })),
        fields: this.storedConfigurationForActivation(candidate.service),
      });
    } catch (error) {
      if (error instanceof CatalogError) {
        return null;
      }
      throw error;
    }

    let serviceContent: { readonly name: string; readonly description: string };
    let categoryContent: { readonly name: string; readonly description: string };
    try {
      serviceContent = resolveExactLocaleContent({
        translations: candidate.service.translations,
        locale,
      });
      categoryContent = resolveExactLocaleContent({
        translations: [
          {
            locale: "AR",
            name: candidate.category.nameAr,
            description: candidate.category.descriptionAr,
          },
          {
            locale: "EN",
            name: candidate.category.nameEn,
            description: candidate.category.descriptionEn,
          },
        ],
        locale,
      });
    } catch (error) {
      if (error instanceof CatalogError) {
        return null;
      }
      throw error;
    }

    return {
      serviceId: candidate.service.id,
      serviceCode: candidate.service.code,
      serviceVersion: candidate.service.version,
      categoryId: candidate.category.id,
      categoryCode: candidate.category.code,
      name: serviceContent.name,
      description: serviceContent.description,
      categoryName: categoryContent.name,
      displayOrder: candidate.service.displayOrder,
    };
  }

  private async appendPrivilegedMutationAudit(
    uow: CatalogUnitOfWorkDependencies,
    input: {
      readonly meta: CatalogCommandMeta;
      readonly reasonCode: string;
      readonly action: string;
      readonly targetType: string;
      readonly targetId: string;
      readonly context: SafeAuditContext;
    },
  ): Promise<void> {
    await uow.privilegedAuditWriter.append({
      actorType: "USER",
      actorId: input.meta.principal.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reasonCode,
      context: input.context,
      ...(input.meta.requestId === undefined
        ? {}
        : { requestId: input.meta.requestId }),
    });
  }

  private logAcceptedWrite(input: {
    readonly operation: string;
    readonly outcome: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly version: number;
    readonly actorUserId: string;
    readonly requestId?: string;
    readonly extras?: Readonly<Record<string, string | number | boolean>>;
  }): void {
    this.deps.logger.info("catalog.management.write.accepted", {
      operation: input.operation,
      outcome: input.outcome,
      targetType: input.targetType,
      targetId: input.targetId,
      version: input.version,
      actorUserId: input.actorUserId,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      ...(input.extras ?? {}),
    });
  }

  async listCategoriesForManagement(
    meta: CatalogCommandMeta,
    query: { readonly cursor?: string; readonly limit?: number },
  ): Promise<{
    readonly items: readonly CatalogCategoryManagementDto[];
    readonly nextCursor: string | null;
  }> {
    await this.assertManagementRead(meta.principal);
    return this.deps.repository.unitOfWork.runInTransaction(async ({ tx }) => {
      const page = await this.deps.repository.listCategories(tx, {
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
      });
      return {
        items: page.items.map(toCategoryManagementDto),
        nextCursor: page.nextCursor,
      };
    });
  }

  async getCategoryForManagement(
    meta: CatalogCommandMeta,
    categoryId: string,
  ): Promise<CatalogCategoryManagementDto> {
    await this.assertManagementRead(meta.principal);
    return this.deps.repository.unitOfWork.runInTransaction(async ({ tx }) => {
      const row = await this.deps.repository.findCategory(tx, categoryId);
      if (row === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
      }
      return toCategoryManagementDto(row);
    });
  }

  async createCategory(
    meta: CatalogCommandMeta,
    body: CreateCategoryBody,
  ): Promise<{
    readonly category: CatalogCategoryManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const code = assertStableCode(body.code, { min: 2, max: 80, field: "code" });
    const content = {
      nameAr: normalizeOptionalLocalizedText(body.nameAr),
      nameEn: normalizeOptionalLocalizedText(body.nameEn),
      descriptionAr: normalizeOptionalLocalizedText(body.descriptionAr),
      descriptionEn: normalizeOptionalLocalizedText(body.descriptionEn),
    };
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "category.create",
        code,
        ...content,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "category.create",
      targetType: "CATEGORY",
      targetId: null,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "CATEGORY",
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findCategory(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return {
          category: toCategoryManagementDto(existing),
          replayed: true,
        };
      }

      const displayOrder = await this.deps.repository.nextCategoryDisplayOrder(
        uow.tx,
      );
      const created = await this.deps.repository.insertCategory(uow.tx, {
        code,
        displayOrder,
        ...content,
      });

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.category.create",
        targetType: "service_category",
        targetId: created.id,
        context: {
          before: { exists: false },
          after: this.categoryAuditSnapshot(created),
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: created.id,
        acceptedVersion: created.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "CATEGORY",
      });

      this.logAcceptedWrite({
        operation: "catalog.category.create",
        outcome: "CREATED",
        targetType: "CATEGORY",
        targetId: created.id,
        version: created.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          code: created.code,
          displayOrder: created.displayOrder,
          isActive: created.isActive,
        },
      });

      return { category: toCategoryManagementDto(created), replayed: false };
    });
  }

  async replaceCategoryContent(
    meta: CatalogCommandMeta,
    categoryId: string,
    body: ReplaceCategoryBody,
  ): Promise<{
    readonly category: CatalogCategoryManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const content = {
      nameAr: normalizeOptionalLocalizedText(body.nameAr),
      nameEn: normalizeOptionalLocalizedText(body.nameEn),
      descriptionAr: normalizeOptionalLocalizedText(body.descriptionAr),
      descriptionEn: normalizeOptionalLocalizedText(body.descriptionEn),
    };
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "category.replace",
        categoryId,
        expectedVersion: body.expectedVersion,
        ...content,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "category.replace",
      targetType: "CATEGORY",
      targetId: categoryId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "CATEGORY",
        targetId: categoryId,
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findCategory(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return {
          category: toCategoryManagementDto(existing),
          replayed: true,
        };
      }

      const current = await this.deps.repository.lockCategory(uow.tx, categoryId);
      if (current === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
      }
      this.assertExpectedVersion({
        currentVersion: current.version,
        expectedVersion: body.expectedVersion,
        targetType: "CATEGORY",
      });
      assertCategoryActivationContent({
        isActive: current.isActive,
        ...content,
      });

      const updated = await this.deps.repository.updateCategory(uow.tx, {
        categoryId,
        expectedVersion: body.expectedVersion,
        content,
      });
      const childIds = await this.deps.repository.lockChildServiceIds(
        uow.tx,
        categoryId,
      );
      const childrenBumped = await this.deps.repository.bumpServiceVersions(
        uow.tx,
        childIds,
      );

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.category.replace",
        targetType: "service_category",
        targetId: updated.id,
        context: {
          before: this.categoryAuditSnapshot(current),
          after: this.categoryAuditSnapshot(updated),
          childrenBumped,
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: updated.id,
        acceptedVersion: updated.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "CATEGORY",
      });

      this.logAcceptedWrite({
        operation: "catalog.category.replace",
        outcome: "REPLACED",
        targetType: "CATEGORY",
        targetId: updated.id,
        version: updated.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          code: updated.code,
          displayOrder: updated.displayOrder,
          isActive: updated.isActive,
          childrenBumped,
        },
      });

      return { category: toCategoryManagementDto(updated), replayed: false };
    });
  }

  async changeCategoryLifecycle(
    meta: CatalogCommandMeta,
    categoryId: string,
    body: CategoryLifecycleBody,
  ): Promise<{
    readonly category: CatalogCategoryManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const isActive = body.action === "ACTIVATE";
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "category.lifecycle",
        categoryId,
        expectedVersion: body.expectedVersion,
        action: body.action,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "category.lifecycle",
      targetType: "CATEGORY",
      targetId: categoryId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "CATEGORY",
        targetId: categoryId,
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findCategory(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return {
          category: toCategoryManagementDto(existing),
          replayed: true,
        };
      }

      const current = await this.deps.repository.lockCategory(uow.tx, categoryId);
      if (current === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
      }
      this.assertExpectedVersion({
        currentVersion: current.version,
        expectedVersion: body.expectedVersion,
        targetType: "CATEGORY",
      });
      if (isActive) {
        assertCategoryActivationContent({
          isActive: true,
          nameAr: current.nameAr,
          nameEn: current.nameEn,
          descriptionAr: current.descriptionAr,
          descriptionEn: current.descriptionEn,
        });
      }

      const updated = await this.deps.repository.updateCategory(uow.tx, {
        categoryId,
        expectedVersion: body.expectedVersion,
        isActive,
      });
      const childIds = await this.deps.repository.lockChildServiceIds(
        uow.tx,
        categoryId,
      );
      const childrenBumped = await this.deps.repository.bumpServiceVersions(
        uow.tx,
        childIds,
      );

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.category.lifecycle",
        targetType: "service_category",
        targetId: updated.id,
        context: {
          before: this.categoryAuditSnapshot(current),
          after: this.categoryAuditSnapshot(updated),
          action: body.action,
          childrenBumped,
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: updated.id,
        acceptedVersion: updated.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "CATEGORY",
      });

      this.logAcceptedWrite({
        operation: "catalog.category.lifecycle",
        outcome: "LIFECYCLE",
        targetType: "CATEGORY",
        targetId: updated.id,
        version: updated.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          code: updated.code,
          displayOrder: updated.displayOrder,
          isActive: updated.isActive,
          action: body.action,
          childrenBumped,
        },
      });

      return { category: toCategoryManagementDto(updated), replayed: false };
    });
  }

  async listServicesForManagement(
    meta: CatalogCommandMeta,
    query: {
      readonly categoryId?: string;
      readonly cursor?: string;
      readonly limit?: number;
    },
  ): Promise<{
    readonly items: readonly CatalogServiceManagementDto[];
    readonly nextCursor: string | null;
  }> {
    await this.assertManagementRead(meta.principal);
    return this.deps.repository.unitOfWork.runInTransaction(async ({ tx }) => {
      const page = await this.deps.repository.listServices(tx, {
        ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
      });
      return {
        items: page.items.map(toServiceManagementDto),
        nextCursor: page.nextCursor,
      };
    });
  }

  async getServiceForManagement(
    meta: CatalogCommandMeta,
    serviceId: string,
  ): Promise<CatalogServiceManagementDto> {
    await this.assertManagementRead(meta.principal);
    return this.deps.repository.unitOfWork.runInTransaction(async ({ tx }) => {
      const row = await this.deps.repository.findServiceWithConfiguration(tx, serviceId);
      if (row === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
      }
      return toServiceManagementDto(row);
    });
  }

  async createService(
    meta: CatalogCommandMeta,
    body: CreateServiceBody,
  ): Promise<{
    readonly service: CatalogServiceManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const code = assertStableCode(body.code, { min: 2, max: 100, field: "code" });
    const translations = body.translations.map((translation) => ({
      locale: translation.locale,
      name: normalizeOptionalLocalizedText(translation.name),
      description: normalizeOptionalLocalizedText(translation.description),
    }));
    assertUniqueLocales(translations);
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.create",
        categoryId: body.categoryId,
        code,
        translations,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.create",
      targetType: "SERVICE",
      targetId: null,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE",
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findService(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return { service: toServiceManagementDto(existing), replayed: true };
      }

      const category = await this.deps.repository.findCategory(
        uow.tx,
        body.categoryId,
      );
      if (category === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
      }

      const displayOrder = await this.deps.repository.nextServiceDisplayOrder(
        uow.tx,
        body.categoryId,
      );
      const created = await this.deps.repository.insertService(uow.tx, {
        categoryId: body.categoryId,
        code,
        displayOrder,
        translations,
      });

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.service.create",
        targetType: "service",
        targetId: created.id,
        context: {
          before: { exists: false },
          after: this.serviceAuditSnapshot(created),
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: created.id,
        acceptedVersion: created.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE",
      });

      this.logAcceptedWrite({
        operation: "catalog.service.create",
        outcome: "CREATED",
        targetType: "SERVICE",
        targetId: created.id,
        version: created.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          code: created.code,
          categoryId: created.categoryId,
          displayOrder: created.displayOrder,
          isActive: created.isActive,
        },
      });

      return { service: toServiceManagementDto(created), replayed: false };
    });
  }

  async moveService(
    meta: CatalogCommandMeta,
    serviceId: string,
    body: MoveServiceBody,
  ): Promise<{
    readonly service: CatalogServiceManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.move",
        serviceId,
        expectedVersion: body.expectedVersion,
        categoryId: body.categoryId,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.move",
      targetType: "SERVICE",
      targetId: serviceId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE",
        targetId: serviceId,
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findService(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return { service: toServiceManagementDto(existing), replayed: true };
      }

      const current = await this.deps.repository.lockService(uow.tx, serviceId);
      if (current === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
      }
      this.assertExpectedVersion({
        currentVersion: current.version,
        expectedVersion: body.expectedVersion,
        targetType: "SERVICE",
      });
      const category = await this.deps.repository.findCategory(
        uow.tx,
        body.categoryId,
      );
      if (category === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
      }

      const displayOrder = await this.deps.repository.nextServiceDisplayOrder(
        uow.tx,
        body.categoryId,
      );
      const updated = await this.deps.repository.updateService(uow.tx, {
        serviceId,
        expectedVersion: body.expectedVersion,
        categoryId: body.categoryId,
        displayOrder,
      });

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.service.move",
        targetType: "service",
        targetId: updated.id,
        context: {
          before: this.serviceAuditSnapshot(current),
          after: this.serviceAuditSnapshot(updated),
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: updated.id,
        acceptedVersion: updated.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE",
      });

      this.logAcceptedWrite({
        operation: "catalog.service.move",
        outcome: "MOVED",
        targetType: "SERVICE",
        targetId: updated.id,
        version: updated.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          code: updated.code,
          categoryId: updated.categoryId,
          displayOrder: updated.displayOrder,
          isActive: updated.isActive,
        },
      });

      return { service: toServiceManagementDto(updated), replayed: false };
    });
  }

  async changeServiceLifecycle(
    meta: CatalogCommandMeta,
    serviceId: string,
    body: ServiceLifecycleBody,
  ): Promise<{
    readonly service: CatalogServiceManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const isActive = body.action === "ACTIVATE";
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.lifecycle",
        serviceId,
        expectedVersion: body.expectedVersion,
        action: body.action,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.lifecycle",
      targetType: "SERVICE",
      targetId: serviceId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE",
        targetId: serviceId,
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findService(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return { service: toServiceManagementDto(existing), replayed: true };
      }

      const current = await this.deps.repository.lockService(uow.tx, serviceId);
      if (current === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
      }
      this.assertExpectedVersion({
        currentVersion: current.version,
        expectedVersion: body.expectedVersion,
        targetType: "SERVICE",
      });
      if (isActive) {
        const category = await this.deps.repository.findCategory(
          uow.tx,
          current.categoryId,
        );
        if (category === null || !category.isActive) {
          throw new CatalogError(
            "CATALOG_ACTIVATION_INCOMPLETE",
            "Catalog service cannot activate while its category is inactive",
            { details: { categoryId: current.categoryId } },
          );
        }
        const configured = await this.deps.repository.findServiceWithConfiguration(
          uow.tx,
          serviceId,
        );
        if (configured === null) {
          throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
        }
        assertActiveServiceStoredConfiguration({
          categoryIsActive: true,
          translations: configured.translations,
          priceUnits: configured.priceUnits.map((unit) => ({
            code: unit.code,
            isActive: unit.isActive,
            labelAr: unit.labelAr,
            labelEn: unit.labelEn,
          })),
          fields: this.storedConfigurationForActivation(configured),
        });
      }

      const updated = await this.deps.repository.updateService(uow.tx, {
        serviceId,
        expectedVersion: body.expectedVersion,
        isActive,
      });

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.service.lifecycle",
        targetType: "service",
        targetId: updated.id,
        context: {
          before: this.serviceAuditSnapshot(current),
          after: this.serviceAuditSnapshot(updated),
          action: body.action,
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: updated.id,
        acceptedVersion: updated.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE",
      });

      this.logAcceptedWrite({
        operation: "catalog.service.lifecycle",
        outcome: "LIFECYCLE",
        targetType: "SERVICE",
        targetId: updated.id,
        version: updated.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          code: updated.code,
          categoryId: updated.categoryId,
          displayOrder: updated.displayOrder,
          isActive: updated.isActive,
          action: body.action,
        },
      });

      return { service: toServiceManagementDto(updated), replayed: false };
    });
  }

  async replaceServiceConfiguration(
    meta: CatalogCommandMeta,
    serviceId: string,
    body: ReplaceServiceConfigurationBody,
  ): Promise<{
    readonly service: CatalogServiceManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const translations = body.translations.map((translation) => ({
      locale: translation.locale,
      name: normalizeOptionalLocalizedText(translation.name),
      description: normalizeOptionalLocalizedText(translation.description),
    }));
    assertUniqueLocales(translations);
    const graph = assertServiceConfigurationGraph({
      priceUnits: body.priceUnits,
      fields: body.fields,
    });
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.configuration.replace",
        serviceId,
        expectedVersion: body.expectedVersion,
        translations,
        priceUnits: graph.priceUnits,
        fields: graph.fields,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.configuration.replace",
      targetType: "SERVICE",
      targetId: serviceId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE",
        targetId: serviceId,
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findServiceWithConfiguration(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return { service: toServiceManagementDto(existing), replayed: true };
      }

      const current = await this.deps.repository.findServiceWithConfiguration(
        uow.tx,
        serviceId,
      );
      if (current === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
      }
      this.assertExpectedVersion({
        currentVersion: current.version,
        expectedVersion: body.expectedVersion,
        targetType: "SERVICE",
      });
      if (current.isActive) {
        const category = await this.deps.repository.findCategory(
          uow.tx,
          current.categoryId,
        );
        if (category === null) {
          throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
        }
        assertActiveServiceStoredConfiguration({
          categoryIsActive: category.isActive,
          translations,
          priceUnits: graph.priceUnits,
          fields: graph.fields.map((field) => ({
            code: field.code,
            kind: field.kind,
            isRequired: field.isRequired,
            isActive: field.isActive,
            labelAr: field.labelAr,
            labelEn: field.labelEn,
            helpTextAr: field.helpTextAr,
            helpTextEn: field.helpTextEn,
            minLength: field.minLength,
            maxLength: field.maxLength,
            numberMode: field.numberMode,
            minValue: field.minValue,
            maxValue: field.maxValue,
            minSelections: field.minSelections,
            maxSelections: field.maxSelections,
            options: field.options.map((option) => ({
              value: option.value,
              isActive: option.isActive,
              labelAr: option.labelAr,
              labelEn: option.labelEn,
            })),
          })),
        });
      }

      const beforeSnapshot = this.configurationAuditSnapshot(current);
      const updated = await this.deps.repository.replaceServiceConfiguration(uow.tx, {
        serviceId,
        expectedVersion: body.expectedVersion,
        translations,
        priceUnits: graph.priceUnits,
        fields: graph.fields,
      });

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.service.configuration.replace",
        targetType: "service",
        targetId: updated.id,
        context: {
          before: beforeSnapshot,
          after: this.configurationAuditSnapshot(updated),
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: updated.id,
        acceptedVersion: updated.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE",
      });

      this.logAcceptedWrite({
        operation: "catalog.service.configuration.replace",
        outcome: "REPLACED",
        targetType: "SERVICE",
        targetId: updated.id,
        version: updated.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          code: updated.code,
          priceUnitCount: updated.priceUnits.length,
          fieldCount: updated.fields.length,
        },
      });

      return { service: toServiceManagementDto(updated), replayed: false };
    });
  }

  async replaceCategoryOrder(
    meta: CatalogCommandMeta,
    body: ReplaceCategoryOrderBody,
  ): Promise<{
    readonly categories: readonly CatalogCategoryManagementDto[];
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "category.order.replace",
        items: body.items,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "category.order.replace",
      targetType: "CATEGORY_ORDER",
      targetId: null,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "CATEGORY_ORDER",
      });

      if (receipt !== "proceed" && receipt.replayed) {
        const page = await this.deps.repository.listCategories(uow.tx, {});
        return {
          categories: page.items.map(toCategoryManagementDto),
          replayed: true,
        };
      }

      const locked = await this.deps.repository.lockAllCategories(uow.tx);
      const current = new Map(locked.map((row) => [row.id, row.version]));
      const replacement = assertExactOrderReplacement({
        scope: "CATEGORY",
        items: body.items,
        current,
      });
      const updated = await this.deps.repository.replaceCategoryOrder(uow.tx, {
        orderedIds: replacement.orderedIds,
        positions: replacement.positions,
      });

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.category.order.replace",
        targetType: "service_category_order",
        targetId: "CATEGORY_ORDER",
        context: {
          before: { count: locked.length },
          after: { count: updated.length, orderedIds: replacement.orderedIds },
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: "CATEGORY_ORDER",
        acceptedVersion: updated[0]?.version ?? 1,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "CATEGORY_ORDER",
      });

      this.logAcceptedWrite({
        operation: "catalog.category.order.replace",
        outcome: "REORDERED",
        targetType: "CATEGORY_ORDER",
        targetId: "CATEGORY_ORDER",
        version: updated[0]?.version ?? 1,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: { count: updated.length },
      });

      return {
        categories: updated.map(toCategoryManagementDto),
        replayed: false,
      };
    });
  }

  async replaceServiceOrder(
    meta: CatalogCommandMeta,
    body: ReplaceServiceOrderBody,
  ): Promise<{
    readonly services: readonly CatalogServiceManagementDto[];
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.order.replace",
        categoryId: body.categoryId,
        items: body.items,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.order.replace",
      targetType: "SERVICE_ORDER",
      targetId: body.categoryId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE_ORDER",
        targetId: body.categoryId,
      });

      if (receipt !== "proceed" && receipt.replayed) {
        const page = await this.deps.repository.listServices(uow.tx, {
          categoryId: body.categoryId,
        });
        return {
          services: page.items.map(toServiceManagementDto),
          replayed: true,
        };
      }

      const category = await this.deps.repository.findCategory(uow.tx, body.categoryId);
      if (category === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
      }

      const locked = await this.deps.repository.lockServicesInCategory(
        uow.tx,
        body.categoryId,
      );
      const current = new Map(locked.map((row) => [row.id, row.version]));
      const replacement = assertExactOrderReplacement({
        scope: "SERVICE",
        items: body.items,
        current,
      });
      const updated = await this.deps.repository.replaceServiceOrder(uow.tx, {
        categoryId: body.categoryId,
        orderedIds: replacement.orderedIds,
        positions: replacement.positions,
      });

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.service.order.replace",
        targetType: "service_order",
        targetId: body.categoryId,
        context: {
          before: { count: locked.length },
          after: { count: updated.length, orderedIds: replacement.orderedIds },
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: body.categoryId,
        acceptedVersion: updated[0]?.version ?? 1,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE_ORDER",
      });

      this.logAcceptedWrite({
        operation: "catalog.service.order.replace",
        outcome: "REORDERED",
        targetType: "SERVICE_ORDER",
        targetId: body.categoryId,
        version: updated[0]?.version ?? 1,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: { count: updated.length },
      });

      return {
        services: updated.map(toServiceManagementDto),
        replayed: false,
      };
    });
  }

  async replaceServiceAvailability(
    meta: CatalogCommandMeta,
    serviceId: string,
    body: ReplaceServiceAvailabilityBody,
  ): Promise<{
    readonly service: CatalogServiceManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertManagementWrite(meta.principal, body.reasonCode);
    for (const country of body.countries) {
      assertNoClientInventedCountryFacts({ countryCode: country.countryCode });
    }
    const fingerprint = hashCatalogCommandFingerprint(
      canonicalCatalogCommandFingerprint({
        operation: "service.availability.replace",
        serviceId,
        expectedVersion: body.expectedVersion,
        countries: body.countries,
      }),
    );
    const scopeKey = buildCatalogCommandScopeKey({
      operation: "service.availability.replace",
      targetType: "SERVICE",
      targetId: serviceId,
    });

    return this.deps.repository.unitOfWork.runInTransaction(async (uow) => {
      await this.recheckManagementWriteAuthority(meta.principal, body.reasonCode);
      const receipt = await this.deps.repository.reserveOrReplayCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestHash: fingerprint,
        actorUserId: meta.principal.userId,
        targetType: "SERVICE",
        targetId: serviceId,
      });

      if (receipt !== "proceed" && receipt.replayed && receipt.targetId !== null) {
        const existing = await this.deps.repository.findServiceWithConfiguration(
          uow.tx,
          receipt.targetId,
        );
        if (existing === null) {
          throw new CatalogError(
            "CATALOG_DEPENDENCY_FAILED",
            "Catalog idempotent replay target is missing",
          );
        }
        return { service: toServiceManagementDto(existing), replayed: true };
      }

      const current = await this.deps.repository.findServiceWithConfiguration(
        uow.tx,
        serviceId,
      );
      if (current === null) {
        throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
      }
      this.assertExpectedVersion({
        currentVersion: current.version,
        expectedVersion: body.expectedVersion,
        targetType: "SERVICE",
      });

      const beforeAvailability = await this.deps.repository.listServiceCountryAvailability(
        uow.tx,
        serviceId,
      );
      const resolvedCountries = [];
      for (const country of body.countries) {
        const activeCountry = await resolveCatalogCountryForAvailability(
          uow.activeCountryReader,
          country.countryCode,
        );
        if (country.isAvailable) {
          resolvedCountries.push({
            countryId: activeCountry.id,
            countryCode: activeCountry.code,
            isAvailable: true,
          });
        } else {
          resolvedCountries.push({
            countryId: activeCountry.id,
            countryCode: activeCountry.code,
            isAvailable: false,
          });
        }
      }

      const updated = await this.deps.repository.replaceServiceCountryAvailability(
        uow.tx,
        {
          serviceId,
          expectedVersion: body.expectedVersion,
          countries: resolvedCountries,
        },
      );
      const afterAvailability = await this.deps.repository.listServiceCountryAvailability(
        uow.tx,
        serviceId,
      );

      await this.appendPrivilegedMutationAudit(uow, {
        meta,
        reasonCode: body.reasonCode,
        action: "catalog.service.availability.replace",
        targetType: "service",
        targetId: updated.id,
        context: {
          before: {
            availabilityCount: beforeAvailability.length,
            availableCount: beforeAvailability.filter((row) => row.isAvailable)
              .length,
          },
          after: {
            availabilityCount: afterAvailability.length,
            availableCount: afterAvailability.filter((row) => row.isAvailable)
              .length,
          },
        },
      });

      await this.deps.repository.completeCommand(uow.tx, {
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        targetId: updated.id,
        acceptedVersion: updated.version,
        actorUserId: meta.principal.userId,
        requestHash: fingerprint,
        targetType: "SERVICE",
      });

      this.logAcceptedWrite({
        operation: "catalog.service.availability.replace",
        outcome: "REPLACED",
        targetType: "SERVICE",
        targetId: updated.id,
        version: updated.version,
        actorUserId: meta.principal.userId,
        ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
        extras: {
          countryCount: body.countries.length,
          availableCount: body.countries.filter((row) => row.isAvailable).length,
        },
      });

      return { service: toServiceManagementDto(updated), replayed: false };
    });
  }
}

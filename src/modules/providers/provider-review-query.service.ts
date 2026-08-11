import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import type { ProtectedOperationAuthorizer } from "../authentication/authentication.public.js";
import { PROVIDER_APPLICATIONS_REVIEW_OPERATION } from "./domain/provider-authorization.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderApplicantProfileReaderPort,
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderMediaReaderPort,
  ProviderRepositoryPort,
  ProviderReviewRepositoryPort,
} from "./domain/providers.ports.js";
import type {
  ProviderApplicationStatus,
  ProviderKind,
  ProviderStatusHistoryRecord,
} from "./domain/providers.types.js";
import {
  calculateProfileCompletion,
} from "./domain/provider-completion.policy.js";
import { calculateMarketplaceReadiness } from "./domain/provider-readiness.policy.js";
import { toIso } from "./provider.dto.js";

const DEFAULT_QUEUE_LIMIT = 20;
const MAX_QUEUE_LIMIT = 100;

export interface StaffQueueCursorPayload {
  readonly lastSubmittedAt: string;
  readonly id: string;
}

export interface StaffQueueItemDto {
  readonly id: string;
  readonly providerKind: ProviderKind;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: string;
  readonly reviewCycle: number;
  readonly version: number;
  readonly lastSubmittedAt: string;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
}

export interface StaffQueuePageDto {
  readonly items: readonly StaffQueueItemDto[];
  readonly nextCursor: string | null;
}

export interface StaffDossierDto {
  readonly provider: {
    readonly id: string;
    readonly providerKind: ProviderKind;
    readonly applicationStatus: ProviderApplicationStatus;
    readonly operationalStatus: string;
    readonly reviewCycle: number;
    readonly version: number;
    readonly applicationOwnerUserId: string;
    readonly ownerUserId: string | null;
    readonly lastSubmittedAt: string | null;
    readonly approvedAt: string | null;
    readonly rejectedAt: string | null;
  };
  readonly applicantContext: {
    readonly category: "INDIVIDUAL" | "COMPANY";
    readonly individualFullName: string | null;
    readonly companyName: string | null;
    readonly representativeFullName: string | null;
  };
  readonly contacts: {
    readonly operationalEmail: string | null;
    readonly operationalPhone: string | null;
    readonly channels: readonly unknown[];
  };
  readonly profile: {
    readonly displayNameAr: string | null;
    readonly displayNameEn: string | null;
    readonly descriptionAr: string | null;
    readonly descriptionEn: string | null;
    readonly countryId: string | null;
    readonly logoMediaFileId: string | null;
    readonly coverMediaFileId: string | null;
  };
  readonly media: {
    readonly logoStatus: string | null;
    readonly coverStatus: string | null;
    readonly gallery: readonly {
      readonly galleryItemId: string;
      readonly kind: string;
      readonly position: number;
      readonly mediaFileId: string;
      readonly status: string | null;
    }[];
  };
  readonly completion: ReturnType<typeof calculateProfileCompletion>;
  readonly readiness: ReturnType<typeof calculateMarketplaceReadiness>;
  readonly statusHistory: readonly {
    readonly id: string;
    readonly domain: string;
    readonly fromApplicationStatus: string | null;
    readonly toApplicationStatus: string | null;
    readonly fromOperationalStatus: string | null;
    readonly toOperationalStatus: string | null;
    readonly reviewCycle: number | null;
    readonly actorUserId: string;
    readonly reason: string | null;
    readonly createdAt: string;
  }[];
}

export interface ProviderReviewQueryServiceDependencies {
  readonly authorization: ProtectedOperationAuthorizer;
  readonly reviewRepository: ProviderReviewRepositoryPort;
  readonly providers: ProviderRepositoryPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly mediaReader: ProviderMediaReaderPort;
  readonly projections: Pick<
    import("./provider-projection.service.js").ProviderProjectionService,
    "computeProjections"
  >;
  readonly denialAudit: ProviderDenialAuditPort;
}

function encodeQueueCursor(payload: StaffQueueCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeQueueCursor(raw: string): StaffQueueCursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as StaffQueueCursorPayload;
    if (
      typeof parsed.lastSubmittedAt !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(Date.parse(parsed.lastSubmittedAt))
    ) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw providersError("VALIDATION_ERROR", { field: "cursor" });
  }
}

/**
 * Staff queue and private dossier reads (FR-019, FR-020, FR-033, FR-080).
 */
export class ProviderReviewQueryService {
  public constructor(
    private readonly dependencies: ProviderReviewQueryServiceDependencies,
  ) {}

  public async listApplications(input: {
    readonly principal: AuthenticationPrincipal;
    readonly status?: ProviderApplicationStatus;
    readonly providerKind?: ProviderKind;
    readonly submittedFrom?: Date;
    readonly submittedTo?: Date;
    readonly cursor?: string;
    readonly limit?: number;
    readonly requestId?: string;
  }): Promise<StaffQueuePageDto> {
    await this.assertStaffReviewPermission(input.principal, input.requestId);

    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_QUEUE_LIMIT, 1),
      MAX_QUEUE_LIMIT,
    );
    const cursor =
      input.cursor === undefined ? undefined : decodeQueueCursor(input.cursor);

    const rows = await this.dependencies.reviewRepository.listQueue({
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.providerKind === undefined
        ? {}
        : { providerKind: input.providerKind }),
      ...(input.submittedFrom === undefined
        ? {}
        : { submittedFrom: input.submittedFrom }),
      ...(input.submittedTo === undefined
        ? {}
        : { submittedTo: input.submittedTo }),
      ...(cursor === undefined
        ? {}
        : {
            cursor: {
              lastSubmittedAt: new Date(cursor.lastSubmittedAt),
              id: cursor.id,
            },
          }),
      limit: limit + 1,
    });

    const page = rows.slice(0, limit);
    const overflow = rows[limit];
    const last = page[page.length - 1];
    const nextCursor =
      overflow === undefined || last === undefined
        ? null
        : encodeQueueCursor({
            lastSubmittedAt: last.lastSubmittedAt.toISOString(),
            id: last.id,
          });

    return {
      items: page.map((item) => ({
        id: item.id,
        providerKind: item.kind,
        applicationStatus: item.applicationStatus,
        operationalStatus: item.operationalStatus,
        reviewCycle: item.reviewCycle,
        version: item.version,
        lastSubmittedAt: toIso(item.lastSubmittedAt),
        displayNameAr: item.displayNameAr,
        displayNameEn: item.displayNameEn,
      })),
      nextCursor,
    };
  }

  public async getDossier(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<StaffDossierDto> {
    await this.assertStaffReviewPermission(input.principal, input.requestId);

    const provider = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (provider === null) {
      throw providersError("PROVIDER_NOT_FOUND");
    }

    const [profile, contact, gallery, history, applicant] =
      await Promise.all([
        this.dependencies.providers.getProfile(provider.id),
        this.dependencies.providers.getContact(provider.id),
        this.dependencies.providers.listGalleryItems(provider.id),
        this.dependencies.providers.listStatusHistory({
          providerId: provider.id,
          limit: 100,
        }),
        this.dependencies.applicantProfiles.getMatchingApplicantContext({
          userId: provider.applicationOwnerUserId,
          providerKind: provider.kind,
        }),
      ]);

    const logoStatus =
      profile?.logoMediaFileId === null || profile?.logoMediaFileId === undefined
        ? null
        : (
            await this.dependencies.mediaReader.getMediaStatus(
              profile.logoMediaFileId,
            )
          )?.status ?? null;
    const coverStatus =
      profile?.coverMediaFileId === null ||
      profile?.coverMediaFileId === undefined
        ? null
        : (
            await this.dependencies.mediaReader.getMediaStatus(
              profile.coverMediaFileId,
            )
          )?.status ?? null;

    const galleryWithStatus = await Promise.all(
      gallery.map(async (item) => {
        const media = await this.dependencies.mediaReader.getMediaStatus(
          item.mediaFileId,
        );
        return {
          galleryItemId: item.id,
          kind: item.kind,
          position: item.position,
          mediaFileId: item.mediaFileId,
          status: media?.status ?? null,
        };
      }),
    );

    const { completion, readiness } =
      await this.dependencies.projections.computeProjections(provider);

    return {
      provider: {
        id: provider.id,
        providerKind: provider.kind,
        applicationStatus: provider.applicationStatus,
        operationalStatus: provider.operationalStatus,
        reviewCycle: provider.reviewCycle,
        version: provider.version,
        applicationOwnerUserId: provider.applicationOwnerUserId,
        ownerUserId: provider.ownerUserId,
        lastSubmittedAt:
          provider.lastSubmittedAt === null
            ? null
            : toIso(provider.lastSubmittedAt),
        approvedAt:
          provider.approvedAt === null ? null : toIso(provider.approvedAt),
        rejectedAt:
          provider.rejectedAt === null ? null : toIso(provider.rejectedAt),
      },
      applicantContext: {
        category:
          applicant?.category ??
          (provider.kind === "INDIVIDUAL_TEAM" ? "INDIVIDUAL" : "COMPANY"),
        individualFullName: applicant?.individualFullName ?? null,
        companyName: applicant?.companyName ?? null,
        representativeFullName: applicant?.representativeFullName ?? null,
      },
      contacts: {
        operationalEmail: contact?.operationalEmailNormalized ?? null,
        operationalPhone: contact?.operationalPhoneE164 ?? null,
        channels: contact?.channels ?? [],
      },
      profile: {
        displayNameAr: profile?.displayNameAr ?? null,
        displayNameEn: profile?.displayNameEn ?? null,
        descriptionAr: profile?.descriptionAr ?? null,
        descriptionEn: profile?.descriptionEn ?? null,
        countryId: profile?.countryId ?? null,
        logoMediaFileId: profile?.logoMediaFileId ?? null,
        coverMediaFileId: profile?.coverMediaFileId ?? null,
      },
      media: {
        logoStatus,
        coverStatus,
        gallery: galleryWithStatus,
      },
      completion,
      readiness,
      statusHistory: history.map(mapHistoryDto),
    };
  }

  private async assertStaffReviewPermission(
    principal: AuthenticationPrincipal,
    requestId?: string,
  ): Promise<void> {
    const decision =
      await this.dependencies.authorization.authorizeProtectedOperation({
        principal,
        operationId: PROVIDER_APPLICATIONS_REVIEW_OPERATION,
        scope: { kind: "GLOBAL" },
      });
    if (decision.allowed) {
      return;
    }
    await this.dependencies.denialAudit.append({
      actorType: "USER",
      actorId: principal.userId,
      action: PROVIDER_APPLICATIONS_REVIEW_OPERATION,
      targetType: "provider_application",
      outcome: "DENIED",
      reason: decision.denialCode ?? "PERMISSION_DENIED",
      ...(requestId === undefined ? {} : { requestId }),
    });
    throw providersError("PROVIDER_ACCESS_DENIED");
  }
}

function mapHistoryDto(row: ProviderStatusHistoryRecord) {
  return {
    id: row.id,
    domain: row.domain,
    fromApplicationStatus: row.fromApplicationStatus,
    toApplicationStatus: row.toApplicationStatus,
    fromOperationalStatus: row.fromOperationalStatus,
    toOperationalStatus: row.toOperationalStatus,
    reviewCycle: row.reviewCycle,
    actorUserId: row.actorUserId,
    reason: row.reason,
    createdAt: toIso(row.createdAt),
  };
}

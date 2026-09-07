import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";

import {
  calculateProfileCompletion,
  type ProviderCompletionFacts,
} from "./domain/provider-completion.policy.js";
import {
  buildProviderSettingsProjection,
  deriveProviderNextAction,
  type ProviderNextAction,
  type ProviderSettingsProjection,
} from "./domain/provider-dashboard.policy.js";
import {
  canEditProviderProfileOrContacts,
  canManageProviderMembers,
  canReadPrivateContacts,
  canReadProviderProjections,
  resolveActorRelationship,
  type ProviderAuthorizationFacts,
} from "./domain/provider-authorization.policy.js";
import {
  PROVIDER_GALLERY_IMAGE_MAX_COUNT,
  PROVIDER_GALLERY_VIDEO_MAX_COUNT,
} from "./domain/provider-media.policy.js";
import { calculateMarketplaceReadiness } from "./domain/provider-readiness.policy.js";
import { requiredCategoryForProviderKind } from "./domain/provider-eligibility.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderApplicantProfileReaderPort,
  ActiveCountryReaderPort,
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderMediaReaderPort,
  ProviderRepositoryPort,
} from "./domain/providers.ports.js";
import type {
  MarketplaceReadiness,
  ProfileCompletion,
  ProviderKind,
  ProviderRecord,
  ProviderStatusHistoryRecord,
} from "./domain/providers.types.js";
import type { ProviderMediaUsageDto } from "./provider.dto.js";
import { toIso } from "./provider.dto.js";
import { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export interface ProviderProjectionServiceDependencies {
  readonly providers: ProviderRepositoryPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly mediaReader: ProviderMediaReaderPort;
  readonly activeCountries: ActiveCountryReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly verificationFacts?: {
    read(provider: ProviderRecord): Promise<{
      readonly documentsVerified: {
        readonly applicable: boolean;
        readonly status: "NOT_REQUIRED" | "NOT_STARTED" | "BLOCKED" | "SATISFIED";
        readonly satisfied: boolean;
        readonly blockerCodes: readonly string[];
      };
      readonly payoutDestinationReady: boolean;
    }>;
  };
  readonly servicesReadyFacts?: {
    read(providerId: string): Promise<{
      readonly satisfied: boolean;
      readonly blockerCodes: readonly string[];
    } | null>;
  };
}

export interface ProviderProjectionReaders {
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly mediaReader: ProviderMediaReaderPort;
  readonly activeCountries: ActiveCountryReaderPort;
}

export interface ProviderHistoryItemDto {
  readonly id: string;
  readonly domain: ProviderStatusHistoryRecord["domain"];
  readonly fromApplicationStatus: ProviderStatusHistoryRecord["fromApplicationStatus"];
  readonly toApplicationStatus: ProviderStatusHistoryRecord["toApplicationStatus"];
  readonly fromOperationalStatus: ProviderStatusHistoryRecord["fromOperationalStatus"];
  readonly toOperationalStatus: ProviderStatusHistoryRecord["toOperationalStatus"];
  readonly reviewCycle: number | null;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface ProviderHistoryPage {
  readonly items: readonly ProviderHistoryItemDto[];
  readonly nextCursor: string | null;
}

export interface ProviderLatestStaffDecisionDto {
  readonly toApplicationStatus: string | null;
  readonly reason: string | null;
  readonly reviewCycle: number | null;
  readonly createdAt: string;
}

export interface ProviderDashboardDto {
  readonly providerId: string;
  readonly providerKind: ProviderKind;
  readonly applicationStatus: ProviderRecord["applicationStatus"];
  readonly operationalStatus: ProviderRecord["operationalStatus"];
  readonly version: number;
  readonly completion: ProfileCompletion;
  readonly readiness: MarketplaceReadiness;
  readonly missingRequirementCodes: ProfileCompletion["missingRequirementCodes"];
  readonly readinessBlockers: readonly {
    readonly gateKey: string;
    readonly status: string;
    readonly blockerCodes: readonly string[];
    readonly owningPhase: string;
  }[];
  readonly latestStaffDecision: ProviderLatestStaffDecisionDto | null;
  readonly mediaUsage: ProviderMediaUsageDto;
  readonly activeAdminCount: number;
  readonly pendingInvitationCount: number;
  readonly nextAction: ProviderNextAction;
}

function encodeHistoryCursor(item: ProviderStatusHistoryRecord): string {
  return Buffer.from(
    `${item.createdAt.toISOString()}|${item.id}`,
    "utf8",
  ).toString("base64url");
}

function decodeHistoryCursor(
  cursor: string,
): { readonly createdAt: Date; readonly id: string } {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf("|");
    if (separator <= 0) {
      throw new Error("invalid");
    }
    const createdAt = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
      throw new Error("invalid");
    }
    return { createdAt, id };
  } catch {
    throw providersError("VALIDATION_ERROR", { field: "cursor" });
  }
}

function mapHistoryItem(
  row: ProviderStatusHistoryRecord,
): ProviderHistoryItemDto {
  return {
    id: row.id,
    domain: row.domain,
    fromApplicationStatus: row.fromApplicationStatus,
    toApplicationStatus: row.toApplicationStatus,
    fromOperationalStatus: row.fromOperationalStatus,
    toOperationalStatus: row.toOperationalStatus,
    reviewCycle: row.reviewCycle,
    reason: row.reason,
    createdAt: toIso(row.createdAt),
  };
}

/**
 * Derived completion/readiness/history/dashboard/settings projections.
 * Never persists percentages or a generic settings store.
 */
export class ProviderProjectionService {
  private readonly denialAudit: ProviderDenialAuditService;

  public constructor(
    private readonly dependencies: ProviderProjectionServiceDependencies,
  ) {
    this.denialAudit = new ProviderDenialAuditService(dependencies.denialAudit);
  }

  public async getCompletion(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<ProfileCompletion> {
    const { provider } = await this.requireProjectionAccess({
      ...input,
      action: "providers.completion.get",
    });
    const { completion } = await this.computeProjections(provider);
    return completion;
  }

  public async getReadiness(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<MarketplaceReadiness> {
    const { provider } = await this.requireProjectionAccess({
      ...input,
      action: "providers.readiness.get",
    });
    const { readiness } = await this.computeProjections(provider);
    return readiness;
  }

  public async listHistory(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly cursor?: string;
    readonly limit?: number;
    readonly requestId?: string;
  }): Promise<ProviderHistoryPage> {
    const { provider } = await this.requireProjectionAccess({
      ...input,
      action: "providers.history.list",
    });
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const decoded =
      input.cursor === undefined ? undefined : decodeHistoryCursor(input.cursor);

    const rows = await this.dependencies.providers.listStatusHistory({
      providerId: provider.id,
      limit: limit + 1,
      ...(decoded === undefined
        ? {}
        : {
            cursorCreatedAt: decoded.createdAt,
            cursorId: decoded.id,
          }),
    });

    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    return {
      items: page.map(mapHistoryItem),
      nextCursor:
        hasMore && page.length > 0
          ? encodeHistoryCursor(page.at(-1)!)
          : null,
    };
  }

  public async getDashboard(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<ProviderDashboardDto> {
    const { provider } = await this.requireProjectionAccess({
      ...input,
      action: "providers.dashboard.get",
    });
    const { completion, readiness, mediaUsage } =
      await this.computeProjections(provider);
    const members = await this.dependencies.providers.listMembers(provider.id);
    const activeAdminCount = members.filter(
      (member) => member.level === "ADMIN" && member.status === "ACTIVE",
    ).length;
    const pendingInvitationCount =
      await this.dependencies.providers.countPendingInvitations(provider.id);

    const history = await this.dependencies.providers.listStatusHistory({
      providerId: provider.id,
      limit: 20,
    });
    const latestStaffDecision = this.pickLatestStaffDecision(history);

    return {
      providerId: provider.id,
      providerKind: provider.kind,
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
      version: provider.version,
      completion,
      readiness,
      missingRequirementCodes: completion.missingRequirementCodes,
      readinessBlockers: readiness.gates
        .filter((gate) => !gate.satisfied && gate.status !== "NOT_REQUIRED")
        .map((gate) => ({
          gateKey: gate.key,
          status: gate.status,
          blockerCodes: gate.blockerCodes,
          owningPhase: gate.owningPhase,
        })),
      latestStaffDecision,
      mediaUsage,
      activeAdminCount,
      pendingInvitationCount,
      nextAction: deriveProviderNextAction({
        applicationStatus: provider.applicationStatus,
        operationalStatus: provider.operationalStatus,
        completion,
        readiness,
      }),
    };
  }

  public async getSettings(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<ProviderSettingsProjection> {
    const { provider, facts } = await this.requireProjectionAccess({
      ...input,
      action: "providers.settings.get",
    });
    const { completion, readiness, mediaUsage } = await this.computeProjections(provider);
    const contact = await this.dependencies.providers.getContact(provider.id);
    const members = await this.dependencies.providers.listMembers(provider.id);
    const activeAdminCount = members.filter(
      (member) => member.level === "ADMIN" && member.status === "ACTIVE",
    ).length;
    const pendingInvitationCount =
      await this.dependencies.providers.countPendingInvitations(provider.id);
    const canEdit = canEditProviderProfileOrContacts(facts);

    return buildProviderSettingsProjection({
      providerId: provider.id,
      profileComplete: completion.percentage === 100,
      canEditProfile: canEdit,
      privateContactsConfigured:
        contact?.operationalEmailNormalized !== null &&
        contact?.operationalEmailNormalized !== undefined &&
        contact.operationalEmailNormalized.length > 0,
      canViewPrivateContacts: canReadPrivateContacts(facts),
      canEditPrivateContacts: canEdit,
      mediaUsage,
      canEditMedia: canEdit,
      activeAdminCount,
      pendingInvitationCount,
      canManageMembers: canManageProviderMembers(facts),
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
      documentsVerifiedStatus: readiness.gates.find((gate) => gate.key === "documentsVerified")?.status ?? "NOT_STARTED",
      documentsVerifiedSatisfied: readiness.gates.find((gate) => gate.key === "documentsVerified")?.satisfied ?? false,
      payoutDestinationReady: readiness.gates.find((gate) => gate.key === "payoutDestinationReady")?.satisfied ?? false,
    });
  }

  private pickLatestStaffDecision(
    history: readonly ProviderStatusHistoryRecord[],
  ): ProviderLatestStaffDecisionDto | null {
    const decision = history.find(
      (row) =>
        row.domain === "APPLICATION" &&
        (row.toApplicationStatus === "CHANGES_REQUESTED" ||
          row.toApplicationStatus === "APPROVED" ||
          row.toApplicationStatus === "REJECTED" ||
          row.toApplicationStatus === "PENDING_REVIEW"),
    );
    if (decision === undefined) {
      return null;
    }
    return {
      toApplicationStatus: decision.toApplicationStatus,
      reason: decision.reason,
      reviewCycle: decision.reviewCycle,
      createdAt: toIso(decision.createdAt),
    };
  }

  private async requireProjectionAccess(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly action: string;
    readonly requestId?: string;
  }): Promise<{
    readonly provider: ProviderRecord;
    readonly facts: ProviderAuthorizationFacts;
  }> {
    const provider = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (provider === null) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: input.action,
        targetId: input.providerId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }
    const facts = await this.buildAuthorizationFacts({
      principal: input.principal,
      provider,
    });
    if (!canReadProviderProjections(facts)) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: input.action,
        targetId: provider.id,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
    }
    void resolveActorRelationship(facts);
    return { provider, facts };
  }

  private async buildAuthorizationFacts(input: {
    readonly principal: AuthenticationPrincipal;
    readonly provider: ProviderRecord;
  }): Promise<ProviderAuthorizationFacts> {
    const membership = await this.dependencies.providers.findMember({
      providerId: input.provider.id,
      userId: input.principal.userId,
    });
    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      input.principal.userId,
    );
    return {
      actorUserId: input.principal.userId,
      actorActive: identity?.active === true,
      applicationOwnerUserId: input.provider.applicationOwnerUserId,
      membership:
        membership === null
          ? null
          : {
              level: membership.level,
              status: membership.status,
            },
      staffAdmin: false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
      applicationStatus: input.provider.applicationStatus,
      operationalStatus: input.provider.operationalStatus,
    };
  }

  public async computeProjections(
    provider: ProviderRecord,
    providers: ProviderRepositoryPort = this.dependencies.providers,
    readerOverrides: Partial<ProviderProjectionReaders> = {},
  ): Promise<{
    readonly completion: ProfileCompletion;
    readonly readiness: MarketplaceReadiness;
    readonly mediaUsage: ProviderMediaUsageDto;
  }> {
    const collected = await this.collectCompletionFacts(
      provider,
      providers,
      readerOverrides,
    );
    const completion = calculateProfileCompletion(collected.facts);
    const verification = await this.dependencies.verificationFacts?.read(provider);
    const servicesReady = await this.dependencies.servicesReadyFacts?.read(
      provider.id,
    );
    const readiness = calculateMarketplaceReadiness({
      kind: provider.kind,
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
      profileCompletionPercentage: completion.percentage,
      ...(verification === undefined ? {} : verification),
      ...(servicesReady === null || servicesReady === undefined
        ? {}
        : { servicesReady }),
    });

    return {
      completion,
      readiness,
      mediaUsage: collected.mediaUsage,
    };
  }

  /**
   * Build the single server-authoritative completion fact set. Write paths may
   * inject transaction-scoped readers so eligibility, Configuration activity,
   * and Media status are rechecked in the owning transaction.
   */
  public async collectCompletionFacts(
    provider: ProviderRecord,
    providers: ProviderRepositoryPort = this.dependencies.providers,
    readerOverrides: Partial<ProviderProjectionReaders> = {},
  ): Promise<{
    readonly facts: ProviderCompletionFacts;
    readonly mediaUsage: ProviderMediaUsageDto;
  }> {
    const readers: ProviderProjectionReaders = {
      identityReader:
        readerOverrides.identityReader ?? this.dependencies.identityReader,
      applicantProfiles:
        readerOverrides.applicantProfiles ?? this.dependencies.applicantProfiles,
      mediaReader: readerOverrides.mediaReader ?? this.dependencies.mediaReader,
      activeCountries:
        readerOverrides.activeCountries ?? this.dependencies.activeCountries,
    };
    const [profile, contact, gallery, identity, applicant] = await Promise.all([
      providers.getProfile(provider.id),
      providers.getContact(provider.id),
      providers.listGalleryItems(provider.id),
      readers.identityReader.getEligibilityFacts(
        provider.applicationOwnerUserId,
      ),
      readers.applicantProfiles.getMatchingApplicantContext({
        userId: provider.applicationOwnerUserId,
        providerKind: provider.kind,
      }),
    ]);
    const required = requiredCategoryForProviderKind(provider.kind);
    const eligibleCategoryVerified =
      identity?.active === true &&
      identity.verificationOnly === false &&
      identity.verifiedCategories.includes(required);
    const activeCountry =
      profile?.countryId === null || profile?.countryId === undefined
        ? null
        : await readers.activeCountries.getById(profile.countryId);

    const logoReady =
      profile?.logoMediaFileId !== null &&
      profile?.logoMediaFileId !== undefined &&
      (await readers.mediaReader.getMediaStatus(profile.logoMediaFileId))
        ?.status === "READY";
    const coverReady =
      profile?.coverMediaFileId !== null &&
      profile?.coverMediaFileId !== undefined &&
      (await readers.mediaReader.getMediaStatus(profile.coverMediaFileId))
        ?.status === "READY";

    let readyGalleryImageCount = 0;
    let galleryImageCount = 0;
    let galleryVideoCount = 0;
    for (const item of gallery) {
      if (item.kind === "IMAGE") {
        galleryImageCount += 1;
      } else {
        galleryVideoCount += 1;
      }
      const media = await readers.mediaReader.getMediaStatus(item.mediaFileId);
      if (item.kind === "IMAGE" && media?.status === "READY") {
        readyGalleryImageCount += 1;
      }
    }

    return {
      facts: {
        eligibleCategoryVerified,
        matchingCustomerProfileComplete: applicant?.profileComplete ?? false,
        displayNameAr: profile?.displayNameAr,
        descriptionAr: profile?.descriptionAr,
        operationalEmailNormalized: contact?.operationalEmailNormalized,
        operationalPhoneE164: contact?.operationalPhoneE164,
        activeCountryId: activeCountry?.id ?? null,
        logoReady,
        coverReady,
        readyGalleryImageCount,
      },
      mediaUsage: {
        galleryImageCount,
        galleryVideoCount,
        galleryImageLimit: PROVIDER_GALLERY_IMAGE_MAX_COUNT,
        galleryVideoLimit: PROVIDER_GALLERY_VIDEO_MAX_COUNT,
        readyGalleryImageCount,
      },
    };
  }
}

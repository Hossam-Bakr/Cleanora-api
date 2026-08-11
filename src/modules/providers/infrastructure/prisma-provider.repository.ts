import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { providersError } from "../domain/providers.errors.js";
import type {
  AppendStatusHistoryInput,
  CreateGalleryItemInput,
  CreateProviderInput,
  CreateProviderInvitationInput,
  ProviderRepositoryPort,
  UpdateProviderLifecycleInput,
  UpsertProviderContactInput,
  UpsertProviderMemberInput,
  UpsertProviderProfileInput,
} from "../domain/providers.ports.js";
import type {
  ExpectedVersion,
  ProviderAdminInvitationRecord,
  ProviderContactChannel,
  ProviderContactChannelType,
  ProviderContactRecord,
  ProviderGalleryItemRecord,
  ProviderMemberRecord,
  ProviderProfileRecord,
  ProviderRecord,
  ProviderStatusHistoryRecord,
} from "../domain/providers.types.js";
import { PROVIDER_CONTACT_CHANNEL_TYPES } from "../domain/providers.types.js";

type DbClient = Prisma.TransactionClient | PrismaClient;

const PROVIDER_SELECT = {
  id: true,
  applicationOwnerUserId: true,
  ownerUserId: true,
  kind: true,
  applicationStatus: true,
  operationalStatus: true,
  reviewCycle: true,
  version: true,
  firstSubmittedAt: true,
  lastSubmittedAt: true,
  applicationChangedAt: true,
  operationalChangedAt: true,
  approvedAt: true,
  rejectedAt: true,
  suspendedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PROFILE_SELECT = {
  id: true,
  providerId: true,
  displayNameAr: true,
  displayNameEn: true,
  descriptionAr: true,
  descriptionEn: true,
  countryId: true,
  logoMediaFileId: true,
  coverMediaFileId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const CONTACT_SELECT = {
  id: true,
  providerId: true,
  operationalEmailNormalized: true,
  operationalPhoneE164: true,
  channels: true,
  createdAt: true,
  updatedAt: true,
} as const;

const HISTORY_SELECT = {
  id: true,
  providerId: true,
  domain: true,
  fromApplicationStatus: true,
  toApplicationStatus: true,
  fromOperationalStatus: true,
  toOperationalStatus: true,
  reviewCycle: true,
  actorUserId: true,
  reason: true,
  requestId: true,
  createdAt: true,
} as const;

const MEMBER_SELECT = {
  id: true,
  providerId: true,
  userId: true,
  level: true,
  status: true,
  invitedByUserId: true,
  enabledAt: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const INVITATION_SELECT = {
  id: true,
  providerId: true,
  emailNormalized: true,
  tokenVerifier: true,
  tokenVersion: true,
  status: true,
  version: true,
  invitedByUserId: true,
  acceptedByUserId: true,
  expiresAt: true,
  sentAt: true,
  deliveryFailedAt: true,
  lastSafeDeliveryErrorCode: true,
  acceptedAt: true,
  revokedAt: true,
  expiredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

function mapProvider(
  row: Prisma.ProviderGetPayload<{ select: typeof PROVIDER_SELECT }>,
): ProviderRecord {
  return {
    id: row.id,
    applicationOwnerUserId: row.applicationOwnerUserId,
    ownerUserId: row.ownerUserId,
    kind: row.kind,
    applicationStatus: row.applicationStatus,
    operationalStatus: row.operationalStatus,
    reviewCycle: row.reviewCycle,
    version: row.version,
    firstSubmittedAt: row.firstSubmittedAt,
    lastSubmittedAt: row.lastSubmittedAt,
    applicationChangedAt: row.applicationChangedAt,
    operationalChangedAt: row.operationalChangedAt,
    approvedAt: row.approvedAt,
    rejectedAt: row.rejectedAt,
    suspendedAt: row.suspendedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProfile(
  row: Prisma.ProviderProfileGetPayload<{ select: typeof PROFILE_SELECT }>,
): ProviderProfileRecord {
  return { ...row };
}

function isContactChannelType(value: string): value is ProviderContactChannelType {
  return (PROVIDER_CONTACT_CHANNEL_TYPES as readonly string[]).includes(value);
}

function mapChannels(raw: Prisma.JsonValue): readonly ProviderContactChannel[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const channels: ProviderContactChannel[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const typeValue = entry["type"];
    const value = entry["value"];
    if (typeof typeValue !== "string" || typeof value !== "string") {
      continue;
    }
    if (!isContactChannelType(typeValue)) {
      continue;
    }
    channels.push({ type: typeValue, value });
  }
  return channels;
}

function mapContact(
  row: Prisma.ProviderContactGetPayload<{ select: typeof CONTACT_SELECT }>,
): ProviderContactRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    operationalEmailNormalized: row.operationalEmailNormalized,
    operationalPhoneE164: row.operationalPhoneE164,
    channels: mapChannels(row.channels),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapHistory(
  row: Prisma.ProviderStatusHistoryGetPayload<{ select: typeof HISTORY_SELECT }>,
): ProviderStatusHistoryRecord {
  return { ...row };
}

function mapMember(
  row: Prisma.ProviderMemberGetPayload<{ select: typeof MEMBER_SELECT }>,
): ProviderMemberRecord {
  return { ...row };
}

function mapInvitation(
  row: Prisma.ProviderAdminInvitationGetPayload<{
    select: typeof INVITATION_SELECT;
  }>,
): ProviderAdminInvitationRecord {
  return { ...row };
}

function mapGallery(
  row: Prisma.ProviderGalleryItemGetPayload<{ select: typeof GALLERY_SELECT }>,
): ProviderGalleryItemRecord {
  return { ...row };
}

function versionConflict(): never {
  throw providersError("PROVIDER_VERSION_CONFLICT");
}

/**
 * Explicit-select Provider persistence. Maps every row to domain types.
 */
export class PrismaProviderRepository implements ProviderRepositoryPort {
  public constructor(private readonly db: DbClient) {}

  public async findById(providerId: string): Promise<ProviderRecord | null> {
    const row = await this.db.provider.findUnique({
      where: { id: providerId },
      select: PROVIDER_SELECT,
    });
    return row === null ? null : mapProvider(row);
  }

  public async findByApplicationOwnerUserId(
    userId: string,
  ): Promise<ProviderRecord | null> {
    const row = await this.db.provider.findUnique({
      where: { applicationOwnerUserId: userId },
      select: PROVIDER_SELECT,
    });
    return row === null ? null : mapProvider(row);
  }

  public async listVisibleCandidatesForUser(input: {
    readonly userId: string;
    readonly includeMemberships: boolean;
    readonly limit: number;
    readonly cursorUpdatedAt?: Date;
    readonly cursorId?: string;
  }): Promise<readonly ProviderRecord[]> {
    const rows = await this.db.provider.findMany({
      where: {
        AND: [
          {
            OR: [
              { applicationOwnerUserId: input.userId },
              ...(input.includeMemberships
                ? [
                    {
                      members: {
                        some: { userId: input.userId, status: "ACTIVE" as const },
                      },
                    },
                  ]
                : []),
            ],
          },
          ...(input.cursorUpdatedAt === undefined || input.cursorId === undefined
            ? []
            : [
                {
                  OR: [
                    { updatedAt: { lt: input.cursorUpdatedAt } },
                    {
                      updatedAt: input.cursorUpdatedAt,
                      id: { gt: input.cursorId },
                    },
                  ],
                },
              ]),
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.limit,
      select: PROVIDER_SELECT,
    });
    return rows.map(mapProvider);
  }

  public async lockById(providerId: string): Promise<ProviderRecord | null> {
    const locked = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM providers WHERE id = ${providerId} FOR UPDATE
    `;
    if (locked[0] === undefined) {
      return null;
    }
    return this.findById(providerId);
  }

  public async create(input: CreateProviderInput): Promise<ProviderRecord> {
    const created = await this.db.provider.create({
      data: {
        applicationOwnerUserId: input.applicationOwnerUserId,
        kind: input.kind,
        profile: { create: {} },
        contact: { create: { channels: [] } },
      },
      select: PROVIDER_SELECT,
    });
    return mapProvider(created);
  }

  public async updateLifecycle(
    input: UpdateProviderLifecycleInput,
  ): Promise<ProviderRecord> {
    const updated = await this.db.provider.updateMany({
      where: { id: input.providerId, version: input.expectedVersion },
      data: {
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.applicationStatus === undefined
          ? {}
          : { applicationStatus: input.applicationStatus }),
        ...(input.operationalStatus === undefined
          ? {}
          : { operationalStatus: input.operationalStatus }),
        ...(input.ownerUserId === undefined
          ? {}
          : { ownerUserId: input.ownerUserId }),
        ...(input.reviewCycle === undefined
          ? {}
          : { reviewCycle: input.reviewCycle }),
        ...(input.firstSubmittedAt === undefined
          ? {}
          : { firstSubmittedAt: input.firstSubmittedAt }),
        ...(input.lastSubmittedAt === undefined
          ? {}
          : { lastSubmittedAt: input.lastSubmittedAt }),
        ...(input.applicationChangedAt === undefined
          ? {}
          : { applicationChangedAt: input.applicationChangedAt }),
        ...(input.operationalChangedAt === undefined
          ? {}
          : { operationalChangedAt: input.operationalChangedAt }),
        ...(input.approvedAt === undefined
          ? {}
          : { approvedAt: input.approvedAt }),
        ...(input.rejectedAt === undefined
          ? {}
          : { rejectedAt: input.rejectedAt }),
        ...(input.suspendedAt === undefined
          ? {}
          : { suspendedAt: input.suspendedAt }),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      versionConflict();
    }
    const row = await this.findById(input.providerId);
    if (row === null) {
      throw providersError("PROVIDER_NOT_FOUND");
    }
    return row;
  }

  public async bumpVersion(input: {
    readonly providerId: string;
    readonly expectedVersion: ExpectedVersion;
  }): Promise<ProviderRecord> {
    return this.updateLifecycle({
      providerId: input.providerId,
      expectedVersion: input.expectedVersion,
    });
  }

  public async getProfile(
    providerId: string,
  ): Promise<ProviderProfileRecord | null> {
    const row = await this.db.providerProfile.findUnique({
      where: { providerId },
      select: PROFILE_SELECT,
    });
    return row === null ? null : mapProfile(row);
  }

  public async upsertProfile(
    input: UpsertProviderProfileInput,
  ): Promise<ProviderProfileRecord> {
    const row = await this.db.providerProfile.upsert({
      where: { providerId: input.providerId },
      create: {
        providerId: input.providerId,
        displayNameAr: input.displayNameAr,
        displayNameEn: input.displayNameEn,
        descriptionAr: input.descriptionAr,
        descriptionEn: input.descriptionEn,
        countryId: input.countryId,
        logoMediaFileId: input.logoMediaFileId ?? null,
        coverMediaFileId: input.coverMediaFileId ?? null,
      },
      update: {
        displayNameAr: input.displayNameAr,
        displayNameEn: input.displayNameEn,
        descriptionAr: input.descriptionAr,
        descriptionEn: input.descriptionEn,
        countryId: input.countryId,
        ...(input.logoMediaFileId === undefined
          ? {}
          : { logoMediaFileId: input.logoMediaFileId }),
        ...(input.coverMediaFileId === undefined
          ? {}
          : { coverMediaFileId: input.coverMediaFileId }),
      },
      select: PROFILE_SELECT,
    });
    return mapProfile(row);
  }

  public async getContact(
    providerId: string,
  ): Promise<ProviderContactRecord | null> {
    const row = await this.db.providerContact.findUnique({
      where: { providerId },
      select: CONTACT_SELECT,
    });
    return row === null ? null : mapContact(row);
  }

  public async upsertContact(
    input: UpsertProviderContactInput,
  ): Promise<ProviderContactRecord> {
    const channelsJson: Prisma.InputJsonValue = input.channels.map(
      (channel) => ({
        type: channel.type,
        value: channel.value,
      }),
    );
    const row = await this.db.providerContact.upsert({
      where: { providerId: input.providerId },
      create: {
        providerId: input.providerId,
        operationalEmailNormalized: input.operationalEmailNormalized,
        operationalPhoneE164: input.operationalPhoneE164,
        channels: channelsJson,
      },
      update: {
        operationalEmailNormalized: input.operationalEmailNormalized,
        operationalPhoneE164: input.operationalPhoneE164,
        channels: channelsJson,
      },
      select: CONTACT_SELECT,
    });
    return mapContact(row);
  }

  public async appendStatusHistory(
    input: AppendStatusHistoryInput,
  ): Promise<ProviderStatusHistoryRecord> {
    const row = await this.db.providerStatusHistory.create({
      data: {
        providerId: input.providerId,
        domain: input.domain,
        fromApplicationStatus: input.fromApplicationStatus ?? null,
        toApplicationStatus: input.toApplicationStatus ?? null,
        fromOperationalStatus: input.fromOperationalStatus ?? null,
        toOperationalStatus: input.toOperationalStatus ?? null,
        reviewCycle: input.reviewCycle ?? null,
        actorUserId: input.actorUserId,
        reason: input.reason ?? null,
        requestId: input.requestId ?? null,
      },
      select: HISTORY_SELECT,
    });
    return mapHistory(row);
  }

  public async listStatusHistory(input: {
    readonly providerId: string;
    readonly limit: number;
    readonly cursorCreatedAt?: Date;
    readonly cursorId?: string;
  }): Promise<readonly ProviderStatusHistoryRecord[]> {
    const cursorFilter =
      input.cursorCreatedAt !== undefined && input.cursorId !== undefined
        ? {
            OR: [
              { createdAt: { lt: input.cursorCreatedAt } },
              {
                createdAt: input.cursorCreatedAt,
                id: { gt: input.cursorId },
              },
            ],
          }
        : {};

    const rows = await this.db.providerStatusHistory.findMany({
      where: {
        providerId: input.providerId,
        ...cursorFilter,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: input.limit,
      select: HISTORY_SELECT,
    });
    return rows.map(mapHistory);
  }

  public async countPendingInvitations(providerId: string): Promise<number> {
    return this.db.providerAdminInvitation.count({
      where: {
        providerId,
        status: "PENDING",
      },
    });
  }

  public async findMember(input: {
    readonly providerId: string;
    readonly userId: string;
  }): Promise<ProviderMemberRecord | null> {
    const row = await this.db.providerMember.findUnique({
      where: {
        providerId_userId: {
          providerId: input.providerId,
          userId: input.userId,
        },
      },
      select: MEMBER_SELECT,
    });
    return row === null ? null : mapMember(row);
  }

  public async listMembers(
    providerId: string,
  ): Promise<readonly ProviderMemberRecord[]> {
    const rows = await this.db.providerMember.findMany({
      where: { providerId },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }],
      select: MEMBER_SELECT,
    });
    return rows.map(mapMember);
  }

  public async upsertMember(
    input: UpsertProviderMemberInput,
  ): Promise<ProviderMemberRecord> {
    const row = await this.db.providerMember.upsert({
      where: {
        providerId_userId: {
          providerId: input.providerId,
          userId: input.userId,
        },
      },
      create: {
        providerId: input.providerId,
        userId: input.userId,
        level: input.level,
        status: input.status,
        invitedByUserId: input.invitedByUserId,
        enabledAt: input.enabledAt,
        disabledAt: input.disabledAt,
      },
      update: {
        level: input.level,
        status: input.status,
        invitedByUserId: input.invitedByUserId,
        enabledAt: input.enabledAt,
        disabledAt: input.disabledAt,
      },
      select: MEMBER_SELECT,
    });
    return mapMember(row);
  }

  public async findInvitationById(
    invitationId: string,
  ): Promise<ProviderAdminInvitationRecord | null> {
    const row = await this.db.providerAdminInvitation.findUnique({
      where: { id: invitationId },
      select: INVITATION_SELECT,
    });
    return row === null ? null : mapInvitation(row);
  }

  public async findInvitationByTokenVerifier(
    tokenVerifier: string,
  ): Promise<ProviderAdminInvitationRecord | null> {
    const row = await this.db.providerAdminInvitation.findUnique({
      where: { tokenVerifier },
      select: INVITATION_SELECT,
    });
    return row === null ? null : mapInvitation(row);
  }

  public async lockInvitationById(
    invitationId: string,
  ): Promise<ProviderAdminInvitationRecord | null> {
    const locked = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM provider_admin_invitations WHERE id = ${invitationId} FOR UPDATE
    `;
    if (locked[0] === undefined) {
      return null;
    }
    return this.findInvitationById(invitationId);
  }

  public async listInvitations(input: {
    readonly providerId: string;
    readonly status?: ProviderAdminInvitationRecord["status"];
    readonly limit: number;
    readonly cursorCreatedAt?: Date;
    readonly cursorId?: string;
  }): Promise<readonly ProviderAdminInvitationRecord[]> {
    const rows = await this.db.providerAdminInvitation.findMany({
      where: {
        providerId: input.providerId,
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.cursorCreatedAt === undefined || input.cursorId === undefined
          ? {}
          : {
              OR: [
                { createdAt: { lt: input.cursorCreatedAt } },
                {
                  createdAt: input.cursorCreatedAt,
                  id: { lt: input.cursorId },
                },
              ],
            }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
      select: INVITATION_SELECT,
    });
    return rows.map(mapInvitation);
  }

  public async findPendingInvitationByEmail(input: {
    readonly providerId: string;
    readonly emailNormalized: string;
  }): Promise<ProviderAdminInvitationRecord | null> {
    const row = await this.db.providerAdminInvitation.findFirst({
      where: {
        providerId: input.providerId,
        emailNormalized: input.emailNormalized,
        status: "PENDING",
      },
      select: INVITATION_SELECT,
    });
    return row === null ? null : mapInvitation(row);
  }

  public async createInvitation(
    input: CreateProviderInvitationInput,
  ): Promise<ProviderAdminInvitationRecord> {
    const row = await this.db.providerAdminInvitation.create({
      data: {
        providerId: input.providerId,
        emailNormalized: input.emailNormalized,
        tokenVerifier: input.tokenVerifier,
        tokenVersion: input.tokenVersion,
        invitedByUserId: input.invitedByUserId,
        expiresAt: input.expiresAt,
        version: input.version ?? 1,
      },
      select: INVITATION_SELECT,
    });
    return mapInvitation(row);
  }

  public async updateInvitation(input: {
    readonly invitationId: string;
    readonly expectedVersion: ExpectedVersion;
    readonly status?: ProviderAdminInvitationRecord["status"];
    readonly tokenVerifier?: string;
    readonly tokenVersion?: number;
    readonly expiresAt?: Date;
    readonly sentAt?: Date | null;
    readonly deliveryFailedAt?: Date | null;
    readonly lastSafeDeliveryErrorCode?: string | null;
    readonly acceptedByUserId?: string | null;
    readonly acceptedAt?: Date | null;
    readonly revokedAt?: Date | null;
    readonly expiredAt?: Date | null;
  }): Promise<ProviderAdminInvitationRecord> {
    const updated = await this.db.providerAdminInvitation.updateMany({
      where: { id: input.invitationId, version: input.expectedVersion },
      data: {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.tokenVerifier === undefined
          ? {}
          : { tokenVerifier: input.tokenVerifier }),
        ...(input.tokenVersion === undefined
          ? {}
          : { tokenVersion: input.tokenVersion }),
        ...(input.expiresAt === undefined
          ? {}
          : { expiresAt: input.expiresAt }),
        ...(input.sentAt === undefined ? {} : { sentAt: input.sentAt }),
        ...(input.deliveryFailedAt === undefined
          ? {}
          : { deliveryFailedAt: input.deliveryFailedAt }),
        ...(input.lastSafeDeliveryErrorCode === undefined
          ? {}
          : { lastSafeDeliveryErrorCode: input.lastSafeDeliveryErrorCode }),
        ...(input.acceptedByUserId === undefined
          ? {}
          : { acceptedByUserId: input.acceptedByUserId }),
        ...(input.acceptedAt === undefined
          ? {}
          : { acceptedAt: input.acceptedAt }),
        ...(input.revokedAt === undefined
          ? {}
          : { revokedAt: input.revokedAt }),
        ...(input.expiredAt === undefined
          ? {}
          : { expiredAt: input.expiredAt }),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      versionConflict();
    }
    const row = await this.findInvitationById(input.invitationId);
    if (row === null) {
      throw providersError("PROVIDER_INVITATION_INVALID");
    }
    return row;
  }

  public async countActiveAuthorityMemberships(
    userId: string,
  ): Promise<number> {
    return this.db.providerMember.count({
      where: {
        userId,
        status: "ACTIVE",
        level: { in: ["OWNER", "ADMIN"] },
      },
    });
  }

  public async lockAuthorityReconciliationForUser(userId: string): Promise<void> {
    await this.db.$queryRaw`
      SELECT 1 AS locked
      FROM pg_advisory_xact_lock(hashtextextended(${userId}, 70505))
    `;
  }

  public async listGalleryItems(
    providerId: string,
  ): Promise<readonly ProviderGalleryItemRecord[]> {
    const rows = await this.db.providerGalleryItem.findMany({
      where: { providerId },
      orderBy: { position: "asc" },
      select: GALLERY_SELECT,
    });
    return rows.map(mapGallery);
  }

  public async createGalleryItem(
    input: CreateGalleryItemInput,
  ): Promise<ProviderGalleryItemRecord> {
    const row = await this.db.providerGalleryItem.create({
      data: {
        providerId: input.providerId,
        mediaFileId: input.mediaFileId,
        kind: input.kind,
        position: input.position,
        createdByUserId: input.createdByUserId,
      },
      select: GALLERY_SELECT,
    });
    return mapGallery(row);
  }

  public async deleteGalleryItem(input: {
    readonly providerId: string;
    readonly galleryItemId: string;
  }): Promise<void> {
    await this.db.providerGalleryItem.deleteMany({
      where: { id: input.galleryItemId, providerId: input.providerId },
    });
  }

  public async replaceGalleryPositions(input: {
    readonly providerId: string;
    readonly orderedGalleryItemIds: readonly string[];
  }): Promise<readonly ProviderGalleryItemRecord[]> {
    const existing = await this.listGalleryItems(input.providerId);
    if (existing.length !== input.orderedGalleryItemIds.length) {
      throw providersError("VALIDATION_ERROR", {
        field: "orderedGalleryItemIds",
      });
    }
    const existingIds = new Set(existing.map((item) => item.id));
    for (const id of input.orderedGalleryItemIds) {
      if (!existingIds.has(id)) {
        throw providersError("VALIDATION_ERROR", {
          field: "orderedGalleryItemIds",
        });
      }
    }

    // Two-phase rewrite avoids unique (provider_id, position) collisions while
    // respecting provider_gallery_items_position_check (position >= 0).
    const offset = 1_000_000;
    for (const [index, item] of existing.entries()) {
      await this.db.providerGalleryItem.update({
        where: { id: item.id },
        data: { position: offset + index },
      });
    }
    for (const [index, galleryItemId] of input.orderedGalleryItemIds.entries()) {
      await this.db.providerGalleryItem.update({
        where: { id: galleryItemId },
        data: { position: index },
      });
    }
    return this.listGalleryItems(input.providerId);
  }
}

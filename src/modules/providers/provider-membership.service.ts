import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import {
  canDisableAdminMembership,
  canManageProviderInvitations,
  canManageProviderMembers,
  resolveActorRelationship,
  type ProviderAuthorizationFacts,
} from "./domain/provider-authorization.policy.js";
import {
  generateInvitationRawToken,
  hashInvitationToken,
  invitationExpiresAt,
  normalizeInvitationEmail,
  shouldEnableProviderAdminRole,
  shouldMaterializeExpired,
} from "./domain/provider-invitation.policy.js";
import { assertExpectedVersion } from "./domain/provider-lifecycle.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderInvitationEmailDeliveryPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type {
  ProviderAdminInvitationRecord,
  ProviderInvitationStatus,
  ProviderRecord,
} from "./domain/providers.types.js";
import {
  mapInvitationSafeDto,
  mapMemberDto,
  type ProviderInvitationSafeDto,
  type ProviderMemberDto,
} from "./provider-invitation.dto.js";
import { ProviderInvitationDeliveryService } from "./provider-invitation-delivery.service.js";

export interface ProviderMembershipServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly providers: ProviderRepositoryPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly invitationEmail: ProviderInvitationEmailDeliveryPort;
  readonly invitationTokenSecret: string;
  readonly invitationTokenBytes: number;
  readonly invitationTtlHours: number;
  readonly now?: () => Date;
}

export class ProviderMembershipService {
  private readonly delivery: ProviderInvitationDeliveryService;

  public constructor(
    private readonly dependencies: ProviderMembershipServiceDependencies,
  ) {
    this.delivery = new ProviderInvitationDeliveryService({
      unitOfWork: dependencies.unitOfWork,
      invitationEmail: dependencies.invitationEmail,
      ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
    });
  }

  public async listMembers(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly requestId?: string;
  }): Promise<readonly ProviderMemberDto[]> {
    const { provider, facts } = await this.loadOwnerScope(input);
    if (!canManageProviderMembers(facts)) {
      await this.deny(input, "providers.members.list", provider.id);
      this.throwScopedDenial(facts);
    }
    const members = await this.dependencies.providers.listMembers(provider.id);
    return Promise.all(
      members.map(async (member) =>
        mapMemberDto({
          member,
          emailNormalized:
            await this.dependencies.identityReader.getAuthoritativeEmail(
              member.userId,
            ),
        }),
      ),
    );
  }

  public async disableAdminMember(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly targetUserId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderMemberDto> {
    assertExpectedVersion(input.expectedVersion);
    const { provider, facts } = await this.loadOwnerScope(input);
    if (!canManageProviderMembers(facts)) {
      await this.deny(input, "providers.members.disable", provider.id);
      this.throwScopedDenial(facts);
    }

    const updated = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(provider.id);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }
      const currentFacts = await this.buildAuthorizationFacts({
        provider: locked,
        principal: input.principal,
        providers: context.providers,
        identityReader: context.identityReader,
      });
      if (!canManageProviderMembers(currentFacts)) {
        this.throwScopedDenial(currentFacts);
      }
      const member = await context.providers.findMember({
        providerId: locked.id,
        userId: input.targetUserId,
      });
      if (member === null) {
        throw providersError("PROVIDER_MEMBER_NOT_FOUND");
      }
      if (
        !canDisableAdminMembership({
          actorIsApprovedOwner: canManageProviderMembers(currentFacts),
          targetLevel: member.level,
          targetUserId: member.userId,
          actorUserId: input.principal.userId,
        })
      ) {
        throw providersError("PROVIDER_ACCESS_DENIED");
      }
      if (member.status === "DISABLED") {
        await context.providers.bumpVersion({
          providerId: locked.id,
          expectedVersion: locked.version,
        });
        return member;
      }

      await context.providers.lockAuthorityReconciliationForUser(member.userId);
      const now = this.now();
      const disabled = await context.providers.upsertMember({
        providerId: locked.id,
        userId: member.userId,
        level: "ADMIN",
        status: "DISABLED",
        invitedByUserId: member.invitedByUserId,
        enabledAt: member.enabledAt,
        disabledAt: now,
      });
      await context.providers.bumpVersion({
        providerId: locked.id,
        expectedVersion: locked.version,
      });

      const remaining =
        await context.providers.countActiveAuthorityMemberships(member.userId);
      await context.identityAuthority.reconcileProviderAdminRole({
        userId: member.userId,
        shouldBeEnabled: shouldEnableProviderAdminRole(remaining),
      });
      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.members.disable",
        targetType: "PROVIDER_MEMBER",
        targetId: disabled.id,
        context: {
          outcome: "SUCCEEDED",
          providerId: locked.id,
          targetUserId: member.userId,
          remainingActiveAuthority: remaining,
        },
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
      return disabled;
    });

    return mapMemberDto({
      member: updated,
      emailNormalized:
        await this.dependencies.identityReader.getAuthoritativeEmail(
          updated.userId,
        ),
    });
  }

  public async listInvitations(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly status?: ProviderInvitationStatus;
    readonly cursor?: string;
    readonly limit?: number;
    readonly requestId?: string;
  }): Promise<{
    readonly items: readonly ProviderInvitationSafeDto[];
    readonly nextCursor: string | null;
  }> {
    const { provider, facts } = await this.loadOwnerScope(input);
    if (!canManageProviderInvitations(facts)) {
      await this.deny(input, "providers.invitations.list", provider.id);
      this.throwScopedDenial(facts);
    }
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const cursor = decodeInvitationCursor(input.cursor);
    const rows = await this.dependencies.providers.listInvitations({
      providerId: provider.id,
      ...(input.status === undefined ? {} : { status: input.status }),
      limit: limit + 1,
      ...(cursor === null
        ? {}
        : { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id }),
    });
    const page = rows.slice(0, limit);
    const next =
      rows.length > limit
        ? encodeInvitationCursor(page[page.length - 1]!)
        : null;
    return {
      items: page.map(mapInvitationSafeDto),
      nextCursor: next,
    };
  }

  public async createInvitation(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly email: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<{
    readonly invitation: ProviderInvitationSafeDto;
    readonly deliveryState: "DELIVERED" | "RESEND_REQUIRED";
  }> {
    assertExpectedVersion(input.expectedVersion);
    const emailNormalized = normalizeInvitationEmail(input.email);
    const { provider, facts } = await this.loadOwnerScope(input);
    if (!canManageProviderInvitations(facts)) {
      await this.deny(input, "providers.invitations.create", provider.id);
      this.throwScopedDenial(facts);
    }

    const existingMemberUser =
      await this.dependencies.identityReader.findByEmailNormalized(
        emailNormalized,
      );
    if (existingMemberUser !== null) {
      const membership = await this.dependencies.providers.findMember({
        providerId: provider.id,
        userId: existingMemberUser.userId,
      });
      if (membership?.status === "ACTIVE") {
        throw providersError("PROVIDER_INVITATION_CONFLICT", {
          reason: "ACTIVE_MEMBERSHIP_EXISTS",
        });
      }
    }

    const pending = await this.dependencies.providers.findPendingInvitationByEmail(
      {
        providerId: provider.id,
        emailNormalized,
      },
    );
    if (pending !== null) {
      if (shouldMaterializeExpired(pending, this.now())) {
        await this.dependencies.unitOfWork.run(async (context) => {
          const lockedProvider = await context.providers.lockById(provider.id);
          if (lockedProvider === null) {
            throw providersError("PROVIDER_NOT_FOUND");
          }
          const currentFacts = await this.buildAuthorizationFacts({
            provider: lockedProvider,
            principal: input.principal,
            providers: context.providers,
            identityReader: context.identityReader,
          });
          if (!canManageProviderInvitations(currentFacts)) {
            this.throwScopedDenial(currentFacts);
          }
          const lockedPending = await context.providers.lockInvitationById(
            pending.id,
          );
          if (
            lockedPending === null ||
            lockedPending.providerId !== lockedProvider.id ||
            lockedPending.status !== "PENDING"
          ) {
            throw providersError("PROVIDER_INVITATION_CONFLICT");
          }
          if (!shouldMaterializeExpired(lockedPending, this.now())) {
            throw providersError("PROVIDER_INVITATION_CONFLICT", {
              reason: "PENDING_INVITATION_EXISTS",
            });
          }
          await context.providers.updateInvitation({
            invitationId: lockedPending.id,
            expectedVersion: lockedPending.version,
            status: "EXPIRED",
            expiredAt: this.now(),
          });
        });
      } else if (pending.expiresAt > this.now()) {
        throw providersError("PROVIDER_INVITATION_CONFLICT", {
          reason: "PENDING_INVITATION_EXISTS",
        });
      }
    }

    const rawToken = generateInvitationRawToken(
      this.dependencies.invitationTokenBytes,
    );
    const tokenVerifier = hashInvitationToken(
      this.dependencies.invitationTokenSecret,
      rawToken,
    );
    const expiresAt = invitationExpiresAt(
      this.now(),
      this.dependencies.invitationTtlHours,
    );

    const created = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(provider.id);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      if (locked.applicationStatus !== "APPROVED") {
        throw providersError("PROVIDER_STATE_CONFLICT");
      }
      const currentFacts = await this.buildAuthorizationFacts({
        provider: locked,
        principal: input.principal,
        providers: context.providers,
        identityReader: context.identityReader,
      });
      if (!canManageProviderInvitations(currentFacts)) {
        this.throwScopedDenial(currentFacts);
      }
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }
      const invitation = await context.providers.createInvitation({
        providerId: locked.id,
        emailNormalized,
        tokenVerifier,
        tokenVersion: 1,
        invitedByUserId: input.principal.userId,
        expiresAt,
      });
      await context.providers.bumpVersion({
        providerId: locked.id,
        expectedVersion: locked.version,
      });
      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.invitations.create",
        targetType: "PROVIDER_ADMIN_INVITATION",
        targetId: invitation.id,
        context: {
          outcome: "SUCCEEDED",
          providerId: locked.id,
          verifierGeneration: invitation.tokenVersion,
        },
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
      return invitation;
    });

    const delivered = await this.delivery.deliverAfterCommit({
      invitation: created,
      rawToken,
    });
    return {
      invitation: mapInvitationSafeDto(delivered.invitation),
      deliveryState: delivered.deliveryState,
    };
  }

  public async resendInvitation(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly invitationId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<{
    readonly invitation: ProviderInvitationSafeDto;
    readonly deliveryState: "DELIVERED" | "RESEND_REQUIRED";
  }> {
    assertExpectedVersion(input.expectedVersion);
    const { provider, facts } = await this.loadOwnerScope(input);
    if (!canManageProviderInvitations(facts)) {
      await this.deny(input, "providers.invitations.resend", provider.id);
      this.throwScopedDenial(facts);
    }

    const rawToken = generateInvitationRawToken(
      this.dependencies.invitationTokenBytes,
    );
    const tokenVerifier = hashInvitationToken(
      this.dependencies.invitationTokenSecret,
      rawToken,
    );
    const expiresAt = invitationExpiresAt(
      this.now(),
      this.dependencies.invitationTtlHours,
    );

    const rotated = await this.dependencies.unitOfWork.run(async (context) => {
      const lockedProvider = await context.providers.lockById(provider.id);
      if (lockedProvider === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      if (lockedProvider.applicationStatus !== "APPROVED") {
        throw providersError("PROVIDER_STATE_CONFLICT");
      }
      const currentFacts = await this.buildAuthorizationFacts({
        provider: lockedProvider,
        principal: input.principal,
        providers: context.providers,
        identityReader: context.identityReader,
      });
      if (!canManageProviderInvitations(currentFacts)) {
        this.throwScopedDenial(currentFacts);
      }
      const locked = await context.providers.lockInvitationById(
        input.invitationId,
      );
      if (locked === null || locked.providerId !== provider.id) {
        throw providersError("PROVIDER_INVITATION_INVALID");
      }
      if (locked.status !== "PENDING") {
        throw providersError("PROVIDER_INVITATION_CONFLICT");
      }
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }
      const invitation = await context.providers.updateInvitation({
        invitationId: locked.id,
        expectedVersion: locked.version,
        tokenVerifier,
        tokenVersion: locked.tokenVersion + 1,
        expiresAt,
        sentAt: null,
        deliveryFailedAt: null,
        lastSafeDeliveryErrorCode: null,
      });
      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.invitations.resend",
        targetType: "PROVIDER_ADMIN_INVITATION",
        targetId: invitation.id,
        context: {
          outcome: "SUCCEEDED",
          providerId: provider.id,
          verifierGeneration: invitation.tokenVersion,
        },
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
      return invitation;
    });

    const delivered = await this.delivery.deliverAfterCommit({
      invitation: rotated,
      rawToken,
    });
    return {
      invitation: mapInvitationSafeDto(delivered.invitation),
      deliveryState: delivered.deliveryState,
    };
  }

  public async revokeInvitation(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly invitationId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderInvitationSafeDto> {
    assertExpectedVersion(input.expectedVersion);
    const { provider, facts } = await this.loadOwnerScope(input);
    if (!canManageProviderInvitations(facts)) {
      await this.deny(input, "providers.invitations.revoke", provider.id);
      this.throwScopedDenial(facts);
    }

    const revoked = await this.dependencies.unitOfWork.run(async (context) => {
      const lockedProvider = await context.providers.lockById(provider.id);
      if (lockedProvider === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      const currentFacts = await this.buildAuthorizationFacts({
        provider: lockedProvider,
        principal: input.principal,
        providers: context.providers,
        identityReader: context.identityReader,
      });
      if (!canManageProviderInvitations(currentFacts)) {
        this.throwScopedDenial(currentFacts);
      }
      const locked = await context.providers.lockInvitationById(
        input.invitationId,
      );
      if (locked === null || locked.providerId !== provider.id) {
        throw providersError("PROVIDER_INVITATION_INVALID");
      }
      if (locked.status === "REVOKED") {
        return locked;
      }
      if (locked.status !== "PENDING") {
        throw providersError("PROVIDER_INVITATION_CONFLICT");
      }
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }
      const invitation = await context.providers.updateInvitation({
        invitationId: locked.id,
        expectedVersion: locked.version,
        status: "REVOKED",
        revokedAt: this.now(),
      });
      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.invitations.revoke",
        targetType: "PROVIDER_ADMIN_INVITATION",
        targetId: invitation.id,
        context: { outcome: "SUCCEEDED", providerId: provider.id },
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
      return invitation;
    });

    return mapInvitationSafeDto(revoked);
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async loadOwnerScope(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
  }): Promise<{
    readonly provider: ProviderRecord;
    readonly facts: ProviderAuthorizationFacts;
  }> {
    const provider = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (provider === null) {
      throw providersError("PROVIDER_NOT_FOUND");
    }
    const facts = await this.buildAuthorizationFacts({
      provider,
      principal: input.principal,
      providers: this.dependencies.providers,
      identityReader: this.dependencies.identityReader,
    });
    return { provider, facts };
  }

  private async buildAuthorizationFacts(input: {
    readonly provider: ProviderRecord;
    readonly principal: AuthenticationPrincipal;
    readonly providers: ProviderRepositoryPort;
    readonly identityReader: ProviderIdentityReaderPort;
  }): Promise<ProviderAuthorizationFacts> {
    const [identity, membership] = await Promise.all([
      input.identityReader.getEligibilityFacts(input.principal.userId),
      input.providers.findMember({
        providerId: input.provider.id,
        userId: input.principal.userId,
      }),
    ]);
    return {
      actorUserId: input.principal.userId,
      actorActive: identity?.active === true,
      applicationOwnerUserId: input.provider.applicationOwnerUserId,
      membership:
        membership === null
          ? null
          : { level: membership.level, status: membership.status },
      staffAdmin: false,
      providerAdminEnabled: identity?.providerAdminEnabled === true,
      applicationStatus: input.provider.applicationStatus,
      operationalStatus: input.provider.operationalStatus,
    };
  }

  private throwScopedDenial(facts: ProviderAuthorizationFacts): never {
    if (resolveActorRelationship(facts) === "NONE") {
      throw providersError("PROVIDER_NOT_FOUND");
    }
    throw providersError("PROVIDER_ACCESS_DENIED");
  }

  private async deny(
    input: {
      readonly principal: AuthenticationPrincipal;
      readonly providerId: string;
      readonly requestId?: string;
    },
    action: string,
    targetId: string,
  ): Promise<void> {
    await this.dependencies.denialAudit.append({
      actorType: "USER",
      actorId: input.principal.userId,
      action,
      targetType: "PROVIDER",
      targetId,
      outcome: "DENIED",
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    });
  }
}

function encodeInvitationCursor(
  invitation: ProviderAdminInvitationRecord,
): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: invitation.createdAt.toISOString(),
      id: invitation.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeInvitationCursor(
  cursor: string | undefined,
): { readonly createdAt: Date; readonly id: string } | null {
  if (cursor === undefined || cursor.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { createdAt?: string; id?: string };
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw providersError("VALIDATION_ERROR", { field: "cursor" });
    }
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error;
    }
    throw providersError("VALIDATION_ERROR", { field: "cursor" });
  }
}

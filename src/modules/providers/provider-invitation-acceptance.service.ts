import type {
  AuthenticationPrincipal,
  ProviderInvitationIdentityOnboarding,
} from "../authentication/authentication.public.js";
import {
  assertInvitationAcceptable,
  assertInvitationTokenMatches,
  hashInvitationToken,
  resolveInspectNextAction,
  shouldEnableProviderAdminRole,
  shouldMaterializeExpired,
} from "./domain/provider-invitation.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type { ProviderAdminInvitationRecord } from "./domain/providers.types.js";
import {
  mapInvitationAcceptDto,
  mapInvitationInspectDto,
  type ProviderInvitationAcceptDto,
  type ProviderInvitationInspectDto,
} from "./provider-invitation.dto.js";

export interface ProviderInvitationAcceptanceServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly providers: ProviderRepositoryPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly invitationTokenSecret: string;
  readonly invitationOnboarding?: ProviderInvitationIdentityOnboarding;
  readonly now?: () => Date;
}

/**
 * Token inspect and atomic invitation acceptance with role reconciliation.
 */
export class ProviderInvitationAcceptanceService {
  public constructor(
    private readonly dependencies: ProviderInvitationAcceptanceServiceDependencies,
  ) {}

  public async inspect(input: {
    readonly token: string;
  }): Promise<ProviderInvitationInspectDto> {
    const invitation = await this.resolveInvitationFromToken(input.token);
    const provider = await this.dependencies.providers.findById(
      invitation.providerId,
    );
    if (provider?.applicationStatus !== "APPROVED") {
      throw providersError("PROVIDER_INVITATION_INVALID");
    }
    const profile = await this.dependencies.providers.getProfile(provider.id);
    const existing =
      await this.dependencies.identityReader.findByEmailNormalized(
        invitation.emailNormalized,
      );
    return mapInvitationInspectDto({
      providerId: provider.id,
      displayNameAr: profile?.displayNameAr ?? null,
      displayNameEn: profile?.displayNameEn ?? null,
      invitation,
      nextAction: resolveInspectNextAction({
        invitation,
        now: this.now(),
        existingUser:
          existing === null
            ? null
            : { emailVerified: existing.emailVerified },
      }),
    });
  }

  public async accept(input: {
    readonly principal: AuthenticationPrincipal;
    readonly token: string;
    readonly requestId?: string;
  }): Promise<ProviderInvitationAcceptDto> {
    const tokenVerifier = hashInvitationToken(
      this.dependencies.invitationTokenSecret,
      input.token,
    );
    const existing = await this.dependencies.providers.findInvitationByTokenVerifier(
      tokenVerifier,
    );
    if (existing === null) {
      throw providersError("PROVIDER_INVITATION_INVALID");
    }

    if (
      existing.status === "ACCEPTED" &&
      existing.acceptedByUserId === input.principal.userId &&
      existing.acceptedAt !== null
    ) {
      return mapInvitationAcceptDto({
        providerId: existing.providerId,
        acceptedAt: existing.acceptedAt,
      });
    }

    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      input.principal.userId,
    );
    if (
      identity?.accountActive !== true ||
      identity?.emailNormalized == null ||
      !identity.emailVerified ||
      identity.emailNormalized !== existing.emailNormalized
    ) {
      await this.dependencies.denialAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.invitations.accept",
        targetType: "PROVIDER_ADMIN_INVITATION",
        targetId: existing.id,
        outcome: "DENIED",
        reason: "EMAIL_MISMATCH",
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
      throw providersError("PROVIDER_INVITATION_EMAIL_MISMATCH");
    }

    let accepted: ProviderAdminInvitationRecord;
    try {
      accepted = await this.dependencies.unitOfWork.run(async (context) => {
      const lockedProvider = await context.providers.lockById(
        existing.providerId,
      );
      if (lockedProvider?.applicationStatus !== "APPROVED") {
        throw providersError("PROVIDER_INVITATION_INVALID");
      }
      const locked = await context.providers.lockInvitationById(existing.id);
      if (locked === null) {
        throw providersError("PROVIDER_INVITATION_INVALID");
      }

      if (
        locked.status === "ACCEPTED" &&
        locked.acceptedByUserId === input.principal.userId &&
        locked.acceptedAt !== null
      ) {
        return locked;
      }

      if (shouldMaterializeExpired(locked, this.now())) {
        await context.providers.updateInvitation({
          invitationId: locked.id,
          expectedVersion: locked.version,
          status: "EXPIRED",
          expiredAt: this.now(),
        });
        throw providersError("PROVIDER_INVITATION_INVALID");
      }

      assertInvitationAcceptable(locked, this.now());
      assertInvitationTokenMatches(locked, tokenVerifier);

      const currentIdentity = await context.identityReader.getEligibilityFacts(
        input.principal.userId,
      );
      if (
        currentIdentity?.accountActive !== true ||
        currentIdentity.emailNormalized == null ||
        !currentIdentity.emailVerified ||
        currentIdentity.emailNormalized !== locked.emailNormalized
      ) {
        throw providersError("PROVIDER_INVITATION_EMAIL_MISMATCH");
      }

      await context.providers.lockAuthorityReconciliationForUser(
        input.principal.userId,
      );

      const priorMember = await context.providers.findMember({
        providerId: locked.providerId,
        userId: input.principal.userId,
      });
      if (priorMember?.level === "OWNER" && priorMember.status === "ACTIVE") {
        throw providersError("PROVIDER_INVITATION_CONFLICT", {
          reason: "OWNER_CANNOT_ACCEPT_ADMIN",
        });
      }

      const now = this.now();
      const invitation = await context.providers.updateInvitation({
        invitationId: locked.id,
        expectedVersion: locked.version,
        status: "ACCEPTED",
        acceptedByUserId: input.principal.userId,
        acceptedAt: now,
      });

      await context.providers.upsertMember({
        providerId: locked.providerId,
        userId: input.principal.userId,
        level: "ADMIN",
        status: "ACTIVE",
        invitedByUserId: locked.invitedByUserId,
        enabledAt: now,
        disabledAt: null,
      });

      const remaining =
        await context.providers.countActiveAuthorityMemberships(
          input.principal.userId,
        );
      await context.identityAuthority.reconcileProviderAdminRole({
        userId: input.principal.userId,
        shouldBeEnabled: shouldEnableProviderAdminRole(remaining),
      });

      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.invitations.accept",
        targetType: "PROVIDER_ADMIN_INVITATION",
        targetId: invitation.id,
        context: {
          outcome: "SUCCEEDED",
          providerId: locked.providerId,
          membershipLevel: "ADMIN",
        },
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });

        return invitation;
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "PROVIDER_INVITATION_EMAIL_MISMATCH"
      ) {
        await this.dependencies.denialAudit.append({
          actorType: "USER",
          actorId: input.principal.userId,
          action: "providers.invitations.accept",
          targetType: "PROVIDER_ADMIN_INVITATION",
          targetId: existing.id,
          outcome: "DENIED",
          reason: "CURRENT_IDENTITY_PROOF_INVALID",
          ...(input.requestId === undefined
            ? {}
            : { requestId: input.requestId }),
        });
      }
      throw error;
    }

    return mapInvitationAcceptDto({
      providerId: accepted.providerId,
      acceptedAt: accepted.acceptedAt ?? this.now(),
    });
  }

  public async resolveInvitationFromToken(
    rawToken: string,
  ): Promise<ProviderAdminInvitationRecord> {
    if (rawToken.trim().length < 32) {
      throw providersError("PROVIDER_INVITATION_INVALID");
    }
    const tokenVerifier = hashInvitationToken(
      this.dependencies.invitationTokenSecret,
      rawToken,
    );
    const invitation =
      await this.dependencies.providers.findInvitationByTokenVerifier(
        tokenVerifier,
      );
    if (invitation === null) {
      throw providersError("PROVIDER_INVITATION_INVALID");
    }
    if (shouldMaterializeExpired(invitation, this.now())) {
      await this.dependencies.unitOfWork.run(async (context) => {
        await context.providers.updateInvitation({
          invitationId: invitation.id,
          expectedVersion: invitation.version,
          status: "EXPIRED",
          expiredAt: this.now(),
        });
      });
      throw providersError("PROVIDER_INVITATION_INVALID");
    }
    assertInvitationAcceptable(invitation, this.now());
    return invitation;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}

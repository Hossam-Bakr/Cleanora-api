import type {
  InvitationDeliveryState,
  InvitationInspectNextAction,
} from "./domain/provider-invitation.policy.js";
import {
  invitationDeliveryStateFromRecord,
  maskInvitationEmail,
} from "./domain/provider-invitation.policy.js";
import type {
  ProviderAdminInvitationRecord,
  ProviderInvitationStatus,
  ProviderMemberRecord,
  ProviderMembershipLevel,
  ProviderMembershipStatus,
} from "./domain/providers.types.js";
import { toIso } from "./provider.dto.js";

export interface ProviderMemberDto {
  readonly userId: string;
  readonly level: ProviderMembershipLevel;
  readonly status: ProviderMembershipStatus;
  readonly emailNormalized: string | null;
  readonly enabledAt: string;
  readonly disabledAt: string | null;
}

export interface ProviderInvitationSafeDto {
  readonly id: string;
  readonly emailMasked: string;
  readonly status: ProviderInvitationStatus;
  readonly version: number;
  readonly tokenVersion: number;
  readonly expiresAt: string;
  readonly deliveryState: InvitationDeliveryState | null;
  readonly invitedByUserId: string;
  readonly acceptedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProviderInvitationInspectDto {
  readonly providerId: string;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
  readonly emailMasked: string;
  readonly status: ProviderInvitationStatus;
  readonly expiresAt: string;
  readonly nextAction: InvitationInspectNextAction;
}

export interface ProviderInvitationAcceptDto {
  readonly providerId: string;
  readonly membershipLevel: "ADMIN";
  readonly membershipStatus: "ACTIVE";
  readonly invitationStatus: "ACCEPTED";
  readonly acceptedAt: string;
}

export function mapMemberDto(input: {
  readonly member: ProviderMemberRecord;
  readonly emailNormalized: string | null;
}): ProviderMemberDto {
  return {
    userId: input.member.userId,
    level: input.member.level,
    status: input.member.status,
    emailNormalized: input.emailNormalized,
    enabledAt: toIso(input.member.enabledAt),
    disabledAt:
      input.member.disabledAt === null ? null : toIso(input.member.disabledAt),
  };
}

export function mapInvitationSafeDto(
  invitation: ProviderAdminInvitationRecord,
): ProviderInvitationSafeDto {
  return {
    id: invitation.id,
    emailMasked: maskInvitationEmail(invitation.emailNormalized),
    status: invitation.status,
    version: invitation.version,
    tokenVersion: invitation.tokenVersion,
    expiresAt: toIso(invitation.expiresAt),
    deliveryState: invitationDeliveryStateFromRecord(invitation),
    invitedByUserId: invitation.invitedByUserId,
    acceptedByUserId: invitation.acceptedByUserId,
    createdAt: toIso(invitation.createdAt),
    updatedAt: toIso(invitation.updatedAt),
  };
}

export function mapInvitationInspectDto(input: {
  readonly providerId: string;
  readonly displayNameAr: string | null;
  readonly displayNameEn: string | null;
  readonly invitation: ProviderAdminInvitationRecord;
  readonly nextAction: InvitationInspectNextAction;
}): ProviderInvitationInspectDto {
  return {
    providerId: input.providerId,
    displayNameAr: input.displayNameAr,
    displayNameEn: input.displayNameEn,
    emailMasked: maskInvitationEmail(input.invitation.emailNormalized),
    status: input.invitation.status,
    expiresAt: toIso(input.invitation.expiresAt),
    nextAction: input.nextAction,
  };
}

export function mapInvitationAcceptDto(input: {
  readonly providerId: string;
  readonly acceptedAt: Date;
}): ProviderInvitationAcceptDto {
  return {
    providerId: input.providerId,
    membershipLevel: "ADMIN",
    membershipStatus: "ACTIVE",
    invitationStatus: "ACCEPTED",
    acceptedAt: toIso(input.acceptedAt),
  };
}

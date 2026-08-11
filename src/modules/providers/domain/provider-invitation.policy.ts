import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { providersError } from "./providers.errors.js";
import type {
  ProviderAdminInvitationRecord,
  ProviderInvitationStatus,
} from "./providers.types.js";

export function normalizeInvitationEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)
  ) {
    throw providersError("VALIDATION_ERROR", { field: "email" });
  }
  return normalized;
}

/** Exact invitation lifetime from latest create/resend (FR-055). */
export const PROVIDER_INVITATION_TTL_HOURS = 72;

export type InvitationDeliveryState = "DELIVERED" | "RESEND_REQUIRED";

export type InvitationInspectNextAction =
  | "ACCEPT_EXISTING"
  | "START_ONBOARDING"
  | "NONE";

/**
 * Generate a raw invitation token. The raw value must never be persisted,
 * logged, audited, or returned from APIs.
 */
export function generateInvitationRawToken(byteLength: number): string {
  const size = Math.max(32, byteLength);
  return randomBytes(size).toString("base64url");
}

/** Keyed SHA-256 digest stored as the unique verifier (64 hex chars). */
export function hashInvitationToken(
  secret: string,
  rawToken: string,
): string {
  return createHmac("sha256", secret)
    .update(`provider-admin-invitation:${rawToken}`)
    .digest("hex");
}

/** Constant-time compare of hex digests. */
export function invitationVerifiersEqual(
  left: string,
  right: string,
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  } catch {
    return false;
  }
}

export function invitationExpiresAt(
  now: Date,
  ttlHours: number = PROVIDER_INVITATION_TTL_HOURS,
): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
}

export function isInvitationPendingUnexpired(
  invitation: Pick<
    ProviderAdminInvitationRecord,
    "status" | "expiresAt"
  >,
  now: Date,
): boolean {
  return invitation.status === "PENDING" && invitation.expiresAt > now;
}

/**
 * Lazy expiry: materialize EXPIRED before reuse of the same Provider/email.
 */
export function shouldMaterializeExpired(
  invitation: Pick<
    ProviderAdminInvitationRecord,
    "status" | "expiresAt" | "expiredAt"
  >,
  now: Date,
): boolean {
  return (
    invitation.status === "PENDING" &&
    invitation.expiresAt <= now &&
    invitation.expiredAt === null
  );
}

export function assertInvitationAcceptable(
  invitation: ProviderAdminInvitationRecord,
  now: Date,
): void {
  if (!isInvitationPendingUnexpired(invitation, now)) {
    throw providersError("PROVIDER_INVITATION_INVALID");
  }
}

export function assertInvitationTokenMatches(
  invitation: ProviderAdminInvitationRecord,
  expectedVerifier: string,
): void {
  if (!invitationVerifiersEqual(invitation.tokenVerifier, expectedVerifier)) {
    throw providersError("PROVIDER_INVITATION_INVALID");
  }
}

export function resolveInspectNextAction(input: {
  readonly invitation: ProviderAdminInvitationRecord;
  readonly now: Date;
  readonly existingUser:
    | {
        readonly emailVerified: boolean;
      }
    | null;
}): InvitationInspectNextAction {
  if (!isInvitationPendingUnexpired(input.invitation, input.now)) {
    return "NONE";
  }
  if (input.existingUser === null) {
    return "START_ONBOARDING";
  }
  if (!input.existingUser.emailVerified) {
    return "NONE";
  }
  return "ACCEPT_EXISTING";
}

/** Safe masked email for invitation inspect/list surfaces. */
export function maskInvitationEmail(emailNormalized: string): string {
  const at = emailNormalized.indexOf("@");
  if (at <= 0) {
    return "***";
  }
  const local = emailNormalized.slice(0, at);
  const domain = emailNormalized.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function invitationDeliveryStateFromRecord(
  invitation: Pick<
    ProviderAdminInvitationRecord,
    "sentAt" | "deliveryFailedAt"
  >,
): InvitationDeliveryState | null {
  if (invitation.sentAt !== null) {
    return "DELIVERED";
  }
  if (invitation.deliveryFailedAt !== null) {
    return "RESEND_REQUIRED";
  }
  return null;
}

export function isTerminalInvitationStatus(
  status: ProviderInvitationStatus,
): boolean {
  return status === "ACCEPTED" || status === "REVOKED" || status === "EXPIRED";
}

/**
 * Global provider_admin should stay enabled only while the user retains at
 * least one active Provider OWNER/ADMIN membership.
 */
export function shouldEnableProviderAdminRole(
  activeAuthorityMembershipCount: number,
): boolean {
  return activeAuthorityMembershipCount > 0;
}

export type AccountCategory =
  | 'INDIVIDUAL'
  | 'COMPANY'
  | 'ENGINEER'
  | 'PROVIDER_OWNER'
  | 'WORKER';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type AuthenticationMethod = 'PASSWORD' | 'GOOGLE';
/**
 * Domain session capability. `PROVIDER_ADMIN_INVITATION_ONBOARDING` is the
 * restricted accept/session-cleanup principal used before invitation acceptance.
 * Persistence maps it to VERIFICATION_ONLY until a dedicated enum value exists.
 */
export type SessionCapability =
  | 'FULL'
  | 'VERIFICATION_ONLY'
  | 'PROVIDER_ADMIN_INVITATION_ONBOARDING'
  | 'WORKER_INVITATION_ONBOARDING';

export type InvitationOnboardingAllowedAction =
  | 'ACCEPT_PROVIDER_ADMIN_INVITATION'
  | 'WORKER_INVITATION_ACCEPT'
  | 'SESSION_CLEANUP';

export type AuthDeliveryChannel = 'SMS' | 'EMAIL';

export interface AuthenticationPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly accountCategories: readonly AccountCategory[];
  readonly verifiedCategories: readonly AccountCategory[];
  readonly pendingCategories: readonly AccountCategory[];
  readonly status: UserStatus;
  readonly verificationOnly: boolean;
  /**
   * When true, the principal may only accept a Provider Admin invitation or
   * clean up its session — not ordinary FULL account operations.
   */
  readonly invitationOnboardingOnly?: boolean;
}

export interface IdentityState {
  readonly id: string;
  readonly phoneE164: string | null;
  readonly emailNormalized: string | null;
  readonly accountCategories: readonly AccountCategory[];
  readonly verifiedCategories: readonly AccountCategory[];
  readonly status: UserStatus;
  readonly suspendedUntil: Date | null;
  readonly phoneVerifiedAt: Date | null;
  readonly emailVerifiedAt: Date | null;
}

/**
 * Frontend-safe authenticated user representation shared by login, refresh,
 * password-change, Google sign-in, and `/auth/me`.
 */
export interface SafeAuthenticatedUser {
  readonly id: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly status: UserStatus;
  readonly accountCategories: readonly AccountCategory[];
  readonly verifiedCategories: readonly AccountCategory[];
  readonly pendingCategories: readonly AccountCategory[];
}

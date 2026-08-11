import type {
  AccountCategory,
  AuthenticationPrincipal,
  InvitationOnboardingAllowedAction,
  SessionCapability,
  UserStatus,
} from "./domain/authentication.types.js";
import { findPrivilegedActionReason } from "./domain/authorization.catalog.js";
import {
  INVITATION_ONBOARDING_ALLOWED_ACTIONS,
} from "./domain/auth.policy.js";
import type {
  AuthorizationDecision,
  AuthorizeProtectedOperationInput,
} from "./domain/authorization.types.js";

export type {
  AccountCategory,
  AuthenticationPrincipal,
  InvitationOnboardingAllowedAction,
  SessionCapability,
  UserStatus,
};
export {
  findPrivilegedActionReason,
  INVITATION_ONBOARDING_ALLOWED_ACTIONS,
};

/**
 * Approved public type/capability surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * `domain/` or `infrastructure/`.
 *
 * Composition may import create factories from `authentication.factories.ts`.
 */
export const AUTHENTICATION_PUBLIC_CONTRACT = "authentication.public" as const;

export interface ProtectedOperationAuthorizer {
  authorizeProtectedOperation(
    input: AuthorizeProtectedOperationInput,
  ): Promise<AuthorizationDecision>;
}

/**
 * Transaction-safe identity/contact facts for Provider eligibility checks.
 * Never includes Provider-owned membership or application state.
 */
export interface ProviderIdentitySnapshot {
  readonly userId: string;
  readonly status: UserStatus;
  /** Authoritative account activity, independent of the current session capability. */
  readonly isAccountActive: boolean;
  /** Active account that is not verification-only / invitation-restricted. */
  readonly isActiveNonVerificationOnly: boolean;
  readonly accountCategories: readonly AccountCategory[];
  readonly verifiedCategories: readonly AccountCategory[];
  readonly emailNormalized: string | null;
  readonly phoneE164: string | null;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  /** ENABLED `provider_admin` role on Authentication's own role tables. */
  readonly providerAdminEnabled: boolean;
}

export interface ProviderIdentityReader {
  getIdentity(userId: string): Promise<ProviderIdentitySnapshot | null>;
  findByEmailNormalized(
    emailNormalized: string,
  ): Promise<ProviderIdentitySnapshot | null>;
}

/**
 * Transaction-bound writer callable only from a Provider-owned unit of work.
 * Never opens its own transaction.
 */
export interface ProviderIdentityAuthorityWriter {
  grantOwnerAuthority(userId: string): Promise<void>;
  reconcileProviderAdminRole(input: {
    readonly userId: string;
    readonly shouldBeEnabled: boolean;
  }): Promise<void>;
}

/** Factory signature composition injects into Provider unit-of-work wiring. */
export type ProviderIdentityAuthorityWriterFactory = (
  transaction: unknown,
) => ProviderIdentityAuthorityWriter;

export interface CreateCategorylessInviteeCommand {
  /** Server-validated fixed invitation email (never caller-trusted). */
  readonly emailNormalized: string;
  readonly phoneE164: string;
  readonly password: string;
}

export interface CreateCategorylessInviteeResult {
  readonly userId: string;
  readonly challengeId: string;
  readonly purpose: "PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION";
  readonly maskedDestination: string;
  readonly expiresAt: string;
  readonly resendAvailableAt: string;
}

export interface VerifyInvitationEmailOtpCommand {
  readonly challengeId: string;
  readonly code: string;
  /** Server-validated fixed invitation email. */
  readonly fixedEmailNormalized: string;
}

/**
 * Restricted principal after invitation email OTP and before acceptance.
 * May call only invitation acceptance and session cleanup.
 */
export interface RestrictedInvitationOnboardingPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly emailNormalized: string;
  readonly status: UserStatus;
  readonly capability: "PROVIDER_ADMIN_INVITATION_ONBOARDING";
  readonly allowedActions: readonly InvitationOnboardingAllowedAction[];
  readonly accessToken: string;
  readonly accessExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

/**
 * Invitation-only identity onboarding owned by Authentication.
 * Creates empty category arrays; never accepts a customer category.
 */
export interface ProviderInvitationIdentityOnboarding {
  createCategorylessInvitee(
    command: CreateCategorylessInviteeCommand,
  ): Promise<CreateCategorylessInviteeResult>;
  verifyInvitationEmailOtp(
    command: VerifyInvitationEmailOtpCommand,
  ): Promise<RestrictedInvitationOnboardingPrincipal>;
}

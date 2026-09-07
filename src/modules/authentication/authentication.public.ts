import type {
  AccountCategory,
  AuthenticationPrincipal,
  InvitationOnboardingAllowedAction,
  SessionCapability,
  UserStatus,
} from "./domain/authentication.types.js";
export { createTransactionalProviderIdentityReader } from "./infrastructure/prisma-provider-identity.reader.js";
import { findPrivilegedActionReason } from "./domain/authorization.catalog.js";
import {
  INVITATION_ONBOARDING_ALLOWED_ACTIONS,
  WORKER_INVITATION_ONBOARDING_ALLOWED_ACTIONS,
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
  WORKER_INVITATION_ONBOARDING_ALLOWED_ACTIONS,
};

/**
 * Approved public type/capability surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * `domain/` or `infrastructure/`.
 *
 * Composition may import create factories from `authentication.factories.ts`.
 */
export const AUTHENTICATION_PUBLIC_CONTRACT = "authentication.public" as const;

export type AuthenticationProofPurpose =
  | "PROVIDER_PAYOUT_SUBMIT"
  | "PROVIDER_PAYOUT_SUCCESSOR_SUBMIT"
  | "PROVIDER_PAYOUT_PRIMARY_CHANGE"
  | "PROVIDER_PAYOUT_WITHDRAW"
  | "PROVIDER_PAYOUT_REMOVE"
  | "STAFF_PAYOUT_REVEAL";

export interface RecentAuthenticationProofVerifier {
  verify(input: {
    readonly principalUserId: string;
    readonly sessionId: string;
    readonly opaqueProof: string;
    readonly purpose: AuthenticationProofPurpose;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600 | 300;
  }): Promise<{
    readonly actorUserId: string;
    readonly sessionId: string;
    readonly authenticatedAt: Date;
    readonly expiresAt: Date;
    readonly proofId: string;
  }>;
}

export interface StaffCapabilityAuthorizer {
  authorize(input: {
    readonly principal: AuthenticationPrincipal;
    readonly requiredPermission:
      | "providers.verification.documents.review"
      | "providers.verification.policies.manage"
      | "providers.payout-destinations.verify";
  }): Promise<{ readonly actorUserId: string; readonly active: true }>;
}

export type R1P06StaffPermissionCode =
  | "providers.verification.documents.review"
  | "providers.verification.policies.manage"
  | "providers.payout-destinations.verify";

/** Transaction-bound Authentication permission read for high-risk R1-P06 commits. */
export interface TransactionalStaffPermissionAuthorizer {
  authorize(actorUserId: string, permission: R1P06StaffPermissionCode): Promise<boolean>;
}

export type TransactionalStaffPermissionAuthorizerFactory = (
  transaction: unknown,
) => TransactionalStaffPermissionAuthorizer;

/**
 * Staff permission for Provider service price approval decisions (R1-P09).
 * Mapped only to active staff_admin.
 */
export type ProviderServiceStaffPermissionCode =
  "providers.services.prices.approve";

/** Transaction-bound Authentication permission read for Staff price decisions. */
export interface TransactionalProviderServiceStaffAuthorizer {
  authorize(
    actorUserId: string,
    permission: ProviderServiceStaffPermissionCode,
  ): Promise<boolean>;
}

export type TransactionalProviderServiceStaffAuthorizerFactory = (
  transaction: unknown,
) => TransactionalProviderServiceStaffAuthorizer;

/** Transaction-bound recheck of an already consumed one-use proof. */
export interface TransactionalAuthenticationProofUseAuthorizer {
  assertConsumed(input: {
    readonly proofId: string;
    readonly actorUserId: string;
    readonly purpose: AuthenticationProofPurpose;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600 | 300;
    readonly now: Date;
  }): Promise<boolean>;
}

export type TransactionalAuthenticationProofUseAuthorizerFactory = (
  transaction: unknown,
) => TransactionalAuthenticationProofUseAuthorizer;

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

/** R1-P07 purposes are intentionally distinct from payout proof purposes. */
export type WorkerSensitiveActionPurpose =
  | "WORKER_ACCESS_ISSUE"
  | "WORKER_ACCESS_RESET"
  | "WORKER_ACCESS_REVOKE"
  | "WORKER_REMOVE"
  | "PROVIDER_ADMIN_GRANT"
  | "PROVIDER_ADMIN_REVOKE";

export type SensitiveActionProofPurpose = AuthenticationProofPurpose | WorkerSensitiveActionPurpose;

export interface WorkerIdentitySnapshot {
  readonly userId: string;
  readonly status: UserStatus;
  readonly isAccountActive: boolean;
  readonly emailNormalized: string | null;
  readonly workerRoleEnabled: boolean;
  readonly providerSupervisorRoleEnabled: boolean;
  readonly preferredLanguage: "AR" | "EN" | null;
}

export interface WorkerIdentityReader {
  getIdentity(userId: string): Promise<WorkerIdentitySnapshot | null>;
  findByEmailNormalized(emailNormalized: string): Promise<WorkerIdentitySnapshot | null>;
}

export type TransactionalWorkerIdentityReaderFactory = (
  transaction: unknown,
) => WorkerIdentityReader;

export interface WorkerInvitationIdentityOnboarding {
  startNewUser(input: {
    readonly invitationId: string;
    readonly invitationVersion: number;
    readonly fixedEmailNormalized: string;
    readonly password: string;
    readonly idempotencyKey: string;
  }): Promise<{
    readonly userId: string;
    readonly challengeId: string;
    readonly maskedDestination: string;
    readonly expiresAt: Date;
  }>;
  verifyEmail(input: {
    readonly invitationId: string;
    readonly invitationVersion: number;
    readonly challengeId: string;
    readonly code: string;
    readonly fixedEmailNormalized: string;
    readonly idempotencyKey: string;
  }): Promise<{
    readonly principal: AuthenticationPrincipal;
    readonly emailNormalized: string;
    readonly capability: "WORKER_INVITATION_ONBOARDING";
    readonly allowedActions: readonly ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"];
    readonly accessToken: string;
    readonly accessExpiresAt: Date;
    readonly refreshToken: string;
    readonly refreshExpiresAt: Date;
  }>;
}

export interface TransactionalWorkerIdentityAuthorityWriter {
  reconcileWorkerRole(input: {
    readonly userId: string;
    readonly shouldBeEnabled: boolean;
  }): Promise<void>;
  reconcileProviderSupervisorRole(input: {
    readonly userId: string;
    readonly shouldBeEnabled: boolean;
  }): Promise<void>;
  reconcileProviderAdminRole(input: {
    readonly userId: string;
    readonly shouldBeEnabled: boolean;
  }): Promise<void>;
}

export type TransactionalWorkerIdentityAuthorityWriterFactory = (
  transaction: unknown,
) => TransactionalWorkerIdentityAuthorityWriter;

export interface WorkerRecentAuthenticationProofVerifier {
  verify(input: {
    readonly principalUserId: string;
    readonly sessionId: string;
    readonly opaqueProof: string;
    readonly purpose: WorkerSensitiveActionPurpose;
    readonly providerId: string;
    readonly workerId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600;
  }): Promise<{
    readonly proofId: string;
    readonly authenticatedAt: Date;
    readonly expiresAt: Date;
  }>;
}

export interface TransactionalWorkerProofUseAuthorizer {
  assertConsumed(input: {
    readonly proofId: string;
    readonly actorUserId: string;
    readonly purpose: WorkerSensitiveActionPurpose;
    readonly providerId: string;
    readonly workerId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600;
    readonly now: Date;
  }): Promise<boolean>;
}

export type TransactionalWorkerProofUseAuthorizerFactory = (
  transaction: unknown,
) => TransactionalWorkerProofUseAuthorizer;

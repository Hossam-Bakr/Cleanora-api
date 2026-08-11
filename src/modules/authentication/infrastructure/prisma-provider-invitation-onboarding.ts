import { randomUUID } from "node:crypto";

import { getPrismaClient } from "#database/prisma";
import { Prisma } from "#generated/prisma/client";

import type {
  CreateCategorylessInviteeCommand,
  CreateCategorylessInviteeResult,
  ProviderInvitationIdentityOnboarding,
  RestrictedInvitationOnboardingPrincipal,
  VerifyInvitationEmailOtpCommand,
} from "../authentication.public.js";
import {
  assertPasswordPolicy,
  assertVerificationChallengeTarget,
  invitationEmailVerificationTarget,
  invitationOnboardingCapability,
  INVITATION_ONBOARDING_ALLOWED_ACTIONS,
  maskEmailDestination,
  normalizeEmail,
  normalizePhone,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  toPersistedSessionCapability,
} from "../domain/auth.policy.js";
import { authenticationError } from "../domain/authentication.errors.js";
import type {
  EmailAuthenticationDeliveryPort,
  OneTimeVerifierPort,
  PasswordHasherPort,
  TokenServicePort,
} from "../domain/authentication.ports.js";
import { mapIdentity } from "./auth.repository.js";

export interface ProviderInvitationOnboardingDependencies {
  readonly passwordHasher: PasswordHasherPort;
  readonly tokens: TokenServicePort;
  readonly verifier: OneTimeVerifierPort;
  readonly email: EmailAuthenticationDeliveryPort;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  readonly now?: () => Date;
}

/**
 * Authentication-owned invitation-only identity onboarding.
 * Creates empty category arrays and null-category invitation OTP challenges.
 */
export function createProviderInvitationIdentityOnboarding(
  dependencies: ProviderInvitationOnboardingDependencies,
): ProviderInvitationIdentityOnboarding {
  const now = () => dependencies.now?.() ?? new Date();

  return {
    async createCategorylessInvitee(
      command: CreateCategorylessInviteeCommand,
    ): Promise<CreateCategorylessInviteeResult> {
      const emailNormalized = normalizeEmail(command.emailNormalized);
      const phoneE164 = normalizePhone(command.phoneE164);
      assertPasswordPolicy(command.password);

      const existingEmail = await getPrismaClient().user.findUnique({
        where: { emailNormalized },
      });
      if (existingEmail !== null) {
        throw authenticationError("AUTH_EMAIL_ALREADY_REGISTERED");
      }
      const existingPhone = await getPrismaClient().user.findUnique({
        where: { phoneE164 },
      });
      if (existingPhone !== null) {
        throw authenticationError("AUTH_PHONE_ALREADY_REGISTERED");
      }

      const passwordHash = await dependencies.passwordHasher.hash(
        command.password,
      );
      const challengeId = randomUUID();
      const expiresAt = new Date(now().getTime() + OTP_TTL_SECONDS * 1000);
      const resendAvailableAt = new Date(
        now().getTime() + OTP_RESEND_SECONDS * 1000,
      );
      const code = dependencies.verifier.randomOtp();
      const destinationHash = dependencies.verifier.hashDestination(
        "EMAIL",
        emailNormalized,
      );
      const codeVerifier = dependencies.verifier.verifyOtp(
        challengeId,
        "PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION",
        code,
      );

      let userId: string;
      try {
        const created = await getPrismaClient().$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              emailNormalized,
              phoneE164,
              accountCategories: [],
              verifiedCategories: [],
            },
          });
          await tx.userCredential.create({
            data: { userId: user.id, passwordHash },
          });
          await tx.otpCode.create({
            data: {
              id: challengeId,
              userId: user.id,
              accountCategory: null,
              purpose: "PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION",
              channel: "EMAIL",
              destinationHash,
              codeVerifier,
              expiresAt,
              resendAvailableAt,
              maxAttempts: OTP_MAX_ATTEMPTS,
            },
          });
          return user;
        });
        userId = created.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw authenticationError("AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED");
        }
        throw error;
      }

      try {
        await dependencies.email.send({
          idempotencyKey: challengeId,
          destination: emailNormalized,
          value: code,
          purpose: "PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION",
          expiresAt,
        });
        await getPrismaClient().otpCode.updateMany({
          where: { id: challengeId, status: "PENDING_DELIVERY" },
          data: { status: "ACTIVE", deliveredAt: now() },
        });
      } catch {
        await getPrismaClient().otpCode.updateMany({
          where: { id: challengeId, status: "PENDING_DELIVERY" },
          data: {
            status: "DELIVERY_FAILED",
            deliveryFailedAt: now(),
          },
        });
        throw authenticationError("AUTH_PROVIDER_UNAVAILABLE");
      }

      return {
        userId,
        challengeId,
        purpose: "PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION",
        maskedDestination: maskEmailDestination(emailNormalized),
        expiresAt: expiresAt.toISOString(),
        resendAvailableAt: resendAvailableAt.toISOString(),
      };
    },

    async verifyInvitationEmailOtp(
      command: VerifyInvitationEmailOtpCommand,
    ): Promise<RestrictedInvitationOnboardingPrincipal> {
      const fixedEmail = normalizeEmail(command.fixedEmailNormalized);
      const challenge = await getPrismaClient().otpCode.findUnique({
        where: { id: command.challengeId },
      });
      if (
        challenge?.status !== "ACTIVE" ||
        challenge.expiresAt <= now() ||
        challenge.purpose !==
          "PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION" ||
        challenge.accountCategory !== null
      ) {
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }

      const user = await getPrismaClient().user.findUnique({
        where: { id: challenge.userId },
      });
      if (user === null) {
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }

      const identity = mapIdentity(user);
      const target = invitationEmailVerificationTarget(identity, fixedEmail);
      assertVerificationChallengeTarget(
        target,
        challenge,
        dependencies.verifier.hashDestination(
          target.channel,
          target.destination,
        ),
      );

      const expected = dependencies.verifier.verifyOtp(
        challenge.id,
        challenge.purpose,
        command.code,
      );
      if (!dependencies.verifier.equals(challenge.codeVerifier, expected)) {
        const nextAttempts = challenge.attemptCount + 1;
        await getPrismaClient().otpCode.update({
          where: { id: challenge.id },
          data: {
            attemptCount: { increment: 1 },
            lastAttemptAt: now(),
            ...(nextAttempts >= Math.min(challenge.maxAttempts, OTP_MAX_ATTEMPTS)
              ? { status: "EXHAUSTED" }
              : {}),
          },
        });
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }

      const capability = invitationOnboardingCapability(identity, now());
      const credential = await getPrismaClient().userCredential.findUnique({
        where: { userId: user.id },
      });
      const credentialVersion = credential?.credentialVersion ?? 1;
      const sessionId = randomUUID();
      const refreshExpiresAt = new Date(
        now().getTime() + dependencies.refreshTtlSeconds * 1000,
      );
      const refresh = dependencies.tokens.issueRefresh(
        {
          userId: user.id,
          sessionId,
          credentialVersion,
          rotationCounter: 0,
          jwtId: randomUUID(),
        },
        refreshExpiresAt,
      );
      const refreshVerifier = dependencies.verifier.verifyRefresh(
        sessionId,
        refresh.token,
      );
      const access = dependencies.tokens.issueAccess({
        userId: user.id,
        sessionId,
        credentialVersion,
      });

      await getPrismaClient().$transaction(async (tx) => {
        const consumed = await tx.otpCode.updateMany({
          where: {
            id: challenge.id,
            status: "ACTIVE",
            expiresAt: { gt: now() },
          },
          data: { status: "CONSUMED", consumedAt: now() },
        });
        if (consumed.count !== 1) {
          throw authenticationError("AUTH_VERIFICATION_FAILED");
        }
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: now() },
        });
        await tx.userSession.create({
          data: {
            id: sessionId,
            userId: user.id,
            currentRefreshVerifier: refreshVerifier,
            credentialVersion,
            authenticationMethod: "PASSWORD",
            capability: toPersistedSessionCapability(capability),
            expiresAt: refreshExpiresAt,
          },
        });
      });

      return {
        userId: user.id,
        sessionId,
        emailNormalized: fixedEmail,
        status: user.status,
        capability: "PROVIDER_ADMIN_INVITATION_ONBOARDING",
        allowedActions: INVITATION_ONBOARDING_ALLOWED_ACTIONS,
        accessToken: access.token,
        accessExpiresAt: access.expiresAt,
        refreshToken: refresh.token,
        refreshExpiresAt,
      };
    },
  };
}

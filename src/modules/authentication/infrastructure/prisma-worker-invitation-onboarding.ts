import { createHash } from "node:crypto";

import { getPrismaClient } from "#database/prisma";
import { Prisma } from "#generated/prisma/client";

import type { WorkerInvitationIdentityOnboarding } from "../authentication.public.js";
import {
  assertPasswordPolicy,
  maskEmailDestination,
  normalizeEmail,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  WORKER_INVITATION_ONBOARDING_ALLOWED_ACTIONS,
} from "../domain/auth.policy.js";
import { authenticationError } from "../domain/authentication.errors.js";
import type {
  EmailAuthenticationDeliveryPort,
  OneTimeVerifierPort,
  PasswordHasherPort,
  TokenServicePort,
} from "../domain/authentication.ports.js";

const WORKER_OTP_PURPOSE = "WORKER_INVITATION_EMAIL_VERIFICATION" as const;

function deterministicUuid(material: string): string {
  const hex = createHash("sha256").update(material).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface WorkerInvitationOnboardingDependencies {
  readonly passwordHasher: PasswordHasherPort;
  readonly tokens: TokenServicePort;
  readonly verifier: OneTimeVerifierPort;
  readonly email: EmailAuthenticationDeliveryPort;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  readonly now?: () => Date;
}

/** Authentication-owned Worker invitation onboarding; never imports Providers. */
export function createWorkerInvitationIdentityOnboarding(
  dependencies: WorkerInvitationOnboardingDependencies,
): WorkerInvitationIdentityOnboarding {
  const now = () => dependencies.now?.() ?? new Date();

  return {
    async startNewUser(input) {
      const emailNormalized = normalizeEmail(input.fixedEmailNormalized);
      assertPasswordPolicy(input.password);
      if (!Number.isSafeInteger(input.invitationVersion) || input.invitationVersion <= 0
        || input.invitationId.trim().length === 0) {
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }
      const startFingerprint = dependencies.verifier.verifyOtp(
        input.invitationId,
        `WORKER_INVITATION_ONBOARDING_START:v1:${input.invitationVersion}:${input.idempotencyKey}`,
        input.password,
      );
      const challengeId = deterministicUuid(startFingerprint);
      const priorChallenge = await getPrismaClient().otpCode.findUnique({ where: { id: challengeId } });
      if (priorChallenge !== null) {
        const priorUser = await getPrismaClient().user.findUnique({ where: { id: priorChallenge.userId } });
        if (priorChallenge.purpose !== WORKER_OTP_PURPOSE
          || priorUser?.emailNormalized !== emailNormalized) {
          throw authenticationError("AUTH_VERIFICATION_FAILED");
        }
        return {
          userId: priorChallenge.userId,
          challengeId,
          maskedDestination: maskEmailDestination(emailNormalized),
          expiresAt: priorChallenge.expiresAt,
        };
      }
      if (await getPrismaClient().user.findUnique({ where: { emailNormalized } }) !== null) {
        throw authenticationError("AUTH_EMAIL_ALREADY_REGISTERED");
      }
      const passwordHash = await dependencies.passwordHasher.hash(input.password);
      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + OTP_TTL_SECONDS * 1000);
      const resendAvailableAt = new Date(issuedAt.getTime() + OTP_RESEND_SECONDS * 1000);
      const code = dependencies.verifier.randomOtp();
      const destinationHash = dependencies.verifier.hashDestination("EMAIL", emailNormalized);
      const codeVerifier = dependencies.verifier.verifyOtp(challengeId, WORKER_OTP_PURPOSE, code);

      let userId: string;
      try {
        const created = await getPrismaClient().$transaction(async (transaction) => {
          const user = await transaction.user.create({
            data: { emailNormalized, accountCategories: [], verifiedCategories: [] },
          });
          await transaction.userCredential.create({ data: { userId: user.id, passwordHash } });
          await transaction.otpCode.create({
            data: {
              id: challengeId,
              userId: user.id,
              accountCategory: null,
              purpose: WORKER_OTP_PURPOSE,
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
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw authenticationError("AUTH_EMAIL_ALREADY_REGISTERED");
        }
        throw error;
      }

      try {
        await dependencies.email.send({
          idempotencyKey: challengeId,
          destination: emailNormalized,
          value: code,
          purpose: WORKER_OTP_PURPOSE,
          expiresAt,
        });
        await getPrismaClient().otpCode.updateMany({
          where: { id: challengeId, status: "PENDING_DELIVERY" },
          data: { status: "ACTIVE", deliveredAt: now() },
        });
      } catch {
        await getPrismaClient().otpCode.updateMany({
          where: { id: challengeId, status: "PENDING_DELIVERY" },
          data: { status: "DELIVERY_FAILED", deliveryFailedAt: now() },
        });
        throw authenticationError("AUTH_PROVIDER_UNAVAILABLE");
      }

      return {
        userId,
        challengeId,
        maskedDestination: maskEmailDestination(emailNormalized),
        expiresAt,
      };
    },

    async verifyEmail(input) {
      const fixedEmail = normalizeEmail(input.fixedEmailNormalized);
      const challenge = await getPrismaClient().otpCode.findUnique({ where: { id: input.challengeId } });
      if ((challenge?.status !== "ACTIVE" && challenge?.status !== "CONSUMED")
        || challenge.expiresAt <= now()
        || challenge.purpose !== WORKER_OTP_PURPOSE
        || challenge.accountCategory !== null) {
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }
      const user = await getPrismaClient().user.findUnique({ where: { id: challenge.userId } });
      if (user === null || user.emailNormalized !== fixedEmail) {
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }
      const expectedDestinationHash = dependencies.verifier.hashDestination("EMAIL", fixedEmail);
      if (!dependencies.verifier.equals(challenge.destinationHash, expectedDestinationHash)) {
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }
      const expectedCode = dependencies.verifier.verifyOtp(challenge.id, WORKER_OTP_PURPOSE, input.code);
      if (!dependencies.verifier.equals(challenge.codeVerifier, expectedCode)) {
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

      const sessionFingerprint = dependencies.verifier.verifyOtp(
        challenge.id,
        `WORKER_INVITATION_ONBOARDING_VERIFY:v1:${input.invitationVersion}:${input.idempotencyKey}`,
        input.code,
      );
      const sessionId = deterministicUuid(sessionFingerprint);
      const existingSession = await getPrismaClient().userSession.findUnique({ where: { id: sessionId } });
      if (challenge.status === "CONSUMED"
        && (existingSession === null || existingSession.userId !== user.id)) {
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }
      const credential = await getPrismaClient().userCredential.findUnique({ where: { userId: user.id } });
      const credentialVersion = credential?.credentialVersion ?? 1;
      const refreshExpiresAt = existingSession?.expiresAt
        ?? new Date(now().getTime() + dependencies.refreshTtlSeconds * 1000);
      const refresh = dependencies.tokens.issueRefresh({
        userId: user.id,
        sessionId,
        credentialVersion,
        rotationCounter: 0,
        jwtId: deterministicUuid(`${sessionFingerprint}:refresh`),
      }, refreshExpiresAt);
      const refreshVerifier = dependencies.verifier.verifyRefresh(sessionId, refresh.token);
      const access = dependencies.tokens.issueAccess({ userId: user.id, sessionId, credentialVersion });

      await getPrismaClient().$transaction(async (transaction) => {
        if (challenge.status === "ACTIVE") {
          const consumed = await transaction.otpCode.updateMany({
            where: { id: challenge.id, status: "ACTIVE", expiresAt: { gt: now() } },
            data: { status: "CONSUMED", consumedAt: now() },
          });
          if (consumed.count !== 1) throw authenticationError("AUTH_VERIFICATION_FAILED");
          await transaction.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now() } });
        }
        if (existingSession === null) {
          await transaction.userSession.create({
            data: {
              id: sessionId,
              userId: user.id,
              currentRefreshVerifier: refreshVerifier,
              credentialVersion,
              authenticationMethod: "PASSWORD",
              capability: "VERIFICATION_ONLY",
              expiresAt: refreshExpiresAt,
            },
          });
        } else {
          await transaction.userSession.update({
            where: { id: sessionId },
            data: { currentRefreshVerifier: refreshVerifier },
          });
        }
      });

      return {
        principal: {
          userId: user.id,
          sessionId,
          accountCategories: [],
          verifiedCategories: [],
          pendingCategories: [],
          status: user.status,
          verificationOnly: true,
          invitationOnboardingOnly: true,
        },
        emailNormalized: fixedEmail,
        capability: "WORKER_INVITATION_ONBOARDING",
        allowedActions: WORKER_INVITATION_ONBOARDING_ALLOWED_ACTIONS,
        accessToken: access.token,
        accessExpiresAt: access.expiresAt,
        refreshToken: refresh.token,
        refreshExpiresAt,
      };
    },
  };
}

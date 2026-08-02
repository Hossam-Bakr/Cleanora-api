import { Prisma } from "#generated/prisma/client";
import { getPrismaClient } from "#database/prisma";
import { authenticationError } from "../domain/authentication.errors.js";
import type { AccountCategory } from "../domain/authentication.types.js";
import { mapIdentity } from "./auth.repository.js";
import { verificationTarget } from "../domain/auth.policy.js";

export class AuthenticationTransactionRepository {
  async enrollCategory(input: { userId: string; category: AccountCategory }) {
    return getPrismaClient().$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({
        where: { id: input.userId },
      });
      if (
        current === null ||
        current.accountCategories.includes(input.category)
      )
        return null;
      const user = await transaction.user.update({
        where: { id: input.userId },
        data: {
          accountCategories: [...current.accountCategories, input.category],
        },
      });
      await transaction.authEvent.create({
        data: {
          userId: input.userId,
          eventType: "CATEGORY_ENROLLED",
          outcome: "SUCCEEDED",
          context: { category: input.category },
        },
      });
      return user;
    });
  }

  async completeVerification(
    challengeId: string,
    session?: { readonly userId: string; readonly sessionId: string },
  ): Promise<boolean> {
    return getPrismaClient().$transaction(async (transaction) => {
      const challenge = await transaction.otpCode.findFirst({
        where: {
          id: challengeId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
      });
      if (challenge === null) return false;
      if (session !== undefined && challenge.userId !== session.userId)
        return false;
      const user = await transaction.user.findUnique({
        where: { id: challenge.userId },
      });
      if (user === null) return false;
      const target = verificationTarget(
        mapIdentity(user),
        challenge.accountCategory as AccountCategory,
        challenge.purpose,
      );
      if (target.channel !== challenge.channel)
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      const consumed = await transaction.otpCode.updateMany({
        where: {
          id: challenge.id,
          userId: challenge.userId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await transaction.user.update({
        where: { id: challenge.userId },
        data: {
          verifiedCategories: [
            ...new Set([
              ...user.verifiedCategories,
              challenge.accountCategory,
            ]),
          ],
          emailVerifiedAt: new Date(),
        },
      });
      if (session !== undefined) {
        const promoted = await transaction.userSession.updateMany({
          where: {
            id: session.sessionId,
            userId: session.userId,
            capability: "VERIFICATION_ONLY",
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { capability: "FULL", lastUsedAt: new Date() },
        });
        if (promoted.count !== 1) {
          throw authenticationError("AUTH_VERIFICATION_FAILED");
        }
      }
      await transaction.authEvent.create({
        data: {
          userId: challenge.userId,
          eventType: "VERIFICATION_COMPLETED",
          outcome: "SUCCEEDED",
          context: { category: challenge.accountCategory },
        },
      });
      return true;
    });
  }

  async createGoogleIdentity(input: {
    emailNormalized: string;
    subject: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            emailNormalized: input.emailNormalized,
            emailVerifiedAt: new Date(),
            accountCategories: ["INDIVIDUAL"],
            verifiedCategories: ["INDIVIDUAL"],
          },
        });
        await transaction.socialAccount.create({
          data: {
            userId: user.id,
            provider: "GOOGLE",
            accountCategory: "INDIVIDUAL",
            providerSubject: input.subject,
            providerEmailNormalized: input.emailNormalized,
            providerEmailVerifiedAt: new Date(),
            providerDisplayName: input.displayName ?? null,
            providerAvatarUrl: input.avatarUrl ?? null,
            lastAuthenticatedAt: new Date(),
          },
        });
        await transaction.authEvent.create({
          data: {
            userId: user.id,
            eventType: "VERIFICATION_COMPLETED",
            outcome: "SUCCEEDED",
            context: {
              category: "INDIVIDUAL",
              channel: "GOOGLE_VERIFIED_EMAIL",
            },
          },
        });
        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return null;
      throw error;
    }
  }

  async activateGoogleIndividual(userId: string) {
    return getPrismaClient().$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({
        where: { id: userId },
      });
      if (
        current === null ||
        !current.accountCategories.includes("INDIVIDUAL")
      ) {
        return null;
      }
      if (current.verifiedCategories.includes("INDIVIDUAL")) {
        return current;
      }
      const user = await transaction.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
          verifiedCategories: [
            ...new Set([
              ...current.verifiedCategories,
              "INDIVIDUAL" as AccountCategory,
            ]),
          ],
        },
      });
      await transaction.authEvent.create({
        data: {
          userId,
          eventType: "VERIFICATION_COMPLETED",
          outcome: "SUCCEEDED",
          context: {
            category: "INDIVIDUAL",
            channel: "GOOGLE_VERIFIED_EMAIL",
          },
        },
      });
      return user;
    });
  }

  linkGoogle(input: {
    userId: string;
    sessionId: string;
    subject: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    return getPrismaClient().$transaction(async (transaction) => {
      await transaction.socialAccount.create({
        data: {
          userId: input.userId,
          provider: "GOOGLE",
          accountCategory: "INDIVIDUAL",
          providerSubject: input.subject,
          providerEmailNormalized: input.email,
          providerEmailVerifiedAt: new Date(),
          providerDisplayName: input.displayName ?? null,
          providerAvatarUrl: input.avatarUrl ?? null,
          lastAuthenticatedAt: new Date(),
        },
      });
      await transaction.authEvent.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId,
          eventType: "GOOGLE_LINKED",
          outcome: "SUCCEEDED",
        },
      });
    });
  }

  unlinkGoogle(input: { userId: string; sessionId: string }) {
    return getPrismaClient().$transaction(async (transaction) => {
      await transaction.socialAccount.deleteMany({
        where: {
          userId: input.userId,
          provider: "GOOGLE",
          accountCategory: "INDIVIDUAL",
        },
      });
      await transaction.authEvent.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId,
          eventType: "GOOGLE_UNLINKED",
          outcome: "SUCCEEDED",
        },
      });
    });
  }

  async createSignup(input: {
    phoneE164?: string;
    emailNormalized?: string;
    category: AccountCategory;
    passwordHash: string;
  }) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            phoneE164: input.phoneE164 ?? null,
            emailNormalized: input.emailNormalized ?? null,
            accountCategories: [input.category],
            verifiedCategories: [],
          },
        });
        await transaction.userCredential.create({
          data: { userId: user.id, passwordHash: input.passwordHash },
        });
        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return null;
      throw error;
    }
  }

  async rollbackFailedSignup(
    userId: string,
    challengeId: string,
  ): Promise<void> {
    // Remove only the brand-new unverified identity created by this failed signup delivery.
    await getPrismaClient().$transaction(async (transaction) => {
      await transaction.otpCode.deleteMany({
        where: { id: challengeId, userId, status: "DELIVERY_FAILED" },
      });
      const removable = await transaction.user.findFirst({
        where: {
          id: userId,
          verifiedCategories: { isEmpty: true },
          sessions: { none: {} },
          socialAccounts: { none: {} },
        },
        select: { id: true },
      });
      if (removable === null) return;
      await transaction.userCredential.deleteMany({ where: { userId } });
      await transaction.user.delete({ where: { id: userId } });
    });
  }

  async resetPassword(input: {
    resetId: string;
    userId: string;
    passwordHash: string;
  }): Promise<boolean> {
    return getPrismaClient().$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: input.resetId,
          userId: input.userId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await transaction.userCredential.update({
        where: { userId: input.userId },
        data: {
          passwordHash: input.passwordHash,
          credentialVersion: { increment: 1 },
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await transaction.userSession.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: "PASSWORD_RESET" },
      });
      await transaction.authEvent.create({
        data: {
          userId: input.userId,
          eventType: "PASSWORD_RESET",
          outcome: "SUCCEEDED",
        },
      });
      return true;
    });
  }

  async changePassword(input: {
    userId: string;
    sessionId: string;
    passwordHash: string;
    expectedVerifier: string;
    nextVerifier: string;
    nextCredentialVersion: number;
  }): Promise<boolean> {
    return getPrismaClient().$transaction(async (transaction) => {
      await transaction.userCredential.update({
        where: { userId: input.userId },
        data: {
          passwordHash: input.passwordHash,
          credentialVersion: input.nextCredentialVersion,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await transaction.userSession.updateMany({
        where: {
          userId: input.userId,
          id: { not: input.sessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revocationReason: "PASSWORD_CHANGE" },
      });
      const rotated = await transaction.userSession.updateMany({
        where: {
          id: input.sessionId,
          userId: input.userId,
          currentRefreshVerifier: input.expectedVerifier,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          currentRefreshVerifier: input.nextVerifier,
          credentialVersion: input.nextCredentialVersion,
          rotationCounter: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
      // Return the same stable error as every invalid or stale refresh-session condition.
      if (rotated.count !== 1)
        throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
      await transaction.authEvent.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId,
          eventType: "PASSWORD_CHANGED",
          outcome: "SUCCEEDED",
        },
      });
      return true;
    });
  }
}

import { createHmac } from "node:crypto";

import { getPrismaClient } from "#database/prisma";
import {
  Prisma,
  type SessionRevocationReason,
  type User,
} from "#generated/prisma/client";

import { authenticationError } from "../domain/authentication.errors.js";
import type {
  AccountCategory,
  AuthenticationMethod,
  IdentityState,
  SessionCapability,
} from "../domain/authentication.types.js";

export function mapIdentity(user: User): IdentityState {
  return {
    id: user.id,
    phoneE164: user.phoneE164,
    emailNormalized: user.emailNormalized,
    accountCategories: user.accountCategories as AccountCategory[],
    verifiedCategories: user.verifiedCategories as AccountCategory[],
    status: user.status,
    suspendedUntil: user.suspendedUntil,
    phoneVerifiedAt: user.phoneVerifiedAt,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export class UserRepository {
  findByPhone(phoneE164: string) {
    return getPrismaClient().user.findUnique({ where: { phoneE164 } });
  }

  findByEmail(emailNormalized: string) {
    return getPrismaClient().user.findUnique({ where: { emailNormalized } });
  }

  findById(id: string) {
    return getPrismaClient().user.findUnique({ where: { id } });
  }

  async create(data: {
    phoneE164?: string;
    emailNormalized?: string;
    category: AccountCategory;
  }) {
    try {
      return await getPrismaClient().user.create({
        data: {
          phoneE164: data.phoneE164 ?? null,
          emailNormalized: data.emailNormalized ?? null,
          accountCategories: [data.category],
          verifiedCategories: [],
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  }

  async enroll(userId: string, category: AccountCategory) {
    const user = await this.findById(userId);
    if (user === null) return null;
    return getPrismaClient().user.update({
      where: { id: userId },
      data: {
        accountCategories: [
          ...new Set([...user.accountCategories, category]),
        ],
      },
    });
  }

  map = mapIdentity;
}

export class CredentialRepository {
  findByUserId(userId: string) {
    return getPrismaClient().userCredential.findUnique({ where: { userId } });
  }

  create(userId: string, passwordHash: string) {
    return getPrismaClient().userCredential.create({
      data: { userId, passwordHash },
    });
  }

  success(userId: string) {
    return getPrismaClient().userCredential.update({
      where: { userId },
      data: {
        failedLoginAttempts: 0,
        failureWindowStartedAt: null,
        lockedUntil: null,
        lastAuthenticatedAt: new Date(),
      },
    });
  }

  async failure(
    userId: string,
    now = new Date(),
    policy = { maxFailures: 5, windowSeconds: 900, lockSeconds: 900 },
  ) {
    const rows = await getPrismaClient().$queryRaw<
      Array<{ failed_login_attempts: number; locked_until: Date | null }>
    >(Prisma.sql`
      UPDATE "user_credentials"
      SET "failed_login_attempts" = CASE
            WHEN "failure_window_started_at" IS NOT NULL
             AND "failure_window_started_at" > (${now}::timestamp) - (${policy.windowSeconds}::integer * INTERVAL '1 second')
            THEN "failed_login_attempts" + 1 ELSE 1 END,
          "failure_window_started_at" = CASE
            WHEN "failure_window_started_at" IS NOT NULL
             AND "failure_window_started_at" > (${now}::timestamp) - (${policy.windowSeconds}::integer * INTERVAL '1 second')
            THEN "failure_window_started_at" ELSE (${now}::timestamp) END,
          "last_failed_at" = (${now}::timestamp),
          "locked_until" = CASE
            WHEN (CASE
              WHEN "failure_window_started_at" IS NOT NULL
               AND "failure_window_started_at" > (${now}::timestamp) - (${policy.windowSeconds}::integer * INTERVAL '1 second')
              THEN "failed_login_attempts" + 1 ELSE 1 END) >= ${policy.maxFailures}
            THEN (${now}::timestamp) + (${policy.lockSeconds}::integer * INTERVAL '1 second') ELSE NULL END
      WHERE "user_id" = ${userId}
      RETURNING "failed_login_attempts", "locked_until"
    `);
    return rows[0] ?? null;
  }

  replace(userId: string, passwordHash: string) {
    return getPrismaClient().userCredential.update({
      where: { userId },
      data: {
        passwordHash,
        credentialVersion: { increment: 1 },
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }
}

export class SessionRepository {
  create(data: {
    id: string;
    userId: string;
    verifier: string;
    credentialVersion: number;
    method: AuthenticationMethod;
    capability: SessionCapability;
    expiresAt: Date;
  }) {
    return getPrismaClient().userSession.create({
      data: {
        id: data.id,
        userId: data.userId,
        currentRefreshVerifier: data.verifier,
        credentialVersion: data.credentialVersion,
        authenticationMethod: data.method,
        capability: data.capability,
        expiresAt: data.expiresAt,
      },
    });
  }

  find(id: string) {
    return getPrismaClient().userSession.findUnique({ where: { id } });
  }

  async rotate(id: string, expected: string, next: string) {
    const result = await getPrismaClient().userSession.updateMany({
      where: {
        id,
        currentRefreshVerifier: expected,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        currentRefreshVerifier: next,
        rotationCounter: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
    return result.count === 1;
  }

  revoke(id: string, reason: SessionRevocationReason = "LOGOUT") {
    return getPrismaClient().userSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason },
    });
  }

  revokeAll(
    userId: string,
    reason: SessionRevocationReason,
    exceptId?: string,
  ) {
    return getPrismaClient().userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      data: { revokedAt: new Date(), revocationReason: reason },
    });
  }

  compromise(id: string) {
    return getPrismaClient().userSession.updateMany({
      where: { id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        compromisedAt: new Date(),
        revocationReason: "REFRESH_REUSE",
      },
    });
  }
}

export class OtpRepository {
  async create(data: {
    id: string;
    userId: string;
    category: AccountCategory;
    purpose: "CATEGORY_VERIFICATION" | "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION";
    channel: "SMS" | "EMAIL";
    destinationHash: string;
    verifier: string;
    expiresAt: Date;
    resendAt: Date;
    maxAttempts: number;
  }) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const now = new Date();
      try {
        return await getPrismaClient().$transaction(
          async (transaction) => {
            const coolingDown = await transaction.otpCode.findFirst({
              where: {
                userId: data.userId,
                accountCategory: data.category,
                purpose: data.purpose,
                status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
                expiresAt: { gt: now },
                resendAvailableAt: { gt: now },
              },
              orderBy: { createdAt: "desc" },
            });
            if (coolingDown !== null) {
              return { challenge: coolingDown, created: false as const };
            }
            await transaction.otpCode.updateMany({
              where: {
                userId: data.userId,
                accountCategory: data.category,
                purpose: data.purpose,
                status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
              },
              data: { status: "SUPERSEDED", supersededAt: now },
            });
            const challenge = await transaction.otpCode.create({
              data: {
                id: data.id,
                userId: data.userId,
                accountCategory: data.category,
                purpose: data.purpose,
                channel: data.channel,
                destinationHash: data.destinationHash,
                codeVerifier: data.verifier,
                expiresAt: data.expiresAt,
                resendAvailableAt: data.resendAt,
                maxAttempts: data.maxAttempts,
              },
            });
            return { challenge, created: true as const };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034")
        ) {
          const winner = await getPrismaClient().otpCode.findFirst({
            where: {
              userId: data.userId,
              accountCategory: data.category,
              purpose: data.purpose,
              status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
              expiresAt: { gt: now },
            },
            orderBy: { createdAt: "desc" },
          });
          if (winner !== null) {
            return { challenge: winner, created: false as const };
          }
          // P2034 under pool contention often has no winner yet; retry bounded times.
          if (error.code === "P2034" && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
            continue;
          }
          throw authenticationError("AUTH_VERIFICATION_FAILED");
        }
        throw error;
      }
    }
    throw authenticationError("AUTH_VERIFICATION_FAILED");
  }

  activate(id: string) {
    return getPrismaClient().otpCode.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "ACTIVE", deliveredAt: new Date() },
    });
  }

  failDelivery(id: string) {
    return getPrismaClient().otpCode.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "DELIVERY_FAILED", deliveryFailedAt: new Date() },
    });
  }

  findOpenForUser(
    userId: string,
    category: AccountCategory,
    purpose: "CATEGORY_VERIFICATION" | "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION",
    status: "DELIVERY_FAILED",
  ) {
    return getPrismaClient().otpCode.findFirst({
      where: { userId, accountCategory: category, purpose, status },
      orderBy: { createdAt: "desc" },
    });
  }

  find(id: string) {
    return getPrismaClient().otpCode.findUnique({ where: { id } });
  }

  consume(id: string) {
    return getPrismaClient().otpCode.updateMany({
      where: { id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
  }

  async failAttempt(id: string, exhausted: boolean) {
    return getPrismaClient().otpCode.update({
      where: { id },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        ...(exhausted ? { status: "EXHAUSTED" } : {}),
      },
    });
  }
}

export class PasswordResetRepository {
  async create(data: {
    id: string;
    userId: string;
    channel: "SMS" | "EMAIL";
    destinationHash: string;
    verifier: string;
    expiresAt: Date;
    resendAt: Date;
    maxAttempts: number;
  }) {
    return getPrismaClient().$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: {
          userId: data.userId,
          status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
        },
        data: { status: "SUPERSEDED", supersededAt: new Date() },
      });
      return transaction.passwordResetToken.create({
        data: {
          id: data.id,
          userId: data.userId,
          channel: data.channel,
          destinationHash: data.destinationHash,
          tokenVerifier: data.verifier,
          expiresAt: data.expiresAt,
          resendAvailableAt: data.resendAt,
          maxAttempts: data.maxAttempts,
        },
      });
    });
  }

  activate(id: string) {
    return getPrismaClient().passwordResetToken.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "ACTIVE", deliveredAt: new Date() },
    });
  }

  failDelivery(id: string) {
    return getPrismaClient().passwordResetToken.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "DELIVERY_FAILED", deliveryFailedAt: new Date() },
    });
  }

  find(id: string) {
    return getPrismaClient().passwordResetToken.findUnique({ where: { id } });
  }

  async failAttempt(id: string): Promise<boolean> {
    const rows = await getPrismaClient().$queryRaw<
      Array<{ attempt_count: number }>
    >(Prisma.sql`
      UPDATE "password_reset_tokens"
      SET "attempt_count" = "attempt_count" + 1,
          "last_attempt_at" = NOW(),
          "status" = CASE
            WHEN "attempt_count" + 1 >= "max_attempts" THEN 'EXHAUSTED'::"AuthChallengeStatus"
            ELSE "status"
          END
      WHERE "id" = ${id}
        AND "status" = 'ACTIVE'::"AuthChallengeStatus"
        AND "expires_at" > NOW()
        AND "attempt_count" < "max_attempts"
      RETURNING "attempt_count"
    `);
    return rows.length === 1;
  }

  consume(id: string) {
    return getPrismaClient().passwordResetToken.updateMany({
      where: { id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
  }
}

export class AuthEventRepository {
  constructor(private readonly privacySecret: string) {}

  async append(input: {
    userId?: string;
    sessionId?: string;
    eventType: string;
    outcome: "SUCCEEDED" | "FAILED" | "DENIED";
    reasonCode?: string;
    requestId?: string;
    context?: Record<string, string>;
    identifier?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const { identifier, ip, userAgent, ...safe } = input;
    const hash = (domain: string, value: string) =>
      createHmac("sha256", this.privacySecret)
        .update(`${domain}:${value}`)
        .digest("hex");
    try {
      return await getPrismaClient().authEvent.create({
        data: {
          ...safe,
          ...(identifier === undefined
            ? {}
            : { identifierHash: hash("identifier", identifier) }),
          ...(ip === undefined ? {} : { ipHash: hash("ip", ip) }),
          ...(userAgent === undefined
            ? {}
            : { userAgentHash: hash("user-agent", userAgent) }),
        },
      });
    } catch {
      throw authenticationError("AUTH_EVENT_WRITE_FAILED");
    }
  }
}

export class SocialAccountRepository {
  findGoogle(subject: string) {
    return getPrismaClient().socialAccount.findUnique({
      where: {
        provider_providerSubject: {
          provider: "GOOGLE",
          providerSubject: subject,
        },
      },
    });
  }

  findGoogleByUserId(userId: string) {
    return getPrismaClient().socialAccount.findUnique({
      where: {
        userId_provider_accountCategory: {
          userId,
          provider: "GOOGLE",
          accountCategory: "INDIVIDUAL",
        },
      },
    });
  }

  updateGoogleProfile(
    subject: string,
    profile: { displayName?: string; avatarUrl?: string },
  ) {
    return getPrismaClient().socialAccount.update({
      where: {
        provider_providerSubject: {
          provider: "GOOGLE",
          providerSubject: subject,
        },
      },
      data: {
        ...(profile.displayName === undefined
          ? {}
          : { providerDisplayName: profile.displayName }),
        ...(profile.avatarUrl === undefined
          ? {}
          : { providerAvatarUrl: profile.avatarUrl }),
        lastAuthenticatedAt: new Date(),
      },
    });
  }

  link(userId: string, subject: string, email?: string) {
    return getPrismaClient().socialAccount.create({
      data: {
        userId,
        provider: "GOOGLE",
        accountCategory: "INDIVIDUAL",
        providerSubject: subject,
        providerEmailNormalized: email ?? null,
        providerEmailVerifiedAt: email === undefined ? null : new Date(),
      },
    });
  }

  unlink(userId: string) {
    return getPrismaClient().socialAccount.deleteMany({
      where: { userId, provider: "GOOGLE", accountCategory: "INDIVIDUAL" },
    });
  }
}

import { getPrismaClient } from "#integrations/database/index";
import { Prisma } from "#generated/prisma/client";

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
    // Compute the counter, window, and lock in one row update so parallel failures cannot overwrite each other.
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

import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";

import type {
  ProviderIdentityReader,
  ProviderIdentitySnapshot,
} from "../authentication.public.js";
import {
  resolveAuthenticatedCapability,
} from "../domain/auth.policy.js";
import type { AccountCategory } from "../domain/authentication.types.js";
import { mapIdentity } from "./auth.repository.js";

type UserRow = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getPrismaClient>["user"]["findUnique"]>>
>;

type DbClient = Prisma.TransactionClient | ReturnType<typeof getPrismaClient>;

async function toSnapshot(user: UserRow, db: DbClient): Promise<ProviderIdentitySnapshot> {
  const providerAdminGrant = await db.userRole.findFirst({
    where: {
      userId: user.id,
      status: "ENABLED",
      role: { code: "provider_admin" },
    },
    select: { id: true },
  });
  const providerAdminEnabled = providerAdminGrant !== null;
  const identity = mapIdentity(user);
  const capability = resolveAuthenticatedCapability(identity, {
    providerAdminEnabled,
  });

  return {
    userId: user.id,
    status: user.status,
    isAccountActive: user.status === "ACTIVE",
    isActiveNonVerificationOnly:
      user.status === "ACTIVE" && capability === "FULL",
    accountCategories: user.accountCategories as AccountCategory[],
    verifiedCategories: user.verifiedCategories as AccountCategory[],
    emailNormalized: user.emailNormalized,
    phoneE164: user.phoneE164,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
    providerAdminEnabled,
  };
}

/**
 * Authentication-owned reader of identity/contact and provider_admin role facts.
 * Never queries Provider tables.
 */
export function createPrismaProviderIdentityReader(
  db: DbClient = getPrismaClient(),
): ProviderIdentityReader {
  return {
    async getIdentity(userId): Promise<ProviderIdentitySnapshot | null> {
      const user = await db.user.findUnique({
        where: { id: userId },
      });
      if (user === null) {
        return null;
      }
      return toSnapshot(user, db);
    },

    async findByEmailNormalized(
      emailNormalized,
    ): Promise<ProviderIdentitySnapshot | null> {
      const user = await db.user.findUnique({
        where: { emailNormalized },
      });
      if (user === null) {
        return null;
      }
      return toSnapshot(user, db);
    },
  };
}

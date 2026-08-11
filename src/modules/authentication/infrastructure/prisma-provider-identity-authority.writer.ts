import type { Prisma } from "#generated/prisma/client";

import type {
  ProviderIdentityAuthorityWriter,
  ProviderIdentityAuthorityWriterFactory,
} from "../authentication.public.js";
import { authenticationError } from "../domain/authentication.errors.js";
import type { AccountCategory } from "../domain/authentication.types.js";

const PROVIDER_ADMIN_ROLE_CODE = "provider_admin";
const PROVIDER_OWNER_CATEGORY: AccountCategory = "PROVIDER_OWNER";

type AuthorityTransaction = Pick<
  Prisma.TransactionClient,
  "user" | "role" | "userRole"
>;

function statusTransitionData(
  nextStatus: "ENABLED" | "DISABLED",
  now: Date,
): Prisma.UserRoleUpdateInput {
  if (nextStatus === "ENABLED") {
    return {
      status: nextStatus,
      enabledAt: now,
      disabledAt: null,
      revokedAt: null,
    };
  }
  return { status: nextStatus, disabledAt: now };
}

/**
 * Build the Authentication-owned authority writer for one active Provider
 * transaction. Idempotent; never opens its own transaction.
 */
export function createPrismaProviderIdentityAuthorityWriter(
  transaction: AuthorityTransaction,
): ProviderIdentityAuthorityWriter {
  return {
    async grantOwnerAuthority(userId) {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          accountCategories: true,
          verifiedCategories: true,
        },
      });
      if (user === null) {
        throw authenticationError("AUTH_ACCOUNT_UNAVAILABLE");
      }

      const accountCategories = [
        ...new Set([...user.accountCategories, PROVIDER_OWNER_CATEGORY]),
      ];
      const verifiedCategories = [
        ...new Set([...user.verifiedCategories, PROVIDER_OWNER_CATEGORY]),
      ];
      await transaction.user.update({
        where: { id: userId },
        data: { accountCategories, verifiedCategories },
      });

      await reconcileProviderAdminRoleOnTransaction(transaction, {
        userId,
        shouldBeEnabled: true,
      });
    },

    async reconcileProviderAdminRole(input) {
      await reconcileProviderAdminRoleOnTransaction(transaction, input);
    },
  };
}

async function reconcileProviderAdminRoleOnTransaction(
  transaction: AuthorityTransaction,
  input: { readonly userId: string; readonly shouldBeEnabled: boolean },
): Promise<void> {
  const role = await transaction.role.findUnique({
    where: { code: PROVIDER_ADMIN_ROLE_CODE },
    select: { id: true },
  });
  if (role === null) {
    throw authenticationError("AUTH_ACCOUNT_UNAVAILABLE");
  }

  const existing = await transaction.userRole.findUnique({
    where: {
      userId_roleId: { userId: input.userId, roleId: role.id },
    },
  });
  const now = new Date();

  if (input.shouldBeEnabled) {
    if (existing === null) {
      await transaction.userRole.create({
        data: {
          userId: input.userId,
          roleId: role.id,
          status: "ENABLED",
          assignedAt: now,
          enabledAt: now,
        },
      });
      return;
    }
    if (existing.status === "ENABLED") {
      return;
    }
    if (existing.status === "REVOKED") {
      // Re-assign after revoke: create a fresh ENABLED grant via transition rules.
      await transaction.userRole.update({
        where: { id: existing.id },
        data: statusTransitionData("ENABLED", now),
      });
      return;
    }
    // DISABLED → ENABLED
    await transaction.userRole.update({
      where: { id: existing.id },
      data: statusTransitionData("ENABLED", now),
    });
    return;
  }

  if (existing?.status !== "ENABLED") {
    return;
  }
  await transaction.userRole.update({
    where: { id: existing.id },
    data: statusTransitionData("DISABLED", now),
  });
}

/** Composition injects this factory into Provider unit-of-work wiring. */
export const createPrismaProviderIdentityAuthorityWriterFactory: ProviderIdentityAuthorityWriterFactory =
  (transactionValue) => {
    const transaction = transactionValue as Prisma.TransactionClient;
    return createPrismaProviderIdentityAuthorityWriter(transaction);
  };

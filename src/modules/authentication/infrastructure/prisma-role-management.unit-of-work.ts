import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import type { PrivilegedAuditWriter } from "#modules/admin/audit.service";

import type {
  IdentityUserStore,
  PrivilegedReasonStore,
  RoleDefinitionStore,
  RoleGrantRecord,
  RoleGrantStore,
} from "../domain/authorization.ports.js";
import type { UserRoleStatus } from "../domain/authorization.types.js";
import type {
  RoleManagementUnitOfWork,
  RoleManagementUnitOfWorkContext,
} from "../role-management.unit-of-work.js";

/**
 * Builds the admin-owned audit writer for the active transaction. Composition
 * injects the admin factory so identity never maps audit persistence itself.
 */
export type PrivilegedAuditWriterFactory = (
  transaction: Prisma.TransactionClient,
) => PrivilegedAuditWriter;

type StoredUserRole = {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly status: UserRoleStatus;
  readonly assignedAt: Date;
  readonly enabledAt: Date | null;
  readonly disabledAt: Date | null;
  readonly revokedAt: Date | null;
};

function toGrantRecord(stored: StoredUserRole): RoleGrantRecord {
  return {
    id: stored.id,
    userId: stored.userId,
    roleId: stored.roleId,
    status: stored.status,
    assignedAt: stored.assignedAt,
    enabledAt: stored.enabledAt,
    disabledAt: stored.disabledAt,
    revokedAt: stored.revokedAt,
  };
}

/**
 * Timestamp rules for a real grant transition:
 * - into ENABLED: stamp `enabledAt`, clear `disabledAt` and `revokedAt`
 * - into DISABLED: stamp `disabledAt`
 * - into REVOKED: stamp `revokedAt`
 *
 * `assignedAt` is never rewritten, so the first-assignment intent survives a
 * revoke followed by a later re-assignment.
 */
function statusTransitionData(
  nextStatus: UserRoleStatus,
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
  if (nextStatus === "DISABLED") {
    return { status: nextStatus, disabledAt: now };
  }
  return { status: nextStatus, revokedAt: now };
}

function createRoleGrantStore(
  transaction: Prisma.TransactionClient,
): RoleGrantStore {
  return {
    async findByUserAndRole(userId, roleId) {
      const stored = await transaction.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
      });
      return stored === null ? null : toGrantRecord(stored);
    },
    async createEnabledGrant({ userId, roleId }) {
      const now = new Date();
      const stored = await transaction.userRole.create({
        data: {
          userId,
          roleId,
          status: "ENABLED",
          assignedAt: now,
          enabledAt: now,
        },
      });
      return toGrantRecord(stored);
    },
    async applyStatusTransition({ grantId, nextStatus }) {
      const stored = await transaction.userRole.update({
        where: { id: grantId },
        data: statusTransitionData(nextStatus, new Date()),
      });
      return toGrantRecord(stored);
    },
    async findEnabledRolesAndPermissions(userId) {
      const grants = await transaction.userRole.findMany({
        where: { userId, status: "ENABLED" },
        select: {
          role: {
            select: {
              code: true,
              rolePermissions: {
                select: { permission: { select: { code: true } } },
              },
            },
          },
        },
      });

      const roleCodes = new Set<string>();
      const permissionCodes = new Set<string>();
      for (const grant of grants) {
        roleCodes.add(grant.role.code);
        for (const rolePermission of grant.role.rolePermissions) {
          permissionCodes.add(rolePermission.permission.code);
        }
      }

      return {
        roleCodes: [...roleCodes],
        permissionCodes: [...permissionCodes],
      };
    },
  };
}

function createRoleDefinitionStore(
  transaction: Prisma.TransactionClient,
): RoleDefinitionStore {
  return {
    async findByCode(code) {
      const stored = await transaction.role.findUnique({ where: { code } });
      return stored === null
        ? null
        : { id: stored.id, code: stored.code, name: stored.name };
    },
  };
}

function createPrivilegedReasonStore(
  transaction: Prisma.TransactionClient,
): PrivilegedReasonStore {
  return {
    async findByCode(code) {
      const stored = await transaction.privilegedActionReason.findUnique({
        where: { code },
      });
      return stored === null
        ? null
        : {
            code: stored.code,
            operation: stored.operation,
            isActive: stored.isActive,
          };
    },
  };
}

function createIdentityUserStore(
  transaction: Prisma.TransactionClient,
): IdentityUserStore {
  return {
    async exists(userId) {
      const stored = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      return stored !== null;
    },
  };
}

/**
 * Opens one short transaction for a role-management workflow and hands the
 * service business ports only. It never touches the admin audit delegate: the
 * injected admin factory owns that mapping.
 */
export class PrismaRoleManagementUnitOfWork
  implements RoleManagementUnitOfWork
{
  private readonly createAuditWriter: PrivilegedAuditWriterFactory;

  constructor(createAuditWriter: PrivilegedAuditWriterFactory) {
    this.createAuditWriter = createAuditWriter;
  }

  async run<T>(
    work: (context: RoleManagementUnitOfWorkContext) => Promise<T>,
  ): Promise<T> {
    return getPrismaClient().$transaction(async (transaction) => {
      const context: RoleManagementUnitOfWorkContext = {
        grants: createRoleGrantStore(transaction),
        roles: createRoleDefinitionStore(transaction),
        reasons: createPrivilegedReasonStore(transaction),
        users: createIdentityUserStore(transaction),
        audit: this.createAuditWriter(transaction),
      };
      return work(context);
    });
  }
}

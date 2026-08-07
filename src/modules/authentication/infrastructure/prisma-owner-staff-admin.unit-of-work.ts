import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import type { PrivilegedAuditWriter } from "#modules/admin/audit.service";

import type {
  RoleDefinitionStore,
  RoleGrantRecord,
  RoleGrantStore,
} from "../domain/authorization.ports.js";
import type { UserRoleStatus } from "../domain/authorization.types.js";
import type {
  OwnerProvisionTarget,
  OwnerStaffAdminUnitOfWork,
  OwnerStaffAdminUnitOfWorkContext,
} from "../owner-staff-admin.service.js";

type PrivilegedAuditWriterFactory = (
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

async function findTargetByEmail(
  transaction: Prisma.TransactionClient,
  emailNormalized: string,
): Promise<OwnerProvisionTarget | null> {
  const stored = await transaction.user.findUnique({
    where: { emailNormalized },
    select: {
      id: true,
      status: true,
      emailVerifiedAt: true,
    },
  });
  if (stored === null) {
    return null;
  }
  return {
    userId: stored.id,
    status: stored.status,
    emailVerified: stored.emailVerifiedAt !== null,
  };
}

/** Authentication-owned transaction for owner staff_admin provisioning. */
export class PrismaOwnerStaffAdminUnitOfWork
  implements OwnerStaffAdminUnitOfWork
{
  constructor(private readonly createAuditWriter: PrivilegedAuditWriterFactory) {}

  async run<T>(
    work: (context: OwnerStaffAdminUnitOfWorkContext) => Promise<T>,
  ): Promise<T> {
    return getPrismaClient().$transaction(async (transaction) => {
      const context: OwnerStaffAdminUnitOfWorkContext = {
        findTargetByEmail: (email) => findTargetByEmail(transaction, email),
        grants: createRoleGrantStore(transaction),
        roles: createRoleDefinitionStore(transaction),
        audit: this.createAuditWriter(transaction),
      };
      return work(context);
    });
  }
}

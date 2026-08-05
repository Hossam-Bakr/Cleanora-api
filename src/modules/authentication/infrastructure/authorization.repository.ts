import { getPrismaClient } from "#database/prisma";

import type { AuthorizationGrantReader } from "../domain/authorization.ports.js";
import type { EffectivePermissions } from "../domain/authorization.types.js";

/**
 * Reads authorization definitions and grants outside any transaction.
 *
 * Every call queries the database directly. There is no cache, so revoking or
 * disabling a grant takes effect on the very next authorization check.
 */
export class AuthorizationRepository implements AuthorizationGrantReader {
  /**
   * Load the enabled role codes and their permission codes for one user.
   *
   * Only `ENABLED` grants are read, so `DISABLED` and `REVOKED` grants can
   * never contribute a permission.
   */
  async findEnabledRolesAndPermissions(
    userId: string,
  ): Promise<EffectivePermissions> {
    const grants = await getPrismaClient().userRole.findMany({
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
  }
}

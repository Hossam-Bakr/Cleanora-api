import type { AuthenticationPrincipal } from "../../../src/modules/authentication/domain/authentication.types.js";
import { permissionCodesForRole } from "../../../src/modules/authentication/domain/authorization.catalog.js";
import type { AuthorizationGrantReader } from "../../../src/modules/authentication/domain/authorization.ports.js";

/**
 * Synthetic authorization fixtures.
 *
 * Tests build trusted principals and enabled grants in memory. R1-P03 never
 * creates production grants, so authorization evidence uses these fixtures.
 */

export function createTestPrincipal(
  overrides: Partial<AuthenticationPrincipal> = {},
): AuthenticationPrincipal {
  return {
    userId: "actor-1",
    sessionId: "session-1",
    accountCategories: ["INDIVIDUAL"],
    verifiedCategories: ["INDIVIDUAL"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
    ...overrides,
  };
}

/**
 * Grant reader backed by a plain map of user id to enabled role codes.
 * Permissions come from the seeded FR-002 role-permission map, so the fixture
 * cannot invent a permission the catalog does not grant.
 */
export function createGrantReaderForEnabledRoles(
  enabledRolesByUserId: Readonly<Record<string, readonly string[]>>,
): AuthorizationGrantReader {
  return {
    async findEnabledRolesAndPermissions(userId) {
      const roleCodes = enabledRolesByUserId[userId] ?? [];
      const permissionCodes = new Set<string>();
      for (const roleCode of roleCodes) {
        for (const permissionCode of permissionCodesForRole(roleCode)) {
          permissionCodes.add(permissionCode);
        }
      }
      return { roleCodes, permissionCodes: [...permissionCodes] };
    },
  };
}

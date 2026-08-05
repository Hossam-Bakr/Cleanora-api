import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import type { AuthorizationGrantReader } from "../../../../src/modules/authentication/domain/authorization.ports.js";
import { permissionCodesForRole } from "../../../../src/modules/authentication/domain/authorization.catalog.js";
import { createTestPrincipal } from "../../../helpers/authorization/authorization-fixtures.js";

/** Grant reader whose enabled roles can change between calls, like the database. */
function createMutableGrantReader(initialRoleCodes: readonly string[]) {
  let roleCodes = [...initialRoleCodes];
  let readCount = 0;

  const reader: AuthorizationGrantReader = {
    async findEnabledRolesAndPermissions() {
      readCount += 1;
      const permissionCodes = new Set<string>();
      for (const roleCode of roleCodes) {
        for (const permissionCode of permissionCodesForRole(roleCode)) {
          permissionCodes.add(permissionCode);
        }
      }
      return { roleCodes: [...roleCodes], permissionCodes: [...permissionCodes] };
    },
  };

  return {
    reader,
    setEnabledRoles(nextRoleCodes: readonly string[]) {
      roleCodes = [...nextRoleCodes];
    },
    readCount: () => readCount,
  };
}

describe("authorization freshness after revoke or disable", () => {
  it("denies on the very next check after the grant stops being ENABLED", async () => {
    const grants = createMutableGrantReader(["staff_admin"]);
    const service = new AuthorizationService(grants.reader);
    const principal = createTestPrincipal();

    await expect(
      service.authorize({ principal, permissionCode: "authz.roles.assign" }),
    ).resolves.toEqual({ allowed: true });

    grants.setEnabledRoles([]);

    await expect(
      service.authorize({ principal, permissionCode: "authz.roles.assign" }),
    ).resolves.toEqual({ allowed: false, denialCode: "PERMISSION_DENIED" });
  });

  it("reports fresh effective permissions with no cache-invalidation call", async () => {
    const grants = createMutableGrantReader(["customer", "staff_support"]);
    const service = new AuthorizationService(grants.reader);
    const principal = createTestPrincipal();

    await service.effectivePermissions(principal);
    grants.setEnabledRoles(["customer"]);

    const permissions = await service.effectivePermissions(principal);

    expect(permissions.roleCodes).toEqual(["customer"]);
    expect(permissions.permissionCodes).not.toContain(
      "authz.staff.support.sample",
    );
  });

  it("reads grants again for every decision", async () => {
    const grants = createMutableGrantReader(["staff_admin"]);
    const service = new AuthorizationService(grants.reader);
    const principal = createTestPrincipal();

    await service.authorize({ principal, permissionCode: "authz.roles.assign" });
    await service.authorize({ principal, permissionCode: "authz.roles.assign" });
    await service.effectivePermissions(principal);

    expect(grants.readCount()).toBe(3);
  });

  it("keeps no module-level permission cache in the service source", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/authentication/authorization.service.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bcache\b/iu);
    expect(source).not.toMatch(/new Map\(/u);
    expect(source).not.toMatch(/\bttl\b/iu);
  });
});

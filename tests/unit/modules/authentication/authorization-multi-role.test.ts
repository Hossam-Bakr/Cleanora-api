import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

describe("multi-role effective permissions", () => {
  it("unions the permissions of every ENABLED role the actor holds", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({
        "actor-1": ["customer", "staff_support"],
      }),
    );

    const permissions = await service.effectivePermissions(
      createTestPrincipal(),
    );

    expect([...permissions.roleCodes].sort()).toEqual([
      "customer",
      "staff_support",
    ]);
    expect([...permissions.permissionCodes].sort()).toEqual([
      "authz.reasons.use",
      "authz.staff.support.sample",
      "resource.self.read",
      "resource.self.write",
    ]);
  });

  it("allows a permission that comes from either role", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({
        "actor-1": ["customer", "staff_admin"],
      }),
    );
    const principal = createTestPrincipal();

    await expect(
      service.authorize({
        principal,
        permissionCode: "resource.self.read",
        ownership: { type: "SELF", resourceOwnerUserId: "actor-1" },
      }),
    ).resolves.toEqual({ allowed: true });
    await expect(
      service.authorize({ principal, permissionCode: "authz.roles.enable" }),
    ).resolves.toEqual({ allowed: true });
  });

  it("lists a shared permission once even when two roles grant it", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({
        "actor-1": ["staff_support", "staff_finance"],
      }),
    );

    const permissions = await service.effectivePermissions(
      createTestPrincipal(),
    );

    expect(
      permissions.permissionCodes.filter(
        (code) => code === "authz.reasons.use",
      ),
    ).toHaveLength(1);
  });

  it("still denies a permission that none of the held roles grant", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({
        "actor-1": ["staff_support", "staff_finance", "customer"],
      }),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.roles.assign",
    });

    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });

  it("never lets one staff role imply another staff role's sample power", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["staff_support"] }),
    );
    const principal = createTestPrincipal();

    await expect(
      service.authorize({
        principal,
        permissionCode: "authz.staff.support.sample",
      }),
    ).resolves.toEqual({ allowed: true });

    for (const otherStaffSample of [
      "authz.staff.admin.sample",
      "authz.staff.operations.sample",
      "authz.staff.finance.sample",
    ]) {
      const decision = await service.authorize({
        principal,
        permissionCode: otherStaffSample,
      });
      expect(decision.denialCode).toBe("PERMISSION_DENIED");
    }
  });
});

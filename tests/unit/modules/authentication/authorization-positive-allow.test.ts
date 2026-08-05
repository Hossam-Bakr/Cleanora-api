import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

describe("positive authorization allow path", () => {
  it("allows a staff_admin actor to assign roles", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["staff_admin"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.roles.assign",
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("lists the permissions the actor's ENABLED role grants", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["customer"] }),
    );

    const permissions = await service.effectivePermissions(
      createTestPrincipal(),
    );

    expect(permissions.roleCodes).toEqual(["customer"]);
    expect([...permissions.permissionCodes].sort()).toEqual([
      "resource.self.read",
      "resource.self.write",
    ]);
  });

  it("allows a self-owned resource write when ownership matches the actor", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["customer"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "resource.self.write",
        ownership: { type: "SELF", resourceOwnerUserId: "actor-1" },
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("allows a declared protected operation when the actor holds its permission", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["staff_admin"] }),
    );

    await expect(
      service.authorizeProtectedOperation({
        principal: createTestPrincipal(),
        operationId: "identity.roles.disable",
        scope: { kind: "GLOBAL" },
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("allows a usable resource state", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["staff_admin"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.roles.revoke",
        resourceState: { usable: true },
      }),
    ).resolves.toEqual({ allowed: true });
  });
});

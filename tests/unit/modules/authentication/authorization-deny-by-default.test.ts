import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

describe("deny-by-default authorization", () => {
  it("denies a principal that holds no role grant at all", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({}),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.roles.assign",
    });

    expect(decision).toEqual({
      allowed: false,
      denialCode: "PERMISSION_DENIED",
    });
  });

  it("denies a permission that none of the principal's roles grant", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["customer"] }),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.roles.assign",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });

  it("reports no effective permissions for a principal without grants", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({}),
    );

    await expect(
      service.effectivePermissions(createTestPrincipal()),
    ).resolves.toEqual({ roleCodes: [], permissionCodes: [] });
  });

  it("denies an unknown permission code even for a fully granted staff actor", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["staff_admin"] }),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.roles.invent",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });

  it("never derives permissions from account categories", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({}),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal({
        accountCategories: ["PROVIDER_OWNER", "WORKER"],
        verifiedCategories: ["PROVIDER_OWNER", "WORKER"],
      }),
      permissionCode: "authz.scope.worker",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });
});

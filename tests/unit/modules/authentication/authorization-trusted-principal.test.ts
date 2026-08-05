import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

/**
 * Authorization trusts only the server-established `AuthenticationPrincipal`
 * and the stored grants it can read. Anything a client could send is ignored.
 */
describe("trusted-principal-only authorization", () => {
  it("keeps the AuthenticationPrincipal public shape unchanged", () => {
    expect(Object.keys(createTestPrincipal()).sort()).toEqual([
      "accountCategories",
      "pendingCategories",
      "sessionId",
      "status",
      "userId",
      "verificationOnly",
      "verifiedCategories",
    ]);
  });

  it("ignores client-supplied role codes on the principal", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({}),
    );
    const principalWithClientClaims = {
      ...createTestPrincipal(),
      roleCodes: ["staff_admin"],
      permissionCodes: ["authz.roles.assign"],
    };

    const decision = await service.authorize({
      principal: principalWithClientClaims,
      permissionCode: "authz.roles.assign",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });

  it("reads grants for the principal's user id, never a client-named user", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-2": ["staff_admin"] }),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal({ userId: "actor-1" }),
      permissionCode: "authz.roles.assign",
    });

    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });

  it("denies a claimed ownership fact that does not name the actor", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["customer"] }),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal({ userId: "actor-1" }),
      permissionCode: "resource.self.write",
      ownership: { type: "SELF", resourceOwnerUserId: "someone-else" },
    });

    expect(decision).toEqual({
      allowed: false,
      denialCode: "OWNERSHIP_DENIED",
    });
  });

  it("does not treat a permission code as authority by itself", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({}),
    );

    for (const permissionCode of [
      "authz.roles.assign",
      "authz.staff.admin.sample",
      "resource.self.write",
    ]) {
      const decision = await service.authorize({
        principal: createTestPrincipal(),
        permissionCode,
      });
      expect(decision.allowed).toBe(false);
    }
  });
});

import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import { isAccountStateUsableForAuthorization } from "../../../../src/modules/authentication/authorization.policy.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

function serviceForStaffAdmin(): AuthorizationService {
  return new AuthorizationService(
    createGrantReaderForEnabledRoles({ "actor-1": ["staff_admin"] }),
  );
}

describe("account-state authorization rules", () => {
  it.each(["SUSPENDED", "BANNED"] as const)(
    "denies a %s account even when the role grants the permission",
    async (status) => {
      const decision = await serviceForStaffAdmin().authorize({
        principal: createTestPrincipal({ status }),
        permissionCode: "authz.roles.assign",
      });

      expect(decision).toEqual({
        allowed: false,
        denialCode: "ACCOUNT_STATE_DENIED",
      });
    },
  );

  it("denies a verification-only session", async () => {
    const decision = await serviceForStaffAdmin().authorize({
      principal: createTestPrincipal({ verificationOnly: true }),
      permissionCode: "authz.roles.assign",
    });

    expect(decision.denialCode).toBe("ACCOUNT_STATE_DENIED");
  });

  it("returns no effective permissions for an unusable account state", async () => {
    await expect(
      serviceForStaffAdmin().effectivePermissions(
        createTestPrincipal({ status: "SUSPENDED" }),
      ),
    ).resolves.toEqual({ roleCodes: [], permissionCodes: [] });
  });

  it("denies an unusable resource state before checking anything else", async () => {
    const decision = await serviceForStaffAdmin().authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.roles.assign",
      resourceState: { usable: false },
    });

    expect(decision.denialCode).toBe("RESOURCE_STATE_DENIED");
  });

  it("accepts only an active, fully authenticated principal", () => {
    expect(isAccountStateUsableForAuthorization(createTestPrincipal())).toBe(
      true,
    );
    expect(
      isAccountStateUsableForAuthorization(
        createTestPrincipal({ status: "SUSPENDED" }),
      ),
    ).toBe(false);
    expect(
      isAccountStateUsableForAuthorization(
        createTestPrincipal({ verificationOnly: true }),
      ),
    ).toBe(false);
  });
});

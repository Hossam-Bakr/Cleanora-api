import {
  isOwnershipFactSatisfied,
  isOwnershipRuleSatisfied,
} from "../../../../src/modules/authentication/authorization.policy.js";
import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

function customerService(): AuthorizationService {
  return new AuthorizationService(
    createGrantReaderForEnabledRoles({ "actor-1": ["customer"] }),
  );
}

describe("ownership rules", () => {
  it("allows a self-owned resource", async () => {
    await expect(
      customerService().authorize({
        principal: createTestPrincipal(),
        permissionCode: "resource.self.read",
        ownership: { type: "SELF", resourceOwnerUserId: "actor-1" },
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("denies another user's resource even with the permission", async () => {
    await expect(
      customerService().authorize({
        principal: createTestPrincipal(),
        permissionCode: "resource.self.read",
        ownership: { type: "SELF", resourceOwnerUserId: "actor-2" },
      }),
    ).resolves.toEqual({ allowed: false, denialCode: "OWNERSHIP_DENIED" });
  });

  it("checks the permission before ownership", async () => {
    const decision = await customerService().authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.roles.assign",
      ownership: { type: "SELF", resourceOwnerUserId: "actor-2" },
    });

    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });

  it("matches a SELF fact only against the principal's own id", () => {
    const principal = createTestPrincipal({ userId: "actor-1" });

    expect(
      isOwnershipFactSatisfied(principal, {
        type: "SELF",
        resourceOwnerUserId: "actor-1",
      }),
    ).toBe(true);
    expect(
      isOwnershipFactSatisfied(principal, {
        type: "SELF",
        resourceOwnerUserId: "actor-9",
      }),
    ).toBe(false);
  });

  it("treats a NONE ownership rule as satisfied and a missing SELF fact as denied", () => {
    const principal = createTestPrincipal();

    expect(isOwnershipRuleSatisfied("NONE", principal, undefined)).toBe(true);
    expect(isOwnershipRuleSatisfied("SELF", principal, undefined)).toBe(false);
  });
});

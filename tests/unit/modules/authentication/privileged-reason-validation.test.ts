import { RoleManagementService } from "../../../../src/modules/authentication/role-management.service.js";
import { createTestPrincipal } from "../../../helpers/authorization/authorization-fixtures.js";
import {
  createFakeRoleManagementWorld,
  type FakeRoleManagementWorld,
} from "../../../helpers/authorization/fake-role-management-unit-of-work.js";

const actor = createTestPrincipal({ userId: "actor-1" });

function serviceFor(world: FakeRoleManagementWorld): RoleManagementService {
  return new RoleManagementService(world.unitOfWork);
}

function worldWithEnabledGrant(): FakeRoleManagementWorld {
  return createFakeRoleManagementWorld({
    grants: [{ userId: "target-1", roleCode: "customer", status: "ENABLED" }],
  });
}

const command = {
  actor,
  targetUserId: "target-1",
  roleCode: "customer",
};

/** Each operation accepts only the reason code bound to that exact operation. */
describe("exact reason-to-operation matching", () => {
  it("accepts role_grant_disable for disableRole", async () => {
    const world = worldWithEnabledGrant();

    const result = await serviceFor(world).disableRole({
      ...command,
      reasonCode: "role_grant_disable",
    });

    expect(result).toMatchObject({
      mutated: true,
      status: "DISABLED",
      auditAppended: true,
    });
  });

  it("rejects role_grant_assign for disableRole", async () => {
    const world = worldWithEnabledGrant();

    await expect(
      serviceFor(world).disableRole({
        ...command,
        reasonCode: "role_grant_assign",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_REASON_INVALID" });
    expect(world.grantStatus("target-1", "customer")).toBe("ENABLED");
    expect(world.auditAppends).toHaveLength(0);
  });

  it("accepts role_grant_enable for enableRole", async () => {
    const world = createFakeRoleManagementWorld({
      grants: [
        { userId: "target-1", roleCode: "customer", status: "DISABLED" },
      ],
    });

    const result = await serviceFor(world).enableRole({
      ...command,
      reasonCode: "role_grant_enable",
    });

    expect(result).toMatchObject({
      mutated: true,
      status: "ENABLED",
      auditAppended: true,
    });
  });

  it("accepts role_grant_assign for assignRole", async () => {
    const world = createFakeRoleManagementWorld();

    const result = await serviceFor(world).assignRole({
      ...command,
      reasonCode: "role_grant_assign",
    });

    expect(result).toMatchObject({
      mutated: true,
      status: "ENABLED",
      auditAppended: true,
    });
  });

  it("accepts role_grant_revoke for revokeRole", async () => {
    const world = worldWithEnabledGrant();

    const result = await serviceFor(world).revokeRole({
      ...command,
      reasonCode: "role_grant_revoke",
    });

    expect(result).toMatchObject({
      mutated: true,
      status: "REVOKED",
      auditAppended: true,
    });
  });
});

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

function worldWithEnabledCustomerGrant(
  actorRoles?: readonly string[],
): FakeRoleManagementWorld {
  return createFakeRoleManagementWorld({
    ...(actorRoles === undefined ? {} : { actorRoles }),
    grants: [{ userId: "target-1", roleCode: "customer", status: "ENABLED" }],
  });
}

const command = {
  actor,
  targetUserId: "target-1",
  roleCode: "customer",
  reasonCode: "role_grant_assign",
};

/**
 * An authorized no-op still has to pass every precondition. It simply changes
 * nothing, so it never appends audit evidence.
 */
describe("validation before an authorized no-op", () => {
  it("still requires the operation permission", async () => {
    const world = worldWithEnabledCustomerGrant(["customer"]);

    await expect(serviceFor(world).assignRole(command)).rejects.toMatchObject({
      code: "AUTHZ_PERMISSION_DENIED",
    });
    expect(world.auditAppends).toHaveLength(0);
  });

  it("still requires a usable actor account state", async () => {
    const world = worldWithEnabledCustomerGrant();

    await expect(
      serviceFor(world).assignRole({
        ...command,
        actor: createTestPrincipal({ userId: "actor-1", status: "SUSPENDED" }),
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ACCOUNT_STATE_DENIED" });
  });

  it("still requires an existing target user", async () => {
    const world = createFakeRoleManagementWorld({
      existingUserIds: ["actor-1"],
      grants: [{ userId: "target-1", roleCode: "customer", status: "ENABLED" }],
    });

    await expect(serviceFor(world).assignRole(command)).rejects.toMatchObject({
      code: "AUTHZ_TARGET_USER_NOT_FOUND",
    });
  });

  it("still requires a role code from the seeded catalog", async () => {
    const world = worldWithEnabledCustomerGrant();

    await expect(
      serviceFor(world).assignRole({ ...command, roleCode: "invented_role" }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_UNKNOWN" });
  });

  it("still requires the exact active operation-bound reason", async () => {
    const world = worldWithEnabledCustomerGrant();

    await expect(
      serviceFor(world).assignRole({
        ...command,
        reasonCode: "role_grant_revoke",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_REASON_INVALID" });
    expect(world.auditAppends).toHaveLength(0);
  });

  it("appends no audit row for an authorized no-op", async () => {
    const world = worldWithEnabledCustomerGrant();

    const result = await serviceFor(world).assignRole(command);

    expect(result).toEqual({
      targetUserId: "target-1",
      roleCode: "customer",
      status: "ENABLED",
      mutated: false,
      auditAppended: false,
    });
    expect(world.auditAppends).toHaveLength(0);
    expect(world.grantStatus("target-1", "customer")).toBe("ENABLED");
  });
});

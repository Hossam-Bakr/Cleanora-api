import { RoleManagementService } from "../../../../src/modules/authentication/role-management.service.js";
import { createTestPrincipal } from "../../../helpers/authorization/authorization-fixtures.js";
import { createFakeRoleManagementWorld } from "../../../helpers/authorization/fake-role-management-unit-of-work.js";

const actor = createTestPrincipal({ userId: "actor-1" });

function buildWorldAndService() {
  const world = createFakeRoleManagementWorld({
    existingUserIds: ["actor-1", "target-1"],
    grants: [
      { userId: "actor-1", roleCode: "staff_admin", status: "ENABLED" },
      { userId: "actor-1", roleCode: "customer", status: "ENABLED" },
    ],
  });
  const service = new RoleManagementService(world.unitOfWork);
  return { world, service };
}

const selfCommand = {
  actor,
  targetUserId: "actor-1",
  roleCode: "customer",
};

/** An actor may never change their own grants, even with every permission. */
describe("self-management and self-escalation denial", () => {
  it("denies assigning a role to yourself", async () => {
    const { world, service } = buildWorldAndService();

    await expect(
      service.assignRole({ ...selfCommand, reasonCode: "role_grant_assign" }),
    ).rejects.toMatchObject({ code: "AUTHZ_SELF_MANAGEMENT_DENIED" });
    expect(world.auditAppends).toHaveLength(0);
  });

  it("denies enabling your own grant", async () => {
    const { service } = buildWorldAndService();

    await expect(
      service.enableRole({ ...selfCommand, reasonCode: "role_grant_enable" }),
    ).rejects.toMatchObject({ code: "AUTHZ_SELF_MANAGEMENT_DENIED" });
  });

  it("denies disabling your own grant", async () => {
    const { service } = buildWorldAndService();

    await expect(
      service.disableRole({ ...selfCommand, reasonCode: "role_grant_disable" }),
    ).rejects.toMatchObject({ code: "AUTHZ_SELF_MANAGEMENT_DENIED" });
  });

  it("denies revoking your own grant", async () => {
    const { world, service } = buildWorldAndService();

    await expect(
      service.revokeRole({ ...selfCommand, reasonCode: "role_grant_revoke" }),
    ).rejects.toMatchObject({ code: "AUTHZ_SELF_MANAGEMENT_DENIED" });
    expect(world.grantStatus("actor-1", "customer")).toBe("ENABLED");
    expect(world.auditAppends).toHaveLength(0);
  });
});

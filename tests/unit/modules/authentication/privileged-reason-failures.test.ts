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

const command = {
  actor,
  targetUserId: "target-1",
  roleCode: "customer",
};

/** Every bad reason fails closed: no mutation and no audit evidence. */
describe("privileged reason failures", () => {
  it("rejects a missing reason code", async () => {
    const world = createFakeRoleManagementWorld();

    await expect(
      serviceFor(world).assignRole({ ...command, reasonCode: "" }),
    ).rejects.toMatchObject({ code: "AUTHZ_REASON_INVALID" });
    expect(world.grantStatus("target-1", "customer")).toBeUndefined();
    expect(world.auditAppends).toHaveLength(0);
  });

  it("rejects an unknown reason code", async () => {
    const world = createFakeRoleManagementWorld();

    await expect(
      serviceFor(world).assignRole({
        ...command,
        reasonCode: "invented_reason",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_REASON_INVALID" });
    expect(world.auditAppends).toHaveLength(0);
  });

  it("rejects a deactivated reason code", async () => {
    const world = createFakeRoleManagementWorld({
      inactiveReasonCodes: ["role_grant_assign"],
    });

    await expect(
      serviceFor(world).assignRole({
        ...command,
        reasonCode: "role_grant_assign",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_REASON_INVALID" });
    expect(world.grantStatus("target-1", "customer")).toBeUndefined();
  });

  it("rejects an actor who may not supply privileged reasons", async () => {
    const world = createFakeRoleManagementWorld({
      actorRoles: ["customer"],
    });

    await expect(
      serviceFor(world).assignRole({
        ...command,
        reasonCode: "role_grant_assign",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_PERMISSION_DENIED" });
  });

  it("rejects an operation-mismatched reason on a no-op call too", async () => {
    const world = createFakeRoleManagementWorld({
      grants: [{ userId: "target-1", roleCode: "customer", status: "ENABLED" }],
    });

    await expect(
      serviceFor(world).assignRole({
        ...command,
        reasonCode: "role_grant_disable",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_REASON_INVALID" });
    expect(world.grantStatus("target-1", "customer")).toBe("ENABLED");
    expect(world.auditAppends).toHaveLength(0);
  });
});

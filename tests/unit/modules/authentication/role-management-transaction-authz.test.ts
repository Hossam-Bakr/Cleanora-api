import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import { RoleManagementService } from "../../../../src/modules/authentication/role-management.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";
import { createFakeRoleManagementWorld } from "../../../helpers/authorization/fake-role-management-unit-of-work.js";

const actor = createTestPrincipal({ userId: "actor-1" });

/**
 * T084: actor authorization must read grants inside the unit of work. A stale
 * allow from before the transaction must not complete a privileged mutation.
 */
describe("transaction-scoped actor authorization", () => {
  it("denies a mutation when the actor grant is revoked as the transaction starts", async () => {
    const world = createFakeRoleManagementWorld({
      grants: [
        { userId: "actor-1", roleCode: "staff_admin", status: "ENABLED" },
      ],
      // Simulates a concurrent revoke that lands before in-transaction checks.
      revokeActorStaffAdminOnRunStart: true,
    });

    // Outside the transaction the actor still appears fully authorized.
    const staleAuthorization = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["staff_admin"] }),
    );
    await expect(
      staleAuthorization.authorizeProtectedOperation({
        principal: actor,
        operationId: "identity.roles.assign",
      }),
    ).resolves.toEqual({ allowed: true });

    const service = new RoleManagementService(world.unitOfWork);

    await expect(
      service.assignRole({
        actor,
        targetUserId: "target-1",
        roleCode: "customer",
        reasonCode: "role_grant_assign",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_PERMISSION_DENIED" });

    expect(world.grantStatus("target-1", "customer")).toBeUndefined();
    expect(world.auditAppends).toHaveLength(0);
  });

  it("still allows assign when the actor grant stays ENABLED inside the transaction", async () => {
    const world = createFakeRoleManagementWorld({
      grants: [
        { userId: "actor-1", roleCode: "staff_admin", status: "ENABLED" },
      ],
    });
    const service = new RoleManagementService(world.unitOfWork);

    await expect(
      service.assignRole({
        actor,
        targetUserId: "target-1",
        roleCode: "customer",
        reasonCode: "role_grant_assign",
      }),
    ).resolves.toMatchObject({ mutated: true, status: "ENABLED" });
  });
});

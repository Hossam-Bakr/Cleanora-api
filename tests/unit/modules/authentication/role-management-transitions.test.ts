import { RoleManagementService } from "../../../../src/modules/authentication/role-management.service.js";
import type { UserRoleStatus } from "../../../../src/modules/authentication/domain/authorization.types.js";
import { createTestPrincipal } from "../../../helpers/authorization/authorization-fixtures.js";
import {
  createFakeRoleManagementWorld,
  type FakeGrantSeed,
  type FakeRoleManagementWorld,
} from "../../../helpers/authorization/fake-role-management-unit-of-work.js";

const actor = createTestPrincipal({ userId: "actor-1" });

function buildService(world: FakeRoleManagementWorld): RoleManagementService {
  return new RoleManagementService(world.unitOfWork);
}

function worldWithTargetGrant(
  status: UserRoleStatus | "absent",
): FakeRoleManagementWorld {
  const grants: FakeGrantSeed[] =
    status === "absent"
      ? []
      : [{ userId: "target-1", roleCode: "customer", status }];
  return createFakeRoleManagementWorld({ grants });
}

const command = {
  actor,
  targetUserId: "target-1",
  roleCode: "customer",
  requestId: "request-1",
};

describe("role-management transition matrix", () => {
  it("assign creates an ENABLED grant when none exists", async () => {
    const world = worldWithTargetGrant("absent");

    const result = await buildService(world).assignRole({
      ...command,
      reasonCode: "role_grant_assign",
    });

    expect(result).toEqual({
      targetUserId: "target-1",
      roleCode: "customer",
      status: "ENABLED",
      mutated: true,
      auditAppended: true,
    });
    expect(world.grantStatus("target-1", "customer")).toBe("ENABLED");
    expect(world.auditAppends).toHaveLength(1);
  });

  it("assign re-enables a REVOKED grant and resets its lifecycle timestamps", async () => {
    const world = worldWithTargetGrant("REVOKED");

    const result = await buildService(world).assignRole({
      ...command,
      reasonCode: "role_grant_assign",
    });

    expect(result.mutated).toBe(true);
    expect(result.status).toBe("ENABLED");

    const grant = world.grantTimestamps("target-1", "customer");
    expect(grant?.revokedAt).toBeNull();
    expect(grant?.disabledAt).toBeNull();
    expect(grant?.enabledAt).not.toBeNull();
  });

  it("assign rejects a DISABLED grant because enable is the right operation", async () => {
    const world = worldWithTargetGrant("DISABLED");

    await expect(
      buildService(world).assignRole({
        ...command,
        reasonCode: "role_grant_assign",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_TRANSITION_INVALID" });
    expect(world.grantStatus("target-1", "customer")).toBe("DISABLED");
    expect(world.auditAppends).toHaveLength(0);
  });

  it("assign is an authorized no-op when the grant is already ENABLED", async () => {
    const world = worldWithTargetGrant("ENABLED");

    const result = await buildService(world).assignRole({
      ...command,
      reasonCode: "role_grant_assign",
    });

    expect(result).toMatchObject({
      status: "ENABLED",
      mutated: false,
      auditAppended: false,
    });
    expect(world.auditAppends).toHaveLength(0);
  });

  it("enable moves a DISABLED grant to ENABLED", async () => {
    const world = worldWithTargetGrant("DISABLED");

    const result = await buildService(world).enableRole({
      ...command,
      reasonCode: "role_grant_enable",
    });

    expect(result).toMatchObject({ status: "ENABLED", mutated: true });
    expect(world.grantStatus("target-1", "customer")).toBe("ENABLED");
  });

  it("enable is an authorized no-op for an ENABLED grant", async () => {
    const world = worldWithTargetGrant("ENABLED");

    const result = await buildService(world).enableRole({
      ...command,
      reasonCode: "role_grant_enable",
    });

    expect(result).toMatchObject({ mutated: false, auditAppended: false });
  });

  it.each(["REVOKED", "absent"] as const)(
    "enable rejects a %s grant",
    async (status) => {
      const world = worldWithTargetGrant(status);

      await expect(
        buildService(world).enableRole({
          ...command,
          reasonCode: "role_grant_enable",
        }),
      ).rejects.toMatchObject({ code: "AUTHZ_ROLE_TRANSITION_INVALID" });
      expect(world.auditAppends).toHaveLength(0);
    },
  );

  it("disable moves an ENABLED grant to DISABLED", async () => {
    const world = worldWithTargetGrant("ENABLED");

    const result = await buildService(world).disableRole({
      ...command,
      reasonCode: "role_grant_disable",
    });

    expect(result).toMatchObject({ status: "DISABLED", mutated: true });
    expect(world.grantTimestamps("target-1", "customer")?.disabledAt).not.toBeNull();
  });

  it("disable is an authorized no-op for a DISABLED grant", async () => {
    const world = worldWithTargetGrant("DISABLED");

    const result = await buildService(world).disableRole({
      ...command,
      reasonCode: "role_grant_disable",
    });

    expect(result).toMatchObject({ mutated: false, auditAppended: false });
  });

  it.each(["REVOKED", "absent"] as const)(
    "disable rejects a %s grant",
    async (status) => {
      const world = worldWithTargetGrant(status);

      await expect(
        buildService(world).disableRole({
          ...command,
          reasonCode: "role_grant_disable",
        }),
      ).rejects.toMatchObject({ code: "AUTHZ_ROLE_TRANSITION_INVALID" });
    },
  );

  it.each(["ENABLED", "DISABLED"] as const)(
    "revoke moves a %s grant to REVOKED",
    async (status) => {
      const world = worldWithTargetGrant(status);

      const result = await buildService(world).revokeRole({
        ...command,
        reasonCode: "role_grant_revoke",
      });

      expect(result).toMatchObject({ status: "REVOKED", mutated: true });
      expect(world.grantStatus("target-1", "customer")).toBe("REVOKED");
    },
  );

  it("revoke is an authorized no-op for a REVOKED grant", async () => {
    const world = worldWithTargetGrant("REVOKED");

    const result = await buildService(world).revokeRole({
      ...command,
      reasonCode: "role_grant_revoke",
    });

    expect(result).toMatchObject({ mutated: false, auditAppended: false });
  });

  it("revoke rejects an absent grant", async () => {
    const world = worldWithTargetGrant("absent");

    await expect(
      buildService(world).revokeRole({
        ...command,
        reasonCode: "role_grant_revoke",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_TRANSITION_INVALID" });
  });

  it("appends safe before/after evidence for a real mutation only", async () => {
    const world = worldWithTargetGrant("ENABLED");

    await buildService(world).disableRole({
      ...command,
      reasonCode: "role_grant_disable",
    });

    expect(world.auditAppends[0]).toMatchObject({
      actorType: "USER",
      actorId: "actor-1",
      action: "identity.roles.disable",
      targetType: "user_role",
      reason: "role_grant_disable",
      requestId: "request-1",
      context: {
        targetUserId: "target-1",
        roleCode: "customer",
        before: { status: "ENABLED" },
        after: { status: "DISABLED" },
      },
    });
  });

  it("rolls back the mutation when the audit append fails", async () => {
    const world = createFakeRoleManagementWorld({
      grants: [{ userId: "target-1", roleCode: "customer", status: "ENABLED" }],
      failAuditAppend: true,
    });

    await expect(
      buildService(world).disableRole({
        ...command,
        reasonCode: "role_grant_disable",
      }),
    ).rejects.toThrow(/audit append failed/u);
    expect(world.grantStatus("target-1", "customer")).toBe("ENABLED");
    expect(world.auditAppends).toHaveLength(0);
  });
});

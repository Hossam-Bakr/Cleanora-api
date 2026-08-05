import {
  bindPrismaClient,
  resetPrismaClientForTests,
} from "../../../../src/database/prisma.js";
import { AuthorizationRepository } from "../../../../src/modules/authentication/infrastructure/authorization.repository.js";

interface FakeGrantRow {
  readonly role: {
    readonly code: string;
    readonly rolePermissions: readonly {
      readonly permission: { readonly code: string };
    }[];
  };
}

function bindFakeUserRoleClient(rows: readonly FakeGrantRow[]) {
  const findMany = vi.fn(async (_query: { where: Record<string, unknown> }) => rows);
  bindPrismaClient({ userRole: { findMany } } as never);
  return findMany;
}

function grantRow(roleCode: string, permissionCodes: string[]): FakeGrantRow {
  return {
    role: {
      code: roleCode,
      rolePermissions: permissionCodes.map((code) => ({
        permission: { code },
      })),
    },
  };
}

describe("grant status filtering in the authorization repository", () => {
  beforeEach(() => {
    resetPrismaClientForTests("test");
  });

  afterEach(() => {
    resetPrismaClientForTests("test");
  });

  it("reads ENABLED grants only, so DISABLED and REVOKED grants cannot grant", async () => {
    const findMany = bindFakeUserRoleClient([]);

    await new AuthorizationRepository().findEnabledRolesAndPermissions(
      "actor-1",
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { userId: "actor-1", status: "ENABLED" },
    });
  });

  it("returns nothing when the user has no ENABLED grant", async () => {
    bindFakeUserRoleClient([]);

    await expect(
      new AuthorizationRepository().findEnabledRolesAndPermissions("actor-1"),
    ).resolves.toEqual({ roleCodes: [], permissionCodes: [] });
  });

  it("unions permissions across the ENABLED grants it reads", async () => {
    bindFakeUserRoleClient([
      grantRow("customer", ["resource.self.read", "resource.self.write"]),
      grantRow("staff_support", [
        "authz.reasons.use",
        "authz.staff.support.sample",
      ]),
    ]);

    const permissions =
      await new AuthorizationRepository().findEnabledRolesAndPermissions(
        "actor-1",
      );

    expect([...permissions.roleCodes].sort()).toEqual([
      "customer",
      "staff_support",
    ]);
    expect([...permissions.permissionCodes].sort()).toEqual([
      "authz.reasons.use",
      "authz.staff.support.sample",
      "resource.self.read",
      "resource.self.write",
    ]);
  });

  it("reads fresh state on every call instead of caching a previous answer", async () => {
    const findMany = bindFakeUserRoleClient([
      grantRow("staff_admin", ["authz.roles.assign"]),
    ]);
    const repository = new AuthorizationRepository();

    await repository.findEnabledRolesAndPermissions("actor-1");
    await repository.findEnabledRolesAndPermissions("actor-1");

    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

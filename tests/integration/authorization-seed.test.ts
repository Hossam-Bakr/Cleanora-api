import { seed } from "../../prisma/seed.js";
import { getPrismaClient } from "../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../src/database/prisma-lifecycle.js";
import {
  AUTHORIZATION_PERMISSIONS,
  AUTHORIZATION_ROLES,
  PRIVILEGED_ACTION_REASONS,
  ROLE_PERMISSION_MAP,
} from "../../src/modules/authentication/domain/authorization.catalog.js";
import { hasApprovedTestDatabaseUrl } from "../helpers/resolve-test-database-url.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../helpers/test-database-lifecycle.js";

const hasDatabase = hasApprovedTestDatabaseUrl();

const expectedRolePermissionCount = Object.values(ROLE_PERMISSION_MAP).reduce(
  (total, permissionCodes) => total + permissionCodes.length,
  0,
);

describe.skipIf(!hasDatabase)("R1-P03 authorization definition seed", () => {
  let database: PrismaLifecycle;

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
  });

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "seeds the exact definition catalog and stays idempotent across two runs",
    async () => {
      await seed(getPrismaClient());
      await seed(getPrismaClient());

      const prisma = getPrismaClient();
      const [roles, permissions, rolePermissionCount, reasons] =
        await Promise.all([
          prisma.role.findMany({ orderBy: { code: "asc" } }),
          prisma.permission.findMany({ orderBy: { code: "asc" } }),
          prisma.rolePermission.count(),
          prisma.privilegedActionReason.findMany({ orderBy: { code: "asc" } }),
        ]);

      expect(roles.map((role) => role.code)).toEqual(
        [...AUTHORIZATION_ROLES].map((role) => role.code).sort(),
      );
      expect(permissions.map((permission) => permission.code)).toEqual(
        [...AUTHORIZATION_PERMISSIONS].map((permission) => permission.code).sort(),
      );
      expect(rolePermissionCount).toBe(expectedRolePermissionCount);
      expect(reasons.map((reason) => reason.code)).toEqual(
        [...PRIVILEGED_ACTION_REASONS].map((reason) => reason.code).sort(),
      );
      for (const reason of reasons) {
        expect(reason.isActive).toBe(true);
      }
    },
    60_000,
  );

  it(
    "creates no automatic production user-role grant and no staff_admin bootstrap",
    async () => {
      // Role-management integration fixtures may already have created grants in
      // this shared test database, so the proof is that seeding adds none.
      const prisma = getPrismaClient();
      const staffAdmin = await prisma.role.findUniqueOrThrow({
        where: { code: "staff_admin" },
      });
      const grantsBeforeSeed = await prisma.userRole.count();
      const staffAdminGrantsBeforeSeed = await prisma.userRole.count({
        where: { roleId: staffAdmin.id },
      });

      await seed(getPrismaClient());

      expect(await prisma.userRole.count()).toBe(grantsBeforeSeed);
      expect(
        await prisma.userRole.count({ where: { roleId: staffAdmin.id } }),
      ).toBe(staffAdminGrantsBeforeSeed);
    },
    60_000,
  );
});

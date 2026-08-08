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

const DRIFTED_ROLE_CODE = "customer";
const DRIFTED_PERMISSION_CODE = "resource.self.read";
const DRIFTED_REASON_CODE = "role_grant_assign";
const REASON_FREED_FOR_OPERATION = "role_grant_revoke";
const REMOVED_ROLE_PERMISSION = {
  roleCode: "customer",
  permissionCode: "resource.self.write",
} as const;

const REQUIRED_ROLE_CODES = [DRIFTED_ROLE_CODE] as const;
const REQUIRED_PERMISSION_CODES = [
  DRIFTED_PERMISSION_CODE,
  REMOVED_ROLE_PERMISSION.permissionCode,
] as const;
const REQUIRED_REASON_CODES = [
  DRIFTED_REASON_CODE,
  REASON_FREED_FOR_OPERATION,
] as const;

/**
 * Seed upserts by code. Privileged-reason restore also clears conflicting
 * operation holders so drift assertions never start from a half-empty catalog.
 */
async function ensureAuthorizationCatalogRows(): Promise<void> {
  const prisma = getPrismaClient();

  for (const role of AUTHORIZATION_ROLES) {
    const existing = await prisma.role.findUnique({ where: { code: role.code } });
    if (existing === null) {
      await prisma.role.create({
        data: { code: role.code, name: role.name },
      });
    }
  }

  for (const permission of AUTHORIZATION_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { code: permission.code },
    });
    if (existing === null) {
      await prisma.permission.create({
        data: { code: permission.code, name: permission.name },
      });
    }
  }

  for (const reason of PRIVILEGED_ACTION_REASONS) {
    await prisma.privilegedActionReason.deleteMany({
      where: {
        operation: reason.operation,
        NOT: { code: reason.code },
      },
    });
    await prisma.privilegedActionReason.upsert({
      where: { code: reason.code },
      create: {
        code: reason.code,
        name: reason.name,
        operation: reason.operation,
        isActive: reason.isActive,
      },
      update: {
        name: reason.name,
        operation: reason.operation,
        isActive: reason.isActive,
      },
    });
  }

  for (const code of REQUIRED_ROLE_CODES) {
    const row = await prisma.role.findUnique({ where: { code } });
    if (row === null) {
      throw new Error(
        `Authorization seed incomplete: required role "${code}" is missing after seed()`,
      );
    }
  }
  for (const code of REQUIRED_PERMISSION_CODES) {
    const row = await prisma.permission.findUnique({ where: { code } });
    if (row === null) {
      throw new Error(
        `Authorization seed incomplete: required permission "${code}" is missing after seed()`,
      );
    }
  }
  for (const code of REQUIRED_REASON_CODES) {
    const row = await prisma.privilegedActionReason.findUnique({
      where: { code },
    });
    if (row === null) {
      throw new Error(
        `Authorization seed incomplete: required privileged reason "${code}" is missing after seed()`,
      );
    }
  }
}

/**
 * T085: prove that a second seed restores drifted authorization definitions
 * without touching user_roles. Uses TEST_DATABASE_URL only.
 */
describe.skipIf(!hasDatabase)(
  "R1-P03 authorization seed drift repair",
  () => {
    let database: PrismaLifecycle;

    beforeAll(async () => {
      database = await startTestDatabaseLifecycle();
    });

    afterAll(async () => {
      await stopTestDatabaseLifecycle(database);
    });

    it(
      "restores drifted names, reasons, and role-permission rows on reseed",
      { timeout: 180_000 },
      async () => {
        const prisma = getPrismaClient();

        // One seed, then fill any leftover catalog gaps from prior suite drift.
        await seed(getPrismaClient());
        await ensureAuthorizationCatalogRows();

        const grantsBefore = await prisma.userRole.findMany({
          select: {
            id: true,
            userId: true,
            roleId: true,
            status: true,
            assignedAt: true,
            enabledAt: true,
            disabledAt: true,
            revokedAt: true,
            updatedAt: true,
          },
          orderBy: { id: "asc" },
        });

        try {
          const role = await prisma.role.findUniqueOrThrow({
            where: { code: DRIFTED_ROLE_CODE },
          });
          const permission = await prisma.permission.findUniqueOrThrow({
            where: { code: DRIFTED_PERMISSION_CODE },
          });
          const revokeReason = await prisma.privilegedActionReason.findUniqueOrThrow({
            where: { code: REASON_FREED_FOR_OPERATION },
          });
          const removedPermission = await prisma.permission.findUniqueOrThrow({
            where: { code: REMOVED_ROLE_PERMISSION.permissionCode },
          });

          await prisma.role.update({
            where: { id: role.id },
            data: { name: "DRIFTED_CUSTOMER_NAME" },
          });
          await prisma.permission.update({
            where: { id: permission.id },
            data: { name: "DRIFTED_SELF_READ_NAME" },
          });

          // Free ROLE_REVOKE so assign can take it without violating @@unique(operation).
          await prisma.privilegedActionReason.delete({
            where: { code: REASON_FREED_FOR_OPERATION },
          });
          await prisma.privilegedActionReason.update({
            where: { code: DRIFTED_REASON_CODE },
            data: {
              name: "DRIFTED_ASSIGN_REASON",
              operation: revokeReason.operation,
              isActive: false,
            },
          });

          await prisma.rolePermission.delete({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: removedPermission.id,
              },
            },
          });

          expect(
            (await prisma.role.findUniqueOrThrow({ where: { code: DRIFTED_ROLE_CODE } }))
              .name,
          ).toBe("DRIFTED_CUSTOMER_NAME");
          expect(
            (
              await prisma.permission.findUniqueOrThrow({
                where: { code: DRIFTED_PERMISSION_CODE },
              })
            ).name,
          ).toBe("DRIFTED_SELF_READ_NAME");
          expect(
            await prisma.privilegedActionReason.findUnique({
              where: { code: REASON_FREED_FOR_OPERATION },
            }),
          ).toBeNull();
          expect(
            (
              await prisma.privilegedActionReason.findUniqueOrThrow({
                where: { code: DRIFTED_REASON_CODE },
              })
            ),
          ).toMatchObject({
            name: "DRIFTED_ASSIGN_REASON",
            operation: revokeReason.operation,
            isActive: false,
          });
          expect(
            await prisma.rolePermission.findUnique({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: removedPermission.id,
                },
              },
            }),
          ).toBeNull();

          await seed(getPrismaClient());

          const restoredRole = await prisma.role.findUniqueOrThrow({
            where: { code: DRIFTED_ROLE_CODE },
          });
          const restoredPermission = await prisma.permission.findUniqueOrThrow({
            where: { code: DRIFTED_PERMISSION_CODE },
          });
          const restoredAssign = await prisma.privilegedActionReason.findUniqueOrThrow({
            where: { code: DRIFTED_REASON_CODE },
          });
          const restoredRevoke = await prisma.privilegedActionReason.findUniqueOrThrow({
            where: { code: REASON_FREED_FOR_OPERATION },
          });
          const restoredMapping = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: restoredRole.id,
                permissionId: removedPermission.id,
              },
            },
          });

          const catalogRole = AUTHORIZATION_ROLES.find(
            (candidate) => candidate.code === DRIFTED_ROLE_CODE,
          );
          const catalogPermission = AUTHORIZATION_PERMISSIONS.find(
            (candidate) => candidate.code === DRIFTED_PERMISSION_CODE,
          );
          const catalogAssign = PRIVILEGED_ACTION_REASONS.find(
            (candidate) => candidate.code === DRIFTED_REASON_CODE,
          );
          const catalogRevoke = PRIVILEGED_ACTION_REASONS.find(
            (candidate) => candidate.code === REASON_FREED_FOR_OPERATION,
          );

          expect(catalogRole).toBeDefined();
          expect(catalogPermission).toBeDefined();
          expect(catalogAssign).toBeDefined();
          expect(catalogRevoke).toBeDefined();
          expect(restoredRole.name).toBe(catalogRole?.name);
          expect(restoredPermission.name).toBe(catalogPermission?.name);
          expect(restoredAssign).toMatchObject({
            name: catalogAssign?.name,
            operation: catalogAssign?.operation,
            isActive: catalogAssign?.isActive,
          });
          expect(restoredRevoke).toMatchObject({
            name: catalogRevoke?.name,
            operation: catalogRevoke?.operation,
            isActive: catalogRevoke?.isActive,
          });
          expect(restoredMapping).not.toBeNull();

          const customerPermissions = ROLE_PERMISSION_MAP["customer"] ?? [];
          expect(customerPermissions).toContain(
            REMOVED_ROLE_PERMISSION.permissionCode,
          );

          const grantsAfter = await prisma.userRole.findMany({
            select: {
              id: true,
              userId: true,
              roleId: true,
              status: true,
              assignedAt: true,
              enabledAt: true,
              disabledAt: true,
              revokedAt: true,
              updatedAt: true,
            },
            orderBy: { id: "asc" },
          });
          expect(grantsAfter).toEqual(grantsBefore);
        } finally {
          await seed(getPrismaClient());
        }
      },
    );
  },
);

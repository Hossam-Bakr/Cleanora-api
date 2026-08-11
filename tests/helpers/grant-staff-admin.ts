import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seed } from "../../prisma/seed.js";

/**
 * Ensure authorization catalog exists, then grant ENABLED staff_admin.
 * Never seeds production; uses the approved test Prisma client only.
 */
export async function grantStaffAdminForTests(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await seed(prisma);
  const staffAdmin = await prisma.role.findUniqueOrThrow({
    where: { code: "staff_admin" },
  });
  const existing = await prisma.userRole.findUnique({
    where: {
      userId_roleId: { userId, roleId: staffAdmin.id },
    },
  });
  if (existing !== null) {
    if (existing.status !== "ENABLED") {
      await prisma.userRole.update({
        where: { id: existing.id },
        data: {
          status: "ENABLED",
          enabledAt: new Date(),
          disabledAt: null,
          revokedAt: null,
        },
      });
    }
    return;
  }
  await prisma.userRole.create({
    data: {
      userId,
      roleId: staffAdmin.id,
      status: "ENABLED",
      enabledAt: new Date(),
    },
  });
}

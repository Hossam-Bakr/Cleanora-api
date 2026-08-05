import { randomUUID } from "node:crypto";

import { getPrismaClient } from "../../../src/database/prisma.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/domain/authentication.types.js";
import {
  PrismaRoleManagementUnitOfWork,
  type PrivilegedAuditWriterFactory,
} from "../../../src/modules/authentication/infrastructure/prisma-role-management.unit-of-work.js";
import { RoleManagementService } from "../../../src/modules/authentication/role-management.service.js";

export interface RoleManagementFixture {
  readonly service: RoleManagementService;
  readonly actorPrincipal: AuthenticationPrincipal;
  readonly targetUserId: string;
}

/** Digits-only phone number so each fixture user stays unique and valid. */
function uniquePhoneE164(): string {
  const digits = randomUUID().replace(/\D/gu, "").slice(0, 9).padEnd(9, "0");
  return `+2010${digits}`;
}

async function createUser(): Promise<string> {
  const user = await getPrismaClient().user.create({
    data: { phoneE164: uniquePhoneE164(), accountCategories: ["INDIVIDUAL"] },
  });
  return user.id;
}

/**
 * Build a real role-management service against the test database.
 *
 * The actor receives an ENABLED `staff_admin` grant, which is created directly
 * in the test so production seeding never grants staff powers. Pass
 * `auditWriterFactory` to simulate an audit failure.
 */
export async function createRoleManagementFixture(options?: {
  readonly auditWriterFactory?: PrivilegedAuditWriterFactory;
}): Promise<RoleManagementFixture> {
  const prisma = getPrismaClient();
  const actorUserId = await createUser();
  const targetUserId = await createUser();

  const staffAdmin = await prisma.role.findUniqueOrThrow({
    where: { code: "staff_admin" },
  });
  await prisma.userRole.create({
    data: {
      userId: actorUserId,
      roleId: staffAdmin.id,
      status: "ENABLED",
      enabledAt: new Date(),
    },
  });

  const unitOfWork = new PrismaRoleManagementUnitOfWork(
    options?.auditWriterFactory ?? createPrismaPrivilegedAuditWriter,
  );

  return {
    service: new RoleManagementService(unitOfWork),
    actorPrincipal: {
      userId: actorUserId,
      sessionId: `session-${randomUUID()}`,
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: ["INDIVIDUAL"],
      pendingCategories: [],
      status: "ACTIVE",
      verificationOnly: false,
    },
    targetUserId,
  };
}

/** Current stored status of one grant, or `undefined` when it does not exist. */
export async function readGrantStatus(
  userId: string,
  roleCode: string,
): Promise<string | undefined> {
  const grant = await getPrismaClient().userRole.findFirst({
    where: { userId, role: { code: roleCode } },
    select: { status: true },
  });
  return grant?.status;
}

/** Audit rows appended for one target user and action, newest first. */
export async function readAuditRows(action: string, targetUserId: string) {
  return getPrismaClient().auditLog.findMany({
    where: { action, actorType: "USER" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      action: true,
      targetType: true,
      reason: true,
      context: true,
      actorId: true,
    },
  }).then((rows) =>
    rows.filter((row) => JSON.stringify(row.context).includes(targetUserId)),
  );
}

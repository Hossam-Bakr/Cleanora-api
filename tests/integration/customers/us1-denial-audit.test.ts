import { randomUUID } from "node:crypto";

import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createPrismaDenialAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import { PrismaCustomersUnitOfWork } from "../../../src/modules/customers/infrastructure/prisma-customers.unit-of-work.js";
import { PrismaProfileRepository } from "../../../src/modules/customers/infrastructure/prisma-profile.repository.js";
import { ProfileService } from "../../../src/modules/customers/profile.service.js";
import { assertR1P04CustomerSchemaReady } from "../../helpers/assert-r1-p04-schema.js";
import { requireR1P04TestDatabase } from "../../helpers/r1-p04-test-database.js";
import { startTestDatabaseLifecycle, stopTestDatabaseLifecycle } from "../../helpers/test-database-lifecycle.js";

describe("US1 denial audit integration", () => {
  let database: PrismaLifecycle;
  let userId: string;

  beforeAll(() => {
    requireR1P04TestDatabase();
  });

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await assertR1P04CustomerSchemaReady();
  });
  beforeEach(async () => {
    userId = await getPrismaClient().user.create({
      data: { phoneE164: `+201${randomUUID().replace(/\D/gu, "").slice(0, 10).padEnd(10, "0")}`, accountCategories: ["INDIVIDUAL"], verifiedCategories: [] },
    }).then((user) => user.id);
  });
  afterEach(async () => { await getPrismaClient().user.delete({ where: { id: userId } }); });
  afterAll(async () => { await stopTestDatabaseLifecycle(database); });

  it("records a redacted denial without a profile mutation", async () => {
    const service = new ProfileService(
      new PrismaCustomersUnitOfWork(createPrismaGeneralTransactionalAuditWriter, createPrismaPrivilegedAuditWriter),
      new PrismaProfileRepository(),
      createPrismaDenialAuditWriter(),
    );
    const principal = { userId, sessionId: "s", accountCategories: ["INDIVIDUAL"] as const, verifiedCategories: [], pendingCategories: ["INDIVIDUAL"] as const, status: "ACTIVE" as const, verificationOnly: false };
    await expect(service.get({ principal, category: "INDIVIDUAL" })).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });
    expect(await getPrismaClient().customerProfile.count({ where: { userId } })).toBe(0);
    const audit = await getPrismaClient().auditLog.findFirstOrThrow({ where: { actorId: userId }, orderBy: { createdAt: "desc" } });
    expect(JSON.stringify(audit.context)).not.toContain("profile");
    expect(audit.action).toBe("customers.profile.read");
  });
});

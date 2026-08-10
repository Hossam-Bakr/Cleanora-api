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

const principal = (userId: string) => ({
  userId, sessionId: `session-${userId}`, accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: ["INDIVIDUAL"] as const, pendingCategories: [], status: "ACTIVE" as const,
  verificationOnly: false,
});

describe("US1 customer profile integration", () => {
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
      data: { phoneE164: `+201${randomUUID().replace(/\D/gu, "").slice(0, 10).padEnd(10, "0")}`, emailNormalized: `profile-${randomUUID()}@example.test`, emailVerifiedAt: new Date(), accountCategories: ["INDIVIDUAL"], verifiedCategories: ["INDIVIDUAL"] },
    }).then((user) => user.id);
  });
  afterEach(async () => {
    await getPrismaClient().individualProfile.deleteMany({ where: { userId } });
    await getPrismaClient().customerProfile.deleteMany({ where: { userId } });
    await getPrismaClient().user.delete({ where: { id: userId } });
  });
  afterAll(async () => { await stopTestDatabaseLifecycle(database); });

  it("returns not-created, saves an isolated profile, and does not audit ordinary reads", async () => {
    const service = new ProfileService(
      new PrismaCustomersUnitOfWork(createPrismaGeneralTransactionalAuditWriter, createPrismaPrivilegedAuditWriter),
      new PrismaProfileRepository(),
      createPrismaDenialAuditWriter(),
    );
    expect(await service.get({ principal: principal(userId), category: "INDIVIDUAL" })).toEqual({ category: "INDIVIDUAL", created: false });
    const before = await getPrismaClient().auditLog.count({ where: { actorId: userId } });
    expect(await service.upsert({ principal: principal(userId), input: { category: "INDIVIDUAL", fullName: " Ada " } })).toMatchObject({ created: true, fullName: "Ada" });
    await service.get({ principal: principal(userId), category: "INDIVIDUAL" });
    expect(await getPrismaClient().auditLog.count({ where: { actorId: userId } })).toBe(before + 1);
  });

  it("lets a company complete and replace its commercial and tax registration data after signup", async () => {
    const companyUserId = await getPrismaClient().user.create({
      data: {
        phoneE164: `+201${randomUUID().replace(/\D/gu, "").slice(0, 10).padEnd(10, "0")}`,
        emailNormalized: `company-profile-${randomUUID()}@example.test`,
        emailVerifiedAt: new Date(),
        accountCategories: ["COMPANY"],
        verifiedCategories: ["COMPANY"],
      },
    }).then((user) => user.id);
    const companyPrincipal = {
      userId: companyUserId,
      sessionId: `session-${companyUserId}`,
      accountCategories: ["COMPANY"] as const,
      verifiedCategories: ["COMPANY"] as const,
      pendingCategories: [],
      status: "ACTIVE" as const,
      verificationOnly: false,
    };
    const service = new ProfileService(
      new PrismaCustomersUnitOfWork(createPrismaGeneralTransactionalAuditWriter, createPrismaPrivilegedAuditWriter),
      new PrismaProfileRepository(),
      createPrismaDenialAuditWriter(),
    );
    try {
      await expect(service.upsert({
        principal: companyPrincipal,
        input: {
          category: "COMPANY",
          companyName: " Cleanora Business ",
          representativeFullName: " Company Representative ",
          commercialRegistrationNumber: " CR-2026-001 ",
          taxRegistrationNumber: " TAX-2026-001 ",
        },
      })).resolves.toMatchObject({
        companyName: "Cleanora Business",
        representativeFullName: "Company Representative",
        commercialRegistrationNumber: "CR-2026-001",
        taxRegistrationNumber: "TAX-2026-001",
      });
      await expect(service.get({ principal: companyPrincipal, category: "COMPANY" })).resolves.toMatchObject({
        commercialRegistrationNumber: "CR-2026-001",
        taxRegistrationNumber: "TAX-2026-001",
      });
    } finally {
      await getPrismaClient().companyProfile.deleteMany({ where: { userId: companyUserId } });
      await getPrismaClient().customerProfile.deleteMany({ where: { userId: companyUserId } });
      await getPrismaClient().user.delete({ where: { id: companyUserId } });
    }
  });
});

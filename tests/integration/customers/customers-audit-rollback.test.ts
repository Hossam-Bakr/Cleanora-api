import { randomUUID } from "node:crypto";

import { seed } from "../../../prisma/seed.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import type {
  GeneralTransactionalAuditWriter,
  PrivilegedAuditWriter,
} from "../../../src/modules/admin/audit.service.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import { AuthorizationService } from "../../../src/modules/authentication/authorization.service.js";
import { AuthorizationRepository } from "../../../src/modules/authentication/infrastructure/authorization.repository.js";
import { PrismaCustomersUnitOfWork } from "../../../src/modules/customers/infrastructure/prisma-customers.unit-of-work.js";
import { PrismaPreferencesRepository } from "../../../src/modules/customers/infrastructure/prisma-preferences.repository.js";
import { PrismaPrivacyRequestRepository } from "../../../src/modules/customers/infrastructure/prisma-privacy-request.repository.js";
import { PreferencesService } from "../../../src/modules/customers/preferences.service.js";
import { PrivacyPrivilegedService } from "../../../src/modules/customers/privacy-privileged.service.js";
import { PrivacyProcessorService } from "../../../src/modules/customers/privacy-processor.service.js";
import { PRIVACY_PROCESSOR_CAPABILITY } from "../../../src/modules/customers/domain/privacy-processor.capability.js";
import { IdentityContactRead } from "../../../src/modules/customers/infrastructure/identity-contact.read.js";
import { assertR1P04CustomerSchemaReady } from "../../helpers/assert-r1-p04-schema.js";
import { requireR1P04TestDatabase } from "../../helpers/r1-p04-test-database.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";

const AUDIT_FAILURE = "forced customers audit append failure";

const failingGeneralAuditFactory = (): GeneralTransactionalAuditWriter => ({
  async append(): Promise<never> {
    throw new Error(AUDIT_FAILURE);
  },
});

const failingPrivilegedAuditFactory = (): PrivilegedAuditWriter => ({
  async append(): Promise<never> {
    throw new Error(AUDIT_FAILURE);
  },
});

function eligiblePrincipal(userId: string): AuthenticationPrincipal {
  return {
    userId,
    sessionId: `session-${userId}`,
    accountCategories: ["INDIVIDUAL"],
    verifiedCategories: ["INDIVIDUAL"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
  };
}

async function createCustomerUser(): Promise<string> {
  return getPrismaClient()
    .user.create({
      data: {
        phoneE164: `+201${randomUUID().replace(/\D/gu, "").slice(0, 10).padEnd(10, "0")}`,
        emailNormalized: `audit-rollback-${randomUUID()}@example.test`,
        emailVerifiedAt: new Date(),
        accountCategories: ["INDIVIDUAL"],
        verifiedCategories: ["INDIVIDUAL"],
      },
    })
    .then((user) => user.id);
}

async function createStaffAdminActor(): Promise<AuthenticationPrincipal> {
  const prisma = getPrismaClient();
  const actorUserId = await createCustomerUser();
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
  return eligiblePrincipal(actorUserId);
}

describe("customers audit-failure rollback (T115)", () => {
  let database: PrismaLifecycle;

  beforeAll(() => {
    requireR1P04TestDatabase();
  });

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await assertR1P04CustomerSchemaReady();
    await seed(getPrismaClient());
  }, 180_000);

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it("rolls back preference replacement when general transactional audit append fails", async () => {
    const userId = await createCustomerUser();
    const principal = eligiblePrincipal(userId);
    const workingUnitOfWork = new PrismaCustomersUnitOfWork(
      createPrismaGeneralTransactionalAuditWriter,
      createPrismaPrivilegedAuditWriter,
    );
    const preferences = new PreferencesService(
      workingUnitOfWork,
      new PrismaPreferencesRepository(),
      new IdentityContactRead({
        readContactFacts: async () => ({
          phoneE164: null,
          emailNormalized: null,
          phoneVerifiedAt: null,
          emailVerifiedAt: null,
        }),
      }),
      { append: async () => ({ id: "denial", createdAt: new Date().toISOString() }) },
    );

    const baseline = await preferences.replace(principal, {
      version: 1,
      language: "EN",
      reminders: { sms: false, push: true },
      promotional: { sms: false, push: false },
      mandatory: {
        security: { sms: true, push: true },
        activeService: { sms: true, push: true },
      },
    });

    const failingPreferences = new PreferencesService(
      new PrismaCustomersUnitOfWork(
        failingGeneralAuditFactory,
        createPrismaPrivilegedAuditWriter,
      ),
      new PrismaPreferencesRepository(),
      new IdentityContactRead({
        readContactFacts: async () => ({
          phoneE164: null,
          emailNormalized: null,
          phoneVerifiedAt: null,
          emailVerifiedAt: null,
        }),
      }),
      { append: async () => ({ id: "denial", createdAt: new Date().toISOString() }) },
    );

    await expect(
      failingPreferences.replace(principal, {
        version: baseline.version,
        language: "AR",
        reminders: { sms: true, push: false },
        promotional: { sms: true, push: true },
        mandatory: {
          security: { sms: true, push: true },
          activeService: { sms: true, push: true },
        },
      }),
    ).rejects.toThrow(AUDIT_FAILURE);

    const after = await getPrismaClient().userPreferences.findUnique({
      where: { userId },
    });
    expect(after).toMatchObject({
      version: baseline.version,
      language: baseline.language,
      remindersSms: baseline.reminders.sms,
      remindersPush: baseline.reminders.push,
      promotionalSms: baseline.promotional.sms,
      promotionalPush: baseline.promotional.push,
    });
    expect(
      await getPrismaClient().auditLog.count({
        where: {
          actorId: userId,
          action: "customers.preferences.replace",
        },
      }),
    ).toBe(1);

    await getPrismaClient().auditLog.deleteMany({ where: { actorId: userId } });
    await getPrismaClient().userPreferences.deleteMany({ where: { userId } });
    await getPrismaClient().user.delete({ where: { id: userId } });
  }, 120_000);

  it("rolls back privileged privacy reassignment when privileged audit append fails", async () => {
    const customerUserId = await createCustomerUser();
    const processorA = await createCustomerUser();
    const processorB = await createCustomerUser();
    const actor = await createStaffAdminActor();
    const repository = new PrismaPrivacyRequestRepository();
    const workingUnitOfWork = new PrismaCustomersUnitOfWork(
      createPrismaGeneralTransactionalAuditWriter,
      createPrismaPrivilegedAuditWriter,
    );
    const processor = new PrivacyProcessorService(
      workingUnitOfWork,
      repository,
      30,
    );
    const authorization = new AuthorizationService(new AuthorizationRepository());

    const submitted = await getPrismaClient().privacyRequest.create({
      data: {
        userId: customerUserId,
        purpose: "EXPORT",
        status: "PENDING",
      },
    });
    await processor.claim(submitted.id, {
      processorId: processorA,
      capability: PRIVACY_PROCESSOR_CAPABILITY,
    });

    const before = await getPrismaClient().privacyRequest.findUniqueOrThrow({
      where: { id: submitted.id },
    });
    const failingPrivileged = new PrivacyPrivilegedService(
      new PrismaCustomersUnitOfWork(
        createPrismaGeneralTransactionalAuditWriter,
        failingPrivilegedAuditFactory,
      ),
      repository,
      authorization,
    );

    await expect(
      failingPrivileged.reassign({
        requestId: submitted.id,
        newProcessorId: processorB,
        actor,
        reasonCode: "privacy_request_reassign",
      }),
    ).rejects.toThrow(AUDIT_FAILURE);

    const after = await getPrismaClient().privacyRequest.findUniqueOrThrow({
      where: { id: submitted.id },
    });
    expect(after).toMatchObject({
      status: "PROCESSING",
      processorId: before.processorId,
      processingAt: before.processingAt,
    });
    expect(
      await getPrismaClient().auditLog.count({
        where: {
          action: "customers.privacy.requests.reassign",
          targetId: submitted.id,
        },
      }),
    ).toBe(0);

    await getPrismaClient().auditLog.deleteMany({
      where: { targetId: submitted.id },
    });
    await getPrismaClient().privacyRequest.delete({ where: { id: submitted.id } });
    await getPrismaClient().userRole.deleteMany({ where: { userId: actor.userId } });
    await getPrismaClient().user.deleteMany({
      where: { id: { in: [customerUserId, processorA, processorB, actor.userId] } },
    });
  }, 120_000);
});

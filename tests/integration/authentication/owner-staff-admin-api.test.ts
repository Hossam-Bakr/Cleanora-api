import { randomBytes, randomUUID } from "node:crypto";

import { seed } from "../../../prisma/seed.js";
import { createApp } from "../../../src/app.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { MemoryRateLimiterAdapter } from "../../../src/integrations/security/memory-rate-limiter.adapter.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import { PrismaOwnerStaffAdminUnitOfWork } from "../../../src/modules/authentication/infrastructure/prisma-owner-staff-admin.unit-of-work.js";
import { createOwnerInternalRouter } from "../../../src/modules/authentication/owner-staff-admin.routes.js";
import { OwnerStaffAdminProvisionService } from "../../../src/modules/authentication/owner-staff-admin.service.js";
import { readGrantStatus } from "../../helpers/authorization/role-management-integration.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

function uniquePhoneE164(): string {
  const digits = randomUUID().replace(/\D/gu, "").slice(0, 9).padEnd(9, "0");
  return `+2010${digits}`;
}

function createOwnerStaffAdminApp(input: {
  readonly enabled: boolean;
  readonly secret: string;
}) {
  const environment = createTestEnvironment({
    AUTH_PRIVACY_HASH_SECRET: "test-privacy-secret-that-is-longer-than-32-chars",
  });
  const rateLimiter = new MemoryRateLimiterAdapter();
  const service = new OwnerStaffAdminProvisionService(
    { enabled: input.enabled, secret: input.secret },
    new PrismaOwnerStaffAdminUnitOfWork(createPrismaPrivilegedAuditWriter),
  );
  const ownerInternalRouter = createOwnerInternalRouter({
    service,
    limiter: rateLimiter,
    privacyHashSecret: environment.AUTH_PRIVACY_HASH_SECRET!,
  });

  return createApp({
    environment,
    logger: new TestLogger(),
    rateLimiter,
    ownerInternalRouter,
  });
}

async function createVerifiedActiveUser(email: string): Promise<string> {
  const user = await getPrismaClient().user.create({
    data: {
      phoneE164: uniquePhoneE164(),
      emailNormalized: email.trim().toLowerCase(),
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: ["INDIVIDUAL"],
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });
  return user.id;
}

describe.skipIf(!hasDatabase)("owner staff-admin provisioning API", () => {
  let database: PrismaLifecycle;
  const ownerSecret = randomBytes(32).toString("hex");

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await seed();
  }, 180_000);

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "provisions staff_admin for a verified active user and rejects repeats, bad secrets, and disabled service",
    async () => {
      const email = `owner-api-${randomUUID()}@example.test`;
      const userId = await createVerifiedActiveUser(email);
      const enabledApp = createOwnerStaffAdminApp({
        enabled: true,
        secret: ownerSecret,
      });

      const created = await request(enabledApp)
        .post("/api/v1/internal/owner/staff-admins")
        .set("x-owner-admin-secret", ownerSecret)
        .send({ email })
        .expect(200);

      expect(created.body).toMatchObject({
        success: true,
        data: {
          outcome: "CREATED",
          targetUserId: userId,
          roleCode: "staff_admin",
          grantStatus: "ENABLED",
        },
      });
      expect(await readGrantStatus(userId, "staff_admin")).toBe("ENABLED");

      const repeated = await request(enabledApp)
        .post("/api/v1/internal/owner/staff-admins")
        .set("x-owner-admin-secret", ownerSecret)
        .send({ email })
        .expect(200);

      expect(repeated.body.data).toMatchObject({ outcome: "ALREADY_ENABLED" });

      await request(enabledApp)
        .post("/api/v1/internal/owner/staff-admins")
        .set(
          "x-owner-admin-secret",
          "wrong-owner-secret-that-is-still-32-characters",
        )
        .send({ email })
        .expect(403);

      const disabledApp = createOwnerStaffAdminApp({
        enabled: false,
        secret: ownerSecret,
      });
      await request(disabledApp)
        .post("/api/v1/internal/owner/staff-admins")
        .set("x-owner-admin-secret", ownerSecret)
        .send({ email })
        .expect(403);
    },
    120_000,
  );
});

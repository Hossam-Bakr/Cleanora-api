import { ConcurrencyBarrier } from "../../helpers/provider-concurrency.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import { seedCompleteProviderApplicationContent } from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import { grantStaffAdminForTests } from "../../helpers/grant-staff-admin.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 240_000 });

describe.skipIf(!hasDatabase)("US6 approval concurrency (T073)", () => {
  it("accepts one complete ownership outcome under concurrent approval", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-conc-owner",
      });
      const staffA = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-conc-staff-a",
      });
      const staffB = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-conc-staff-b",
      });
      await grantStaffAdminForTests(context.prisma, staffA.userId);
      await grantStaffAdminForTests(context.prisma, staffB.userId);

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      let version = created.body.data.provider.version as number;
      await seedCompleteProviderApplicationContent(context.prisma, {
        providerId,
        ownerUserId: owner.userId,
        emailNormalized: owner.identity.email,
        phoneE164: owner.identity.phone,
      });
      const submitted = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
      version = submitted.body.data.provider.version as number;

      const barrier = new ConcurrencyBarrier(2);
      const runners = [staffA.accessToken, staffB.accessToken].map(
        async (token) => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
            .set("Authorization", `Bearer ${token}`)
            .send({ expectedVersion: version });
        },
      );
      const responses = await Promise.all(runners);
      for (const response of responses) {
        expect([200, 409]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.data.provider.applicationStatus).toBe("APPROVED");
          expect(response.body.data.provider.operationalStatus).toBe("INACTIVE");
        }
      }

      const provider = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(provider.applicationStatus).toBe("APPROVED");
      expect(provider.operationalStatus).toBe("INACTIVE");
      expect(provider.ownerUserId).toBe(owner.userId);

      expect(
        await context.prisma.providerMember.count({
          where: { providerId, level: "OWNER", status: "ACTIVE" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerStatusHistory.count({
          where: { providerId, toApplicationStatus: "APPROVED" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "APPROVED" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.auditLog.count({
          where: {
            targetId: providerId,
            action: "providers.applications.approve",
          },
        }),
      ).toBe(1);

      const providerAdmin = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      expect(
        await context.prisma.userRole.count({
          where: {
            userId: owner.userId,
            roleId: providerAdmin.id,
            status: "ENABLED",
          },
        }),
      ).toBe(1);
    } finally {
      await context.stop();
    }
  });
});

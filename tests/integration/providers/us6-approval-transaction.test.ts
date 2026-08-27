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

vi.setConfig({ testTimeout: 120_000 });

describe.skipIf(!hasDatabase)("US6 approval transaction (T072)", () => {
  it("approves atomically with OWNER effects and leaves INACTIVE", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-approve-owner",
      });
      const staff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-approve-staff",
      });
      await grantStaffAdminForTests(context.prisma, staff.userId);

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

      const nonStaff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-approve-denied",
      });
      const denied = await request(context.app)
        .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
        .set("Authorization", `Bearer ${nonStaff.accessToken}`)
        .send({ expectedVersion: version })
        .expect(403);
      expect(denied.body.error.code).toBe("PROVIDER_ACCESS_DENIED");

      const approved = await request(context.app)
        .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);

      expect(approved.body.data.provider).toMatchObject({
        id: providerId,
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
      });
      expect(approved.body.data.readiness.eligibleForPublicBrowse).toBe(false);
      const applicationApprovedGate = (
        approved.body.data.readiness.gates as Array<{
          key: string;
          satisfied: boolean;
        }>
      ).find((gate) => gate.key === "applicationApproved");
      expect(applicationApprovedGate?.satisfied).toBe(true);
      const liveGate = (
        approved.body.data.readiness.gates as Array<{
          key: string;
          satisfied: boolean;
        }>
      ).find((gate) => gate.key === "operationalLive");
      expect(liveGate?.satisfied).toBe(false);

      const provider = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(provider).toMatchObject({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        ownerUserId: owner.userId,
      });
      expect(provider.approvedAt).not.toBeNull();

      const user = await context.prisma.user.findUniqueOrThrow({
        where: { id: owner.userId },
      });
      expect(user.accountCategories).toContain("PROVIDER_OWNER");
      expect(user.verifiedCategories).toContain("PROVIDER_OWNER");

      const providerAdmin = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      const roleGrant = await context.prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId: owner.userId,
            roleId: providerAdmin.id,
          },
        },
      });
      expect(roleGrant?.status).toBe("ENABLED");

      expect(
        await context.prisma.providerMember.count({
          where: {
            providerId,
            userId: owner.userId,
            level: "OWNER",
            status: "ACTIVE",
          },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerStatusHistory.count({
          where: {
            providerId,
            toApplicationStatus: "APPROVED",
            reviewCycle: provider.reviewCycle,
          },
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

      const retry = await request(context.app)
        .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ expectedVersion: provider.version })
        .expect(200);
      expect(retry.body.data.provider.applicationStatus).toBe("APPROVED");
      expect(
        await context.prisma.providerMember.count({ where: { providerId } }),
      ).toBe(1);
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "APPROVED" },
        }),
      ).toBe(1);

      const admin = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-approve-admin-access",
      });
      await context.prisma.userRole.create({
        data: {
          userId: admin.userId,
          roleId: providerAdmin.id,
          status: "ENABLED",
          enabledAt: new Date(),
        },
      });
      await context.prisma.providerMember.create({
        data: {
          providerId,
          userId: admin.userId,
          level: "ADMIN",
          status: "ACTIVE",
          invitedByUserId: owner.userId,
          enabledAt: new Date(),
        },
      });

      await context.prisma.providerMember.updateMany({
        where: { providerId, userId: admin.userId },
        data: { status: "DISABLED", disabledAt: new Date() },
      });
      const disabledMemberList = await request(context.app)
        .get("/api/v1/providers")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(200);
      expect(disabledMemberList.body.data).toEqual([]);
      for (const path of [
        `/api/v1/providers/${providerId}`,
        `/api/v1/providers/${providerId}/contacts`,
        `/api/v1/providers/${providerId}/media`,
        `/api/v1/providers/${providerId}/completion`,
      ]) {
        await request(context.app)
          .get(path)
          .set("Authorization", `Bearer ${admin.accessToken}`)
          .expect(404);
      }

      await context.prisma.providerMember.updateMany({
        where: { providerId, userId: admin.userId },
        data: { status: "ACTIVE", disabledAt: null },
      });
      await context.prisma.userRole.updateMany({
        where: { userId: admin.userId, roleId: providerAdmin.id },
        data: { status: "DISABLED", disabledAt: new Date() },
      });
      await request(context.app)
        .get(`/api/v1/providers/${providerId}`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(404);

      await context.prisma.providerMember.deleteMany({
        where: { providerId, userId: admin.userId },
      });
      await context.prisma.userRole.updateMany({
        where: { userId: admin.userId, roleId: providerAdmin.id },
        data: { status: "ENABLED", disabledAt: null },
      });
      await request(context.app)
        .get(`/api/v1/providers/${providerId}`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(404);
    } finally {
      await context.stop();
    }
  });
});

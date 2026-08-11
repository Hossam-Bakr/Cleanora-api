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

describe.skipIf(!hasDatabase)("US8 terminal rejection (T091)", () => {
  it("rejects terminally with reason and no authority side effects", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us8-owner",
      });
      const staff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us8-staff",
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

      const blank = await request(context.app)
        .post(`/api/v1/staff/providers/applications/${providerId}/reject`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ reason: "", expectedVersion: version });
      expect([400]).toContain(blank.status);

      const rejected = await request(context.app)
        .post(`/api/v1/staff/providers/applications/${providerId}/reject`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({
          reason: "Application does not meet marketplace standards",
          expectedVersion: version,
        })
        .expect(200);
      expect(rejected.body.data.provider.applicationStatus).toBe("REJECTED");
      version = rejected.body.data.provider.version as number;

      const provider = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(provider.applicationStatus).toBe("REJECTED");
      expect(provider.rejectedAt).not.toBeNull();
      expect(provider.ownerUserId).toBeNull();

      const history = await context.prisma.providerStatusHistory.findFirst({
        where: { providerId, toApplicationStatus: "REJECTED" },
      });
      expect(history).toMatchObject({
        actorUserId: staff.userId,
        reason: "Application does not meet marketplace standards",
        reviewCycle: 1,
      });
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "REJECTED" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerMember.count({ where: { providerId } }),
      ).toBe(0);
      expect(
        await context.prisma.providerAdminInvitation.count({
          where: { providerId },
        }),
      ).toBe(0);

      const user = await context.prisma.user.findUniqueOrThrow({
        where: { id: owner.userId },
      });
      expect(user.accountCategories).not.toContain("PROVIDER_OWNER");
      expect(user.verifiedCategories).not.toContain("PROVIDER_OWNER");
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
      ).toBe(0);

      const resubmit = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ expectedVersion: version })
        .expect(409);
      expect(resubmit.body.error.code).toBe("PROVIDER_STATE_CONFLICT");

      const profileEdit = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          displayNameAr: "محاولة بعد الرفض",
          displayNameEn: null,
          descriptionAr: "يجب أن ترفض",
          descriptionEn: null,
          countryCode: "EG",
          expectedVersion: version,
        });
      expect([403, 404, 409]).toContain(profileEdit.status);
    } finally {
      await context.stop();
    }
  });
});

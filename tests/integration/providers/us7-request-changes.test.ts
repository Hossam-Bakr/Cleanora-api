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

describe.skipIf(!hasDatabase)("US7 request changes (T084)", () => {
  it("requests changes with reason, restores owner edit, and preserves cycles on resubmit", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us7-owner",
      });
      const staff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us7-staff",
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
        .post(
          `/api/v1/staff/providers/applications/${providerId}/request-changes`,
        )
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ reason: "   ", expectedVersion: version });
      expect([400]).toContain(blank.status);
      expect(
        ["PROVIDER_REASON_REQUIRED", "VALIDATION_ERROR"].includes(
          blank.body.error.code as string,
        ),
      ).toBe(true);

      const changed = await request(context.app)
        .post(
          `/api/v1/staff/providers/applications/${providerId}/request-changes`,
        )
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({
          reason: "  Please clarify Arabic description  ",
          expectedVersion: version,
        })
        .expect(200);
      expect(changed.body.data.provider.applicationStatus).toBe(
        "CHANGES_REQUESTED",
      );
      version = changed.body.data.provider.version as number;

      const history = await context.prisma.providerStatusHistory.findFirst({
        where: {
          providerId,
          toApplicationStatus: "CHANGES_REQUESTED",
        },
      });
      expect(history).toMatchObject({
        reason: "Please clarify Arabic description",
        actorUserId: staff.userId,
        reviewCycle: 1,
      });
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "CHANGES_REQUESTED" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerMember.count({ where: { providerId } }),
      ).toBe(0);

      const profileEdit = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          displayNameAr: "اسم محدث",
          displayNameEn: null,
          descriptionAr: "وصف عربي محدث بعد طلب التعديل",
          descriptionEn: null,
          countryCode: "EG",
          expectedVersion: version,
        })
        .expect(200);
      version = profileEdit.body.data.version as number;

      const resubmitted = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
      expect(resubmitted.body.data.provider.applicationStatus).toBe(
        "PENDING_REVIEW",
      );
      const provider = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(provider.reviewCycle).toBe(2);
      expect(
        await context.prisma.providerStatusHistory.count({
          where: { providerId, toApplicationStatus: "PENDING_REVIEW" },
        }),
      ).toBe(2);
    } finally {
      await context.stop();
    }
  });
});

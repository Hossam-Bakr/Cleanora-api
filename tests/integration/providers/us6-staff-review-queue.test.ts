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

async function createSubmittedApplication(
  context: Awaited<ReturnType<typeof startProviderApplicationTestApp>>,
  label: string,
): Promise<{
  readonly providerId: string;
  readonly version: number;
  readonly owner: Awaited<ReturnType<typeof signupAndLogin>>;
}> {
  const owner = await signupAndLogin(context.app, {
    accountCategory: "INDIVIDUAL",
    emailInbox: context.email,
    label,
  });
  const created = await request(context.app)
    .post("/api/v1/providers")
    .set("Authorization", `Bearer ${owner.accessToken}`)
    .send({ providerKind: "INDIVIDUAL_TEAM" })
    .expect(201);
  const providerId = created.body.data.provider.id as string;
  const version = created.body.data.provider.version as number;
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
  return {
    providerId,
    version: submitted.body.data.provider.version as number,
    owner,
  };
}

describe.skipIf(!hasDatabase)("US6 staff review queue (T071)", () => {
  it("requires review permission and returns ordered filtered queue plus private dossier", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const first = await createSubmittedApplication(context, "us6-q1");
      const second = await createSubmittedApplication(context, "us6-q2");
      const earlier = new Date("1970-01-01T00:00:00.000Z");
      const later = new Date("1970-01-01T00:00:01.000Z");
      await context.prisma.provider.updateMany({
        where: {
          applicationStatus: "PENDING_REVIEW",
          id: { notIn: [first.providerId, second.providerId] },
        },
        data: { lastSubmittedAt: new Date("2099-01-01T00:00:00.000Z") },
      });
      await context.prisma.provider.update({
        where: { id: first.providerId },
        data: { lastSubmittedAt: earlier },
      });
      await context.prisma.provider.update({
        where: { id: second.providerId },
        data: { lastSubmittedAt: later },
      });

      const nonStaff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-nonstaff",
      });
      const denied = await request(context.app)
        .get("/api/v1/staff/providers/applications")
        .set("Authorization", `Bearer ${nonStaff.accessToken}`)
        .expect(403);
      expect(denied.body.error.code).toBe("PROVIDER_ACCESS_DENIED");

      const staff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us6-staff",
      });
      await grantStaffAdminForTests(context.prisma, staff.userId);

      const queue = await request(context.app)
        .get("/api/v1/staff/providers/applications")
        .query({ status: "PENDING_REVIEW", limit: 20 })
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .expect(200);

      const ids = (queue.body.data as Array<{ id: string }>).map(
        (item) => item.id,
      );
      // Other PENDING_REVIEW rows are pushed to a far-future submittedAt so these
      // two stay first; a shared disposable DB may still paginate beyond limit.
      const firstIndex = ids.indexOf(first.providerId);
      const secondIndex = ids.indexOf(second.providerId);
      expect(firstIndex).toBe(0);
      expect(secondIndex).toBe(1);

      const dossier = await request(context.app)
        .get(`/api/v1/staff/providers/applications/${first.providerId}`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .expect(200);
      expect(dossier.body.data.provider.id).toBe(first.providerId);
      expect(dossier.body.data.contacts.operationalEmail).toBeTruthy();
      expect(dossier.body.data.applicantContext.individualFullName).toBeTruthy();
      expect(dossier.body.data.statusHistory.length).toBeGreaterThan(0);
      expect(JSON.stringify(dossier.body.data)).not.toMatch(/storageKey/i);
    } finally {
      await context.stop();
    }
  });
});

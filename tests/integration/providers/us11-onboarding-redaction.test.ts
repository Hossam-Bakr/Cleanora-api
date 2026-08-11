import type { Express } from "express";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import { seedCompleteProviderApplicationContent } from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import { grantStaffAdminForTests } from "../../helpers/grant-staff-admin.js";
import { uniqueIdentity } from "../../helpers/authentication/test-authentication-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 240_000 });

async function approveProvider(input: {
  readonly app: Express;
  readonly prisma: Awaited<
    ReturnType<typeof startProviderApplicationTestApp>
  >["prisma"];
  readonly email: Awaited<
    ReturnType<typeof startProviderApplicationTestApp>
  >["email"];
  readonly ownerAccessToken: string;
  readonly ownerUserId: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
}): Promise<{ readonly providerId: string; readonly version: number }> {
  const staff = await signupAndLogin(input.app, {
    accountCategory: "INDIVIDUAL",
    emailInbox: input.email,
    label: "us11r-staff",
  });
  await grantStaffAdminForTests(input.prisma, staff.userId);
  const created = await request(input.app)
    .post("/api/v1/providers")
    .set("Authorization", `Bearer ${input.ownerAccessToken}`)
    .send({ providerKind: "INDIVIDUAL_TEAM" })
    .expect(201);
  const providerId = created.body.data.provider.id as string;
  let version = created.body.data.provider.version as number;
  await seedCompleteProviderApplicationContent(input.prisma, {
    providerId,
    ownerUserId: input.ownerUserId,
    emailNormalized: input.ownerEmail,
    phoneE164: input.ownerPhone,
  });
  const submitted = await request(input.app)
    .post(`/api/v1/providers/${providerId}/application/submit`)
    .set("Authorization", `Bearer ${input.ownerAccessToken}`)
    .send({ expectedVersion: version })
    .expect(200);
  version = submitted.body.data.provider.version as number;
  const approved = await request(input.app)
    .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
    .set("Authorization", `Bearer ${staff.accessToken}`)
    .send({ expectedVersion: version })
    .expect(200);
  return {
    providerId,
    version: approved.body.data.provider.version as number,
  };
}

describe.skipIf(!hasDatabase)("US11 onboarding redaction (T121)", () => {
  it("keeps tokens, passwords, OTPs, and private emails out of failure responses", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us11r-owner",
      });
      const approved = await approveProvider({
        app: context.app,
        prisma: context.prisma,
        email: context.email,
        ownerAccessToken: owner.accessToken,
        ownerUserId: owner.userId,
        ownerEmail: owner.identity.email,
        ownerPhone: owner.identity.phone,
      });
      const invitee = uniqueIdentity("us11r-new");
      await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          email: invitee.email,
          expectedVersion: approved.version,
        })
        .expect(202);
      const rawToken = context.invitationEmail.latestInvitationToken()!;

      const invalidInspect = await request(context.app)
        .post("/api/v1/provider-admin-invitations/inspect")
        .send({ token: `${rawToken}x` })
        .expect(410);
      expect(JSON.stringify(invalidInspect.body)).not.toContain(rawToken);
      expect(JSON.stringify(invalidInspect.body)).not.toContain(invitee.email);

      const started = await request(context.app)
        .post("/api/v1/provider-admin-invitations/onboarding/start")
        .send({
          token: rawToken,
          phone: invitee.phone,
          password: invitee.password,
        })
        .expect(202);
      const badVerify = await request(context.app)
        .post("/api/v1/provider-admin-invitations/onboarding/verify-email")
        .send({
          token: rawToken,
          challengeId: started.body.data.challengeId,
          code: "000000",
        });
      expect([400, 401, 409]).toContain(badVerify.status);
      expect(JSON.stringify(badVerify.body)).not.toContain(invitee.password);
      expect(JSON.stringify(badVerify.body)).not.toContain("000000");

      const mismatch = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us11r-mismatch",
      });
      const denied = await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${mismatch.accessToken}`)
        .send({ token: rawToken })
        .expect(403);
      expect(denied.body.error.code).toBe("PROVIDER_INVITATION_EMAIL_MISMATCH");
      expect(JSON.stringify(denied.body)).not.toContain(invitee.email);
    } finally {
      await context.stop();
    }
  });
});

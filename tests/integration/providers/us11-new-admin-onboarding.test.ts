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
    label: "us11-staff",
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

describe.skipIf(!hasDatabase)("US11 new admin onboarding (T119)", () => {
  it("onboards a categoryless invitee and accepts atomically", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us11-owner",
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
      const invitee = uniqueIdentity("us11-new");
      await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          email: invitee.email,
          expectedVersion: approved.version,
        })
        .expect(202);
      const rawToken = context.invitationEmail.latestInvitationToken()!;

      const inspect = await request(context.app)
        .post("/api/v1/provider-admin-invitations/inspect")
        .send({ token: rawToken })
        .expect(200);
      expect(inspect.body.data.nextAction).toBe("START_ONBOARDING");

      const started = await request(context.app)
        .post("/api/v1/provider-admin-invitations/onboarding/start")
        .send({
          token: rawToken,
          phone: invitee.phone,
          password: invitee.password,
        })
        .expect(202);
      expect(started.body.data.challengeId).toBeTruthy();
      expect(JSON.stringify(started.body)).not.toMatch(/\b\d{6}\b/u);

      const user = await context.prisma.user.findUniqueOrThrow({
        where: { emailNormalized: invitee.email.toLowerCase() },
      });
      expect(user.accountCategories).toEqual([]);
      expect(user.verifiedCategories).toEqual([]);

      const otp = await context.prisma.otpCode.findUniqueOrThrow({
        where: { id: started.body.data.challengeId as string },
      });
      expect(otp.accountCategory).toBeNull();
      expect(otp.purpose).toBe("PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION");

      const delivery = context.email.latest(invitee.email);
      const verified = await request(context.app)
        .post("/api/v1/provider-admin-invitations/onboarding/verify-email")
        .send({
          token: rawToken,
          challengeId: started.body.data.challengeId,
          code: delivery!.value,
        })
        .expect(200);
      expect(verified.body.data.capability).toBe(
        "PROVIDER_ADMIN_INVITATION_ONBOARDING",
      );
      expect(verified.body.data.allowedActions).toEqual([
        "ACCEPT_PROVIDER_ADMIN_INVITATION",
        "SESSION_CLEANUP",
      ]);

      const accepted = await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${verified.body.data.accessToken}`)
        .send({ token: rawToken })
        .expect(200);
      expect(accepted.body.data.membershipLevel).toBe("ADMIN");

      const refreshedUser = await context.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(refreshedUser.accountCategories).toEqual([]);
      expect(refreshedUser.verifiedCategories).toEqual([]);

      const providerAdmin = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      expect(
        await context.prisma.userRole.count({
          where: {
            userId: user.id,
            roleId: providerAdmin.id,
            status: "ENABLED",
          },
        }),
      ).toBe(1);

      const login = await request(context.app)
        .post("/api/v1/auth/login")
        .send({ phone: invitee.phone, password: invitee.password })
        .expect(200);
      expect(login.body.data.verificationOnly).toBe(false);
    } finally {
      await context.stop();
    }
  });
});

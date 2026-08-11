import type { Express } from "express";
import { ConcurrencyBarrier } from "../../helpers/provider-concurrency.js";
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

vi.setConfig({ testTimeout: 300_000 });

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
    label: "us11c-staff",
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

describe.skipIf(!hasDatabase)("US11 onboarding concurrency (T120)", () => {
  it("keeps accept atomic against concurrent revoke/resend", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us11c-owner",
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
      const invitee = uniqueIdentity("us11c-new");
      const created = await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          email: invitee.email,
          expectedVersion: approved.version,
        })
        .expect(202);
      const invitationId = created.body.data.invitation.id as string;
      const invitationVersion = created.body.data.invitation.version as number;
      const rawToken = context.invitationEmail.latestInvitationToken()!;

      const started = await request(context.app)
        .post("/api/v1/provider-admin-invitations/onboarding/start")
        .send({
          token: rawToken,
          phone: invitee.phone,
          password: invitee.password,
        })
        .expect(202);
      const delivery = context.email.latest(invitee.email);
      const verified = await request(context.app)
        .post("/api/v1/provider-admin-invitations/onboarding/verify-email")
        .send({
          token: rawToken,
          challengeId: started.body.data.challengeId,
          code: delivery!.value,
        })
        .expect(200);

      const barrier = new ConcurrencyBarrier(3);
      const responses = await Promise.all([
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post("/api/v1/provider-admin-invitations/accept")
            .set("Authorization", `Bearer ${verified.body.data.accessToken}`)
            .send({ token: rawToken });
        })(),
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post(
              `/api/v1/providers/${approved.providerId}/admin-invitations/${invitationId}/revoke`,
            )
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ expectedVersion: invitationVersion });
        })(),
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post(
              `/api/v1/providers/${approved.providerId}/admin-invitations/${invitationId}/resend`,
            )
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ expectedVersion: invitationVersion });
        })(),
      ]);

      const successAccepts = responses.filter(
        (response) =>
          response.status === 200 &&
          response.body?.data?.invitationStatus === "ACCEPTED",
      );
      expect(successAccepts.length).toBeLessThanOrEqual(1);

      const members = await context.prisma.providerMember.count({
        where: {
          providerId: approved.providerId,
          level: "ADMIN",
          status: "ACTIVE",
        },
      });
      const acceptedInvites = await context.prisma.providerAdminInvitation.count({
        where: { id: invitationId, status: "ACCEPTED" },
      });
      expect(members).toBe(acceptedInvites);
    } finally {
      await context.stop();
    }
  });
});

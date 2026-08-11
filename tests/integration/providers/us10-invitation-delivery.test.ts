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
    label: "us10d-staff",
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

describe.skipIf(!hasDatabase)("US10 invitation delivery (T110)", () => {
  it("records RESEND_REQUIRED without durable raw token and rotates on resend", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10d-owner",
      });
      const invitee = uniqueIdentity("us10d-invitee");
      const approved = await approveProvider({
        app: context.app,
        prisma: context.prisma,
        email: context.email,
        ownerAccessToken: owner.accessToken,
        ownerUserId: owner.userId,
        ownerEmail: owner.identity.email,
        ownerPhone: owner.identity.phone,
      });

      context.invitationEmail.failNextDelivery = true;
      const failed = await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          email: invitee.email,
          expectedVersion: approved.version,
        })
        .expect(202);
      expect(failed.body.data.deliveryState).toBe("RESEND_REQUIRED");
      const failedToken = context.invitationEmail.latestInvitationToken()!;
      expect(JSON.stringify(failed.body)).not.toContain(failedToken);

      const invitationId = failed.body.data.invitation.id as string;
      const row = await context.prisma.providerAdminInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      });
      expect(row.tokenVerifier).not.toContain(failedToken);
      expect(row.lastSafeDeliveryErrorCode).toBe(
        "PROVIDER_INVITATION_DELIVERY_FAILED",
      );
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId: approved.providerId },
        }),
      ).toBeGreaterThanOrEqual(0);
      const outboxRows = await context.prisma.providerEmailOutbox.findMany({
        where: { providerId: approved.providerId },
      });
      expect(JSON.stringify(outboxRows)).not.toContain(failedToken);
      expect(
        outboxRows.every((row) =>
          [
            "APPLICATION_SUBMITTED",
            "CHANGES_REQUESTED",
            "APPROVED",
            "REJECTED",
            "SUSPENDED",
            "REINSTATED",
          ].includes(row.template),
        ),
      ).toBe(true);

      const auditRows = await context.prisma.auditLog.findMany({
        where: { targetId: invitationId },
      });
      expect(JSON.stringify(auditRows)).not.toContain(failedToken);

      const resent = await request(context.app)
        .post(
          `/api/v1/providers/${approved.providerId}/admin-invitations/${invitationId}/resend`,
        )
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ expectedVersion: failed.body.data.invitation.version })
        .expect(202);
      expect(resent.body.data.deliveryState).toBe("DELIVERED");
      expect(resent.body.data.invitation.tokenVersion).toBeGreaterThan(
        failed.body.data.invitation.tokenVersion,
      );
      const rotatedToken = context.invitationEmail.latestInvitationToken()!;
      expect(rotatedToken).not.toBe(failedToken);

      await request(context.app)
        .post("/api/v1/provider-admin-invitations/inspect")
        .send({ token: failedToken })
        .expect(410);
      await request(context.app)
        .post("/api/v1/provider-admin-invitations/inspect")
        .send({ token: rotatedToken })
        .expect(200);
    } finally {
      await context.stop();
    }
  });
});

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
    label: "us10-staff",
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

describe.skipIf(!hasDatabase)("US10 existing admin invitation (T108)", () => {
  it("creates, inspects, accepts, lists, and soft-disables ADMIN", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-owner",
      });
      const invitee = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-invitee",
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

      const providerRow = await context.prisma.provider.findUniqueOrThrow({
        where: { id: approved.providerId },
      });
      const created = await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          email: invitee.identity.email,
          expectedVersion: providerRow.version,
        })
        .expect(202);
      expect(created.body.data.deliveryState).toBe("DELIVERED");
      expect(JSON.stringify(created.body)).not.toMatch(/tokenVerifier|rawToken/u);
      expect(created.body.data.invitation.emailMasked).toContain("***@");

      const rawToken = context.invitationEmail.latestInvitationToken();
      expect(rawToken).toBeTruthy();

      const inspected = await request(context.app)
        .post("/api/v1/provider-admin-invitations/inspect")
        .send({ token: rawToken })
        .expect(200);
      expect(inspected.body.data.nextAction).toBe("ACCEPT_EXISTING");
      expect(inspected.body.data.providerId).toBe(approved.providerId);

      const accepted = await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .send({ token: rawToken })
        .expect(200);
      expect(accepted.body.data.membershipLevel).toBe("ADMIN");
      expect(accepted.body.data.invitationStatus).toBe("ACCEPTED");

      const visibleProviders = await request(context.app)
        .get("/api/v1/providers")
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .expect(200);
      expect(
        visibleProviders.body.data.some(
          (row: { id: string; actorRelationship: string }) =>
            row.id === approved.providerId && row.actorRelationship === "ADMIN",
        ),
      ).toBe(true);
      expect(visibleProviders.body.meta).toEqual({ nextCursor: null });
      const privateAggregate = await request(context.app)
        .get(`/api/v1/providers/${approved.providerId}`)
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .expect(200);
      expect(privateAggregate.body.data.provider).toMatchObject({
        id: approved.providerId,
        actorRelationship: "ADMIN",
      });
      const ownerAggregate = await request(context.app)
        .get(`/api/v1/providers/${approved.providerId}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(privateAggregate.body.data.completion).toEqual(
        ownerAggregate.body.data.completion,
      );
      expect(privateAggregate.body.data.readiness).toEqual(
        ownerAggregate.body.data.readiness,
      );

      const providerProfile =
        await context.prisma.providerProfile.findUniqueOrThrow({
          where: { providerId: approved.providerId },
          select: { countryId: true },
        });
      expect(providerProfile.countryId).not.toBeNull();
      await context.prisma.country.update({
        where: { id: providerProfile.countryId! },
        data: { isActive: false },
      });
      try {
        const adminAfterCountryDeactivation = await request(context.app)
          .get(`/api/v1/providers/${approved.providerId}`)
          .set("Authorization", `Bearer ${invitee.accessToken}`)
          .expect(200);
        expect(
          adminAfterCountryDeactivation.body.data.completion
            .missingRequirementCodes,
        ).toContain("ACTIVE_COUNTRY");

        const pagedAfterCountryDeactivation = await request(context.app)
          .get("/api/v1/providers?limit=1")
          .set("Authorization", `Bearer ${invitee.accessToken}`)
          .expect(200);
        expect(pagedAfterCountryDeactivation.body.data).toHaveLength(1);
        expect(pagedAfterCountryDeactivation.body.data[0]).toMatchObject({
          id: approved.providerId,
          actorRelationship: "ADMIN",
          completionPercentage: 90,
        });
      } finally {
        await context.prisma.country.update({
          where: { id: providerProfile.countryId! },
          data: { isActive: true },
        });
      }

      await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .send({ token: rawToken })
        .expect(200);

      const members = await request(context.app)
        .get(`/api/v1/providers/${approved.providerId}/members`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(
        members.body.data.some(
          (row: { userId: string; level: string; status: string }) =>
            row.userId === invitee.userId &&
            row.level === "ADMIN" &&
            row.status === "ACTIVE",
        ),
      ).toBe(true);

      const providerAdmin = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      expect(
        await context.prisma.userRole.count({
          where: {
            userId: invitee.userId,
            roleId: providerAdmin.id,
            status: "ENABLED",
          },
        }),
      ).toBe(1);

      await context.prisma.userRole.updateMany({
        where: { userId: invitee.userId, roleId: providerAdmin.id },
        data: { status: "DISABLED" },
      });
      await request(context.app)
        .get(`/api/v1/providers/${approved.providerId}/media`)
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .expect(404);
      await context.prisma.userRole.updateMany({
        where: { userId: invitee.userId, roleId: providerAdmin.id },
        data: { status: "ENABLED" },
      });

      const provider = await context.prisma.provider.findUniqueOrThrow({
        where: { id: approved.providerId },
      });
      await request(context.app)
        .delete(
          `/api/v1/providers/${approved.providerId}/members/${invitee.userId}`,
        )
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ expectedVersion: provider.version })
        .expect(200);
      await request(context.app)
        .get(`/api/v1/providers/${approved.providerId}/media`)
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .expect(404);

      expect(
        await context.prisma.userRole.count({
          where: {
            userId: invitee.userId,
            roleId: providerAdmin.id,
            status: "ENABLED",
          },
        }),
      ).toBe(0);
    } finally {
      await context.stop();
    }
  });

  it("rejects ADMIN from creating invitations", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-owner-deny",
      });
      const invitee = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-admin-actor",
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
      await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          email: invitee.identity.email,
          expectedVersion: approved.version,
        })
        .expect(202);
      const rawToken = context.invitationEmail.latestInvitationToken()!;
      await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .send({ token: rawToken })
        .expect(200);

      const provider = await context.prisma.provider.findUniqueOrThrow({
        where: { id: approved.providerId },
      });
      const other = uniqueIdentity("us10-other");
      await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .send({ email: other.email, expectedVersion: provider.version })
        .expect(403);
    } finally {
      await context.stop();
    }
  });
});

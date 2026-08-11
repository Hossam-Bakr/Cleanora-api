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
  readonly label: string;
}): Promise<{ readonly providerId: string; readonly version: number }> {
  const staff = await signupAndLogin(input.app, {
    accountCategory: "INDIVIDUAL",
    emailInbox: input.email,
    label: `${input.label}-staff`,
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

describe.skipIf(!hasDatabase)("US10 invitation concurrency (T109)", () => {
  it("serializes concurrent removal of a user's final two Provider memberships", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const ownerOne = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-final-owner-one",
      });
      const ownerTwo = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-final-owner-two",
      });
      const target = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-final-target",
      });
      const providerAdmin = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      const now = new Date();
      for (const userId of [ownerOne.userId, ownerTwo.userId, target.userId]) {
        await context.prisma.userRole.upsert({
          where: { userId_roleId: { userId, roleId: providerAdmin.id } },
          create: {
            userId,
            roleId: providerAdmin.id,
            status: "ENABLED",
            enabledAt: now,
          },
          update: { status: "ENABLED", enabledAt: now, disabledAt: null },
        });
      }
      const createApproved = (ownerUserId: string) =>
        context.prisma.provider.create({
          data: {
            applicationOwnerUserId: ownerUserId,
            ownerUserId,
            kind: "INDIVIDUAL_TEAM",
            applicationStatus: "APPROVED",
            operationalStatus: "INACTIVE",
            reviewCycle: 1,
            approvedAt: now,
            profile: { create: {} },
            contact: { create: { channels: [] } },
            members: {
              create: [
                {
                  userId: ownerUserId,
                  level: "OWNER",
                  status: "ACTIVE",
                  enabledAt: now,
                },
                {
                  userId: target.userId,
                  level: "ADMIN",
                  status: "ACTIVE",
                  enabledAt: now,
                  invitedByUserId: ownerUserId,
                },
              ],
            },
          },
        });
      const [providerOne, providerTwo] = await Promise.all([
        createApproved(ownerOne.userId),
        createApproved(ownerTwo.userId),
      ]);

      const barrier = new ConcurrencyBarrier(2);
      const responses = await Promise.all([
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .delete(`/api/v1/providers/${providerOne.id}/members/${target.userId}`)
            .set("Authorization", `Bearer ${ownerOne.accessToken}`)
            .send({ expectedVersion: providerOne.version });
        })(),
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .delete(`/api/v1/providers/${providerTwo.id}/members/${target.userId}`)
            .set("Authorization", `Bearer ${ownerTwo.accessToken}`)
            .send({ expectedVersion: providerTwo.version });
        })(),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 200]);
      expect(
        await context.prisma.providerMember.count({
          where: { userId: target.userId, status: "ACTIVE" },
        }),
      ).toBe(0);
      expect(
        await context.prisma.userRole.count({
          where: {
            userId: target.userId,
            roleId: providerAdmin.id,
            status: "ENABLED",
          },
        }),
      ).toBe(0);
    } finally {
      await context.stop();
    }
  });

  it("serializes invitation acceptance against final-membership disable", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const existingOwner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-accept-disable-owner",
      });
      const invitingOwner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-accept-disable-inviter",
      });
      const target = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-accept-disable-target",
      });
      const existingProvider = await approveProvider({
        app: context.app,
        prisma: context.prisma,
        email: context.email,
        ownerAccessToken: existingOwner.accessToken,
        ownerUserId: existingOwner.userId,
        ownerEmail: existingOwner.identity.email,
        ownerPhone: existingOwner.identity.phone,
        label: "us10-accept-disable-existing",
      });
      const invitingProvider = await approveProvider({
        app: context.app,
        prisma: context.prisma,
        email: context.email,
        ownerAccessToken: invitingOwner.accessToken,
        ownerUserId: invitingOwner.userId,
        ownerEmail: invitingOwner.identity.email,
        ownerPhone: invitingOwner.identity.phone,
        label: "us10-accept-disable-inviting",
      });
      const providerAdmin = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      const now = new Date();
      await context.prisma.providerMember.create({
        data: {
          providerId: existingProvider.providerId,
          userId: target.userId,
          level: "ADMIN",
          status: "ACTIVE",
          enabledAt: now,
          invitedByUserId: existingOwner.userId,
        },
      });
      await context.prisma.userRole.upsert({
        where: {
          userId_roleId: { userId: target.userId, roleId: providerAdmin.id },
        },
        create: {
          userId: target.userId,
          roleId: providerAdmin.id,
          status: "ENABLED",
          enabledAt: now,
        },
        update: { status: "ENABLED", enabledAt: now, disabledAt: null },
      });
      const created = await request(context.app)
        .post(
          `/api/v1/providers/${invitingProvider.providerId}/admin-invitations`,
        )
        .set("Authorization", `Bearer ${invitingOwner.accessToken}`)
        .send({
          email: target.identity.email,
          expectedVersion: invitingProvider.version,
        })
        .expect(202);
      const rawToken = context.invitationEmail.latestInvitationToken()!;

      const barrier = new ConcurrencyBarrier(2);
      const [disabled, accepted] = await Promise.all([
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .delete(
              `/api/v1/providers/${existingProvider.providerId}/members/${target.userId}`,
            )
            .set("Authorization", `Bearer ${existingOwner.accessToken}`)
            .send({ expectedVersion: existingProvider.version });
        })(),
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post("/api/v1/provider-admin-invitations/accept")
            .set("Authorization", `Bearer ${target.accessToken}`)
            .send({ token: rawToken });
        })(),
      ]);

      expect([disabled.status, accepted.status]).toEqual([200, 200]);
      expect(
        await context.prisma.providerMember.count({
          where: { userId: target.userId, status: "ACTIVE" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.userRole.count({
          where: {
            userId: target.userId,
            roleId: providerAdmin.id,
            status: "ENABLED",
          },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerAdminInvitation.count({
          where: {
            id: created.body.data.invitation.id as string,
            status: "ACCEPTED",
            acceptedByUserId: target.userId,
          },
        }),
      ).toBe(1);
    } finally {
      await context.stop();
    }
  });

  it("serializes Provider approval against final-membership disable", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const existingOwner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-approve-disable-owner",
      });
      const applicant = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-approve-disable-applicant",
      });
      const staff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10-approve-disable-staff",
      });
      await grantStaffAdminForTests(context.prisma, staff.userId);
      const existingProvider = await approveProvider({
        app: context.app,
        prisma: context.prisma,
        email: context.email,
        ownerAccessToken: existingOwner.accessToken,
        ownerUserId: existingOwner.userId,
        ownerEmail: existingOwner.identity.email,
        ownerPhone: existingOwner.identity.phone,
        label: "us10-approve-disable-existing",
      });
      const providerAdmin = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      const now = new Date();
      await context.prisma.providerMember.create({
        data: {
          providerId: existingProvider.providerId,
          userId: applicant.userId,
          level: "ADMIN",
          status: "ACTIVE",
          enabledAt: now,
          invitedByUserId: existingOwner.userId,
        },
      });
      await context.prisma.userRole.upsert({
        where: {
          userId_roleId: { userId: applicant.userId, roleId: providerAdmin.id },
        },
        create: {
          userId: applicant.userId,
          roleId: providerAdmin.id,
          status: "ENABLED",
          enabledAt: now,
        },
        update: { status: "ENABLED", enabledAt: now, disabledAt: null },
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${applicant.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const pendingProviderId = created.body.data.provider.id as string;
      await seedCompleteProviderApplicationContent(context.prisma, {
        providerId: pendingProviderId,
        ownerUserId: applicant.userId,
        emailNormalized: applicant.identity.email,
        phoneE164: applicant.identity.phone,
      });
      const submitted = await request(context.app)
        .post(`/api/v1/providers/${pendingProviderId}/application/submit`)
        .set("Authorization", `Bearer ${applicant.accessToken}`)
        .send({ expectedVersion: created.body.data.provider.version as number })
        .expect(200);

      const barrier = new ConcurrencyBarrier(2);
      const [disabled, approved] = await Promise.all([
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .delete(
              `/api/v1/providers/${existingProvider.providerId}/members/${applicant.userId}`,
            )
            .set("Authorization", `Bearer ${existingOwner.accessToken}`)
            .send({ expectedVersion: existingProvider.version });
        })(),
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post(
              `/api/v1/staff/providers/applications/${pendingProviderId}/approve`,
            )
            .set("Authorization", `Bearer ${staff.accessToken}`)
            .send({
              expectedVersion: submitted.body.data.provider.version as number,
            });
        })(),
      ]);

      expect([disabled.status, approved.status]).toEqual([200, 200]);
      expect(
        await context.prisma.providerMember.count({
          where: { userId: applicant.userId, status: "ACTIVE" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerMember.count({
          where: {
            providerId: pendingProviderId,
            userId: applicant.userId,
            level: "OWNER",
            status: "ACTIVE",
          },
        }),
      ).toBe(1);
      expect(
        await context.prisma.userRole.count({
          where: {
            userId: applicant.userId,
            roleId: providerAdmin.id,
            status: "ENABLED",
          },
        }),
      ).toBe(1);
    } finally {
      await context.stop();
    }
  });

  it("accepts once under concurrent accept vs resend/revoke/replay barriers", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10c-owner",
      });
      const invitee = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us10c-invitee",
      });
      const approved = await approveProvider({
        app: context.app,
        prisma: context.prisma,
        email: context.email,
        ownerAccessToken: owner.accessToken,
        ownerUserId: owner.userId,
        ownerEmail: owner.identity.email,
        ownerPhone: owner.identity.phone,
        label: "us10c",
      });
      const created = await request(context.app)
        .post(`/api/v1/providers/${approved.providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          email: invitee.identity.email,
          expectedVersion: approved.version,
        })
        .expect(202);
      const invitationId = created.body.data.invitation.id as string;
      const invitationVersion = created.body.data.invitation.version as number;
      const rawToken = context.invitationEmail.latestInvitationToken()!;

      const barrier = new ConcurrencyBarrier(3);
      const runners = await Promise.all([
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post("/api/v1/provider-admin-invitations/accept")
            .set("Authorization", `Bearer ${invitee.accessToken}`)
            .send({ token: rawToken });
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
        (async () => {
          await barrier.arriveAndWait();
          return request(context.app)
            .post(
              `/api/v1/providers/${approved.providerId}/admin-invitations/${invitationId}/revoke`,
            )
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ expectedVersion: invitationVersion });
        })(),
      ]);

      const acceptStatuses = runners.map((response) => response.status);
      expect(acceptStatuses.filter((status) => status === 200).length).toBeLessThanOrEqual(
        1,
      );

      const acceptedCount = await context.prisma.providerAdminInvitation.count({
        where: {
          providerId: approved.providerId,
          status: "ACCEPTED",
          acceptedByUserId: invitee.userId,
        },
      });
      const adminCount = await context.prisma.providerMember.count({
        where: {
          providerId: approved.providerId,
          userId: invitee.userId,
          level: "ADMIN",
          status: "ACTIVE",
        },
      });
      expect(acceptedCount).toBeLessThanOrEqual(1);
      expect(adminCount).toBe(acceptedCount);

      await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${invitee.accessToken}`)
        .send({ token: rawToken });
    } finally {
      await context.stop();
    }
  });
});

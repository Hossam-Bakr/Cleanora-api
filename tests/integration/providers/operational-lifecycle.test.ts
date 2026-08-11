import type { Express } from "express";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  ensureActiveTestCountry,
  seedCompleteProviderApplicationContent,
} from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import { grantStaffAdminForTests } from "../../helpers/grant-staff-admin.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

async function approveProvider(
  app: Express,
  input: {
    readonly ownerToken: string;
    readonly staffToken: string;
    readonly ownerUserId: string;
    readonly email: string;
    readonly phone: string;
    readonly prisma: PrismaClient;
  },
): Promise<{ readonly providerId: string; readonly version: number }> {
  const created = await request(app)
    .post("/api/v1/providers")
    .set("Authorization", `Bearer ${input.ownerToken}`)
    .send({ providerKind: "INDIVIDUAL_TEAM" })
    .expect(201);
  const providerId = created.body.data.provider.id as string;
  let version = created.body.data.provider.version as number;
  await seedCompleteProviderApplicationContent(input.prisma, {
    providerId,
    ownerUserId: input.ownerUserId,
    emailNormalized: input.email,
    phoneE164: input.phone,
  });
  const submitted = await request(app)
    .post(`/api/v1/providers/${providerId}/application/submit`)
    .set("Authorization", `Bearer ${input.ownerToken}`)
    .send({ expectedVersion: version })
    .expect(200);
  version = submitted.body.data.provider.version as number;
  const approved = await request(app)
    .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
    .set("Authorization", `Bearer ${input.staffToken}`)
    .send({ expectedVersion: version })
    .expect(200);
  return {
    providerId,
    version: approved.body.data.provider.version as number,
  };
}

describe.skipIf(!hasDatabase)("Operational lifecycle suspend/reinstate (T144)", () => {
  it("requires Staff lifecycle permission, reason, history/audit/outbox, and never LIVE", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const country = await ensureActiveTestCountry(context.prisma);
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "ops-life-owner",
      });
      const staff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "ops-life-staff",
      });
      await grantStaffAdminForTests(context.prisma, staff.userId);

      const { providerId, version: approvedVersion } = await approveProvider(
        context.app,
        {
          ownerToken: owner.accessToken,
          staffToken: staff.accessToken,
          ownerUserId: owner.userId,
          email: owner.identity.email,
          phone: owner.identity.phone,
          prisma: context.prisma,
        },
      );
      let version = approvedVersion;

      const nonStaff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "ops-life-denied",
      });
      const denied = await request(context.app)
        .post(`/api/v1/staff/providers/${providerId}/suspend`)
        .set("Authorization", `Bearer ${nonStaff.accessToken}`)
        .send({ reason: "policy", expectedVersion: version })
        .expect(403);
      expect(denied.body.error.code).toBe("PROVIDER_ACCESS_DENIED");

      const blankReason = await request(context.app)
        .post(`/api/v1/staff/providers/${providerId}/suspend`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ reason: "   ", expectedVersion: version })
        .expect(400);
      expect(blankReason.body.error.code).toMatch(
        /PROVIDER_REASON_REQUIRED|VALIDATION_ERROR/,
      );

      const suspended = await request(context.app)
        .post(`/api/v1/staff/providers/${providerId}/suspend`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ reason: "Safety review", expectedVersion: version })
        .expect(200);
      expect(suspended.body.data.provider).toMatchObject({
        id: providerId,
        applicationStatus: "APPROVED",
        operationalStatus: "SUSPENDED",
      });
      expect(suspended.body.data.readiness.eligibleForPublicBrowse).toBe(false);
      expect(
        (
          suspended.body.data.readiness.gates as Array<{
            key: string;
            satisfied: boolean;
          }>
        ).find((gate) => gate.key === "operationalLive")?.satisfied,
      ).toBe(false);
      version = suspended.body.data.provider.version as number;

      const row = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(row.operationalStatus).toBe("SUSPENDED");
      expect(row.suspendedAt).not.toBeNull();

      expect(
        await context.prisma.providerStatusHistory.count({
          where: {
            providerId,
            domain: "OPERATIONAL",
            fromOperationalStatus: "INACTIVE",
            toOperationalStatus: "SUSPENDED",
          },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "SUSPENDED" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.auditLog.count({
          where: {
            targetId: providerId,
            action: "providers.lifecycle.suspend",
          },
        }),
      ).toBe(1);

      const dashboard = await request(context.app)
        .get(`/api/v1/providers/${providerId}/dashboard`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(dashboard.body.data.nextAction.code).toBe("REMEDIATE_SUSPENSION");

      const remediate = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          displayNameAr: "مزود معلق قيد الإصلاح",
          displayNameEn: null,
          descriptionAr: "وصف عربي بعد التعليق للإصلاح",
          descriptionEn: null,
          countryCode: country.code,
          expectedVersion: version,
        })
        .expect(200);
      version = remediate.body.data.version as number;
      const stillSuspended = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(stillSuspended.applicationStatus).toBe("APPROVED");
      expect(stillSuspended.operationalStatus).toBe("SUSPENDED");

      const reinstated = await request(context.app)
        .post(`/api/v1/staff/providers/${providerId}/reinstate`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ reason: "Remediation accepted", expectedVersion: version })
        .expect(200);
      expect(reinstated.body.data.provider).toMatchObject({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
      });
      expect(reinstated.body.data.provider.operationalStatus).not.toBe("LIVE");
      expect(
        (
          reinstated.body.data.readiness.gates as Array<{
            key: string;
            satisfied: boolean;
          }>
        ).find((gate) => gate.key === "operationalLive")?.satisfied,
      ).toBe(false);

      const after = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(after.operationalStatus).toBe("INACTIVE");
      expect(after.suspendedAt).toBeNull();
      expect(
        await context.prisma.providerStatusHistory.count({
          where: {
            providerId,
            domain: "OPERATIONAL",
            fromOperationalStatus: "SUSPENDED",
            toOperationalStatus: "INACTIVE",
          },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "REINSTATED" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.auditLog.count({
          where: {
            targetId: providerId,
            action: "providers.lifecycle.reinstate",
          },
        }),
      ).toBe(1);
    } finally {
      await context.stop();
    }
  });
});

import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import { seedCompleteProviderApplicationContent } from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import { PROFILE_COMPLETION_CHECK_CODES } from "../../../src/modules/providers/domain/providers.types.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

describe.skipIf(!hasDatabase)("US5 submission and resubmission API (T064)", () => {
  it("rejects incomplete submit with every missing requirement code", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us5-incomplete",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      const version = created.body.data.provider.version as number;

      const incomplete = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(409);

      expect(incomplete.body.error.code).toBe("PROVIDER_SUBMISSION_INCOMPLETE");
      const missing = incomplete.body.error.details
        .missingRequirementCodes as string[];
      expect(missing).toEqual(
        expect.arrayContaining([
          "ARABIC_DISPLAY_NAME",
          "ARABIC_DESCRIPTION",
          "OPERATIONAL_EMAIL",
          "OPERATIONAL_PHONE",
          "ACTIVE_COUNTRY",
          "READY_LOGO",
          "READY_COVER",
          "MIN_READY_GALLERY_IMAGES",
        ]),
      );
      for (const code of missing) {
        expect(PROFILE_COMPLETION_CHECK_CODES).toContain(code);
      }
      expect(
        await context.prisma.provider.findUniqueOrThrow({
          where: { id: providerId },
        }),
      ).toMatchObject({
        applicationStatus: "DRAFT",
        reviewCycle: 0,
      });
    } finally {
      await context.stop();
    }
  });

  it("submits a complete draft, locks mutations, and retains cycles on resubmit", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us5-submit",
      });
      const other = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us5-other",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      let version = created.body.data.provider.version as number;

      await seedCompleteProviderApplicationContent(context.prisma, {
        providerId,
        ownerUserId: session.userId,
        emailNormalized: session.identity.email,
        phoneE164: session.identity.phone,
      });

      const deniedOther = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${other.accessToken}`)
        .send({ expectedVersion: version })
        .expect(404);
      expect(deniedOther.body.error.code).toBe("PROVIDER_NOT_FOUND");

      const submitted = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);

      expect(submitted.body.data.provider).toMatchObject({
        id: providerId,
        applicationStatus: "PENDING_REVIEW",
        version: version + 1,
      });
      version = submitted.body.data.provider.version as number;

      const providerRow = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(providerRow.reviewCycle).toBe(1);
      expect(providerRow.firstSubmittedAt).not.toBeNull();
      expect(providerRow.lastSubmittedAt).not.toBeNull();

      const submissionHistory =
        await context.prisma.providerStatusHistory.findMany({
          where: {
            providerId,
            toApplicationStatus: "PENDING_REVIEW",
          },
          orderBy: { createdAt: "asc" },
        });
      expect(submissionHistory).toHaveLength(1);
      expect(submissionHistory[0]).toMatchObject({
        fromApplicationStatus: "DRAFT",
        reviewCycle: 1,
        reason: "APPLICATION_SUBMITTED",
      });

      const outbox = await context.prisma.providerEmailOutbox.findMany({
        where: { providerId, template: "APPLICATION_SUBMITTED" },
      });
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({
        reviewCycle: 1,
        recipientUserId: session.userId,
        status: "PENDING",
      });

      const audit = await context.prisma.auditLog.findFirst({
        where: {
          targetId: providerId,
          action: "providers.application.submit",
        },
      });
      expect(audit).not.toBeNull();

      const lockedKind = await request(context.app)
        .patch(`/api/v1/providers/${providerId}/kind`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          providerKind: "REGISTERED_COMPANY",
          expectedVersion: version,
        })
        .expect(409);
      expect(lockedKind.body.error.code).toBe("PROVIDER_STATE_CONFLICT");

      const lockedProfile = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          displayNameAr: "محاولة تعديل أثناء المراجعة",
          displayNameEn: null,
          descriptionAr: "يجب أن ترفض",
          descriptionEn: null,
          countryCode: "EG",
          expectedVersion: version,
        });
      expect([400, 409]).toContain(lockedProfile.status);
      if (lockedProfile.status === 409) {
        expect(lockedProfile.body.error.code).toBe("PROVIDER_STATE_CONFLICT");
      }

      const matchingRetry = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
      expect(matchingRetry.body.data.provider).toMatchObject({
        applicationStatus: "PENDING_REVIEW",
        version,
      });
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "APPLICATION_SUBMITTED" },
        }),
      ).toBe(1);
      expect(
        await context.prisma.provider.findUniqueOrThrow({
          where: { id: providerId },
        }),
      ).toMatchObject({ reviewCycle: 1 });

      await context.prisma.provider.update({
        where: { id: providerId },
        data: { applicationStatus: "CHANGES_REQUESTED" },
      });
      await context.prisma.providerStatusHistory.create({
        data: {
          providerId,
          domain: "APPLICATION",
          fromApplicationStatus: "PENDING_REVIEW",
          toApplicationStatus: "CHANGES_REQUESTED",
          reviewCycle: 1,
          actorUserId: session.userId,
          reason: "Need clearer Arabic description",
        },
      });

      const refreshed = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      version = refreshed.version;

      const resubmitted = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);

      expect(resubmitted.body.data.provider).toMatchObject({
        applicationStatus: "PENDING_REVIEW",
        version: version + 1,
      });
      expect(
        await context.prisma.provider.findUniqueOrThrow({
          where: { id: providerId },
        }),
      ).toMatchObject({ reviewCycle: 2 });

      const cycles = await context.prisma.providerStatusHistory.findMany({
        where: {
          providerId,
          toApplicationStatus: "PENDING_REVIEW",
        },
        orderBy: { reviewCycle: "asc" },
      });
      expect(cycles.map((row) => row.reviewCycle)).toEqual([1, 2]);
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: { providerId, template: "APPLICATION_SUBMITTED" },
        }),
      ).toBe(2);
    } finally {
      await context.stop();
    }
  });

  it("rechecks current Configuration country activity before projection and submit", async () => {
    const context = await startProviderApplicationTestApp();
    let countryId: string | null = null;
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us5-country-deactivated",
      });
      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      const version = created.body.data.provider.version as number;

      await seedCompleteProviderApplicationContent(context.prisma, {
        providerId,
        ownerUserId: session.userId,
        emailNormalized: session.identity.email,
        phoneE164: session.identity.phone,
      });
      const profile = await context.prisma.providerProfile.findUniqueOrThrow({
        where: { providerId },
        select: { countryId: true },
      });
      countryId = profile.countryId;
      expect(countryId).not.toBeNull();
      await context.prisma.country.update({
        where: { id: countryId! },
        data: { isActive: false },
      });

      const completion = await request(context.app)
        .get(`/api/v1/providers/${providerId}/completion`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(completion.body.data.missingRequirementCodes).toContain(
        "ACTIVE_COUNTRY",
      );

      const submit = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(409);
      expect(submit.body.error).toMatchObject({
        code: "PROVIDER_SUBMISSION_INCOMPLETE",
        details: expect.objectContaining({
          missingRequirementCodes: expect.arrayContaining(["ACTIVE_COUNTRY"]),
        }),
      });
    } finally {
      if (countryId !== null) {
        await context.prisma.country
          .update({ where: { id: countryId }, data: { isActive: true } })
          .catch(() => undefined);
      }
      await context.stop();
    }
  });
});

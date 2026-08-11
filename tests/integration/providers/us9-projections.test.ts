import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import { ensureActiveTestCountry } from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import { MARKETPLACE_READINESS_GATE_KEYS } from "../../../src/modules/providers/domain/providers.types.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

describe.skipIf(!hasDatabase)("US9 completion/readiness/history/dashboard/settings (T100)", () => {
  it("exposes derived projections for the Application Owner without a settings store", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const country = await ensureActiveTestCountry(context.prisma);
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us9-projections",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      const version = created.body.data.provider.version as number;

      await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          displayNameAr: "فريق الإسقاط",
          displayNameEn: null,
          descriptionAr: "وصف عربي للاختبار",
          descriptionEn: null,
          countryCode: country.code,
          expectedVersion: version,
        })
        .expect(200);

      const completion = await request(context.app)
        .get(`/api/v1/providers/${providerId}/completion`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(completion.body.data.policyVersion).toBe("r1-p05-v1");
      expect(completion.body.data.checks).toHaveLength(10);
      expect(completion.body.data.percentage).toBeGreaterThanOrEqual(40);
      expect(completion.body.data.missingRequirementCodes).toEqual(
        expect.arrayContaining([
          "OPERATIONAL_EMAIL",
          "OPERATIONAL_PHONE",
          "READY_LOGO",
          "READY_COVER",
          "MIN_READY_GALLERY_IMAGES",
        ]),
      );

      const readiness = await request(context.app)
        .get(`/api/v1/providers/${providerId}/readiness`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(readiness.body.data.gates).toHaveLength(11);
      expect(readiness.body.data.gates.map((gate: { key: string }) => gate.key)).toEqual([
        ...MARKETPLACE_READINESS_GATE_KEYS,
      ]);
      expect(readiness.body.data.eligibleForPublicBrowse).toBe(false);
      const documents = readiness.body.data.gates.find(
        (gate: { key: string }) => gate.key === "documentsVerified",
      );
      expect(documents).toMatchObject({
        status: "NOT_REQUIRED",
        satisfied: true,
      });

      const history = await request(context.app)
        .get(`/api/v1/providers/${providerId}/history?limit=20`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(Array.isArray(history.body.data)).toBe(true);
      expect(history.body.data.length).toBeGreaterThanOrEqual(1);
      expect(history.body.meta).toMatchObject({ nextCursor: null });
      expect(history.body.data[0]).toMatchObject({
        domain: "APPLICATION",
        toApplicationStatus: "DRAFT",
      });
      expect(history.body.data[0]).not.toHaveProperty("token");

      const dashboard = await request(context.app)
        .get(`/api/v1/providers/${providerId}/dashboard`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(dashboard.body.data).toMatchObject({
        providerKind: "INDIVIDUAL_TEAM",
        applicationStatus: "DRAFT",
        operationalStatus: "INACTIVE",
        nextAction: {
          code: "COMPLETE_PROFILE",
        },
      });
      expect(dashboard.body.data.completion.policyVersion).toBe("r1-p05-v1");
      expect(dashboard.body.data.readiness.eligibleForPublicBrowse).toBe(false);
      expect(dashboard.body.data.activeAdminCount).toBe(0);
      expect(dashboard.body.data.pendingInvitationCount).toBe(0);
      expect(dashboard.body.data).not.toHaveProperty("operationalEmail");

      const settings = await request(context.app)
        .get(`/api/v1/providers/${providerId}/settings`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(settings.body.data.notifications).toEqual({
        mandatoryReviewEmails: true,
        optionalPreferencesAvailable: false,
      });
      expect(settings.body.data.privacy.directContactVisibleToCustomers).toBe(
        false,
      );
      expect(settings.body.data.profile.href).toContain(providerId);
      expect(JSON.stringify(settings.body.data)).not.toMatch(
        /@example|operationalEmail|\+20/i,
      );
      expect(settings.body.data).not.toHaveProperty("settingsStore");

      const stranger = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us9-stranger",
      });
      await request(context.app)
        .get(`/api/v1/providers/${providerId}/dashboard`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .expect(404);
    } finally {
      await context.stop();
    }
  });

  it("returns Company document readiness blocked by R1-P06", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "COMPANY",
        emailInbox: context.email,
        label: "us9-company-readiness",
      });
      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "REGISTERED_COMPANY" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;

      const readiness = await request(context.app)
        .get(`/api/v1/providers/${providerId}/readiness`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      const documents = readiness.body.data.gates.find(
        (gate: { key: string }) => gate.key === "documentsVerified",
      );
      expect(documents).toMatchObject({
        status: "BLOCKED",
        satisfied: false,
        owningPhase: "R1-P06",
        blockerCodes: ["COMPANY_DOCUMENTS_DEFERRED_R1_P06"],
      });
      expect(readiness.body.data.eligibleForPublicBrowse).toBe(false);
    } finally {
      await context.stop();
    }
  });
});

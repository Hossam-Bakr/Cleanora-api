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

vi.setConfig({ testTimeout: 180_000 });

/**
 * Sequential R1-P05 acceptance journey (T148) covering SC-001–SC-015 against
 * the implemented surface, including actual capacity denial and invitation
 * single-use/idempotent replay behavior.
 */
describe.skipIf(!hasDatabase)("R1-P05 acceptance journey SC-001–SC-015 (T148)", () => {
  it("walks create → submit → approve → suspend → remediate → reinstate", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const country = await ensureActiveTestCountry(context.prisma);

      // SC-001 eligible Individual signup + Provider create
      const owner = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "accept-owner",
      });
      const staff = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "accept-staff",
      });
      await grantStaffAdminForTests(context.prisma, staff.userId);

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      let version = created.body.data.provider.version as number;

      // SC-002: same-kind create is idempotent; different kind conflicts
      const retry = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(200);
      expect(retry.body.data.provider.id).toBe(providerId);
      const conflict = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ providerKind: "REGISTERED_COMPANY" })
        .expect(409);
      expect(conflict.body.error.code).toBe("PROVIDER_ALREADY_EXISTS");

      await seedCompleteProviderApplicationContent(context.prisma, {
        providerId,
        ownerUserId: owner.userId,
        emailNormalized: owner.identity.email,
        phoneE164: owner.identity.phone,
      });

      // SC-013/SC-006 complete then submit
      const submitted = await request(context.app)
        .post(`/api/v1/providers/${providerId}/application/submit`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
      version = submitted.body.data.provider.version as number;
      expect(submitted.body.data.provider.applicationStatus).toBe(
        "PENDING_REVIEW",
      );

      // SC-014 PENDING_REVIEW mutation lock
      const locked = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          displayNameAr: "locked",
          displayNameEn: null,
          descriptionAr: "locked",
          descriptionEn: null,
          countryCode: country.code,
          expectedVersion: version,
        })
        .expect(409);
      expect(locked.body.error.code).toBe("PROVIDER_STATE_CONFLICT");

      // SC-010 unauthorized staff denied
      const stranger = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "accept-stranger",
      });
      const denied = await request(context.app)
        .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ expectedVersion: version })
        .expect(403);
      expect(denied.body.error.code).toBe("PROVIDER_ACCESS_DENIED");

      // SC-003/SC-009/SC-011 approve leaves INACTIVE, never LIVE
      const approved = await request(context.app)
        .post(`/api/v1/staff/providers/applications/${providerId}/approve`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
      version = approved.body.data.provider.version as number;
      expect(approved.body.data.provider).toMatchObject({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
      });
      expect(approved.body.data.readiness.eligibleForPublicBrowse).toBe(false);
      const gates = approved.body.data.readiness.gates as Array<{
        key: string;
        satisfied: boolean;
        status?: string;
      }>;
      expect(gates.find((g) => g.key === "operationalLive")?.satisfied).toBe(
        false,
      );
      // SC-007 Individual documents NOT_REQUIRED
      expect(
        gates.find((g) => g.key === "documentsVerified")?.status,
      ).toBe("NOT_REQUIRED");

      // SC-004 contact-free preview
      const preview = await request(context.app)
        .get(`/api/v1/providers/${providerId}/preview`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      const previewJson = JSON.stringify(preview.body.data);
      expect(previewJson).not.toMatch(/operationalEmail|operationalPhone|WHATSAPP/i);

      // SC-015 dashboard next action
      const dashboard = await request(context.app)
        .get(`/api/v1/providers/${providerId}/dashboard`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(dashboard.body.data.nextAction.code).toBeDefined();
      expect(dashboard.body.data).not.toHaveProperty("readinessPercentage");

      // SC-006 completion projection
      const completion = await request(context.app)
        .get(`/api/v1/providers/${providerId}/completion`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(completion.body.data.policyVersion).toBe("r1-p05-v1");
      expect(completion.body.data.percentage).toBe(100);

      // SC-005 gallery limit denial without removing accepted media
      const mediaBefore = await context.prisma.providerGalleryItem.count({
        where: { providerId },
      });
      expect(mediaBefore).toBeGreaterThanOrEqual(3);
      for (let index = 0; index < 2; index += 1) {
        const added = await request(context.app)
          .post(`/api/v1/providers/${providerId}/media/gallery-videos`)
          .set("Authorization", `Bearer ${owner.accessToken}`)
          .field("expectedVersion", String(version))
          .attach("file", Buffer.alloc(32, index + 1), {
            filename: `accept-${index}.mp4`,
            contentType: "video/mp4",
          })
          .expect(201);
        version = added.body.data.version as number;
      }
      const overVideoLimit = await request(context.app)
        .post(`/api/v1/providers/${providerId}/media/gallery-videos`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", Buffer.alloc(32, 9), {
          filename: "accept-over-limit.mp4",
          contentType: "video/mp4",
        })
        .expect(409);
      expect(overVideoLimit.body.error.code).toBe("PROVIDER_MEDIA_LIMIT_EXCEEDED");
      expect(
        await context.prisma.providerGalleryItem.count({
          where: { providerId, kind: "VIDEO" },
        }),
      ).toBe(2);

      // SC-012: invitation acceptance is single-use and replay is idempotent.
      await request(context.app)
        .post(`/api/v1/providers/${providerId}/admin-invitations`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ email: stranger.identity.email, expectedVersion: version })
        .expect(202);
      const rawToken = context.invitationEmail.latestInvitationToken();
      expect(rawToken).toBeTruthy();
      await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ token: rawToken })
        .expect(200);
      await request(context.app)
        .post("/api/v1/provider-admin-invitations/accept")
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ token: rawToken })
        .expect(200);
      expect(
        await context.prisma.providerMember.count({
          where: { providerId, userId: stranger.userId, level: "ADMIN" },
        }),
      ).toBe(1);

      // Post-approval OWNER can list members.
      const members = await request(context.app)
        .get(`/api/v1/providers/${providerId}/members`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(Array.isArray(members.body.data)).toBe(true);
      expect(
        (members.body.data as Array<{ level: string; status: string }>).some(
          (member) => member.level === "OWNER" && member.status === "ACTIVE",
        ),
      ).toBe(true);
      version = (
        await context.prisma.provider.findUniqueOrThrow({
          where: { id: providerId },
        })
      ).version;

      // SC-003/SC-009 suspend → remediate → reinstate to INACTIVE only
      const suspended = await request(context.app)
        .post(`/api/v1/staff/providers/${providerId}/suspend`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ reason: "Acceptance suspend", expectedVersion: version })
        .expect(200);
      version = suspended.body.data.provider.version as number;
      expect(suspended.body.data.provider.operationalStatus).toBe("SUSPENDED");
      expect(suspended.body.data.completion.percentage).toBe(100);

      const remediate = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          displayNameAr: "مزود بعد التعليق",
          displayNameEn: null,
          descriptionAr: "وصف عربي للإصلاح أثناء التعليق",
          descriptionEn: null,
          countryCode: country.code,
          expectedVersion: version,
        })
        .expect(200);
      version = remediate.body.data.version as number;

      const reinstated = await request(context.app)
        .post(`/api/v1/staff/providers/${providerId}/reinstate`)
        .set("Authorization", `Bearer ${staff.accessToken}`)
        .send({ reason: "Acceptance reinstate", expectedVersion: version })
        .expect(200);
      expect(reinstated.body.data.provider.operationalStatus).toBe("INACTIVE");
      expect(reinstated.body.data.provider.operationalStatus).not.toBe("LIVE");
      expect(reinstated.body.data.completion.percentage).toBe(100);

      // SC-008 company path: documents blocked for Registered Company readiness
      const companyOwner = await signupAndLogin(context.app, {
        accountCategory: "COMPANY",
        emailInbox: context.email,
        label: "accept-company",
      });
      const companyCreated = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${companyOwner.accessToken}`)
        .send({ providerKind: "REGISTERED_COMPANY" })
        .expect(201);
      const companyId = companyCreated.body.data.provider.id as string;
      const companyReadiness = await request(context.app)
        .get(`/api/v1/providers/${companyId}/readiness`)
        .set("Authorization", `Bearer ${companyOwner.accessToken}`)
        .expect(200);
      const companyDocs = (
        companyReadiness.body.data.gates as Array<{
          key: string;
          satisfied: boolean;
          owningPhase: string;
        }>
      ).find((gate) => gate.key === "documentsVerified");
      expect(companyDocs?.satisfied).toBe(false);
      expect(companyDocs?.owningPhase).toBe("R1-P06");
    } finally {
      await context.stop();
    }
  });
});

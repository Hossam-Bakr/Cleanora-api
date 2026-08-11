import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import { ensureActiveTestCountry } from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

/** Allowlisted contact-free preview fields (SC-004 / FR-038 inventory). */
const PREVIEW_ALLOWLIST = [
  "providerId",
  "providerKind",
  "displayNameAr",
  "displayNameEn",
  "descriptionAr",
  "descriptionEn",
  "countryCode",
  "logo",
  "cover",
  "gallery",
] as const;

const FORBIDDEN_PREVIEW_MARKERS = [
  "operationalEmail",
  "operationalPhone",
  "channels",
  "whatsapp",
  "WHATSAPP",
  "SOCIAL",
  "WEBSITE",
  "EXTERNAL_BOOKING",
  "applicantContext",
  "individualFullName",
  "companyName",
  "representativeFullName",
  "storageKey",
  "mediaFileId",
  "logoMediaFileId",
  "coverMediaFileId",
] as const;

describe.skipIf(!hasDatabase)(
  "US3 approved edit and contact-free preview (T043)",
  () => {
    it("preserves APPROVED on post-approval edits and returns a contact-free preview", async () => {
      const context = await startProviderApplicationTestApp();
      try {
        await assertR1P05ProviderSchemaReady();
        const country = await ensureActiveTestCountry(context.prisma);
        const session = await signupAndLogin(context.app, {
          accountCategory: "INDIVIDUAL",
          emailInbox: context.email,
          label: "us3-approved",
        });

        const created = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(201);
        const providerId = created.body.data.provider.id as string;
        let version = created.body.data.provider.version as number;

        const profile = await request(context.app)
          .put(`/api/v1/providers/${providerId}/profile`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({
            displayNameAr: "مزود معتمد",
            displayNameEn: "Approved Provider",
            descriptionAr: "وصف قبل الاعتماد",
            descriptionEn: "Before approval",
            countryCode: country.code,
            expectedVersion: version,
          })
          .expect(200);
        version = profile.body.data.version as number;

        await request(context.app)
          .put(`/api/v1/providers/${providerId}/contacts`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({
            operationalEmail: "private-ops@example.com",
            operationalPhone: "+201055501234",
            channels: [
              { type: "WHATSAPP", value: "+201055509999" },
              { type: "WEBSITE", value: "https://secret.example.com" },
              { type: "SOCIAL", value: "https://instagram.com/secret" },
            ],
            expectedVersion: version,
          })
          .expect(200);
        version += 1;

        const providerAdminRole = await context.prisma.role.upsert({
          where: { code: "provider_admin" },
          create: {
            code: "provider_admin",
            name: "Provider Administrator",
          },
          update: {},
        });
        await context.prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: session.userId,
              roleId: providerAdminRole.id,
            },
          },
          create: {
            userId: session.userId,
            roleId: providerAdminRole.id,
            status: "ENABLED",
            enabledAt: new Date(),
          },
          update: { status: "ENABLED", enabledAt: new Date() },
        });
        await context.prisma.user.update({
          where: { id: session.userId },
          data: {
            accountCategories: ["INDIVIDUAL", "PROVIDER_OWNER"],
            verifiedCategories: ["INDIVIDUAL", "PROVIDER_OWNER"],
          },
        });
        await context.prisma.provider.update({
          where: { id: providerId },
          data: {
            applicationStatus: "APPROVED",
            ownerUserId: session.userId,
            approvedAt: new Date(),
          },
        });
        await context.prisma.providerMember.create({
          data: {
            providerId,
            userId: session.userId,
            level: "OWNER",
            status: "ACTIVE",
            invitedByUserId: null,
            enabledAt: new Date(),
          },
        });

        const current = await context.prisma.provider.findUniqueOrThrow({
          where: { id: providerId },
        });
        version = current.version;

        const edited = await request(context.app)
          .put(`/api/v1/providers/${providerId}/profile`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({
            displayNameAr: "مزود بعد الاعتماد",
            displayNameEn: "After Approval",
            descriptionAr: "وصف بعد الاعتماد",
            descriptionEn: null,
            countryCode: country.code,
            expectedVersion: version,
          })
          .expect(200);

        expect(edited.body.data).toMatchObject({
          displayNameAr: "مزود بعد الاعتماد",
          version: version + 1,
        });

        const provider = await context.prisma.provider.findUniqueOrThrow({
          where: { id: providerId },
        });
        expect(provider.applicationStatus).toBe("APPROVED");
        expect(provider.version).toBe(version + 1);

        const audit = await context.prisma.auditLog.findFirst({
          where: {
            targetId: providerId,
            action: "providers.profile.replace",
          },
          orderBy: { createdAt: "desc" },
        });
        expect(audit).not.toBeNull();
        expect(JSON.stringify(audit)).not.toMatch(/private-ops@example.com/i);

        const preview = await request(context.app)
          .get(`/api/v1/providers/${providerId}/preview`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .expect(200);

        const data = preview.body.data as Record<string, unknown>;
        for (const key of Object.keys(data)) {
          expect(PREVIEW_ALLOWLIST).toContain(key);
        }
        expect(data).toMatchObject({
          providerId,
          providerKind: "INDIVIDUAL_TEAM",
          displayNameAr: "مزود بعد الاعتماد",
          displayNameEn: "After Approval",
          descriptionAr: "وصف بعد الاعتماد",
          descriptionEn: null,
          countryCode: country.code,
        });
        expect(data["logo"] ?? null).toBeNull();
        expect(data["cover"] ?? null).toBeNull();
        expect(data["gallery"]).toEqual([]);

        const serialized = JSON.stringify(preview.body);
        for (const marker of FORBIDDEN_PREVIEW_MARKERS) {
          expect(serialized).not.toContain(marker);
        }
        expect(serialized).not.toMatch(/private-ops@example\.com/i);
        expect(serialized).not.toMatch(/\+20105550/u);
        expect(serialized).not.toMatch(/secret\.example\.com/i);
        expect(serialized).not.toMatch(/Individual Applicant/i);
      } finally {
        await context.stop();
      }
    });
  },
);

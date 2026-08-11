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

async function createDraft(
  app: import("express").Express,
  accessToken: string,
): Promise<{ readonly providerId: string; readonly version: number }> {
  const created = await request(app)
    .post("/api/v1/providers")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ providerKind: "INDIVIDUAL_TEAM" })
    .expect(201);
  return {
    providerId: created.body.data.provider.id as string,
    version: created.body.data.provider.version as number,
  };
}

describe.skipIf(!hasDatabase)("US3 profile and private contacts API (T042)", () => {
  it("replaces profile and contacts with CAS, active country, and full channel replace", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const country = await ensureActiveTestCountry(context.prisma);
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us3-profile",
      });
      const { providerId, version } = await createDraft(
        context.app,
        session.accessToken,
      );

      const profilePut = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          displayNameAr: "  فريق كلينورا  ",
          displayNameEn: "Cleanora Team",
          descriptionAr: "وصف عربي مطلوب",
          descriptionEn: null,
          countryCode: country.code,
          expectedVersion: version,
        })
        .expect(200);

      expect(profilePut.body.data).toMatchObject({
        displayNameAr: "فريق كلينورا",
        displayNameEn: "Cleanora Team",
        descriptionAr: "وصف عربي مطلوب",
        descriptionEn: null,
        countryCode: country.code,
        version: version + 1,
      });
      expect(profilePut.body.data).not.toHaveProperty("operationalEmail");
      expect(profilePut.body.data).not.toHaveProperty("channels");

      const profileGet = await request(context.app)
        .get(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(profileGet.body.data).toMatchObject({
        displayNameAr: "فريق كلينورا",
        countryCode: country.code,
        version: version + 1,
      });

      const contactsPut = await request(context.app)
        .put(`/api/v1/providers/${providerId}/contacts`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          operationalEmail: "Ops@Example.COM",
          operationalPhone: "+201000000099",
          channels: [
            { type: "WHATSAPP", value: "+201000000088" },
            { type: "WEBSITE", value: "https://example.com" },
            { type: "SOCIAL", value: "https://instagram.com/cleanora" },
            { type: "SOCIAL", value: "https://facebook.com/cleanora" },
          ],
          expectedVersion: version + 1,
        })
        .expect(200);

      expect(contactsPut.body.data).toMatchObject({
        operationalEmail: "ops@example.com",
        operationalPhone: "+201000000099",
        version: version + 2,
      });
      expect(contactsPut.body.data.channels).toHaveLength(4);

      const replaced = await request(context.app)
        .put(`/api/v1/providers/${providerId}/contacts`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          operationalEmail: "desk@example.com",
          operationalPhone: "+201000000077",
          channels: [
            { type: "EXTERNAL_BOOKING", value: "https://book.example.com" },
          ],
          expectedVersion: version + 2,
        })
        .expect(200);
      expect(replaced.body.data.channels).toEqual([
        { type: "EXTERNAL_BOOKING", value: "https://book.example.com" },
      ]);

      const contactsGet = await request(context.app)
        .get(`/api/v1/providers/${providerId}/contacts`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(contactsGet.body.data).toMatchObject({
        operationalEmail: "desk@example.com",
        operationalPhone: "+201000000077",
      });

      const stale = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          displayNameAr: "قديم",
          displayNameEn: null,
          descriptionAr: "قديم",
          descriptionEn: null,
          countryCode: country.code,
          expectedVersion: version,
        })
        .expect(409);
      expect(stale.body.error.code).toBe("PROVIDER_VERSION_CONFLICT");
    } finally {
      await context.stop();
    }
  });

  it("rejects inactive country, invalid channels, cross-user access, and PENDING_REVIEW writes", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const country = await ensureActiveTestCountry(context.prisma);
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us3-authz",
      });
      const other = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us3-other",
      });
      const { providerId, version } = await createDraft(
        context.app,
        session.accessToken,
      );

      const inactiveCountry = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          displayNameAr: "اسم",
          displayNameEn: null,
          descriptionAr: "وصف",
          descriptionEn: null,
          countryCode: "ZZ",
          expectedVersion: version,
        })
        .expect(400);
      expect(["VALIDATION_ERROR", "COUNTRY_UNAVAILABLE"]).toContain(
        inactiveCountry.body.error.code,
      );

      const badChannels = await request(context.app)
        .put(`/api/v1/providers/${providerId}/contacts`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          operationalEmail: "ops@example.com",
          operationalPhone: "+201000000066",
          channels: [
            { type: "WHATSAPP", value: "+201000000001" },
            { type: "WHATSAPP", value: "+201000000002" },
          ],
          expectedVersion: version,
        })
        .expect(400);
      expect(badChannels.body.error.code).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(badChannels.body)).not.toMatch(/\+20100000000/u);

      const denied = await request(context.app)
        .get(`/api/v1/providers/${providerId}/contacts`)
        .set("Authorization", `Bearer ${other.accessToken}`)
        .expect(404);
      expect(denied.body.error.code).toBe("PROVIDER_NOT_FOUND");

      await context.prisma.provider.update({
        where: { id: providerId },
        data: { applicationStatus: "PENDING_REVIEW" },
      });

      const locked = await request(context.app)
        .put(`/api/v1/providers/${providerId}/profile`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          displayNameAr: "مقفل",
          displayNameEn: null,
          descriptionAr: "مقفل",
          descriptionEn: null,
          countryCode: country.code,
          expectedVersion: version,
        })
        .expect(409);
      expect(locked.body.error.code).toBe("PROVIDER_STATE_CONFLICT");
    } finally {
      await context.stop();
    }
  });
});

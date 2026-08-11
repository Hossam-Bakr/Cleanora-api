import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  enrollCompanyCategory,
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

describe.skipIf(!hasDatabase)("US2 Company provider application API (T035)", () => {
  it("creates a Company draft and changes kind only while never-submitted", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "COMPANY",
        emailInbox: context.email,
        label: "us2-company",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "REGISTERED_COMPANY" })
        .expect(201);

      expect(created.body.data.provider).toMatchObject({
        providerKind: "REGISTERED_COMPANY",
        applicationStatus: "DRAFT",
        actorRelationship: "APPLICATION_OWNER",
      });
      expect(created.body.data.applicantContext).toMatchObject({
        category: "COMPANY",
      });

      const providerId = created.body.data.provider.id as string;
      const version = created.body.data.provider.version as number;

      // Company-only cannot switch to Individual without Individual category.
      const deniedKind = await request(context.app)
        .patch(`/api/v1/providers/${providerId}/kind`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          providerKind: "INDIVIDUAL_TEAM",
          expectedVersion: version,
        })
        .expect(403);
      expect(deniedKind.body.error.code).toBe("PROVIDER_ELIGIBILITY_DENIED");
    } finally {
      await context.stop();
    }
  });

  it("lets a dual-category owner change kind in a never-submitted draft with CAS", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us2-dual",
      });
      await enrollCompanyCategory(context.app, {
        accessToken: session.accessToken,
        emailNormalized: session.identity.email,
        emailInbox: context.email,
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      const version = created.body.data.provider.version as number;

      const changed = await request(context.app)
        .patch(`/api/v1/providers/${providerId}/kind`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          providerKind: "REGISTERED_COMPANY",
          expectedVersion: version,
        })
        .expect(200);

      expect(changed.body.data.provider).toMatchObject({
        id: providerId,
        providerKind: "REGISTERED_COMPANY",
        version: version + 1,
      });
      expect(changed.body.data.applicantContext).toMatchObject({
        category: "COMPANY",
      });

      const stale = await request(context.app)
        .patch(`/api/v1/providers/${providerId}/kind`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          providerKind: "INDIVIDUAL_TEAM",
          expectedVersion: version,
        })
        .expect(409);
      expect(stale.body.error.code).toBe("PROVIDER_VERSION_CONFLICT");

      await context.prisma.provider.update({
        where: { id: providerId },
        data: {
          firstSubmittedAt: new Date(),
          applicationStatus: "PENDING_REVIEW",
        },
      });

      const immutable = await request(context.app)
        .patch(`/api/v1/providers/${providerId}/kind`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          providerKind: "INDIVIDUAL_TEAM",
          expectedVersion: version + 1,
        })
        .expect(409);
      expect(immutable.body.error.code).toBe("PROVIDER_STATE_CONFLICT");
    } finally {
      await context.stop();
    }
  });
});

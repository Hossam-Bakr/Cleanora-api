import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  enrollCompanyCategory,
  enrollIndividualCategory,
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

async function forceLegacyOwnerOnly(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PrismaClient update typing is narrower than test fixture
  prisma: { user: { update: (args: any) => Promise<unknown> } },
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      accountCategories: ["PROVIDER_OWNER"],
      verifiedCategories: ["PROVIDER_OWNER"],
    },
  });
}

describe.skipIf(!hasDatabase)(
  "US13 legacy Provider Owner recovery (T139)",
  () => {
    it("denies owner-only, then recovers via Individual path without review bypass", async () => {
      const context = await startProviderApplicationTestApp();
      try {
        await assertR1P05ProviderSchemaReady();
        const session = await signupAndLogin(context.app, {
          accountCategory: "ENGINEER",
          emailInbox: context.email,
          label: "us13-indiv",
        });

        await forceLegacyOwnerOnly(context.prisma, session.userId);

        const denied = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(403);
        expect(denied.body.error.code).toBe("PROVIDER_ELIGIBILITY_DENIED");
        expect(denied.body.error.details.denialCodes).toContain(
          "ELIGIBLE_CATEGORY_VERIFIED",
        );
        expect(denied.body.error.details.recoveryHints).toContain(
          "ENROLL_AND_VERIFY_INDIVIDUAL_OR_COMPANY",
        );
        expect(JSON.stringify(denied.body)).not.toMatch(
          /fullName|password|storageKey/iu,
        );

        await enrollIndividualCategory(context.app, {
          accessToken: session.accessToken,
          emailNormalized: session.identity.email,
          emailInbox: context.email,
          fullName: "Recovered Individual Owner",
        });

        const created = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(201);
        expect(created.body.data.provider).toMatchObject({
          providerKind: "INDIVIDUAL_TEAM",
          applicationStatus: "DRAFT",
          operationalStatus: "INACTIVE",
          actorRelationship: "APPLICATION_OWNER",
        });

        const user = await context.prisma.user.findUniqueOrThrow({
          where: { id: session.userId },
        });
        expect(user.verifiedCategories).toContain("INDIVIDUAL");
        expect(created.body.data.provider.applicationStatus).not.toBe(
          "APPROVED",
        );
        expect(
          await context.prisma.providerMember.count({
            where: { providerId: created.body.data.provider.id },
          }),
        ).toBe(0);
      } finally {
        await context.stop();
      }
    });

    it("recovers via Company path for REGISTERED_COMPANY only", async () => {
      const context = await startProviderApplicationTestApp();
      try {
        await assertR1P05ProviderSchemaReady();
        const session = await signupAndLogin(context.app, {
          accountCategory: "ENGINEER",
          emailInbox: context.email,
          label: "us13-co",
        });

        await forceLegacyOwnerOnly(context.prisma, session.userId);

        await enrollCompanyCategory(context.app, {
          accessToken: session.accessToken,
          emailNormalized: session.identity.email,
          emailInbox: context.email,
        });

        const wrongKind = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(403);
        expect(wrongKind.body.error.code).toBe("PROVIDER_ELIGIBILITY_DENIED");

        const created = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "REGISTERED_COMPANY" })
          .expect(201);
        expect(created.body.data.provider).toMatchObject({
          providerKind: "REGISTERED_COMPANY",
          applicationStatus: "DRAFT",
        });
      } finally {
        await context.stop();
      }
    });
  },
);

import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

describe.skipIf(!hasDatabase)("US1 Individual provider application API (T027)", () => {
  it("creates an idempotent Individual draft, retrieves it, and grants no pre-approval authority", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us1-individual",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);

      expect(created.body.success).toBe(true);
      expect(created.body.data.provider).toMatchObject({
        providerKind: "INDIVIDUAL_TEAM",
        applicationStatus: "DRAFT",
        operationalStatus: "INACTIVE",
        actorRelationship: "APPLICATION_OWNER",
        version: 1,
      });
      expect(created.body.data.provider).not.toHaveProperty("contacts");
      expect(created.body.data.provider).not.toHaveProperty(
        "operationalEmail",
      );

      const providerId = created.body.data.provider.id as string;

      const retry = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(200);
      expect(retry.body.data.provider.id).toBe(providerId);
      expect(retry.body.data.provider.version).toBe(1);

      const conflict = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "REGISTERED_COMPANY" })
        .expect(409);
      expect(conflict.body.error.code).toBe("PROVIDER_ALREADY_EXISTS");

      const listed = await request(context.app)
        .get("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(listed.body.data).toHaveLength(1);
      expect(listed.body.meta).toEqual({ nextCursor: null });
      expect(listed.body.data[0].id).toBe(providerId);
      expect(listed.body.data[0]).not.toHaveProperty("contacts");

      const detail = await request(context.app)
        .get(`/api/v1/providers/${providerId}`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(detail.body.data.provider.id).toBe(providerId);
      expect(detail.body.data.applicantContext).toMatchObject({
        category: "INDIVIDUAL",
      });
      expect(JSON.stringify(detail.body.data)).not.toMatch(
        /operationalEmail|whatsapp|storageKey/iu,
      );

      const user = await context.prisma.user.findUniqueOrThrow({
        where: { id: session.userId },
      });
      expect(user.verifiedCategories).not.toContain("PROVIDER_OWNER");
      expect(
        await context.prisma.providerMember.count({
          where: { providerId },
        }),
      ).toBe(0);
      expect(
        await context.prisma.userRole.count({
          where: {
            userId: session.userId,
            role: { code: "provider_admin" },
            status: "ENABLED",
          },
        }),
      ).toBe(0);
      expect(
        await context.prisma.providerStatusHistory.count({
          where: { providerId },
        }),
      ).toBe(1);
    } finally {
      await context.stop();
    }
  });

  it("denies Engineer-only signup from creating a Provider application", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const identity = (
        await import("../../helpers/authentication/test-authentication-app.js")
      ).uniqueIdentity("engineer-deny");
      const signup = await request(context.app)
        .post("/api/v1/auth/signup")
        .send({
          accountCategory: "ENGINEER",
          fullName: "Design Engineer",
          professionalTitle: "Civil",
          phone: identity.phone,
          email: identity.email,
          password: identity.password,
        })
        .expect(202);
      await request(context.app)
        .post("/api/v1/auth/otp/verify")
        .send({
          challengeId: signup.body.data.challengeId,
          code: context.email.latest(identity.email)!.value,
        })
        .expect(200);
      const login = await request(context.app)
        .post("/api/v1/auth/login")
        .send({ phone: identity.phone, password: identity.password })
        .expect(200);

      const denied = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${login.body.data.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(403);
      expect(denied.body.error.code).toBe("PROVIDER_ELIGIBILITY_DENIED");
    } finally {
      await context.stop();
    }
  });
});

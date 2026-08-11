import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

describe.skipIf(!hasDatabase)(
  "US12 two-Provider scope isolation (T130)",
  () => {
    it("denies Provider B access for Provider A ADMIN and ignores caller claim tampering", async () => {
      const context = await startProviderApplicationTestApp();
      try {
        await assertR1P05ProviderSchemaReady();

        const ownerA = await signupAndLogin(context.app, {
          accountCategory: "INDIVIDUAL",
          emailInbox: context.email,
          label: "us12-owner-a",
        });
        const ownerB = await signupAndLogin(context.app, {
          accountCategory: "INDIVIDUAL",
          emailInbox: context.email,
          label: "us12-owner-b",
        });
        const adminA = await signupAndLogin(context.app, {
          accountCategory: "INDIVIDUAL",
          emailInbox: context.email,
          label: "us12-admin-a",
        });

        const createdA = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${ownerA.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(201);
        const providerA = createdA.body.data.provider.id as string;

        const createdB = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${ownerB.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(201);
        const providerB = createdB.body.data.provider.id as string;

        const providerAdminRole = await context.prisma.role.upsert({
          where: { code: "provider_admin" },
          create: {
            code: "provider_admin",
            name: "Provider Administrator",
          },
          update: {},
        });

        for (const [providerId, ownerId] of [
          [providerA, ownerA.userId],
          [providerB, ownerB.userId],
        ] as const) {
          await context.prisma.userRole.upsert({
            where: {
              userId_roleId: {
                userId: ownerId,
                roleId: providerAdminRole.id,
              },
            },
            create: {
              userId: ownerId,
              roleId: providerAdminRole.id,
              status: "ENABLED",
              enabledAt: new Date(),
            },
            update: { status: "ENABLED", enabledAt: new Date() },
          });
          await context.prisma.provider.update({
            where: { id: providerId },
            data: {
              applicationStatus: "APPROVED",
              ownerUserId: ownerId,
              approvedAt: new Date(),
            },
          });
          await context.prisma.providerMember.create({
            data: {
              providerId,
              userId: ownerId,
              level: "OWNER",
              status: "ACTIVE",
              invitedByUserId: null,
              enabledAt: new Date(),
            },
          });
        }

        await context.prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: adminA.userId,
              roleId: providerAdminRole.id,
            },
          },
          create: {
            userId: adminA.userId,
            roleId: providerAdminRole.id,
            status: "ENABLED",
            enabledAt: new Date(),
          },
          update: { status: "ENABLED", enabledAt: new Date() },
        });
        await context.prisma.providerMember.create({
          data: {
            providerId: providerA,
            userId: adminA.userId,
            level: "ADMIN",
            status: "ACTIVE",
            invitedByUserId: ownerA.userId,
            enabledAt: new Date(),
          },
        });

        await request(context.app)
          .get(`/api/v1/providers/${providerA}/contacts`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(200);
        await request(context.app)
          .get(`/api/v1/providers/${providerA}/preview`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(200);

        const crossContacts = await request(context.app)
          .get(`/api/v1/providers/${providerB}/contacts`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(404);
        expect(crossContacts.body.error.code).toBe("PROVIDER_NOT_FOUND");

        const crossPreview = await request(context.app)
          .get(`/api/v1/providers/${providerB}/preview`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(404);
        expect(crossPreview.body.error.code).toBe("PROVIDER_NOT_FOUND");

        const crossGet = await request(context.app)
          .get(`/api/v1/providers/${providerB}`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(404);
        expect(crossGet.body.error.code).toBe("PROVIDER_NOT_FOUND");

        const crossMembers = await request(context.app)
          .get(`/api/v1/providers/${providerB}/members`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(404);
        expect(crossMembers.body.error.code).toBe("PROVIDER_NOT_FOUND");

        const crossInvitations = await request(context.app)
          .get(`/api/v1/providers/${providerB}/admin-invitations`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(404);
        expect(crossInvitations.body.error.code).toBe("PROVIDER_NOT_FOUND");

        const crossMedia = await request(context.app)
          .get(`/api/v1/providers/${providerB}/media`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(404);
        expect(crossMedia.body.error.code).toBe("PROVIDER_NOT_FOUND");

        const crossCompletion = await request(context.app)
          .get(`/api/v1/providers/${providerB}/completion`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(404);
        expect(crossCompletion.body.error.code).toBe("PROVIDER_NOT_FOUND");

        const tampered = await request(context.app)
          .get(`/api/v1/providers/${providerB}/contacts`)
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .set("X-Provider-Id", providerA)
          .set("X-Provider-Membership", "ADMIN")
          .set("X-Actor-User-Id", ownerB.userId)
          .send({
            providerId: providerA,
            membershipLevel: "OWNER",
            actorUserId: ownerB.userId,
          })
          .expect(404);
        expect(tampered.body.error.code).toBe("PROVIDER_NOT_FOUND");

        await context.prisma.providerMember.create({
          data: {
            providerId: providerB,
            userId: adminA.userId,
            level: "ADMIN",
            status: "ACTIVE",
            invitedByUserId: ownerB.userId,
            enabledAt: new Date(),
          },
        });
        const firstPage = await request(context.app)
          .get("/api/v1/providers")
          .query({ limit: 1 })
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(200);
        expect(firstPage.body.data).toHaveLength(1);
        expect(firstPage.body.meta.nextCursor).toEqual(expect.any(String));
        const secondPage = await request(context.app)
          .get("/api/v1/providers")
          .query({ limit: 1, cursor: firstPage.body.meta.nextCursor })
          .set("Authorization", `Bearer ${adminA.accessToken}`)
          .expect(200);
        expect(secondPage.body.data).toHaveLength(1);
        expect(secondPage.body.meta.nextCursor).toBeNull();
        expect(
          [firstPage.body.data[0].id, secondPage.body.data[0].id].sort(),
        ).toEqual([providerA, providerB].sort());

        const denialRows = await context.prisma.auditLog.count({
          where: {
            actorId: adminA.userId,
            action: { startsWith: "providers." },
            reason: "SCOPE_DENIED",
          },
        });
        expect(denialRows).toBeGreaterThan(0);
        expect(
          await context.prisma.auditLog.count({
            where: {
              actorId: adminA.userId,
              targetId: providerB,
              action: "providers.media.list",
              reason: "SCOPE_DENIED",
            },
          }),
        ).toBe(1);
        expect(
          await context.prisma.auditLog.count({
            where: {
              actorId: adminA.userId,
              targetId: providerB,
              action: "providers.completion.get",
              reason: "SCOPE_DENIED",
            },
          }),
        ).toBe(1);
      } finally {
        await context.stop();
      }
    });
  },
);

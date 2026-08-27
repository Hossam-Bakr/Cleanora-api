import sharp from "sharp";

import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 180_000 });

async function pngBytes(): Promise<Buffer> {
  return sharp({
    create: {
      width: 700,
      height: 700,
      channels: 3,
      background: { r: 90, g: 20, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

describe.skipIf(!hasDatabase)("US4 provider media lifecycle (T054)", () => {
  it("preserves APPROVED on media edit, compensates failed replacement, and redacts secrets", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us4-media-life",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      let version = created.body.data.provider.version as number;

      const firstLogo = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/logo`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", await pngBytes(), {
          filename: "logo1.png",
          contentType: "image/png",
        })
        .expect(200);
      version = firstLogo.body.data.version;
      const firstLogoId = firstLogo.body.data.logo.mediaId as string;

      const providerAdminRole = await context.prisma.role.findUniqueOrThrow({
        where: { code: "provider_admin" },
      });
      await context.prisma.userRole.create({
        data: {
          userId: session.userId,
          roleId: providerAdminRole.id,
          status: "ENABLED",
          enabledAt: new Date(),
        },
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

      const approvedEdit = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/logo`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", await pngBytes(), {
          filename: "logo2.png",
          contentType: "image/png",
        })
        .expect(200);
      expect(approvedEdit.body.data.applicationStatus).toBe("APPROVED");
      version = approvedEdit.body.data.version;
      const secondLogoId = approvedEdit.body.data.logo.mediaId as string;
      expect(secondLogoId).not.toBe(firstLogoId);

      await context.prisma.provider.update({
        where: { id: providerId },
        data: {
          operationalStatus: "SUSPENDED",
          suspendedAt: new Date(),
        },
      });

      const suspendedEdit = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/cover`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", await pngBytes(), {
          filename: "cover.png",
          contentType: "image/png",
        })
        .expect(200);
      expect(suspendedEdit.body.data.applicationStatus).toBe("APPROVED");
      version = suspendedEdit.body.data.version;
      expect(suspendedEdit.body.data.cover.deliveryUrl).toMatch(/^https:\/\//u);
      expect(JSON.stringify(suspendedEdit.body.data)).not.toMatch(
        /storageKey|api_secret|CLOUDINARY/iu,
      );

      context.mediaFake.failNextStore = true;
      let logoDuringStore: string | null | undefined;
      context.mediaFake.beforeNextImageStore = async () => {
        logoDuringStore = (
          await context.prisma.providerProfile.findUniqueOrThrow({
            where: { providerId },
            select: { logoMediaFileId: true },
          })
        ).logoMediaFileId;
      };
      const failed = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/logo`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", await pngBytes(), {
          filename: "logo-fail.png",
          contentType: "image/png",
        });
      expect(failed.status).toBeGreaterThanOrEqual(400);
      expect(logoDuringStore).toBe(secondLogoId);
      const afterFail = await request(context.app)
        .get(`/api/v1/providers/${providerId}/media`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(afterFail.body.data.logo.mediaId).toBe(secondLogoId);
      expect(afterFail.body.data.logo.status).toBe("READY");
      expect(afterFail.body.data.applicationStatus).toBe("APPROVED");
    } finally {
      await context.stop();
    }
  });
});

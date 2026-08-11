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

async function pngBytes(
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

async function createDraft(
  app: Parameters<typeof request>[0],
  token: string,
) {
  const created = await request(app)
    .post("/api/v1/providers")
    .set("Authorization", `Bearer ${token}`)
    .send({ providerKind: "INDIVIDUAL_TEAM" })
    .expect(201);
  return {
    providerId: created.body.data.provider.id as string,
    version: created.body.data.provider.version as number,
  };
}

describe.skipIf(!hasDatabase)("US4 provider media API (T052)", () => {
  it("uploads logo/cover/gallery, lists, reorders, and deletes slots/items", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us4-media-api",
      });

      const draft = await createDraft(
        context.app,
        session.accessToken,
      );
      const providerId = draft.providerId;
      let version = draft.version;

      const logo = await pngBytes(800, 800);
      const logoPut = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/logo`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", logo, {
          filename: "logo.png",
          contentType: "image/png",
        })
        .expect(200);
      expect(logoPut.body.data.logo).toMatchObject({
        status: "READY",
        purpose: "LOGO",
        width: 600,
        height: 600,
      });
      expect(logoPut.body.data.logo.deliveryUrl).toMatch(/^https:\/\//u);
      expect(JSON.stringify(logoPut.body.data)).not.toMatch(
        /storageKey|public_id|cloudinary/iu,
      );
      version = logoPut.body.data.version;

      const cover = await pngBytes(1800, 700);
      const coverPut = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/cover`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", cover, {
          filename: "cover.png",
          contentType: "image/png",
        })
        .expect(200);
      expect(coverPut.body.data.cover).toMatchObject({
        status: "READY",
        width: 1600,
        height: 600,
      });
      version = coverPut.body.data.version;

      const galleryIds: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const image = await pngBytes(1400, 1000);
        const added = await request(context.app)
          .post(`/api/v1/providers/${providerId}/media/gallery-images`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .field("expectedVersion", String(version))
          .attach("file", image, {
            filename: `g${index}.png`,
            contentType: "image/png",
          })
          .expect(201);
        version = added.body.data.version;
        const item = added.body.data.gallery[index];
        expect(item).toMatchObject({
          kind: "IMAGE",
          status: "READY",
          position: index,
        });
        galleryIds.push(item.galleryItemId as string);
      }

      const videoBytes = Buffer.alloc(1024, 1);
      const videoAdded = await request(context.app)
        .post(`/api/v1/providers/${providerId}/media/gallery-videos`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", videoBytes, {
          filename: "clip.webm",
          contentType: "video/webm",
        })
        .expect(201);
      version = videoAdded.body.data.version;
      expect(videoAdded.body.data.usage.galleryVideoCount).toBe(1);
      expect(videoAdded.body.data.usage.readyGalleryImageCount).toBe(3);

      const listed = await request(context.app)
        .get(`/api/v1/providers/${providerId}/media`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);
      expect(listed.body.data.logo.status).toBe("READY");
      expect(listed.body.data.gallery).toHaveLength(4);

      const reversed = [...galleryIds].reverse();
      const videoItem = listed.body.data.gallery.find(
        (item: { kind: string }) => item.kind === "VIDEO",
      );
      expect(videoItem).toMatchObject({
        contentType: "video/webm",
        byteSize: 1024,
        width: 1280,
        height: 720,
      });
      const reorder = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/gallery-order`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({
          expectedVersion: version,
          orderedGalleryItemIds: [
            ...reversed,
            videoItem.galleryItemId as string,
          ],
        })
        .expect(200);
      version = reorder.body.data.version;
      expect(reorder.body.data.gallery[0].galleryItemId).toBe(reversed[0]);

      const deletedItem = await request(context.app)
        .delete(
          `/api/v1/providers/${providerId}/media/gallery/${galleryIds[0]}`,
        )
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
      version = deletedItem.body.data.version;
      expect(deletedItem.body.data.usage.galleryImageCount).toBe(2);

      const deletedLogo = await request(context.app)
        .delete(`/api/v1/providers/${providerId}/media/logo`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
      expect(deletedLogo.body.data.logo).toBeNull();
      version = deletedLogo.body.data.version;

      await request(context.app)
        .delete(`/api/v1/providers/${providerId}/media/cover`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ expectedVersion: version })
        .expect(200);
    } finally {
      await context.stop();
    }
  });

  it("rejects oversize and unsupported image MIME at the boundary", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us4-media-mime",
      });
      const { providerId, version } = await createDraft(
        context.app,
        session.accessToken,
      );

      const gif = await request(context.app)
        .put(`/api/v1/providers/${providerId}/media/logo`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", Buffer.from("GIF89a"), {
          filename: "x.gif",
          contentType: "image/gif",
        });
      expect(gif.status).toBe(400);
      expect(gif.body.error.code).toBe("PROVIDER_MEDIA_INVALID");
    } finally {
      await context.stop();
    }
  });
});

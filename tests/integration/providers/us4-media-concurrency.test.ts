import sharp from "sharp";

import { ConcurrencyBarrier } from "../../helpers/provider-concurrency.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 240_000 });

async function pngBytes(): Promise<Buffer> {
  return sharp({
    create: {
      width: 640,
      height: 640,
      channels: 3,
      background: { r: 10, g: 80, b: 160 },
    },
  })
    .png()
    .toBuffer();
}

describe.skipIf(!hasDatabase)("US4 provider media concurrency (T053)", () => {
  it("admits at most 12 gallery images under a 13th concurrent race", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us4-conc-images",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      let version = created.body.data.provider.version as number;

      for (let index = 0; index < 11; index += 1) {
        const image = await pngBytes();
        const added = await request(context.app)
          .post(`/api/v1/providers/${providerId}/media/gallery-images`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .field("expectedVersion", String(version))
          .attach("file", image, {
            filename: `seed-${index}.png`,
            contentType: "image/png",
          })
          .expect(201);
        version = added.body.data.version;
      }

      const barrier = new ConcurrencyBarrier(2);
      const imageA = await pngBytes();
      const imageB = await pngBytes();
      const runners = [imageA, imageB].map(async (bytes) => {
        await barrier.arriveAndWait();
        return request(context.app)
          .post(`/api/v1/providers/${providerId}/media/gallery-images`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .field("expectedVersion", String(version))
          .attach("file", bytes, {
            filename: "race.png",
            contentType: "image/png",
          });
      });

      const responses = await Promise.all(runners);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 409]);
      const denied = responses.find((response) => response.status === 409);
      expect(["PROVIDER_MEDIA_LIMIT_EXCEEDED", "PROVIDER_VERSION_CONFLICT"]).toContain(
        denied?.body.error.code,
      );
      expect(
        await context.prisma.providerGalleryItem.count({
          where: { providerId, kind: "IMAGE" },
        }),
      ).toBe(12);
    } finally {
      await context.stop();
    }
  });

  it("admits at most 2 gallery videos under a third concurrent race", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us4-conc-videos",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      let version = created.body.data.provider.version as number;

      const first = await request(context.app)
        .post(`/api/v1/providers/${providerId}/media/gallery-videos`)
        .set("Authorization", `Bearer ${session.accessToken}`)
        .field("expectedVersion", String(version))
        .attach("file", Buffer.alloc(512, 2), {
          filename: "a.mp4",
          contentType: "video/mp4",
        })
        .expect(201);
      version = first.body.data.version;

      const barrier = new ConcurrencyBarrier(2);
      const runners = [0, 1].map(async () => {
        await barrier.arriveAndWait();
        return request(context.app)
          .post(`/api/v1/providers/${providerId}/media/gallery-videos`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .field("expectedVersion", String(version))
          .attach("file", Buffer.alloc(512, 3), {
            filename: "race.mp4",
            contentType: "video/mp4",
          });
      });

      const responses = await Promise.all(runners);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 409]);
      expect(
        await context.prisma.providerGalleryItem.count({
          where: { providerId, kind: "VIDEO" },
        }),
      ).toBe(2);
    } finally {
      await context.stop();
    }
  });
});

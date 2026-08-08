import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Writable } from "node:stream";

import {
  CloudinaryMediaAdapter,
  createOpaqueCloudinaryPublicId,
  normalizeCloudinaryDestroyResult,
} from "../../../src/modules/media/infrastructure/cloudinary-media.adapter.js";
import type { CloudinarySdk } from "../../../src/modules/media/infrastructure/cloudinary-media.adapter.js";

const SECRET = "cloudinary-api-secret-value-for-tests";
const SMOKE_PATH = join(
  process.cwd(),
  "scripts/smoke-cloudinary-profile-image.ts",
);

function fakeSdk(options: {
  readonly uploadType?: string;
  readonly destroyResults?: readonly string[];
}): CloudinarySdk {
  const destroyResults = [...(options.destroyResults ?? ["ok", "not found"])];
  return {
    config: vi.fn(),
    uploader: {
      upload_stream: vi.fn((_opts, callback) => {
        return new Writable({
          write(_chunk, _encoding, next) {
            next();
          },
          final(done) {
            callback(undefined, {
              resource_type: "image",
              type: options.uploadType ?? "authenticated",
              format: "webp",
              public_id: _opts.public_id,
              bytes: 64,
              width: 32,
              height: 24,
            });
            done();
          },
        });
      }),
      destroy: vi.fn(async () => ({ result: destroyResults.shift() ?? "not found" })),
    },
    url: vi.fn(() => "https://example.test/signed"),
  } as unknown as CloudinarySdk;
}

describe("Cloudinary smoke evidence derivation (T114)", () => {
  it("builds upload evidence from adapter-validated metadata", async () => {
    const adapter = new CloudinaryMediaAdapter(fakeSdk({ uploadType: "authenticated" }), {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "folder",
      signedUrlTtlSeconds: 900,
    });
    const storageKey = createOpaqueCloudinaryPublicId("folder");
    const stored = await adapter.storeProfileImage({
      bytes: Buffer.from("webp"),
      ownerUserId: "smoke-user",
      mediaId: "media",
      storageKey,
    });
    expect(stored.uploadResourceType).toBe("image");
    expect(stored.uploadType).toBe("authenticated");
  });

  it("captures first ok and second not_found destroy outcomes", async () => {
    const adapter = new CloudinaryMediaAdapter(
      fakeSdk({ destroyResults: ["ok", "not found"] }),
      {
        cloudName: "demo",
        apiKey: "key",
        apiSecret: SECRET,
        folder: "folder",
        signedUrlTtlSeconds: 900,
      },
    );
    const reference = {
      provider: "CLOUDINARY" as const,
      storageKey: "folder/opaque",
      contentType: "image/webp" as const,
      byteSize: 10,
      width: 10,
      height: 10,
      uploadResourceType: "image" as const,
      uploadType: "authenticated" as const,
    };
    const first = await adapter.remove(reference);
    const second = await adapter.remove(reference);
    expect(first.destroyResult).toBe("ok");
    expect(second.destroyResult).toBe("not_found");
  });

  it("rejects unexpected upload type before evidence can be produced", async () => {
    const adapter = new CloudinaryMediaAdapter(fakeSdk({ uploadType: "upload" }), {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "folder",
      signedUrlTtlSeconds: 900,
    });
    await expect(
      adapter.storeProfileImage({
        bytes: Buffer.from("webp"),
        ownerUserId: "smoke-user",
        mediaId: "media",
        storageKey: "folder/opaque",
      }),
    ).rejects.toMatchObject({ code: "MEDIA_PROVIDER_FAILURE" });
  });

  it("fails when destroy outcomes are missing or unexpected", () => {
    expect(() => normalizeCloudinaryDestroyResult({ result: "error" })).toThrow();
    expect(normalizeCloudinaryDestroyResult({ result: "ok" })).toBe("ok");
    expect(normalizeCloudinaryDestroyResult({ result: "not found" })).toBe(
      "not_found",
    );
  });

  it("does not hard-code smoke destroy/upload evidence literals in source", () => {
    const source = readFileSync(SMOKE_PATH, "utf8");
    expect(source).toContain("uploadResourceType: stored.uploadResourceType");
    expect(source).toContain("uploadType: stored.uploadType");
    expect(source).toContain("firstDestroy.destroyResult");
    expect(source).toContain("secondDestroy.destroyResult");
    expect(source).not.toMatch(/firstDestroyResult:\s*"ok"/u);
    expect(source).not.toMatch(/uploadResourceType:\s*"image"/u);
    expect(source).not.toContain(SECRET);
  });
});

import { Writable } from "node:stream";


import { MediaError } from "../../../../src/modules/media/domain/media.errors.js";
import {
  CloudinaryMediaAdapter,
  createOpaqueCloudinaryPublicId,
  type CloudinarySdk,
} from "../../../../src/modules/media/infrastructure/cloudinary-media.adapter.js";

const SECRET = "cloudinary-api-secret-value-for-tests";

function createFakeSdk(options?: {
  readonly failUploadMessage?: string;
  readonly destroyResult?: string;
  readonly responseType?: string;
}): CloudinarySdk {
  const failUploadMessage = options?.failUploadMessage;
  const destroyResult = options?.destroyResult ?? "ok";
  const responseType = options?.responseType ?? "authenticated";

  return {
    config: vi.fn(),
    uploader: {
      upload_stream: vi.fn(
        (
          uploadOptions: Readonly<Record<string, unknown>>,
          callback: (
            error: Error | undefined,
            result:
              | {
                  resource_type: string;
                  type: string;
                  format: string;
                  public_id: string;
                  bytes: number;
                  width: number;
                  height: number;
                }
              | undefined,
          ) => void,
        ) => {
          const chunks: Buffer[] = [];
          return new Writable({
            write(chunk, _encoding, next) {
              chunks.push(Buffer.from(chunk));
              next();
            },
            final(done) {
              if (failUploadMessage !== undefined) {
                callback(new Error(failUploadMessage), undefined);
                done();
                return;
              }
              callback(undefined, {
                resource_type: "image",
                type: responseType,
                format: "webp",
                public_id: String(uploadOptions["public_id"]),
                bytes: Math.max(Buffer.concat(chunks).byteLength, 32),
                width: 128,
                height: 96,
              });
              done();
            },
          });
        },
      ),
      destroy: vi.fn(async () => ({ result: destroyResult })),
    },
    url: vi.fn(
      (publicId: string, urlOptions: Readonly<Record<string, unknown>>) =>
        `https://res.cloudinary.com/demo/image/authenticated/s--signed--/v1/${publicId}?e=${String(urlOptions["expires_at"])}`,
    ),
  } as unknown as CloudinarySdk;
}

describe("CloudinaryMediaAdapter", () => {
  it("uploads with authenticated type, overwrite false, and opaque public_id", async () => {
    const sdk = createFakeSdk();
    const adapter = new CloudinaryMediaAdapter(sdk, {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "cleanora/customer-profile-images",
      signedUrlTtlSeconds: 900,
    });
    const storageKey = createOpaqueCloudinaryPublicId(
      "cleanora/customer-profile-images",
    );

    const stored = await adapter.storeProfileImage({
      bytes: Buffer.from("webp-bytes"),
      ownerUserId: "user-1",
      mediaId: "media-1",
      storageKey,
    });

    expect(sdk.config).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: "demo",
        api_key: "key",
        api_secret: SECRET,
        secure: true,
      }),
    );
    expect(sdk.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: "image",
        type: "authenticated",
        public_id: storageKey,
        format: "webp",
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      }),
      expect.any(Function),
    );
    expect(stored).toEqual({
      provider: "CLOUDINARY",
      storageKey,
      contentType: "image/webp",
      byteSize: expect.any(Number),
      width: 128,
      height: 96,
      uploadResourceType: "image",
      uploadType: "authenticated",
    });
    expect(storageKey).toMatch(
      /^cleanora\/customer-profile-images\/[0-9a-f]{40}$/u,
    );
  });

  it("rejects upload responses with type upload as MEDIA_PROVIDER_FAILURE", async () => {
    const sdk = createFakeSdk({ responseType: "upload" });
    const adapter = new CloudinaryMediaAdapter(sdk, {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "folder",
      signedUrlTtlSeconds: 900,
    });

    await expect(
      adapter.storeProfileImage({
        bytes: Buffer.from("webp-bytes"),
        ownerUserId: "user",
        mediaId: "media",
        storageKey: "folder/opaque",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(MediaError);
      expect((error as MediaError).code).toBe("MEDIA_PROVIDER_FAILURE");
      return true;
    });
  });

  it("redacts the API secret from provider failure messages", async () => {
    const sdk = createFakeSdk({
      failUploadMessage: `upload failed using ${SECRET}`,
    });
    const adapter = new CloudinaryMediaAdapter(sdk, {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "folder",
      signedUrlTtlSeconds: 900,
    });

    await expect(
      adapter.storeProfileImage({
        bytes: Buffer.from("x"),
        ownerUserId: "user",
        mediaId: "media",
        storageKey: "folder/opaque",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(MediaError);
      expect((error as MediaError).code).toBe("MEDIA_PROVIDER_FAILURE");
      expect((error as Error).message).not.toContain(SECRET);
      expect((error as Error).message).toContain("[REDACTED]");
      return true;
    });
  });

  it("creates signed authenticated delivery URLs and destroys authenticated assets", async () => {
    const sdk = createFakeSdk();
    const adapter = new CloudinaryMediaAdapter(sdk, {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "folder",
      signedUrlTtlSeconds: 600,
    });
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const reference = {
      provider: "CLOUDINARY" as const,
      storageKey: "folder/opaque-id",
      contentType: "image/webp" as const,
      byteSize: 100,
      width: 10,
      height: 10,
      uploadResourceType: "image" as const,
      uploadType: "authenticated" as const,
    };

    const delivery = await adapter.createAuthorizedDeliveryUrl(
      reference,
      expiresAt,
    );
    expect(sdk.url).toHaveBeenCalledWith(
      "folder/opaque-id",
      expect.objectContaining({
        resource_type: "image",
        type: "authenticated",
        sign_url: true,
        secure: true,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      }),
    );
    expect(delivery.url).toContain("authenticated");
    expect(delivery.urlExpiresAt).toBe(expiresAt.toISOString());

    await expect(adapter.remove(reference)).resolves.toEqual({
      destroyResult: "ok",
    });
    expect(sdk.uploader.destroy).toHaveBeenCalledWith(
      "folder/opaque-id",
      expect.objectContaining({
        resource_type: "image",
        type: "authenticated",
        invalidate: true,
      }),
    );
  });

  it("captures not_found on second destroy and rejects unexpected outcomes", async () => {
    const sdk = createFakeSdk({ destroyResult: "not found" });
    const adapter = new CloudinaryMediaAdapter(sdk, {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "folder",
      signedUrlTtlSeconds: 900,
    });
    const reference = {
      provider: "CLOUDINARY" as const,
      storageKey: "folder/opaque-id",
      contentType: "image/webp" as const,
      byteSize: 100,
      width: 10,
      height: 10,
      uploadResourceType: "image" as const,
      uploadType: "authenticated" as const,
    };

    await expect(adapter.remove(reference)).resolves.toEqual({
      destroyResult: "not_found",
    });

    const failingSdk = createFakeSdk({ destroyResult: "error" });
    const failingAdapter = new CloudinaryMediaAdapter(failingSdk, {
      cloudName: "demo",
      apiKey: "key",
      apiSecret: SECRET,
      folder: "folder",
      signedUrlTtlSeconds: 900,
    });
    await expect(failingAdapter.remove(reference)).rejects.toMatchObject({
      code: "MEDIA_PROVIDER_FAILURE",
    });
  });
});

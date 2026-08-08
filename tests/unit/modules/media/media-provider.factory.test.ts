import { MediaError } from "../../../../src/modules/media/domain/media.errors.js";
import { createMediaStoragePort } from "../../../../src/modules/media/infrastructure/media-provider.factory.js";

const base = {
  MEDIA_STORAGE_PROVIDER: "cloudinary",
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
  CLOUDINARY_PROFILE_IMAGE_FOLDER: "cleanora/customer-profile-images",
  CLOUDINARY_SIGNED_URL_TTL_SECONDS: 900,
  MEDIA_IMAGE_MAX_BYTES: 5_242_880,
} as const;

describe("createMediaStoragePort", () => {
  it("rejects s3 with a clear R1-P04 message", () => {
    expect(() =>
      createMediaStoragePort({
        ...base,
        MEDIA_STORAGE_PROVIDER: "s3",
      } as never),
    ).toThrow(MediaError);
    expect(() =>
      createMediaStoragePort({
        ...base,
        MEDIA_STORAGE_PROVIDER: "s3",
      } as never),
    ).toThrow(/S3 is not implemented in R1-P04/u);
  });

  it("requires Cloudinary credentials when provider is cloudinary", () => {
    expect(() =>
      createMediaStoragePort({
        ...base,
        CLOUDINARY_API_SECRET: "",
      } as never),
    ).toThrow(/CLOUDINARY_/u);
  });

  it("requires MEDIA_IMAGE_MAX_BYTES exactly 5 MiB", () => {
    expect(() =>
      createMediaStoragePort({
        ...base,
        MEDIA_IMAGE_MAX_BYTES: 1024,
      } as never),
    ).toThrow(/MEDIA_IMAGE_MAX_BYTES/u);
  });

  it("builds a Cloudinary adapter for valid cloudinary config", () => {
    const fakeSdk = {
      config: () => undefined,
      uploader: {},
      url: () => "https://example.test",
    };
    const selection = createMediaStoragePort(base as never, fakeSdk as never);
    expect(selection.signedUrlTtlSeconds).toBe(900);
    expect(selection.imageMaxBytes).toBe(5_242_880);
    expect(selection.storage).toBeDefined();
  });
});

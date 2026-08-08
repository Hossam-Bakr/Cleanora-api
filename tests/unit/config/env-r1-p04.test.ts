import {
  assertCustomersRuntimeEnvironment,
  loadEnvironment,
} from "../../../src/config/env.js";

const foundationEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PORT: "8000",
  API_PREFIX: "/api/v1",
  DATABASE_URL: "postgresql://test:test@localhost:5432/cleanora_test",
  CORS_ORIGINS: "http://localhost:5173",
  LOG_LEVEL: "error",
  SHUTDOWN_TIMEOUT_MS: "10000",
  REQUEST_BODY_LIMIT: "1mb",
};

const cloudinaryCustomersEnv = {
  MEDIA_STORAGE_PROVIDER: "cloudinary",
  CLOUDINARY_CLOUD_NAME: "demo-cloud",
  CLOUDINARY_API_KEY: "demo-key",
  CLOUDINARY_API_SECRET: "demo-secret-value-not-real",
  CLOUDINARY_PROFILE_IMAGE_FOLDER: "cleanora/customer-profile-images",
  CLOUDINARY_SIGNED_URL_TTL_SECONDS: "900",
  MEDIA_IMAGE_MAX_BYTES: "5242880",
  PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: "90",
} as const;

describe("R1-P04 environment readiness", () => {
  it("does not require retention env for foundation tooling without customers runtime", () => {
    expect(() => loadEnvironment({ ...foundationEnvironment })).not.toThrow();
  });

  it("requires MEDIA_STORAGE_PROVIDER when customers runtime is composed", () => {
    const environment = loadEnvironment({
      ...foundationEnvironment,
      PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: "30",
    });

    expect(() => assertCustomersRuntimeEnvironment(environment)).toThrow(
      /MEDIA_STORAGE_PROVIDER/u,
    );
  });

  it("rejects s3 with a clear R1-P04 unsupported message", () => {
    const environment = loadEnvironment({
      ...foundationEnvironment,
      ...cloudinaryCustomersEnv,
      MEDIA_STORAGE_PROVIDER: "s3",
    });
    expect(() => assertCustomersRuntimeEnvironment(environment)).toThrow(
      /S3 is not implemented in R1-P04/u,
    );
  });

  it("requires positive-integer PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS with no default when customers runtime is composed", () => {
    const missing = loadEnvironment({
      ...foundationEnvironment,
      ...cloudinaryCustomersEnv,
      PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: undefined,
    });
    expect(() => assertCustomersRuntimeEnvironment(missing)).toThrow(
      /PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS/u,
    );

    expect(() =>
      loadEnvironment({
        ...foundationEnvironment,
        ...cloudinaryCustomersEnv,
        PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: "0",
      }),
    ).toThrow(/PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS|too_small|positive/iu);
  });

  it("requires MEDIA_IMAGE_MAX_BYTES exactly 5 MiB", () => {
    const environment = loadEnvironment({
      ...foundationEnvironment,
      ...cloudinaryCustomersEnv,
      MEDIA_IMAGE_MAX_BYTES: "1024",
    });
    expect(() => assertCustomersRuntimeEnvironment(environment)).toThrow(
      /MEDIA_IMAGE_MAX_BYTES/u,
    );
  });

  it("accepts valid Cloudinary customers-runtime configuration", () => {
    const environment = loadEnvironment({
      ...foundationEnvironment,
      ...cloudinaryCustomersEnv,
    });

    expect(() => assertCustomersRuntimeEnvironment(environment)).not.toThrow();
    expect(environment.MEDIA_STORAGE_PROVIDER).toBe("cloudinary");
    expect(environment.MEDIA_IMAGE_MAX_BYTES).toBe(5_242_880);
    expect(environment.PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS).toBe(90);
  });
});

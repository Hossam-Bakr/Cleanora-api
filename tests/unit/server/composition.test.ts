import {
  bindPrismaClient,
  resetPrismaClientForTests,
} from "#database/prisma";
import { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createRuntimeDependencies } from "../../../src/composition.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";

describe("runtime composition", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetPrismaClientForTests("test");
  });

  it("constructs the concrete runtime without connecting or mounting", () => {
    const environment = createTestEnvironment();
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");

    const runtime = createRuntimeDependencies(environment);

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.database).toBeInstanceOf(PrismaLifecycle);
    expect(runtime.routes.environment).toBe(environment);
    expect(runtime.routes.logger).toBe(runtime.logger);
    expect(runtime.routes.readinessProbes).toHaveLength(1);
    expect(runtime.routes.authenticationRouter).toBeUndefined();
  });

  it("wires authentication, customers, and provider routers when AUTH_ENABLED", () => {
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");
    const environment = createTestEnvironment({
      AUTH_ENABLED: true,
      EMAIL_AUTH_ENABLED: false,
      GOOGLE_AUTH_ENABLED: true,
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      MEDIA_STORAGE_PROVIDER: "cloudinary",
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
      CLOUDINARY_PROFILE_IMAGE_FOLDER: "cleanora-providers",
      CLOUDINARY_SIGNED_URL_TTL_SECONDS: 300,
      MEDIA_IMAGE_MAX_BYTES: 5 * 1024 * 1024,
      PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: 30,
    });

    const runtime = createRuntimeDependencies(environment);

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.routes.authenticationRouter).toBeDefined();
    expect(runtime.routes.customersRouter).toBeDefined();
    expect(runtime.routes.providersRouter).toBeDefined();
    expect(runtime.routes.staffProvidersRouter).toBeDefined();
    expect(runtime.routes.providerAdminInvitationRouter).toBeDefined();
    expect(runtime.routes.providerWorkforceRouter).toBeDefined();
    expect(runtime.routes.providerWorkerSelfRouter).toBeDefined();
    expect(runtime.routes.providerWorkforceInvitationRouter).toBeDefined();
    expect(runtime.privacyProcessor).toBeDefined();
    expect(runtime.privacyPrivileged).toBeDefined();
    expect(runtime.startCustomersBackgroundTasks).toBeTypeOf("function");
    expect(runtime.routes.readinessProbes?.length).toBeGreaterThan(1);

    vi.useFakeTimers();
    const stop = runtime.startCustomersBackgroundTasks?.();
    expect(stop).toBeTypeOf("function");
    stop?.();
    vi.useRealTimers();
  });

  it("wires nodemailer transport when EMAIL_AUTH_ENABLED for auth and invitations", () => {
    bindPrismaClient({
      country: { findUnique: vi.fn() },
      mediaFile: { findUnique: vi.fn() },
    } as never);
    const environment = createTestEnvironment({
      AUTH_ENABLED: true,
      EMAIL_AUTH_ENABLED: true,
      GOOGLE_AUTH_ENABLED: false,
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_REQUIRE_TLS: true,
      SMTP_USER: "smtp-user",
      SMTP_PASSWORD: "smtp-password",
      SMTP_FROM_NAME: "Cleanora",
      SMTP_FROM_EMAIL: "noreply@example.test",
      SMTP_CONNECTION_TIMEOUT_MS: 5_000,
      SMTP_SOCKET_TIMEOUT_MS: 5_000,
      MEDIA_STORAGE_PROVIDER: "cloudinary",
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
      CLOUDINARY_PROFILE_IMAGE_FOLDER: "cleanora-providers",
      CLOUDINARY_SIGNED_URL_TTL_SECONDS: 300,
      MEDIA_IMAGE_MAX_BYTES: 5 * 1024 * 1024,
      PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: 30,
    });

    const runtime = createRuntimeDependencies(environment);
    expect(runtime.routes.authenticationRouter).toBeDefined();
    expect(runtime.routes.providersRouter).toBeDefined();
    expect(runtime.routes.providerAdminInvitationRouter).toBeDefined();
  });
});

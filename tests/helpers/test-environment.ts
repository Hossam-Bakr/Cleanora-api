import type { AppEnvironment } from "../../src/config/env.js";

/**
 * @desc Create a complete deterministic test environment.
 * @access Test helper
 * @explanation This helper keeps unit, integration, and e2e tests independent
 * from developer .env files and real secrets.
 */
export function createTestEnvironment(
  overrides: Partial<AppEnvironment> = {}
): AppEnvironment {
  return {
    AUTH_ENABLED: false,
    EMAIL_AUTH_ENABLED: false,
    GOOGLE_AUTH_ENABLED: false,
    AUTH_VERIFIER_SECRET: 'test-verifier-secret-that-is-longer-than-32-chars',
    AUTH_PRIVACY_HASH_SECRET: 'test-privacy-secret-that-is-longer-than-32-chars',
    NODE_ENV: "test",
    PORT: 8_000,
    API_PREFIX: "/api/v1",
    DATABASE_URL: "postgresql://test:test@localhost:5432/cleanora_test",
    CORS_ORIGINS: ["http://localhost:5173"],
    LOG_LEVEL: "error",
    JWT_ACCESS_SECRET: "test-access-secret-that-is-longer-than-32-chars",
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-longer-than-32-chars",
    JWT_REFRESH_TTL_SECONDS: 2_592_000,
    JWT_ISSUER: "cleanora-api",
    JWT_AUDIENCE: "cleanora-web",
    AUTH_REFRESH_COOKIE_NAME: "cleanora_refresh_token",
    AUTH_REFRESH_COOKIE_PATH: "/api/v1/auth",
    AUTH_COOKIE_SECURE: false,
    AUTH_COOKIE_SAME_SITE: "lax",
    GOOGLE_REDIRECT_URI: "http://localhost:8000/api/v1/auth/google/callback",
    GOOGLE_FRONTEND_CALLBACK_URI: "http://localhost:5173/auth/google/callback",
    OWNER_ADMIN_API_ENABLED: false,
    SHUTDOWN_TIMEOUT_MS: 10_000,
    REQUEST_BODY_LIMIT: "1mb",
    ...overrides
  };
}

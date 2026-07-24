import { describe, expect, it } from "vitest";

import { loadEnvironment } from "../../../src/config/env.js";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PORT: "8000",
  API_PREFIX: "/api/v1",
  DATABASE_URL: "postgresql://test:test@localhost:5432/cleanora_test",
  CORS_ORIGINS: "http://localhost:5173,http://localhost:4173",
  LOG_LEVEL: "error",
  JWT_ACCESS_SECRET: "access-secret-that-is-longer-than-thirty-two-characters",
  JWT_ACCESS_TTL_SECONDS: "900",
  JWT_REFRESH_SECRET: "refresh-secret-that-is-longer-than-thirty-two-characters",
  JWT_REFRESH_TTL_SECONDS: "2592000",
  JWT_ISSUER: "cleanora-api",
  JWT_AUDIENCE: "cleanora-web",
  AUTH_REFRESH_COOKIE_NAME: "cleanora_refresh",
  AUTH_REFRESH_COOKIE_PATH: "/api/v1/auth",
  AUTH_COOKIE_SECURE: "false",
  AUTH_COOKIE_SAME_SITE: "lax",
  SHUTDOWN_TIMEOUT_MS: "10000",
  REQUEST_BODY_LIMIT: "1mb"
};

describe("loadEnvironment", () => {
  it("parses API, CORS, JWT, and cookie settings", () => {
    const environment = loadEnvironment(validEnvironment);

    expect(environment.API_PREFIX).toBe("/api/v1");
    expect(environment.CORS_ORIGINS).toEqual([
      "http://localhost:5173",
      "http://localhost:4173"
    ]);
    expect(environment.AUTH_COOKIE_SECURE).toBe(false);
  });

  it("rejects SameSite=None without a secure cookie", () => {
    expect(() =>
      loadEnvironment({
        ...validEnvironment,
        AUTH_COOKIE_SAME_SITE: "none",
        AUTH_COOKIE_SECURE: "false"
      })
    ).toThrow(/SameSite=None requires AUTH_COOKIE_SECURE=true/);
  });

  it("requires independent access and refresh secrets", () => {
    expect(() =>
      loadEnvironment({
        ...validEnvironment,
        JWT_REFRESH_SECRET: validEnvironment["JWT_ACCESS_SECRET"]
      })
    ).toThrow(/Access and refresh token secrets must be different/);
  });

  it("allows foundation startup without optional authentication values", () => {
    const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ...foundationEnvironment } =
      validEnvironment;

    expect(loadEnvironment(foundationEnvironment).NODE_ENV).toBe("test");
  });

  it("rejects missing required database and CORS configuration", () => {
    const { DATABASE_URL, ...withoutDatabaseUrl } = validEnvironment;
    const { CORS_ORIGINS, ...withoutCorsOrigins } = validEnvironment;

    expect(() => loadEnvironment(withoutDatabaseUrl)).toThrow(
      /DATABASE_URL/
    );
    expect(() => loadEnvironment(withoutCorsOrigins)).toThrow(
      /CORS_ORIGINS/
    );
  });
});


import {
  createStartupFailureContext,
  loadEnvironment,
  mapEnvironmentDiagnostics
} from "../../../src/config/env.js";
import { startApplication } from "../../../src/server.js";

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
  AUTH_REFRESH_COOKIE_NAME: "cleanora_refresh_token",
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
    const {
      JWT_ACCESS_SECRET: _jwtAccessSecret,
      JWT_REFRESH_SECRET: _jwtRefreshSecret,
      ...foundationEnvironment
    } =
      validEnvironment;

    expect(loadEnvironment(foundationEnvironment).NODE_ENV).toBe("test");
  });

  it("treats empty future-auth placeholders as absent during R1-P01", () => {
    const environment = loadEnvironment({
      ...validEnvironment,
      JWT_ACCESS_SECRET: "",
      JWT_REFRESH_SECRET: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REDIRECT_URI: "",
      GOOGLE_FRONTEND_CALLBACK_URI: ""
    });

    expect(environment.JWT_ACCESS_SECRET).toBeUndefined();
    expect(environment.JWT_REFRESH_SECRET).toBeUndefined();
    expect(environment.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(environment.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(environment.GOOGLE_REDIRECT_URI).toBeUndefined();
    expect(environment.GOOGLE_FRONTEND_CALLBACK_URI).toBeUndefined();
  });

  it("rejects missing required database and CORS configuration", () => {
    const { DATABASE_URL: _databaseUrl, ...withoutDatabaseUrl } = validEnvironment;
    const { CORS_ORIGINS: _corsOrigins, ...withoutCorsOrigins } = validEnvironment;

    expect(() => loadEnvironment(withoutDatabaseUrl)).toThrow(
      /DATABASE_URL/
    );
    expect(() => loadEnvironment(withoutCorsOrigins)).toThrow(
      /CORS_ORIGINS/
    );
  });

  it("maps missing DATABASE_URL and invalid CORS_ORIGINS to safe field diagnostics", () => {
    const { DATABASE_URL: _databaseUrl, ...withoutDatabaseUrl } = validEnvironment;
    const databaseDiagnostics = captureDiagnostics(withoutDatabaseUrl);
    const corsDiagnostics = captureDiagnostics({
      ...validEnvironment,
      CORS_ORIGINS: "not-an-origin"
    });

    expect(databaseDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "DATABASE_URL" })
      ])
    );
    expect(
      corsDiagnostics.some((diagnostic) =>
        diagnostic.field.startsWith("CORS_ORIGINS")
      )
    ).toBe(true);
  });

  it("never exposes JWT secret or DATABASE_URL contents in diagnostics", () => {
    const shortSecret = "short-jwt-secret-value";
    const databaseContents = "database-password-and-host-value";
    const jwtDiagnostics = captureDiagnostics({
      ...validEnvironment,
      JWT_ACCESS_SECRET: shortSecret
    });
    const databaseDiagnostics = captureDiagnostics({
      ...validEnvironment,
      DATABASE_URL: databaseContents
    });
    const serialized = JSON.stringify([
      ...jwtDiagnostics,
      ...databaseDiagnostics
    ]);

    expect(serialized).toContain("JWT_ACCESS_SECRET");
    expect(serialized).toContain("DATABASE_URL");
    expect(serialized).not.toContain(shortSecret);
    expect(serialized).not.toContain(databaseContents);
  });

  it("fails validation before database composition or listening can begin", async () => {
    const originalDatabaseUrl = process.env["DATABASE_URL"];
    delete process.env["DATABASE_URL"];

    try {
      await expect(startApplication()).rejects.toBeDefined();
    } finally {
      if (originalDatabaseUrl === undefined) {
        delete process.env["DATABASE_URL"];
      } else {
        process.env["DATABASE_URL"] = originalDatabaseUrl;
      }
    }
  });

  it("creates a structured startup context without raw Zod issues", () => {
    const context = captureStartupFailureContext({
      ...validEnvironment,
      DATABASE_URL: "private-database-contents"
    });
    const serialized = JSON.stringify(context);

    expect(context).toMatchObject({ errorName: "ZodError" });
    expect(serialized).toContain("DATABASE_URL");
    expect(serialized).not.toContain("private-database-contents");
    expect(serialized).not.toContain('"input"');
  });

  it("includes only a safe startup error code without exposing raw error data", () => {
    const safeContext = createStartupFailureContext(
      Object.assign(new Error("private database host"), { code: "P1001" })
    );
    const unsafeContext = createStartupFailureContext(
      Object.assign(new Error("private database host"), {
        code: "P1001 private-database-host"
      })
    );

    expect(safeContext).toEqual({
      errorName: "Error",
      errorCode: "P1001"
    });
    expect(unsafeContext).toEqual({ errorName: "Error" });
    expect(JSON.stringify([safeContext, unsafeContext])).not.toContain(
      "private database host"
    );
  });
});

function captureDiagnostics(input: NodeJS.ProcessEnv) {
  try {
    loadEnvironment(input);
    throw new Error("Expected environment validation to fail");
  } catch (error: unknown) {
    return mapEnvironmentDiagnostics(error);
  }
}

function captureStartupFailureContext(input: NodeJS.ProcessEnv) {
  try {
    loadEnvironment(input);
    throw new Error("Expected environment validation to fail");
  } catch (error: unknown) {
    return createStartupFailureContext(error);
  }
}

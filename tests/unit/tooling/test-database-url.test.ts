import {
  applyTestDatabaseEnv,
  hasApprovedTestDatabaseUrl,
  requireApprovedTestDatabaseUrl,
  resolveTestDatabaseUrl
} from "../../helpers/resolve-test-database-url.js";

const SECRET_FRAGMENT = "super-secret-password-should-never-leak";
const TEST_URL = `postgresql://test_user:${SECRET_FRAGMENT}@db-pooler.example.test:5432/cleanora_r1_p02_ci_02`;
const CI_URL = `postgresql://ci_user:${SECRET_FRAGMENT}@db-direct.example.test:5432/cleanora_r1_p02_ci_02`;
const DEV_URL = `postgresql://dev_user:${SECRET_FRAGMENT}@localhost:5432/cleanora_dev`;

describe("test database URL selection", () => {
  it("selects TEST_DATABASE_URL over CI_DATABASE_URL and DATABASE_URL", () => {
    const env: NodeJS.ProcessEnv = {
      TEST_DATABASE_URL: TEST_URL,
      CI_DATABASE_URL: CI_URL,
      DATABASE_URL: DEV_URL
    };

    const resolved = resolveTestDatabaseUrl(env);

    expect(resolved.source).toBe("TEST_DATABASE_URL");
    expect(resolved.url).toBe(TEST_URL);
    expect(hasApprovedTestDatabaseUrl(env)).toBe(true);
  });

  it("does not mutate CI_DATABASE_URL when applying test database env", () => {
    const env: NodeJS.ProcessEnv = {
      TEST_DATABASE_URL: TEST_URL,
      CI_DATABASE_URL: CI_URL,
      DATABASE_URL: DEV_URL
    };

    const resolved = applyTestDatabaseEnv(env);

    expect(resolved.source).toBe("TEST_DATABASE_URL");
    expect(env["DATABASE_URL"]).toBe(TEST_URL);
    expect(env["CI_DATABASE_URL"]).toBe(CI_URL);
    expect(env["TEST_DATABASE_URL"]).toBe(TEST_URL);
  });

  it("does not select ordinary DATABASE_URL when TEST_DATABASE_URL exists", () => {
    const env: NodeJS.ProcessEnv = {
      TEST_DATABASE_URL: TEST_URL,
      DATABASE_URL: DEV_URL
    };

    applyTestDatabaseEnv(env);

    expect(env["DATABASE_URL"]).toBe(TEST_URL);
    expect(env["DATABASE_URL"]).not.toBe(DEV_URL);
  });

  it("falls back to CI_DATABASE_URL only when TEST_DATABASE_URL is absent", () => {
    const env: NodeJS.ProcessEnv = {
      CI_DATABASE_URL: CI_URL,
      DATABASE_URL: DEV_URL
    };

    const resolved = applyTestDatabaseEnv(env);

    expect(resolved.source).toBe("CI_DATABASE_URL");
    expect(env["DATABASE_URL"]).toBe(CI_URL);
    expect(env["CI_DATABASE_URL"]).toBe(CI_URL);
  });

  it("fails clearly when no approved test database URL is configured", () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: DEV_URL
    };

    expect(hasApprovedTestDatabaseUrl(env)).toBe(false);
    expect(() => requireApprovedTestDatabaseUrl(env)).toThrow(
      /Approved test database URL is required/
    );
    expect(() => requireApprovedTestDatabaseUrl(env)).toThrow(
      /Ordinary DATABASE_URL is not an approved test target/
    );
  });

  it("never includes connection secrets in selection errors", () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: DEV_URL
    };

    let message = "";
    try {
      requireApprovedTestDatabaseUrl(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain(SECRET_FRAGMENT);
    expect(message).not.toContain(DEV_URL);
    expect(message).not.toContain("postgresql://");
    expect(message).not.toContain("dev_user");
    expect(message).not.toContain("localhost");
    expect(message).not.toContain("cleanora_dev");
  });
});

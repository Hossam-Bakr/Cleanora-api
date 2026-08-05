import {
  applyTestDatabaseEnv,
  hasApprovedTestDatabaseUrl,
  requireApprovedTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from "../../helpers/resolve-test-database-url.js";

const SECRET_FRAGMENT = "super-secret-password-should-never-leak";
const TEST_URL = `postgresql://test_user:${SECRET_FRAGMENT}@db-pooler.example.test:5432/cleanora_r1_p02_test`;
const DEV_URL = `postgresql://dev_user:${SECRET_FRAGMENT}@localhost:5432/cleanora_dev`;

describe("test database URL selection", () => {
  it("selects TEST_DATABASE_URL instead of DATABASE_URL", () => {
    const env: NodeJS.ProcessEnv = {
      TEST_DATABASE_URL: TEST_URL,
      DATABASE_URL: DEV_URL,
    };

    const resolved = applyTestDatabaseEnv(env);

    expect(resolved).toEqual({
      source: "TEST_DATABASE_URL",
      url: TEST_URL,
    });
    expect(env["DATABASE_URL"]).toBe(TEST_URL);
    expect(hasApprovedTestDatabaseUrl(env)).toBe(true);
  });

  it("does not select ordinary DATABASE_URL", () => {
    const env: NodeJS.ProcessEnv = { DATABASE_URL: DEV_URL };

    expect(resolveTestDatabaseUrl(env)).toEqual({
      source: undefined,
      url: undefined,
    });
    expect(hasApprovedTestDatabaseUrl(env)).toBe(false);
    expect(() => requireApprovedTestDatabaseUrl(env)).toThrow(
      /Ordinary DATABASE_URL is not an approved test target/,
    );
  });

  it("never includes connection secrets in selection errors", () => {
    const env: NodeJS.ProcessEnv = { DATABASE_URL: DEV_URL };

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

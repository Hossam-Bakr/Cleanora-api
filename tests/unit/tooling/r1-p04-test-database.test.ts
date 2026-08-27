import {
  APPROVED_R1_P04_PROOF_NAME,
  requireR1P04TestDatabase,
} from "../../helpers/r1-p04-test-database.js";

const SECRET = "super-secret-password-should-never-leak";

function urlFor(databaseName: string): string {
  return `postgresql://user:${SECRET}@localhost:5432/${databaseName}`;
}

function approvedEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const approved = urlFor(APPROVED_R1_P04_PROOF_NAME);
  return {
    TEST_DATABASE_HAS_R1_P04: "true",
    TEST_DATABASE_URL: approved,
    TEST_MIGRATION_DATABASE_URL: approved,
    ...overrides,
  };
}

function messageOf(run: () => unknown): string {
  try {
    run();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("requireR1P04TestDatabase (T103)", () => {
  it("accepts a valid R1-P04 proof database", () => {
    expect(requireR1P04TestDatabase(approvedEnv())).toEqual({
      databaseName: APPROVED_R1_P04_PROOF_NAME,
    });
  });

  it("accepts an explicitly attested R1-P07 disposable target for R1-P04 regression only", () => {
    const databaseName = "cleanora_r1_p07_proof";
    expect(requireR1P04TestDatabase(approvedEnv({
      TEST_DATABASE_HAS_R1_P07: "true",
      TEST_DATABASE_URL: urlFor(databaseName),
      TEST_MIGRATION_DATABASE_URL: urlFor(databaseName),
    }))).toEqual({ databaseName });
  });

  it("rejects an R1-P07 target without the explicit compatibility attestation", () => {
    const databaseName = "cleanora_r1_p07_proof";
    expect(() => requireR1P04TestDatabase(approvedEnv({
      TEST_DATABASE_URL: urlFor(databaseName),
      TEST_MIGRATION_DATABASE_URL: urlFor(databaseName),
    }))).toThrow(/explicitly attested R1-P07/u);
  });

  it("rejects an R1-P02 CI database", () => {
    const env = approvedEnv({
      TEST_DATABASE_URL: urlFor("cleanora_r1_p02_ci"),
      TEST_MIGRATION_DATABASE_URL: urlFor("cleanora_r1_p02_ci"),
    });
    expect(() => requireR1P04TestDatabase(env)).toThrow(/Rejected unsafe test database name/u);
  });

  it("rejects a production-like database", () => {
    const env = approvedEnv({
      TEST_DATABASE_URL: urlFor("cleanora_production"),
      TEST_MIGRATION_DATABASE_URL: urlFor("cleanora_production"),
    });
    expect(() => requireR1P04TestDatabase(env)).toThrow(/Rejected unsafe test database name/u);
  });

  it("rejects mismatched pooled and migration database names", () => {
    const env = approvedEnv({
      TEST_DATABASE_URL: urlFor(APPROVED_R1_P04_PROOF_NAME),
      TEST_MIGRATION_DATABASE_URL: urlFor("cleanora_r1_p04_other_proof"),
    });
    expect(() => requireR1P04TestDatabase(env)).toThrow(
      /must refer to the same R1-P04 proof database name/u,
    );
  });

  it("fails closed when the R1-P04 readiness flag is missing or false", () => {
    expect(() =>
      requireR1P04TestDatabase(
        approvedEnv({
          TEST_DATABASE_HAS_R1_P04: undefined,
        }),
      ),
    ).toThrow(/TEST_DATABASE_HAS_R1_P04=true/u);
    expect(() =>
      requireR1P04TestDatabase(
        approvedEnv({
          TEST_DATABASE_HAS_R1_P04: "false",
        }),
      ),
    ).toThrow(/TEST_DATABASE_HAS_R1_P04=true/u);
  });

  it("keeps credentials and complete URLs out of error messages", () => {
    const env = approvedEnv({
      TEST_DATABASE_URL: urlFor("cleanora_r1_p02_ci"),
      TEST_MIGRATION_DATABASE_URL: urlFor("cleanora_r1_p02_ci"),
    });
    const message = messageOf(() => requireR1P04TestDatabase(env));

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain("postgresql://");
    expect(message).not.toContain("user:pass");
    expect(message).not.toContain(`user:${SECRET}`);
  });
});

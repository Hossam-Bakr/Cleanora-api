const {
  buildValidatedChildEnvironment,
  parseCli,
  runR1P04DatabaseCommand,
} = require("../../../scripts/r1-p04-database-command.cjs") as {
  buildValidatedChildEnvironment: (explicit: {
    DATABASE_URL?: string | undefined;
    TEST_DATABASE_URL?: string | undefined;
    TEST_MIGRATION_DATABASE_URL?: string | undefined;
  }) => { databaseName: string; childEnv: NodeJS.ProcessEnv };
  parseCli: (argv: readonly string[]) => {
    command: "migrate" | "seed";
    migrateSubcommand?: "deploy" | "status";
    explicit: {
      DATABASE_URL?: string;
      TEST_DATABASE_URL?: string;
      TEST_MIGRATION_DATABASE_URL?: string;
    };
  };
  runR1P04DatabaseCommand: (
    argv: readonly string[],
    options?: {
      spawnImpl?: (...args: unknown[]) => { status: number; error: undefined };
      log?: (message: string) => void;
    },
  ) => number;
};

const SECRET = "super-secret-password-should-never-leak";

function urlFor(databaseName: string): string {
  return `postgresql://user:${SECRET}@localhost:5432/${databaseName}`;
}

function messageOf(run: () => unknown): string {
  try {
    run();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("r1-p04-database-command (T113)", () => {
  it("rejects missing explicit database URLs (no .env fallback)", () => {
    const message = messageOf(() =>
      buildValidatedChildEnvironment({
        DATABASE_URL: undefined,
        TEST_DATABASE_URL: undefined,
        TEST_MIGRATION_DATABASE_URL: undefined,
      }),
    );
    expect(message).toMatch(/Missing explicit database target/u);
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain("postgresql://");
  });

  it("rejects Cleanora", () => {
    const cleanora = urlFor("Cleanora");
    expect(() =>
      buildValidatedChildEnvironment({
        DATABASE_URL: cleanora,
        TEST_DATABASE_URL: cleanora,
        TEST_MIGRATION_DATABASE_URL: cleanora,
      }),
    ).toThrow(/Rejected unsafe test database name 'Cleanora'/u);
  });

  it("rejects R1-P02 CI targets", () => {
    const ci = urlFor("cleanora_r1_p02_ci");
    expect(() =>
      buildValidatedChildEnvironment({
        DATABASE_URL: ci,
        TEST_DATABASE_URL: ci,
        TEST_MIGRATION_DATABASE_URL: ci,
      }),
    ).toThrow(/Rejected unsafe test database name/u);
  });

  it("rejects production-like and Railway-like targets", () => {
    for (const name of ["cleanora_production", "cleanora_railway_preview"]) {
      const url = urlFor(name);
      expect(() =>
        buildValidatedChildEnvironment({
          DATABASE_URL: url,
          TEST_DATABASE_URL: url,
          TEST_MIGRATION_DATABASE_URL: url,
        }),
      ).toThrow(/Rejected unsafe test database name/u);
    }
  });

  it("rejects pooled/direct mismatches", () => {
    expect(() =>
      buildValidatedChildEnvironment({
        DATABASE_URL: urlFor("cleanora_r1_p04_clean_proof"),
        TEST_DATABASE_URL: urlFor("cleanora_r1_p04_clean_proof"),
        TEST_MIGRATION_DATABASE_URL: urlFor("cleanora_r1_p04_other_proof"),
      }),
    ).toThrow(/must refer to the same R1-P04 proof database name/u);
  });

  it("accepts a valid R1-P04 proof database", () => {
    const approved = urlFor("cleanora_r1_p04_clean_proof");
    expect(
      buildValidatedChildEnvironment({
        DATABASE_URL: approved,
        TEST_DATABASE_URL: approved,
        TEST_MIGRATION_DATABASE_URL: approved,
      }),
    ).toEqual({
      databaseName: "cleanora_r1_p04_clean_proof",
      childEnv: expect.objectContaining({
        DATABASE_URL: approved,
        TEST_DATABASE_URL: approved,
        TEST_MIGRATION_DATABASE_URL: approved,
        TEST_DATABASE_HAS_R1_P04: "true",
      }),
    });
  });

  it("keeps credentials and complete URLs out of error messages", () => {
    const message = messageOf(() =>
      buildValidatedChildEnvironment({
        DATABASE_URL: urlFor("Cleanora"),
        TEST_DATABASE_URL: urlFor("Cleanora"),
        TEST_MIGRATION_DATABASE_URL: urlFor("Cleanora"),
      }),
    );
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain("postgresql://");
  });

  it("does not launch Prisma when validation fails", () => {
    const spawnImpl = vi.fn(() => ({ status: 0, error: undefined }));
    expect(() =>
      runR1P04DatabaseCommand(
        ["migrate", "deploy", `--database-url=${urlFor("Cleanora")}`],
        { spawnImpl },
      ),
    ).toThrow();
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("propagates child process failures", () => {
    const approved = urlFor("cleanora_r1_p04_clean_proof");
    const spawnImpl = vi.fn(() => ({ status: 7, error: undefined }));
    const status = runR1P04DatabaseCommand(
      [
        "seed",
        `--database-url=${approved}`,
        `--test-database-url=${approved}`,
        `--test-migration-database-url=${approved}`,
      ],
      { spawnImpl, log: () => undefined },
    );
    expect(status).toBe(7);
    expect(spawnImpl).toHaveBeenCalledOnce();
  });

  it("parses migrate deploy CLI shape", () => {
    const approved = urlFor("cleanora_r1_p04_clean_proof");
    expect(
      parseCli([
        "migrate",
        "deploy",
        `--database-url=${approved}`,
        `--test-database-url=${approved}`,
        `--test-migration-database-url=${approved}`,
      ]),
    ).toMatchObject({
      command: "migrate",
      migrateSubcommand: "deploy",
    });
  });
});

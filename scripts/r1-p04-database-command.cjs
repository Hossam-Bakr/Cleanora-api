"use strict";

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const {
  parseDatabaseName,
  requireR1P04TestDatabase,
} = require("./r1-p04-test-database.cjs");

const USAGE = `Usage:
  node scripts/r1-p04-database-command.cjs migrate deploy \\
    --database-url=<url> --test-database-url=<url> --test-migration-database-url=<url>
  node scripts/r1-p04-database-command.cjs migrate status \\
    --database-url=<url> --test-database-url=<url> --test-migration-database-url=<url>
  node scripts/r1-p04-database-command.cjs seed \\
    --database-url=<url> --test-database-url=<url> --test-migration-database-url=<url>

All database URLs must be supplied explicitly on the command line.
This runner never loads .env and never falls back to ambient DATABASE_URL.`;

/**
 * @param {string[]} argv
 * @returns {{
 *   command: "migrate" | "seed",
 *   migrateSubcommand?: "deploy" | "status",
 *   explicit: {
 *     DATABASE_URL?: string,
 *     TEST_DATABASE_URL?: string,
 *     TEST_MIGRATION_DATABASE_URL?: string,
 *   },
 * }}
 */
function parseCli(argv) {
  const positional = [];
  const explicit = {
    DATABASE_URL: undefined,
    TEST_DATABASE_URL: undefined,
    TEST_MIGRATION_DATABASE_URL: undefined,
  };

  for (const arg of argv) {
    if (arg.startsWith("--database-url=")) {
      explicit.DATABASE_URL = arg.slice("--database-url=".length);
      continue;
    }
    if (arg.startsWith("--test-database-url=")) {
      explicit.TEST_DATABASE_URL = arg.slice("--test-database-url=".length);
      continue;
    }
    if (arg.startsWith("--test-migration-database-url=")) {
      explicit.TEST_MIGRATION_DATABASE_URL = arg.slice(
        "--test-migration-database-url=".length,
      );
      continue;
    }
    positional.push(arg);
  }

  if (positional[0] === "migrate") {
    const migrateSubcommand = positional[1];
    if (migrateSubcommand !== "deploy" && migrateSubcommand !== "status") {
      throw new Error("Expected migrate deploy|status");
    }
    return { command: "migrate", migrateSubcommand, explicit };
  }
  if (positional[0] === "seed") {
    return { command: "seed", explicit };
  }
  throw new Error(`Unknown command. ${USAGE}`);
}

/**
 * @param {{
 *   DATABASE_URL?: string,
 *   TEST_DATABASE_URL?: string,
 *   TEST_MIGRATION_DATABASE_URL?: string,
 * }} explicit
 * @returns {{ databaseName: string, childEnv: NodeJS.ProcessEnv }}
 */
function buildValidatedChildEnvironment(explicit) {
  const missing = [];
  if (explicit.DATABASE_URL === undefined || explicit.DATABASE_URL.length === 0) {
    missing.push("DATABASE_URL");
  }
  if (
    explicit.TEST_DATABASE_URL === undefined ||
    explicit.TEST_DATABASE_URL.length === 0
  ) {
    missing.push("TEST_DATABASE_URL");
  }
  if (
    explicit.TEST_MIGRATION_DATABASE_URL === undefined ||
    explicit.TEST_MIGRATION_DATABASE_URL.length === 0
  ) {
    missing.push("TEST_MIGRATION_DATABASE_URL");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing explicit database target(s): ${missing.join(", ")}. ` +
        "This runner does not fall back to .env or ambient process env.",
    );
  }

  const validationEnv = {
    TEST_DATABASE_HAS_R1_P04: "true",
    DATABASE_URL: explicit.DATABASE_URL,
    TEST_DATABASE_URL: explicit.TEST_DATABASE_URL,
    TEST_MIGRATION_DATABASE_URL: explicit.TEST_MIGRATION_DATABASE_URL,
  };
  const { databaseName } = requireR1P04TestDatabase(validationEnv);

  const databaseUrlName = parseDatabaseName(explicit.DATABASE_URL);
  if (databaseUrlName !== databaseName) {
    throw new Error(
      `DATABASE_URL must identify the same approved R1-P04 proof database ` +
        `(expected '${databaseName}', got '${databaseUrlName ?? "invalid"}').`,
    );
  }

  const childEnv = {
    ...process.env,
    ...validationEnv,
  };
  return { databaseName, childEnv };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} childEnv
 * @param {{ spawnImpl?: typeof spawnSync }} [options]
 */
function runChildProcess(command, args, childEnv, options = {}) {
  const spawnImpl = options.spawnImpl ?? spawnSync;
  const result = spawnImpl(command, args, {
    cwd: resolve(process.cwd()),
    env: childEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exitCode = result.status;
    return result.status;
  }
  return 0;
}

/**
 * @param {string[]} argv
 * @param {{ spawnImpl?: typeof spawnSync, log?: (message: string) => void }} [options]
 */
function runR1P04DatabaseCommand(argv, options = {}) {
  const log = options.log ?? ((message) => process.stdout.write(`${message}\n`));
  const parsed = parseCli(argv);
  const { databaseName, childEnv } = buildValidatedChildEnvironment(parsed.explicit);
  log(`R1_P04_DATABASE_TARGET ${databaseName}`);

  if (parsed.command === "migrate") {
    return runChildProcess(
      "npx",
      ["prisma", "migrate", parsed.migrateSubcommand],
      childEnv,
      options,
    );
  }

  return runChildProcess(
    "node",
    ["--conditions=development", "--import", "tsx", "scripts/seed.ts"],
    childEnv,
    options,
  );
}

if (require.main === module) {
  try {
    const status = runR1P04DatabaseCommand(process.argv.slice(2));
    process.exit(status ?? 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

module.exports = {
  USAGE,
  parseCli,
  buildValidatedChildEnvironment,
  runChildProcess,
  runR1P04DatabaseCommand,
};

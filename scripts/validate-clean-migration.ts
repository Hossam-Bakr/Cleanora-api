import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const executeFile = promisify(execFile);
const migrationName = "r1_p01_foundation_country_configuration";
const expectedTables = [
  "currencies",
  "countries",
  "app_configs",
  "country_configs",
  "audit_logs"
] as const;

async function validateMigrationFolder(): Promise<void> {
  const migrationPath = join(
    process.cwd(),
    "prisma",
    "migrations",
    migrationName,
    "migration.sql"
  );
  await access(migrationPath);
}

async function run(): Promise<void> {
  await validateMigrationFolder();
  console.info(`Validated migration folder: ${migrationName}`);
  console.info(`Expected P01 tables: ${expectedTables.join(", ")}`);

  if (process.env["DATABASE_URL"] === undefined) {
    console.info(
      "DATABASE_URL is not set; skipped migrate deploy. Use an empty PostgreSQL database for clean-apply validation."
    );
    return;
  }

  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  await executeFile(npxCommand, ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env
  });
  console.info("Applied repository migrations. Verify the listed P01 tables on the clean database.");
}

void run().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Clean migration validation failed";
  console.error(`Clean migration validation failed: ${message}`);
  process.exitCode = 1;
});

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const executeFile = promisify(execFile);
const migrationName = "r1_p01_foundation_country_configuration";
const expectedTables = [
  "currencies",
  "countries",
  "app_configs",
  "country_configs",
  "audit_logs"
] as const;
const expectedPostDeployTables = ["_prisma_migrations", ...expectedTables] as const;
const destructivePattern =
  /\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i;

export interface MigrationHistoryRow {
  readonly migration_name: string;
  readonly finished_at: Date | null;
  readonly rolled_back_at: Date | null;
}

/** Refuse production-looking URLs before any database connection is attempted. */
export function assertSafeCleanTestDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"]
): void {
  if (runtimeEnvironment === "production") {
    throw new Error("Clean migration validation is forbidden in production");
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("CI_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("CI_DATABASE_URL must use the PostgreSQL protocol");
  }

  const targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  const targetDescriptor = `${url.hostname}/${targetName}`.toLowerCase();
  if (/(^|[._/-])prod(uction)?([._/-]|$)/u.test(targetDescriptor)) {
    throw new Error("CI_DATABASE_URL looks like a production target");
  }

  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(
    url.hostname.toLowerCase()
  );
  if (
    !isLocalHost &&
    !/(^|[._/-])(test|ci|clean|proof|r1[_-]?p01)([._/-]|$)/u.test(
      targetName.toLowerCase()
    )
  ) {
    throw new Error(
      "Remote CI_DATABASE_URL must name an explicit test, CI, clean, or proof database"
    );
  }
}

/** Refuse to apply migrations to a database that is not demonstrably empty. */
export function assertDatabaseEmpty(tableNames: readonly string[]): void {
  if (tableNames.length > 0) {
    throw new Error(
      `Clean migration target must be empty before deploy; found tables: ${tableNames.join(", ")}`
    );
  }
}

/** Require the exact phase-owned schema plus Prisma's migration metadata. */
export function assertExactPostDeployTables(
  tableNames: readonly string[]
): void {
  const actual = new Set(tableNames);
  const expected = new Set<string>(expectedPostDeployTables);
  const missing = [...expected].filter((table) => !actual.has(table));
  const unexpected = [...actual].filter((table) => !expected.has(table));

  if (missing.length > 0) {
    throw new Error(`Post-deploy schema is missing tables: ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    throw new Error(
      `Post-deploy schema contains unexpected tables: ${unexpected.join(", ")}`
    );
  }
}

/** Require one successful, non-rolled-back history row for this phase. */
export function assertAppliedMigration(
  rows: readonly MigrationHistoryRow[]
): void {
  const applied = rows.filter(
    (row) =>
      row.migration_name === migrationName &&
      row.finished_at !== null &&
      row.rolled_back_at === null
  );

  if (applied.length !== 1) {
    throw new Error(
      `Migration history must contain one successful ${migrationName} row; found ${String(applied.length)}`
    );
  }
}

async function validateMigrationFolder(): Promise<void> {
  const migrationPath = join(
    process.cwd(),
    "prisma",
    "migrations",
    migrationName,
    "migration.sql"
  );
  await access(migrationPath);
  const sql = await readFile(migrationPath, "utf8");

  if (destructivePattern.test(sql)) {
    throw new Error(
      `Migration ${migrationName} contains unexplained destructive SQL`
    );
  }

  for (const table of expectedTables) {
    if (!sql.includes(`"${table}"`)) {
      throw new Error(`Migration SQL is missing expected table ${table}`);
    }
  }
}

async function readPublicBaseTables(
  prisma: PrismaClient
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((row) => row.table_name);
}

async function assertTargetDatabaseEmpty(
  connectionString: string
): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });

  try {
    assertDatabaseEmpty(await readPublicBaseTables(prisma));
  } finally {
    await prisma.$disconnect();
  }
}

async function assertPostDeployState(
  connectionString: string
): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });

  try {
    assertExactPostDeployTables(await readPublicBaseTables(prisma));
    const history = await prisma.$queryRaw<MigrationHistoryRow[]>`
      SELECT
        migration_name::text AS migration_name,
        finished_at,
        rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = ${migrationName}
    `;
    assertAppliedMigration(history);
  } finally {
    await prisma.$disconnect();
  }
}

async function run(): Promise<void> {
  await validateMigrationFolder();
  console.info(`Validated migration folder: ${migrationName}`);
  console.info(`Expected P01 tables: ${expectedTables.join(", ")}`);
  console.info("SQL review: no DROP TABLE / TRUNCATE / DELETE FROM detected");

  const connectionString = process.env["CI_DATABASE_URL"];
  if (connectionString === undefined || connectionString.length === 0) {
    console.info(
      "CI_DATABASE_URL is not set; skipped clean-apply database proof."
    );
    return;
  }

  assertSafeCleanTestDatabaseUrl(connectionString);
  await assertTargetDatabaseEmpty(connectionString);

  const prismaCli = join(
    process.cwd(),
    "node_modules",
    "prisma",
    "build",
    "index.js"
  );
  await executeFile(
    process.execPath,
    [prismaCli, "migrate", "deploy"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString }
    }
  );
  await assertPostDeployState(connectionString);
  console.info(
    "Applied the phase migration and verified exact tables plus migration history."
  );
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Clean migration validation failed";
    console.error(`Clean migration validation failed: ${message}`);
    process.exitCode = 1;
  });
}

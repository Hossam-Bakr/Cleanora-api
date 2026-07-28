import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const executeFile = promisify(execFile);
const migrationNames = [
  'r1_p01_foundation_country_configuration',
  'r1_p02_complete_authentication',
  'r1_p02_fix_phone_e164_constraint',
  'r1_p02_google_provider_profile_claims'
] as const;
const expectedTables = [
  "currencies",
  "countries",
  "app_configs",
  "country_configs",
  "audit_logs",
  'users',
  'user_credentials',
  'user_sessions',
  'otp_codes',
  'password_reset_tokens',
  'social_accounts',
  'auth_events'
] as const;
const expectedPostDeployTables = ["_prisma_migrations", ...expectedTables] as const;
const destructivePattern =
  /\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i;
const expectedForwardMigrationSql = 'ALTER TABLE users DROP CONSTRAINT users_phone_e164_check; ALTER TABLE users ADD CONSTRAINT users_phone_e164_check CHECK (phone_e164 IS NULL OR phone_e164 ~ \'^\\+[1-9][0-9]{1,14}$\');';
const expectedGoogleProfileClaimsSql =
  'ALTER TABLE "social_accounts" ADD COLUMN "provider_display_name" VARCHAR(200), ADD COLUMN "provider_avatar_url" VARCHAR(2048);';

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
    !/(^|[._/-])(test|ci|clean|proof|r1[_-]?p0[12])([._/-]|$)/u.test(
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

/** Accept only the reviewed E.164 constraint replacement, with no ignored text. */
export function assertForwardMigrationSql(sql: string): void {
  if (destructivePattern.test(sql)) throw new Error('E.164 forward migration contains destructive SQL');
  const normalized = sql.replace(/\s+/gu, ' ').trim();
  if (normalized !== expectedForwardMigrationSql) throw new Error('E.164 forward migration contains unrelated SQL');
}

/** Accept only the two reviewed nullable Google presentation-claim columns. */
export function assertGoogleProfileClaimsMigrationSql(sql: string): void {
  if (destructivePattern.test(sql)) {
    throw new Error("Google profile-claims migration contains destructive SQL");
  }
  const normalized = sql.replace(/\s+/gu, " ").trim();
  if (normalized !== expectedGoogleProfileClaimsSql) {
    throw new Error("Google profile-claims migration contains unrelated SQL");
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

/** Require one successful, non-rolled-back history row for each phase. */
export function assertAppliedMigration(
  rows: readonly MigrationHistoryRow[]
): void {
  for (const migrationName of migrationNames) {
    const applied = rows.filter((row) => row.migration_name === migrationName && row.finished_at !== null && row.rolled_back_at === null);
    if (applied.length !== 1) throw new Error(`Migration history must contain one successful ${migrationName} row; found ${String(applied.length)}`);
  }
}

async function validateMigrationFolder(): Promise<void> {
  for (const migrationName of migrationNames) {
    const migrationPath = join(process.cwd(), 'prisma', 'migrations', migrationName, 'migration.sql');
    await access(migrationPath);
    const sql = await readFile(migrationPath, 'utf8');
    if (destructivePattern.test(sql)) throw new Error(`Migration ${migrationName} contains unexplained destructive SQL`);
    if (migrationName === 'r1_p02_fix_phone_e164_constraint') {
      assertForwardMigrationSql(sql);
      continue;
    }
    if (migrationName === "r1_p02_google_provider_profile_claims") {
      assertGoogleProfileClaimsMigrationSql(sql);
      continue;
    }
    const ownedTables = migrationName.includes('p01') ? expectedTables.slice(0, 5) : expectedTables.slice(5);
    for (const table of ownedTables) {
      if (!sql.includes(`"${table}"`)) throw new Error(`Migration ${migrationName} is missing expected table ${table}`);
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
      WHERE migration_name IN (${migrationNames[0]}, ${migrationNames[1]}, ${migrationNames[2]}, ${migrationNames[3]})
    `;
    assertAppliedMigration(history);
  } finally {
    await prisma.$disconnect();
  }
}

async function run(): Promise<void> {
  await validateMigrationFolder();
  console.info(`Validated migration folders: ${migrationNames.join(', ')}`);
  console.info(`Expected product tables: ${expectedTables.join(', ')}`);
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

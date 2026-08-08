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
  'r1_p02_google_provider_profile_claims',
  'r1_p03_roles_permissions_privileged_audit',
  'r1_p04_customer_profiles_preferences_text_addresses',
  'r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage'
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
  'auth_events',
  "roles",
  "permissions",
  "role_permissions",
  "user_roles",
  "privileged_action_reasons",
  "customer_profiles",
  "individual_profiles",
  "company_profiles",
  "engineer_profiles",
  "user_preferences",
  "user_addresses",
  "privacy_requests",
  "media_files"
] as const;
/** Tables each table-creating migration is allowed and required to create. */
const migrationOwnedTables: Readonly<Record<string, readonly string[]>> = {
  r1_p01_foundation_country_configuration: [
    "currencies",
    "countries",
    "app_configs",
    "country_configs",
    "audit_logs"
  ],
  r1_p02_complete_authentication: [
    "users",
    "user_credentials",
    "user_sessions",
    "otp_codes",
    "password_reset_tokens",
    "social_accounts",
    "auth_events"
  ],
  r1_p03_roles_permissions_privileged_audit: [
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    "privileged_action_reasons"
  ],
  r1_p04_customer_profiles_preferences_text_addresses: [
    "media_files",
    "customer_profiles",
    "individual_profiles",
    "company_profiles",
    "engineer_profiles",
    "user_preferences",
    "user_addresses",
    "privacy_requests"
  ]
};
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
    throw new Error("TEST_MIGRATION_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_MIGRATION_DATABASE_URL must use the PostgreSQL protocol");
  }

  const targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  const targetDescriptor = `${url.hostname}/${targetName}`.toLowerCase();
  if (/(^|[._/-])prod(uction)?([._/-]|$)/u.test(targetDescriptor)) {
    throw new Error("TEST_MIGRATION_DATABASE_URL looks like a production target");
  }

  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(
    url.hostname.toLowerCase()
  );
  if (
    !isLocalHost &&
    !/(^|[._/-])(test|clean|proof|r1[_-]?p0[12])([._/-]|$)/u.test(
      targetName.toLowerCase()
    )
  ) {
    throw new Error(
      "Remote TEST_MIGRATION_DATABASE_URL must name an explicit test, clean, or proof database"
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

/**
 * Accept only the five identity authorization tables. R1-P03 must not change
 * admin-owned audit persistence or any earlier-phase table.
 */
export function assertAuthorizationCatalogMigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(COLUMN|CONSTRAINT|TYPE)\b/i.test(sql)) {
    throw new Error(
      "R1-P03 authorization migration contains destructive SQL"
    );
  }
  if (sql.includes("audit_logs")) {
    throw new Error(
      "R1-P03 authorization migration must not change admin-owned audit_logs"
    );
  }
  for (const table of migrationOwnedTables[
    "r1_p03_roles_permissions_privileged_audit"
  ] ?? []) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(
        `R1-P03 authorization migration is missing table ${table}`
      );
    }
  }
  const createdTables = sql.match(/CREATE TABLE/g) ?? [];
  if (createdTables.length !== 5) {
    throw new Error(
      `R1-P03 authorization migration must create exactly five tables; found ${String(createdTables.length)}`
    );
  }
}

/**
 * Accept only the eight R1-P04 customers/media tables. Must not change
 * admin-owned audit persistence, authentication catalog tables, or earlier
 * phase objects.
 */
export function assertCustomerProfilesMigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(COLUMN|CONSTRAINT|TYPE)\b/i.test(sql)) {
    throw new Error(
      "R1-P04 customer profiles migration contains destructive SQL"
    );
  }
  if (sql.includes("audit_logs")) {
    throw new Error(
      "R1-P04 customer profiles migration must not change admin-owned audit_logs"
    );
  }
  for (const table of migrationOwnedTables[
    "r1_p04_customer_profiles_preferences_text_addresses"
  ] ?? []) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(
        `R1-P04 customer profiles migration is missing table ${table}`
      );
    }
  }
  const createdTables = sql.match(/CREATE TABLE/g) ?? [];
  if (createdTables.length !== 8) {
    throw new Error(
      `R1-P04 customer profiles migration must create exactly eight tables; found ${String(createdTables.length)}`
    );
  }
  if (!sql.includes("privacy_requests_one_active_per_purpose")) {
    throw new Error(
      "R1-P04 customer profiles migration is missing the active privacy partial unique index"
    );
  }
  if (!sql.includes("PRIVACY_REQUEST_REASSIGN")) {
    throw new Error(
      "R1-P04 customer profiles migration must extend PrivilegedActionOperation"
    );
  }
  if (/FOREIGN KEY\s*\(\s*"processor_id"\s*\)/i.test(sql)) {
    throw new Error(
      "R1-P04 customer profiles migration must not add a processor_id foreign key"
    );
  }
}

/**
 * Accept only the reviewed Cloudinary profile-image storage repair SQL.
 * Must not recreate customers tables or change admin-owned audit persistence.
 */
export function assertCloudinaryProfileImageStorageMigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(TABLE|COLUMN|CONSTRAINT|TYPE)\b/i.test(sql)) {
    throw new Error(
      "R1-P04 Cloudinary profile-image storage migration contains destructive SQL"
    );
  }
  if (sql.includes("audit_logs")) {
    throw new Error(
      "R1-P04 Cloudinary profile-image storage migration must not change admin-owned audit_logs"
    );
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length > 0) {
    throw new Error(
      "R1-P04 Cloudinary profile-image storage migration must not create tables"
    );
  }
  if (!sql.includes('"MediaStorageProvider"')) {
    throw new Error(
      "R1-P04 Cloudinary profile-image storage migration is missing MediaStorageProvider"
    );
  }
  if (!sql.includes("PENDING_UPLOAD")) {
    throw new Error(
      "R1-P04 Cloudinary profile-image storage migration is missing PENDING_UPLOAD"
    );
  }
  if (!sql.includes("storage_provider")) {
    throw new Error(
      "R1-P04 Cloudinary profile-image storage migration is missing storage_provider"
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
    if (migrationName === "r1_p03_roles_permissions_privileged_audit") {
      assertAuthorizationCatalogMigrationSql(sql);
      continue;
    }
    if (migrationName === "r1_p04_customer_profiles_preferences_text_addresses") {
      assertCustomerProfilesMigrationSql(sql);
      continue;
    }
    if (
      migrationName ===
      "r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage"
    ) {
      assertCloudinaryProfileImageStorageMigrationSql(sql);
      continue;
    }
    for (const table of migrationOwnedTables[migrationName] ?? []) {
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
      WHERE migration_name IN (${migrationNames[0]}, ${migrationNames[1]}, ${migrationNames[2]}, ${migrationNames[3]}, ${migrationNames[4]}, ${migrationNames[5]}, ${migrationNames[6]})
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

  const connectionString = process.env["TEST_MIGRATION_DATABASE_URL"];
  if (connectionString === undefined || connectionString.length === 0) {
    console.info(
      "TEST_MIGRATION_DATABASE_URL is not set; skipped clean-apply database proof."
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

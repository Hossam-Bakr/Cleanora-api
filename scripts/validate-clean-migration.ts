import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { seed } from "../prisma/seed.js";

const executeFile = promisify(execFile);
const migrationNames = [
  'r1_p01_foundation_country_configuration',
  'r1_p02_complete_authentication',
  'r1_p02_email_verification_for_individuals',
  'r1_p02_fix_phone_e164_constraint',
  'r1_p02_google_provider_profile_claims',
  'r1_p03_roles_permissions_privileged_audit',
  'r1_p03a_production_role_provisioning',
  'r1_p03a_production_role_provisioning_drop',
  'r1_p04_customer_profiles_preferences_text_addresses',
  'r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage',
  'r1_p04a_category_aware_customer_signup_verification',
  'r1_p05_provider_onboarding_profile_lifecycle'
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
  "media_files",
  "providers",
  "provider_profiles",
  "provider_contacts",
  "provider_status_history",
  "provider_members",
  "provider_admin_invitations",
  "provider_gallery_items",
  "provider_email_outbox"
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
  ],
  r1_p05_provider_onboarding_profile_lifecycle: [
    "providers",
    "provider_profiles",
    "provider_contacts",
    "provider_status_history",
    "provider_members",
    "provider_admin_invitations",
    "provider_gallery_items",
    "provider_email_outbox"
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

/** Accept only the reviewed nullable R1-P04A Company profile additions. */
export function assertCategoryAwareSignupMigrationSql(sql: string): void {
  if (
    destructivePattern.test(sql) ||
    /\bDROP\s+(TABLE|COLUMN|CONSTRAINT|TYPE)\b/iu.test(sql) ||
    /\bCREATE\s+TABLE\b/iu.test(sql) ||
    /\bNOT\s+NULL\b/iu.test(sql) ||
    /\bDEFAULT\b/iu.test(sql)
  ) {
    throw new Error('R1-P04A signup migration contains destructive or backfill-implying SQL');
  }
  if (sql.includes('audit_logs')) {
    throw new Error('R1-P04A signup migration must not change admin-owned audit_logs');
  }
  const normalized = sql.replace(/--[^\r\n]*/gu, '').replace(/\s+/gu, ' ').trim();
  const expected =
    'ALTER TABLE "company_profiles" ADD COLUMN "commercial_registration_number" VARCHAR(100), ADD COLUMN "tax_registration_number" VARCHAR(100);';
  if (normalized !== expected) {
    throw new Error('R1-P04A signup migration contains missing or unrelated SQL');
  }
}

/**
 * Accept only the eight R1-P05 Provider tables plus the reviewed Auth/Media
 * forward changes (nullable invitation OTP category, deliberate nonempty-category
 * drop, and Provider media enum extensions). No DROP TABLE of product tables.
 */
export function assertR1P05MigrationSql(sql: string): void {
  if (destructivePattern.test(sql)) {
    throw new Error("R1-P05 provider migration contains unexplained destructive SQL");
  }
  if (sql.includes("audit_logs")) {
    throw new Error(
      "R1-P05 provider migration must not change admin-owned audit_logs"
    );
  }
  for (const table of migrationOwnedTables[
    "r1_p05_provider_onboarding_profile_lifecycle"
  ] ?? []) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P05 provider migration is missing table ${table}`);
    }
  }
  const createdTables = sql.match(/CREATE TABLE/g) ?? [];
  if (createdTables.length !== 8) {
    throw new Error(
      `R1-P05 provider migration must create exactly eight tables; found ${String(createdTables.length)}`
    );
  }
  if (!sql.includes('DROP CONSTRAINT "users_categories_nonempty_check"')) {
    throw new Error(
      "R1-P05 provider migration must deliberately drop users_categories_nonempty_check"
    );
  }
  if (!sql.includes('ALTER COLUMN "account_category" DROP NOT NULL')) {
    throw new Error(
      "R1-P05 provider migration must make otp_codes.account_category nullable"
    );
  }
  if (!sql.includes("otp_codes_purpose_shape_check")) {
    throw new Error(
      "R1-P05 provider migration is missing otp_codes purpose-shape CHECK"
    );
  }
  if (!sql.includes("PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION")) {
    throw new Error(
      "R1-P05 provider migration must add PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION"
    );
  }
  for (const mediaOwner of [
    "PROVIDER_LOGO",
    "PROVIDER_COVER",
    "PROVIDER_GALLERY_IMAGE",
    "PROVIDER_GALLERY_VIDEO"
  ] as const) {
    if (!sql.includes(mediaOwner)) {
      throw new Error(
        `R1-P05 provider migration is missing MediaOwnerType value ${mediaOwner}`
      );
    }
  }
  if (!sql.includes("PROCESSING") || !sql.includes("FAILED")) {
    throw new Error(
      "R1-P05 provider migration must extend MediaStatus with PROCESSING and FAILED"
    );
  }
  if (!sql.includes("provider_members_one_owner_per_provider")) {
    throw new Error(
      "R1-P05 provider migration is missing one-OWNER partial unique index"
    );
  }
  if (!sql.includes("provider_admin_invitations_one_pending_per_email")) {
    throw new Error(
      "R1-P05 provider migration is missing pending-invitation partial unique index"
    );
  }
  if (!sql.includes("provider_status_history_one_submission_per_cycle")) {
    throw new Error(
      "R1-P05 provider migration is missing one-submission-per-cycle partial unique index"
    );
  }
  if (!sql.includes("ON DELETE RESTRICT")) {
    throw new Error(
      "R1-P05 provider migration must use ON DELETE RESTRICT for evidence FKs"
    );
  }
  if (/\bON DELETE CASCADE\b/i.test(sql)) {
    throw new Error(
      "R1-P05 provider migration must not cascade-delete Provider evidence"
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
  const expected = new Set<string>(migrationNames);
  const unexpected = rows
    .map((row) => row.migration_name)
    .filter((name) => !expected.has(name));
  if (unexpected.length > 0) {
    throw new Error(
      `Migration history contains unexpected rows: ${[...new Set(unexpected)].join(", ")}`,
    );
  }
  for (const migrationName of migrationNames) {
    const applied = rows.filter((row) => row.migration_name === migrationName && row.finished_at !== null && row.rolled_back_at === null);
    if (applied.length !== 1) throw new Error(`Migration history must contain one successful ${migrationName} row; found ${String(applied.length)}`);
  }
}

export function assertExactMigrationDirectoryNames(
  directoryNames: readonly string[],
): void {
  const expected = new Set<string>(migrationNames);
  const actual = new Set(directoryNames);
  const missing = [...expected].filter((name) => !actual.has(name));
  const unexpected = [...actual].filter((name) => !expected.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Migration directories differ; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`,
    );
  }
}

async function validateMigrationFolder(): Promise<void> {
  const entries = await readdir(join(process.cwd(), "prisma", "migrations"), {
    withFileTypes: true,
  });
  assertExactMigrationDirectoryNames(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  );
  for (const migrationName of migrationNames) {
    const migrationPath = join(process.cwd(), 'prisma', 'migrations', migrationName, 'migration.sql');
    await access(migrationPath);
    const sql = await readFile(migrationPath, 'utf8');
    if (
      destructivePattern.test(sql) &&
      migrationName !== "r1_p03a_production_role_provisioning_drop"
    ) throw new Error(`Migration ${migrationName} contains unexplained destructive SQL`);
    if (migrationName === "r1_p03a_production_role_provisioning_drop") {
      const approvedDropOne =
        'DROP TABLE IF EXISTS "staff_admin_bootstrap_authorization_uses"';
      const approvedDropTwo =
        'DROP TABLE IF EXISTS "staff_admin_bootstrap_closures"';
      if (
        !sql.includes(approvedDropOne) ||
        !sql.includes(approvedDropTwo) ||
        destructivePattern.test(
          sql.replace(approvedDropOne, "").replace(approvedDropTwo, ""),
        )
      ) {
        throw new Error("R1-P03A cleanup migration contains an unapproved drop");
      }
      continue;
    }
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
    if (migrationName === 'r1_p04a_category_aware_customer_signup_verification') {
      assertCategoryAwareSignupMigrationSql(sql);
      continue;
    }
    if (migrationName === 'r1_p05_provider_onboarding_profile_lifecycle') {
      assertR1P05MigrationSql(sql);
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
    WHERE table_schema = current_schema()
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
    `;
    assertAppliedMigration(history);
    await seed(prisma);
    const firstSeedCounts = await readSeedCounts(prisma);
    await seed(prisma);
    const secondSeedCounts = await readSeedCounts(prisma);
    if (JSON.stringify(firstSeedCounts) !== JSON.stringify(secondSeedCounts)) {
      throw new Error("Seed is not idempotent across two consecutive runs");
    }
    await probeR1P05Constraints(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function readSeedCounts(prisma: PrismaClient): Promise<{
  readonly roles: number;
  readonly permissions: number;
  readonly rolePermissions: number;
  readonly privilegedReasons: number;
  readonly countries: number;
  readonly currencies: number;
}> {
  const [roles, permissions, rolePermissions, privilegedReasons, countries, currencies] =
    await Promise.all([
      prisma.role.count(),
      prisma.permission.count(),
      prisma.rolePermission.count(),
      prisma.privilegedActionReason.count(),
      prisma.country.count(),
      prisma.currency.count(),
    ]);
  return { roles, permissions, rolePermissions, privilegedReasons, countries, currencies };
}

async function probeR1P05Constraints(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      INSERT INTO "users" ("id", "email_normalized", "updated_at")
      VALUES ('r1p05-proof-user', 'r1p05-proof@example.com', CURRENT_TIMESTAMP);

      BEGIN
        INSERT INTO "providers" ("id", "application_owner_user_id", "kind", "version", "updated_at")
        VALUES ('r1p05-invalid-provider', 'r1p05-proof-user', 'INDIVIDUAL_TEAM', 0, CURRENT_TIMESTAMP);
        RAISE EXCEPTION 'providers_counters_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      INSERT INTO "providers" ("id", "application_owner_user_id", "kind", "updated_at")
      VALUES ('r1p05-proof-provider', 'r1p05-proof-user', 'INDIVIDUAL_TEAM', CURRENT_TIMESTAMP);

      BEGIN
        INSERT INTO "provider_status_history" (
          "id", "provider_id", "domain", "from_operational_status",
          "to_operational_status", "actor_user_id"
        ) VALUES (
          'r1p05-invalid-history', 'r1p05-proof-provider', 'APPLICATION',
          'INACTIVE', 'SUSPENDED', 'r1p05-proof-user'
        );
        RAISE EXCEPTION 'provider_status_history_domain_pair_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_members" (
          "id", "provider_id", "user_id", "level", "status",
          "invited_by_user_id", "enabled_at", "updated_at"
        ) VALUES (
          'r1p05-invalid-owner', 'r1p05-proof-provider', 'r1p05-proof-user',
          'OWNER', 'ACTIVE', 'r1p05-proof-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'provider_members_owner_shape_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_admin_invitations" (
          "id", "provider_id", "email_normalized", "token_verifier",
          "token_version", "status", "version", "invited_by_user_id",
          "expires_at", "updated_at"
        ) VALUES (
          'r1p05-invalid-invitation', 'r1p05-proof-provider', 'invitee@example.com',
          repeat('a', 64), 1, 'ACCEPTED', 1, 'r1p05-proof-user',
          CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'provider_admin_invitations_status_shape_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_email_outbox" (
          "id", "provider_id", "template", "status", "recipient_user_id",
          "idempotency_key", "attempt_count", "updated_at"
        ) VALUES (
          'r1p05-invalid-outbox', 'r1p05-proof-provider', 'APPROVED', 'PENDING',
          'r1p05-proof-user', 'r1p05-invalid-outbox', -1, CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'provider_email_outbox_attempt_count_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "otp_codes" (
          "id", "user_id", "account_category", "purpose", "channel",
          "destination_hash", "code_verifier", "resend_available_at", "expires_at"
        ) VALUES (
          'r1p05-invalid-otp', 'r1p05-proof-user', 'INDIVIDUAL',
          'PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION', 'EMAIL',
          repeat('b', 64), repeat('c', 64), CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + INTERVAL '10 minutes'
        );
        RAISE EXCEPTION 'otp_codes_purpose_shape_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      DELETE FROM "providers" WHERE "id" = 'r1p05-proof-provider';
      DELETE FROM "users" WHERE "id" = 'r1p05-proof-user';
    END $$;
  `);
}

async function run(): Promise<void> {
  await validateMigrationFolder();
  console.info(`Validated migration folders: ${migrationNames.join(', ')}`);
  console.info(`Expected product tables: ${expectedTables.join(', ')}`);
  console.info("SQL review: no DROP TABLE / TRUNCATE / DELETE FROM detected");

  const configuredConnectionString = process.env["TEST_MIGRATION_DATABASE_URL"];
  if (configuredConnectionString === undefined || configuredConnectionString.length === 0) {
    throw new Error(
      "TEST_MIGRATION_DATABASE_URL is required for clean-apply database proof."
    );
  }

  assertSafeCleanTestDatabaseUrl(configuredConnectionString);
  const proofUrl = new URL(configuredConnectionString);
  const proofSchema = `cleanora_r1_p05_proof_${process.pid}_${Date.now()}`;
  proofUrl.searchParams.set("schema", proofSchema);
  proofUrl.searchParams.set("options", `-c search_path=${proofSchema}`);
  const connectionString = proofUrl.toString();
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
    `Applied all migrations in isolated schema ${proofSchema}; verified exact tables, full history, double-seed idempotency, and live R1-P05 constraint probes.`,
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

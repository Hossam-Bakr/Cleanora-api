import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { seed } from "../prisma/seed.js";
import { PrismaPayoutRevealAuditGate } from "../src/modules/admin/infrastructure/prisma-payout-reveal-audit.gate.js";
import { PrismaProviderPayoutRepository } from "../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";

const executeFile = promisify(execFile);
const MIGRATION_PROBE_TRANSACTION_OPTIONS = {
  maxWait: 120_000,
  timeout: 120_000,
} as const;
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
  'r1_p05_provider_onboarding_profile_lifecycle',
  'r1_p06_provider_verification_external_payout_destinations',
  'r1_p07_worker_team_crew_management',
  'r1_p08_catalog_localization_service_requirements'
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
  "provider_email_outbox",
  "sensitive_action_proof_uses",
  "verification_document_types",
  "verification_document_policy_versions",
  "verification_document_policy_items",
  "provider_policy_activation_states",
  "provider_document_chains",
  "provider_document_versions",
  "provider_document_evidence",
  "provider_document_reviews",
  "provider_verification_history",
  "payout_destination_types",
  "payout_operators",
  "payout_banks",
  "payout_country_policies",
  "provider_payout_destination_chains",
  "provider_payout_identity_claims",
  "provider_payout_lookup_fingerprints",
  "provider_payout_destination_versions",
  "provider_payout_decisions",
  "provider_primary_payout_destinations",
  "provider_payout_conflicts",
  "provider_payout_history",
  "provider_payout_key_rotation_runs",
  "provider_workers",
  "provider_worker_profiles",
  "provider_worker_skills",
  "provider_worker_login_access",
  "provider_worker_invitations",
  "provider_teams",
  "provider_team_memberships",
  "provider_workforce_history",
  "provider_workforce_commands",
  "provider_workforce_notification_intents",
  "service_categories",
  "services",
  "service_translations",
  "service_price_units",
  "service_fields",
  "service_field_options",
  "service_country_availability",
  "service_media_associations",
  "catalog_command_requests"
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
  ],
  r1_p06_provider_verification_external_payout_destinations: [
    "sensitive_action_proof_uses",
    "verification_document_types",
    "verification_document_policy_versions",
    "verification_document_policy_items",
    "provider_policy_activation_states",
    "provider_document_chains",
    "provider_document_versions",
    "provider_document_evidence",
    "provider_document_reviews",
    "provider_verification_history",
    "payout_destination_types",
    "payout_operators",
    "payout_banks",
    "payout_country_policies",
    "provider_payout_destination_chains",
    "provider_payout_identity_claims",
    "provider_payout_lookup_fingerprints",
    "provider_payout_destination_versions",
    "provider_payout_decisions",
    "provider_primary_payout_destinations",
    "provider_payout_conflicts",
    "provider_payout_history",
    "provider_payout_key_rotation_runs"
  ],
  r1_p07_worker_team_crew_management: [
    "provider_workers",
    "provider_worker_profiles",
    "provider_worker_skills",
    "provider_worker_login_access",
    "provider_worker_invitations",
    "provider_teams",
    "provider_team_memberships",
    "provider_workforce_history",
    "provider_workforce_commands",
    "provider_workforce_notification_intents"
  ],
  r1_p08_catalog_localization_service_requirements: [
    "service_categories",
    "services",
    "service_translations",
    "service_price_units",
    "service_fields",
    "service_field_options",
    "service_country_availability",
    "service_media_associations",
    "catalog_command_requests"
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
    const matching = rows.filter((row) => row.migration_name === migrationName);
    const row = matching[0];
    if (
      matching.length !== 1 ||
      row === undefined ||
      row.finished_at === null ||
      row.rolled_back_at !== null
    ) {
      throw new Error(
        `Migration history must contain exactly one successful ${migrationName} row; found ${String(matching.length)}`,
      );
    }
  }
}

/** Build a Prisma Client that honors an isolated PostgreSQL proof schema. */
export function createMigrationProofPrismaClient(
  connectionString: string,
): PrismaClient {
  const schema = new URL(connectionString).searchParams.get("schema");
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString },
      schema === null || schema.length === 0 ? undefined : { schema },
    ),
  });
}

/** Require an explicitly named R1-P06 disposable target for this phase proof. */
export function assertR1P06DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
  const url = new URL(connectionString);
  const targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (!/(^|[._-])r1[._-]?p06([._-]|$)/u.test(targetName.toLowerCase())) {
    throw new Error(
      "R1-P06 migration proof requires an explicitly named R1-P06 disposable database",
    );
  }
}

/** Require an explicitly named R1-P07 disposable target for workforce proofs. */
export function assertR1P07DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
  const url = new URL(connectionString);
  const targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (!/(^|[._-])r1[._-]?p07([._-]|$)/u.test(targetName.toLowerCase())) {
    throw new Error(
      "R1-P07 migration proof requires an explicitly named R1-P07 disposable database",
    );
  }
}

export const APPROVED_R1_P08_TARGET_PATTERN =
  /^cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/** Require an explicitly named R1-P08 disposable target for Catalog proofs. */
export function assertR1P08DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  let targetName: string;
  try {
    const url = new URL(connectionString);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P08 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P08_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P08 database work against unapproved target "${targetName}"`,
    );
  }
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
}

/**
 * Resolve the separate R1-P08 live/proof URL under DEC-045.
 * Integration `TEST_MIGRATION_DATABASE_URL` may name the current-schema
 * R1-P04 proof and must not be reused for Catalog disposable proofs.
 */
export function requireR1P08ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P08_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P08_DATABASE_URL is required for R1-P08 disposable proofs",
    );
  }
  assertR1P08DisposableDatabaseUrl(value);
  return value;
}

/** Accept only the forward-only R1-P06 table/enums/index/constraint inventory. */
export function assertR1P06MigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(COLUMN|CONSTRAINT|TYPE)\b/iu.test(sql)) {
    throw new Error("R1-P06 provider-verification migration contains destructive SQL");
  }
  for (const table of migrationOwnedTables[
    "r1_p06_provider_verification_external_payout_destinations"
  ] ?? []) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P06 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 23) {
    throw new Error("R1-P06 migration must create exactly twenty-three tables");
  }
  for (const required of [
    "PROVIDER_VERIFICATION_DOCUMENT_PAGE",
    "provider_document_versions_one_open_successor",
    "provider_payout_destination_versions_one_open_successor",
    "provider_payout_lookup_fingerprints_active_unique",
    "verification_document_policy_versions_one_draft",
    "provider_payout_conflicts_one_open_operation",
    "MANUAL_WALLET_TRANSFER_CHECK",
    "MANUAL_BANK_BENEFICIARY_CHECK",
  ]) {
    if (!sql.includes(required)) throw new Error(`R1-P06 migration is missing ${required}`);
  }
  if (/(?:wallet_number|holder_legal_name|\biban\b)\s+/iu.test(sql)) {
    throw new Error("R1-P06 migration must not contain payout plaintext columns");
  }
  if (!sql.includes("ON DELETE RESTRICT") || /\bON DELETE CASCADE\b/iu.test(sql)) {
    throw new Error("R1-P06 evidence foreign keys must use ON DELETE RESTRICT");
  }
}

/** Accept only the additive, phase-owned R1-P07 workforce migration inventory. */
export function assertR1P07MigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(COLUMN|CONSTRAINT|TYPE)\b/iu.test(sql)) {
    throw new Error("R1-P07 workforce migration contains destructive SQL");
  }
  const tables = migrationOwnedTables["r1_p07_worker_team_crew_management"] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P07 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 10) {
    throw new Error("R1-P07 migration must create exactly ten tables");
  }
  for (const required of [
    "WORKER_PROFILE_IMAGE",
    "WORKER_INVITATION_EMAIL_VERIFICATION",
    'ADD COLUMN "workforce_state_version" INTEGER NOT NULL DEFAULT 1',
    'ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1',
    "provider_workers_current_identity_unique",
    "provider_worker_invitations_pending_unique",
    "provider_teams_non_archived_name_unique",
    "provider_team_memberships_current_worker_unique",
    "provider_workforce_commands_scope_idempotency_unique",
    "provider_team_memberships_escort_never_cleans",
    "provider_teams_primary_supervisor_valid",
    "provider_teams_active_valid",
    "provider_workers_profile_required",
    "provider_worker_login_access_invitation_same_worker",
    "provider_workforce_history_immutable",
    "DEFERRABLE INITIALLY DEFERRED",
  ]) {
    if (!sql.includes(required)) throw new Error(`R1-P07 migration is missing ${required}`);
  }
  if (!sql.includes("ON DELETE RESTRICT") || /\bON DELETE CASCADE\b/iu.test(sql)) {
    throw new Error("R1-P07 workforce foreign keys must use ON DELETE RESTRICT");
  }
}

export const R1_P08_MIGRATION = "r1_p08_catalog_localization_service_requirements";

export const R1_P08_CATALOG_TABLES = [
  "service_categories",
  "services",
  "service_translations",
  "service_price_units",
  "service_fields",
  "service_field_options",
  "service_country_availability",
  "service_media_associations",
  "catalog_command_requests",
] as const;

/** Accept only the additive, phase-owned R1-P08 Catalog migration inventory. */
export function assertR1P08MigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(COLUMN|CONSTRAINT|TYPE)\b/iu.test(sql)) {
    throw new Error("R1-P08 catalog migration contains destructive SQL");
  }
  const tables = migrationOwnedTables[R1_P08_MIGRATION] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P08 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 9) {
    throw new Error("R1-P08 migration must create exactly nine Catalog tables");
  }
  for (const required of [
    "CatalogLocale",
    "ServiceFieldKind",
    "ServiceNumberMode",
    "CatalogCommandStatus",
    "CATALOG_SERVICE_IMAGE",
    "CATALOG_MANAGEMENT_WRITE",
    "service_categories_code_format_check",
    "service_fields_information_required_check",
    "service_fields_number_mode_check",
    "catalog_command_requests_completed_shape_check",
    "service_media_associations_media_file_id_key",
    "ON DELETE RESTRICT",
  ]) {
    if (!sql.includes(required)) throw new Error(`R1-P08 migration is missing ${required}`);
  }
  if (/\bON DELETE CASCADE\b/iu.test(sql)) {
    throw new Error("R1-P08 Catalog foreign keys must not cascade-delete parent rows");
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
    if (migrationName === 'r1_p06_provider_verification_external_payout_destinations') {
      assertR1P06MigrationSql(sql);
      continue;
    }
    if (migrationName === 'r1_p07_worker_team_crew_management') {
      assertR1P07MigrationSql(sql);
      continue;
    }
    if (migrationName === R1_P08_MIGRATION) {
      assertR1P08MigrationSql(sql);
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
  const prisma = createMigrationProofPrismaClient(connectionString);

  try {
    assertDatabaseEmpty(await readPublicBaseTables(prisma));
  } finally {
    await prisma.$disconnect();
  }
}

export async function assertPostDeployState(
  connectionString: string
): Promise<void> {
  const prisma = createMigrationProofPrismaClient(connectionString);

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
    await probeR1P06Constraints(prisma);
    await probeR1P07Constraints(prisma);
    await probeR1P08Constraints(prisma);
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
  readonly verificationDocumentTypes: number;
  readonly payoutDestinationTypes: number;
  readonly serviceCategories: number;
  readonly services: number;
  readonly serviceTranslations: number;
  readonly servicePriceUnits: number;
  readonly serviceFields: number;
  readonly serviceCountryAvailability: number;
}> {
  const [
    roles,
    permissions,
    rolePermissions,
    privilegedReasons,
    countries,
    currencies,
    verificationDocumentTypes,
    payoutDestinationTypes,
    serviceCategories,
    services,
    serviceTranslations,
    servicePriceUnits,
    serviceFields,
    serviceCountryAvailability,
  ] = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.privilegedActionReason.count(),
    prisma.country.count(),
    prisma.currency.count(),
    prisma.verificationDocumentType.count(),
    prisma.payoutDestinationType.count(),
    prisma.serviceCategory.count(),
    prisma.service.count(),
    prisma.serviceTranslation.count(),
    prisma.servicePriceUnit.count(),
    prisma.serviceField.count(),
    prisma.serviceCountryAvailability.count(),
  ]);
  return {
    roles,
    permissions,
    rolePermissions,
    privilegedReasons,
    countries,
    currencies,
    verificationDocumentTypes,
    payoutDestinationTypes,
    serviceCategories,
    services,
    serviceTranslations,
    servicePriceUnits,
    serviceFields,
    serviceCountryAvailability,
  };
}

export function readDatabaseSqlState(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const record = error as Readonly<Record<string, unknown>>;
  if (record["code"] === "P2002") return "23505";
  if (record["code"] === "P2003") return "23503";
  const directCause = record["cause"];
  if (typeof directCause === "object" && directCause !== null) {
    const directCauseRecord = directCause as Readonly<Record<string, unknown>>;
    const originalCode = directCauseRecord["originalCode"];
    if (typeof originalCode === "string") return originalCode;
    const causeCode = directCauseRecord["code"];
    if (typeof causeCode === "string") return causeCode;
  }
  const meta = record["meta"];
  if (typeof meta !== "object" || meta === null) return null;
  const direct = (meta as Readonly<Record<string, unknown>>)["code"];
  if (typeof direct === "string") return direct;
  const driverAdapterError = (meta as Readonly<Record<string, unknown>>)["driverAdapterError"];
  if (typeof driverAdapterError !== "object" || driverAdapterError === null) return null;
  const cause = (driverAdapterError as Readonly<Record<string, unknown>>)["cause"];
  if (typeof cause !== "object" || cause === null) return null;
  const originalCode = (cause as Readonly<Record<string, unknown>>)["originalCode"];
  return typeof originalCode === "string" ? originalCode : null;
}

export async function expectR1P07ConstraintRejection(
  label: string,
  expectedSqlState: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (readDatabaseSqlState(error) === expectedSqlState) return;
    throw new Error(`R1-P07 database constraint rejected ${label} with an unexpected safe database code`);
  }
  throw new Error(`R1-P07 database constraint accepted ${label}`);
}

async function probeR1P07Constraints(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`
      INSERT INTO "users" (
        "id", "email_normalized", "account_categories", "verified_categories", "status", "updated_at"
      ) VALUES
        ('r1p07-proof-owner-a', 'r1p07-proof-owner-a@example.invalid', ARRAY[]::"AccountCategory"[], ARRAY[]::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP),
        ('r1p07-proof-owner-b', 'r1p07-proof-owner-b@example.invalid', ARRAY[]::"AccountCategory"[], ARRAY[]::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP);

      INSERT INTO "providers" (
        "id", "application_owner_user_id", "owner_user_id", "kind", "application_status",
        "operational_status", "approved_at", "updated_at"
      ) VALUES
        ('r1p07-proof-provider-a', 'r1p07-proof-owner-a', 'r1p07-proof-owner-a', 'INDIVIDUAL_TEAM', 'APPROVED', 'LIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('r1p07-proof-provider-b', 'r1p07-proof-owner-b', 'r1p07-proof-owner-b', 'INDIVIDUAL_TEAM', 'APPROVED', 'LIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

      INSERT INTO "provider_workers" (
        "id", "provider_id", "identity_user_id", "status", "updated_at"
      ) VALUES
        ('r1p07-proof-cleaner', 'r1p07-proof-provider-a', 'r1p07-proof-owner-a', 'ACTIVE', CURRENT_TIMESTAMP),
        ('r1p07-proof-escort', 'r1p07-proof-provider-a', NULL, 'ACTIVE', CURRENT_TIMESTAMP),
        ('r1p07-proof-foreign-worker', 'r1p07-proof-provider-b', 'r1p07-proof-owner-b', 'ACTIVE', CURRENT_TIMESTAMP);

      INSERT INTO "provider_worker_profiles" (
        "worker_id", "full_legal_name", "gender", "operational_phone_e164", "worker_type",
        "supervisor_capable", "updated_at"
      ) VALUES
        ('r1p07-proof-cleaner', 'R1-P07 Proof Cleaner', 'FEMALE', '+201000000701', 'CLEANING_STAFF', false, CURRENT_TIMESTAMP),
        ('r1p07-proof-escort', 'R1-P07 Proof Escort', 'MALE', '+201000000702', 'ESCORT', false, CURRENT_TIMESTAMP),
        ('r1p07-proof-foreign-worker', 'R1-P07 Foreign Worker', 'FEMALE', '+201000000703', 'CLEANING_STAFF', true, CURRENT_TIMESTAMP);

      INSERT INTO "provider_teams" (
        "id", "provider_id", "name", "normalized_name", "status", "updated_at"
      ) VALUES (
        'r1p07-proof-team', 'r1p07-proof-provider-a', 'R1-P07 Proof Crew',
        'r1-p07 proof crew', 'DRAFT', CURRENT_TIMESTAMP
      );

      INSERT INTO "provider_team_memberships" (
        "id", "team_id", "worker_id", "cleans", "updated_at"
      ) VALUES (
        'r1p07-proof-membership', 'r1p07-proof-team', 'r1p07-proof-cleaner', true, CURRENT_TIMESTAMP
      );

      UPDATE "provider_teams" SET "status" = 'ACTIVE', "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = 'r1p07-proof-team';

      INSERT INTO "provider_worker_invitations" (
        "id", "worker_id", "invitation_version", "email_normalized", "locale", "status",
        "issued_by_user_id", "issued_at", "expires_at", "updated_at"
      ) VALUES (
        'r1p07-proof-invitation', 'r1p07-proof-cleaner', 1,
        'r1p07-proof-worker@example.invalid', 'EN', 'PENDING', 'r1p07-proof-owner-a',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '72 hours', CURRENT_TIMESTAMP
      );

      INSERT INTO "provider_workforce_history" (
        "id", "provider_id", "target_type", "target_id", "target_version", "event_code",
        "actor_user_id", "request_id"
      ) VALUES (
        'r1p07-proof-history', 'r1p07-proof-provider-a', 'WORKER', 'r1p07-proof-cleaner',
        1, 'WORKER_CREATED', 'r1p07-proof-owner-a', 'r1p07-proof-request'
      );
    `);
  }, MIGRATION_PROBE_TRANSACTION_OPTIONS);

  await expectR1P07ConstraintRejection("a zero Provider workforce version", "23514", () =>
    prisma.$executeRawUnsafe(`UPDATE "providers" SET "workforce_state_version" = 0 WHERE "id" = 'r1p07-proof-provider-a'`));
  await expectR1P07ConstraintRejection("a Worker without its required profile", "23514", () =>
    prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
      INSERT INTO "provider_workers" ("id", "provider_id", "status", "updated_at")
      VALUES ('r1p07-proof-profileless', 'r1p07-proof-provider-a', 'DRAFT', CURRENT_TIMESTAMP)
    `), MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("a duplicate current identity engagement", "23505", () =>
    prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
      INSERT INTO "provider_workers" ("id", "provider_id", "identity_user_id", "status", "updated_at")
      VALUES ('r1p07-proof-identity-duplicate', 'r1p07-proof-provider-a', 'r1p07-proof-owner-a', 'DRAFT', CURRENT_TIMESTAMP);
      INSERT INTO "provider_worker_profiles" (
        "worker_id", "full_legal_name", "gender", "operational_phone_e164", "worker_type", "updated_at"
      ) VALUES (
        'r1p07-proof-identity-duplicate', 'R1-P07 Duplicate Identity', 'FEMALE',
        '+201000000704', 'CLEANING_STAFF', CURRENT_TIMESTAMP
      )
    `), MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("a second pending invitation", "23505", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "provider_worker_invitations" (
        "id", "worker_id", "invitation_version", "email_normalized", "locale", "status",
        "issued_by_user_id", "issued_at", "expires_at", "updated_at"
      ) VALUES (
        'r1p07-proof-invitation-duplicate', 'r1p07-proof-cleaner', 2,
        'r1p07-proof-worker@example.invalid', 'EN', 'PENDING', 'r1p07-proof-owner-a',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '72 hours', CURRENT_TIMESTAMP
      )
    `));
  await expectR1P07ConstraintRejection("a duplicate non-archived normalized Team name", "23505", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "provider_teams" ("id", "provider_id", "name", "normalized_name", "status", "updated_at")
      VALUES ('r1p07-proof-team-name-duplicate', 'r1p07-proof-provider-a', 'Duplicate', 'r1-p07 proof crew', 'DRAFT', CURRENT_TIMESTAMP)
    `));
  await expectR1P07ConstraintRejection("a second current Team membership", "23505", () =>
    prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`
        INSERT INTO "provider_teams" ("id", "provider_id", "name", "normalized_name", "status", "updated_at")
        VALUES ('r1p07-proof-team-second', 'r1p07-proof-provider-a', 'Second Crew', 'second crew', 'DRAFT', CURRENT_TIMESTAMP)
      `);
      await transaction.$executeRawUnsafe(`
        INSERT INTO "provider_team_memberships" ("id", "team_id", "worker_id", "cleans", "updated_at")
        VALUES ('r1p07-proof-membership-second', 'r1p07-proof-team-second', 'r1p07-proof-cleaner', true, CURRENT_TIMESTAMP)
      `);
    }, MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("an Escort membership with cleans=true", "23514", () =>
    prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
      INSERT INTO "provider_team_memberships" ("id", "team_id", "worker_id", "cleans", "updated_at")
      VALUES ('r1p07-proof-escort-cleans', 'r1p07-proof-team', 'r1p07-proof-escort', true, CURRENT_TIMESTAMP)
    `), MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("a cross-Provider Team membership", "23514", () =>
    prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
      INSERT INTO "provider_team_memberships" ("id", "team_id", "worker_id", "cleans", "updated_at")
      VALUES ('r1p07-proof-cross-provider', 'r1p07-proof-team', 'r1p07-proof-foreign-worker', false, CURRENT_TIMESTAMP)
    `), MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("removal of an active Team's final cleaner", "23514", () =>
    prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
      UPDATE "provider_team_memberships" SET "ended_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = 'r1p07-proof-membership'
    `), MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("an ineligible primary Supervisor", "23514", () =>
    prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
      UPDATE "provider_teams" SET "primary_supervisor_worker_id" = 'r1p07-proof-cleaner', "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = 'r1p07-proof-team'
    `), MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("mismatched login-access invitation ownership", "23514", () =>
    prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
      INSERT INTO "provider_worker_login_access" ("worker_id", "status", "current_invitation_id", "updated_at")
      VALUES ('r1p07-proof-escort', 'INVITED', 'r1p07-proof-invitation', CURRENT_TIMESTAMP)
    `), MIGRATION_PROBE_TRANSACTION_OPTIONS));
  await expectR1P07ConstraintRejection("a notification intent without exactly one recipient", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "provider_workforce_notification_intents" (
        "id", "provider_id", "template", "locale", "idempotency_key", "updated_at"
      ) VALUES (
        'r1p07-proof-invalid-notification', 'r1p07-proof-provider-a', 'WORKER_ACTIVATED',
        'EN', 'r1p07-proof-invalid-notification', CURRENT_TIMESTAMP
      )
    `));
  await expectR1P07ConstraintRejection("a malformed idempotency fingerprint", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "provider_workforce_commands" (
        "id", "provider_id", "scope_key", "idempotency_key", "request_fingerprint"
      ) VALUES (
        'r1p07-proof-invalid-command', 'r1p07-proof-provider-a', 'worker:r1p07-proof-cleaner',
        'r1p07-proof-invalid-command', 'not-a-sha256-fingerprint'
      )
    `));
  await expectR1P07ConstraintRejection("an update to immutable workforce history", "55000", () =>
    prisma.$executeRawUnsafe(`
      UPDATE "provider_workforce_history" SET "event_code" = 'MUTATED'
      WHERE "id" = 'r1p07-proof-history'
    `));
}

async function probeR1P06Constraints(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      index_value INTEGER;
    BEGIN
      INSERT INTO "users" (
        "id", "email_normalized", "email_verified_at", "account_categories",
        "verified_categories", "updated_at"
      ) VALUES (
        'r1p06-proof-owner', 'r1p06-proof-owner@example.invalid',
        CURRENT_TIMESTAMP,
        ARRAY['PROVIDER_OWNER']::"AccountCategory"[],
        ARRAY['PROVIDER_OWNER']::"AccountCategory"[], CURRENT_TIMESTAMP
      );

      INSERT INTO "providers" (
        "id", "application_owner_user_id", "owner_user_id", "kind",
        "application_status", "operational_status", "approved_at", "updated_at"
      ) VALUES (
        'r1p06-proof-provider', 'r1p06-proof-owner', 'r1p06-proof-owner',
        'REGISTERED_COMPANY', 'APPROVED', 'LIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );

      INSERT INTO "provider_profiles" (
        "id", "provider_id", "display_name_en", "country_id", "updated_at"
      ) SELECT
        'r1p06-proof-profile', 'r1p06-proof-provider', 'R1-P06 Proof Provider',
        c.id, CURRENT_TIMESTAMP
      FROM countries c WHERE c.code = 'EG';

      INSERT INTO "users" (
        "id", "email_normalized", "email_verified_at", "account_categories",
        "verified_categories", "updated_at"
      ) VALUES (
        'r1p06-proof-collision-owner', 'r1p06-proof-collision-owner@example.invalid',
        CURRENT_TIMESTAMP,
        ARRAY['PROVIDER_OWNER']::"AccountCategory"[],
        ARRAY['PROVIDER_OWNER']::"AccountCategory"[], CURRENT_TIMESTAMP
      );

      INSERT INTO "providers" (
        "id", "application_owner_user_id", "owner_user_id", "kind",
        "application_status", "operational_status", "approved_at", "updated_at"
      ) VALUES (
        'r1p06-proof-collision-provider', 'r1p06-proof-collision-owner',
        'r1p06-proof-collision-owner', 'INDIVIDUAL_TEAM', 'APPROVED', 'LIVE',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );

      INSERT INTO "provider_members" (
        "id", "provider_id", "user_id", "level", "status", "enabled_at", "updated_at"
      ) VALUES (
        'r1p06-proof-member', 'r1p06-proof-provider', 'r1p06-proof-owner',
        'OWNER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );

      INSERT INTO "payout_operators" (
        "id", "country_id", "code", "label_ar", "label_en", "updated_at"
      ) SELECT
        'r1p06-proof-operator', c.id, 'R1P06_PROOF_OPERATOR',
        'Proof operator', 'Proof operator', CURRENT_TIMESTAMP
      FROM countries c WHERE c.code = 'EG';

      INSERT INTO "payout_country_policies" (
        "id", "country_id", "allowed_destination_types", "allowed_currency_codes",
        "calling_codes", "iban_lengths", "updated_at"
      ) SELECT
        'r1p06-proof-policy', c.id, ARRAY['MOBILE_WALLET']::"PayoutDestinationKind"[],
        ARRAY['EGP'], ARRAY['20'], ARRAY[28], CURRENT_TIMESTAMP
      FROM countries c WHERE c.code = 'EG';

      FOR index_value IN 1..5 LOOP
        INSERT INTO "provider_payout_destination_chains" (
          "id", "provider_id", "destination_type_id", "updated_at"
        ) SELECT
          'r1p06-proof-chain-' || index_value, 'r1p06-proof-provider', t.id, CURRENT_TIMESTAMP
        FROM payout_destination_types t WHERE t.code = 'MOBILE_WALLET';

        INSERT INTO "provider_payout_identity_claims" (
          "id", "provider_id", "chain_id", "kind", "country_code", "calling_code",
          "last_four", "identifier_length", "updated_at"
        ) VALUES (
          'r1p06-proof-claim-' || index_value, 'r1p06-proof-provider',
          'r1p06-proof-chain-' || index_value, 'MOBILE_WALLET', 'EG', '20',
          lpad(index_value::text, 4, '0'), 13, CURRENT_TIMESTAMP
        );

        INSERT INTO "provider_payout_lookup_fingerprints" (
          "id", "claim_id", "lookup_key_id", "fingerprint"
        ) VALUES (
          'r1p06-proof-fingerprint-' || index_value,
          'r1p06-proof-claim-' || index_value, 'proof-lookup-key',
          lpad(to_hex(index_value), 64, '0')
        );

        INSERT INTO "provider_payout_destination_versions" (
          "id", "chain_id", "provider_id", "identity_claim_id", "sequence", "kind",
          "country_id", "country_code", "operator_id", "holder_relationship",
          "identifier_ciphertext", "identifier_nonce", "identifier_tag",
          "identifier_encryption_key_id", "holder_name_ciphertext", "holder_name_nonce",
          "holder_name_tag", "holder_name_encryption_key_id", "created_by_user_id",
          "idempotency_key", "updated_at"
        ) SELECT
          'r1p06-proof-version-' || index_value, 'r1p06-proof-chain-' || index_value,
          'r1p06-proof-provider', 'r1p06-proof-claim-' || index_value, 1,
          'MOBILE_WALLET', c.id, 'EG', 'r1p06-proof-operator', 'PROVIDER_OWNER',
          'ciphertext-' || index_value, '1234567890123456', '1234567890123456789012',
          'proof-encryption-key', 'holder-ciphertext-' || index_value,
          '6543210987654321', '2109876543210987654321', 'proof-encryption-key',
          'r1p06-proof-owner', 'r1p06-proof-command-' || index_value, CURRENT_TIMESTAMP
        FROM countries c WHERE c.code = 'EG';

        UPDATE "provider_payout_destination_chains"
        SET "current_version_id" = 'r1p06-proof-version-' || index_value
        WHERE "id" = 'r1p06-proof-chain-' || index_value;
      END LOOP;

      INSERT INTO "provider_payout_destination_chains" (
        "id", "provider_id", "destination_type_id", "updated_at"
      ) SELECT
        'r1p06-proof-collision-chain', 'r1p06-proof-collision-provider', t.id,
        CURRENT_TIMESTAMP
      FROM payout_destination_types t WHERE t.code = 'MOBILE_WALLET';

      INSERT INTO "provider_payout_identity_claims" (
        "id", "provider_id", "chain_id", "kind", "country_code", "calling_code",
        "last_four", "identifier_length", "updated_at"
      ) VALUES (
        'r1p06-proof-collision-claim', 'r1p06-proof-collision-provider',
        'r1p06-proof-collision-chain', 'MOBILE_WALLET', 'EG', '20', '9999', 13,
        CURRENT_TIMESTAMP
      );

      IF (
        SELECT count(*) FROM "provider_payout_destination_chains" c
        JOIN "provider_payout_destination_versions" v ON v.id = c.current_version_id
        WHERE c.provider_id = 'r1p06-proof-provider'
          AND v.status IN ('DRAFT', 'PENDING_VERIFICATION', 'CHANGES_REQUESTED', 'APPROVED', 'REPLACEMENT_REQUESTED')
      ) <> 5 THEN
        RAISE EXCEPTION 'five active payout chains were not preserved';
      END IF;

      BEGIN
        INSERT INTO "provider_payout_key_rotation_runs" (
          "id", "purpose", "from_key_ids", "to_active_key_id", "batch_size",
          "started_by_user_id", "operation_key", "updated_at"
        ) VALUES (
          'r1p06-invalid-rotation', 'ENCRYPTION', ARRAY['old'], 'new', 0,
          'r1p06-missing-user', 'r1p06-invalid-rotation', CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'provider_payout_key_rotation_runs_counters_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_payout_identity_claims" (
          "id", "provider_id", "chain_id", "kind", "country_code", "calling_code",
          "last_four", "identifier_length", "updated_at"
        ) VALUES (
          'r1p06-invalid-claim-shape', 'r1p06-proof-provider', 'r1p06-proof-chain-1',
          'BANK_ACCOUNT', 'EG', '20', '9999', 28, CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'provider_payout_identity_claims_mask_shape_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_payout_lookup_fingerprints" (
          "id", "claim_id", "lookup_key_id", "fingerprint"
        ) VALUES (
          'r1p06-invalid-fingerprint-duplicate', 'r1p06-proof-collision-claim',
          'proof-lookup-key', lpad(to_hex(1), 64, '0')
        );
        RAISE EXCEPTION 'cross-Provider active payout fingerprint uniqueness accepted a duplicate';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_payout_destination_versions" (
          "id", "chain_id", "provider_id", "identity_claim_id", "sequence", "kind",
          "country_id", "country_code", "currency_code", "operator_id", "bank_id",
          "holder_relationship", "identifier_ciphertext", "identifier_nonce", "identifier_tag",
          "identifier_encryption_key_id", "holder_name_ciphertext", "holder_name_nonce",
          "holder_name_tag", "holder_name_encryption_key_id", "created_by_user_id",
          "idempotency_key", "updated_at"
        ) SELECT
          'r1p06-invalid-type-shape', 'r1p06-proof-chain-1', 'r1p06-proof-provider',
          'r1p06-proof-claim-1', 2, 'MOBILE_WALLET', c.id, 'EG', 'EGP',
          'r1p06-proof-operator', NULL, 'PROVIDER_OWNER', 'ciphertext',
          '1234567890123456', '1234567890123456789012', 'proof-key', 'holder',
          '6543210987654321', '2109876543210987654321', 'proof-key',
          'r1p06-proof-owner', 'r1p06-invalid-type-shape', CURRENT_TIMESTAMP
        FROM countries c WHERE c.code = 'EG';
        RAISE EXCEPTION 'provider_payout_destination_versions_type_shape_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_payout_destination_versions" (
          "id", "chain_id", "provider_id", "identity_claim_id", "sequence", "kind",
          "country_id", "country_code", "operator_id", "holder_relationship",
          "identifier_ciphertext", "identifier_nonce", "identifier_tag",
          "identifier_encryption_key_id", "holder_name_ciphertext", "holder_name_nonce",
          "holder_name_tag", "holder_name_encryption_key_id", "created_by_user_id",
          "idempotency_key", "updated_at"
        ) SELECT
          'r1p06-invalid-envelope', 'r1p06-proof-chain-1', 'r1p06-proof-provider',
          'r1p06-proof-claim-1', 2, 'MOBILE_WALLET', c.id, 'EG',
          'r1p06-proof-operator', 'PROVIDER_OWNER', 'ciphertext', 'short',
          'short', 'proof-key', 'holder', 'short', 'short', 'proof-key',
          'r1p06-proof-owner', 'r1p06-invalid-envelope', CURRENT_TIMESTAMP
        FROM countries c WHERE c.code = 'EG';
        RAISE EXCEPTION 'provider_payout_destination_versions_envelope_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      INSERT INTO "provider_payout_destination_versions" (
        "id", "chain_id", "provider_id", "identity_claim_id", "sequence",
        "predecessor_version_id", "kind", "country_id", "country_code", "operator_id",
        "holder_relationship", "identifier_ciphertext", "identifier_nonce", "identifier_tag",
        "identifier_encryption_key_id", "holder_name_ciphertext", "holder_name_nonce",
        "holder_name_tag", "holder_name_encryption_key_id", "created_by_user_id",
        "idempotency_key", "updated_at"
      ) SELECT
        'r1p06-proof-successor-1', 'r1p06-proof-chain-1', 'r1p06-proof-provider',
        'r1p06-proof-claim-1', 2, 'r1p06-proof-version-1', 'MOBILE_WALLET', c.id,
        'EG', 'r1p06-proof-operator', 'PROVIDER_OWNER', 'ciphertext-successor',
        '1234567890123456', '1234567890123456789012', 'proof-key', 'holder-successor',
        '6543210987654321', '2109876543210987654321', 'proof-key',
        'r1p06-proof-owner', 'r1p06-proof-successor-command', CURRENT_TIMESTAMP
      FROM countries c WHERE c.code = 'EG';

      BEGIN
        INSERT INTO "provider_payout_destination_versions" (
          "id", "chain_id", "provider_id", "identity_claim_id", "sequence",
          "predecessor_version_id", "kind", "country_id", "country_code", "operator_id",
          "holder_relationship", "identifier_ciphertext", "identifier_nonce", "identifier_tag",
          "identifier_encryption_key_id", "holder_name_ciphertext", "holder_name_nonce",
          "holder_name_tag", "holder_name_encryption_key_id", "created_by_user_id",
          "idempotency_key", "updated_at"
        ) SELECT
          'r1p06-invalid-second-successor', 'r1p06-proof-chain-1', 'r1p06-proof-provider',
          'r1p06-proof-claim-1', 3, 'r1p06-proof-version-1', 'MOBILE_WALLET', c.id,
          'EG', 'r1p06-proof-operator', 'PROVIDER_OWNER', 'ciphertext-second',
          '1234567890123456', '1234567890123456789012', 'proof-key', 'holder-second',
          '6543210987654321', '2109876543210987654321', 'proof-key',
          'r1p06-proof-owner', 'r1p06-invalid-second-successor', CURRENT_TIMESTAMP
        FROM countries c WHERE c.code = 'EG';
        RAISE EXCEPTION 'one-open-successor uniqueness accepted a second successor';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;

      INSERT INTO "provider_primary_payout_destinations" (
        "provider_id", "destination_version_id", "selected_by_user_id",
        "selection_reason_code", "updated_at"
      ) VALUES (
        'r1p06-proof-provider', 'r1p06-proof-version-1', 'r1p06-proof-owner',
        'PROOF_PRIMARY', CURRENT_TIMESTAMP
      );

      BEGIN
        INSERT INTO "provider_primary_payout_destinations" (
          "provider_id", "destination_version_id", "selected_by_user_id",
          "selection_reason_code", "updated_at"
        ) VALUES (
          'r1p06-proof-provider', 'r1p06-proof-version-2', 'r1p06-proof-owner',
          'PROOF_SECOND_PRIMARY', CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'one-primary uniqueness accepted a second primary';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;

      INSERT INTO "provider_payout_history" (
        "id", "provider_id", "event", "actor_type", "operation_key"
      ) VALUES (
        'r1p06-proof-history', 'r1p06-proof-provider', 'DESTINATION_DRAFT_CREATED',
        'USER', 'r1p06-proof-operation'
      );

      BEGIN
        INSERT INTO "provider_payout_history" (
          "id", "provider_id", "event", "actor_type", "operation_key"
        ) VALUES (
          'r1p06-invalid-duplicate-operation', 'r1p06-proof-provider',
          'DESTINATION_DRAFT_CREATED', 'USER', 'r1p06-proof-operation'
        );
        RAISE EXCEPTION 'operation idempotency uniqueness accepted a duplicate';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO "provider_document_reviews" (
          "id", "provider_id", "document_version_id", "outcome", "reason",
          "actor_user_id", "expected_document_version", "operation_key"
        ) VALUES (
          'r1p06-invalid-review', 'missing-provider', 'missing-version', 'REJECT', ' ',
          'missing-user', 1, 'r1p06-invalid-review'
        );
        RAISE EXCEPTION 'provider_document_reviews_reason_check accepted an invalid row';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

    END $$;
  `);

  try {
    const [destinationType, country] = await Promise.all([
      prisma.payoutDestinationType.findUniqueOrThrow({
        where: { code: "MOBILE_WALLET" },
        select: { id: true },
      }),
      prisma.country.findUniqueOrThrow({
        where: { code: "EG" },
        select: { id: true },
      }),
    ]);
    const repository = new PrismaProviderPayoutRepository(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      () => ({
        readLegalNameFacts: async () => ({
          legalEntityName: "R1-P06 Proof Provider",
          ownerLegalName: "R1-P06 Proof Owner",
        }),
      }),
    );
    let slotLimitError: unknown;
    try {
      await repository.createDraft({
        ids: {
          chainId: "r1p06-proof-chain-6",
          claimId: "r1p06-proof-claim-6",
          destinationVersionId: "r1p06-proof-version-6",
        },
        providerId: "r1p06-proof-provider",
        actorUserId: "r1p06-proof-owner",
        destinationTypeId: destinationType.id,
        kind: "MOBILE_WALLET",
        countryId: country.id,
        countryCode: "EG",
        currencyCode: null,
        operatorId: "r1p06-proof-operator",
        bankId: null,
        holderRelationship: "PROVIDER_OWNER",
        expectedHolderLegalName: "R1-P06 Proof Owner",
        protectedHolderMatches: () => true,
        identifierEnvelope: {
          ciphertext: "r1p06-proof-sixth-ciphertext",
          nonce: "1234567890123456",
          authenticationTag: "1234567890123456789012",
          encryptionKeyId: "proof-encryption-key",
        },
        holderEnvelope: {
          ciphertext: "r1p06-proof-sixth-holder",
          nonce: "6543210987654321",
          authenticationTag: "2109876543210987654321",
          encryptionKeyId: "proof-encryption-key",
        },
        maskFacts: {
          callingCode: "20",
          ibanCountryPrefix: null,
          lastFour: "0006",
          identifierLength: 13,
        },
        fingerprints: [{
          lookupKeyId: "proof-lookup-key",
          fingerprint: "0000000000000000000000000000000000000000000000000000000000000006",
        }],
        commandId: "r1p06-proof-sixth-command",
        requestId: "r1p06-proof-sixth-request",
      });
    } catch (error: unknown) {
      slotLimitError = error;
    }
    if (!(slotLimitError instanceof Error) || slotLimitError.message !== "PAYOUT_DESTINATION_LIMIT_REACHED") {
      throw new Error("Live payout repository did not reject the sixth active destination slot");
    }

    const revealActor = await prisma.user.create({
      data: {
        id: "r1p06-proof-reveal-actor",
        emailNormalized: "r1p06-proof-reveal-actor@example.invalid",
        accountCategories: [],
        verifiedCategories: [],
        status: "ACTIVE",
      },
    });
    const attempts = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        prisma.$transaction(
          (transaction) => new PrismaPayoutRevealAuditGate(transaction).commitAcceptedReveal({
            actorUserId: revealActor.id,
            providerId: "r1p06-proof-reveal-provider",
            destinationVersionId: `r1p06-proof-reveal-destination-${index}`,
            expectedVersion: 1,
            purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
            reasonCode: "MANUAL_VERIFICATION_PREPARATION",
            requestId: `r1p06-proof-reveal-request-${index}`,
            encryptionKeyIds: ["proof-encryption-key"],
            lookupKeyIds: ["proof-lookup-key"],
            now: new Date(),
          }),
          MIGRATION_PROBE_TRANSACTION_OPTIONS,
        ),
      ),
    );
    if (attempts.filter((attempt) => attempt.accepted).length !== 5) {
      throw new Error("Live reveal serialization did not accept exactly five attempts");
    }
    if (attempts.filter((attempt) => !attempt.accepted).length !== 1) {
      throw new Error("Live reveal serialization did not reject exactly one attempt");
    }
    const [accepted, denied] = await Promise.all([
      prisma.auditLog.count({
        where: { actorId: revealActor.id, action: "PROVIDER_PAYOUT_REVEAL_ACCEPTED" },
      }),
      prisma.auditLog.count({
        where: { actorId: revealActor.id, action: "PROVIDER_PAYOUT_REVEAL_DENIED" },
      }),
    ]);
    if (accepted !== 5 || denied !== 1) {
      throw new Error("Live reveal serialization audit evidence count is invalid");
    }
  } finally {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "audit_logs" WHERE "actor_id" = 'r1p06-proof-reveal-actor';
      DELETE FROM "provider_primary_payout_destinations" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_payout_conflicts" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_payout_decisions" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_payout_history" WHERE "provider_id" = 'r1p06-proof-provider';
      UPDATE "provider_payout_destination_chains" SET "current_version_id" = NULL,
        "effective_approved_version_id" = NULL
        WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_payout_destination_versions"
        WHERE "provider_id" = 'r1p06-proof-provider'
          AND "predecessor_version_id" IS NOT NULL;
      DELETE FROM "provider_payout_destination_versions" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_payout_lookup_fingerprints"
        WHERE "claim_id" IN (
          SELECT "id" FROM "provider_payout_identity_claims"
          WHERE "provider_id" = 'r1p06-proof-provider'
        );
      DELETE FROM "provider_payout_identity_claims" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_payout_destination_chains" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_payout_identity_claims" WHERE "provider_id" = 'r1p06-proof-collision-provider';
      DELETE FROM "provider_payout_destination_chains" WHERE "provider_id" = 'r1p06-proof-collision-provider';
      DELETE FROM "payout_country_policies" WHERE "id" = 'r1p06-proof-policy';
      DELETE FROM "payout_operators" WHERE "id" = 'r1p06-proof-operator';
      DELETE FROM "provider_members" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "provider_profiles" WHERE "provider_id" = 'r1p06-proof-provider';
      DELETE FROM "providers" WHERE "id" = 'r1p06-proof-provider';
      DELETE FROM "providers" WHERE "id" = 'r1p06-proof-collision-provider';
      DELETE FROM "users" WHERE "id" IN (
        'r1p06-proof-owner', 'r1p06-proof-collision-owner', 'r1p06-proof-reveal-actor'
      );
    `);
  }
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

async function probeR1P08Constraints(prisma: PrismaClient): Promise<void> {
  const counts = await readSeedCounts(prisma);
  if (
    counts.serviceCategories !== 1
    || counts.services !== 1
    || counts.serviceTranslations !== 2
    || counts.servicePriceUnits !== 2
    || counts.serviceFields !== 5
    || counts.serviceCountryAvailability !== 1
  ) {
    throw new Error(
      "R1-P08 seed counts must be exactly 1 category, 1 service, 2 translations, 2 units, 5 fields, and 1 availability row",
    );
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO "service_categories" (
      "id", "code", "display_order", "is_active", "version", "updated_at"
    ) VALUES (
      'r1p08-proof-category', 'R1P08_PROOF_CATEGORY', 99, false, 1, CURRENT_TIMESTAMP
    );
  `);

  await expectR1P07ConstraintRejection("a lowercase category code", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "service_categories" (
        "id", "code", "display_order", "is_active", "version", "updated_at"
      ) VALUES (
        'r1p08-invalid-code', 'home_cleaning', 98, false, 1, CURRENT_TIMESTAMP
      )
    `));
  await expectR1P07ConstraintRejection("a duplicate category code", "23505", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "service_categories" (
        "id", "code", "display_order", "is_active", "version", "updated_at"
      ) VALUES (
        'r1p08-duplicate-code', 'R1P08_PROOF_CATEGORY', 97, false, 1, CURRENT_TIMESTAMP
      )
    `));
  await expectR1P07ConstraintRejection("a zero service version", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "services" (
        "id", "category_id", "code", "display_order", "is_active", "version", "updated_at"
      ) VALUES (
        'r1p08-invalid-version', 'r1p08-proof-category', 'INVALID_VERSION', 0, false, 0, CURRENT_TIMESTAMP
      )
    `));

  const service = await prisma.service.findFirstOrThrow({
    where: { code: "STANDARD_HOME_CLEANING" },
    select: { id: true },
  });

  await expectR1P07ConstraintRejection("INFORMATION marked required", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "service_fields" (
        "id", "service_id", "code", "kind", "is_required", "display_order", "is_active", "updated_at"
      ) VALUES (
        'r1p08-invalid-information', '${service.id}', 'INVALID_INFORMATION',
        'INFORMATION', true, 99, false, CURRENT_TIMESTAMP
      )
    `));
  await expectR1P07ConstraintRejection("NUMBER without number_mode", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "service_fields" (
        "id", "service_id", "code", "kind", "is_required", "display_order", "is_active", "updated_at"
      ) VALUES (
        'r1p08-invalid-number', '${service.id}', 'INVALID_NUMBER',
        'NUMBER', false, 98, false, CURRENT_TIMESTAMP
      )
    `));
  await expectR1P07ConstraintRejection("a malformed command hash", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "catalog_command_requests" (
        "id", "actor_user_id", "scope_key", "idempotency_key", "request_hash", "status",
        "target_type", "reserved_media_file_id", "updated_at"
      ) VALUES (
        'r1p08-invalid-hash', 'r1p08-proof-actor', 'service:${service.id}',
        'r1p08-invalid-hash', 'not-a-sha256', 'PENDING', 'SERVICE',
        'r1p08-proof-media', CURRENT_TIMESTAMP
      )
    `));
  await expectR1P07ConstraintRejection(
    "a PENDING command without reserved media identity",
    "23514",
    () =>
      prisma.$executeRawUnsafe(`
        INSERT INTO "catalog_command_requests" (
          "id", "actor_user_id", "scope_key", "idempotency_key", "request_hash", "status",
          "target_type", "updated_at"
        ) VALUES (
          'r1p08-pending-missing-media', 'r1p08-proof-actor', 'service:${service.id}',
          'r1p08-pending-missing-media', repeat('b', 64), 'PENDING', 'SERVICE',
          CURRENT_TIMESTAMP
        )
      `),
  );
  await expectR1P07ConstraintRejection("a completed command without completion facts", "23514", () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "catalog_command_requests" (
        "id", "actor_user_id", "scope_key", "idempotency_key", "request_hash", "status",
        "target_type", "updated_at"
      ) VALUES (
        'r1p08-invalid-completed', 'r1p08-proof-actor', 'service:${service.id}',
        'r1p08-invalid-completed', repeat('a', 64), 'COMPLETED', 'SERVICE', CURRENT_TIMESTAMP
      )
    `));

  await prisma.$executeRawUnsafe(`
    DELETE FROM "service_categories" WHERE "id" = 'r1p08-proof-category';
  `);
}

async function run(): Promise<void> {
  await validateMigrationFolder();
  console.info(`Validated migration folders: ${migrationNames.join(', ')}`);
  console.info(`Expected product tables: ${expectedTables.join(', ')}`);
  console.info(
    "SQL review: no unexplained DROP TABLE / TRUNCATE / DELETE FROM detected; only the two reviewed R1-P03A bootstrap-cleanup drops are allowlisted",
  );

  const configuredConnectionString = requireR1P08ProofDatabaseUrl();
  const proofUrl = new URL(configuredConnectionString);
  const proofSchema = `cleanora_r1_p08_proof_${process.pid}_${Date.now()}`;
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
    `Applied all migrations in isolated schema ${proofSchema}; verified exact 76 tables, 15-migration history, double-seed idempotency, DEC-044 Catalog counts, and live R1-P05/R1-P06/R1-P07/R1-P08 constraint probes.`,
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

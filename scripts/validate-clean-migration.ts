import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { seed } from "../prisma/seed.js";
import { probeR1P09Constraints } from "./probe-r1-p09-constraints.js";
import { PrismaPayoutRevealAuditGate } from "../src/modules/admin/infrastructure/prisma-payout-reveal-audit.gate.js";
import { PrismaProviderPayoutRepository } from "../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";

const executeFile = promisify(execFile);
const MIGRATION_PROBE_TRANSACTION_OPTIONS = {
  maxWait: 120_000,
  timeout: 120_000,
} as const;
/** Migrations through R1-P10 inclusive — used by P10 upgrade proofs. */
export const MIGRATION_NAMES_THROUGH_R1_P10 = [
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
  'r1_p08_catalog_localization_service_requirements',
  'r1_p09_provider_services_pricing_historical_snapshots',
  'r1_p10_availability_capacity_textual_coverage'
] as const;
const migrationNames = [
  ...MIGRATION_NAMES_THROUGH_R1_P10,
  'r1_p11_eligibility_engine_v1',
  'r1_p13_booking_draft_pricing_snapshot_status_machine',
  'r1_p14_financial_ledger_payment_architecture',
  'r1_p15_deposit_payments_methods_webhooks',
] as const;
const expectedTablesThroughR1P10 = [
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
  "catalog_command_requests",
  "provider_services",
  "provider_service_prices",
  "provider_service_price_history",
  "provider_service_status_history",
  "cities",
  "districts",
  "provider_availability_configurations",
  "provider_coverage_areas",
  "provider_schedules",
  "provider_schedule_exceptions",
  "worker_schedules",
  "worker_schedule_exceptions",
  "provider_capacity_rules",
  "provider_temporary_pauses",
  "provider_availability_commands",
  "provider_availability_history",
  "configuration_locality_commands"
] as const;
const expectedTables = [
  ...expectedTablesThroughR1P10,
  "eligibility_rule_versions",
  "eligibility_evaluations",
  "eligibility_candidate_results",
  "bookings",
  "booking_items",
  "booking_answers",
  "booking_addresses",
  "booking_media",
  "booking_snapshots",
  "booking_price_breakdowns",
  "booking_status_history",
  "status_transition_rules",
  "booking_commands",
  "ledger_accounts",
  "ledger_entries",
  "ledger_entry_links",
  "financial_idempotency_keys",
  "financial_snapshots",
  "financial_adjustments",
  "payment_methods",
  "payments",
  "payment_attempts",
  "payment_gateway_events",
  "payment_receipts",
  "refund_requests",
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
  ],
  r1_p09_provider_services_pricing_historical_snapshots: [
    "provider_services",
    "provider_service_prices",
    "provider_service_price_history",
    "provider_service_status_history"
  ],
  r1_p10_availability_capacity_textual_coverage: [
    "cities",
    "districts",
    "provider_availability_configurations",
    "provider_coverage_areas",
    "provider_schedules",
    "provider_schedule_exceptions",
    "worker_schedules",
    "worker_schedule_exceptions",
    "provider_capacity_rules",
    "provider_temporary_pauses",
    "provider_availability_commands",
    "provider_availability_history",
    "configuration_locality_commands"
  ],
  r1_p11_eligibility_engine_v1: [
    "eligibility_rule_versions",
    "eligibility_evaluations",
    "eligibility_candidate_results"
  ],
  r1_p13_booking_draft_pricing_snapshot_status_machine: [
    "bookings",
    "booking_items",
    "booking_answers",
    "booking_addresses",
    "booking_media",
    "booking_snapshots",
    "booking_price_breakdowns",
    "booking_status_history",
    "status_transition_rules",
    "booking_commands"
  ],
  r1_p14_financial_ledger_payment_architecture: [
    "ledger_accounts",
    "ledger_entries",
    "ledger_entry_links",
    "financial_idempotency_keys",
    "financial_snapshots",
    "financial_adjustments"
  ],
  r1_p15_deposit_payments_methods_webhooks: [
    "payment_methods",
    "payments",
    "payment_attempts",
    "payment_gateway_events",
    "payment_receipts",
    "refund_requests"
  ]
};
const expectedPostDeployTablesThroughR1P10 = [
  "_prisma_migrations",
  ...expectedTablesThroughR1P10,
] as const;
const expectedPostDeployTables = ["_prisma_migrations", ...expectedTables] as const;

/** Post-deploy table inventory through R1-P10 (excludes Eligibility). */
export const POST_DEPLOY_TABLES_THROUGH_R1_P10 =
  expectedPostDeployTablesThroughR1P10;
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
  tableNames: readonly string[],
  expectedTableNames: readonly string[] = expectedPostDeployTables,
): void {
  const actual = new Set(tableNames);
  const expected = new Set<string>(expectedTableNames);
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
  rows: readonly MigrationHistoryRow[],
  expectedMigrationNames: readonly string[] = migrationNames,
): void {
  const expected = new Set<string>(expectedMigrationNames);
  const unexpected = rows
    .map((row) => row.migration_name)
    .filter((name) => !expected.has(name));
  if (unexpected.length > 0) {
    throw new Error(
      `Migration history contains unexpected rows: ${[...new Set(unexpected)].join(", ")}`,
    );
  }
  for (const migrationName of expectedMigrationNames) {
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

export const APPROVED_R1_P09_TARGET_PATTERN =
  /^cleanora_r1_p09(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/** Require an explicitly named R1-P09 disposable target for Provider-service proofs. */
export function assertR1P09DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  let targetName: string;
  try {
    const url = new URL(connectionString);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P09 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P09_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P09 database work against unapproved target "${targetName}"`,
    );
  }
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
}

/**
 * Resolve the separate R1-P09 live/proof URL.
 * Never falls back to DATABASE_URL or a prior-phase disposable target.
 */
export function requireR1P09ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P09_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P09_DATABASE_URL is required for R1-P09 disposable proofs",
    );
  }
  assertR1P09DisposableDatabaseUrl(value);
  return value;
}

export const APPROVED_R1_P10_TARGET_PATTERN =
  /^cleanora_r1_p10(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/** Require an explicitly named R1-P10 disposable target for availability proofs. */
export function assertR1P10DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  let targetName: string;
  try {
    const url = new URL(connectionString);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P10 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P10_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P10 database work against unapproved target "${targetName}"`,
    );
  }
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
}

/**
 * Resolve the separate R1-P10 live/proof URL.
 * Never falls back to DATABASE_URL or a prior-phase disposable target.
 */
export function requireR1P10ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P10_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P10_DATABASE_URL is required for R1-P10 disposable proofs",
    );
  }
  assertR1P10DisposableDatabaseUrl(value);
  return value;
}

export const APPROVED_R1_P11_TARGET_PATTERN =
  /^cleanora_r1_p11(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/** Require an explicitly named R1-P11 disposable target for eligibility proofs. */
export function assertR1P11DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  let targetName: string;
  try {
    const url = new URL(connectionString);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P11 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P11_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P11 database work against unapproved target "${targetName}"`,
    );
  }
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
}

/**
 * Resolve the separate R1-P11 live/proof URL.
 * Never falls back to DATABASE_URL or a prior-phase disposable target.
 * Prefer Neon direct hosts so proof schemas can set `search_path` (poolers
 * reject the startup `options` parameter).
 */
export function requireR1P11ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P11_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P11_DATABASE_URL is required for R1-P11 disposable proofs",
    );
  }
  assertR1P11DisposableDatabaseUrl(value);
  try {
    const url = new URL(value);
    url.hostname = url.hostname.replace("-pooler", "");
    return url.toString();
  } catch {
    return value;
  }
}

export const APPROVED_R1_P13_TARGET_PATTERN =
  /^cleanora_r1_p13(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/** Require an explicitly named R1-P13 disposable target for booking proofs. */
export function assertR1P13DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  let targetName: string;
  try {
    const url = new URL(connectionString);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P13 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P13_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P13 database work against unapproved target "${targetName}"`,
    );
  }
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
}

/**
 * Resolve the separate R1-P13 live/proof URL.
 * Never falls back to DATABASE_URL or a prior-phase disposable target.
 */
export function requireR1P13ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P13_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P13_DATABASE_URL is required for R1-P13 disposable proofs",
    );
  }
  assertR1P13DisposableDatabaseUrl(value);
  try {
    const url = new URL(value);
    url.hostname = url.hostname.replace("-pooler", "");
    return url.toString();
  } catch {
    return value;
  }
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

export const R1_P09_MIGRATION =
  "r1_p09_provider_services_pricing_historical_snapshots";

export const R1_P09_PROVIDER_SERVICE_TABLES = [
  "provider_services",
  "provider_service_prices",
  "provider_service_price_history",
  "provider_service_status_history",
] as const;

/** Accept only the additive, phase-owned R1-P09 Provider-service migration inventory. */
export function assertR1P09MigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(COLUMN|CONSTRAINT|TYPE)\b/iu.test(sql)) {
    throw new Error("R1-P09 provider-services migration contains destructive SQL");
  }
  const tables = migrationOwnedTables[R1_P09_MIGRATION] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P09 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 4) {
    throw new Error("R1-P09 migration must create exactly four Provider service tables");
  }
  for (const required of [
    "ProviderServicePriceStatus",
    "ProviderServicePriceHistoryEvent",
    "ProviderServiceStatusHistoryEvent",
    "provider_service_prices_pending_unique",
    "provider_service_prices_effective_unique",
    "provider_service_price_history_immutable",
    "provider_service_status_history_immutable",
    "provider_service_prices_lifecycle_immutable",
    "service_price_units_id_service_id_key",
    "ON DELETE RESTRICT",
  ]) {
    if (!sql.includes(required)) {
      throw new Error(`R1-P09 migration is missing ${required}`);
    }
  }
  if (/\bON DELETE CASCADE\b/iu.test(sql)) {
    throw new Error("R1-P09 Provider-service foreign keys must not cascade-delete parent rows");
  }
  for (const forbidden of [/\bbrowse\b/iu, /\bbooking\b/iu]) {
    if (forbidden.test(sql)) {
      throw new Error("R1-P09 migration must not reference Browse or Booking surfaces");
    }
  }
}

export const R1_P10_MIGRATION =
  "r1_p10_availability_capacity_textual_coverage";

export const R1_P10_AVAILABILITY_TABLES = [
  "cities",
  "districts",
  "provider_availability_configurations",
  "provider_coverage_areas",
  "provider_schedules",
  "provider_schedule_exceptions",
  "worker_schedules",
  "worker_schedule_exceptions",
  "provider_capacity_rules",
  "provider_temporary_pauses",
  "provider_availability_commands",
  "provider_availability_history",
  "configuration_locality_commands",
] as const;

/** Accept only the additive, phase-owned R1-P10 availability migration inventory. */
export function assertR1P10MigrationSql(sql: string): void {
  if (destructivePattern.test(sql) || /\bDROP\s+(COLUMN|CONSTRAINT|TYPE)\b/iu.test(sql)) {
    throw new Error("R1-P10 availability migration contains destructive SQL");
  }
  const tables = migrationOwnedTables[R1_P10_MIGRATION] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P10 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 13) {
    throw new Error("R1-P10 migration must create exactly thirteen availability/locality tables");
  }
  for (const required of [
    "CONFIGURATION_LOCALITY_WRITE",
    'ALTER TABLE "country_configs" ADD COLUMN "version"',
    "platform.default_timezone",
    "COUNTRY_REQUIRED",
    "Africa/Cairo",
    "ON DELETE RESTRICT",
  ]) {
    if (!sql.includes(required)) {
      throw new Error(`R1-P10 migration is missing ${required}`);
    }
  }
  if (/\bON DELETE CASCADE\b/iu.test(sql)) {
    throw new Error("R1-P10 availability foreign keys must not cascade-delete parent rows");
  }
  for (const forbidden of [/\bbrowse\b/iu, /\bbooking\b/iu, /\beligibility\b/iu]) {
    if (forbidden.test(sql)) {
      throw new Error("R1-P10 migration must not reference Browse, Booking, or Eligibility surfaces");
    }
  }
}

export const R1_P11_MIGRATION = "r1_p11_eligibility_engine_v1";

export const R1_P11_ELIGIBILITY_TABLES = [
  "eligibility_rule_versions",
  "eligibility_evaluations",
  "eligibility_candidate_results",
] as const;

export const MIGRATION_NAMES_THROUGH_R1_P11 = [
  ...MIGRATION_NAMES_THROUGH_R1_P10,
  R1_P11_MIGRATION,
] as const;

export const POST_DEPLOY_TABLES_THROUGH_R1_P11 = [
  ...POST_DEPLOY_TABLES_THROUGH_R1_P10,
  ...R1_P11_ELIGIBILITY_TABLES,
] as const;

/** Accept only the additive, phase-owned R1-P11 Eligibility migration inventory. */
export function assertR1P11MigrationSql(sql: string): void {
  if (/\b(DROP\s+TABLE|TRUNCATE)\b/iu.test(sql)) {
    throw new Error("R1-P11 eligibility migration contains destructive SQL");
  }
  // DELETE FROM is forbidden outside intentional empty patterns; none expected.
  if (/\bDELETE\s+FROM\b/iu.test(sql)) {
    throw new Error("R1-P11 eligibility migration must not delete existing rows");
  }
  const tables = migrationOwnedTables[R1_P11_MIGRATION] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P11 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 3) {
    throw new Error("R1-P11 migration must create exactly three Eligibility tables");
  }
  for (const required of [
    "EligibilityCandidateRowKind",
    "eligibility_candidate_results_row_kind_team_xor",
    "eligibility_candidate_results_provider_summary_unique",
    "eligibility_candidate_results_team_result_unique",
    "eligibility_evaluations_rule_version_country_fkey",
    "eligibility_evaluations_expires_at_id_idx",
    "720 hours",
    'ON DELETE CASCADE',
    "ON DELETE RESTRICT",
  ]) {
    if (!sql.includes(required)) {
      throw new Error(`R1-P11 migration is missing ${required}`);
    }
  }
  for (const forbidden of [/\bbrowse\b/iu, /\bbooking\b/iu]) {
    if (forbidden.test(sql)) {
      throw new Error("R1-P11 migration must not reference Browse or Booking surfaces");
    }
  }
}

export const R1_P13_MIGRATION =
  "r1_p13_booking_draft_pricing_snapshot_status_machine";

export const R1_P13_BOOKING_TABLES = [
  "bookings",
  "booking_items",
  "booking_answers",
  "booking_addresses",
  "booking_media",
  "booking_snapshots",
  "booking_price_breakdowns",
  "booking_status_history",
  "status_transition_rules",
  "booking_commands",
] as const;

export const MIGRATION_NAMES_THROUGH_R1_P13 = [
  ...MIGRATION_NAMES_THROUGH_R1_P11,
  R1_P13_MIGRATION,
] as const;

export const POST_DEPLOY_TABLES_THROUGH_R1_P13 = [
  ...POST_DEPLOY_TABLES_THROUGH_R1_P11,
  ...R1_P13_BOOKING_TABLES,
] as const;

/** Accept only the additive, phase-owned R1-P13 booking migration inventory. */
export function assertR1P13MigrationSql(sql: string): void {
  if (/\b(DROP\s+TABLE|TRUNCATE)\b/iu.test(sql)) {
    throw new Error("R1-P13 booking migration contains destructive SQL");
  }
  if (/\bDELETE\s+FROM\b/iu.test(sql)) {
    throw new Error("R1-P13 booking migration must not delete existing rows");
  }
  const tables = migrationOwnedTables[R1_P13_MIGRATION] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P13 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 10) {
    throw new Error("R1-P13 migration must create exactly ten booking tables");
  }
  for (const required of [
    "BOOKING_ATTACHMENT",
    "commercial.deposit_percent",
    "DECIMAL(65,0)",
    "emergency_signaled",
    "booking_commands_customer_user_id_command_type_idempotency_key_key",
  ]) {
    if (!sql.includes(required)) {
      throw new Error(`R1-P13 migration is missing ${required}`);
    }
  }
  const snapshotSql = sql.slice(
    sql.indexOf('CREATE TABLE "booking_snapshots"'),
    sql.indexOf('CREATE TABLE "booking_price_breakdowns"'),
  );
  if (snapshotSql.includes('"updated_at"')) {
    throw new Error("R1-P13 snapshots must not have updated_at");
  }
  const breakdownSql = sql.slice(
    sql.indexOf('CREATE TABLE "booking_price_breakdowns"'),
    sql.indexOf('CREATE TABLE "booking_status_history"'),
  );
  if (breakdownSql.includes('"updated_at"')) {
    throw new Error("R1-P13 price breakdowns must not have updated_at");
  }
  if (!sql.includes('c."code" = \'EG\'')) {
    throw new Error("R1-P13 must seed commercial.deposit_percent for Egypt only");
  }
  if (/FROM "countries" c\s+WHERE NOT EXISTS/u.test(sql)) {
    throw new Error("R1-P13 must not seed deposit percent for every country");
  }
  for (const required of [
    "r1_p13_reject_booking_snapshot_mutation",
    "r1_p13_reject_booking_price_breakdown_mutation",
    'BEFORE UPDATE OR DELETE ON "booking_snapshots"',
    'BEFORE UPDATE OR DELETE ON "booking_price_breakdowns"',
  ]) {
    if (!sql.includes(required)) {
      throw new Error(`R1-P13 migration is missing ${required}`);
    }
  }
  if (
    sql.includes('CREATE TABLE "orders"') ||
    sql.includes('CREATE TABLE "wallets"') ||
    sql.includes('CREATE TABLE "ledger')
  ) {
    throw new Error("R1-P13 migration must not introduce orders, wallets, or ledger");
  }
}

export const R1_P14_MIGRATION =
  "r1_p14_financial_ledger_payment_architecture";

export const R1_P14_LEDGER_TABLES = [
  "ledger_accounts",
  "ledger_entries",
  "ledger_entry_links",
  "financial_idempotency_keys",
  "financial_snapshots",
  "financial_adjustments",
] as const;

export const MIGRATION_NAMES_THROUGH_R1_P14 = [
  ...MIGRATION_NAMES_THROUGH_R1_P13,
  R1_P14_MIGRATION,
] as const;

export const POST_DEPLOY_TABLES_THROUGH_R1_P14 = [
  ...POST_DEPLOY_TABLES_THROUGH_R1_P13,
  ...R1_P14_LEDGER_TABLES,
] as const;

export const APPROVED_R1_P14_TARGET_PATTERN =
  /^cleanora_r1_p14(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/** Require an explicitly named R1-P14 disposable target for ledger proofs. */
export function assertR1P14DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  let targetName: string;
  try {
    const url = new URL(connectionString);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P14 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P14_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P14 database work against unapproved target "${targetName}"`,
    );
  }
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
}

/**
 * Resolve the separate R1-P14 live/proof URL.
 * Never falls back to DATABASE_URL or a prior-phase disposable target.
 */
export function requireR1P14ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P14_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P14_DATABASE_URL is required for R1-P14 disposable proofs",
    );
  }
  assertR1P14DisposableDatabaseUrl(value);
  try {
    const url = new URL(value);
    url.hostname = url.hostname.replace("-pooler", "");
    return url.toString();
  } catch {
    return value;
  }
}

/** Accept only the additive, phase-owned R1-P14 ledger migration inventory. */
export function assertR1P14MigrationSql(sql: string): void {
  if (/\b(DROP\s+TABLE|TRUNCATE)\b/iu.test(sql)) {
    throw new Error("R1-P14 ledger migration contains destructive SQL");
  }
  if (/\bDELETE\s+FROM\b/iu.test(sql)) {
    throw new Error("R1-P14 ledger migration must not delete existing rows");
  }
  if (
    sql.includes('CREATE TABLE "wallets"') ||
    sql.includes('CREATE TABLE "user_wallets"') ||
    sql.includes('CREATE TABLE "customer_wallets"')
  ) {
    throw new Error("R1-P14 migration must not create wallets");
  }
  if (sql.includes('CREATE TABLE "orders"')) {
    throw new Error("R1-P14 migration must not create an orders table");
  }
  const tables = migrationOwnedTables[R1_P14_MIGRATION] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P14 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 6) {
    throw new Error("R1-P14 migration must create exactly six ledger tables");
  }
  for (const required of [
    "DECIMAL(65,0)",
    "PLATFORM_CLEARING",
    "CUSTOMER_DEPOSIT_LIABILITY",
    "ADJUSTMENT_CLEARING",
    "MARKETER_COMMISSION",
    "r1_p14_reject_ledger_entry_mutation",
    "r1_p14_reject_ledger_entry_link_mutation",
    "r1_p14_reject_financial_snapshot_mutation",
    'BEFORE UPDATE OR DELETE ON "ledger_entries"',
    'BEFORE UPDATE OR DELETE ON "ledger_entry_links"',
    'BEFORE UPDATE OR DELETE ON "financial_snapshots"',
    'c."code" = \'EG\'',
  ]) {
    if (!sql.includes(required)) {
      throw new Error(`R1-P14 migration is missing ${required}`);
    }
  }
  const entriesSql = sql.slice(
    sql.indexOf('CREATE TABLE "ledger_entries"'),
    sql.indexOf('CREATE TABLE "ledger_entry_links"'),
  );
  const linksSql = sql.slice(
    sql.indexOf('CREATE TABLE "ledger_entry_links"'),
    sql.indexOf('CREATE TABLE "financial_idempotency_keys"'),
  );
  const snapshotsSql = sql.slice(
    sql.indexOf('CREATE TABLE "financial_snapshots"'),
    sql.indexOf('CREATE TABLE "financial_adjustments"'),
  );
  if (
    entriesSql.includes('"updated_at"') ||
    linksSql.includes('"updated_at"') ||
    snapshotsSql.includes('"updated_at"')
  ) {
    throw new Error("R1-P14 immutable ledger tables must not have updated_at");
  }
}

export const R1_P15_MIGRATION =
  "r1_p15_deposit_payments_methods_webhooks";

export const R1_P15_PAYMENT_TABLES = [
  "payment_methods",
  "payments",
  "payment_attempts",
  "payment_gateway_events",
  "payment_receipts",
  "refund_requests",
] as const;

export const MIGRATION_NAMES_THROUGH_R1_P15 = [
  ...MIGRATION_NAMES_THROUGH_R1_P14,
  R1_P15_MIGRATION,
] as const;

export const POST_DEPLOY_TABLES_THROUGH_R1_P15 = [
  ...POST_DEPLOY_TABLES_THROUGH_R1_P14,
  ...R1_P15_PAYMENT_TABLES,
] as const;

export const APPROVED_R1_P15_TARGET_PATTERN =
  /^cleanora_r1_p15(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/** Require an explicitly named R1-P15 disposable target for deposit proofs. */
export function assertR1P15DisposableDatabaseUrl(
  connectionString: string,
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"],
): void {
  let targetName: string;
  try {
    const url = new URL(connectionString);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P15 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P15_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P15 database work against unapproved target "${targetName}"`,
    );
  }
  assertSafeCleanTestDatabaseUrl(connectionString, runtimeEnvironment);
}

/**
 * Resolve the separate R1-P15 live/proof URL.
 * Never falls back to DATABASE_URL, CLEANORA_R1_P14_DATABASE_URL, or any prior-phase target.
 */
export function requireR1P15ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P15_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P15_DATABASE_URL is required for R1-P15 disposable proofs",
    );
  }
  assertR1P15DisposableDatabaseUrl(value);
  try {
    const url = new URL(value);
    url.hostname = url.hostname.replace("-pooler", "");
    return url.toString();
  } catch {
    return value;
  }
}

/** Accept only the additive, phase-owned R1-P15 deposit payment migration inventory. */
export function assertR1P15MigrationSql(sql: string): void {
  if (/\b(DROP\s+TABLE|TRUNCATE)\b/iu.test(sql)) {
    throw new Error("R1-P15 deposit migration contains destructive SQL");
  }
  if (/\bDELETE\s+FROM\b/iu.test(sql)) {
    throw new Error("R1-P15 deposit migration must not delete existing rows");
  }
  if (
    sql.includes('CREATE TABLE "wallets"') ||
    sql.includes('CREATE TABLE "user_wallets"') ||
    sql.includes('CREATE TABLE "customer_wallets"')
  ) {
    throw new Error("R1-P15 migration must not create wallets");
  }
  if (/create\s+table\s+"?[^"]*instapay/iu.test(sql)) {
    throw new Error("R1-P15 migration must not invent InstaPay tables");
  }
  const tables = migrationOwnedTables[R1_P15_MIGRATION] ?? [];
  for (const table of tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) {
      throw new Error(`R1-P15 migration is missing table ${table}`);
    }
  }
  if ((sql.match(/CREATE TABLE/g) ?? []).length !== 6) {
    throw new Error("R1-P15 migration must create exactly six payment tables");
  }
  for (const required of [
    'CREATE TYPE "PaymentRailProvider"',
    'CREATE TYPE "PaymentMethodKind"',
    'CREATE TYPE "PaymentAttemptStatus"',
    'CREATE TYPE "PaymentStatus"',
    'CREATE TYPE "PaymentPurpose"',
    'CREATE TYPE "PaymentGatewayEventStatus"',
    'CREATE TYPE "RefundRequestStatus"',
    "payments_one_succeeded_booking_deposit_key",
    'WHERE "status" = \'SUCCEEDED\'',
    "DECIMAL(65,0)",
    "PAYMOB_CARD",
    "PAYMOB_WALLET",
    "OTHER_DISABLED",
    "str_sys_awaiting_confirmed",
    'c."code" = \'EG\'',
  ]) {
    if (!sql.includes(required)) {
      throw new Error(`R1-P15 migration is missing ${required}`);
    }
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
    if (migrationName === R1_P09_MIGRATION) {
      assertR1P09MigrationSql(sql);
      continue;
    }
    if (migrationName === R1_P10_MIGRATION) {
      assertR1P10MigrationSql(sql);
      continue;
    }
    if (migrationName === R1_P11_MIGRATION) {
      assertR1P11MigrationSql(sql);
      continue;
    }
    if (migrationName === R1_P13_MIGRATION) {
      assertR1P13MigrationSql(sql);
      continue;
    }
    if (migrationName === R1_P14_MIGRATION) {
      assertR1P14MigrationSql(sql);
      continue;
    }
    if (migrationName === R1_P15_MIGRATION) {
      assertR1P15MigrationSql(sql);
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

export type PostDeployExpectation = {
  readonly migrationNames?: readonly string[];
  readonly postDeployTables?: readonly string[];
  /** When true (default for full current phase), assert Eligibility evaluation trees empty after seed. */
  readonly assertEmptyEligibilityTrees?: boolean;
};

export async function assertPostDeployState(
  connectionString: string,
  expectation: PostDeployExpectation = {},
): Promise<void> {
  const expectedMigrationNames =
    expectation.migrationNames ?? migrationNames;
  const expectedTablesForAssert =
    expectation.postDeployTables ?? expectedPostDeployTables;
  const assertEmptyEligibilityTrees =
    expectation.assertEmptyEligibilityTrees ??
    expectedMigrationNames.includes(R1_P11_MIGRATION);

  const prisma = createMigrationProofPrismaClient(connectionString);

  try {
    assertExactPostDeployTables(
      await readPublicBaseTables(prisma),
      expectedTablesForAssert,
    );
    const history = await prisma.$queryRaw<MigrationHistoryRow[]>`
      SELECT
        migration_name::text AS migration_name,
        finished_at,
        rolled_back_at
      FROM "_prisma_migrations"
    `;
    assertAppliedMigration(history, expectedMigrationNames);
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
    await probeR1P09Constraints(prisma, readDatabaseSqlState);
    for (const table of R1_P09_PROVIDER_SERVICE_TABLES) {
      const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT count(*)::bigint AS total FROM "${table}"`,
      );
      if ((rows[0]?.total ?? 0n) !== 0n) {
        throw new Error(
          `R1-P09 seed must leave ${table} empty; found production Provider-price rows`,
        );
      }
    }
    for (const table of R1_P10_AVAILABILITY_TABLES) {
      const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT count(*)::bigint AS total FROM "${table}"`,
      );
      if ((rows[0]?.total ?? 0n) !== 0n) {
        throw new Error(
          `R1-P10 seed must leave ${table} empty; found production availability/locality rows`,
        );
      }
    }
    if (assertEmptyEligibilityTrees) {
      for (const table of [
        "eligibility_evaluations",
        "eligibility_candidate_results",
      ] as const) {
        const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
          `SELECT count(*)::bigint AS total FROM "${table}"`,
        );
        if ((rows[0]?.total ?? 0n) !== 0n) {
          throw new Error(
            `R1-P11 seed must leave ${table} empty; found disposable evaluation rows`,
          );
        }
      }
      const ruleRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*)::bigint AS total FROM "eligibility_rule_versions"
      `;
      if ((ruleRows[0]?.total ?? 0n) < 1n) {
        throw new Error(
          "R1-P11 seed must create at least one eligibility_rule_versions row",
        );
      }
    }
    if (expectedMigrationNames.includes(R1_P13_MIGRATION)) {
      for (const table of [
        "bookings",
        "booking_items",
        "booking_answers",
        "booking_addresses",
        "booking_media",
        "booking_snapshots",
        "booking_price_breakdowns",
        "booking_status_history",
        "booking_commands",
      ] as const) {
        const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
          `SELECT count(*)::bigint AS total FROM "${table}"`,
        );
        if ((rows[0]?.total ?? 0n) !== 0n) {
          throw new Error(
            `R1-P13 seed must leave ${table} empty; found commercial booking rows`,
          );
        }
      }
      const ruleRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*)::bigint AS total FROM "status_transition_rules"
      `;
      if ((ruleRows[0]?.total ?? 0n) < 4n) {
        throw new Error(
          "R1-P13 migration must seed executable status_transition_rules rows",
        );
      }
      await probeR1P13Immutability(prisma);
    }
    if (expectedMigrationNames.includes(R1_P14_MIGRATION)) {
      const accountRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*)::bigint AS total
        FROM "ledger_accounts" a
        JOIN "countries" c ON c."id" = a."country_id"
        WHERE c."code" = 'EG'
      `;
      if ((accountRows[0]?.total ?? 0n) !== 8n) {
        throw new Error(
          "R1-P14 seed must create exactly eight Egypt system ledger accounts",
        );
      }
      const typeRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(DISTINCT a."account_type")::bigint AS total
        FROM "ledger_accounts" a
        JOIN "countries" c ON c."id" = a."country_id"
        WHERE c."code" = 'EG'
      `;
      if ((typeRows[0]?.total ?? 0n) !== 8n) {
        throw new Error(
          "R1-P14 seed must cover every closed system account type for Egypt",
        );
      }
      for (const table of [
        "ledger_entries",
        "ledger_entry_links",
        "financial_idempotency_keys",
        "financial_snapshots",
        "financial_adjustments",
      ] as const) {
        const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
          `SELECT count(*)::bigint AS total FROM "${table}"`,
        );
        if ((rows[0]?.total ?? 0n) !== 0n) {
          throw new Error(
            `R1-P14 seed must leave ${table} empty; found commercial ledger rows`,
          );
        }
      }
      await probeR1P14Immutability(prisma);
    }
    if (expectedMigrationNames.includes(R1_P15_MIGRATION)) {
      const methodRows = await prisma.$queryRaw<
        Array<{
          code: string;
          enabled: boolean;
          provider: string;
          method_kind: string;
        }>
      >`
        SELECT pm."code"::text AS code,
          pm."enabled" AS enabled,
          pm."provider"::text AS provider,
          pm."method_kind"::text AS method_kind
        FROM "payment_methods" pm
        JOIN "countries" c ON c."id" = pm."country_id"
        WHERE c."code" = 'EG'
        ORDER BY pm."code"
      `;
      const byCode = new Map(methodRows.map((row) => [row.code, row]));
      const card = byCode.get("PAYMOB_CARD");
      const wallet = byCode.get("PAYMOB_WALLET");
      const other = byCode.get("OTHER_DISABLED");
      if (
        card === undefined ||
        card.enabled !== true ||
        card.provider !== "PAYMOB" ||
        card.method_kind !== "CARD"
      ) {
        throw new Error(
          "R1-P15 seed must enable Egypt Paymob CARD payment method",
        );
      }
      if (
        wallet === undefined ||
        wallet.enabled !== true ||
        wallet.provider !== "PAYMOB" ||
        wallet.method_kind !== "WALLET"
      ) {
        throw new Error(
          "R1-P15 seed must enable Egypt Paymob WALLET payment method",
        );
      }
      if (
        other === undefined ||
        other.enabled !== false ||
        other.provider !== "OTHER_DISABLED"
      ) {
        throw new Error(
          "R1-P15 seed must keep Egypt OTHER_DISABLED method disabled",
        );
      }
      for (const table of [
        "payments",
        "payment_attempts",
        "payment_gateway_events",
        "payment_receipts",
        "refund_requests",
      ] as const) {
        const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
          `SELECT count(*)::bigint AS total FROM "${table}"`,
        );
        if ((rows[0]?.total ?? 0n) !== 0n) {
          throw new Error(
            `R1-P15 seed must leave ${table} empty; found commercial payment rows`,
          );
        }
      }
    }
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

const R1_P13_IMMUTABILITY_ROLLBACK = "r1-p13-immutability-probe-rollback";

/** Live rewrite/delete of frozen booking snapshot and price-breakdown rows must raise 55000. */
async function probeR1P13Immutability(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        country_id TEXT;
      BEGIN
        SELECT c."id" INTO STRICT country_id
        FROM "countries" c
        WHERE c."code" = 'EG'
        LIMIT 1;

        INSERT INTO "users" (
          "id", "email_normalized", "email_verified_at", "account_categories",
          "verified_categories", "status", "updated_at"
        ) VALUES (
          'r1p13-proof-customer', 'r1p13-proof-customer@example.invalid', CURRENT_TIMESTAMP,
          ARRAY['INDIVIDUAL']::"AccountCategory"[], ARRAY['INDIVIDUAL']::"AccountCategory"[],
          'ACTIVE', CURRENT_TIMESTAMP
        );

        INSERT INTO "bookings" (
          "id", "customer_user_id", "country_id", "currency_code", "currency_decimal_places",
          "status", "path", "service_id", "provider_id", "team_id", "city_id",
          "starts_at", "ends_at", "crew_preference", "required_team_units", "locale",
          "deposit_percent", "updated_at"
        ) VALUES (
          'r1p13-proof-booking', 'r1p13-proof-customer', country_id, 'EGP', 2,
          'DRAFT', 'BROWSE', 'r1p13-proof-service', 'r1p13-proof-provider',
          'r1p13-proof-team', 'r1p13-proof-city',
          CURRENT_TIMESTAMP + INTERVAL '1 day',
          CURRENT_TIMESTAMP + INTERVAL '1 day 2 hours',
          'ANY', 1, 'EN', '25', CURRENT_TIMESTAMP
        );

        INSERT INTO "booking_snapshots" (
          "id", "booking_id", "catalog_snapshot_json", "provider_snapshot_json",
          "catalog_hash", "provider_hash", "price_input_hash", "frozen_at"
        ) VALUES (
          'r1p13-proof-snapshot', 'r1p13-proof-booking', '{}'::jsonb, '{}'::jsonb,
          'catalog', 'provider', 'price', CURRENT_TIMESTAMP
        );

        INSERT INTO "booking_price_breakdowns" (
          "id", "booking_id", "currency_code", "decimal_places",
          "gross_minor_units", "deposit_minor_units", "remainder_minor_units",
          "deposit_percent", "formula_version"
        ) VALUES (
          'r1p13-proof-breakdown', 'r1p13-proof-booking', 'EGP', 2,
          10000, 2500, 7500, '25', 'r1-p13'
        );

        BEGIN
          UPDATE "booking_snapshots"
          SET "catalog_hash" = 'mutated'
          WHERE "id" = 'r1p13-proof-snapshot';
          RAISE EXCEPTION 'accepted snapshot rewrite';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          DELETE FROM "booking_snapshots" WHERE "id" = 'r1p13-proof-snapshot';
          RAISE EXCEPTION 'accepted snapshot delete';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          UPDATE "booking_price_breakdowns"
          SET "gross_minor_units" = 1
          WHERE "id" = 'r1p13-proof-breakdown';
          RAISE EXCEPTION 'accepted breakdown rewrite';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          DELETE FROM "booking_price_breakdowns"
          WHERE "id" = 'r1p13-proof-breakdown';
          RAISE EXCEPTION 'accepted breakdown delete';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        RAISE EXCEPTION '%', '${R1_P13_IMMUTABILITY_ROLLBACK}';
      END $$;
    `);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (message.includes(R1_P13_IMMUTABILITY_ROLLBACK)) {
      return;
    }
    throw error;
  }
  throw new Error("R1-P13 immutability probe did not roll back after trigger checks");
}

const R1_P14_IMMUTABILITY_ROLLBACK = "r1-p14-immutability-probe-rollback";

/** Live rewrite/delete of frozen ledger entries, links, and snapshots must raise 55000. */
async function probeR1P14Immutability(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        account_id TEXT;
      BEGIN
        SELECT a."id" INTO STRICT account_id
        FROM "ledger_accounts" a
        JOIN "countries" c ON c."id" = a."country_id"
        WHERE c."code" = 'EG' AND a."account_type" = 'PLATFORM_CLEARING'
        LIMIT 1;

        INSERT INTO "ledger_entries" (
          "id", "journal_id", "account_id", "entry_type", "side",
          "amount_minor_units", "currency_code", "currency_decimal_places"
        ) VALUES (
          'r1p14-proof-entry', 'r1p14-proof-journal', account_id, 'DEPOSIT', 'DEBIT',
          2500, 'EGP', 2
        );

        INSERT INTO "ledger_entry_links" (
          "id", "journal_id", "entry_id", "kind", "booking_id"
        ) VALUES (
          'r1p14-proof-link', 'r1p14-proof-journal', 'r1p14-proof-entry',
          'BOOKING', 'r1p14-proof-booking'
        );

        INSERT INTO "financial_snapshots" (
          "id", "subject_kind", "booking_id", "currency_code", "currency_decimal_places",
          "debit_minor_units", "credit_net_minor_units", "derived_balance_minor_units",
          "entry_id_hash"
        ) VALUES (
          'r1p14-proof-snapshot', 'BOOKING', 'r1p14-proof-booking', 'EGP', 2,
          2500, 2500, 0, 'proof-hash'
        );

        BEGIN
          UPDATE "ledger_entries"
          SET "amount_minor_units" = 1
          WHERE "id" = 'r1p14-proof-entry';
          RAISE EXCEPTION 'accepted ledger entry rewrite';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          DELETE FROM "ledger_entries" WHERE "id" = 'r1p14-proof-entry';
          RAISE EXCEPTION 'accepted ledger entry delete';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          UPDATE "ledger_entry_links"
          SET "booking_id" = 'mutated'
          WHERE "id" = 'r1p14-proof-link';
          RAISE EXCEPTION 'accepted ledger link rewrite';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          DELETE FROM "ledger_entry_links" WHERE "id" = 'r1p14-proof-link';
          RAISE EXCEPTION 'accepted ledger link delete';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          UPDATE "financial_snapshots"
          SET "entry_id_hash" = 'mutated'
          WHERE "id" = 'r1p14-proof-snapshot';
          RAISE EXCEPTION 'accepted financial snapshot rewrite';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        BEGIN
          DELETE FROM "financial_snapshots" WHERE "id" = 'r1p14-proof-snapshot';
          RAISE EXCEPTION 'accepted financial snapshot delete';
        EXCEPTION
          WHEN SQLSTATE '55000' THEN NULL;
        END;

        RAISE EXCEPTION '%', '${R1_P14_IMMUTABILITY_ROLLBACK}';
      END $$;
    `);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (message.includes(R1_P14_IMMUTABILITY_ROLLBACK)) {
      return;
    }
    throw error;
  }
  throw new Error("R1-P14 immutability probe did not roll back after trigger checks");
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

  const configuredConnectionString = requireR1P15ProofDatabaseUrl();
  const proofUrl = new URL(configuredConnectionString);
  const proofSchema = `cleanora_r1_p15_proof_${process.pid}_${Date.now()}`;
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(proofSchema)) {
    throw new Error("Disposable proof identifier is invalid");
  }
  proofUrl.searchParams.set("schema", proofSchema);
  proofUrl.searchParams.set("options", `-c search_path=${proofSchema}`);
  const connectionString = proofUrl.toString();
  const admin = createMigrationProofPrismaClient(configuredConnectionString);
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${proofSchema}"`);
  } finally {
    await admin.$disconnect();
  }
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
    `Applied all migrations in isolated schema ${proofSchema}; verified exact ${String(expectedPostDeployTables.length)} tables, ${String(migrationNames.length)}-migration history, double-seed idempotency, empty R1-P09/R1-P10 phase tables, empty Eligibility evaluation trees with seeded rule versions, empty booking commercial tables with seeded status_transition_rules, eight Egypt system ledger accounts, empty commercial ledger journals, Egypt Paymob CARD+WALLET enabled methods, empty commercial payment tables, live snapshot/price-breakdown and ledger immutability triggers, and live R1-P05/R1-P06/R1-P07/R1-P08/R1-P09 constraint probes.`,
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

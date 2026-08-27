import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { seed } from "../prisma/seed.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  assertAppliedMigration,
  assertExactPostDeployTables,
  assertPostDeployState,
  assertR1P07DisposableDatabaseUrl,
  assertR1P07MigrationSql,
  createMigrationProofPrismaClient,
  type MigrationHistoryRow,
} from "./validate-clean-migration.js";

const executeFile = promisify(execFile);

export const R1_P07_MIGRATION = "r1_p07_worker_team_crew_management";
export const R1_P06_UPGRADE_BASELINE_MIGRATIONS = [
  "r1_p01_foundation_country_configuration",
  "r1_p02_complete_authentication",
  "r1_p02_email_verification_for_individuals",
  "r1_p02_fix_phone_e164_constraint",
  "r1_p02_google_provider_profile_claims",
  "r1_p03_roles_permissions_privileged_audit",
  "r1_p03a_production_role_provisioning",
  "r1_p03a_production_role_provisioning_drop",
  "r1_p04_customer_profiles_preferences_text_addresses",
  "r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage",
  "r1_p04a_category_aware_customer_signup_verification",
  "r1_p05_provider_onboarding_profile_lifecycle",
  "r1_p06_provider_verification_external_payout_destinations",
] as const;

const FIXTURE = {
  ownerUserId: "r1p07-upgrade-owner",
  adminUserId: "r1p07-upgrade-admin",
  providerId: "r1p07-upgrade-provider",
  providerProfileId: "r1p07-upgrade-provider-profile",
  ownerMemberId: "r1p07-upgrade-owner-member",
  adminMemberId: "r1p07-upgrade-admin-member",
  logoMediaId: "r1p07-upgrade-provider-logo",
  outboxId: "r1p07-upgrade-provider-outbox",
  documentChainId: "r1p07-upgrade-document-chain",
  documentVersionId: "r1p07-upgrade-document-version",
  documentMediaId: "r1p07-upgrade-document-media",
  documentEvidenceId: "r1p07-upgrade-document-evidence",
  documentReviewId: "r1p07-upgrade-document-review",
  verificationHistoryId: "r1p07-upgrade-verification-history",
  payoutOperatorId: "r1p07-upgrade-payout-operator",
  payoutChainId: "r1p07-upgrade-payout-chain",
  payoutClaimId: "r1p07-upgrade-payout-claim",
  payoutFingerprintId: "r1p07-upgrade-payout-fingerprint",
  payoutVersionId: "r1p07-upgrade-payout-version",
  payoutHistoryId: "r1p07-upgrade-payout-history",
} as const;

export function assertR1P06UpgradeBaselineHistory(
  rows: readonly MigrationHistoryRow[],
): void {
  const expected = new Set<string>(R1_P06_UPGRADE_BASELINE_MIGRATIONS);
  const unexpected = rows.filter((row) => !expected.has(row.migration_name));
  if (unexpected.length > 0) {
    throw new Error(
      `R1-P06 upgrade baseline contains unexpected migrations: ${unexpected.map((row) => row.migration_name).join(", ")}`,
    );
  }
  for (const migrationName of R1_P06_UPGRADE_BASELINE_MIGRATIONS) {
    const matching = rows.filter((row) => row.migration_name === migrationName);
    const row = matching[0];
    if (matching.length !== 1 || row === undefined || row.finished_at === null || row.rolled_back_at !== null) {
      throw new Error(
        `R1-P06 upgrade baseline must contain exactly one successful ${migrationName} row; found ${String(matching.length)}`,
      );
    }
  }
}

function schemaConnectionString(base: string, schema: string): string {
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  url.searchParams.set("options", `-c search_path=${schema}`);
  return url.toString();
}

function quotedIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value)) throw new Error("Disposable proof identifier is invalid");
  return `"${value}"`;
}

function assertWorkspaceProofDirectory(directory: string): void {
  const resolvedDirectory = resolve(directory);
  const workspacePrefix = `${resolve(process.cwd())}\\`;
  if (!resolvedDirectory.startsWith(workspacePrefix)
      || !resolvedDirectory.slice(workspacePrefix.length).startsWith(".r1-p07-upgrade-")) {
    throw new Error(`Unexpected R1-P07 upgrade-proof directory: ${resolvedDirectory}`);
  }
}

async function readMigrationHistory(prisma: PrismaClient): Promise<MigrationHistoryRow[]> {
  return prisma.$queryRaw<MigrationHistoryRow[]>`
    SELECT migration_name::text AS migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
  `;
}

async function readBaseTables(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((row) => row.table_name);
}

export interface BaselineTableDigest {
  readonly rowCount: number;
  readonly digest: string;
}

export async function readR1P06BaselineDigests(
  prisma: PrismaClient,
  requestedTables?: Iterable<string>,
): Promise<ReadonlyMap<string, BaselineTableDigest>> {
  const availableTables = (await readBaseTables(prisma)).filter(
    (table) => table !== "_prisma_migrations",
  );
  const availableTableSet = new Set(availableTables);
  const tables = requestedTables === undefined
    ? availableTables
    : [...requestedTables];
  const result = new Map<string, BaselineTableDigest>();
  for (const table of tables) {
    if (!availableTableSet.has(table)) {
      throw new Error(`R1-P06 baseline table is missing after R1-P07 upgrade: ${table}`);
    }
    const rowExpression = table === "providers"
      ? "to_jsonb(value) - 'workforce_state_version'"
      : table === "provider_members"
        ? "to_jsonb(value) - 'version'"
        : "to_jsonb(value)";
    const rows = await prisma.$queryRawUnsafe<Array<{ row_count: bigint; digest: string }>>(`
      SELECT count(*)::bigint AS row_count,
        md5(COALESCE(string_agg((${rowExpression})::text, '' ORDER BY (${rowExpression})::text), '')) AS digest
      FROM ${quotedIdentifier(table)} AS value
    `);
    const row = rows[0];
    if (row === undefined) throw new Error(`Could not digest baseline table ${table}`);
    result.set(table, { rowCount: Number(row.row_count), digest: row.digest });
  }
  return result;
}

export function assertBaselineDigestsPreserved(
  before: ReadonlyMap<string, BaselineTableDigest>,
  after: ReadonlyMap<string, BaselineTableDigest>,
): void {
  if (before.size !== after.size) throw new Error("R1-P06 baseline table inventory changed during R1-P07 upgrade");
  for (const [table, expected] of before) {
    const actual = after.get(table);
    if (actual === undefined || actual.rowCount !== expected.rowCount || actual.digest !== expected.digest) {
      throw new Error(`R1-P06 baseline data changed during R1-P07 upgrade: ${table}`);
    }
  }
}

async function populateR1P06Fixture(prisma: PrismaClient): Promise<void> {
  await seed(prisma);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "users" (
      "id", "email_normalized", "email_verified_at", "account_categories",
      "verified_categories", "status", "updated_at"
    ) VALUES
      ('${FIXTURE.ownerUserId}', 'r1p07-upgrade-owner@example.invalid', CURRENT_TIMESTAMP,
       ARRAY['COMPANY','PROVIDER_OWNER']::"AccountCategory"[], ARRAY['COMPANY','PROVIDER_OWNER']::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP),
      ('${FIXTURE.adminUserId}', 'r1p07-upgrade-admin@example.invalid', CURRENT_TIMESTAMP,
       ARRAY[]::"AccountCategory"[], ARRAY[]::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP);

    INSERT INTO "company_profiles" (
      "id", "user_id", "company_name", "representative_full_name", "updated_at"
    ) VALUES (
      'r1p07-upgrade-company-profile', '${FIXTURE.ownerUserId}',
      'R1-P07 Upgrade Company', 'R1-P07 Upgrade Owner', CURRENT_TIMESTAMP
    );

    INSERT INTO "user_preferences" (
      "id", "user_id", "language", "reminders_sms", "reminders_push",
      "promotional_sms", "promotional_push", "version", "updated_at"
    ) VALUES
      ('r1p07-upgrade-owner-preferences', '${FIXTURE.ownerUserId}', 'AR', true, false, false, true, 3, CURRENT_TIMESTAMP),
      ('r1p07-upgrade-admin-preferences', '${FIXTURE.adminUserId}', 'EN', false, true, true, false, 2, CURRENT_TIMESTAMP);

    INSERT INTO "providers" (
      "id", "application_owner_user_id", "owner_user_id", "kind", "application_status",
      "operational_status", "review_cycle", "version", "approved_at", "updated_at"
    ) VALUES (
      '${FIXTURE.providerId}', '${FIXTURE.ownerUserId}', '${FIXTURE.ownerUserId}',
      'REGISTERED_COMPANY', 'APPROVED', 'LIVE', 2, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_profiles" (
      "id", "provider_id", "display_name_en", "country_id", "updated_at"
    ) SELECT
      '${FIXTURE.providerProfileId}', '${FIXTURE.providerId}', 'R1-P07 Upgrade Provider', c."id", CURRENT_TIMESTAMP
    FROM "countries" c WHERE c."code" = 'EG';

    INSERT INTO "provider_members" (
      "id", "provider_id", "user_id", "level", "status", "invited_by_user_id",
      "enabled_at", "updated_at"
    ) VALUES
      ('${FIXTURE.ownerMemberId}', '${FIXTURE.providerId}', '${FIXTURE.ownerUserId}', 'OWNER', 'ACTIVE', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('${FIXTURE.adminMemberId}', '${FIXTURE.providerId}', '${FIXTURE.adminUserId}', 'ADMIN', 'ACTIVE', '${FIXTURE.ownerUserId}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO "media_files" (
      "id", "owner_user_id", "owner_type", "storage_provider", "storage_key", "content_type", "byte_size", "status", "updated_at"
    ) VALUES (
      '${FIXTURE.logoMediaId}', '${FIXTURE.ownerUserId}', 'PROVIDER_LOGO',
      'CLOUDINARY', 'r1p07-upgrade/provider-logo.webp', 'image/webp', 2048, 'READY', CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_email_outbox" (
      "id", "provider_id", "template", "status", "recipient_user_id", "review_cycle",
      "idempotency_key", "attempt_count", "updated_at"
    ) VALUES (
      '${FIXTURE.outboxId}', '${FIXTURE.providerId}', 'APPROVED', 'PENDING',
      '${FIXTURE.ownerUserId}', 2, 'r1p07-upgrade-provider-outbox', 0, CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_document_chains" (
      "id", "provider_id", "document_type_id", "updated_at"
    ) SELECT
      '${FIXTURE.documentChainId}', '${FIXTURE.providerId}', t."id", CURRENT_TIMESTAMP
    FROM "verification_document_types" t ORDER BY t."code" LIMIT 1;

    INSERT INTO "provider_document_versions" (
      "id", "chain_id", "provider_id", "sequence", "status", "country_code",
      "document_number", "legal_name", "issuer_name", "issue_date", "evidence_format",
      "created_by_user_id", "idempotency_key", "updated_at"
    ) VALUES (
      '${FIXTURE.documentVersionId}', '${FIXTURE.documentChainId}', '${FIXTURE.providerId}', 1,
      'DRAFT', 'EG', 'R1P07-UPGRADE-DOC-001', 'R1-P07 Upgrade Company',
      'Synthetic Upgrade Authority', DATE '2026-01-01', 'PDF', '${FIXTURE.ownerUserId}',
      'r1p07-upgrade-document-version', CURRENT_TIMESTAMP
    );

    INSERT INTO "media_files" (
      "id", "owner_user_id", "owner_type", "storage_provider", "storage_key", "content_type", "byte_size", "status",
      "verification_page_count", "verification_provider_id", "verification_document_version_id", "updated_at"
    ) VALUES (
      '${FIXTURE.documentMediaId}', '${FIXTURE.ownerUserId}', 'PROVIDER_VERIFICATION_DOCUMENT_PAGE',
      'CLOUDINARY', 'r1p07-upgrade/verification-document.pdf', 'application/pdf', 4096, 'READY', 1,
      '${FIXTURE.providerId}', '${FIXTURE.documentVersionId}', CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_document_evidence" (
      "id", "document_version_id", "media_file_id", "position", "canonical_content_type",
      "byte_size", "page_count", "expected_document_version", "bound_by_user_id", "idempotency_key"
    ) VALUES (
      '${FIXTURE.documentEvidenceId}', '${FIXTURE.documentVersionId}', '${FIXTURE.documentMediaId}',
      0, 'application/pdf', 4096, 1, 1, '${FIXTURE.ownerUserId}', 'r1p07-upgrade-document-evidence'
    );

    INSERT INTO "provider_document_reviews" (
      "id", "provider_id", "document_version_id", "outcome", "reason", "actor_user_id",
      "request_id", "expected_document_version", "operation_key"
    ) VALUES (
      '${FIXTURE.documentReviewId}', '${FIXTURE.providerId}', '${FIXTURE.documentVersionId}',
      'REJECT', 'Synthetic preserved review reason', '${FIXTURE.adminUserId}',
      'r1p07-upgrade-document-review-request', 1, 'r1p07-upgrade-document-review'
    );

    INSERT INTO "provider_verification_history" (
      "id", "provider_id", "document_version_id", "event", "to_status", "actor_type",
      "actor_user_id", "request_id", "exact_version", "operation_key"
    ) VALUES (
      '${FIXTURE.verificationHistoryId}', '${FIXTURE.providerId}', '${FIXTURE.documentVersionId}',
      'DOCUMENT_DRAFT_CREATED', 'DRAFT', 'USER', '${FIXTURE.ownerUserId}',
      'r1p07-upgrade-verification-history-request', 1, 'r1p07-upgrade-verification-history'
    );

    INSERT INTO "payout_operators" (
      "id", "country_id", "code", "label_ar", "label_en", "updated_at"
    ) SELECT
      '${FIXTURE.payoutOperatorId}', c."id", 'R1P07_UPGRADE_OPERATOR',
      'R1-P07 Upgrade Operator', 'R1-P07 Upgrade Operator', CURRENT_TIMESTAMP
    FROM "countries" c WHERE c."code" = 'EG';

    INSERT INTO "provider_payout_destination_chains" (
      "id", "provider_id", "destination_type_id", "updated_at"
    ) SELECT
      '${FIXTURE.payoutChainId}', '${FIXTURE.providerId}', t."id", CURRENT_TIMESTAMP
    FROM "payout_destination_types" t WHERE t."code" = 'MOBILE_WALLET';

    INSERT INTO "provider_payout_identity_claims" (
      "id", "provider_id", "chain_id", "kind", "country_code", "calling_code",
      "last_four", "identifier_length", "status", "updated_at"
    ) VALUES (
      '${FIXTURE.payoutClaimId}', '${FIXTURE.providerId}', '${FIXTURE.payoutChainId}',
      'MOBILE_WALLET', 'EG', '20', '0707', 13, 'ACTIVE', CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_payout_lookup_fingerprints" (
      "id", "claim_id", "lookup_key_id", "fingerprint", "claim_status"
    ) VALUES (
      '${FIXTURE.payoutFingerprintId}', '${FIXTURE.payoutClaimId}', 'r1p07-upgrade-lookup-key',
      repeat('7', 64), 'ACTIVE'
    );

    INSERT INTO "provider_payout_destination_versions" (
      "id", "chain_id", "provider_id", "identity_claim_id", "sequence", "kind", "status",
      "country_id", "country_code", "operator_id", "holder_relationship",
      "identifier_ciphertext", "identifier_nonce", "identifier_tag", "identifier_encryption_key_id",
      "holder_name_ciphertext", "holder_name_nonce", "holder_name_tag", "holder_name_encryption_key_id",
      "created_by_user_id", "idempotency_key", "updated_at"
    ) SELECT
      '${FIXTURE.payoutVersionId}', '${FIXTURE.payoutChainId}', '${FIXTURE.providerId}',
      '${FIXTURE.payoutClaimId}', 1, 'MOBILE_WALLET', 'DRAFT', c."id", 'EG',
      '${FIXTURE.payoutOperatorId}', 'PROVIDER_OWNER', 'r1p07-upgrade-identifier-ciphertext',
      '1234567890123456', '1234567890123456789012', 'r1p07-upgrade-encryption-key',
      'r1p07-upgrade-holder-ciphertext', '6543210987654321', '2109876543210987654321',
      'r1p07-upgrade-encryption-key', '${FIXTURE.ownerUserId}',
      'r1p07-upgrade-payout-version', CURRENT_TIMESTAMP
    FROM "countries" c WHERE c."code" = 'EG';

    UPDATE "provider_payout_destination_chains"
    SET "current_version_id" = '${FIXTURE.payoutVersionId}', "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = '${FIXTURE.payoutChainId}';

    INSERT INTO "provider_payout_history" (
      "id", "provider_id", "chain_id", "destination_version_id", "event", "to_status",
      "actor_type", "actor_user_id", "safe_mask", "request_id", "exact_version", "operation_key"
    ) VALUES (
      '${FIXTURE.payoutHistoryId}', '${FIXTURE.providerId}', '${FIXTURE.payoutChainId}',
      '${FIXTURE.payoutVersionId}', 'DESTINATION_DRAFT_CREATED', 'DRAFT', 'USER',
      '${FIXTURE.ownerUserId}', '+20*******0707', 'r1p07-upgrade-payout-history-request',
      1, 'r1p07-upgrade-payout-history'
    );
  `);
}

async function assertR1P07UpgradeDefaultsAndCompatibility(prisma: PrismaClient): Promise<void> {
  const [providers, members, workforceRows, oldOutboxRows, fixtureRows] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; workforce_state_version: number }>>`
      SELECT id::text AS id, workforce_state_version FROM "providers"
    `,
    prisma.$queryRaw<Array<{ id: string; version: number }>>`
      SELECT id::text AS id, version FROM "provider_members"
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT (
        (SELECT count(*) FROM "provider_workers")
        + (SELECT count(*) FROM "provider_worker_profiles")
        + (SELECT count(*) FROM "provider_worker_skills")
        + (SELECT count(*) FROM "provider_worker_login_access")
        + (SELECT count(*) FROM "provider_worker_invitations")
        + (SELECT count(*) FROM "provider_teams")
        + (SELECT count(*) FROM "provider_team_memberships")
        + (SELECT count(*) FROM "provider_workforce_history")
        + (SELECT count(*) FROM "provider_workforce_commands")
        + (SELECT count(*) FROM "provider_workforce_notification_intents")
      )::bigint AS total
    `,
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id FROM "provider_email_outbox"
      WHERE status = 'PENDING' ORDER BY created_at, id
    `,
    prisma.$queryRaw<Array<{ provider_id: string; owner_count: bigint; admin_count: bigint; document_count: bigint; payout_count: bigint }>>`
      SELECT p.id::text AS provider_id,
        (SELECT count(*) FROM "provider_members" m WHERE m.provider_id = p.id AND m.level = 'OWNER' AND m.status = 'ACTIVE')::bigint AS owner_count,
        (SELECT count(*) FROM "provider_members" m WHERE m.provider_id = p.id AND m.level = 'ADMIN' AND m.status = 'ACTIVE')::bigint AS admin_count,
        (SELECT count(*) FROM "provider_document_versions" d WHERE d.provider_id = p.id)::bigint AS document_count,
        (SELECT count(*) FROM "provider_payout_destination_versions" v WHERE v.provider_id = p.id)::bigint AS payout_count
      FROM "providers" p WHERE p.id = ${FIXTURE.providerId}
    `,
  ]);
  if (providers.length === 0 || providers.some((row) => row.workforce_state_version !== 1)) {
    throw new Error("R1-P07 Provider workforce_state_version backfill/default is not exactly 1");
  }
  if (members.length === 0 || members.some((row) => row.version !== 1)) {
    throw new Error("R1-P07 ProviderMember version backfill/default is not exactly 1");
  }
  if (workforceRows[0]?.total !== 0n) throw new Error("R1-P07 workforce tables were not empty after upgrade");
  if (!oldOutboxRows.some((row) => row.id === FIXTURE.outboxId)) {
    throw new Error("R1-P06 Provider email outbox query no longer returns the populated fixture");
  }
  const fixture = fixtureRows[0];
  if (fixture === undefined || fixture.provider_id !== FIXTURE.providerId
      || fixture.owner_count !== 1n || fixture.admin_count !== 1n
      || fixture.document_count !== 1n || fixture.payout_count !== 1n) {
    throw new Error("Populated R1-P06 authority/document/payout fixture was not preserved");
  }
}

async function writePrismaConfig(directory: string, migrationsPath: string): Promise<string> {
  const configPath = join(directory, "prisma.config.ts");
  const schemaPath = resolve(process.cwd(), "prisma", "schema.prisma");
  await writeFile(configPath, [
    'import { defineConfig } from "prisma/config";',
    "export default defineConfig({",
    `  schema: ${JSON.stringify(schemaPath)},`,
    `  migrations: { path: ${JSON.stringify(migrationsPath)} },`,
    '  datasource: { url: process.env["DATABASE_URL"]! },',
    "});",
    "",
  ].join("\n"), "utf8");
  return configPath;
}

async function deploy(configPath: string, connectionString: string): Promise<void> {
  const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  await executeFile(process.execPath, [prismaCli, "migrate", "deploy", "--config", configPath], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: connectionString },
  });
}

async function run(): Promise<void> {
  const configuredConnectionString = process.env["TEST_MIGRATION_DATABASE_URL"];
  if (configuredConnectionString === undefined || configuredConnectionString.length === 0) {
    throw new Error("TEST_MIGRATION_DATABASE_URL is required for the R1-P06-to-R1-P07 upgrade proof");
  }
  assertR1P07DisposableDatabaseUrl(configuredConnectionString);

  const migrationRoot = resolve(process.cwd(), "prisma", "migrations");
  const entries = await readdir(migrationRoot, { withFileTypes: true });
  const directoryNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const expected = new Set<string>([...R1_P06_UPGRADE_BASELINE_MIGRATIONS, R1_P07_MIGRATION]);
  const missing = [...expected].filter((name) => !directoryNames.includes(name));
  const unexpected = directoryNames.filter((name) => !expected.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(`Upgrade migration inventory differs; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`);
  }
  const migrationSql = await readFile(join(migrationRoot, R1_P07_MIGRATION, "migration.sql"), "utf8");
  assertR1P07MigrationSql(migrationSql);

  const proofSchema = `cleanora_r1_p07_upgrade_proof_${process.pid}_${Date.now()}`;
  const connectionString = schemaConnectionString(configuredConnectionString, proofSchema);
  const admin = createMigrationProofPrismaClient(configuredConnectionString);
  const temporaryRoot = await mkdtemp(join(process.cwd(), ".r1-p07-upgrade-"));
  assertWorkspaceProofDirectory(temporaryRoot);
  const temporaryMigrations = join(temporaryRoot, "migrations");
  await mkdir(temporaryMigrations);
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA ${quotedIdentifier(proofSchema)}`);
    for (const migrationName of R1_P06_UPGRADE_BASELINE_MIGRATIONS) {
      await cp(join(migrationRoot, migrationName), join(temporaryMigrations, migrationName), { recursive: true });
    }
    const configPath = await writePrismaConfig(temporaryRoot, temporaryMigrations);
    await deploy(configPath, connectionString);

    const baseline = createMigrationProofPrismaClient(connectionString);
    let before: ReadonlyMap<string, BaselineTableDigest>;
    try {
      assertR1P06UpgradeBaselineHistory(await readMigrationHistory(baseline));
      await populateR1P06Fixture(baseline);
      before = await readR1P06BaselineDigests(baseline);
    } finally {
      await baseline.$disconnect();
    }

    await cp(join(migrationRoot, R1_P07_MIGRATION), join(temporaryMigrations, R1_P07_MIGRATION), { recursive: true });
    await deploy(configPath, connectionString);
    await deploy(configPath, connectionString);

    const upgraded = createMigrationProofPrismaClient(connectionString);
    try {
      assertAppliedMigration(await readMigrationHistory(upgraded));
      assertExactPostDeployTables(await readBaseTables(upgraded));
      const after = await readR1P06BaselineDigests(upgraded, before.keys());
      assertBaselineDigestsPreserved(before, after);
      await assertR1P07UpgradeDefaultsAndCompatibility(upgraded);
    } finally {
      await upgraded.$disconnect();
    }
    await assertPostDeployState(connectionString);
    console.info(
      `Upgraded populated R1-P06 fixture in isolated schema ${proofSchema}; preserved all baseline table digests, authority, preferences, Media, outbox, verification, payout data, and verified R1-P07 defaults, empty workforce state, history, idempotent re-deploy, and live constraints.`,
    );
  } finally {
    await admin.$disconnect();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "R1-P07 upgrade validation failed";
    console.error(`R1-P07 upgrade validation failed: ${message}`);
    process.exitCode = 1;
  });
}

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
  assertR1P08MigrationSql,
  createMigrationProofPrismaClient,
  R1_P08_CATALOG_TABLES,
  R1_P08_MIGRATION,
  requireR1P08ProofDatabaseUrl,
  type MigrationHistoryRow,
} from "./validate-clean-migration.js";

const executeFile = promisify(execFile);

export const R1_P07_UPGRADE_BASELINE_MIGRATIONS = [
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
  "r1_p07_worker_team_crew_management",
] as const;

export {
  APPROVED_R1_P08_TARGET_PATTERN,
  assertR1P08DisposableDatabaseUrl,
  assertR1P08MigrationSql,
  R1_P08_CATALOG_TABLES,
  R1_P08_MIGRATION,
  requireR1P08ProofDatabaseUrl,
} from "./validate-clean-migration.js";

const FIXTURE = {
  ownerUserId: "r1p08-upgrade-owner",
  providerId: "r1p08-upgrade-provider",
  workerId: "r1p08-upgrade-worker",
  teamId: "r1p08-upgrade-team",
  membershipId: "r1p08-upgrade-membership",
} as const;

export function assertR1P07UpgradeBaselineHistory(
  rows: readonly MigrationHistoryRow[],
): void {
  const expected = new Set<string>(R1_P07_UPGRADE_BASELINE_MIGRATIONS);
  const unexpected = rows.filter((row) => !expected.has(row.migration_name));
  if (unexpected.length > 0) {
    throw new Error(
      `R1-P07 upgrade baseline contains unexpected migrations: ${unexpected.map((row) => row.migration_name).join(", ")}`,
    );
  }
  for (const migrationName of R1_P07_UPGRADE_BASELINE_MIGRATIONS) {
    const matching = rows.filter((row) => row.migration_name === migrationName);
    const row = matching[0];
    if (matching.length !== 1 || row === undefined || row.finished_at === null || row.rolled_back_at !== null) {
      throw new Error(
        `R1-P07 upgrade baseline must contain exactly one successful ${migrationName} row; found ${String(matching.length)}`,
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
      || !resolvedDirectory.slice(workspacePrefix.length).startsWith(".r1-p08-upgrade-")) {
    throw new Error(`Unexpected R1-P08 upgrade-proof directory: ${resolvedDirectory}`);
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

export async function readR1P07BaselineDigests(
  prisma: PrismaClient,
  requestedTables?: Iterable<string>,
): Promise<ReadonlyMap<string, BaselineTableDigest>> {
  const catalogTableSet = new Set<string>(R1_P08_CATALOG_TABLES);
  const availableTables = (await readBaseTables(prisma)).filter(
    (table) => table !== "_prisma_migrations" && !catalogTableSet.has(table),
  );
  const availableTableSet = new Set(availableTables);
  const tables = requestedTables === undefined ? availableTables : [...requestedTables];
  const result = new Map<string, BaselineTableDigest>();
  for (const table of tables) {
    if (!availableTableSet.has(table)) {
      throw new Error(`R1-P07 baseline table is missing before R1-P08 upgrade: ${table}`);
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
  if (before.size !== after.size) throw new Error("R1-P07 baseline table inventory changed during R1-P08 upgrade");
  for (const [table, expected] of before) {
    const actual = after.get(table);
    if (actual === undefined || actual.rowCount !== expected.rowCount || actual.digest !== expected.digest) {
      throw new Error(`R1-P07 baseline data changed during R1-P08 upgrade: ${table}`);
    }
  }
}

async function populateR1P07Fixture(prisma: PrismaClient): Promise<void> {
  await seed(prisma, { skipCatalogSeed: true, skipCatalogAuth: true });
  await prisma.$executeRawUnsafe(`
    INSERT INTO "users" (
      "id", "email_normalized", "email_verified_at", "account_categories",
      "verified_categories", "status", "updated_at"
    ) VALUES (
      '${FIXTURE.ownerUserId}', 'r1p08-upgrade-owner@example.invalid', CURRENT_TIMESTAMP,
      ARRAY['PROVIDER_OWNER']::"AccountCategory"[], ARRAY['PROVIDER_OWNER']::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP
    );

    INSERT INTO "providers" (
      "id", "application_owner_user_id", "owner_user_id", "kind", "application_status",
      "operational_status", "approved_at", "updated_at"
    ) VALUES (
      '${FIXTURE.providerId}', '${FIXTURE.ownerUserId}', '${FIXTURE.ownerUserId}',
      'INDIVIDUAL_TEAM', 'APPROVED', 'LIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_profiles" (
      "id", "provider_id", "display_name_en", "country_id", "updated_at"
    ) SELECT
      'r1p08-upgrade-provider-profile', '${FIXTURE.providerId}', 'R1-P08 Upgrade Provider', c."id", CURRENT_TIMESTAMP
    FROM "countries" c WHERE c."code" = 'EG';

    INSERT INTO "provider_workers" (
      "id", "provider_id", "identity_user_id", "status", "updated_at"
    ) VALUES (
      '${FIXTURE.workerId}', '${FIXTURE.providerId}', '${FIXTURE.ownerUserId}', 'ACTIVE', CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_worker_profiles" (
      "worker_id", "full_legal_name", "gender", "operational_phone_e164", "worker_type",
      "supervisor_capable", "updated_at"
    ) VALUES (
      '${FIXTURE.workerId}', 'R1-P08 Upgrade Worker', 'FEMALE', '+201000000808', 'CLEANING_STAFF', false, CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_teams" (
      "id", "provider_id", "name", "normalized_name", "status", "updated_at"
    ) VALUES (
      '${FIXTURE.teamId}', '${FIXTURE.providerId}', 'R1-P08 Upgrade Crew', 'r1-p08 upgrade crew', 'DRAFT', CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_team_memberships" (
      "id", "team_id", "worker_id", "cleans", "updated_at"
    ) VALUES (
      '${FIXTURE.membershipId}', '${FIXTURE.teamId}', '${FIXTURE.workerId}', true, CURRENT_TIMESTAMP
    );
  `);
}

async function assertR1P08UpgradeDefaults(prisma: PrismaClient): Promise<void> {
  for (const table of R1_P08_CATALOG_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total FROM ${quotedIdentifier(table)}`,
    );
    if ((rows[0]?.total ?? 0n) !== 0n) {
      throw new Error(`R1-P08 upgrade must leave ${table} empty before seed; found rows`);
    }
  }
  const workforceRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT (
      (SELECT count(*) FROM "provider_workers")
      + (SELECT count(*) FROM "provider_worker_profiles")
      + (SELECT count(*) FROM "provider_teams")
      + (SELECT count(*) FROM "provider_team_memberships")
    )::bigint AS total
  `;
  if ((workforceRows[0]?.total ?? 0n) < 4n) {
    throw new Error("Populated R1-P07 workforce fixture was not preserved after R1-P08 upgrade");
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
  const configuredConnectionString = requireR1P08ProofDatabaseUrl();

  const migrationRoot = resolve(process.cwd(), "prisma", "migrations");
  const entries = await readdir(migrationRoot, { withFileTypes: true });
  const directoryNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const expected = new Set<string>([...R1_P07_UPGRADE_BASELINE_MIGRATIONS, R1_P08_MIGRATION]);
  const missing = [...expected].filter((name) => !directoryNames.includes(name));
  const unexpected = directoryNames.filter(
    (name) =>
      !expected.has(name) &&
      name !== "r1_p09_provider_services_pricing_historical_snapshots",
  );
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(`Upgrade migration inventory differs; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`);
  }
  const migrationSql = await readFile(join(migrationRoot, R1_P08_MIGRATION, "migration.sql"), "utf8");
  assertR1P08MigrationSql(migrationSql);

  const proofSchema = `cleanora_r1_p08_upgrade_proof_${process.pid}_${Date.now()}`;
  const connectionString = schemaConnectionString(configuredConnectionString, proofSchema);
  const admin = createMigrationProofPrismaClient(configuredConnectionString);
  const temporaryRoot = await mkdtemp(join(process.cwd(), ".r1-p08-upgrade-"));
  assertWorkspaceProofDirectory(temporaryRoot);
  const temporaryMigrations = join(temporaryRoot, "migrations");
  await mkdir(temporaryMigrations);
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA ${quotedIdentifier(proofSchema)}`);
    for (const migrationName of R1_P07_UPGRADE_BASELINE_MIGRATIONS) {
      await cp(join(migrationRoot, migrationName), join(temporaryMigrations, migrationName), { recursive: true });
    }
    const configPath = await writePrismaConfig(temporaryRoot, temporaryMigrations);
    await deploy(configPath, connectionString);

    const baseline = createMigrationProofPrismaClient(connectionString);
    let before: ReadonlyMap<string, BaselineTableDigest>;
    try {
      assertR1P07UpgradeBaselineHistory(await readMigrationHistory(baseline));
      await populateR1P07Fixture(baseline);
      before = await readR1P07BaselineDigests(baseline);
    } finally {
      await baseline.$disconnect();
    }

    await cp(join(migrationRoot, R1_P08_MIGRATION), join(temporaryMigrations, R1_P08_MIGRATION), { recursive: true });
    await deploy(configPath, connectionString);
    await deploy(configPath, connectionString);

    const upgraded = createMigrationProofPrismaClient(connectionString);
    try {
      assertAppliedMigration(await readMigrationHistory(upgraded));
      assertExactPostDeployTables(await readBaseTables(upgraded));
      const after = await readR1P07BaselineDigests(upgraded, before.keys());
      assertBaselineDigestsPreserved(before, after);
      await assertR1P08UpgradeDefaults(upgraded);
    } finally {
      await upgraded.$disconnect();
    }
    await assertPostDeployState(connectionString);
    console.info(
      `Upgraded populated R1-P07 fixture in isolated schema ${proofSchema}; preserved all baseline table digests, workforce truth, empty Catalog tables before seed, idempotent re-deploy, DEC-044 seed counts, and live R1-P08 constraints.`,
    );
  } finally {
    await admin.$disconnect();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "R1-P08 upgrade validation failed";
    console.error(`R1-P08 upgrade validation failed: ${message}`);
    process.exitCode = 1;
  });
}

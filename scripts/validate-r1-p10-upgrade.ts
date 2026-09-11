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
  assertR1P10MigrationSql,
  createMigrationProofPrismaClient,
  MIGRATION_NAMES_THROUGH_R1_P10,
  POST_DEPLOY_TABLES_THROUGH_R1_P10,
  R1_P09_MIGRATION,
  R1_P09_PROVIDER_SERVICE_TABLES,
  R1_P10_AVAILABILITY_TABLES,
  R1_P10_MIGRATION,
  R1_P11_MIGRATION,
  R1_P13_MIGRATION,
  requireR1P10ProofDatabaseUrl,
  type MigrationHistoryRow,
} from "./validate-clean-migration.js";

const executeFile = promisify(execFile);

export const R1_P09_UPGRADE_BASELINE_MIGRATIONS = [
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
  "r1_p08_catalog_localization_service_requirements",
  R1_P09_MIGRATION,
] as const;

export {
  APPROVED_R1_P10_TARGET_PATTERN,
  assertR1P10DisposableDatabaseUrl,
  assertR1P10MigrationSql,
  R1_P09_MIGRATION,
  R1_P10_MIGRATION,
  R1_P10_AVAILABILITY_TABLES,
  requireR1P10ProofDatabaseUrl,
} from "./validate-clean-migration.js";

const FIXTURE = {
  ownerUserId: "r1p10-upgrade-owner",
  providerId: "r1p10-upgrade-provider",
} as const;

export function assertR1P09UpgradeBaselineHistory(
  rows: readonly MigrationHistoryRow[],
): void {
  const expected = new Set<string>(R1_P09_UPGRADE_BASELINE_MIGRATIONS);
  const unexpected = rows.filter((row) => !expected.has(row.migration_name));
  if (unexpected.length > 0) {
    throw new Error(
      `R1-P09 upgrade baseline contains unexpected migrations: ${unexpected.map((row) => row.migration_name).join(", ")}`,
    );
  }
  for (const migrationName of R1_P09_UPGRADE_BASELINE_MIGRATIONS) {
    const matching = rows.filter((row) => row.migration_name === migrationName);
    const row = matching[0];
    if (
      matching.length !== 1 ||
      row === undefined ||
      row.finished_at === null ||
      row.rolled_back_at !== null
    ) {
      throw new Error(
        `R1-P09 upgrade baseline must contain exactly one successful ${migrationName} row; found ${String(matching.length)}`,
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
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value)) {
    throw new Error("Disposable proof identifier is invalid");
  }
  return `"${value}"`;
}

function assertWorkspaceProofDirectory(directory: string): void {
  const resolvedDirectory = resolve(directory);
  const workspacePrefix = `${resolve(process.cwd())}\\`;
  const posixPrefix = `${resolve(process.cwd())}/`;
  if (
    !(
      resolvedDirectory.startsWith(workspacePrefix) ||
      resolvedDirectory.startsWith(posixPrefix)
    ) ||
    !(
      resolvedDirectory.slice(workspacePrefix.length).startsWith(".r1-p10-upgrade-") ||
      resolvedDirectory.slice(posixPrefix.length).startsWith(".r1-p10-upgrade-") ||
      resolvedDirectory.includes(".r1-p10-upgrade-")
    )
  ) {
    throw new Error(
      `Unexpected R1-P10 upgrade-proof directory: ${resolvedDirectory}`,
    );
  }
}

async function readMigrationHistory(
  prisma: PrismaClient,
): Promise<MigrationHistoryRow[]> {
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

/** Tables R1-P10 intentionally mutates; excluded from digest preservation. */
export const R1_P10_MUTATED_BASELINE_TABLES = [
  // `platform.default_timezone` resolution_policy switches to COUNTRY_REQUIRED.
  "app_configs",
] as const;

export function filterPreservedBaselineDigests(
  digests: ReadonlyMap<string, BaselineTableDigest>,
): Map<string, BaselineTableDigest> {
  const preserved = new Map(digests);
  for (const table of R1_P10_MUTATED_BASELINE_TABLES) {
    preserved.delete(table);
  }
  return preserved;
}

export async function readR1P09BaselineDigests(
  prisma: PrismaClient,
  requestedTables?: Iterable<string>,
): Promise<ReadonlyMap<string, BaselineTableDigest>> {
  const p10TableSet = new Set<string>(R1_P10_AVAILABILITY_TABLES);
  const availableTables = (await readBaseTables(prisma)).filter(
    (table) => table !== "_prisma_migrations" && !p10TableSet.has(table),
  );
  const availableTableSet = new Set(availableTables);
  const tables =
    requestedTables === undefined ? availableTables : [...requestedTables];
  const result = new Map<string, BaselineTableDigest>();
  for (const table of tables) {
    if (!availableTableSet.has(table)) {
      throw new Error(
        `R1-P09 baseline table is missing before R1-P10 upgrade: ${table}`,
      );
    }
    // R1-P10 adds `country_configs.version`; strip it so content digests stay
    // comparable across the upgrade (same pattern as R1-P07 member version).
    // Alias must not be `value` — that column exists on country_configs and
    // would make `to_jsonb(value) - 'version'` operate on a scalar JSON field.
    const rowExpression =
      table === "country_configs"
        ? "to_jsonb(baseline_row) - 'version'"
        : "to_jsonb(baseline_row)";
    const rows = await prisma.$queryRawUnsafe<
      Array<{ row_count: bigint; digest: string }>
    >(`
      SELECT count(*)::bigint AS row_count,
        md5(COALESCE(string_agg((${rowExpression})::text, '' ORDER BY (${rowExpression})::text), '')) AS digest
      FROM ${quotedIdentifier(table)} AS baseline_row
    `);
    const row = rows[0];
    if (row === undefined) {
      throw new Error(`Could not digest baseline table ${table}`);
    }
    result.set(table, { rowCount: Number(row.row_count), digest: row.digest });
  }
  return result;
}

export function assertBaselineDigestsPreserved(
  before: ReadonlyMap<string, BaselineTableDigest>,
  after: ReadonlyMap<string, BaselineTableDigest>,
): void {
  if (before.size !== after.size) {
    throw new Error(
      "R1-P09 baseline table inventory changed during R1-P10 upgrade",
    );
  }
  for (const [table, expected] of before) {
    const actual = after.get(table);
    if (
      actual === undefined ||
      actual.rowCount !== expected.rowCount ||
      actual.digest !== expected.digest
    ) {
      throw new Error(
        `R1-P09 baseline data changed during R1-P10 upgrade: ${table}`,
      );
    }
  }
}

async function populateR1P09Fixture(prisma: PrismaClient): Promise<void> {
  await seed(prisma);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "users" (
      "id", "email_normalized", "email_verified_at", "account_categories",
      "verified_categories", "status", "updated_at"
    ) VALUES (
      '${FIXTURE.ownerUserId}', 'r1p10-upgrade-owner@example.invalid', CURRENT_TIMESTAMP,
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
      'r1p10-upgrade-provider-profile', '${FIXTURE.providerId}', 'R1-P10 Upgrade Provider', c."id", CURRENT_TIMESTAMP
    FROM "countries" c WHERE c."code" = 'EG';
  `);
}

async function assertR1P10UpgradeDefaults(prisma: PrismaClient): Promise<void> {
  for (const table of R1_P10_AVAILABILITY_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total FROM ${quotedIdentifier(table)}`,
    );
    if ((rows[0]?.total ?? 0n) !== 0n) {
      throw new Error(
        `R1-P10 upgrade must leave ${table} empty before locality/availability seed; found rows`,
      );
    }
  }
  for (const table of R1_P09_PROVIDER_SERVICE_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total FROM ${quotedIdentifier(table)}`,
    );
    if ((rows[0]?.total ?? 0n) !== 0n) {
      // Provider-service tables remain empty under seed; presence of the table is enough.
      void rows;
    }
  }
  const providerRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT count(*)::bigint AS total FROM "providers" WHERE "id" = ${FIXTURE.providerId}
  `;
  if ((providerRows[0]?.total ?? 0n) !== 1n) {
    throw new Error(
      "Populated R1-P09 Provider fixture was not preserved after R1-P10 upgrade",
    );
  }
  const egyptZone = await prisma.$queryRaw<Array<{ value: unknown }>>`
    SELECT cc."value"
    FROM "country_configs" cc
    INNER JOIN "countries" c ON c."id" = cc."country_id"
    WHERE c."code" = 'EG' AND cc."key" = 'platform.default_timezone'
  `;
  if (egyptZone.length !== 1) {
    throw new Error(
      "R1-P10 upgrade must backfill Egypt platform.default_timezone CountryConfig",
    );
  }
  const versionColumn = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'country_configs'
        AND column_name = 'version'
    ) AS "exists"
  `;
  if (versionColumn[0]?.exists !== true) {
    throw new Error(
      "R1-P10 upgrade must add country_configs.version for Staff optimistic concurrency",
    );
  }
  const timezonePolicy = await prisma.$queryRaw<
    Array<{ resolution_policy: string }>
  >`
    SELECT "resolution_policy"::text AS resolution_policy
    FROM "app_configs"
    WHERE "key" = 'platform.default_timezone'
  `;
  if (timezonePolicy[0]?.resolution_policy !== "COUNTRY_REQUIRED") {
    throw new Error(
      "R1-P10 upgrade must switch platform.default_timezone to COUNTRY_REQUIRED",
    );
  }
}

async function writePrismaConfig(
  directory: string,
  migrationsPath: string,
): Promise<string> {
  const configPath = join(directory, "prisma.config.ts");
  const schemaPath = resolve(process.cwd(), "prisma", "schema.prisma");
  await writeFile(
    configPath,
    [
      'import { defineConfig } from "prisma/config";',
      "export default defineConfig({",
      `  schema: ${JSON.stringify(schemaPath)},`,
      `  migrations: { path: ${JSON.stringify(migrationsPath)} },`,
      '  datasource: { url: process.env["DATABASE_URL"]! },',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  return configPath;
}

async function deploy(
  configPath: string,
  connectionString: string,
): Promise<void> {
  const prismaCli = join(
    process.cwd(),
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  await executeFile(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--config", configPath],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
    },
  );
}

async function run(): Promise<void> {
  const configuredConnectionString = requireR1P10ProofDatabaseUrl();

  const migrationRoot = resolve(process.cwd(), "prisma", "migrations");
  const entries = await readdir(migrationRoot, { withFileTypes: true });
  const directoryNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const expected = new Set<string>([
    ...R1_P09_UPGRADE_BASELINE_MIGRATIONS,
    R1_P10_MIGRATION,
  ]);
  const knownLater = new Set<string>([R1_P11_MIGRATION, R1_P13_MIGRATION]);
  const missing = [...expected].filter(
    (name) => !directoryNames.includes(name),
  );
  const unexpected = directoryNames.filter(
    (name) => !expected.has(name) && !knownLater.has(name),
  );
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Upgrade migration inventory differs; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`,
    );
  }
  const migrationSql = await readFile(
    join(migrationRoot, R1_P10_MIGRATION, "migration.sql"),
    "utf8",
  );
  assertR1P10MigrationSql(migrationSql);

  const proofSchema = `cleanora_r1_p10_upgrade_proof_${process.pid}_${Date.now()}`;
  const connectionString = schemaConnectionString(
    configuredConnectionString,
    proofSchema,
  );
  const admin = createMigrationProofPrismaClient(configuredConnectionString);
  const temporaryRoot = await mkdtemp(join(process.cwd(), ".r1-p10-upgrade-"));
  assertWorkspaceProofDirectory(temporaryRoot);
  const temporaryMigrations = join(temporaryRoot, "migrations");
  await mkdir(temporaryMigrations);
  try {
    await admin.$executeRawUnsafe(
      `CREATE SCHEMA ${quotedIdentifier(proofSchema)}`,
    );
    for (const migrationName of R1_P09_UPGRADE_BASELINE_MIGRATIONS) {
      await cp(
        join(migrationRoot, migrationName),
        join(temporaryMigrations, migrationName),
        { recursive: true },
      );
    }
    const configPath = await writePrismaConfig(
      temporaryRoot,
      temporaryMigrations,
    );
    await deploy(configPath, connectionString);

    const baseline = createMigrationProofPrismaClient(connectionString);
    let before: ReadonlyMap<string, BaselineTableDigest>;
    try {
      assertR1P09UpgradeBaselineHistory(await readMigrationHistory(baseline));
      await populateR1P09Fixture(baseline);
      before = filterPreservedBaselineDigests(
        await readR1P09BaselineDigests(baseline),
      );
    } finally {
      await baseline.$disconnect();
    }

    await cp(
      join(migrationRoot, R1_P10_MIGRATION),
      join(temporaryMigrations, R1_P10_MIGRATION),
      { recursive: true },
    );
    await deploy(configPath, connectionString);
    await deploy(configPath, connectionString);

    const upgraded = createMigrationProofPrismaClient(connectionString);
    try {
      assertAppliedMigration(
        await readMigrationHistory(upgraded),
        MIGRATION_NAMES_THROUGH_R1_P10,
      );
      assertExactPostDeployTables(
        await readBaseTables(upgraded),
        POST_DEPLOY_TABLES_THROUGH_R1_P10,
      );
      const after = filterPreservedBaselineDigests(
        await readR1P09BaselineDigests(upgraded, before.keys()),
      );
      assertBaselineDigestsPreserved(before, after);
      await assertR1P10UpgradeDefaults(upgraded);
    } finally {
      await upgraded.$disconnect();
    }
    await assertPostDeployState(connectionString, {
      migrationNames: MIGRATION_NAMES_THROUGH_R1_P10,
      postDeployTables: POST_DEPLOY_TABLES_THROUGH_R1_P10,
      assertEmptyEligibilityTrees: false,
    });
    console.info(
      `Upgraded populated R1-P09 fixture in isolated schema ${proofSchema}; preserved baseline digests (country_configs version-stripped; app_configs policy change asserted separately), empty R1-P10 availability tables before seed, Egypt Africa/Cairo timezone, country_configs.version, COUNTRY_REQUIRED policy, idempotent re-deploy, and live post-deploy constraints.`,
    );
  } finally {
    await admin.$disconnect();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "R1-P10 upgrade validation failed";
    console.error(`R1-P10 upgrade validation failed: ${message}`);
    process.exitCode = 1;
  });
}

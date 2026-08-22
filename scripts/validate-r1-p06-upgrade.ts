import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  assertAppliedMigration,
  assertExactPostDeployTables,
  assertPostDeployState,
  assertR1P06MigrationSql,
  assertR1P06DisposableDatabaseUrl,
  createMigrationProofPrismaClient,
  type MigrationHistoryRow,
} from "./validate-clean-migration.js";

const executeFile = promisify(execFile);
export const R1_P06_MIGRATION =
  "r1_p06_provider_verification_external_payout_destinations";
export const R1_P05_UPGRADE_BASELINE_MIGRATIONS = [
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
] as const;

const UPGRADE_FIXTURE = {
  currencyId: "r1p06-upgrade-currency-egp",
  countryId: "r1p06-upgrade-country-eg",
  ownerUserId: "r1p06-upgrade-owner",
  providerId: "r1p06-upgrade-provider",
  profileId: "r1p06-upgrade-profile",
  memberId: "r1p06-upgrade-member",
} as const;

export function assertR1P05UpgradeBaselineHistory(
  rows: readonly MigrationHistoryRow[],
): void {
  const expected = new Set<string>(R1_P05_UPGRADE_BASELINE_MIGRATIONS);
  const unexpected = rows.filter(
    (row) => !expected.has(row.migration_name),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `R1-P05 upgrade baseline contains unexpected migrations: ${unexpected
        .map((row) => row.migration_name)
        .join(", ")}`,
    );
  }
  for (const migrationName of R1_P05_UPGRADE_BASELINE_MIGRATIONS) {
    const matching = rows.filter(
      (row) => row.migration_name === migrationName,
    );
    const row = matching[0];
    if (
      matching.length !== 1 ||
      row === undefined ||
      row.finished_at === null ||
      row.rolled_back_at !== null
    ) {
      throw new Error(
        `R1-P05 upgrade baseline must contain exactly one successful ${migrationName} row; found ${String(matching.length)}`,
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
    throw new Error("Disposable proof schema name is invalid");
  }
  return `"${value}"`;
}

function assertWorkspaceProofDirectory(directory: string): void {
  const resolvedDirectory = resolve(directory);
  const resolvedWorkspace = `${resolve(process.cwd())}\\`;
  if (
    !resolvedDirectory.startsWith(resolvedWorkspace) ||
    !resolvedDirectory.slice(resolvedWorkspace.length).startsWith(
      ".r1-p06-upgrade-",
    )
  ) {
    throw new Error(
      `Unexpected upgrade-proof directory: ${resolvedDirectory}`,
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

async function readPublicBaseTables(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((row) => row.table_name);
}

async function populateR1P05Fixture(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "currencies" (
      "id", "code", "name_en", "name_ar", "decimal_places", "updated_at"
    ) VALUES (
      '${UPGRADE_FIXTURE.currencyId}', 'EGP', 'Upgrade Egyptian Pound',
      'Upgrade Egyptian Pound', 2, CURRENT_TIMESTAMP
    );

    INSERT INTO "countries" (
      "id", "code", "name_en", "name_ar", "default_currency_id",
      "default_locale", "supported_locales", "updated_at"
    ) VALUES (
      '${UPGRADE_FIXTURE.countryId}', 'EG', 'Upgrade Egypt', 'Upgrade Egypt',
      '${UPGRADE_FIXTURE.currencyId}', 'en-EG', '["en-EG"]'::jsonb,
      CURRENT_TIMESTAMP
    );

    INSERT INTO "users" (
      "id", "email_normalized", "email_verified_at", "account_categories",
      "verified_categories", "status", "updated_at"
    ) VALUES (
      '${UPGRADE_FIXTURE.ownerUserId}', 'r1p06-upgrade-owner@example.invalid',
      CURRENT_TIMESTAMP,
      ARRAY['COMPANY', 'PROVIDER_OWNER']::"AccountCategory"[],
      ARRAY['COMPANY', 'PROVIDER_OWNER']::"AccountCategory"[],
      'ACTIVE', CURRENT_TIMESTAMP
    );

    INSERT INTO "company_profiles" (
      "id", "user_id", "company_name", "representative_full_name", "updated_at"
    ) VALUES (
      'r1p06-upgrade-company-profile', '${UPGRADE_FIXTURE.ownerUserId}',
      'R1-P06 Upgrade Company', 'R1-P06 Upgrade Owner', CURRENT_TIMESTAMP
    );

    INSERT INTO "providers" (
      "id", "application_owner_user_id", "owner_user_id", "kind",
      "application_status", "operational_status", "approved_at", "updated_at"
    ) VALUES (
      '${UPGRADE_FIXTURE.providerId}', '${UPGRADE_FIXTURE.ownerUserId}',
      '${UPGRADE_FIXTURE.ownerUserId}', 'REGISTERED_COMPANY', 'APPROVED',
      'LIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_profiles" (
      "id", "provider_id", "display_name_en", "country_id", "updated_at"
    ) VALUES (
      '${UPGRADE_FIXTURE.profileId}', '${UPGRADE_FIXTURE.providerId}',
      'R1-P06 Upgrade Fixture', '${UPGRADE_FIXTURE.countryId}', CURRENT_TIMESTAMP
    );

    INSERT INTO "provider_members" (
      "id", "provider_id", "user_id", "level", "status", "enabled_at", "updated_at"
    ) VALUES (
      '${UPGRADE_FIXTURE.memberId}', '${UPGRADE_FIXTURE.providerId}',
      '${UPGRADE_FIXTURE.ownerUserId}', 'OWNER', 'ACTIVE',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  `);
}

async function assertR1P05FixturePreserved(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      provider_id: string;
      owner_user_id: string | null;
      country_id: string | null;
      membership_level: string;
      payout_primary_state_version: number;
    }>
  >`
    SELECT
      p.id::text AS provider_id,
      p.owner_user_id::text AS owner_user_id,
      pp.country_id::text AS country_id,
      pm.level::text AS membership_level,
      p.payout_primary_state_version
    FROM providers p
    JOIN provider_profiles pp ON pp.provider_id = p.id
    JOIN provider_members pm ON pm.provider_id = p.id AND pm.user_id = p.owner_user_id
    WHERE p.id = ${UPGRADE_FIXTURE.providerId}
  `;
  const row = rows[0];
  if (
    row === undefined ||
    row.provider_id !== UPGRADE_FIXTURE.providerId ||
    row.owner_user_id !== UPGRADE_FIXTURE.ownerUserId ||
    row.country_id !== UPGRADE_FIXTURE.countryId ||
    row.membership_level !== "OWNER" ||
    row.payout_primary_state_version !== 0
  ) {
    throw new Error("Populated R1-P05 Provider fixture was not preserved by R1-P06");
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

async function deploy(configPath: string, connectionString: string): Promise<void> {
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
  const configuredConnectionString =
    process.env["TEST_MIGRATION_DATABASE_URL"];
  if (
    configuredConnectionString === undefined ||
    configuredConnectionString.length === 0
  ) {
    throw new Error(
      "TEST_MIGRATION_DATABASE_URL is required for R1-P05 upgrade proof.",
    );
  }
  assertR1P06DisposableDatabaseUrl(configuredConnectionString);

  const migrationRoot = resolve(process.cwd(), "prisma", "migrations");
  const migrationEntries = await readdir(migrationRoot, { withFileTypes: true });
  const directoryNames = migrationEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const expected = new Set<string>([
    ...R1_P05_UPGRADE_BASELINE_MIGRATIONS,
    R1_P06_MIGRATION,
  ]);
  const missing = [...expected].filter((name) => !directoryNames.includes(name));
  const unexpected = directoryNames.filter((name) => !expected.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Upgrade migration inventory differs; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`,
    );
  }
  const r1P06Sql = await readFile(
    join(migrationRoot, R1_P06_MIGRATION, "migration.sql"),
    "utf8",
  );
  assertR1P06MigrationSql(r1P06Sql);

  const proofSchema = `cleanora_r1_p06_upgrade_proof_${process.pid}_${Date.now()}`;
  const connectionString = schemaConnectionString(
    configuredConnectionString,
    proofSchema,
  );
  const admin = createMigrationProofPrismaClient(configuredConnectionString);
  const temporaryRoot = await mkdtemp(
    join(process.cwd(), ".r1-p06-upgrade-"),
  );
  assertWorkspaceProofDirectory(temporaryRoot);
  const temporaryMigrations = join(temporaryRoot, "migrations");
  await mkdir(temporaryMigrations);
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA ${quotedIdentifier(proofSchema)}`);
    for (const migrationName of R1_P05_UPGRADE_BASELINE_MIGRATIONS) {
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

    const proof = createMigrationProofPrismaClient(connectionString);
    try {
      assertR1P05UpgradeBaselineHistory(await readMigrationHistory(proof));
      await populateR1P05Fixture(proof);
    } finally {
      await proof.$disconnect();
    }

    await cp(
      join(migrationRoot, R1_P06_MIGRATION),
      join(temporaryMigrations, R1_P06_MIGRATION),
      { recursive: true },
    );
    await deploy(configPath, connectionString);

    const upgraded = createMigrationProofPrismaClient(connectionString);
    try {
      assertAppliedMigration(await readMigrationHistory(upgraded));
      assertExactPostDeployTables(await readPublicBaseTables(upgraded));
      await assertR1P05FixturePreserved(upgraded);
    } finally {
      await upgraded.$disconnect();
    }
    await assertPostDeployState(connectionString);
    console.info(
      `Upgraded populated R1-P05 fixture in isolated schema ${proofSchema}; preserved Provider relations and verified full R1-P06 history, double-seed idempotency, and live constraints.`,
    );
  } finally {
    await admin.$disconnect();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "R1-P06 upgrade validation failed";
    console.error(`R1-P06 upgrade validation failed: ${message}`);
    process.exitCode = 1;
  });
}

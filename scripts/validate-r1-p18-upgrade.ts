/**
 * R1-P18 upgrade proof: populate a through-R1-P17 schema, apply
 * r1_p18_order_execution_completion_code, preserve earlier baseline digests, and assert
 * OrderStatus enum, empty order tables, booking_id unique, and ACTIVE code partial unique.
 *
 * Requires CLEANORA_R1_P18_DATABASE_URL naming an approved disposable target.
 */

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

import { seed } from "../prisma/seed.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  assertAppliedMigration,
  assertExactPostDeployTables,
  assertPostDeployState,
  assertR1P18MigrationSql,
  createMigrationProofPrismaClient,
  MIGRATION_NAMES_THROUGH_R1_P17,
  MIGRATION_NAMES_THROUGH_R1_P18,
  POST_DEPLOY_TABLES_THROUGH_R1_P18,
  R1_P18_MIGRATION,
  R1_P18_TABLES,
  requireR1P18ProofDatabaseUrl,
  type MigrationHistoryRow,
} from "./validate-clean-migration.js";

const executeFile = promisify(execFile);

export const R1_P17_UPGRADE_BASELINE_MIGRATIONS = [
  ...MIGRATION_NAMES_THROUGH_R1_P17,
] as const;

export {
  APPROVED_R1_P18_TARGET_PATTERN,
  assertR1P18DisposableDatabaseUrl,
  assertR1P18MigrationSql,
  R1_P18_MIGRATION,
  R1_P18_TABLES,
  requireR1P18ProofDatabaseUrl,
} from "./validate-clean-migration.js";

const FIXTURE = {
  ownerUserId: "r1p18-upgrade-owner",
  providerId: "r1p18-upgrade-provider",
} as const;

export interface BaselineTableDigest {
  readonly rowCount: number;
  readonly digest: string;
}

/**
 * @desc Assert upgrade baseline history contains exactly the through-P16 set.
 * @access Script
 */
export function assertR1P17UpgradeBaselineHistory(
  rows: readonly MigrationHistoryRow[],
): void {
  const expected = new Set<string>(R1_P17_UPGRADE_BASELINE_MIGRATIONS);
  const unexpected = rows.filter((row) => !expected.has(row.migration_name));
  if (unexpected.length > 0) {
    throw new Error(
      `R1-P17 upgrade baseline contains unexpected migrations: ${unexpected.map((row) => row.migration_name).join(", ")}`,
    );
  }
  for (const migrationName of R1_P17_UPGRADE_BASELINE_MIGRATIONS) {
    const matching = rows.filter((row) => row.migration_name === migrationName);
    const row = matching[0];
    if (
      matching.length !== 1 ||
      row === undefined ||
      row.finished_at === null ||
      row.rolled_back_at !== null
    ) {
      throw new Error(
        `R1-P17 upgrade baseline must contain exactly one successful ${migrationName} row; found ${String(matching.length)}`,
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
    !resolvedDirectory.includes(".r1-p18-upgrade-")
  ) {
    throw new Error(
      `Unexpected R1-P18 upgrade-proof directory: ${resolvedDirectory}`,
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

/**
 * @desc Read content digests for baseline tables excluding new P17 tables and
 * tables the P17 migration is allowed to seed (status_transition_rules).
 * @access Script
 */
export async function readR1P17BaselineDigests(
  prisma: PrismaClient,
  requestedTables?: Iterable<string>,
): Promise<ReadonlyMap<string, BaselineTableDigest>> {
  const excluded = new Set<string>([
    ...R1_P18_TABLES,
  ]);
  const availableTables = (await readBaseTables(prisma)).filter(
    (table) => table !== "_prisma_migrations" && !excluded.has(table),
  );
  const availableTableSet = new Set(availableTables);
  const tables =
    requestedTables === undefined ? availableTables : [...requestedTables];
  const result = new Map<string, BaselineTableDigest>();
  for (const table of tables) {
    if (!availableTableSet.has(table)) {
      throw new Error(
        `R1-P17 baseline table is missing before R1-P18 upgrade: ${table}`,
      );
    }
    const rowExpression = "to_jsonb(baseline_row)";
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

/**
 * @desc Require identical row counts and content digests across the upgrade.
 * @access Script
 */
export function assertBaselineDigestsPreserved(
  before: ReadonlyMap<string, BaselineTableDigest>,
  after: ReadonlyMap<string, BaselineTableDigest>,
): void {
  if (before.size !== after.size) {
    throw new Error(
      "R1-P17 baseline table inventory changed during R1-P18 upgrade",
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
        `R1-P17 baseline data changed during R1-P18 upgrade: ${table}`,
      );
    }
  }
}

async function populateR1P17Fixture(prisma: PrismaClient): Promise<void> {
  await seed(prisma);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "users" (
      "id", "email_normalized", "email_verified_at", "account_categories",
      "verified_categories", "status", "updated_at"
    ) VALUES (
      '${FIXTURE.ownerUserId}', 'r1p18-upgrade-owner@example.invalid', CURRENT_TIMESTAMP,
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
      'r1p18-upgrade-provider-profile', '${FIXTURE.providerId}', 'R1-P18 Upgrade Provider', c."id", CURRENT_TIMESTAMP
    FROM "countries" c WHERE c."code" = 'EG';
  `);
}

async function assertR1P18UpgradeDefaults(prisma: PrismaClient): Promise<void> {
  for (const table of R1_P18_TABLES) {
    const exists = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `
      SELECT table_name::text AS table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_type = 'BASE TABLE'
        AND table_name = '${table}'
    `,
    );
    if (exists.length !== 1) {
      throw new Error(`R1-P18 upgrade must create table ${table}`);
    }
    const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total FROM ${quotedIdentifier(table)}`,
    );
    if ((rows[0]?.total ?? 0n) !== 0n) {
      throw new Error(
        `R1-P18 upgrade must leave ${table} empty before commercial use; found rows`,
      );
    }
  }
  const orderEnum = await prisma.$queryRaw<Array<{ label: string }>>`
    SELECT label::text AS label
    FROM unnest(enum_range(NULL::"OrderStatus")) AS label
    WHERE label::text = 'READY_TO_COMPLETE'
  `;
  if (orderEnum.length !== 1) {
    throw new Error("R1-P18 upgrade must create OrderStatus.READY_TO_COMPLETE");
  }
  const bookingUnique = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname::text AS indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'orders'
      AND indexname = 'orders_booking_id_key'
  `;
  if (bookingUnique.length !== 1) {
    throw new Error("R1-P18 upgrade must unique-index orders.booking_id");
  }
  const activeCodeUnique = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname::text AS indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'completion_codes'
      AND indexname = 'completion_codes_one_active_per_order_idx'
  `;
  if (activeCodeUnique.length !== 1) {
    throw new Error(
      "R1-P18 upgrade must create one ACTIVE completion-code partial unique index",
    );
  }
  const providerRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT count(*)::bigint AS total FROM "providers" WHERE "id" = ${FIXTURE.providerId}
  `;
  if ((providerRows[0]?.total ?? 0n) !== 1n) {
    throw new Error(
      "Populated R1-P17 Provider fixture was not preserved after R1-P18 upgrade",
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
  const configuredConnectionString = requireR1P18ProofDatabaseUrl();

  const migrationRoot = resolve(process.cwd(), "prisma", "migrations");
  const entries = await readdir(migrationRoot, { withFileTypes: true });
  const directoryNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const expected = new Set<string>(MIGRATION_NAMES_THROUGH_R1_P18);
  const missing = [...expected].filter(
    (name) => !directoryNames.includes(name),
  );
  const unexpected = directoryNames.filter((name) => !expected.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Upgrade migration inventory differs; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`,
    );
  }
  const migrationSql = await readFile(
    join(migrationRoot, R1_P18_MIGRATION, "migration.sql"),
    "utf8",
  );
  assertR1P18MigrationSql(migrationSql);

  const proofSchema = `cleanora_r1_p18_upgrade_proof_${process.pid}_${Date.now()}`;
  const connectionString = schemaConnectionString(
    configuredConnectionString,
    proofSchema,
  );
  const admin = createMigrationProofPrismaClient(configuredConnectionString);
  const temporaryRoot = await mkdtemp(join(process.cwd(), ".r1-p18-upgrade-"));
  assertWorkspaceProofDirectory(temporaryRoot);
  const temporaryMigrations = join(temporaryRoot, "migrations");
  await mkdir(temporaryMigrations);
  try {
    await admin.$executeRawUnsafe(
      `CREATE SCHEMA ${quotedIdentifier(proofSchema)}`,
    );
    for (const migrationName of R1_P17_UPGRADE_BASELINE_MIGRATIONS) {
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
      assertR1P17UpgradeBaselineHistory(await readMigrationHistory(baseline));
      await populateR1P17Fixture(baseline);
      before = await readR1P17BaselineDigests(baseline);
    } finally {
      await baseline.$disconnect();
    }

    await cp(
      join(migrationRoot, R1_P18_MIGRATION),
      join(temporaryMigrations, R1_P18_MIGRATION),
      { recursive: true },
    );
    await deploy(configPath, connectionString);
    await deploy(configPath, connectionString);

    const upgraded = createMigrationProofPrismaClient(connectionString);
    try {
      assertAppliedMigration(
        await readMigrationHistory(upgraded),
        MIGRATION_NAMES_THROUGH_R1_P18,
      );
      assertExactPostDeployTables(
        await readBaseTables(upgraded),
        POST_DEPLOY_TABLES_THROUGH_R1_P18,
      );
      const after = await readR1P17BaselineDigests(upgraded, before.keys());
      assertBaselineDigestsPreserved(before, after);
      await assertR1P18UpgradeDefaults(upgraded);
    } finally {
      await upgraded.$disconnect();
    }
    await assertPostDeployState(connectionString, {
      migrationNames: MIGRATION_NAMES_THROUGH_R1_P18,
      postDeployTables: POST_DEPLOY_TABLES_THROUGH_R1_P18,
    });
    console.info(
      `Upgraded populated R1-P17 fixture in isolated schema ${proofSchema}; preserved baseline digests, OrderStatus.READY_TO_COMPLETE, empty order tables, orders.booking_id unique, ACTIVE completion-code partial unique, idempotent re-deploy, and live post-deploy constraints.`,
    );
  } finally {
    await admin.$disconnect();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "R1-P18 upgrade validation failed";
    console.error(`R1-P18 upgrade validation failed: ${message}`);
    process.exitCode = 1;
  });
}

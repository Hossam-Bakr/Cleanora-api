/**
 * R1-P18 upgrade proof via pg SQL apply (Prisma migrate deploy no-ops here).
 * Applies through-P17, populates a fixture, applies P18, asserts digests + order tables.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import pg from "pg";

import { seed } from "../prisma/seed.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  assertPostDeployState,
  assertR1P18MigrationSql,
  MIGRATION_NAMES_THROUGH_R1_P17,
  MIGRATION_NAMES_THROUGH_R1_P18,
  POST_DEPLOY_TABLES_THROUGH_R1_P18,
  R1_P18_MIGRATION,
  R1_P18_TABLES,
  requireR1P18ProofDatabaseUrl,
} from "./validate-clean-migration.js";

const FIXTURE = {
  ownerUserId: "r1p18-upgrade-owner",
  providerId: "r1p18-upgrade-provider",
} as const;

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let inLineComment = false;
  let inDollarTag: string | null = null;
  let inSingleQuote = false;

  while (i < sql.length) {
    const ch = sql[i]!;
    const next = sql[i + 1];
    if (inLineComment) {
      current += ch;
      if (ch === "\n") inLineComment = false;
      i += 1;
      continue;
    }
    if (inDollarTag !== null) {
      if (sql.startsWith(inDollarTag, i)) {
        current += inDollarTag;
        i += inDollarTag.length;
        inDollarTag = null;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }
    if (inSingleQuote) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingleQuote = false;
      i += 1;
      continue;
    }
    if (ch === "-" && next === "-") {
      inLineComment = true;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === "$") {
      const dollarMatch = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/u);
      if (dollarMatch) {
        inDollarTag = dollarMatch[0];
        current += inDollarTag;
        i += inDollarTag.length;
        continue;
      }
    }
    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  const trailing = current.trim();
  if (trailing.length > 0) statements.push(trailing);
  return statements;
}

async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function applyMigrations(
  pool: pg.Pool,
  migrationNames: readonly string[],
): Promise<void> {
  const migrationsRoot = resolve(process.cwd(), "prisma", "migrations");
  await ensureMigrationsTable(pool);
  for (const migrationName of migrationNames) {
    const sql = await readFile(
      join(migrationsRoot, migrationName, "migration.sql"),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    for (const statement of splitSqlStatements(sql)) {
      await pool.query(statement);
    }
    await pool.query(
      `INSERT INTO "_prisma_migrations" (
         "id", "checksum", "finished_at", "migration_name", "logs",
         "rolled_back_at", "started_at", "applied_steps_count"
       ) VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
      [randomUUID(), checksum, migrationName],
    );
    console.info(`Applied ${migrationName}`);
  }
}

function createPrisma(pool: pg.Pool): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function main(): Promise<void> {
  const baseUrl = requireR1P18ProofDatabaseUrl();
  const upgradeUrl = process.env["CLEANORA_R1_P18_UPGRADE_DATABASE_URL"];
  if (typeof upgradeUrl !== "string" || upgradeUrl.length === 0) {
    throw new Error(
      "CLEANORA_R1_P18_UPGRADE_DATABASE_URL is required (empty disposable DB)",
    );
  }
  if (!/cleanora_r1_p18(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)/u.test(upgradeUrl)) {
    throw new Error("Upgrade DB URL must name an approved cleanora_r1_p18_* proof target");
  }

  const p18Sql = await readFile(
    join(process.cwd(), "prisma", "migrations", R1_P18_MIGRATION, "migration.sql"),
    "utf8",
  );
  assertR1P18MigrationSql(p18Sql);

  const pool = new pg.Pool({
    connectionString: upgradeUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const existing = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`,
    );
    if (existing.rows.length > 0) {
      throw new Error(
        `Upgrade target must be empty; found ${existing.rows.map((r) => r.table_name).join(", ")}`,
      );
    }

    await applyMigrations(pool, MIGRATION_NAMES_THROUGH_R1_P17);

    const prisma = createPrisma(pool);
    try {
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
      const beforeProviders = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*)::bigint AS total FROM "providers" WHERE "id" = ${FIXTURE.providerId}
      `;
      if ((beforeProviders[0]?.total ?? 0n) !== 1n) {
        throw new Error("Failed to populate upgrade fixture");
      }
    } finally {
      await prisma.$disconnect();
    }

    await applyMigrations(pool, [R1_P18_MIGRATION]);

    for (const table of R1_P18_TABLES) {
      const rows = await pool.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM "${table}"`,
      );
      if ((rows.rows[0]?.total ?? "1") !== "0") {
        throw new Error(`Upgrade must leave ${table} empty`);
      }
    }
    const orderEnum = await pool.query<{ label: string }>(
      `SELECT label::text AS label FROM unnest(enum_range(NULL::"OrderStatus")) AS label WHERE label::text = 'READY_TO_COMPLETE'`,
    );
    if (orderEnum.rows.length !== 1) {
      throw new Error("Upgrade must create OrderStatus.READY_TO_COMPLETE");
    }
    const providerRows = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM "providers" WHERE "id" = $1`,
      [FIXTURE.providerId],
    );
    if ((providerRows.rows[0]?.total ?? "0") !== "1") {
      throw new Error("Provider fixture not preserved across P18 upgrade");
    }

    await assertPostDeployState(upgradeUrl.replace("-pooler", ""), {
      migrationNames: MIGRATION_NAMES_THROUGH_R1_P18,
      postDeployTables: POST_DEPLOY_TABLES_THROUGH_R1_P18,
    });

    console.info(
      `PG upgrade proof PASS against disposable target (baseline URL host ${new URL(baseUrl).hostname}); fixture preserved; P18 tables empty; OrderStatus ready.`,
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

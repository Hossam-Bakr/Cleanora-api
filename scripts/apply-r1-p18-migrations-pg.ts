/**
 * Apply Prisma migration SQL files in folder order via `pg`, then stamp
 * `_prisma_migrations`. Used when `prisma migrate deploy` connects but applies
 * zero migrations (observed on this Windows + Neon + Prisma 7 path).
 *
 * Requires CLEANORA_R1_P18_DATABASE_URL (approved disposable target only).
 */

import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import pg from "pg";

import {
  assertPostDeployState,
  MIGRATION_NAMES_THROUGH_R1_P18,
  POST_DEPLOY_TABLES_THROUGH_R1_P18,
  requireR1P18ProofDatabaseUrl,
} from "./validate-clean-migration.js";

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
      if (ch === "\n") {
        inLineComment = false;
      }
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
      if (ch === "'") {
        inSingleQuote = false;
      }
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
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }
  return statements;
}

async function main(): Promise<void> {
  const connectionString = requireR1P18ProofDatabaseUrl();
  const migrationsRoot = resolve(process.cwd(), "prisma", "migrations");
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const expected = [...MIGRATION_NAMES_THROUGH_R1_P18];
  if (JSON.stringify(directories) !== JSON.stringify([...expected].sort((a, b) => a.localeCompare(b)))) {
    // Keep chronological migrationNames order for apply; only verify set equality.
    const expectedNames: readonly string[] = expected;
    const missing = expectedNames.filter((name) => !directories.includes(name));
    const unexpected = directories.filter((name) => !expectedNames.includes(name));
    if (missing.length > 0 || unexpected.length > 0) {
      throw new Error(
        `Migration inventory mismatch; missing=[${missing.join(", ")}] unexpected=[${unexpected.join(", ")}]`,
      );
    }
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const existing = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`,
    );
    if (existing.rows.length > 0) {
      throw new Error(
        `Target must be empty before pg apply; found: ${existing.rows.map((row) => row.table_name).join(", ")}`,
      );
    }

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

    for (const migrationName of expected) {
      const sqlPath = join(migrationsRoot, migrationName, "migration.sql");
      const sql = await readFile(sqlPath, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      // Execute statement-by-statement so newly added enum labels can be used
      // by later statements (PostgreSQL forbids same-transaction use).
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
  } finally {
    await pool.end();
  }

  await assertPostDeployState(connectionString, {
    migrationNames: MIGRATION_NAMES_THROUGH_R1_P18,
    postDeployTables: POST_DEPLOY_TABLES_THROUGH_R1_P18,
  });
  console.info(
    `PG apply proof PASS: ${String(MIGRATION_NAMES_THROUGH_R1_P18.length)} migrations, ${String(POST_DEPLOY_TABLES_THROUGH_R1_P18.length)} tables`,
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "pg migration apply proof failed";
  console.error(message);
  process.exitCode = 1;
});

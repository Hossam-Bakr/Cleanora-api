import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static (non-DB) checks over the R1-P10 migration SQL text (repair item 5).
 *
 * Live proof that this migration applies cleanly against a real PostgreSQL
 * target is explicitly unavailable in this batch: no disposable Phase 10
 * database URL was supplied, so these assertions only prove the SQL text
 * itself never depends on an undeclared PostgreSQL extension and preserves
 * the required statement order. They do not prove the migration executes
 * successfully.
 */
const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "r1_p10_availability_capacity_textual_coverage",
  "migration.sql",
);
const migrationSource = readFileSync(migrationPath, "utf8");

/**
 * Executable SQL only, with `--` line comments stripped, so documentation
 * text that references the forbidden function/extension by name (to explain
 * why it is *not* used) never produces a false positive.
 */
const executableSql = migrationSource
  .split(/\r?\n/u)
  .map((line) => line.replace(/--.*$/u, ""))
  .join("\n");

describe("R1-P10 migration SQL static checks (repair item 5)", () => {
  it("never calls gen_random_uuid() in executable SQL (undeclared pgcrypto dependency)", () => {
    expect(executableSql).not.toMatch(/gen_random_uuid/iu);
  });

  it("never creates or depends on an extension in executable SQL", () => {
    expect(executableSql).not.toMatch(/CREATE\s+EXTENSION/iu);
  });

  it("uses a deterministic PostgreSQL-core md5-based id for the time-zone backfill INSERT", () => {
    expect(migrationSource).toMatch(/md5\(c\."id"\s*\|\|\s*':platform\.default_timezone'\)/u);
  });

  it("adds country_configs.version before the backfill INSERT references it", () => {
    const versionColumnIndex = migrationSource.indexOf(
      'ALTER TABLE "country_configs" ADD COLUMN "version"',
    );
    const backfillInsertIndex = migrationSource.indexOf(
      'INSERT INTO "country_configs"',
    );
    expect(versionColumnIndex).toBeGreaterThan(-1);
    expect(backfillInsertIndex).toBeGreaterThan(-1);
    expect(versionColumnIndex).toBeLessThan(backfillInsertIndex);
  });

  it("runs the backfill INSERT before switching platform.default_timezone to COUNTRY_REQUIRED", () => {
    const backfillInsertIndex = migrationSource.indexOf(
      'INSERT INTO "country_configs"',
    );
    const policySwitchIndex = migrationSource.indexOf(
      "SET \"resolution_policy\" = 'COUNTRY_REQUIRED'",
    );
    expect(backfillInsertIndex).toBeGreaterThan(-1);
    expect(policySwitchIndex).toBeGreaterThan(-1);
    expect(backfillInsertIndex).toBeLessThan(policySwitchIndex);
  });

  it("special-cases Egypt (EG) to Africa/Cairo in the backfill", () => {
    expect(migrationSource).toMatch(/WHEN c\."code" = 'EG' THEN to_jsonb\('Africa\/Cairo'/u);
  });

  it("guards the backfill with a NOT EXISTS check so an existing per-country override is never overwritten", () => {
    const backfillInsertIndex = migrationSource.indexOf(
      'INSERT INTO "country_configs"',
    );
    const notExistsIndex = migrationSource.indexOf(
      "NOT EXISTS",
      backfillInsertIndex,
    );
    const policySwitchIndex = migrationSource.indexOf(
      "SET \"resolution_policy\" = 'COUNTRY_REQUIRED'",
    );
    expect(notExistsIndex).toBeGreaterThan(backfillInsertIndex);
    expect(notExistsIndex).toBeLessThan(policySwitchIndex);
  });
});

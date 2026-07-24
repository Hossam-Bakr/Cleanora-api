import { readFile } from "node:fs/promises";
import { join } from "node:path";


import {
  assertAppliedMigration,
  assertDatabaseEmpty,
  assertExactPostDeployTables,
  assertSafeCleanTestDatabaseUrl
} from "../../scripts/validate-clean-migration.js";

const migrationDirectory = join(
  process.cwd(),
  "prisma/migrations/r1_p01_foundation_country_configuration"
);

describe("R1-P01 migration boundary", () => {
  it("uses the phase-owned migration name and creates only approved foundations", async () => {
    const sql = await readFile(join(migrationDirectory, "migration.sql"), "utf8");

    expect(migrationDirectory).toContain(
      "r1_p01_foundation_country_configuration"
    );
    expect(sql).toContain('CREATE TABLE "currencies"');
    expect(sql).toContain('CREATE TABLE "countries"');
    expect(sql).toContain('CREATE TABLE "app_configs"');
    expect(sql).toContain('CREATE TABLE "country_configs"');
    expect(sql).toContain('CREATE TABLE "audit_logs"');
    expect(sql).not.toMatch(/CREATE TABLE "(?:users|sessions|roles|permissions)"/i);
  });

  it("rejects a non-empty target before migration deploy", () => {
    expect(() => assertDatabaseEmpty(["existing_table"])).toThrow(/must be empty/i);
    expect(() => assertDatabaseEmpty([])).not.toThrow();
  });

  it("rejects production-looking clean-apply targets", () => {
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora_production"
      )
    ).toThrow(/production target/i);
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora",
        "test"
      )
    ).toThrow(/explicit test/i);
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora_ci",
        "production"
      )
    ).toThrow(/forbidden in production/i);
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora_ci",
        "test"
      )
    ).not.toThrow();
  });

  it("requires the exact R1-P01 post-deploy table inventory", () => {
    const expected = [
      "_prisma_migrations",
      "app_configs",
      "audit_logs",
      "countries",
      "country_configs",
      "currencies"
    ];

    expect(() => assertExactPostDeployTables(expected)).not.toThrow();
    expect(() =>
      assertExactPostDeployTables([...expected, "future_phase_table"])
    ).toThrow(/unexpected tables/i);
    expect(() =>
      assertExactPostDeployTables(expected.filter((table) => table !== "audit_logs"))
    ).toThrow(/missing tables/i);
  });

  it("requires one successfully applied phase-owned migration history row", () => {
    expect(() =>
      assertAppliedMigration([
        {
          migration_name: "r1_p01_foundation_country_configuration",
          finished_at: new Date(),
          rolled_back_at: null
        }
      ])
    ).not.toThrow();
    expect(() => assertAppliedMigration([])).toThrow(/migration history/i);
  });
});

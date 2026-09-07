import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import {
  APPROVED_R1_P09_TARGET_PATTERN,
  assertR1P09MigrationSql,
  R1_P09_MIGRATION,
  R1_P09_PROVIDER_SERVICE_TABLES,
  requireR1P09ProofDatabaseUrl,
} from "../../../scripts/validate-clean-migration.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R1-P09 clean-install live probes (T072).
 *
 * Static assertions always run. Live migrate/seed/redeploy probes stay skipped
 * unless an owner-approved disposable URL is present in
 * `CLEANORA_R1_P09_DATABASE_URL` matching
 * `^cleanora_r1_p09(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$`.
 * Ordinary `DATABASE_URL` / unknown databases are never used (blocks T079).
 */

const migrationSql = readFileSync(
  join(process.cwd(), "prisma", "migrations", R1_P09_MIGRATION, "migration.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

const liveAvailable = ((): boolean => {
  if (!hasExplicitR1P09TestDatabase()) {
    return false;
  }
  const url = process.env["CLEANORA_R1_P09_DATABASE_URL"];
  if (url === undefined || url.trim().length === 0) {
    return false;
  }
  try {
    requireR1P09ProofDatabaseUrl({ CLEANORA_R1_P09_DATABASE_URL: url });
    return true;
  } catch {
    return false;
  }
})();

describe("R1-P09 clean migration contract (static)", () => {
  it("owns exactly four Provider service tables and additive SQL only", () => {
    expect(R1_P09_PROVIDER_SERVICE_TABLES).toHaveLength(4);
    for (const table of R1_P09_PROVIDER_SERVICE_TABLES) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
    expect(() => assertR1P09MigrationSql(migrationSql)).not.toThrow();
    expect(APPROVED_R1_P09_TARGET_PATTERN.test("cleanora_r1_p09_proof")).toBe(
      true,
    );
    expect(APPROVED_R1_P09_TARGET_PATTERN.test("Cleanora")).toBe(false);
  });
});

describe.skipIf(!liveAvailable)(
  "R1-P09 clean migration live probes (owner-approved disposable only)",
  () => {
    it("applies clean chronology, leaves R1-P09 tables empty after seed, and redeploys idempotently", async () => {
      const { spawnSync } = await import("node:child_process");
      // Delegate to the authorized isolated-schema validator rather than probing
      // the shared public schema (fixed-id constraint fixtures collide there).
      const result = spawnSync(
        "npm",
        ["run", "db:validate-clean-migration"],
        {
          encoding: "utf8",
          env: process.env,
          shell: true,
        },
      );
      expect(result.status).toBe(0);
      expect(result.stdout ?? "").toContain("R1-P09 live constraint probes: 28 expected rejections");
      expect(result.stdout ?? "").toContain(
        "empty R1-P09 Provider-service tables",
      );
      expect(result.stdout ?? "").toContain(
        "r1_p09_provider_services_pricing_historical_snapshots",
      );
    }, 600_000);
  },
);

describe.skipIf(liveAvailable)(
  "R1-P09 clean migration live probes (blocked without disposable DB)",
  () => {
    it("documents that T079 DB gates remain blocked without CLEANORA_R1_P09_DATABASE_URL", () => {
      expect(process.env["CLEANORA_R1_P09_DATABASE_URL"] ?? "").toBe("");
      expect(() => requireR1P09ProofDatabaseUrl({})).toThrow(
        /CLEANORA_R1_P09_DATABASE_URL is required/u,
      );
    });
  },
);

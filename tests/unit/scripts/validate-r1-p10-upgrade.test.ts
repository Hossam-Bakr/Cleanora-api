import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_R1_P10_TARGET_PATTERN,
  assertBaselineDigestsPreserved,
  assertR1P09UpgradeBaselineHistory,
  assertR1P10DisposableDatabaseUrl,
  assertR1P10MigrationSql,
  R1_P09_UPGRADE_BASELINE_MIGRATIONS,
  R1_P10_AVAILABILITY_TABLES,
  R1_P10_MIGRATION,
  requireR1P10ProofDatabaseUrl,
} from "../../../scripts/validate-r1-p10-upgrade.js";

/**
 * Guarded R1-P10 upgrade validator expectations (T072).
 * Live migrate/seed against unapproved databases is forbidden until an owner
 * approves a target matching
 * ^cleanora_r1_p10(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$.
 */

const upgradeProofSource = readFileSync(
  resolve(process.cwd(), "scripts", "validate-r1-p10-upgrade.ts"),
  "utf8",
);

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "prisma",
    "migrations",
    R1_P10_MIGRATION,
    "migration.sql",
  ),
  "utf8",
);

const successfulRows = R1_P09_UPGRADE_BASELINE_MIGRATIONS.map(
  (migration_name) => ({
    migration_name,
    finished_at: new Date("2026-09-08T00:00:00.000Z"),
    rolled_back_at: null,
  }),
);

describe("validate-r1-p10-upgrade guards", () => {
  it("accepts only approved disposable target names", () => {
    expect(APPROVED_R1_P10_TARGET_PATTERN.test("cleanora_r1_p10_proof")).toBe(
      true,
    );
    expect(
      APPROVED_R1_P10_TARGET_PATTERN.test("cleanora_r1_p10_local_test"),
    ).toBe(true);
    expect(APPROVED_R1_P10_TARGET_PATTERN.test("Cleanora")).toBe(false);
    expect(APPROVED_R1_P10_TARGET_PATTERN.test("cleanora_r1_p09_proof")).toBe(
      false,
    );
    expect(() => {
      assertR1P10DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p10_proof",
      );
    }).not.toThrow();
    expect(() => {
      assertR1P10DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/Cleanora",
      );
    }).toThrow(/unapproved target/u);
  });

  it("reads CLEANORA_R1_P10_DATABASE_URL and ignores prior-phase URLs", () => {
    const live = "postgresql://synthetic.invalid/cleanora_r1_p10_test";
    expect(
      requireR1P10ProofDatabaseUrl({
        CLEANORA_R1_P10_DATABASE_URL: live,
        CLEANORA_R1_P09_DATABASE_URL:
          "postgresql://synthetic.invalid/cleanora_r1_p09_proof",
        DATABASE_URL: "postgresql://synthetic.invalid/Cleanora",
      }),
    ).toBe(live);
    expect(() =>
      requireR1P10ProofDatabaseUrl({
        CLEANORA_R1_P09_DATABASE_URL: live,
      }),
    ).toThrow(/CLEANORA_R1_P10_DATABASE_URL is required/u);
  });

  it("accepts exactly one successful migration through R1-P09", () => {
    expect(() =>
      assertR1P09UpgradeBaselineHistory(successfulRows),
    ).not.toThrow();
  });

  it("rejects missing, duplicate, failed, rolled-back, R1-P10, or future history rows", () => {
    expect(() =>
      assertR1P09UpgradeBaselineHistory(successfulRows.slice(1)),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P09UpgradeBaselineHistory([
        ...successfulRows,
        successfulRows[0]!,
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P09UpgradeBaselineHistory([
        ...successfulRows.slice(1),
        { ...successfulRows[0]!, finished_at: null },
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P09UpgradeBaselineHistory([
        ...successfulRows.slice(1),
        { ...successfulRows[0]!, rolled_back_at: new Date() },
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P09UpgradeBaselineHistory([
        ...successfulRows,
        {
          migration_name: R1_P10_MIGRATION,
          finished_at: new Date(),
          rolled_back_at: null,
        },
      ]),
    ).toThrow(/unexpected migrations/u);
    expect(() =>
      assertR1P09UpgradeBaselineHistory([
        ...successfulRows,
        {
          migration_name: "future_migration",
          finished_at: new Date(),
          rolled_back_at: null,
        },
      ]),
    ).toThrow(/unexpected migrations/u);
  });

  it("requires identical pre-existing row counts and content digests", () => {
    const baseline = new Map([
      ["providers", { rowCount: 2, digest: "provider-digest" }],
      ["service_categories", { rowCount: 1, digest: "catalog-digest" }],
    ]);
    expect(() =>
      assertBaselineDigestsPreserved(baseline, new Map(baseline)),
    ).not.toThrow();
    expect(() =>
      assertBaselineDigestsPreserved(
        baseline,
        new Map([
          ["providers", { rowCount: 2, digest: "changed" }],
          ["service_categories", { rowCount: 1, digest: "catalog-digest" }],
        ]),
      ),
    ).toThrow(/providers/u);
    expect(() =>
      assertBaselineDigestsPreserved(
        baseline,
        new Map([["providers", { rowCount: 2, digest: "provider-digest" }]]),
      ),
    ).toThrow(/inventory/u);
  });

  it("excludes intentionally mutated app_configs from digest preservation", () => {
    expect(upgradeProofSource).toContain("filterPreservedBaselineDigests");
    expect(upgradeProofSource).toContain("to_jsonb(baseline_row) - 'version'");
    expect(upgradeProofSource).toContain("COUNTRY_REQUIRED");
  });

  it("accepts the phase-owned R1-P10 migration SQL shape", () => {
    expect(R1_P10_AVAILABILITY_TABLES).toHaveLength(13);
    expect(() => assertR1P10MigrationSql(migrationSql)).not.toThrow();
    expect(() =>
      assertR1P10MigrationSql(`${migrationSql}\nDROP TABLE "providers";`),
    ).toThrow(/destructive/u);
  });

  it("uses controlled temporary upgrade directories and digest preservation", () => {
    expect(upgradeProofSource).toContain(".r1-p10-upgrade-");
    expect(upgradeProofSource).toContain(
      "readR1P09BaselineDigests(upgraded, before.keys())",
    );
    expect(upgradeProofSource).toContain("assertWorkspaceProofDirectory");
    expect(upgradeProofSource).toContain("rm(temporaryRoot");
    expect(upgradeProofSource).not.toMatch(/migrate\s+reset/iu);
    expect(upgradeProofSource).not.toMatch(/DROP\s+DATABASE/iu);
  });

  it("skips live R1-P10 upgrade probes without an approved disposable URL", () => {
    const live = process.env["CLEANORA_R1_P10_DATABASE_URL"];
    if (live === undefined || live.trim().length === 0) {
      expect(() => requireR1P10ProofDatabaseUrl({})).toThrow(
        /CLEANORA_R1_P10_DATABASE_URL is required/u,
      );
      return;
    }
    expect(() => requireR1P10ProofDatabaseUrl()).not.toThrow();
  });
});

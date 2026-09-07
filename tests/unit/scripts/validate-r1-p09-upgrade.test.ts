import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_R1_P09_TARGET_PATTERN,
  assertBaselineDigestsPreserved,
  assertR1P08UpgradeBaselineHistory,
  assertR1P09DisposableDatabaseUrl,
  assertR1P09MigrationSql,
  R1_P08_UPGRADE_BASELINE_MIGRATIONS,
  R1_P09_MIGRATION,
  R1_P09_PROVIDER_SERVICE_TABLES,
  requireR1P09ProofDatabaseUrl,
} from "../../../scripts/validate-r1-p09-upgrade.js";

/**
 * Guarded R1-P09 upgrade validator expectations (T073).
 * Live migrate/seed against unapproved databases is forbidden until an owner
 * approves a target matching
 * ^cleanora_r1_p09(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$.
 */

const upgradeProofSource = readFileSync(
  resolve(process.cwd(), "scripts", "validate-r1-p09-upgrade.ts"),
  "utf8",
);

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "prisma",
    "migrations",
    R1_P09_MIGRATION,
    "migration.sql",
  ),
  "utf8",
);

const successfulRows = R1_P08_UPGRADE_BASELINE_MIGRATIONS.map(
  (migration_name) => ({
    migration_name,
    finished_at: new Date("2026-09-05T00:00:00.000Z"),
    rolled_back_at: null,
  }),
);

describe("validate-r1-p09-upgrade guards", () => {
  it("accepts only approved disposable target names", () => {
    expect(APPROVED_R1_P09_TARGET_PATTERN.test("cleanora_r1_p09_proof")).toBe(
      true,
    );
    expect(
      APPROVED_R1_P09_TARGET_PATTERN.test("cleanora_r1_p09_local_test"),
    ).toBe(true);
    expect(APPROVED_R1_P09_TARGET_PATTERN.test("Cleanora")).toBe(false);
    expect(APPROVED_R1_P09_TARGET_PATTERN.test("cleanora_r1_p08_proof")).toBe(
      false,
    );
    expect(() => {
      assertR1P09DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p09_proof",
      );
    }).not.toThrow();
    expect(() => {
      assertR1P09DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/Cleanora",
      );
    }).toThrow(/unapproved target/u);
  });

  it("reads CLEANORA_R1_P09_DATABASE_URL and ignores prior-phase URLs", () => {
    const live = "postgresql://synthetic.invalid/cleanora_r1_p09_test";
    expect(
      requireR1P09ProofDatabaseUrl({
        CLEANORA_R1_P09_DATABASE_URL: live,
        CLEANORA_R1_P08_DATABASE_URL:
          "postgresql://synthetic.invalid/cleanora_r1_p08_proof",
        DATABASE_URL: "postgresql://synthetic.invalid/Cleanora",
      }),
    ).toBe(live);
    expect(() =>
      requireR1P09ProofDatabaseUrl({
        CLEANORA_R1_P08_DATABASE_URL: live,
      }),
    ).toThrow(/CLEANORA_R1_P09_DATABASE_URL is required/u);
  });

  it("accepts exactly one successful migration through R1-P08", () => {
    expect(() =>
      assertR1P08UpgradeBaselineHistory(successfulRows),
    ).not.toThrow();
  });

  it("rejects missing, duplicate, failed, rolled-back, R1-P09, or future history rows", () => {
    expect(() =>
      assertR1P08UpgradeBaselineHistory(successfulRows.slice(1)),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P08UpgradeBaselineHistory([
        ...successfulRows,
        successfulRows[0]!,
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P08UpgradeBaselineHistory([
        ...successfulRows.slice(1),
        { ...successfulRows[0]!, finished_at: null },
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P08UpgradeBaselineHistory([
        ...successfulRows.slice(1),
        { ...successfulRows[0]!, rolled_back_at: new Date() },
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P08UpgradeBaselineHistory([
        ...successfulRows,
        {
          migration_name: R1_P09_MIGRATION,
          finished_at: new Date(),
          rolled_back_at: null,
        },
      ]),
    ).toThrow(/unexpected migrations/u);
    expect(() =>
      assertR1P08UpgradeBaselineHistory([
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

  it("accepts the phase-owned R1-P09 migration SQL shape", () => {
    expect(R1_P09_PROVIDER_SERVICE_TABLES).toHaveLength(4);
    expect(() => assertR1P09MigrationSql(migrationSql)).not.toThrow();
    expect(() =>
      assertR1P09MigrationSql(`${migrationSql}\nDROP TABLE "providers";`),
    ).toThrow(/destructive/u);
  });

  it("uses controlled temporary upgrade directories and digest preservation", () => {
    expect(upgradeProofSource).toContain(".r1-p09-upgrade-");
    expect(upgradeProofSource).toContain(
      "readR1P08BaselineDigests(upgraded, before.keys())",
    );
    expect(upgradeProofSource).toContain("assertWorkspaceProofDirectory");
    expect(upgradeProofSource).toContain("rm(temporaryRoot");
    expect(upgradeProofSource).not.toMatch(/migrate\s+reset/iu);
    expect(upgradeProofSource).not.toMatch(/DROP\s+DATABASE/iu);
  });

  it("skips live R1-P09 upgrade probes without an approved disposable URL", () => {
    const live = process.env["CLEANORA_R1_P09_DATABASE_URL"];
    if (live === undefined || live.trim().length === 0) {
      expect(() => requireR1P09ProofDatabaseUrl({})).toThrow(
        /CLEANORA_R1_P09_DATABASE_URL is required/u,
      );
      return;
    }
    expect(() => requireR1P09ProofDatabaseUrl()).not.toThrow();
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_R1_P11_TARGET_PATTERN,
  assertBaselineDigestsPreserved,
  assertR1P10UpgradeBaselineHistory,
  assertR1P11DisposableDatabaseUrl,
  assertR1P11MigrationSql,
  R1_P10_UPGRADE_BASELINE_MIGRATIONS,
  R1_P11_ELIGIBILITY_TABLES,
  R1_P11_MIGRATION,
  requireR1P11ProofDatabaseUrl,
} from "../../../scripts/validate-r1-p11-upgrade.js";

/**
 * Guarded R1-P11 upgrade validator expectations (T047).
 * Live migrate/seed against unapproved databases is forbidden until an owner
 * approves a target matching
 * ^cleanora_r1_p11(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$.
 */

const upgradeProofSource = readFileSync(
  resolve(process.cwd(), "scripts", "validate-r1-p11-upgrade.ts"),
  "utf8",
);

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "prisma",
    "migrations",
    R1_P11_MIGRATION,
    "migration.sql",
  ),
  "utf8",
);

const successfulRows = R1_P10_UPGRADE_BASELINE_MIGRATIONS.map(
  (migration_name) => ({
    migration_name,
    finished_at: new Date("2026-09-09T00:00:00.000Z"),
    rolled_back_at: null,
  }),
);

describe("validate-r1-p11-upgrade guards", () => {
  it("accepts only approved disposable target names", () => {
    expect(APPROVED_R1_P11_TARGET_PATTERN.test("cleanora_r1_p11_proof")).toBe(
      true,
    );
    expect(
      APPROVED_R1_P11_TARGET_PATTERN.test("cleanora_r1_p11_local_test"),
    ).toBe(true);
    expect(APPROVED_R1_P11_TARGET_PATTERN.test("Cleanora")).toBe(false);
    expect(APPROVED_R1_P11_TARGET_PATTERN.test("cleanora_r1_p10_proof")).toBe(
      false,
    );
    expect(() => {
      assertR1P11DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p11_proof",
      );
    }).not.toThrow();
    expect(() => {
      assertR1P11DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/Cleanora",
      );
    }).toThrow(/unapproved target/u);
  });

  it("reads CLEANORA_R1_P11_DATABASE_URL and ignores prior-phase URLs", () => {
    const live = "postgresql://synthetic.invalid/cleanora_r1_p11_test";
    expect(
      requireR1P11ProofDatabaseUrl({
        CLEANORA_R1_P11_DATABASE_URL: live,
        CLEANORA_R1_P10_DATABASE_URL:
          "postgresql://synthetic.invalid/cleanora_r1_p10_proof",
        DATABASE_URL: "postgresql://synthetic.invalid/Cleanora",
      }),
    ).toBe(live);
    expect(() =>
      requireR1P11ProofDatabaseUrl({
        CLEANORA_R1_P10_DATABASE_URL: live,
      }),
    ).toThrow(/CLEANORA_R1_P11_DATABASE_URL is required/u);
  });

  it("accepts exactly one successful migration through R1-P10", () => {
    expect(() =>
      assertR1P10UpgradeBaselineHistory(successfulRows),
    ).not.toThrow();
    expect(R1_P10_UPGRADE_BASELINE_MIGRATIONS).toContain(
      "r1_p10_availability_capacity_textual_coverage",
    );
  });

  it("rejects missing, duplicate, failed, rolled-back, R1-P11, or future history rows", () => {
    expect(() =>
      assertR1P10UpgradeBaselineHistory(successfulRows.slice(1)),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P10UpgradeBaselineHistory([
        ...successfulRows,
        successfulRows[0]!,
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P10UpgradeBaselineHistory([
        ...successfulRows.slice(1),
        { ...successfulRows[0]!, finished_at: null },
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P10UpgradeBaselineHistory([
        ...successfulRows.slice(1),
        { ...successfulRows[0]!, rolled_back_at: new Date() },
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P10UpgradeBaselineHistory([
        ...successfulRows,
        {
          migration_name: R1_P11_MIGRATION,
          finished_at: new Date(),
          rolled_back_at: null,
        },
      ]),
    ).toThrow(/unexpected migrations/u);
    expect(() =>
      assertR1P10UpgradeBaselineHistory([
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

  it("accepts the phase-owned R1-P11 migration SQL shape", () => {
    expect(R1_P11_ELIGIBILITY_TABLES).toEqual([
      "eligibility_rule_versions",
      "eligibility_evaluations",
      "eligibility_candidate_results",
    ]);
    expect(() => assertR1P11MigrationSql(migrationSql)).not.toThrow();
    expect(() =>
      assertR1P11MigrationSql(`${migrationSql}\nDROP TABLE "providers";`),
    ).toThrow(/destructive/u);
  });

  it("uses controlled temporary upgrade directories and digest preservation", () => {
    expect(upgradeProofSource).toContain(".r1-p11-upgrade-");
    expect(upgradeProofSource).toContain(
      "readR1P10BaselineDigests(upgraded, before.keys())",
    );
    expect(upgradeProofSource).toContain("assertWorkspaceProofDirectory");
    expect(upgradeProofSource).toContain("rm(temporaryRoot");
    expect(upgradeProofSource).toContain("R1_P10_UPGRADE_BASELINE_MIGRATIONS");
    expect(upgradeProofSource).not.toMatch(/migrate\s+reset/iu);
    expect(upgradeProofSource).not.toMatch(/DROP\s+DATABASE/iu);
  });

  it("skips live R1-P11 upgrade probes without an approved disposable URL", () => {
    const live = process.env["CLEANORA_R1_P11_DATABASE_URL"];
    if (live === undefined || live.trim().length === 0) {
      expect(() => requireR1P11ProofDatabaseUrl({})).toThrow(
        /CLEANORA_R1_P11_DATABASE_URL is required/u,
      );
      return;
    }
    expect(() => requireR1P11ProofDatabaseUrl()).not.toThrow();
  });
});

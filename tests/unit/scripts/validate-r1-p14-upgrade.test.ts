import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_R1_P14_TARGET_PATTERN,
  assertBaselineDigestsPreserved,
  assertR1P13UpgradeBaselineHistory,
  assertR1P14DisposableDatabaseUrl,
  assertR1P14MigrationSql,
  R1_P13_UPGRADE_BASELINE_MIGRATIONS,
  R1_P14_LEDGER_TABLES,
  R1_P14_MIGRATION,
  requireR1P14ProofDatabaseUrl,
} from "../../../scripts/validate-r1-p14-upgrade.js";

const upgradeProofSource = readFileSync(
  resolve(process.cwd(), "scripts", "validate-r1-p14-upgrade.ts"),
  "utf8",
);

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "prisma",
    "migrations",
    R1_P14_MIGRATION,
    "migration.sql",
  ),
  "utf8",
);

const successfulRows = R1_P13_UPGRADE_BASELINE_MIGRATIONS.map(
  (migration_name) => ({
    migration_name,
    finished_at: new Date("2026-09-11T00:00:00.000Z"),
    rolled_back_at: null,
  }),
);

describe("validate-r1-p14-upgrade guards", () => {
  it("accepts only approved disposable target names", () => {
    expect(APPROVED_R1_P14_TARGET_PATTERN.test("cleanora_r1_p14_proof")).toBe(
      true,
    );
    expect(
      APPROVED_R1_P14_TARGET_PATTERN.test("cleanora_r1_p14_local_test"),
    ).toBe(true);
    expect(APPROVED_R1_P14_TARGET_PATTERN.test("Cleanora")).toBe(false);
    expect(APPROVED_R1_P14_TARGET_PATTERN.test("cleanora_r1_p13_proof")).toBe(
      false,
    );
    expect(() => {
      assertR1P14DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p14_proof",
      );
    }).not.toThrow();
    expect(() => {
      assertR1P14DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/Cleanora",
      );
    }).toThrow(/unapproved target/u);
  });

  it("reads CLEANORA_R1_P14_DATABASE_URL and ignores prior-phase URLs", () => {
    const live = "postgresql://synthetic.invalid/cleanora_r1_p14_test";
    expect(
      requireR1P14ProofDatabaseUrl({
        CLEANORA_R1_P14_DATABASE_URL: live,
        CLEANORA_R1_P13_DATABASE_URL:
          "postgresql://synthetic.invalid/cleanora_r1_p13_proof",
        DATABASE_URL: "postgresql://synthetic.invalid/Cleanora",
      }),
    ).toBe(live);
    expect(() =>
      requireR1P14ProofDatabaseUrl({
        CLEANORA_R1_P13_DATABASE_URL: live,
      }),
    ).toThrow(/CLEANORA_R1_P14_DATABASE_URL is required/u);
  });

  it("accepts exactly one successful migration through R1-P13", () => {
    expect(() =>
      assertR1P13UpgradeBaselineHistory(successfulRows),
    ).not.toThrow();
    expect(R1_P13_UPGRADE_BASELINE_MIGRATIONS).toContain(
      "r1_p13_booking_draft_pricing_snapshot_status_machine",
    );
    expect(R1_P13_UPGRADE_BASELINE_MIGRATIONS).not.toContain(R1_P14_MIGRATION);
  });

  it("rejects missing, duplicate, failed, rolled-back, R1-P14, or future history rows", () => {
    expect(() =>
      assertR1P13UpgradeBaselineHistory(successfulRows.slice(1)),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P13UpgradeBaselineHistory([
        ...successfulRows,
        successfulRows[0]!,
      ]),
    ).toThrow(/one successful/u);
    expect(() =>
      assertR1P13UpgradeBaselineHistory([
        ...successfulRows,
        {
          migration_name: R1_P14_MIGRATION,
          finished_at: new Date(),
          rolled_back_at: null,
        },
      ]),
    ).toThrow(/unexpected migrations/u);
  });

  it("requires identical pre-existing row counts and content digests", () => {
    const baseline = new Map([
      ["providers", { rowCount: 2, digest: "provider-digest" }],
      ["bookings", { rowCount: 0, digest: "booking-digest" }],
    ]);
    expect(() =>
      assertBaselineDigestsPreserved(baseline, new Map(baseline)),
    ).not.toThrow();
    expect(() =>
      assertBaselineDigestsPreserved(
        baseline,
        new Map([
          ["providers", { rowCount: 2, digest: "changed" }],
          ["bookings", { rowCount: 0, digest: "booking-digest" }],
        ]),
      ),
    ).toThrow(/providers/u);
  });

  it("accepts the phase-owned R1-P14 migration SQL shape", () => {
    expect(R1_P14_LEDGER_TABLES).toHaveLength(6);
    expect(() => assertR1P14MigrationSql(migrationSql)).not.toThrow();
    expect(() =>
      assertR1P14MigrationSql(`${migrationSql}\nDROP TABLE "ledger_accounts";`),
    ).toThrow(/destructive/u);
  });

  it("uses controlled temporary upgrade directories and digest preservation", () => {
    expect(upgradeProofSource).toContain(".r1-p14-upgrade-");
    expect(upgradeProofSource).toContain(
      "readR1P13BaselineDigests(upgraded, before.keys())",
    );
    expect(upgradeProofSource).toContain("assertWorkspaceProofDirectory");
    expect(upgradeProofSource).toContain("rm(temporaryRoot");
    expect(upgradeProofSource).toContain("R1_P13_UPGRADE_BASELINE_MIGRATIONS");
    expect(upgradeProofSource).toContain("assertPostDeployState");
    expect(upgradeProofSource).not.toMatch(/migrate\s+reset/iu);
    expect(upgradeProofSource).not.toMatch(/DROP\s+DATABASE/iu);
  });

  it("skips live R1-P14 upgrade probes without an approved disposable URL", () => {
    const live = process.env["CLEANORA_R1_P14_DATABASE_URL"];
    if (live === undefined || live.trim().length === 0) {
      expect(() => requireR1P14ProofDatabaseUrl({})).toThrow(
        /CLEANORA_R1_P14_DATABASE_URL is required/u,
      );
      return;
    }
    expect(() => requireR1P14ProofDatabaseUrl()).not.toThrow();
  });
});

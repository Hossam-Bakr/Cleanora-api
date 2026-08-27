import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  R1_P06_UPGRADE_BASELINE_MIGRATIONS,
  R1_P07_MIGRATION,
  assertBaselineDigestsPreserved,
  assertR1P06UpgradeBaselineHistory,
} from "../../../scripts/validate-r1-p07-upgrade.js";

const upgradeProofSource = readFileSync(
  resolve(process.cwd(), "scripts", "validate-r1-p07-upgrade.ts"),
  "utf8",
);

const successfulRows = R1_P06_UPGRADE_BASELINE_MIGRATIONS.map((migration_name) => ({
  migration_name,
  finished_at: new Date("2026-08-23T00:00:00.000Z"),
  rolled_back_at: null,
}));

describe("R1-P07 populated R1-P06 upgrade proof guards", () => {
  it("accepts exactly one successful migration through R1-P06", () => {
    expect(() => assertR1P06UpgradeBaselineHistory(successfulRows)).not.toThrow();
  });

  it("rejects missing, duplicate, failed, rolled-back, R1-P07, or future history rows", () => {
    expect(() => assertR1P06UpgradeBaselineHistory(successfulRows.slice(1))).toThrow(/one successful/u);
    expect(() => assertR1P06UpgradeBaselineHistory([...successfulRows, successfulRows[0]!])).toThrow(/one successful/u);
    expect(() => assertR1P06UpgradeBaselineHistory([...successfulRows.slice(1), { ...successfulRows[0]!, finished_at: null }])).toThrow(/one successful/u);
    expect(() => assertR1P06UpgradeBaselineHistory([...successfulRows.slice(1), { ...successfulRows[0]!, rolled_back_at: new Date() }])).toThrow(/one successful/u);
    expect(() => assertR1P06UpgradeBaselineHistory([
      ...successfulRows,
      { migration_name: R1_P07_MIGRATION, finished_at: new Date(), rolled_back_at: null },
    ])).toThrow(/unexpected migrations/u);
    expect(() => assertR1P06UpgradeBaselineHistory([
      ...successfulRows,
      { migration_name: "future_migration", finished_at: new Date(), rolled_back_at: null },
    ])).toThrow(/unexpected migrations/u);
  });

  it("requires identical pre-existing row counts and content digests", () => {
    const baseline = new Map([
      ["providers", { rowCount: 2, digest: "provider-digest" }],
      ["provider_members", { rowCount: 3, digest: "member-digest" }],
    ]);
    expect(() => assertBaselineDigestsPreserved(baseline, new Map(baseline))).not.toThrow();
    expect(() => assertBaselineDigestsPreserved(baseline, new Map([
      ["providers", { rowCount: 2, digest: "changed" }],
      ["provider_members", { rowCount: 3, digest: "member-digest" }],
    ]))).toThrow(/providers/u);
    expect(() => assertBaselineDigestsPreserved(baseline, new Map([
      ["providers", { rowCount: 2, digest: "provider-digest" }],
    ]))).toThrow(/inventory/u);
  });

  it("uses only persisted R1-P06 Provider columns in the populated fixture", () => {
    expect(upgradeProofSource).not.toContain('"profile_completion"');
  });

  it("sets the required storage provider on every populated Media fixture", () => {
    expect(upgradeProofSource.match(/"storage_provider"/gu)).toHaveLength(2);
  });

  it("compares post-upgrade digests only for the captured R1-P06 baseline tables", () => {
    expect(upgradeProofSource).toContain(
      "readR1P06BaselineDigests(upgraded, before.keys())",
    );
  });
});

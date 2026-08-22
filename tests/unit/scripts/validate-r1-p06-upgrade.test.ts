import {
  R1_P05_UPGRADE_BASELINE_MIGRATIONS,
  R1_P06_MIGRATION,
  assertR1P05UpgradeBaselineHistory,
} from "../../../scripts/validate-r1-p06-upgrade.js";

const successfulRows = R1_P05_UPGRADE_BASELINE_MIGRATIONS.map(
  (migration_name) => ({
    migration_name,
    finished_at: new Date("2026-08-14T00:00:00.000Z"),
    rolled_back_at: null,
  }),
);

describe("R1-P06 populated R1-P05 upgrade proof guard", () => {
  it("accepts exactly one successful migration through R1-P05", () => {
    expect(() => assertR1P05UpgradeBaselineHistory(successfulRows)).not.toThrow();
  });

  it("rejects missing, duplicate, failed, rolled-back, R1-P06, or future rows", () => {
    expect(() => assertR1P05UpgradeBaselineHistory(successfulRows.slice(1)))
      .toThrow(/one successful/u);
    expect(() => assertR1P05UpgradeBaselineHistory([...successfulRows, successfulRows[0]!]))
      .toThrow(/one successful/u);
    expect(() => assertR1P05UpgradeBaselineHistory([
      ...successfulRows,
      { ...successfulRows[0]!, finished_at: null },
    ])).toThrow(/one successful/u);
    expect(() => assertR1P05UpgradeBaselineHistory([
      ...successfulRows,
      { ...successfulRows[0]!, rolled_back_at: new Date("2026-08-14T01:00:00.000Z") },
    ])).toThrow(/one successful/u);
    expect(() => assertR1P05UpgradeBaselineHistory([
      ...successfulRows.slice(1),
      { ...successfulRows[0]!, finished_at: null },
    ])).toThrow(/one successful/u);
    expect(() => assertR1P05UpgradeBaselineHistory([
      ...successfulRows.slice(1),
      { ...successfulRows[0]!, rolled_back_at: new Date("2026-08-14T01:00:00.000Z") },
    ])).toThrow(/one successful/u);
    expect(() => assertR1P05UpgradeBaselineHistory([
      ...successfulRows,
      { migration_name: R1_P06_MIGRATION, finished_at: new Date(), rolled_back_at: null },
    ])).toThrow(/unexpected migrations/u);
    expect(() => assertR1P05UpgradeBaselineHistory([
      ...successfulRows,
      { migration_name: "r1_p07_future", finished_at: new Date(), rolled_back_at: null },
    ])).toThrow(/unexpected migrations/u);
  });
});

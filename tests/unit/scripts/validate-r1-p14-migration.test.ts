import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertR1P14MigrationSql } from "../../../scripts/validate-clean-migration.js";

describe("R1-P14 migration SQL shape", () => {
  it("accepts the phase-owned ledger migration and rejects wallets or drops", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "prisma",
        "migrations",
        "r1_p14_financial_ledger_payment_architecture",
        "migration.sql",
      ),
      "utf8",
    );
    expect(() => assertR1P14MigrationSql(sql)).not.toThrow();
    expect(() => assertR1P14MigrationSql(`${sql}\nDROP TABLE "ledger_accounts";`)).toThrow(
      /destructive/u,
    );
    expect(() =>
      assertR1P14MigrationSql(`${sql}\nCREATE TABLE "user_wallets" (id text);`),
    ).toThrow(/wallets/u);
  });
});

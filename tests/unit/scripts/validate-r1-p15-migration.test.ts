import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_R1_P15_TARGET_PATTERN,
  assertR1P15DisposableDatabaseUrl,
  assertR1P15MigrationSql,
  R1_P15_MIGRATION,
  R1_P15_PAYMENT_TABLES,
  requireR1P15ProofDatabaseUrl,
} from "../../../scripts/validate-clean-migration.js";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "prisma",
    "migrations",
    R1_P15_MIGRATION,
    "migration.sql",
  ),
  "utf8",
);

describe("R1-P15 migration SQL shape and disposable URL guards", () => {
  it("accepts only approved disposable target names", () => {
    expect(APPROVED_R1_P15_TARGET_PATTERN.test("cleanora_r1_p15_proof")).toBe(
      true,
    );
    expect(
      APPROVED_R1_P15_TARGET_PATTERN.test("cleanora_r1_p15_local_test"),
    ).toBe(true);
    expect(APPROVED_R1_P15_TARGET_PATTERN.test("Cleanora")).toBe(false);
    expect(APPROVED_R1_P15_TARGET_PATTERN.test("cleanora_r1_p14_proof")).toBe(
      false,
    );
    expect(() => {
      assertR1P15DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p15_proof",
      );
    }).not.toThrow();
    expect(() => {
      assertR1P15DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/Cleanora",
      );
    }).toThrow(/unapproved target/u);
    expect(() => {
      assertR1P15DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p14_proof",
      );
    }).toThrow(/unapproved target/u);
  });

  it("reads CLEANORA_R1_P15_DATABASE_URL and never falls back", () => {
    const live = "postgresql://synthetic.invalid/cleanora_r1_p15_test";
    expect(
      requireR1P15ProofDatabaseUrl({
        CLEANORA_R1_P15_DATABASE_URL: live,
        CLEANORA_R1_P14_DATABASE_URL:
          "postgresql://synthetic.invalid/cleanora_r1_p14_proof",
        DATABASE_URL: "postgresql://synthetic.invalid/Cleanora",
      }),
    ).toBe(live);
    expect(() =>
      requireR1P15ProofDatabaseUrl({
        CLEANORA_R1_P14_DATABASE_URL: live,
        DATABASE_URL: live,
      }),
    ).toThrow(/CLEANORA_R1_P15_DATABASE_URL is required/u);
  });

  it("accepts the phase-owned deposit migration and rejects wallets or drops", () => {
    expect(R1_P15_PAYMENT_TABLES).toHaveLength(6);
    expect(() => assertR1P15MigrationSql(migrationSql)).not.toThrow();
    expect(() =>
      assertR1P15MigrationSql(`${migrationSql}\nDROP TABLE "payments";`),
    ).toThrow(/destructive/u);
    expect(() =>
      assertR1P15MigrationSql(
        `${migrationSql}\nCREATE TABLE "user_wallets" (id text);`,
      ),
    ).toThrow(/wallets/u);
    expect(() =>
      assertR1P15MigrationSql(
        `${migrationSql}\nCREATE TABLE "instapay_accounts" (id text);`,
      ),
    ).toThrow(/InstaPay/u);
  });

  it("requires partial unique SUCCEEDED deposit and payment enums", () => {
    expect(migrationSql).toMatch(/payments_one_succeeded_booking_deposit_key/);
    expect(migrationSql).toMatch(/WHERE "status" = 'SUCCEEDED'/);
    expect(migrationSql).toMatch(/CREATE TYPE "PaymentRailProvider"/);
    expect(migrationSql).toMatch(/CREATE TYPE "PaymentAttemptStatus"/);
    expect(migrationSql).toMatch(/CREATE TYPE "PaymentPurpose"/);
    for (const table of R1_P15_PAYMENT_TABLES) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
  });
});

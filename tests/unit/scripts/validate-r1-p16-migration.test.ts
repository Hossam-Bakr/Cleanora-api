import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_R1_P16_TARGET_PATTERN,
  assertR1P16DisposableDatabaseUrl,
  assertR1P16MigrationSql,
  R1_P16_MIGRATION,
  R1_P16_TABLES,
  requireR1P16ProofDatabaseUrl,
} from "../../../scripts/validate-clean-migration.js";

const migrationSql = readFileSync(
  resolve(process.cwd(), "prisma", "migrations", R1_P16_MIGRATION, "migration.sql"),
  "utf8",
);

describe("R1-P16 migration SQL shape and disposable URL guards", () => {
  it("accepts only approved disposable target names", () => {
    expect(APPROVED_R1_P16_TARGET_PATTERN.test("cleanora_r1_p16_proof")).toBe(true);
    expect(APPROVED_R1_P16_TARGET_PATTERN.test("cleanora_r1_p16_local_test")).toBe(
      true,
    );
    expect(APPROVED_R1_P16_TARGET_PATTERN.test("Cleanora")).toBe(false);
    expect(APPROVED_R1_P16_TARGET_PATTERN.test("cleanora_r1_p15_proof")).toBe(
      false,
    );
    expect(() => {
      assertR1P16DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p16_proof",
      );
    }).not.toThrow();
    expect(() => {
      assertR1P16DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/Cleanora",
      );
    }).toThrow(/unapproved target/u);
  });

  it("reads CLEANORA_R1_P16_DATABASE_URL and never falls back", () => {
    const live = "postgresql://synthetic.invalid/cleanora_r1_p16_test";
    expect(
      requireR1P16ProofDatabaseUrl({
        CLEANORA_R1_P16_DATABASE_URL: live,
        CLEANORA_R1_P15_DATABASE_URL:
          "postgresql://synthetic.invalid/cleanora_r1_p15_proof",
        DATABASE_URL: "postgresql://synthetic.invalid/Cleanora",
      }),
    ).toBe(live);
    expect(() =>
      requireR1P16ProofDatabaseUrl({
        CLEANORA_R1_P15_DATABASE_URL: live,
        DATABASE_URL: live,
      }),
    ).toThrow(/CLEANORA_R1_P16_DATABASE_URL is required/u);
  });

  it("accepts the phase-owned response migration and rejects wallets or fees", () => {
    expect(R1_P16_TABLES).toHaveLength(5);
    expect(() => assertR1P16MigrationSql(migrationSql)).not.toThrow();
    expect(() =>
      assertR1P16MigrationSql(`${migrationSql}\nDROP TABLE "booking_responses";`),
    ).toThrow(/destructive/u);
    expect(() =>
      assertR1P16MigrationSql(
        `${migrationSql}\nCREATE TABLE "user_wallets" (id text);`,
      ),
    ).toThrow(/wallets/u);
    expect(() =>
      assertR1P16MigrationSql(`${migrationSql}\n"cancellation_fee" INTEGER`),
    ).toThrow(/fee/u);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertAppliedMigration,
  assertExactMigrationDirectoryNames,
  assertR1P13MigrationSql,
  expectR1P07ConstraintRejection,
  readDatabaseSqlState,
} from "../../../scripts/validate-clean-migration.js";

const EXPECTED = [
  "r1_p01_foundation_country_configuration",
  "r1_p02_complete_authentication",
  "r1_p02_email_verification_for_individuals",
  "r1_p02_fix_phone_e164_constraint",
  "r1_p02_google_provider_profile_claims",
  "r1_p03_roles_permissions_privileged_audit",
  "r1_p03a_production_role_provisioning",
  "r1_p03a_production_role_provisioning_drop",
  "r1_p04_customer_profiles_preferences_text_addresses",
  "r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage",
  "r1_p04a_category_aware_customer_signup_verification",
  "r1_p05_provider_onboarding_profile_lifecycle",
  "r1_p06_provider_verification_external_payout_destinations",
  "r1_p07_worker_team_crew_management",
  "r1_p08_catalog_localization_service_requirements",
  "r1_p09_provider_services_pricing_historical_snapshots",
  "r1_p10_availability_capacity_textual_coverage",
  "r1_p11_eligibility_engine_v1",
  "r1_p13_booking_draft_pricing_snapshot_status_machine",
] as const;

const r1P07MigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "prisma",
    "migrations",
    "r1_p07_worker_team_crew_management",
    "migration.sql",
  ),
  "utf8",
);

describe("clean migration exact chronology", () => {
  it("rejects missing or unexpected migration directories", () => {
    expect(() => assertExactMigrationDirectoryNames(EXPECTED)).not.toThrow();
    expect(() =>
      assertExactMigrationDirectoryNames(EXPECTED.slice(1)),
    ).toThrow(/missing=/u);
    expect(() =>
      assertExactMigrationDirectoryNames([...EXPECTED, "future_migration"]),
    ).toThrow(/unexpected=/u);
  });

  it("accepts the phase-owned R1-P13 booking migration SQL shape", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "prisma",
        "migrations",
        "r1_p13_booking_draft_pricing_snapshot_status_machine",
        "migration.sql",
      ),
      "utf8",
    );
    expect(() => assertR1P13MigrationSql(sql)).not.toThrow();
    expect(() =>
      assertR1P13MigrationSql(`${sql}\nDROP TABLE "bookings";`),
    ).toThrow(/destructive/u);
  });

  it("rejects missing, duplicate, failed, or unexpected history rows", () => {
    const rows = EXPECTED.map((migration_name) => ({
      migration_name,
      finished_at: new Date("2026-08-11T00:00:00.000Z"),
      rolled_back_at: null,
    }));
    expect(() => assertAppliedMigration(rows)).not.toThrow();
    expect(() => assertAppliedMigration(rows.slice(1))).toThrow(/one successful/u);
    expect(() => assertAppliedMigration([...rows, rows[0]!])).toThrow(
      /one successful/u,
    );
    expect(() =>
      assertAppliedMigration([
        ...rows,
        {
          migration_name: "future_migration",
          finished_at: new Date("2026-08-11T00:00:00.000Z"),
          rolled_back_at: null,
        },
      ]),
    ).toThrow(/unexpected rows/u);
  });

  it("accepts only the expected live R1-P07 constraint SQLSTATE", async () => {
    expect(readDatabaseSqlState({ code: "P2002" })).toBe("23505");
    expect(readDatabaseSqlState({
      name: "DriverAdapterError",
      cause: { kind: "postgres", code: "23514", originalCode: "23514" },
    })).toBe("23514");
    expect(readDatabaseSqlState({
      code: "P2010",
      meta: { driverAdapterError: { cause: { originalCode: "23514" } } },
    })).toBe("23514");
    await expect(expectR1P07ConstraintRejection(
      "synthetic check",
      "23514",
      () => Promise.reject({ code: "P2010", meta: { code: "23514" } }),
    )).resolves.toBeUndefined();
    await expect(expectR1P07ConstraintRejection(
      "synthetic check",
      "23514",
      () => Promise.reject({ code: "P2010", meta: { code: "42601" } }),
    )).rejects.toThrow(/unexpected safe database code/u);
    await expect(expectR1P07ConstraintRejection(
      "synthetic check",
      "23514",
      async () => undefined,
    )).rejects.toThrow(/accepted synthetic check/u);
  });

  it("resolves the required-profile trigger key only from the active trigger table shape", () => {
    expect(r1P07MigrationSql).toMatch(
      /IF TG_TABLE_NAME = 'provider_workers' THEN\r?\n {4}worker_key := NEW\."id";/u,
    );
    expect(r1P07MigrationSql).toMatch(
      /ELSE\r?\n {4}worker_key := OLD\."worker_id";/u,
    );
    expect(r1P07MigrationSql).not.toContain(
      "worker_key := CASE WHEN TG_TABLE_NAME = 'provider_workers'",
    );
  });
});

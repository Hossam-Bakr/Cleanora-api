import { readFile } from "node:fs/promises";
import { join } from "node:path";


import {
  assertAppliedMigration,
  assertAuthorizationCatalogMigrationSql,
  assertDatabaseEmpty,
  assertExactPostDeployTables,
  assertForwardMigrationSql,
  assertSafeCleanTestDatabaseUrl
} from "../../scripts/validate-clean-migration.js";

const migrationDirectory = join(
  process.cwd(),
  "prisma/migrations/r1_p01_foundation_country_configuration"
);

describe("R1-P01 migration boundary", () => {
  it("uses the phase-owned migration name and creates only approved foundations", async () => {
    const sql = await readFile(join(migrationDirectory, "migration.sql"), "utf8");

    expect(migrationDirectory).toContain(
      "r1_p01_foundation_country_configuration"
    );
    expect(sql).toContain('CREATE TABLE "currencies"');
    expect(sql).toContain('CREATE TABLE "countries"');
    expect(sql).toContain('CREATE TABLE "app_configs"');
    expect(sql).toContain('CREATE TABLE "country_configs"');
    expect(sql).toContain('CREATE TABLE "audit_logs"');
    expect(sql).not.toMatch(/CREATE TABLE "(?:users|sessions|roles|permissions)"/i);
  });

  it("rejects a non-empty target before migration deploy", () => {
    expect(() => assertDatabaseEmpty(["existing_table"])).toThrow(/must be empty/i);
    expect(() => assertDatabaseEmpty([])).not.toThrow();
  });

  it("rejects production-looking clean-apply targets", () => {
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora_production"
      )
    ).toThrow(/production target/i);
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora",
        "test"
      )
    ).toThrow(/explicit test/i);
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora_test",
        "production"
      )
    ).toThrow(/forbidden in production/i);
    expect(() =>
      assertSafeCleanTestDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora_test",
        "test"
      )
    ).not.toThrow();
  });

  it("requires the exact R1-P01 post-deploy table inventory", () => {
    const expected = [
      "_prisma_migrations",
      "app_configs",
      "audit_logs",
      "countries",
      "country_configs",
      "currencies"
    ];

    expected.push('users', 'user_credentials', 'user_sessions', 'otp_codes', 'password_reset_tokens', 'social_accounts', 'auth_events');
    expected.push(
      "roles",
      "permissions",
      "role_permissions",
      "user_roles",
      "privileged_action_reasons",
    );
    expected.push(
      "customer_profiles",
      "individual_profiles",
      "company_profiles",
      "engineer_profiles",
      "user_preferences",
      "user_addresses",
      "privacy_requests",
      "media_files",
    );
    expect(() => assertExactPostDeployTables(expected)).not.toThrow();
    expect(() =>
      assertExactPostDeployTables([...expected, "future_phase_table"])
    ).toThrow(/unexpected tables/i);
    expect(() =>
      assertExactPostDeployTables(expected.filter((table) => table !== "audit_logs"))
    ).toThrow(/missing tables/i);
  });

  it("requires one successfully applied phase-owned migration history row", () => {
    expect(() =>
      assertAppliedMigration([
        {
          migration_name: "r1_p01_foundation_country_configuration",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: 'r1_p02_complete_authentication',
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: 'r1_p02_fix_phone_e164_constraint',
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p02_google_provider_profile_claims",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p03_roles_permissions_privileged_audit",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p04_customer_profiles_preferences_text_addresses",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name:
            "r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p04a_category_aware_customer_signup_verification",
          finished_at: new Date(),
          rolled_back_at: null
        }
      ])
    ).not.toThrow();
    expect(() => assertAppliedMigration([])).toThrow(/migration history/i);
  });
});

describe("R1-P03 chronological migration compatibility", () => {
  it("applies after every earlier phase without touching their tables", async () => {
    const sql = await readFile(
      join(
        process.cwd(),
        "prisma/migrations/r1_p03_roles_permissions_privileged_audit/migration.sql"
      ),
      "utf8"
    );

    expect(() => assertAuthorizationCatalogMigrationSql(sql)).not.toThrow();
    for (const earlierTable of [
      "currencies",
      "countries",
      "app_configs",
      "country_configs",
      "audit_logs",
      "user_credentials",
      "user_sessions",
      "otp_codes",
      "password_reset_tokens",
      "social_accounts",
      "auth_events"
    ]) {
      expect(sql).not.toContain(`"${earlierTable}"`);
    }
    // user_roles references users, so only that read-only reference is expected.
    expect(sql.match(/REFERENCES "users"/gu) ?? []).toHaveLength(1);
  });

  it("rejects an R1-P03 migration that changes admin-owned audit persistence", () => {
    expect(() =>
      assertAuthorizationCatalogMigrationSql(
        'CREATE TABLE "roles" ();\nALTER TABLE "audit_logs" ADD COLUMN "extra" TEXT;'
      )
    ).toThrow(/audit_logs/u);
  });

  it("rejects an R1-P03 migration that drops an earlier-phase object", () => {
    expect(() =>
      assertAuthorizationCatalogMigrationSql(
        'CREATE TABLE "roles" ();\nDROP TABLE "users";'
      )
    ).toThrow(/destructive SQL/u);
  });
});

describe('strict E.164 forward migration validation', () => {
  it('rejects comments, unrelated SQL, and destructive SQL', () => {
    const approved = `ALTER TABLE users DROP CONSTRAINT users_phone_e164_check;
ALTER TABLE users ADD CONSTRAINT users_phone_e164_check
CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{1,14}$');`;
    expect(() => assertForwardMigrationSql(approved)).not.toThrow();
    expect(() => assertForwardMigrationSql(`-- ignored comment\n${approved}`)).toThrow(/unrelated SQL/u);
    expect(() => assertForwardMigrationSql(`${approved}\nSELECT 1;`)).toThrow(/unrelated SQL/u);
    expect(() => assertForwardMigrationSql(`${approved}\nDROP TABLE users;`)).toThrow(/destructive SQL/u);
  });
});

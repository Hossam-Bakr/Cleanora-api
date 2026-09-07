import { readFile } from "node:fs/promises";
import { join } from "node:path";


import {
  assertAppliedMigration,
  assertAuthorizationCatalogMigrationSql,
  assertDatabaseEmpty,
  assertExactPostDeployTables,
  assertForwardMigrationSql,
  assertR1P06DisposableDatabaseUrl,
  assertR1P07DisposableDatabaseUrl,
  assertSafeCleanTestDatabaseUrl,
  createMigrationProofPrismaClient,
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

  it("requires the current phase proof target to name R1-P06 explicitly", () => {
    expect(() =>
      assertR1P06DisposableDatabaseUrl(
        "postgresql://cleanora:secret@127.0.0.1/cleanora_r1_p06_local_test",
        "test",
      ),
    ).not.toThrow();
    expect(() =>
      assertR1P06DisposableDatabaseUrl(
        "postgresql://cleanora:secret@db.example.com/cleanora_r1-p06_proof",
        "test",
      ),
    ).not.toThrow();
    expect(() =>
      assertR1P06DisposableDatabaseUrl(
        "postgresql://cleanora:secret@127.0.0.1/cleanora_r1_p04_clean_proof",
        "test",
      ),
    ).toThrow(/explicitly named R1-P06/u);
  });

  it("requires the active phase proof target to name R1-P07 explicitly", () => {
    expect(() =>
      assertR1P07DisposableDatabaseUrl(
        "postgresql://cleanora:secret@127.0.0.1/cleanora_r1_p07_local_test",
        "test",
      ),
    ).not.toThrow();
    expect(() =>
      assertR1P07DisposableDatabaseUrl(
        "postgresql://cleanora:secret@127.0.0.1/cleanora_r1_p06_local_test",
        "test",
      ),
    ).toThrow(/explicitly named R1-P07/u);
  });

  it("constructs a schema-aware Prisma proof client for isolated schemas", async () => {
    const schemaAware = createMigrationProofPrismaClient(
      "postgresql://cleanora:secret@127.0.0.1/cleanora_r1_p06_local_test?schema=r1_p06_isolated",
    );
    const baseSchema = createMigrationProofPrismaClient(
      "postgresql://cleanora:secret@127.0.0.1/cleanora_r1_p06_local_test",
    );
    await expect(schemaAware.$disconnect()).resolves.toBeUndefined();
    await expect(baseSchema.$disconnect()).resolves.toBeUndefined();
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
    expected.push(
      "providers",
      "provider_profiles",
      "provider_contacts",
      "provider_status_history",
      "provider_members",
      "provider_admin_invitations",
      "provider_gallery_items",
      "provider_email_outbox",
      "sensitive_action_proof_uses",
      "verification_document_types",
      "verification_document_policy_versions",
      "verification_document_policy_items",
      "provider_policy_activation_states",
      "provider_document_chains",
      "provider_document_versions",
      "provider_document_evidence",
      "provider_document_reviews",
      "provider_verification_history",
      "payout_destination_types",
      "payout_operators",
      "payout_banks",
      "payout_country_policies",
      "provider_payout_destination_chains",
      "provider_payout_identity_claims",
      "provider_payout_lookup_fingerprints",
      "provider_payout_destination_versions",
      "provider_payout_decisions",
      "provider_primary_payout_destinations",
      "provider_payout_conflicts",
      "provider_payout_history",
      "provider_payout_key_rotation_runs",
      "provider_workers",
      "provider_worker_profiles",
      "provider_worker_skills",
      "provider_worker_login_access",
      "provider_worker_invitations",
      "provider_teams",
      "provider_team_memberships",
      "provider_workforce_history",
      "provider_workforce_commands",
      "provider_workforce_notification_intents",
      "service_categories",
      "services",
      "service_translations",
      "service_price_units",
      "service_fields",
      "service_field_options",
      "service_country_availability",
      "service_media_associations",
      "catalog_command_requests",
      "provider_services",
      "provider_service_prices",
      "provider_service_price_history",
      "provider_service_status_history",
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
    const successfulRows = [
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
          migration_name: "r1_p02_email_verification_for_individuals",
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
          migration_name: "r1_p03a_production_role_provisioning",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p03a_production_role_provisioning_drop",
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
        },
        {
          migration_name: "r1_p05_provider_onboarding_profile_lifecycle",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p06_provider_verification_external_payout_destinations",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p07_worker_team_crew_management",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name: "r1_p08_catalog_localization_service_requirements",
          finished_at: new Date(),
          rolled_back_at: null
        },
        {
          migration_name:
            "r1_p09_provider_services_pricing_historical_snapshots",
          finished_at: new Date(),
          rolled_back_at: null
        }
      ];
    expect(() => assertAppliedMigration(successfulRows)).not.toThrow();
    expect(() => assertAppliedMigration([
      ...successfulRows,
      { ...successfulRows[0]!, finished_at: null },
    ])).toThrow(/exactly one successful/u);
    expect(() => assertAppliedMigration([
      ...successfulRows,
      { ...successfulRows[0]!, rolled_back_at: new Date() },
    ])).toThrow(/exactly one successful/u);
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

import {
  assertAppliedMigration,
  assertExactMigrationDirectoryNames,
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
] as const;

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
});

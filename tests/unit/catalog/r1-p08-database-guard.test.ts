import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";


import {
  APPROVED_R1_P08_TARGET_PATTERN,
  assertR1P08DisposableDatabaseUrl,
  assertR1P08MigrationSql,
  R1_P08_CATALOG_TABLES,
  R1_P08_MIGRATION,
  requireR1P08ProofDatabaseUrl,
} from "../../../scripts/validate-r1-p08-upgrade.js";

const migrationsRoot = join(process.cwd(), "prisma", "migrations");
const migrationSql = readFileSync(
  join(migrationsRoot, R1_P08_MIGRATION, "migration.sql"),
  "utf8",
).replaceAll("\r\n", "\n");
const schema = readFileSync(
  join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
).replaceAll("\r\n", "\n");

/**
 * FR-051 / SC-011 static migration shape guard. No database is contacted.
 */
describe("R1-P08 static migration guard", () => {
  it("appends exactly one forward migration after R1-P07", () => {
    const folders = readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toHaveLength(15);
    expect(folders.at(-1)).toBe(R1_P08_MIGRATION);
    expect(folders.at(-2)).toBe("r1_p07_worker_team_crew_management");
    expect(R1_P08_MIGRATION).toBe("r1_p08_catalog_localization_service_requirements");
  });

  it("creates exactly the nine Catalog tables named by data-model.md", () => {
    for (const table of R1_P08_CATALOG_TABLES) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
    expect(R1_P08_CATALOG_TABLES).toHaveLength(9);
    expect(migrationSql.match(/CREATE TABLE/gu) ?? []).toHaveLength(9);
  });

  it("creates only the four Catalog enums and extends MediaOwnerType additively", () => {
    for (const enumName of [
      "CatalogLocale",
      "ServiceFieldKind",
      "ServiceNumberMode",
      "CatalogCommandStatus",
    ]) {
      expect(migrationSql).toContain(`CREATE TYPE "${enumName}"`);
    }
    expect(migrationSql.match(/CREATE TYPE/gu) ?? []).toHaveLength(4);
    expect(migrationSql).toMatch(
      /ALTER TYPE "MediaOwnerType" ADD VALUE '(?:IF NOT EXISTS )?CATALOG_SERVICE_IMAGE'/u,
    );
  });

  it("contains no destructive, reset, or future-phase statement", () => {
    for (const forbidden of [
      /\bDROP\s+TABLE\b/iu,
      /\bTRUNCATE\b/iu,
      /\bDELETE\s+FROM\b/iu,
      /\bDROP\s+SCHEMA\b/iu,
      /\bDROP\s+(?:COLUMN|CONSTRAINT|TYPE)\b/iu,
      /\bbrowse\b/iu,
      /\bbooking\b/iu,
      /\bprovider_offering/iu,
      /\bcustomer_answer/iu,
    ]) {
      expect(migrationSql).not.toMatch(forbidden);
    }
    expect(() => {
      assertR1P08MigrationSql(migrationSql);
    }).not.toThrow();
  });

  it("declares the named first-application checks migration-plan.md requires", () => {
    for (const constraint of [
      "service_categories_code_format_check",
      "service_categories_display_order_nonneg_check",
      "service_categories_version_positive_check",
      "services_code_format_check",
      "services_display_order_nonneg_check",
      "services_version_positive_check",
      "service_price_units_code_format_check",
      "service_price_units_display_order_nonneg_check",
      "service_fields_code_format_check",
      "service_fields_display_order_nonneg_check",
      "service_fields_information_required_check",
      "service_fields_text_bounds_check",
      "service_fields_text_length_nonneg_check",
      "service_fields_text_length_order_check",
      "service_fields_number_mode_check",
      "service_fields_number_bounds_order_check",
      "service_fields_selection_bounds_kind_check",
      "service_fields_selection_bounds_nonneg_check",
      "service_fields_selection_bounds_order_check",
      "service_field_options_value_format_check",
      "service_field_options_display_order_nonneg_check",
      "service_media_associations_display_order_nonneg_check",
      "catalog_command_requests_hash_format_check",
      "catalog_command_requests_completed_shape_check",
    ]) {
      expect(migrationSql).toContain(constraint);
    }
  });

  it("keeps stable references restrict-deleted", () => {
    expect(migrationSql.match(/ON DELETE RESTRICT/gu) ?? []).not.toHaveLength(0);
    expect(migrationSql).not.toMatch(/ON DELETE CASCADE/u);
    expect(migrationSql).not.toMatch(/ON DELETE SET NULL/u);
  });

  it("adds only the Catalog models and additive Media/Country relations to the schema", () => {
    for (const model of [
      "model ServiceCategory",
      "model Service ",
      "model ServiceTranslation",
      "model ServicePriceUnit",
      "model ServiceField",
      "model ServiceFieldOption",
      "model ServiceCountryAvailability",
      "model ServiceMediaAssociation",
      "model CatalogCommandRequest",
    ]) {
      expect(schema).toContain(model);
    }
    expect(schema).toMatch(/enum MediaOwnerType \{[^}]*CATALOG_SERVICE_IMAGE/su);

    const mediaFileModel = schema.match(/model MediaFile \{[\s\S]*?\n\}/u)?.[0] ?? "";
    expect(mediaFileModel).toContain("serviceMediaAssociation");
    for (const catalogColumn of ["serviceId", "displayOrder", "isActive", "version"]) {
      expect(mediaFileModel).not.toMatch(new RegExp(`\\b${catalogColumn}\\b`, "u"));
    }
  });

  it("fails closed on an unapproved live target name", () => {
    expect(APPROVED_R1_P08_TARGET_PATTERN.test("cleanora_r1_p08_clean")).toBe(true);
    expect(() => {
      assertR1P08DisposableDatabaseUrl(
        "postgresql://synthetic.invalid/cleanora_r1_p08_proof",
      );
    }).not.toThrow();
    for (const unapproved of [
      "postgresql://synthetic.invalid/Cleanora",
      "postgresql://synthetic.invalid/cleanora_r1_p07_proof",
      "postgresql://synthetic.invalid/postgres",
    ]) {
      expect(() => {
        assertR1P08DisposableDatabaseUrl(unapproved);
      }).toThrow(/unapproved target/u);
    }
  });

  it("reads CLEANORA_R1_P08_DATABASE_URL and ignores a P04-named TEST_MIGRATION_DATABASE_URL", () => {
    const live = "postgresql://synthetic.invalid/cleanora_r1_p08_test";
    const integration = "postgresql://synthetic.invalid/cleanora_r1_p04_current_proof";
    expect(requireR1P08ProofDatabaseUrl({
      CLEANORA_R1_P08_DATABASE_URL: live,
      TEST_MIGRATION_DATABASE_URL: integration,
    })).toBe(live);
    expect(() => requireR1P08ProofDatabaseUrl({
      TEST_MIGRATION_DATABASE_URL: live,
    })).toThrow(/CLEANORA_R1_P08_DATABASE_URL is required/u);
  });
});

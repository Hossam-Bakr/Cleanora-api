import { readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "prisma/migrations/r1_p04_customer_profiles_preferences_text_addresses/migration.sql",
);

const approvedTables = [
  "media_files",
  "customer_profiles",
  "individual_profiles",
  "company_profiles",
  "engineer_profiles",
  "user_preferences",
  "user_addresses",
  "privacy_requests",
];

const approvedEnums = [
  "PrivacyRequestPurpose",
  "PrivacyRequestStatus",
  "PrivacyRequestOutcomeCode",
  "PreferredLanguage",
  "MediaOwnerType",
  "MediaStatus",
];

describe("R1-P04 migration boundary", () => {
  let sql: string;

  beforeAll(async () => {
    sql = await readFile(migrationPath, "utf8");
  });

  it("creates only the eight approved customers and media tables", () => {
    for (const table of approvedTables) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
    expect(sql.match(/CREATE TABLE/gu) ?? []).toHaveLength(
      approvedTables.length,
    );
  });

  it("adds the customers and media enums plus privileged reassignment value", () => {
    for (const enumName of approvedEnums) {
      expect(sql).toContain(`CREATE TYPE "${enumName}"`);
    }
    expect(sql).toContain(
      `ALTER TYPE "PrivilegedActionOperation" ADD VALUE 'PRIVACY_REQUEST_REASSIGN'`,
    );
    for (const purpose of ["DEACTIVATION", "DELETION", "EXPORT"]) {
      expect(sql).toContain(`'${purpose}'`);
    }
    for (const status of [
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
    for (const outcome of ["REQUEST_FULFILLED", "REQUEST_REJECTED"]) {
      expect(sql).toContain(`'${outcome}'`);
    }
    expect(sql).toContain("'CUSTOMER_PROFILE_IMAGE'");
    for (const mediaStatus of ["READY", "PENDING_DELETE", "DELETED"]) {
      expect(sql).toContain(`'${mediaStatus}'`);
    }
  });

  it("keeps admin-owned audit_logs and authentication catalog tables untouched", () => {
    expect(sql).not.toContain("audit_logs");
    expect(sql).not.toContain('CREATE TABLE "roles"');
    expect(sql).not.toContain('CREATE TABLE "permissions"');
  });

  it("uses only forward, non-destructive SQL", () => {
    expect(sql).not.toMatch(
      /\b(DROP\s+TABLE|DROP\s+COLUMN|DROP\s+CONSTRAINT|TRUNCATE|DELETE\s+FROM)\b/iu,
    );
  });

  it("enforces one active privacy request per identity and purpose", () => {
    expect(sql).toContain("privacy_requests_one_active_per_purpose");
    expect(sql).toContain("WHERE \"status\" IN ('PENDING', 'PROCESSING')");
  });

  it("adds lifecycle CHECK constraints for every privacy request status", () => {
    for (const constraint of [
      "privacy_requests_pending_shape_check",
      "privacy_requests_processing_shape_check",
      "privacy_requests_completed_shape_check",
      "privacy_requests_rejected_shape_check",
      "privacy_requests_cancelled_shape_check",
    ]) {
      expect(sql).toContain(constraint);
    }
    expect(sql).toContain('"processor_id" IS NULL');
    expect(sql).toContain('"processing_at" IS NULL');
    expect(sql).toContain('"outcome_code" = \'REQUEST_FULFILLED\'');
    expect(sql).toContain('"outcome_code" = \'REQUEST_REJECTED\'');
  });

  it("creates the approved lookup indexes", () => {
    for (const index of [
      "customer_profiles_user_id_key",
      "customer_profiles_profile_image_media_file_id_key",
      "individual_profiles_user_id_key",
      "company_profiles_user_id_key",
      "engineer_profiles_user_id_key",
      "user_preferences_user_id_key",
      "user_addresses_user_id_idx",
      "privacy_requests_user_id_purpose_status_idx",
      "privacy_requests_purge_after_idx",
      "media_files_owner_user_id_owner_type_idx",
      "media_files_status_idx",
    ]) {
      expect(sql).toContain(index);
    }
  });

  it("protects authoritative parents with restrict foreign keys except profile image set null", () => {
    const foreignKeys = sql.match(/ADD CONSTRAINT[\s\S]*?;/gu) ?? [];
    const references = foreignKeys.filter((statement) =>
      statement.includes("FOREIGN KEY"),
    );

    expect(references).toHaveLength(10);
    const setNullKeys = references.filter((statement) =>
      statement.includes("profile_image_media_file_id_fkey"),
    );
    expect(setNullKeys).toHaveLength(1);
    expect(setNullKeys[0]).toContain("ON DELETE SET NULL");
    for (const statement of references.filter(
      (entry) => !entry.includes("profile_image_media_file_id_fkey"),
    )) {
      expect(statement).toContain("ON DELETE RESTRICT");
    }
  });

  it("stores processor_id without a database foreign key", () => {
    expect(sql).toContain('"processor_id" TEXT');
    expect(sql).not.toMatch(/FOREIGN KEY\s*\(\s*"processor_id"\s*\)/iu);
  });
});

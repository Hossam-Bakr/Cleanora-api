import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { constants as fsConstants } from "node:fs";

import {
  R1_P05_MIGRATION_SUFFIX,
  R1_P05_PROVIDER_TABLES,
} from "../helpers/assert-r1-p05-schema.js";

const migrationsRoot = join(process.cwd(), "prisma/migrations");

const providerMediaOwnerTypes = [
  "PROVIDER_LOGO",
  "PROVIDER_COVER",
  "PROVIDER_GALLERY_IMAGE",
  "PROVIDER_GALLERY_VIDEO",
] as const;

async function resolveP05MigrationDirectory(): Promise<string> {
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  const match = entries.find(
    (entry) =>
      entry.isDirectory() &&
      (entry.name === R1_P05_MIGRATION_SUFFIX ||
        entry.name.endsWith(`_${R1_P05_MIGRATION_SUFFIX}`)),
  );
  expect(
    match,
    `Expected a prisma/migrations folder named or suffixed ${R1_P05_MIGRATION_SUFFIX}`,
  ).toBeDefined();
  return join(migrationsRoot, match!.name);
}

async function readP05MigrationSql(): Promise<string> {
  const directory = await resolveP05MigrationDirectory();
  const sqlPath = join(directory, "migration.sql");
  await access(sqlPath, fsConstants.R_OK);
  return readFile(sqlPath, "utf8");
}

describe("R1-P05 migration hygiene", () => {
  it("requires the phase-owned migration folder to exist", async () => {
    const directory = await resolveP05MigrationDirectory();
    expect(directory).toContain(R1_P05_MIGRATION_SUFFIX);
    await expect(
      access(join(directory, "migration.sql"), fsConstants.R_OK),
    ).resolves.toBeUndefined();
  });

  it("creates exactly eight Provider-owned tables", async () => {
    const sql = await readP05MigrationSql();
    for (const table of R1_P05_PROVIDER_TABLES) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
    const providerCreates = (sql.match(/CREATE TABLE "provider/gu) ?? []).length;
    // providers + seven provider_* tables
    expect(providerCreates).toBe(R1_P05_PROVIDER_TABLES.length);
    expect(sql.match(/CREATE TABLE "providers"/gu) ?? []).toHaveLength(1);
  });

  it("deliberately drops users_categories_nonempty_check", async () => {
    const sql = await readP05MigrationSql();
    expect(sql).toMatch(
      /DROP\s+CONSTRAINT\s+"users_categories_nonempty_check"/iu,
    );
  });

  it("adds MediaStatus PROCESSING/FAILED and Provider MediaOwnerType values", async () => {
    const sql = await readP05MigrationSql();
    expect(sql).toContain(
      `ALTER TYPE "MediaStatus" ADD VALUE 'PROCESSING'`,
    );
    expect(sql).toContain(`ALTER TYPE "MediaStatus" ADD VALUE 'FAILED'`);
    for (const ownerType of providerMediaOwnerTypes) {
      expect(sql).toContain(
        `ALTER TYPE "MediaOwnerType" ADD VALUE '${ownerType}'`,
      );
    }
  });

  it("adds invitation OTP purpose and nullable category purpose-shape CHECK", async () => {
    const sql = await readP05MigrationSql();
    expect(sql).toContain(
      `ALTER TYPE "OtpPurpose" ADD VALUE 'PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION'`,
    );
    expect(sql).toMatch(
      /ALTER TABLE "otp_codes" ALTER COLUMN "account_category" DROP NOT NULL/iu,
    );
    expect(sql).toContain("otp_codes_purpose_shape_check");
    expect(sql).toMatch(
      /PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION[\s\S]*"account_category" IS NULL/iu,
    );
  });

  it("declares one-application, one-OWNER, and pending-invite uniqueness", async () => {
    const sql = await readP05MigrationSql();
    expect(sql).toMatch(
      /providers_application_owner_user_id_key|UNIQUE\s*\(\s*"application_owner_user_id"\s*\)/iu,
    );
    expect(sql).toContain("provider_members_one_owner_per_provider");
    expect(sql).toContain(
      "provider_admin_invitations_one_pending_per_email",
    );
  });
});

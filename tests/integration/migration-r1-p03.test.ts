import { readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "prisma/migrations/r1_p03_roles_permissions_privileged_audit/migration.sql",
);

const approvedTables = [
  "roles",
  "permissions",
  "role_permissions",
  "user_roles",
  "privileged_action_reasons",
];

describe("R1-P03 migration boundary", () => {
  let sql: string;

  beforeAll(async () => {
    sql = await readFile(migrationPath, "utf8");
  });

  it("creates only the five approved identity authorization tables", () => {
    for (const table of approvedTables) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
    expect(sql.match(/CREATE TABLE/gu) ?? []).toHaveLength(
      approvedTables.length,
    );
  });

  it("adds the grant status and privileged-operation enums", () => {
    expect(sql).toContain('CREATE TYPE "UserRoleStatus"');
    expect(sql).toContain("'ENABLED'");
    expect(sql).toContain("'DISABLED'");
    expect(sql).toContain("'REVOKED'");
    expect(sql).toContain('CREATE TYPE "PrivilegedActionOperation"');
    for (const operation of [
      "ROLE_ASSIGN",
      "ROLE_REVOKE",
      "ROLE_ENABLE",
      "ROLE_DISABLE",
      "STAFF_SAMPLE_PRIVILEGED_WRITE",
    ]) {
      expect(sql).toContain(`'${operation}'`);
    }
  });

  it("keeps the admin-owned audit_logs table untouched", () => {
    expect(sql).not.toContain("audit_logs");
  });

  it("uses only forward, non-destructive SQL", () => {
    expect(sql).not.toMatch(
      /\b(DROP\s+TABLE|DROP\s+COLUMN|DROP\s+CONSTRAINT|TRUNCATE|DELETE\s+FROM)\b/iu,
    );
  });

  it("enforces the approved unique business keys", () => {
    for (const uniqueIndex of [
      "roles_code_key",
      "permissions_code_key",
      "role_permissions_role_id_permission_id_key",
      "user_roles_user_id_role_id_key",
      "privileged_action_reasons_code_key",
      "privileged_action_reasons_operation_key",
    ]) {
      expect(sql).toContain(uniqueIndex);
    }
  });

  it("creates the approved lookup indexes", () => {
    for (const index of [
      "role_permissions_role_id_idx",
      "role_permissions_permission_id_idx",
      "user_roles_user_id_status_idx",
      "user_roles_role_id_idx",
      "privileged_action_reasons_is_active_idx",
    ]) {
      expect(sql).toContain(index);
    }
  });

  it("protects authoritative parents with restrict foreign keys", () => {
    const foreignKeys = sql.match(/ADD CONSTRAINT[\s\S]*?;/gu) ?? [];
    const references = foreignKeys.filter((statement) =>
      statement.includes("FOREIGN KEY"),
    );

    expect(references).toHaveLength(4);
    for (const statement of references) {
      expect(statement).toContain("ON DELETE RESTRICT");
    }
  });

  it("stores no actor column on user_roles and no definition activation flags", () => {
    expect(sql).not.toContain("assigned_by_user_id");

    const rolesTable = sql.slice(
      sql.indexOf('CREATE TABLE "roles"'),
      sql.indexOf('CREATE TABLE "role_permissions"'),
    );
    expect(rolesTable).not.toContain("is_active");
    expect(sql).toContain('"is_active" BOOLEAN NOT NULL DEFAULT true');
  });
});

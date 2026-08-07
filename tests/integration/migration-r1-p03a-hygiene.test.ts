import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Prove R1-P03A migration hygiene (DEC-030):
 * create SQL restores superseded tables, and a later-named drop migration
 * removes them so a fresh apply does not leave bootstrap tables behind.
 */
describe("R1-P03A migration hygiene", () => {
  const migrationsRoot = join(process.cwd(), "prisma/migrations");
  const createName = "r1_p03a_production_role_provisioning";
  const orderedDropName = "r1_p03a_production_role_provisioning_drop";

  it("orders create before the forward drop lexicographically", () => {
    expect(createName.localeCompare(orderedDropName)).toBeLessThan(0);
    const names = readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    expect(names).not.toContain("r1_p03a_drop_obsolete_bootstrap_tables");
    expect(names.indexOf(createName)).toBeLessThan(names.indexOf(orderedDropName));
  });

  it("create SQL defines both superseded tables and drop SQL removes them", () => {
    const createSql = readFileSync(
      join(migrationsRoot, createName, "migration.sql"),
      "utf8",
    );
    const dropSql = readFileSync(
      join(migrationsRoot, orderedDropName, "migration.sql"),
      "utf8",
    );
    expect(createSql).toContain('CREATE TABLE "staff_admin_bootstrap_closures"');
    expect(createSql).toContain(
      'CREATE TABLE "staff_admin_bootstrap_authorization_uses"',
    );
    expect(dropSql).toMatch(
      /DROP TABLE IF EXISTS "staff_admin_bootstrap_authorization_uses"/i,
    );
    expect(dropSql).toMatch(
      /DROP TABLE IF EXISTS "staff_admin_bootstrap_closures"/i,
    );
  });

  it("does not keep bootstrap models in the active Prisma schema", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).not.toMatch(/StaffAdminBootstrap/u);
    expect(schema).not.toMatch(/staff_admin_bootstrap_/u);
  });
});

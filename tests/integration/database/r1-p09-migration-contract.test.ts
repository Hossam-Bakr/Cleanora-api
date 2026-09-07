import { readFileSync } from "node:fs";
import { join } from "node:path";

const R1_P09_MIGRATION =
  "r1_p09_provider_services_pricing_historical_snapshots";

const migrationSql = readFileSync(
  join(process.cwd(), "prisma", "migrations", R1_P09_MIGRATION, "migration.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

/**
 * Static R1-P09 migration contract (T010). Reads phase-owned SQL only —
 * no live database connection.
 */
describe("R1-P09 migration constraint contract (static, T010)", () => {
  it("creates the four Provider service tables", () => {
    for (const table of [
      "provider_services",
      "provider_service_prices",
      "provider_service_price_history",
      "provider_service_status_history",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("declares the R1-P09 enums", () => {
    expect(migrationSql).toContain(
      `CREATE TYPE "ProviderServicePriceStatus" AS ENUM`,
    );
    expect(migrationSql).toContain(
      `CREATE TYPE "ProviderServicePriceHistoryEvent" AS ENUM`,
    );
    expect(migrationSql).toContain(
      `CREATE TYPE "ProviderServiceStatusHistoryEvent" AS ENUM`,
    );
    expect(migrationSql).toContain("'PENDING'");
    expect(migrationSql).toContain("'EFFECTIVE'");
    expect(migrationSql).toContain("'REJECTED'");
    expect(migrationSql).toContain("'SUPERSEDED'");
  });

  it("enforces partial unique pending and effective price indexes", () => {
    expect(migrationSql).toContain(
      `CREATE UNIQUE INDEX "provider_service_prices_pending_unique"
  ON "provider_service_prices"("provider_service_id")
  WHERE "status" = 'PENDING'`,
    );
    expect(migrationSql).toContain(
      `CREATE UNIQUE INDEX "provider_service_prices_effective_unique"
  ON "provider_service_prices"("provider_service_id")
  WHERE "status" = 'EFFECTIVE'`,
    );
  });

  it("adds the Catalog supporting composite unique for price-unit/service FK integrity", () => {
    expect(migrationSql).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "service_price_units_id_service_id_key"
  ON "service_price_units"("id", "service_id")`,
    );
  });

  it("stores commercial amounts as numeric(65,0) minor units", () => {
    expect(migrationSql).toMatch(
      /"provider_price_minor_units" DECIMAL\(65,\s*0\)/u,
    );
    expect(migrationSql).toMatch(
      /"minimum_charge_minor_units" DECIMAL\(65,\s*0\)/u,
    );
    expect(migrationSql).toMatch(
      /"maximum_price_minor_units_at_proposal" DECIMAL\(65,\s*0\)/u,
    );
  });

  it("uses ON DELETE RESTRICT for Provider service foreign keys", () => {
    const restrictCount = (
      migrationSql.match(/ON DELETE RESTRICT ON UPDATE CASCADE/gu) ?? []
    ).length;
    expect(restrictCount).toBeGreaterThanOrEqual(10);
    expect(migrationSql).not.toMatch(
      /REFERENCES "provider_services".*ON DELETE CASCADE/su,
    );
    expect(migrationSql).not.toMatch(
      /REFERENCES "provider_service_prices".*ON DELETE CASCADE/su,
    );
  });

  it("installs immutability / lifecycle triggers for history and prices", () => {
    expect(migrationSql).toContain(
      `CREATE TRIGGER "provider_service_price_history_immutable"`,
    );
    expect(migrationSql).toContain(
      `CREATE TRIGGER "provider_service_status_history_immutable"`,
    );
    expect(migrationSql).toContain(
      `CREATE TRIGGER "provider_service_prices_lifecycle_immutable"`,
    );
    expect(migrationSql).toContain("provider_service_price_history_immutable");
    expect(migrationSql).toContain("provider_service_status_history_immutable");
    expect(migrationSql).toContain("provider_service_prices_delete_forbidden");
  });

  it("does not insert Provider offering/price rows or drop predecessor tables", () => {
    expect(migrationSql).not.toMatch(
      /INSERT\s+INTO\s+"provider_services"/iu,
    );
    expect(migrationSql).not.toMatch(
      /INSERT\s+INTO\s+"provider_service_prices"/iu,
    );
    expect(migrationSql).not.toMatch(
      /INSERT\s+INTO\s+"provider_service_price_history"/iu,
    );
    expect(migrationSql).not.toMatch(
      /INSERT\s+INTO\s+"provider_service_status_history"/iu,
    );
    expect(migrationSql).not.toMatch(/DROP\s+TABLE\b/iu);
  });
});

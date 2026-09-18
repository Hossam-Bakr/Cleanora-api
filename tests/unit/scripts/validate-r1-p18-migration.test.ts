import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "r1_p18_order_execution_completion_code",
    "migration.sql",
  ),
  "utf8",
);

describe("R1-P18 migration SQL shape", () => {
  it("creates orders tables with unique booking_id and ACTIVE code partial unique", () => {
    expect(migrationSql).toContain(`CREATE TABLE "orders"`);
    expect(migrationSql).toContain(`CREATE UNIQUE INDEX "orders_booking_id_key"`);
    expect(migrationSql).toContain(`CREATE TABLE "completion_codes"`);
    expect(migrationSql).toContain(
      `CREATE UNIQUE INDEX "completion_codes_one_active_per_order_idx"`,
    );
    expect(migrationSql).toContain(`WHERE "status" = 'ACTIVE'`);
    expect(migrationSql).toContain(`CREATE TABLE "order_notification_intents"`);
    expect(migrationSql).toContain(`CREATE TABLE "order_actor_commands"`);
    expect(migrationSql).not.toContain(`ALTER TYPE "BookingStatus"`);
    expect(migrationSql).toContain(`'ON_THE_WAY'`);
  });

  it("does not invent wallets, fees, or FAILED status", () => {
    expect(migrationSql).not.toMatch(/CREATE TABLE "wallets"/u);
    expect(migrationSql).not.toMatch(/fee_minor|cancellation_fee/u);
    expect(migrationSql).not.toContain(`'FAILED'`);
    expect(migrationSql).not.toContain(`PENDING_SCHEDULED`);
    expect(migrationSql.replace(/--[^\n]*/gu, "")).not.toMatch(/\bDROP TABLE\b/u);
  });
});

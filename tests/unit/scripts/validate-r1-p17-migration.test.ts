import { readFileSync } from "node:fs";
import { join } from "node:path";

import { P17_EXECUTABLE_TRANSITIONS } from "#modules/bookings/bookings.matrix";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "r1_p17_worker_team_assignment",
    "migration.sql",
  ),
  "utf8",
);

describe("R1-P17 migration SQL shape", () => {
  it("adds ASSIGNED status and assignment tables with partial unique ACTIVE", () => {
    expect(migrationSql).toContain(`ADD VALUE 'ASSIGNED'`);
    expect(migrationSql).toContain(`CREATE TABLE "booking_assignments"`);
    expect(migrationSql).toContain(`CREATE TABLE "booking_assignment_members"`);
    expect(migrationSql).toContain(`CREATE TABLE "booking_assignment_history"`);
    expect(migrationSql).toContain(
      `CREATE UNIQUE INDEX "booking_assignments_one_active_per_booking_idx"`,
    );
    expect(migrationSql).toContain(`WHERE "status" = 'ACTIVE'`);
    expect(migrationSql).toContain(`BOOKING_ASSIGNED`);
    expect(migrationSql).toContain(`ASSIGN_TEAM`);
  });

  it("seeds P17 executable transition inventory", () => {
    for (const row of P17_EXECUTABLE_TRANSITIONS) {
      expect(migrationSql).toContain(`'${row.actor}'`);
      expect(migrationSql).toContain(`'${row.from}'`);
      expect(migrationSql).toContain(`'${row.to}'`);
      expect(migrationSql).toMatch(
        new RegExp(`'${row.actor}'[\\s\\S]*?'${row.from}'[\\s\\S]*?'${row.to}'`, "u"),
      );
    }
  });

  it("does not invent wallets or fees", () => {
    expect(migrationSql).not.toMatch(/CREATE TABLE "wallets"/u);
    expect(migrationSql).not.toMatch(/fee_minor|cancellation_fee/u);
    expect(migrationSql.replace(/--[^\n]*/gu, "")).not.toMatch(/\bDROP TABLE\b/u);
  });
});

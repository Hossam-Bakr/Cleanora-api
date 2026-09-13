import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import {
  isExecutableCustomerTransition,
  P16_EXECUTABLE_TRANSITIONS,
} from "#modules/bookings/bookings.matrix";

const repositoryRoot = process.cwd();
const bookingsRoot = join(repositoryRoot, "src", "modules", "bookings");
const migrationSql = readFileSync(
  join(
    repositoryRoot,
    "prisma",
    "migrations",
    "r1_p16_provider_booking_response_cancellation_events",
    "migration.sql",
  ),
  "utf8",
);

function sourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      result.push(...sourceFiles(path));
    } else if (extname(path) === ".ts") {
      result.push(path);
    }
  }
  return result;
}

describe("R1-P16 bookings module boundaries and migration shape", () => {
  it("does not import payments Prisma, wallets, or configuration infrastructure", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(bookingsRoot)) {
      const relativePath = relative(bookingsRoot, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      if (
        /#modules\/payments\/infrastructure/u.test(source) ||
        /#modules\/configuration\/infrastructure/u.test(source)
      ) {
        violations.push(`${relativePath} imported foreign infrastructure`);
      }
      if (
        relativePath === "bookings.response.service.ts" &&
        /#generated\/prisma|#database\/prisma/u.test(source)
      ) {
        violations.push("response service imported Prisma directly");
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not add fee, wallet, or refund-request columns in P16 SQL", () => {
    expect(migrationSql).not.toMatch(/CREATE TABLE "wallets"/u);
    expect(migrationSql).not.toMatch(/fee_minor|fee_amount|cancellation_fee/u);
    expect(migrationSql).not.toMatch(/CREATE TABLE "refund_requests"/u);
    expect(migrationSql.replace(/--[^\n]*/gu, "")).not.toMatch(/\bDROP TABLE\b/u);
    for (const table of [
      "cancellation_reasons",
      "booking_responses",
      "booking_cancellations",
      "booking_notification_intents",
      "booking_actor_commands",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("documents the P16 executable transition inventory", () => {
    for (const row of P16_EXECUTABLE_TRANSITIONS) {
      expect(migrationSql).toContain(`'${row.actor}', '${row.from}', '${row.to}'`);
    }
    expect(migrationSql).toContain("commercial.provider_response_hours");
    expect(migrationSql).toContain("PROVIDER_RESPONSE_EXPIRED");
    expect(isExecutableCustomerTransition("NONE", "DRAFT")).toBe(true);
    expect(isExecutableCustomerTransition("CONFIRMED", "CANCELLED")).toBe(false);
  });
});

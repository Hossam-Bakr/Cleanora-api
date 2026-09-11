import { readFileSync } from "node:fs";
import path from "node:path";

import { EXECUTABLE_TRANSITIONS } from "#modules/bookings/bookings.matrix";

const migrationSql = readFileSync(
  path.resolve(
    "prisma/migrations/r1_p13_booking_draft_pricing_snapshot_status_machine/migration.sql",
  ),
  "utf8",
);

interface SeededTransition {
  readonly id: string;
  readonly actor: string;
  readonly from: string;
  readonly to: string;
  readonly category: string;
  readonly executable: boolean;
  readonly preconditions: Record<string, unknown>;
  readonly sideEffects: Record<string, unknown>;
  readonly audit: Record<string, unknown>;
  readonly failure: Record<string, unknown>;
}

function parseSeededTransitions(sql: string): SeededTransition[] {
  const block = sql.match(
    /INSERT INTO "status_transition_rules"[\s\S]*?VALUES([\s\S]*?);/u,
  )?.[1];
  if (block === undefined) {
    throw new Error("status_transition_rules seed block missing");
  }
  const rows = [
    ...block.matchAll(
      /\('(?<id>[^']+)',\s*'(?<actor>[^']+)',\s*'(?<from>[^']+)',\s*'(?<to>[^']+)',\s*'(?<category>[^']+)',\s*(?<executable>true|false),\s*'(?<preconditions>\{[^']+\})',\s*'(?<sideEffects>\{[^']+\})',\s*'(?<audit>\{[^']+\})',\s*'(?<failure>\{[^']+\})'\)/gu,
    ),
  ];
  return rows.map((row) => {
    const groups = row.groups;
    if (groups === undefined) {
      throw new Error("status_transition_rules seed row missing groups");
    }
    return {
      id: groups["id"] ?? "",
      actor: groups["actor"] ?? "",
      from: groups["from"] ?? "",
      to: groups["to"] ?? "",
      category: groups["category"] ?? "",
      executable: groups["executable"] === "true",
      preconditions: JSON.parse(groups["preconditions"] ?? "{}") as Record<
        string,
        unknown
      >,
      sideEffects: JSON.parse(groups["sideEffects"] ?? "{}") as Record<
        string,
        unknown
      >,
      audit: JSON.parse(groups["audit"] ?? "{}") as Record<string, unknown>,
      failure: JSON.parse(groups["failure"] ?? "{}") as Record<string, unknown>,
    };
  });
}

describe("R1-P13 status_transition_rules seed", () => {
  const rows = parseSeededTransitions(migrationSql);

  it("documents actor, from, to, preconditions, side effects, audit, and failure for every executable row", () => {
    const executable = rows.filter((row) => row.executable);
    expect(executable).toHaveLength(EXECUTABLE_TRANSITIONS.length);
    for (const row of executable) {
      expect(row.actor.length).toBeGreaterThan(0);
      expect(row.from.length).toBeGreaterThan(0);
      expect(row.to.length).toBeGreaterThan(0);
      expect(Object.keys(row.preconditions).length).toBeGreaterThan(0);
      expect(Object.keys(row.sideEffects).length).toBeGreaterThan(0);
      expect(Object.keys(row.audit).length).toBeGreaterThan(0);
      expect(Object.keys(row.failure).length).toBeGreaterThan(0);
    }
    expect(
      executable.map((row) => `${row.actor}:${row.from}:${row.to}`).sort(),
    ).toEqual(
      [...EXECUTABLE_TRANSITIONS]
        .map((row) => `${row.actor}:${row.from}:${row.to}`)
        .sort(),
    );
  });

  it("keeps CONFIRMED, order, staff override, and emergency-as-status non-executable", () => {
    const confirmed = rows.find((row) => row.to === "CONFIRMED");
    expect(confirmed).toMatchObject({
      actor: "SYSTEM",
      from: "AWAITING_DEPOSIT",
      executable: false,
    });
    expect(confirmed?.failure["TRANSITION_NOT_AVAILABLE"]).toBe(true);
    expect(rows.find((row) => row.to === "PENDING_FULFILLMENT")?.executable).toBe(
      false,
    );
    expect(rows.find((row) => row.category === "PRIVILEGED_OVERRIDE")?.executable).toBe(
      false,
    );
    const emergency = rows.find((row) => row.category === "EMERGENCY_RELATED");
    expect(emergency?.executable).toBe(false);
    expect(emergency?.sideEffects["notAStatus"]).toBe(true);
    expect(
      rows.some(
        (row) =>
          row.from === "CANCELLED" && row.to === "DRAFT" && row.executable,
      ),
    ).toBe(false);
  });
});

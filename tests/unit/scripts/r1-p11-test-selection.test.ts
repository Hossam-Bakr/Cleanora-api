import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Asserts the R1-P11 Vitest selection stays Phase-11-only (T003).
 *
 * The resolved include-list must never reference a historical phase suite
 * (R1-P01..R1-P10) and must only reference Phase 11 paths.
 */
const configSource = readFileSync(
  join(process.cwd(), "vitest.r1-p11.config.ts"),
  "utf8",
);

/** Matches r1-p01..r1-p09 and r1-p10; does not match r1-p11. */
const HISTORICAL_PHASE_PATTERN = /r1-p(?:0[1-9]|10)(?!\d)/iu;

function extractIncludeBlock(source: string): string {
  const match = /include:\s*\[(?<body>[\s\S]*?)\],\s*restoreMocks/u.exec(
    source,
  );
  if (match?.groups?.["body"] === undefined) {
    throw new Error("Unable to locate the R1-P11 Vitest include block");
  }
  return match.groups["body"];
}

function extractStringLiterals(block: string): string[] {
  return [...block.matchAll(/"([^"]+)"/gu)].map((entry) => entry[1] ?? "");
}

describe("R1-P11 Vitest selection boundary (T003)", () => {
  const includeEntries = extractStringLiterals(extractIncludeBlock(configSource));

  it("selects at least one Phase 11 test file pattern", () => {
    expect(includeEntries.length).toBeGreaterThan(0);
  });

  it("never selects a historical-phase (R1-P01..R1-P10) suite", () => {
    const historicalMatches = includeEntries.filter((entry) =>
      HISTORICAL_PHASE_PATTERN.test(entry),
    );
    expect(historicalMatches).toEqual([]);
  });

  it("only selects tests/unit or tests/integration Phase 11 paths", () => {
    for (const entry of includeEntries) {
      expect(entry.startsWith("tests/unit/") || entry.startsWith("tests/integration/")).toBe(
        true,
      );
    }
  });

  it("names only production-owned coverage include paths under src/", () => {
    const coverageBlock = /coverage:\s*\{[\s\S]*?include:\s*\[(?<body>[\s\S]*?)\],\s*thresholds/u.exec(
      configSource,
    );
    expect(coverageBlock?.groups?.["body"]).toBeDefined();
    const coverageEntries = extractStringLiterals(
      coverageBlock?.groups?.["body"] ?? "",
    );
    expect(coverageEntries.length).toBeGreaterThan(0);
    for (const entry of coverageEntries) {
      expect(entry.startsWith("src/")).toBe(true);
    }
  });
});

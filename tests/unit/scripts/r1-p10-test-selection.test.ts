import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Asserts the R1-P10 Vitest selection stays Phase-10-only (T003).
 *
 * The resolved include-list must never reference a historical phase suite
 * (R1-P01..R1-P09) and must only reference Phase 10 paths.
 */
const configSource = readFileSync(
  join(process.cwd(), "vitest.r1-p10.config.ts"),
  "utf8",
);

const HISTORICAL_PHASE_PATTERN = /r1-p0[1-9](?!.*r1-p10)/iu;

function extractIncludeBlock(source: string): string {
  const match = /include:\s*\[(?<body>[\s\S]*?)\],\s*restoreMocks/u.exec(
    source,
  );
  if (match?.groups?.["body"] === undefined) {
    throw new Error("Unable to locate the R1-P10 Vitest include block");
  }
  return match.groups["body"];
}

function extractStringLiterals(block: string): string[] {
  return [...block.matchAll(/"([^"]+)"/gu)].map((entry) => entry[1] ?? "");
}

describe("R1-P10 Vitest selection boundary (T003)", () => {
  const includeEntries = extractStringLiterals(extractIncludeBlock(configSource));

  it("selects at least one Phase 10 test file pattern", () => {
    expect(includeEntries.length).toBeGreaterThan(0);
  });

  it("never selects a historical-phase (R1-P01..R1-P09) suite", () => {
    const historicalMatches = includeEntries.filter((entry) =>
      HISTORICAL_PHASE_PATTERN.test(entry),
    );
    expect(historicalMatches).toEqual([]);
  });

  it("only selects tests/unit or tests/integration Phase 10 paths", () => {
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

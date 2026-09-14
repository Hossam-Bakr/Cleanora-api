import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { P17_EXECUTABLE_TRANSITIONS } from "#modules/bookings/bookings.matrix";

const repositoryRoot = process.cwd();
const bookingsRoot = join(repositoryRoot, "src", "modules", "bookings");

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

describe("R1-P17 bookings assignment module boundaries", () => {
  it("assignment service does not import providers infrastructure or payments", () => {
    const assignmentFiles = [
      "bookings.assignment.service.ts",
      "bookings.assignment.policy.ts",
      "bookings.assignment.controller.ts",
      "bookings.assignment.routes.ts",
    ];
    const violations: string[] = [];
    for (const file of sourceFiles(bookingsRoot)) {
      const relativePath = relative(bookingsRoot, file).replaceAll("\\", "/");
      if (!assignmentFiles.includes(relativePath) && !relativePath.startsWith("bookings.assignment")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (
        /#modules\/providers\/infrastructure/u.test(source) ||
        /#modules\/payments\//u.test(source) ||
        /prisma-provider/u.test(source)
      ) {
        violations.push(`${relativePath} imported foreign infrastructure`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("documents P17 executable transitions", () => {
    expect(P17_EXECUTABLE_TRANSITIONS.length).toBeGreaterThanOrEqual(4);
  });
});

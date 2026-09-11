import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = process.cwd();
const bookingsRoot = join(repositoryRoot, "src", "modules", "bookings");
const commandServicePath = join(bookingsRoot, "bookings.command.service.ts");
const repositoryPath = join(
  bookingsRoot,
  "infrastructure",
  "prisma-bookings.repository.ts",
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

function importsOf(source: string): string[] {
  return [
    ...source.matchAll(/(?:from\s+|import\s*\()(["'])(?<specifier>[^"']+)\1/gu),
  ]
    .map((match) => match.groups?.["specifier"])
    .filter((value): value is string => value !== undefined);
}

describe("R1-P13 bookings module boundaries", () => {
  it("keeps Prisma and foreign infrastructure out of Bookings application files", () => {
    const violations: string[] = [];
    const prismaPatterns = [/#generated\/prisma/i, /#database\/prisma/];
    const foreignInfrastructure = [
      /#modules\/providers\/infrastructure/,
      /#modules\/catalog\/infrastructure/,
      /#modules\/eligibility\/infrastructure/,
      /#modules\/configuration\/infrastructure/,
      /#modules\/media\/infrastructure/,
      /#modules\/customers\/infrastructure/,
    ];
    for (const file of sourceFiles(bookingsRoot)) {
      const relativePath = relative(bookingsRoot, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      const patterns = relativePath.startsWith("infrastructure/")
        ? foreignInfrastructure
        : [...prismaPatterns, ...foreignInfrastructure];
      for (const pattern of patterns) {
        if (pattern.test(source)) {
          violations.push(`${relativePath} matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("owns booking persistence only inside Bookings infrastructure", () => {
    const repositorySource = readFileSync(repositoryPath, "utf8");
    expect(repositorySource).toMatch(/#generated\/prisma\/client/);
    expect(repositorySource).toMatch(/#database\/prisma/);
    expect(repositorySource).toMatch(/statusTransitionRule\.findFirst/);
    expect(repositorySource).toMatch(/updateMany/);
  });

  it("mutates bookings through explicit Eligibility, not the Browse facade", () => {
    const source = readFileSync(commandServicePath, "utf8");
    expect(source).toMatch(/#modules\/eligibility\/eligibility\.public/);
    expect(source).toMatch(/evaluateEligibility/);
    expect(source).toMatch(/mode:\s*"explicit"/);
    expect(source).not.toMatch(/getStandardBrowseCandidates/);
    expect(source).not.toMatch(/bookings\.matrix/);
    expect(source).not.toMatch(/isExecutableCustomerTransition/);
    expect(source).toMatch(/#modules\/configuration\/configuration\.public/);
    expect(source).toMatch(/#modules\/customers\/customers\.public/);
    expect(source).toMatch(/#modules\/media\/media\.public/);
    expect(source).toMatch(/#modules\/catalog\/catalog\.public/);
    expect(source).toMatch(/#modules\/providers\/providers\.public/);
  });

  it("does not import foreign module internals from Bookings sources", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(bookingsRoot)) {
      const relativePath = relative(bookingsRoot, file).replaceAll("\\", "/");
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        const normalized = specifier.replaceAll("\\", "/");
        if (
          /#modules\/(?!bookings\/)[a-z0-9-]+\/(?!.*\.public(?:\.js)?$)(?!auth\.middleware)/u.test(
            normalized,
          )
        ) {
          violations.push(`${relativePath} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = process.cwd();
const paymentsRoot = join(repositoryRoot, "src", "modules", "payments");

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

describe("R1-P15 payments module boundaries", () => {
  it("keeps Prisma out of payments application files", () => {
    const violations: string[] = [];
    const prismaPatterns = [/#generated\/prisma/i, /#database\/prisma/];
    for (const file of sourceFiles(paymentsRoot)) {
      const relativePath = relative(paymentsRoot, file).replaceAll("\\", "/");
      if (relativePath.startsWith("infrastructure/")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      for (const pattern of prismaPatterns) {
        if (pattern.test(source)) {
          violations.push(`${relativePath} matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not import bookings or configuration persistence", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(paymentsRoot)) {
      const relativePath = relative(paymentsRoot, file).replaceAll("\\", "/");
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        if (
          /#modules\/bookings\/(?!bookings\.public|bookings\.customer)/u.test(
            specifier,
          ) ||
          /#modules\/configuration\/(?!configuration\.public)/u.test(specifier)
        ) {
          violations.push(`${relativePath} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not invent wallet or InstaPay workflows", () => {
    const sources = sourceFiles(paymentsRoot)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/instapay/i);
    expect(sources).not.toMatch(/walletBalance|userWallet|storedValueWallet/i);
    expect(sources).not.toMatch(/executeGatewayRefund|postRefundJournal/);
  });
});

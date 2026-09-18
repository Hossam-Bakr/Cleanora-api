import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = process.cwd();
const ordersRoot = join(repositoryRoot, "src", "modules", "orders");

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

describe("R1-P18 orders module boundaries", () => {
  it("does not import bookings/providers/payments prisma or repositories", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(ordersRoot)) {
      const relativePath = relative(ordersRoot, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      if (
        /#modules\/bookings\/infrastructure/u.test(source) ||
        /#modules\/bookings\/.*\.repository/u.test(source) ||
        /prisma-bookings/u.test(source) ||
        /#modules\/providers\/infrastructure/u.test(source) ||
        /#modules\/payments\//u.test(source) ||
        /prisma-provider/u.test(source) ||
        /prisma-payments/u.test(source)
      ) {
        violations.push(`${relativePath} imported foreign infrastructure`);
      }
    }
    expect(violations).toEqual([]);
  });
});

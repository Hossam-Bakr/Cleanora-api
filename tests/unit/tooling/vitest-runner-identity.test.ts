import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const testsRoot = join(process.cwd(), "tests");
const runtimeVitestImport = /from\s+["']vitest["']/u;

async function listTypeScriptTests(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptTests(path);
      }
      return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
    })
  );

  return nested.flat();
}

describe("Vitest runner identity", () => {
  it("executes assertions through the worker-owned global API", () => {
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
  });

  it("prevents tests from importing a second runtime Vitest API", async () => {
    const files = await listTypeScriptTests(testsRoot);
    const violations = (
      await Promise.all(
        files.map(async (file) => {
          const source = await readFile(file, "utf8");
          return runtimeVitestImport.test(source)
            ? [relative(process.cwd(), file).split(sep).join("/")]
            : [];
        })
      )
    ).flat();

    expect(violations).toEqual([]);
  });

  it("keeps globals and runner-package deduplication enabled", async () => {
    const config = await readFile(
      join(process.cwd(), "vitest.config.ts"),
      "utf8"
    );

    expect(config).toContain("globals: true");
    expect(config).toContain("hookTimeout: 180_000");
    expect(config).toContain(
      'dedupe: ["vitest", "@vitest/runner", "@vitest/expect", "@vitest/utils"]'
    );
  });
});

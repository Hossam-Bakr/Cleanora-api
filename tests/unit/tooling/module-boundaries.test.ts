import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";


const modulesRoot = join(process.cwd(), "src/modules");

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
    })
  );
  return nested.flat();
}

describe("business module dependency boundaries", () => {
  it("keeps modules independent from route composition", async () => {
    const files = await listTypeScriptFiles(modulesRoot);
    const violations = (
      await Promise.all(
        files.map(async (file) => {
          const source = await readFile(file, "utf8");
          return /from\s+["']#routes\//.test(source)
            ? [relative(process.cwd(), file).split(sep).join("/")]
            : [];
        })
      )
    ).flat();

    expect(violations).toEqual([]);
  });

  it("keeps Prisma access inside each module infrastructure layer", async () => {
    const files = await listTypeScriptFiles(modulesRoot);
    const violations = (
      await Promise.all(
        files.map(async (file) => {
          const source = await readFile(file, "utf8");
          const usesPersistence =
            /#generated\/|#database\/prisma|\bPrismaClient\b/.test(source);
          const normalized = relative(modulesRoot, file).split(sep).join("/");
          const allowedPersistenceLocation =
            normalized.includes("/infrastructure/") ||
            normalized.endsWith(".repository.ts") ||
            normalized === "admin/audit.service.ts";
          return usesPersistence && !allowedPersistenceLocation
            ? [normalized]
            : [];
        })
      )
    ).flat();

    expect(violations).toEqual([]);
  });
});

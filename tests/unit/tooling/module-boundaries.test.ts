import { readdir, readFile, stat } from "node:fs/promises";
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

  it("lets only admin persistence map and write audit_logs", async () => {
    const files = await listTypeScriptFiles(modulesRoot);
    const writers = (
      await Promise.all(
        files.map(async (file) => {
          const source = await readFile(file, "utf8");
          return /\.auditLog\b/.test(source)
            ? [relative(modulesRoot, file).split(sep).join("/")]
            : [];
        })
      )
    ).flat();

    expect(writers.sort()).toEqual([
      "admin/audit.service.ts",
      "admin/infrastructure/prisma-denial-audit.writer.ts",
      "admin/infrastructure/prisma-general-transactional-audit.writer.ts",
      "admin/infrastructure/prisma-privileged-audit.writer.ts",
    ]);
  });
});

async function listModuleTypeScriptFiles(
  moduleName: "customers" | "media",
): Promise<string[]> {
  const moduleRoot = join(modulesRoot, moduleName);
  try {
    const moduleStat = await stat(moduleRoot);
    if (!moduleStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }
  return listTypeScriptFiles(moduleRoot);
}

describe("R1-P04 customers/media module boundaries", () => {
  async function collectViolations(
    predicate: (file: string, source: string) => boolean,
  ): Promise<string[]> {
    const violations: string[] = [];
    for (const moduleName of ["customers", "media"] as const) {
      const files = await listModuleTypeScriptFiles(moduleName);
      for (const file of files) {
        const source = await readFile(file, "utf8");
        if (predicate(file, source)) {
          violations.push(relative(process.cwd(), file).split(sep).join("/"));
        }
      }
    }
    return violations;
  }

  it("forbids importing authentication or admin repositories", async () => {
    const forbiddenImportPattern =
      /from\s+["'][^"']*(?:authentication|admin)\/infrastructure\/[^"']*repository[^"']*["']/u;
    const violations = await collectViolations((_file, source) =>
      forbiddenImportPattern.test(source),
    );

    expect(violations).toEqual([]);
  });

  it("forbids direct Prisma delegates outside each module infrastructure layer", async () => {
    const violations = await collectViolations((file, source) => {
      const usesPersistence =
        /#generated\/|#database\/prisma|\bPrismaClient\b/.test(source);
      const normalized = relative(modulesRoot, file).split(sep).join("/");
      const allowedPersistenceLocation =
        normalized.includes("/infrastructure/") ||
        normalized.endsWith(".repository.ts");
      return usesPersistence && !allowedPersistenceLocation;
    });

    expect(violations).toEqual([]);
  });

  it("forbids importing other modules' Prisma infrastructure writers", async () => {
    const forbiddenImportPattern =
      /from\s+["'][^"']*\/modules\/(?!customers|media)[^"']*\/infrastructure\/[^"']*["']/u;
    const violations = await collectViolations((_file, source) =>
      forbiddenImportPattern.test(source),
    );

    expect(violations).toEqual([]);
  });
});

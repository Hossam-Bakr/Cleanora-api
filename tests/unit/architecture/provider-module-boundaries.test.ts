import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const modulesRoot = join(process.cwd(), "src/modules");
const providersRoot = join(modulesRoot, "providers");

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  let directoryStat;
  try {
    directoryStat = await stat(directory);
  } catch {
    return [];
  }
  if (!directoryStat.isDirectory()) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
    }),
  );
  return nested.flat();
}

function toRepoPath(file: string): string {
  return relative(process.cwd(), file).split(sep).join("/");
}

describe("R1-P05 provider module boundaries", () => {
  it("forbids providers from importing other modules' infrastructure, controllers, or repositories", async () => {
    const files = await listTypeScriptFiles(providersRoot);
    expect(
      files.length,
      "providers module source tree should exist for boundary scanning",
    ).toBeGreaterThan(0);

    const forbidden =
      /from\s+["'][^"']*(?:modules\/)?(?:authentication|customers|media|admin|configuration)\/(?:infrastructure|[^"']*\.repository|[^"']*\.controller)[^"']*["']/u;
    const relativeForbidden =
      /from\s+["']\.\.\/(?:authentication|customers|media|admin|configuration)\/(?:infrastructure|[^"']*\.repository|[^"']*\.controller)[^"']*["']/u;

    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (forbidden.test(source) || relativeForbidden.test(source)) {
        violations.push(toRepoPath(file));
      }
    }

    expect(violations).toEqual([]);
  });

  it("allows cross-module imports only through named public contracts", async () => {
    const files = await listTypeScriptFiles(providersRoot);
    const importPattern = /from\s+["']((?:\.\.\/(?:authentication|customers|media|admin|configuration)\/|#modules\/(?:authentication|customers|media|admin|configuration)\/)[^"']*)["']/gu;
    const allowedSuffixes = [
      "authentication/authentication.public.js",
      "authentication/authentication.public",
      "customers/customers.public.js",
      "customers/customers.public",
      "media/media.public.js",
      "media/media.public",
      "admin/audit.public.js",
      "admin/audit.public",
      "configuration/configuration.public.js",
      "configuration/configuration.public",
      "catalog/catalog.public.js",
      "catalog/catalog.public",
    ];
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const imported = match[1] ?? "";
        if (!allowedSuffixes.some((suffix) => imported.endsWith(suffix))) {
          violations.push(`${toRepoPath(file)} -> ${imported}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps Media Prisma delegates out of application composition", async () => {
    const source = await readFile(join(process.cwd(), "src/composition.ts"), "utf8");
    expect(source).not.toMatch(/\.mediaFile\.(?:find|create|update|delete)/u);
    expect(source).not.toMatch(/\.country\.(?:find|create|update|delete)/u);
  });

  it("keeps the Configuration public seam persistence-agnostic", async () => {
    const source = await readFile(
      join(modulesRoot, "configuration", "configuration.public.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/#generated\//u);
    expect(source).not.toMatch(/#database\/prisma/u);
    expect(source).not.toMatch(/Prisma\.TransactionClient/u);
    expect(source).not.toMatch(/\.country\.(?:find|create|update|delete)/u);
  });

  it("forbids other business modules from importing providers infrastructure or repositories", async () => {
    const moduleEntries = await readdir(modulesRoot, { withFileTypes: true });
    const otherModules = moduleEntries
      .filter((entry) => entry.isDirectory() && entry.name !== "providers")
      .map((entry) => entry.name);

    const forbidden =
      /from\s+["'][^"']*providers\/(?:infrastructure|[^"']*\.repository)[^"']*["']/u;
    const violations: string[] = [];

    for (const moduleName of otherModules) {
      const files = await listTypeScriptFiles(join(modulesRoot, moduleName));
      for (const file of files) {
        const source = await readFile(file, "utf8");
        if (forbidden.test(source)) {
          violations.push(toRepoPath(file));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps providers.public free of Prisma and repository wiring", async () => {
    const source = await readFile(
      join(providersRoot, "providers.public.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/#generated\//u);
    expect(source).not.toMatch(/#database\/prisma/u);
    expect(source).not.toMatch(/\bPrismaClient\b/u);
    expect(source).not.toMatch(/infrastructure\//u);
    expect(source).not.toMatch(/Repository/u);
  });

  it("keeps Prisma access inside providers infrastructure when present", async () => {
    const files = await listTypeScriptFiles(providersRoot);
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const usesPersistence =
        /#generated\/|#database\/prisma|\bPrismaClient\b/.test(source);
      const normalized = relative(modulesRoot, file).split(sep).join("/");
      const allowed =
        normalized.includes("/infrastructure/") ||
        normalized.endsWith(".repository.ts");
      if (usesPersistence && !allowed) {
        violations.push(normalized);
      }
    }

    expect(violations).toEqual([]);
  });
});

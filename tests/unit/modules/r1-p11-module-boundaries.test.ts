import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { ELIGIBILITY_PUBLIC_CONTRACT } from "#modules/eligibility/eligibility.public";

const repositoryRoot = process.cwd();
const eligibilityRoot = join(repositoryRoot, "src", "modules", "eligibility");
const eligibilityPublicPath = join(eligibilityRoot, "eligibility.public.ts");
const routesIndexPath = join(repositoryRoot, "src", "routes", "index.ts");

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

function isAllowedForeignModuleImport(specifier: string): boolean {
  const normalized = specifier.replaceAll("\\", "/");
  return /(?:^|\/)[a-z0-9.-]+\.public(?:\.js)?$/u.test(normalized);
}

/**
 * True when a specifier reaches another business module's private path
 * (not a `*.public` contract). Relative paths that stay inside eligibility
 * are ignored.
 */
function isForeignModuleDeepImport(specifier: string): boolean {
  const normalized = specifier.replaceAll("\\", "/").replace(/^#modules\//u, "");
  if (isAllowedForeignModuleImport(specifier)) {
    return false;
  }
  if (
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    !normalized.includes("/")
  ) {
    // Relative imports: only flag if they escape into another module tree.
    const eligibilityRelative = normalized.match(
      /(?:^|[./])modules\/(?!eligibility\/)(?<module>[a-z0-9-]+)\//u,
    );
    return eligibilityRelative !== null;
  }
  const match = normalized.match(
    /(?:^|[./])(?:modules\/)?(?<module>[a-z0-9-]+)\/(?<rest>.+)$/u,
  );
  if (match?.groups === undefined) {
    return false;
  }
  const moduleName = match.groups["module"];
  if (moduleName === "eligibility") {
    return false;
  }
  const modulesRoot = join(repositoryRoot, "src", "modules");
  if (!existsSync(modulesRoot)) {
    return false;
  }
  const foreignModules = new Set(
    readdirSync(modulesRoot).filter((name) =>
      statSync(join(modulesRoot, name)).isDirectory(),
    ),
  );
  if (!foreignModules.has(moduleName ?? "")) {
    return false;
  }
  return true;
}

describe("R1-P11 module boundaries (Batch A / T006 + Batch C / T020)", () => {
  it("exposes the Eligibility public entry at eligibility.public.ts", () => {
    expect(existsSync(eligibilityPublicPath)).toBe(true);
    expect(ELIGIBILITY_PUBLIC_CONTRACT).toEqual({
      contractVersion: "eligibility.public.v1",
      module: "eligibility",
    });
  });

  it("does not create eligibility HTTP route files under the module", () => {
    const routeLike = sourceFiles(eligibilityRoot).filter((file) => {
      const name = relative(eligibilityRoot, file).replaceAll("\\", "/");
      return (
        name === "eligibility.routes.ts" ||
        /(?:^|\/)eligibility[^/]*\.routes\.ts$/u.test(name) ||
        /(?:^|\/).*eligibility.*\.routes\.ts$/u.test(name)
      );
    });
    expect(routeLike).toEqual([]);
  });

  it("does not register Eligibility routes in src/routes/index.ts", () => {
    const source = readFileSync(routesIndexPath, "utf8");
    expect(source).not.toMatch(/eligibility/iu);
    expect(source).not.toMatch(/Eligibility/u);
  });

  it("allows eligibility module sources to import other modules only through *.public contracts", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(eligibilityRoot)) {
      const source = readFileSync(file, "utf8");
      const relativePath = relative(eligibilityRoot, file).replaceAll("\\", "/");
      for (const specifier of importsOf(source)) {
        if (isForeignModuleDeepImport(specifier)) {
          violations.push(`${relativePath} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = process.cwd();
const catalogRoot = join(repositoryRoot, "src", "modules", "catalog");
const modulesRoot = join(repositoryRoot, "src", "modules");
const compositionPath = join(repositoryRoot, "src", "composition.ts");
const routesPath = join(repositoryRoot, "src", "routes", "index.ts");

function sourceFiles(root: string): string[] {
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

/**
 * T124 — Catalog consumers may use only catalog.public; Catalog itself uses
 * foreign module public contracts only (FR-002, FR-007, FR-043).
 */
describe("R1-P08 Catalog module boundaries", () => {
  it("imports Authentication, Media, Admin, and Configuration only through public contracts", () => {
    const allowed = {
      authentication: /(?:^|\/)authentication\/authentication\.public(?:\.js)?$/u,
      media: /(?:^|\/)media\/media\.public(?:\.js)?$/u,
      admin: /(?:^|\/)admin\/audit\.public(?:\.js)?$/u,
      configuration:
        /(?:^|\/)configuration\/configuration\.public(?:\.js)?$/u,
    } as const;
    const violations: string[] = [];

    for (const file of sourceFiles(catalogRoot)) {
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        const normalized = specifier.replaceAll("\\", "/").replace(/^#modules\//u, "");
        for (const [module, pattern] of Object.entries(allowed)) {
          if (normalized.includes(`${module}/`) && !pattern.test(normalized)) {
            violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not create Browse, Booking, or Workers modules", () => {
    for (const name of ["browse", "bookings", "workers"]) {
      expect(() =>
        statSync(join(repositoryRoot, "src", "modules", name)),
      ).toThrow();
    }
  });

  it("does not traverse Media-owned Prisma relations from Catalog repository code", () => {
    const repositorySource = readFileSync(
      join(catalogRoot, "catalog.repository.ts"),
      "utf8",
    );
    expect(repositorySource).not.toMatch(/include:\s*\{[^}]*mediaFile/s);
    expect(repositorySource).not.toMatch(/\.mediaFile\b/);
  });

  it("keeps Prisma client imports out of Catalog HTTP boundary files", () => {
    const boundaryFiles = [
      "catalog.routes.ts",
      "catalog.controller.ts",
      "catalog.schema.ts",
      "catalog.public.ts",
      "catalog.policy.ts",
      "catalog.errors.ts",
    ];
    const violations: string[] = [];
    for (const name of boundaryFiles) {
      const source = readFileSync(join(catalogRoot, name), "utf8");
      if (/(?:#database\/prisma|#generated\/prisma|@prisma\/client)/u.test(source)) {
        violations.push(name);
      }
    }
    expect(violations).toEqual([]);
  });

  it("allows non-Catalog business modules to import Catalog only through catalog.public", () => {
    const violations: string[] = [];
    for (const moduleDir of readdirSync(modulesRoot)) {
      if (moduleDir === "catalog") {
        continue;
      }
      const modulePath = join(modulesRoot, moduleDir);
      if (!statSync(modulePath).isDirectory()) {
        continue;
      }
      for (const file of sourceFiles(modulePath)) {
        for (const specifier of importsOf(readFileSync(file, "utf8"))) {
          const normalized = specifier.replaceAll("\\", "/");
          if (
            /(?:^|\/|#modules\/)catalog\//u.test(normalized) &&
            !/(?:^|\/|#modules\/)catalog\/catalog\.public(?:\.js)?$/u.test(normalized)
          ) {
            violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("publishes the narrow CatalogDefinitionReader factory through composition without Browse HTTP", () => {
    const composition = readFileSync(compositionPath, "utf8");
    const routes = readFileSync(routesPath, "utf8");

    expect(composition).toMatch(/createCatalogDefinitionReader/u);
    expect(composition).toMatch(/catalogDefinitionReader/u);
    expect(routes).toMatch(/\$\{apiPrefix\}\/staff\/catalog/u);
    expect(routes).not.toMatch(/\$\{apiPrefix\}\/catalog(?:\/|"|'|`|\s|,)/u);
    expect(routes).not.toMatch(/\/api\/v1\/catalog\/services/u);
  });

  it("composes CatalogDefinitionReader independently of the staff-router Authentication conditional", () => {
    const composition = readFileSync(compositionPath, "utf8");
    const routes = readFileSync(routesPath, "utf8");

    const catalogServiceIndex = composition.indexOf(
      "const catalogService = new CatalogService",
    );
    const readerFactoryIndex = composition.indexOf(
      "const catalogDefinitionReader = createCatalogDefinitionReader",
    );
    const staffRouterIndex = composition.indexOf("const staffCatalogRouter");
    expect(catalogServiceIndex).toBeGreaterThan(-1);
    expect(readerFactoryIndex).toBeGreaterThan(-1);
    expect(staffRouterIndex).toBeGreaterThan(-1);
    expect(catalogServiceIndex).toBeLessThan(readerFactoryIndex);
    expect(readerFactoryIndex).toBeLessThan(staffRouterIndex);

    expect(composition).not.toMatch(
      /catalogDefinitionReader:\s*staffCatalogRouter\?\.catalogDefinitionReader/u,
    );

    const sharedCatalogBlock = composition.slice(
      catalogServiceIndex,
      readerFactoryIndex,
    );
    expect(sharedCatalogBlock).toMatch(/new CatalogService\(\{/u);
    expect(sharedCatalogBlock).toMatch(/repository:/u);
    expect(sharedCatalogBlock).not.toMatch(/catalogServiceImage:/u);
    expect(sharedCatalogBlock).not.toMatch(/createCatalogServiceImagePort/u);

    expect(routes).toMatch(/\$\{apiPrefix\}\/staff\/catalog/u);
    expect(routes).not.toMatch(/\$\{apiPrefix\}\/catalog(?:\/|"|'|`|\s|,)/u);
    expect(routes).not.toMatch(/\/api\/v1\/catalog\/services/u);
  });
});

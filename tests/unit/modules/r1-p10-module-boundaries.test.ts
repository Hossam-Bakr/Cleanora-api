import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = process.cwd();
const providersRoot = join(repositoryRoot, "src", "modules", "providers");
const configurationRoot = join(repositoryRoot, "src", "modules", "configuration");
const modulesRoot = join(repositoryRoot, "src", "modules");
const schemaPath = join(repositoryRoot, "prisma", "schema.prisma");

const R1_P10_LOCALITY_MODELS = ["City", "District"] as const;
const R1_P10_AVAILABILITY_MODELS = [
  "ProviderAvailabilityConfiguration",
  "ProviderCoverageArea",
  "ProviderSchedule",
  "ProviderScheduleException",
  "ProviderCapacityRule",
  "ProviderTemporaryPause",
  "ProviderAvailabilityCommand",
  "ProviderAvailabilityHistory",
] as const;

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

function isAllowedForeignModuleImport(specifier: string): boolean {
  const normalized = specifier.replaceAll("\\", "/");
  return /(?:^|\/)[a-z0-9.-]+\.public(?:\.js)?$/u.test(normalized);
}

function isForeignModuleDeepImport(
  specifier: string,
  ownModule: string,
): boolean {
  const normalized = specifier.replaceAll("\\", "/").replace(/^#modules\//u, "");
  const match = normalized.match(
    /(?:^|[./])(?:modules\/)?(?<module>[a-z0-9-]+)\/(?<rest>.+)$/u,
  );
  if (match?.groups === undefined) {
    return false;
  }
  const moduleName = match.groups["module"];
  if (moduleName === ownModule) {
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
  return !isAllowedForeignModuleImport(specifier);
}

function violationsFor(root: string, ownModule: string): string[] {
  const violations: string[] = [];
  for (const file of sourceFiles(root)) {
    for (const specifier of importsOf(readFileSync(file, "utf8"))) {
      if (isForeignModuleDeepImport(specifier, ownModule)) {
        violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
      }
    }
  }
  return violations;
}

describe("R1-P10 module boundaries (Batch A)", () => {
  it("allows Providers availability code to import other modules only through *.public contracts", () => {
    expect(violationsFor(providersRoot, "providers")).toEqual([]);
  });

  it("allows Configuration locality code to import other modules only through *.public contracts", () => {
    expect(violationsFor(configurationRoot, "configuration")).toEqual([]);
  });

  it("forbids Providers availability code from reaching Configuration's repository or Prisma implementation directly", () => {
    const forbidden = /(?:modules\/|#modules\/)configuration\/(?:.*\.repository|infrastructure\/prisma-)/u;
    const violations: string[] = [];
    for (const file of sourceFiles(providersRoot)) {
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        const normalized = specifier.replaceAll("\\", "/");
        if (forbidden.test(normalized) && !isAllowedForeignModuleImport(specifier)) {
          violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("Configuration's locality infrastructure never imports from Providers or Authentication", () => {
    for (const file of [
      "prisma-locality.repository.ts",
      "locality-serialization-errors.ts",
    ]) {
      const source = readFileSync(
        join(configurationRoot, "infrastructure", file),
        "utf8",
      );
      expect(source).not.toMatch(/#modules\/providers/u);
      expect(source).not.toMatch(/#modules\/authentication/u);
    }
  });

  it("declares the R1-P10 locality Prisma models owned by Configuration", () => {
    const schema = readFileSync(schemaPath, "utf8");
    for (const name of R1_P10_LOCALITY_MODELS) {
      expect(schema).toMatch(new RegExp(`^model\\s+${name}\\s*\\{`, "mu"));
    }
  });

  it("declares the R1-P10 availability Prisma models owned by Providers", () => {
    const schema = readFileSync(schemaPath, "utf8");
    for (const name of R1_P10_AVAILABILITY_MODELS) {
      expect(schema).toMatch(new RegExp(`^model\\s+${name}\\s*\\{`, "mu"));
    }
  });

  it("does not create Browse, Booking, or Docker/cloud modules in this batch", () => {
    for (const name of ["browse", "bookings", "booking"]) {
      expect(() => statSync(join(modulesRoot, name))).toThrow();
    }
  });

  it("exposes no customer or anonymous Phase 10 operational-evaluation HTTP route", () => {
    const routesIndex = readFileSync(
      join(repositoryRoot, "src", "routes", "index.ts"),
      "utf8",
    );
    const availabilityRoutes = readFileSync(
      join(providersRoot, "provider-availability.routes.ts"),
      "utf8",
    );
    expect(routesIndex).not.toMatch(
      /\/api\/v1\/(?:browse|public|anonymous).*availability/iu,
    );
    expect(availabilityRoutes).not.toMatch(
      /(?:customer|anonymous|public).*evaluat/iu,
    );
    expect(availabilityRoutes).toMatch(/authenticateAccess/u);
    expect(availabilityRoutes).not.toMatch(
      /\/availability\/(?:evaluate|candidates)/u,
    );
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = process.cwd();
const providersRoot = join(repositoryRoot, "src", "modules", "providers");
const modulesRoot = join(repositoryRoot, "src", "modules");
const schemaPath = join(repositoryRoot, "prisma", "schema.prisma");

const R1_P09_MODELS = [
  "ProviderService",
  "ProviderServicePrice",
  "ProviderServicePriceHistory",
  "ProviderServiceStatusHistory",
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
  // Any foreign *.public(.js) contract — alias or relative — is allowed.
  return /(?:^|\/)[a-z0-9.-]+\.public(?:\.js)?$/u.test(normalized);
}

function isForeignModuleDeepImport(specifier: string): boolean {
  const normalized = specifier.replaceAll("\\", "/").replace(/^#modules\//u, "");
  const match = normalized.match(
    /(?:^|[./])(?:modules\/)?(?<module>[a-z0-9-]+)\/(?<rest>.+)$/u,
  );
  if (match?.groups === undefined) {
    return false;
  }
  const moduleName = match.groups["module"];
  if (moduleName === "providers") {
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

describe("R1-P09 Providers module boundaries (T009)", () => {
  it("keeps country persistence behind Configuration's public identity reader", () => {
    const source = readFileSync(join(providersRoot, "infrastructure", "prisma-provider-service.repository.ts"), "utf8");
    expect(source).not.toMatch(/(?:FROM|JOIN)\s+"(?:countries|currencies|country_configs)"/u);
    expect(source).toContain("countryIdentityReader.getCountryCodeById");
  });
  it("allows Providers to import other modules only through *.public contracts", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(providersRoot)) {
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        if (isForeignModuleDeepImport(specifier)) {
          violations.push(
            `${relative(repositoryRoot, file)} -> ${specifier}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("forbids Providers from importing foreign repositories, controllers, or Prisma implementations", () => {
    const forbidden =
      /(?:modules\/|#modules\/)(?!providers\/)[a-z0-9-]+\/(?:.*(?:\.repository|controller|routes)|infrastructure\/prisma-)/u;
    const violations: string[] = [];
    for (const file of sourceFiles(providersRoot)) {
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        const normalized = specifier.replaceAll("\\", "/");
        if (forbidden.test(normalized) && !isAllowedForeignModuleImport(specifier)) {
          violations.push(
            `${relative(repositoryRoot, file)} -> ${specifier}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("declares exactly the four R1-P09 Provider service Prisma models", () => {
    const schema = readFileSync(schemaPath, "utf8");
    const modelNames = [
      ...schema.matchAll(/^model\s+(?<name>ProviderService\w*)\s*\{/gmu),
    ]
      .map((match) => match.groups?.["name"])
      .filter((name): name is string => name !== undefined);

    expect(modelNames).toEqual([...R1_P09_MODELS]);
  });

  it("does not create standalone Browse or singular Booking modules", () => {
    for (const name of ["browse", "booking"]) {
      expect(() => statSync(join(modulesRoot, name))).toThrow();
    }
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";


const repositoryRoot = process.cwd();
const providersRoot = join(repositoryRoot, "src", "modules", "providers");

function sourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) result.push(...sourceFiles(path));
    else if (extname(path) === ".ts") result.push(path);
  }
  return result;
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s*\()(["'])(?<specifier>[^"']+)\1/gu)]
    .map((match) => match.groups?.["specifier"])
    .filter((value): value is string => value !== undefined);
}

function foreignModule(specifier: string): "authentication" | "media" | "admin" | null {
  const match = specifier.match(/(?:^|\/)(authentication|media|admin)\//u);
  return (match?.[1] as "authentication" | "media" | "admin" | undefined) ?? null;
}

function r1p07ProviderFile(file: string): boolean {
  const name = relative(providersRoot, file).replaceAll("\\", "/");
  return /(?:^|\/)(?:provider-(?:team|worker-self|workforce)|prisma-provider-workforce|prisma-providers-workforce)/u.test(name)
    || name === "providers.public.ts";
}

describe("R1-P07 modular-monolith boundaries", () => {
  it("allows Providers to reach Authentication, Media, and Admin only through approved public contracts", () => {
    const violations: string[] = [];
    const allowedTarget = {
      authentication: /(?:^|\/)authentication\/authentication\.public(?:\.js)?$/u,
      media: /(?:^|\/)media\/media\.public(?:\.js)?$/u,
      admin: /(?:^|\/)admin\/audit\.public(?:\.js)?$/u,
    } as const;

    for (const file of sourceFiles(providersRoot).filter(r1p07ProviderFile)) {
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        const module = foreignModule(specifier.replaceAll("\\", "/"));
        if (module === null) continue;
        const normalized = specifier.replaceAll("\\", "/").replace(/^#modules/u, "");
        if (!allowedTarget[module].test(normalized)) {
          violations.push(`${relative(repositoryRoot, file)} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps Prisma/database imports inside Providers infrastructure and creates no separate Workers module", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(providersRoot).filter(r1p07ProviderFile)) {
      const relativeFile = relative(providersRoot, file).replaceAll("\\", "/");
      if (relativeFile.startsWith("infrastructure/")) continue;
      const source = readFileSync(file, "utf8");
      if (/(?:#database\/prisma|#generated\/prisma|@prisma\/client)/u.test(source)) {
        violations.push(relative(repositoryRoot, file));
      }
    }
    expect(violations).toEqual([]);
    expect(() => statSync(join(repositoryRoot, "src", "modules", "workers"))).toThrow();
  });

  it("keeps Authentication, Media, and Admin R1-P07 adapters independent of Providers internals", () => {
    const adapterFiles = [
      "src/modules/authentication/infrastructure/prisma-worker-invitation-onboarding.ts",
      "src/modules/authentication/infrastructure/prisma-worker-workforce.adapters.ts",
      "src/modules/media/infrastructure/worker-avatar.adapter.ts",
      "src/modules/admin/audit.public.ts",
    ];
    const violations = adapterFiles.flatMap((file) => {
      const source = readFileSync(join(repositoryRoot, file), "utf8");
      return importsOf(source)
        .filter((specifier) => /(?:^|\/)providers\/(?:domain|infrastructure)/u.test(specifier))
        .map((specifier) => `${file} -> ${specifier}`);
    });
    expect(violations).toEqual([]);
  });
});

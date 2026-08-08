import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : entry.name.endsWith(".ts")
        ? [path]
        : [];
  });
}

describe("media module boundary", () => {
  it("forbids media domain/infrastructure imports from customers", () => {
    const customersRoot = join(
      process.cwd(),
      "src",
      "modules",
      "customers",
    );
    const violations = sourceFiles(customersRoot)
      .filter((path) =>
        /modules[\\/]media[\\/](domain|infrastructure)/u.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map((path) => relative(process.cwd(), path));
    expect(violations).toEqual([]);
  });

  it("keeps media.public.ts free of infrastructure imports and Prisma wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "modules", "media", "media.public.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /^\s*import\s+[\s\S]*?from\s+["'][^"']*infrastructure\//mu,
    );
    expect(source).not.toContain("PrismaMediaRepository");
    expect(source).not.toContain("createOpaqueCloudinaryPublicId");
    expect(source).not.toMatch(/\bnew Prisma\b/u);
  });
});

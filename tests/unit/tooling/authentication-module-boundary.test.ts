import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('authentication module boundary', () => {
  it('forbids deep authentication imports from other business modules', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const moduleRoot = join(sourceRoot, 'modules', 'authentication');
    const businessModulesRoot = join(sourceRoot, "modules");
    const violations = sourceFiles(businessModulesRoot)
      .filter((path) => !path.startsWith(moduleRoot))
      .filter((path) =>
        /modules[\\/]authentication[\\/](domain|infrastructure)/u.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map((path) => relative(process.cwd(), path));
    expect(violations).toEqual([]);
  });

  it('keeps Prisma and repositories out of the public authentication contract', () => {
    const publicEntry = readFileSync(
      join(
        process.cwd(),
        "src",
        "modules",
        "authentication",
        "auth.module.ts",
      ),
      "utf8",
    );
    expect(publicEntry).not.toMatch(/export[^\n]*(Prisma|Repository)/u);
  });
});

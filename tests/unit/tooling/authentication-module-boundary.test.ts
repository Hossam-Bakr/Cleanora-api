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

  it('keeps the admin audit_logs delegate out of every authentication file', () => {
    const authenticationRoot = join(
      process.cwd(),
      'src',
      'modules',
      'authentication',
    );
    const violations = sourceFiles(authenticationRoot)
      .filter((path) => /\.auditLog\b/u.test(readFileSync(path, 'utf8')))
      .map((path) => relative(process.cwd(), path));

    expect(violations).toEqual([]);
  });

  it('keeps admin persistence internals out of every authentication file', () => {
    const authenticationRoot = join(
      process.cwd(),
      'src',
      'modules',
      'authentication',
    );
    const violations = sourceFiles(authenticationRoot)
      .filter((path) =>
        /modules[\\/]admin[\\/](infrastructure|.*\.repository)/u.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map((path) => relative(process.cwd(), path));

    expect(violations).toEqual([]);
  });

  it('keeps Prisma out of the role-management workflow and its business ports', () => {
    const businessContractFiles = [
      'src/modules/authentication/role-management.service.ts',
      'src/modules/authentication/role-management.unit-of-work.ts',
      'src/modules/authentication/domain/authorization.ports.ts',
      'src/modules/authentication/domain/authorization.types.ts',
    ];

    for (const file of businessContractFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/#generated\//u);
      expect(source).not.toMatch(/#database\/prisma/u);
      expect(source).not.toMatch(/\bPrismaClient\b/u);
      // Prisma namespace types such as Prisma.TransactionClient.
      expect(source).not.toMatch(/\bPrisma\.[A-Z]/u);
    }
  });

  it('keeps any and unknown escape hatches out of the transaction path', () => {
    const transactionPathFiles = [
      'src/modules/authentication/role-management.service.ts',
      'src/modules/authentication/role-management.unit-of-work.ts',
      'src/modules/authentication/domain/authorization.ports.ts',
      'src/modules/authentication/infrastructure/prisma-role-management.unit-of-work.ts',
      'src/modules/admin/infrastructure/prisma-privileged-audit.writer.ts',
    ];

    for (const file of transactionPathFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/:\s*any\b/u);
      expect(source).not.toMatch(/\bas\s+any\b/u);
      expect(source).not.toMatch(/<any>/u);
      expect(source).not.toMatch(/:\s*unknown\b/u);
      expect(source).not.toMatch(/\bas\s+unknown\b/u);
      // Type assertions such as `as Prisma.InputJsonValue` or `as SomeType`.
      // Do not match ordinary English "as" in comments or prose.
      expect(source).not.toMatch(
        /\bas\s+(?:const|Prisma\.[A-Za-z]+|[A-Z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)\b/u,
      );
      expect(source).not.toMatch(/Record\s*<[^>]*\bunknown\b/u);
      expect(source).not.toMatch(/AsyncLocalStorage/u);
    }
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

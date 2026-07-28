import { readFile } from "node:fs/promises";
import { join } from "node:path";


describe("CI database validation gate", () => {
  it("generates Prisma Client automatically before every production build", async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["prebuild"]).toBe("npm run prisma:generate");
    expect(packageJson.scripts["build"]).toBe("tsc -p tsconfig.build.json");
  });

  it("generates Prisma Client before typecheck and binds the isolated coverage database", async () => {
    const workflow = await readFile(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8"
    );

    const generateIndex = workflow.indexOf("npm run prisma:generate");
    const typecheckIndex = workflow.indexOf("npm run typecheck");

    expect(generateIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(generateIndex);
    expect(workflow).toMatch(
      /TEST_DATABASE_URL:\s*\$\{\{\s*secrets\.TEST_DATABASE_URL\s*\|\|\s*vars\.TEST_DATABASE_URL\s*\}\}/
    );
    expect(workflow).toContain(
      "TEST_DATABASE_URL is required for the database-backed coverage suite."
    );
  });

  it("runs full DB validation conditionally from a configured URL without requiring .env", async () => {
    const [workflow, packageJson, dbValidator, prismaConfig] = await Promise.all([
      readFile(join(process.cwd(), ".github/workflows/ci.yml"), "utf8"),
      readFile(join(process.cwd(), "package.json"), "utf8"),
      readFile(join(process.cwd(), "scripts/ci-db-validate.ts"), "utf8"),
      readFile(join(process.cwd(), "prisma.config.ts"), "utf8")
    ]);

    expect(workflow).toContain("CI_DATABASE_URL:");
    expect(workflow).toMatch(/secrets\.CI_DATABASE_URL/);
    expect(workflow).toMatch(/vars\.CI_DATABASE_URL/);
    expect(workflow).toMatch(/if:\s*env\.CI_DATABASE_URL\s*!=\s*''/);
    expect(workflow).toMatch(/if:\s*env\.CI_DATABASE_URL\s*==\s*''/);
    expect(workflow).toContain("skipped as unavailable");
    expect(workflow).toContain("npm run db:ci-validate");
    expect(workflow).not.toMatch(/docker|testcontainers/i);

    const parsedPackage = JSON.parse(packageJson) as {
      scripts: Record<string, string>;
    };
    expect(parsedPackage.scripts["ci"]).not.toContain("db:ci-validate");
    expect(parsedPackage.scripts["db:validate-clean-migration"]).toContain(
      "--env-file-if-exists=.env"
    );
    expect(parsedPackage.scripts["db:ci-validate"]).toContain(
      "--env-file-if-exists=.env"
    );
    expect(dbValidator).toContain('process.env["CI_DATABASE_URL"]');
    expect(dbValidator).toContain("DATABASE_URL: connectionString");
    expect(dbValidator).toContain('runNodeScript("scripts/seed.ts"');
    expect(dbValidator).toContain('runNodeScript("scripts/count-seed-rows.ts"');
    expect(prismaConfig).toContain('process.env["DATABASE_URL"] ??');
    expect(prismaConfig).toContain("127.0.0.1:1/cleanora_unconfigured");
  });
});

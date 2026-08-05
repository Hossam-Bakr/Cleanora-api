import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("production build configuration", () => {
  it("generates a CommonJS Prisma Client for the CommonJS runtime", async () => {
    const [packageJson, prismaSchema] = await Promise.all([
      readFile(join(process.cwd(), "package.json"), "utf8"),
      readFile(join(process.cwd(), "prisma/schema.prisma"), "utf8"),
    ]);
    const parsedPackage = JSON.parse(packageJson) as { type: string };

    expect(parsedPackage.type).toBe("commonjs");
    expect(prismaSchema).toMatch(/moduleFormat\s*=\s*"cjs"/);
  });

  it("generates Prisma Client automatically before every build", async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["prebuild"]).toBe("npm run prisma:generate");
    expect(packageJson.scripts["build"]).toBe("tsc -p tsconfig.build.json");
  });
});

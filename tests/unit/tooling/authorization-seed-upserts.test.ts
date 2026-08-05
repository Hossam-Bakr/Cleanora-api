import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T085: authorization definition seeding must upsert by stable `code` so a
 * second run restores drifted names/operations/isActive without duplicates.
 */
describe("authorization seed upserts", () => {
  const seedSource = readFileSync(
    join(process.cwd(), "prisma", "seed.ts"),
    "utf8",
  );

  it("upserts roles, permissions, reasons, and role-permissions by natural key", () => {
    expect(seedSource).toMatch(/role\.upsert\s*\(/u);
    expect(seedSource).toMatch(/permission\.upsert\s*\(/u);
    expect(seedSource).toMatch(/privilegedActionReason\.upsert\s*\(/u);
    expect(seedSource).toMatch(/rolePermission\.upsert\s*\(/u);
  });

  it("does not use createMany(skipDuplicates) for authorization definitions", () => {
    const authSeedStart = seedSource.indexOf(
      "async function seedAuthorizationDefinitions",
    );
    const authSeedEnd = seedSource.indexOf(
      "export async function seed(",
      authSeedStart,
    );
    expect(authSeedStart).toBeGreaterThanOrEqual(0);
    expect(authSeedEnd).toBeGreaterThan(authSeedStart);

    const authSeed = seedSource.slice(authSeedStart, authSeedEnd);
    expect(authSeed).not.toMatch(/createMany\s*\(/u);
    expect(authSeed).not.toMatch(/skipDuplicates\s*:\s*true/u);
  });
});

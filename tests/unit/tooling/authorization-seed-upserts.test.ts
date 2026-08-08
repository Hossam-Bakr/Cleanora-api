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

  it("upserts roles/permissions/role-permissions and privileged reasons by catalog keys", () => {
    expect(seedSource).toMatch(/role\.upsert\s*\(/u);
    expect(seedSource).toMatch(/permission\.upsert\s*\(/u);
    expect(seedSource).toMatch(/rolePermission\.upsert\s*\(/u);
    // Reasons use @@unique(operation); clear conflicting operation holders,
    // upsert by code inside a transaction, and retry bounded P2002/P2034.
    expect(seedSource).toMatch(/privilegedActionReason\.deleteMany\s*\(/u);
    expect(seedSource).toMatch(/privilegedActionReason\.upsert\s*\(/u);
    expect(seedSource).toMatch(/\$transaction\s*\(/u);
    expect(seedSource).toMatch(/P2002/u);
    expect(seedSource).toMatch(/P2034/u);
    expect(seedSource).toMatch(/maxAttempts\s*=\s*3/u);
    expect(seedSource).not.toMatch(/privilegedActionReason\.create\s*\(/u);
  });

  it("reuses an injected Prisma client and caps standalone seed pools at one connection", () => {
    expect(seedSource).toMatch(/export async function seed\(existingClient\?: PrismaClient\)/u);
    expect(seedSource).toMatch(/max:\s*1/u);
    expect(seedSource).toMatch(/ownsClient/u);
    expect(seedSource).toMatch(/if \(ownsClient\)/u);
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

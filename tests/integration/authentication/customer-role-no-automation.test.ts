import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { seed } from "../../../prisma/seed.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";

const hasDatabase = hasApprovedTestDatabaseUrl();

/**
 * DEC-030: Release 1 must never auto-create customer user_roles from signup,
 * verification, category activation, or seed. R1-P04 eligibility is documented
 * separately and is not implemented in this phase.
 */
describe("customer role automation guardrails (DEC-030)", () => {
  it("keeps signup, verification, and seed free of automatic customer grants in source", () => {
    const seedSource = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");
    const authService = readFileSync(
      join(process.cwd(), "src/modules/authentication/auth.service.ts"),
      "utf8",
    );
    const googleAuth = readFileSync(
      join(process.cwd(), "src/modules/authentication/google-auth.service.ts"),
      "utf8",
    );
    const roleManagement = readFileSync(
      join(process.cwd(), "src/modules/authentication/role-management.service.ts"),
      "utf8",
    );

    expect(seedSource).toMatch(/never creates a user-role grant/i);
    expect(seedSource).not.toMatch(/userRole\.create/);
    expect(authService).not.toMatch(/roleManagement|userRole\.create|assignRole\(/);
    expect(googleAuth).not.toMatch(/userRole\.create|assignRole\(/);
    expect(roleManagement).not.toMatch(
      /accountCategor|verifiedCategor|auto.?grant|provisionCustomer/i,
    );
  });

  it.skipIf(!hasDatabase)(
    "does not create automatic customer user_roles from seed or user creation",
    async () => {
      const database = await startTestDatabaseLifecycle();
      try {
        await seed();
        const prisma = getPrismaClient();
        const customerRole = await prisma.role.findUniqueOrThrow({
          where: { code: "customer" },
        });
        const before = await prisma.userRole.count({
          where: { roleId: customerRole.id },
        });

        const digits = randomUUID().replace(/\D/gu, "").slice(0, 9).padEnd(9, "0");
        const user = await prisma.user.create({
          data: {
            phoneE164: `+2010${digits}`,
            emailNormalized: `no-auto-${digits}@example.test`,
            accountCategories: ["INDIVIDUAL"],
            emailVerifiedAt: new Date(),
            status: "ACTIVE",
          },
        });

        expect(
          await prisma.userRole.findFirst({
            where: { userId: user.id, roleId: customerRole.id },
          }),
        ).toBeNull();
        expect(
          await prisma.userRole.count({ where: { roleId: customerRole.id } }),
        ).toBe(before);
      } finally {
        await stopTestDatabaseLifecycle(database);
      }
    },
    180_000,
  );
});
